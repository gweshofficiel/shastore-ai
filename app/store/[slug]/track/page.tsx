import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
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
  }>;
};

type TrackingItem = {
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

function fulfillmentStatusLabel(status: string | null | undefined) {
  return (status && status !== "pending" ? status : "unfulfilled").replaceAll("_", " ");
}

function fulfillmentSteps(deliveryMethod: string | null | undefined) {
  const middle =
    deliveryMethod === "pickup"
      ? [{ label: "Ready for pickup", value: "ready_for_pickup" }]
      : deliveryMethod === "delivery"
        ? [{ label: "Out for delivery", value: "out_for_delivery" }]
        : [];

  return [
    { label: "Order received", value: "unfulfilled" },
    { label: "Preparing", value: "preparing" },
    ...middle,
    { label: "Fulfilled", value: "fulfilled" }
  ];
}

function fulfillmentStepIndex(status: string | null | undefined, deliveryMethod: string | null | undefined) {
  const normalized = status && status !== "pending" ? status : "unfulfilled";
  const steps = fulfillmentSteps(deliveryMethod);
  const index = steps.findIndex((step) => step.value === normalized);

  if (index >= 0) {
    return index;
  }

  return normalized === "out_for_delivery" || normalized === "ready_for_pickup" ? steps.length - 2 : 0;
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
      "id, store_id, store_instance_id, customer_phone, delivery_method, delivery_fee, fulfillment_status, total, currency, order_status, payment_status, created_at"
    )
    .eq("customer_phone" as never, phone as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(20);
  const orders = (rawOrders ?? []) as unknown as Array<{
    created_at: string;
    currency: string | null;
    customer_phone: string;
    delivery_fee?: number | string | null;
    delivery_method?: string | null;
    fulfillment_status?: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    store_id: string | null;
    store_instance_id: string | null;
    total: number | string;
  }>;
  const order = orders.find((row) => {
    const rowStoreId = row.store_id ?? row.store_instance_id ?? "";
    return storeInstanceIds.includes(rowStoreId) && referenceMatches(row.id, reference);
  });

  if (order) {
    const { data: rawItems } = await admin
      .from("order_items" as never)
      .select("product_title, quantity")
      .eq("order_id" as never, order.id as never);
    const items = ((rawItems ?? []) as unknown as Array<{
      product_title: string | null;
      quantity: number | null;
    }>).map((item) => ({
      quantity: item.quantity ?? 1,
      title: item.product_title ?? "Product"
    }));

    return {
      order: {
        created_at: order.created_at,
        currency: order.currency ?? preview.store.currency ?? "USD",
        delivery_fee: order.delivery_fee ?? 0,
        delivery_method: order.delivery_method ?? null,
        fulfillment_status: order.fulfillment_status ?? "unfulfilled",
        id: order.id,
        items,
        order_status: order.order_status ?? "draft",
        payment_status: order.payment_status ?? "pending",
        total: order.total
      },
      reason: null,
      storeTitle: preview.store.title
    };
  }

  const { data: rawStoreOrders } = await admin
    .from("store_orders")
    .select("id, store_id, customer_phone, delivery_method, delivery_fee, fulfillment_status, items, total, order_status, payment_status, created_at")
    .eq("store_id", preview.store.id)
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);
  const storeOrder = ((rawStoreOrders ?? []) as unknown as Array<{
    created_at: string;
    delivery_fee?: number | string | null;
    delivery_method?: string | null;
    fulfillment_status?: string | null;
    id: string;
    items: Json;
    order_status: string | null;
    payment_status: string | null;
    total: number | string;
  }>).find((row) => referenceMatches(row.id, reference));

  if (storeOrder) {
    return {
      order: {
        created_at: storeOrder.created_at,
        currency: preview.store.currency ?? "USD",
        delivery_fee: storeOrder.delivery_fee ?? 0,
        delivery_method: storeOrder.delivery_method ?? null,
        fulfillment_status: storeOrder.fulfillment_status ?? "unfulfilled",
        id: storeOrder.id,
        items: parseStoreOrderItems(storeOrder.items),
        order_status: storeOrder.order_status ?? "draft",
        payment_status: storeOrder.payment_status ?? "pending",
        total: storeOrder.total
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
  const { order, reason, storeTitle } = hasLookup
    ? await loadTrackedOrder({ phone, reference, slug })
    : { order: null, reason: "missing-lookup" as const, storeTitle: null };

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
                <Info label="Delivery method" value={deliveryMethodLabel(order.delivery_method)} />
                <Info label="Created" value={formatDate(order.created_at)} />
                <Info label="Currency" value={order.currency} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Products summary
                </p>
                <div className="mt-3 grid gap-2">
                  {order.items.length ? (
                    order.items.map((item, index) => (
                      <div
                        className="flex flex-wrap justify-between gap-3 text-sm font-bold text-ink"
                        key={`${item.title}-${index}`}
                      >
                        <span>{item.title}</span>
                        <span>x{item.quantity}</span>
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
                  {fulfillmentSteps(order.delivery_method).map((step, index) => {
                    const activeIndex = fulfillmentStepIndex(order.fulfillment_status, order.delivery_method);
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-ink">{value}</p>
    </div>
  );
}
