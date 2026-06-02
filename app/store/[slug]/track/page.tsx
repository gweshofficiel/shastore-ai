import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { submitPurchasedProductReview } from "@/lib/product-review-actions";
import { getProductReviewStatusByOrder } from "@/lib/product-reviews";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type PublicOrderTrackingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    phone?: string;
    reference?: string;
    review?: string;
  }>;
};

type TrackingItem = {
  id?: string;
  quantity: number;
  title: string;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : "Not set";
}

function normalizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
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

function normalizedFulfillmentStatus(status: string | null | undefined) {
  const normalized = status?.trim() || "pending";

  if (normalized === "unfulfilled") {
    return "pending";
  }

  if (normalized === "preparing" || normalized === "ready_for_pickup" || normalized === "out_for_delivery") {
    return "processing";
  }

  return normalized;
}

function fulfillmentStatusLabel(status: string | null | undefined) {
  const normalized = normalizedFulfillmentStatus(status);

  if (normalized === "pending") {
    return "Unfulfilled";
  }

  return normalized.replaceAll("_", " ");
}

function deliveryStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    assigned: "Assigned",
    delivered: "Delivered",
    failed: "Failed",
    out_for_delivery: "Out for Delivery",
    picked_up: "Picked Up"
  };
  const normalized = status?.trim();

  return normalized ? (labels[normalized] ?? normalized.replaceAll("_", " ")) : "Not assigned";
}

function fulfillmentSteps() {
  return [
    { label: "Order received", value: "pending" },
    { label: "Processing", value: "processing" }
  ];
}

function fulfillmentStepIndex(status: string | null | undefined) {
  const normalized = normalizedFulfillmentStatus(status);
  const steps = fulfillmentSteps();
  const index = steps.findIndex((step) => step.value === normalized);

  if (index >= 0) {
    return index;
  }

  return 0;
}

function referenceMatches(orderId: string, reference: string) {
  const normalizedReference = normalizeReference(reference);

  if (!normalizedReference) {
    return false;
  }

  return orderId.toUpperCase().startsWith(normalizedReference);
}

function parseStoreOrderItems(value: Json): TrackingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      id:
        typeof item.id === "string"
          ? item.id
          : typeof item.product_id === "string"
            ? item.product_id
            : undefined,
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
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

