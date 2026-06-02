import type { Metadata } from "next";
import Link from "next/link";
import { MetaPixelPurchase, MetaPixelScript } from "@/components/storefront/meta-pixel";
import { ClearStoreCartOnOrderSuccess } from "@/components/storefront/public-store-cart";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { submitPurchasedProductReview } from "@/lib/product-review-actions";
import { getProductReviewStatusByOrder } from "@/lib/product-reviews";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { defaultStoreSeoSettings, loadStoreSeoSettings } from "@/lib/store-seo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type PublicOrderConfirmationPageProps = {
  params: Promise<{
    orderId: string;
    slug: string;
  }>;
  searchParams: Promise<{
    review?: string;
    source?: string;
  }>;
};

type OrderSource = "orders" | "store_orders";

type ConfirmationItem = {
  id?: string;
  image: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  title: string;
};

function reviewMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "already-submitted": "Review already submitted for this product.",
    failed: "Review could not be submitted. Please try again.",
    invalid: "Choose a rating from 1 to 5 and add a review comment.",
    "invalid-product": "That product was not found in this order.",
    "not-configured": "Review submission is not configured yet.",
    submitted: "Review submitted and waiting for approval."
  };

  return status ? messages[status] : null;
}

function whatsappHref(number: string | null, message: string) {
  const destination = number?.replace(/\D/g, "");

  if (!destination) {
    return null;
  }

  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMoney(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(numericValue(amount));
}

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function deliveryMethodLabel(value: string | null | undefined) {
  if (value === "delivery") {
    return "Delivery";
  }

  if (value === "pickup") {
    return "Pickup";
  }

  return "Not selected";
}

function productsSummary(items: ConfirmationItem[]) {
  if (!items.length) {
    return "Products snapshot unavailable";
  }

  return items.map((item) => `${item.title} x${item.quantity}`).join(", ");
}

function whatsAppOrderMessage({
  order,
  storeTitle
}: {
  order: {
    currency: string;
    customer_name: string;
    delivery_method?: string | null;
    id: string;
    items: ConfirmationItem[];
    total: number | string;
  };
  storeTitle: string | null;
}) {
  const lines = [
    `Hi ${storeTitle ?? "there"}, I am following up on my order.`,
    `Order reference: ${orderReference(order.id)}`,
    `Customer: ${order.customer_name}`,
    `Delivery method: ${deliveryMethodLabel(order.delivery_method)}`,
    `Total: ${formatMoney(order.total, order.currency)}`,
    `Currency: ${order.currency}`,
    `Products: ${productsSummary(order.items)}`
  ];

  return lines.join("\n");
}

function parseStoreOrderItems(value: Json): ConfirmationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
      image: typeof item.imageUrl === "string" ? item.imageUrl : null,
      price: typeof item.price === "number" ? item.price : numericValue(item.price as string | null),
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      subtotal: typeof item.total === "number" ? item.total : numericValue(item.total as string | null),
      title: typeof item.title === "string" ? item.title : "Product"
    }));
}

async function getStoreInstanceIds(storeId: string, slug: string) {
  const admin = createAdminClient();

  if (!admin) {
    return [storeId];
  }

  const ids = new Set([storeId]);
  const { data } = await admin
    .from("store_instances" as never)
    .select("id")
    .or(`id.eq.${storeId},internal_slug.eq.${slug}`);

  for (const row of (data ?? []) as unknown as Array<{ id: string }>) {
    if (row.id) {
      ids.add(row.id);
    }
  }

  return Array.from(ids);
}