async function loadTrackedOrder({
  phone,
  reference,
  slug
}: {
  phone: string;
  reference: string;
  slug: string;
}) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { order: null, reason: "store-not-found" as const, storeTitle: null };
  }

  const admin = createAdminClient();

  if (!admin) {
    return { order: null, reason: "not-configured" as const, storeTitle: preview.store.title };
  }

  const storefrontAccess = await getPublicStorefrontAccess({
    storeId: preview.store.id,
    supabase: admin
  });

  if (!storefrontAccess.allowed) {
    return { order: null, reason: "store-unavailable" as const, storeTitle: preview.store.title };
  }

  if (!reference || !phone) {
    return { order: null, reason: "missing-lookup" as const, storeTitle: preview.store.title };
  }

  const storeInstanceIds = await getStoreInstanceIds(preview.store.id, slug);
  const { data: rawOrders } = await admin
    .from("orders" as never)
    .select(
      "id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, delivery_method, delivery_fee, delivery_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at, delivery_notes, fulfillment_status, total, total_amount, currency, order_status, payment_status, created_at"
    )
    .eq("customer_phone" as never, phone as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(20);
  const orders = (rawOrders ?? []) as unknown as Array<{
    created_at: string;
    currency: string | null;
    customer_name?: string | null;
    customer_phone: string;
    delivery_fee?: number | string | null;
    delivery_method?: string | null;
    delivery_notes?: string | null;
    delivery_status?: string | null;
    delivered_at?: string | null;
    fulfillment_status?: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    store_id: string | null;
    store_instance_id: string | null;
    total: number | string;
    total_amount?: number | string | null;
    carrier_name?: string | null;
    shipped_at?: string | null;
    workspace_id?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
  }>;
  const order = orders.find((row) => {
    const rowStoreId = row.store_id ?? row.store_instance_id ?? "";
    return storeInstanceIds.includes(rowStoreId) && referenceMatches(row.id, reference);
  });

  if (order) {
    const { data: rawItems } = await admin
      .from("order_items" as never)
      .select("product_id, product_title, quantity")
      .eq("order_id" as never, order.id as never);
    const items = ((rawItems ?? []) as unknown as Array<{
      product_id: string | null;
      product_title: string | null;
      quantity: number | null;
    }>).map((item) => ({
      id: item.product_id ?? undefined,
      quantity: item.quantity ?? 1,
      title: item.product_title ?? "Product"
    }));

    return {
      order: {
        created_at: order.created_at,
        currency: order.currency ?? preview.store.currency ?? "USD",
        customer_name: order.customer_name ?? "Customer",
        customer_phone: order.customer_phone,
        delivery_fee: order.delivery_fee ?? 0,
        delivery_method: order.delivery_method ?? null,
        delivery_notes: order.delivery_notes ?? null,
        delivery_status: order.delivery_status ?? null,
        delivered_at: order.delivered_at ?? null,
        fulfillment_status: order.fulfillment_status ?? "pending",
        id: order.id,
        items,
        order_status: order.order_status ?? "draft",
        payment_status: order.payment_status ?? "pending",
        source: "orders" as const,
        store_id: preview.store.id,
        carrier_name: order.carrier_name ?? null,
        shipped_at: order.shipped_at ?? null,
        total: order.total_amount ?? order.total,
        tracking_number: order.tracking_number ?? null,
        tracking_url: order.tracking_url ?? null,
        workspace_id: order.workspace_id ?? preview.store.workspaceId ?? null
      },
      reason: null,
      storeTitle: preview.store.title
    };
  }

  const { data: rawStoreOrders } = await admin
    .from("store_orders")
    .select("id, workspace_id, store_id, customer_name, customer_phone, delivery_method, delivery_fee, delivery_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at, delivery_notes, fulfillment_status, items, total, total_amount, order_status, payment_status, created_at")
    .eq("store_id", preview.store.id)
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);
  const storeOrder = ((rawStoreOrders ?? []) as unknown as Array<{
    created_at: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_fee?: number | string | null;
    delivery_method?: string | null;
    delivery_notes?: string | null;
    delivery_status?: string | null;
    delivered_at?: string | null;
    fulfillment_status?: string | null;
    id: string;
    items: Json;
    order_status: string | null;
    payment_status: string | null;
    total: number | string;
    total_amount?: number | string | null;
    carrier_name?: string | null;
    shipped_at?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    workspace_id?: string | null;
  }>).find((row) => referenceMatches(row.id, reference));

  if (storeOrder) {
    return {
      order: {
        created_at: storeOrder.created_at,
        currency: preview.store.currency ?? "USD",
        customer_name: storeOrder.customer_name ?? "Customer",
        customer_phone: storeOrder.customer_phone ?? phone,
        delivery_fee: storeOrder.delivery_fee ?? 0,
        delivery_method: storeOrder.delivery_method ?? null,
        delivery_notes: storeOrder.delivery_notes ?? null,
        delivery_status: storeOrder.delivery_status ?? null,
        delivered_at: storeOrder.delivered_at ?? null,
        fulfillment_status: storeOrder.fulfillment_status ?? "pending",
        id: storeOrder.id,
        items: parseStoreOrderItems(storeOrder.items),
        order_status: storeOrder.order_status ?? "draft",
        payment_status: storeOrder.payment_status ?? "pending",
        source: "store_orders" as const,
        store_id: preview.store.id,
        carrier_name: storeOrder.carrier_name ?? null,
        shipped_at: storeOrder.shipped_at ?? null,
        total: storeOrder.total_amount ?? storeOrder.total,
        tracking_number: storeOrder.tracking_number ?? null,
        tracking_url: storeOrder.tracking_url ?? null,
        workspace_id: storeOrder.workspace_id ?? preview.store.workspaceId ?? null
      },
      reason: null,
      storeTitle: preview.store.title
    };
  }

  return { order: null, reason: "order-not-found" as const, storeTitle: preview.store.title };
}

export async function generateMetadata({
  params
}: PublicOrderTrackingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Track order | ${preview.store.title}` : "Track order | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function PublicOrderTrackingPage({
  params,
  searchParams
}: PublicOrderTrackingPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const reference = cleanText(query.reference, 80);
  const phone = cleanText(query.phone, 80);
  const hasLookup = Boolean(reference || phone);
  const rateLimit = hasLookup
    ? await checkRateLimit({
        action: "public.order_tracking",
        identifier: `${slug}:${phone || "missing-phone"}:${reference || "missing-reference"}`,
        limit: 20,
        route: `/store/${slug}/track`,
        windowSeconds: 300
      })
    : { allowed: true };
  const { order, reason, storeTitle } =
    hasLookup && rateLimit.allowed
      ? await loadTrackedOrder({ phone, reference, slug })
      : {
          order: null,
          reason: rateLimit.allowed ? ("missing-lookup" as const) : ("rate-limited" as const),
          storeTitle: null
        };
  const reviewStatuses = order
    ? await getProductReviewStatusByOrder({
        orderId: order.id,
        storeId: order.store_id
      })
    : new Map<string, string>();
  const reviewStatusMessage = reviewMessage(query.review);
  const returnTo = `/store/${slug}/track?reference=${encodeURIComponent(reference)}&phone=${encodeURIComponent(phone)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              SHASTORE AI Store
            </p>
            <p className="mt-1 text-sm font-black text-ink">{storeTitle ?? "Order tracking"}</p>
          </div>
          <Link
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
            href={`/store/${slug}`}
          >
            Back to store
          </Link>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Order tracking
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            Track your order
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Enter your order reference and phone number to view the current public status.
            Payments are still disabled while the seller confirms orders manually.
          </p>

          <form className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]" method="get">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Order reference</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={reference}
                name="reference"
                placeholder="Example: A1B2C3D4"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Phone number</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={phone}
                name="phone"
                placeholder="Same phone used at checkout"
                required
              />
            </label>
            <button
              className="mt-7 h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
              type="submit"
            >
              Track order
            </button>
          </form>
        </section>

        {hasLookup && !order ? (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
              Order not found
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-muted">
              {reason === "missing-lookup"
                ? "Enter both your order reference and phone number."
                : reason === "rate-limited"
                  ? "Rate limit exceeded. Please wait a few minutes and try again."
                  : reason === "store-unavailable"
                  ? "This storefront is temporarily unavailable."
                  : "We could not find an order for this store with that reference and phone number."}
            </p>
          </section>
        ) : null}

        {order ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
                Order found
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                Order {orderReference(order.id)}
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Order status" value={order.order_status} />
                <Info label="Payment status" value={order.payment_status} />
                <Info label="Fulfillment" value={fulfillmentStatusLabel(order.fulfillment_status)} />
                <Info label="Delivery status" value={deliveryStatusLabel(order.delivery_status)} />
                <Info label="Delivery method" value={deliveryMethodLabel(order.delivery_method)} />
                <Info label="Created" value={formatDate(order.created_at)} />
                <Info label="Currency" value={order.currency} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Tracking information
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Info label="Carrier" value={order.carrier_name || "Not provided"} />
                  <Info label="Tracking number" value={order.tracking_number || "Not provided"} />
                  <Info label="Shipped" value={formatOptionalDate(order.shipped_at)} />
                  <Info label="Delivered" value={formatOptionalDate(order.delivered_at)} />
                </div>
                {order.tracking_url ? (
                  <Link
                    className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
                    href={order.tracking_url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open tracking link
                  </Link>
                ) : null}
                {order.delivery_notes ? (
                  <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-muted">
                    {order.delivery_notes}
                  </p>
                ) : null}
              </div>
              {reviewStatusMessage ? (
                <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
                  query.review === "submitted" || query.review === "already-submitted"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  {reviewStatusMessage}
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Products summary
                </p>
                <div className="mt-3 grid gap-2">
                  {order.items.length ? (
                    order.items.map((item, index) => (
                      <div
                        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-ink"
                        key={`${item.id ?? item.title}-${index}`}
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <span>{item.title}</span>
                          <span>x{item.quantity}</span>
                        </div>
                        {item.id ? (
                          reviewStatuses.has(item.id) ? (
                            <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                              Review submitted
                            </span>
                          ) : (
                            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <summary className="cursor-pointer text-sm font-black text-ink">
                                Leave a review
                              </summary>
                              <ReviewForm
                                customerName={order.customer_name}
                                customerPhone={order.customer_phone ?? phone}
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
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-muted">
                      Product snapshots are not available for this order.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Fulfillment progress
                </p>
                <div className="mt-4 grid gap-3">
                  {fulfillmentSteps().map((step, index) => {
                    const activeIndex = fulfillmentStepIndex(order.fulfillment_status);
                    const isComplete = index <= activeIndex;

                    return (
                      <div className="flex items-center gap-3" key={step.value}>
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                            isComplete ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className={`text-sm font-black ${isComplete ? "text-ink" : "text-slate-400"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
              </div>
              <Link
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                href={`/store/${slug}/receipt/${order.id}?phone=${encodeURIComponent(phone)}&source=${encodeURIComponent(order.source)}`}
              >
                View receipt
              </Link>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
                Payments are disabled. This page only shows public tracking status.
              </div>
            </aside>
          </section>
        ) : null}
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