async function loadPublicOrderConfirmation({
  orderId,
  slug,
  sourceHint
}: {
  orderId: string;
  slug: string;
  sourceHint?: string;
}) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { order: null, reason: "store-not-found" as const, storeTitle: null, whatsappNumber: null };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      order: null,
      reason: "not-configured" as const,
      storeTitle: preview.store.title,
      whatsappNumber: preview.store.whatsappNumber
    };
  }

  const storefrontAccess = await getPublicStorefrontAccess({
    storeId: preview.store.id,
    supabase: admin
  });

  if (!storefrontAccess.allowed) {
    return {
      order: null,
      reason: "store-unavailable" as const,
      storeTitle: preview.store.title,
      whatsappNumber: preview.store.whatsappNumber
    };
  }

  const storeInstanceIds = await getStoreInstanceIds(preview.store.id, slug);
  const sources: OrderSource[] = sourceHint === "store_orders" ? ["store_orders", "orders"] : ["orders", "store_orders"];

  for (const source of sources) {
    if (source === "orders") {
      const { data, error } = await admin
        .from("orders" as never)
        .select(
          "id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, delivery_method, delivery_fee, shipping_amount, tax_name, tax_rate, tax_amount, prices_include_tax, total, total_amount, currency, order_status, payment_status"
        )
        .eq("id" as never, orderId as never)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as {
          currency: string | null;
          customer_name: string;
          customer_phone?: string | null;
          delivery_fee?: number | string | null;
          delivery_method?: string | null;
          id: string;
          order_status: string | null;
          payment_status: string | null;
          prices_include_tax?: boolean | null;
          store_id: string | null;
          store_instance_id: string | null;
          tax_amount?: number | string | null;
          tax_name?: string | null;
          tax_rate?: number | string | null;
          total: number | string;
          total_amount?: number | string | null;
          workspace_id?: string | null;
        };
        const rowStoreId = row.store_id ?? row.store_instance_id ?? "";

        if (storeInstanceIds.includes(rowStoreId)) {
          const { data: rawItems } = await admin
            .from("order_items" as never)
            .select("product_id, product_title, product_image, price, quantity, subtotal")
            .eq("order_id" as never, row.id as never);
          const items = ((rawItems ?? []) as unknown as Array<{
            price: number | string | null;
            product_id: string | null;
            product_image: string | null;
            product_title: string | null;
            quantity: number | null;
            subtotal: number | string | null;
          }>).map((item) => ({
            id: item.product_id ?? undefined,
            image: item.product_image,
            price: numericValue(item.price),
            quantity: item.quantity ?? 1,
            subtotal: numericValue(item.subtotal),
            title: item.product_title ?? "Product"
          }));

          return {
            order: {
              currency: row.currency ?? preview.store.currency ?? "USD",
              customer_name: row.customer_name,
              customer_phone: row.customer_phone ?? null,
              delivery_fee: row.delivery_fee ?? 0,
              delivery_method: row.delivery_method ?? null,
              id: row.id,
              items,
              order_status: row.order_status ?? "draft",
              payment_status: row.payment_status ?? "pending",
              source: "orders" as const,
              store_id: preview.store.id,
              tax_amount: row.tax_amount ?? 0,
              tax_name: row.tax_name ?? null,
              tax_rate: row.tax_rate ?? 0,
              prices_include_tax: Boolean(row.prices_include_tax),
              total: row.total_amount ?? row.total,
              workspace_id: row.workspace_id ?? preview.store.workspaceId ?? null
            },
            reason: null,
            storeTitle: preview.store.title,
            whatsappNumber: preview.store.whatsappNumber
          };
        }
      }
    }

    if (source === "store_orders") {
      const { data, error } = await admin
        .from("store_orders")
        .select("id, workspace_id, store_id, customer_name, customer_phone, delivery_method, delivery_fee, shipping_amount, tax_name, tax_rate, tax_amount, prices_include_tax, items, total, total_amount, order_status, payment_status")
        .eq("id", orderId)
        .eq("store_id", preview.store.id)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as {
          customer_name: string;
          customer_phone?: string | null;
          delivery_fee?: number | string | null;
          delivery_method?: string | null;
          id: string;
          items: Json;
          order_status: string | null;
          payment_status: string | null;
          prices_include_tax?: boolean | null;
          tax_amount?: number | string | null;
          tax_name?: string | null;
          tax_rate?: number | string | null;
          total: number | string;
          total_amount?: number | string | null;
          workspace_id?: string | null;
        };

        return {
          order: {
            currency: preview.store.currency ?? "USD",
            customer_name: row.customer_name,
            customer_phone: row.customer_phone ?? null,
            delivery_fee: row.delivery_fee ?? 0,
            delivery_method: row.delivery_method ?? null,
            id: row.id,
            items: parseStoreOrderItems(row.items),
            order_status: row.order_status ?? "draft",
            payment_status: row.payment_status ?? "pending",
            source: "store_orders" as const,
            store_id: preview.store.id,
            tax_amount: row.tax_amount ?? 0,
            tax_name: row.tax_name ?? null,
            tax_rate: row.tax_rate ?? 0,
            prices_include_tax: Boolean(row.prices_include_tax),
            total: row.total_amount ?? row.total,
            workspace_id: row.workspace_id ?? preview.store.workspaceId ?? null
          },
          reason: null,
          storeTitle: preview.store.title,
          whatsappNumber: preview.store.whatsappNumber
        };
      }
    }
  }

  return {
    order: null,
    reason: "order-not-found" as const,
    storeTitle: preview.store.title,
    whatsappNumber: preview.store.whatsappNumber
  };
}

export async function generateMetadata({
  params
}: PublicOrderConfirmationPageProps): Promise<Metadata> {
  const { orderId, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Order ${orderReference(orderId)} | ${preview.store.title}` : "Order not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function PublicOrderConfirmationPage({
  params,
  searchParams
}: PublicOrderConfirmationPageProps) {
  const { orderId, slug } = await params;
  const { review, source } = await searchParams;
  const rateLimit = await checkRateLimit({
    action: "public.order_confirmation",
    identifier: `${slug}:${orderId}`,
    limit: 30,
    route: `/store/${slug}/order/[orderId]`,
    windowSeconds: 300
  });
  const { order, reason, storeTitle, whatsappNumber } = rateLimit.allowed
    ? await loadPublicOrderConfirmation({
        orderId,
        slug,
        sourceHint: source
      })
    : {
        order: null,
        reason: "rate-limited" as const,
        storeTitle: null,
        whatsappNumber: null
      };
  const whatsappUrl = order
    ? whatsappHref(whatsappNumber, whatsAppOrderMessage({ order, storeTitle }))
    : null;
  const reviewStatuses = order
    ? await getProductReviewStatusByOrder({
        orderId: order.id,
        storeId: order.store_id
      })
    : new Map<string, string>();
  const reviewStatusMessage = reviewMessage(review);
  const returnTo = `/store/${slug}/order/${orderId}${source ? `?source=${encodeURIComponent(source)}` : ""}`;
  const admin = createAdminClient();
  const seoSettings = order && admin
    ? await loadStoreSeoSettings(admin, order.store_id)
    : defaultStoreSeoSettings;

  if (!order) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Order confirmation
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            Order not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {reason === "rate-limited"
              ? "Rate limit exceeded. Please wait a few minutes and try again."
              : reason === "store-unavailable"
              ? "This storefront is temporarily unavailable."
              : reason === "not-configured"
                ? "Order confirmation is not configured yet."
                : "We could not find this order for the current store."}
          </p>
          <Link
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white"
            href={`/store/${slug}`}
          >
            Back to store
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink sm:px-6 lg:px-8">
      <MetaPixelScript enabled={seoSettings.metaPixelEnabled} pixelId={seoSettings.metaPixelId} />
      <MetaPixelPurchase
        contentIds={order.items.map((item) => item.id).filter((id): id is string => Boolean(id))}
        currency={order.currency}
        enabled={seoSettings.metaPixelEnabled}
        orderId={order.id}
        pixelId={seoSettings.metaPixelId}
        value={numericValue(order.total)}
      />
      <ClearStoreCartOnOrderSuccess
        currency={order.currency}
        orderId={order.id}
        slug={slug}
        storeId={order.store_id}
      />
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              SHASTORE AI Store
            </p>
            <p className="mt-1 text-sm font-black text-ink">{storeTitle}</p>
          </div>
          <Link
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
            href={`/store/${slug}`}
          >
            Back to store
          </Link>
        </header>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
            Order received
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            Your order has been received and is waiting for seller confirmation.
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Keep this reference for follow-up with the store: Order {orderReference(order.id)}.
            Payments are still disabled, so no charge has been made.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {whatsappUrl ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                href={whatsappUrl}
                rel="noreferrer"
                target="_blank"
              >
                Contact seller on WhatsApp
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-5 py-2 text-sm font-black text-muted">
                WhatsApp contact is not set for this store yet
              </span>
            )}
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
              href={`/store/${slug}/track?reference=${orderReference(order.id)}`}
            >
              Track this order
            </Link>
            {order.customer_phone ? (
              <Link
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-black text-muted transition hover:bg-slate-200"
                href={`/store/${slug}/receipt/${order.id}?phone=${encodeURIComponent(order.customer_phone)}&source=${encodeURIComponent(order.source)}`}
              >
                View receipt
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Order reference" value={orderReference(order.id)} />
            <Info label="Customer" value={order.customer_name} />
            <Info label="Delivery method" value={deliveryMethodLabel(order.delivery_method)} />
            <Info label="Order status" value={order.order_status} />
            <Info label="Payment status" value={order.payment_status} />
          </div>
          {reviewStatusMessage ? (
            <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
              review === "submitted" || review === "already-submitted"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              {reviewStatusMessage}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
              Ordered products
            </h2>
            <div className="mt-5 grid gap-3">
              {order.items.length ? (
                order.items.map((item, index) => (
                  <article
                    className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[80px_minmax(0,1fr)_auto]"
                    key={`${item.id ?? item.title}-${index}`}
                  >
                    {item.image ? (
                      <>
                        {/* Product snapshots can be public Supabase URLs. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={item.title}
                          className="h-20 w-20 rounded-2xl object-cover"
                          src={item.image}
                        />
                      </>
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-slate-200" />
                    )}
                    <div className="grid gap-3">
                      <p className="font-black text-ink">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        Quantity {item.quantity} x {formatMoney(item.price, order.currency)}
                      </p>
                      {item.id ? (
                        reviewStatuses.has(item.id) ? (
                          <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                            Review submitted
                          </span>
                        ) : (
                          <details className="rounded-2xl border border-slate-200 bg-white p-3">
                            <summary className="cursor-pointer text-sm font-black text-ink">
                              Leave a review
                            </summary>
                            <ReviewForm
                              customerName={order.customer_name}
                              customerPhone={order.customer_phone ?? ""}
                              orderId={order.id}
                              productId={item.id}
                              returnTo={returnTo}
                              storeId={order.store_id}
                              workspaceId={order.workspace_id ?? ""}
                            />
                          </details>
                        )
                      ) : null}
                    </div>
                    <p className="font-black text-ink">
                      {formatMoney(item.subtotal, order.currency)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-muted">
                  Product snapshots are not available for this order.
                </div>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Order total
            </p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
              {formatMoney(order.total, order.currency)}
            </p>
            <p className="mt-1 text-sm font-bold text-muted">{order.currency}</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-muted">
              <p>Delivery method: {deliveryMethodLabel(order.delivery_method)}</p>
              <p>Delivery fee: {formatMoney(order.delivery_fee ?? 0, order.currency)}</p>
              {numericValue(order.tax_amount) > 0 ? (
                <p>
                  {order.tax_name ?? "Tax"} ({numericValue(order.tax_rate)}%
                  {order.prices_include_tax ? " included" : ""}):{" "}
                  {formatMoney(order.tax_amount, order.currency)}
                </p>
              ) : null}
            </div>
            {order.customer_phone ? (
              <Link
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                href={`/store/${slug}/receipt/${order.id}?phone=${encodeURIComponent(order.customer_phone)}&source=${encodeURIComponent(order.source)}`}
              >
                View receipt
              </Link>
            ) : null}
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
              Payments are disabled. The seller will confirm this order manually.
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-muted">
              WhatsApp handoff sends only the order reference, customer name, total,
              currency, and product summary.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ReviewForm({
  customerName,
  customerPhone,
  orderId,
  productId,
  returnTo,
  storeId,
  workspaceId
}: {
  customerName: string;
  customerPhone: string;
  orderId: string;
  productId: string;
  returnTo: string;
  storeId: string;
  workspaceId: string;
}) {
  return (
    <form action={submitPurchasedProductReview} className="mt-3 grid gap-3">
      <input name="customerName" type="hidden" value={customerName} />
      <input name="customerPhone" type="hidden" value={customerPhone} />
      <input name="orderId" type="hidden" value={orderId} />
      <input name="productId" type="hidden" value={productId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <input name="storeId" type="hidden" value={storeId} />
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Rating</span>
        <select
          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          name="rating"
          required
        >
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Okay</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Bad</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Title</span>
        <input
          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          maxLength={140}
          name="title"
          placeholder="Great product"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Comment</span>
        <textarea
          className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          maxLength={2000}
          name="comment"
          placeholder="Share your experience."
          required
        />
      </label>
      <button
        className="h-10 rounded-full bg-ink px-4 text-sm font-black text-white transition hover:bg-slate-800"
        type="submit"
      >
        Submit review
      </button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-ink">{value}</p>
    </div>
  );
}
