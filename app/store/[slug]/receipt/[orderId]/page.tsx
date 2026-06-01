import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptPrintButton } from "@/components/storefront/receipt-print-button";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type ReceiptPageProps = {
  params: Promise<{
    orderId: string;
    slug: string;
  }>;
  searchParams: Promise<{
    phone?: string;
    source?: string;
  }>;
};

type ReceiptItem = {
  id?: string;
  price: number;
  quantity: number;
  subtotal: number;
  title: string;
};

type ReceiptOrder = {
  created_at: string;
  currency: string;
  customer_address: string | null;
  customer_email: string | null;
  customer_name: string;
  customer_phone: string | null;
  discount_amount: number | string | null;
  fulfillment_status: string | null;
  id: string;
  items: ReceiptItem[];
  order_subtotal_before_discount: number | string | null;
  payment_method: string | null;
  shipping_amount: number | string | null;
  source: "orders" | "store_orders";
  store_id: string;
  subtotal: number | string;
  tax_amount: number | string | null;
  tax_name: string | null;
  total: number | string;
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

function formatMoney(amount: number | string | null | undefined, currency = "USD") {
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

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    delivered: "Delivered",
    fulfilled: "Delivered",
    out_for_delivery: "Out for Delivery",
    pending: "Pending",
    preparing: "Preparing",
    processing: "Processing",
    ready_for_pickup: "Ready for Pickup",
    refunded: "Refunded",
    returned: "Returned",
    shipped: "Shipped",
    unfulfilled: "Pending"
  };
  const normalized = status?.trim() || "pending";

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

function paymentMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    card: "Card",
    cod: "Cash on Delivery",
    manual: "Manual",
    paypal: "PayPal",
    whatsapp: "WhatsApp Order"
  };
  const normalized = method?.trim() || "Not provided";

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

function parseStoreOrderItems(value: Json): ReceiptItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
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

async function loadReceiptOrder({
  orderId,
  phone,
  slug,
  sourceHint
}: {
  orderId: string;
  phone: string;
  slug: string;
  sourceHint?: string;
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

  const lookupPhone = normalizePhone(phone);

  if (!orderId || !lookupPhone) {
    return { order: null, reason: "missing-lookup" as const, storeTitle: preview.store.title };
  }

  const storeInstanceIds = await getStoreInstanceIds(preview.store.id, slug);
  const sources: Array<"orders" | "store_orders"> = sourceHint === "store_orders" ? ["store_orders", "orders"] : ["orders", "store_orders"];

  for (const source of sources) {
    if (source === "orders") {
      const { data } = await admin
        .from("orders" as never)
        .select("id, store_id, store_instance_id, customer_name, customer_phone, customer_email, customer_address, fulfillment_status, subtotal, subtotal_amount, shipping_amount, delivery_fee, discount_amount, order_subtotal_before_discount, tax_name, tax_amount, total, total_amount, currency, payment_method, created_at")
        .eq("id" as never, orderId as never)
        .maybeSingle();
      const row = data as {
        created_at: string;
        currency: string | null;
        customer_address: string | null;
        customer_email: string | null;
        customer_name: string;
        customer_phone: string | null;
        delivery_fee?: number | string | null;
        discount_amount?: number | string | null;
        fulfillment_status?: string | null;
        id: string;
        order_subtotal_before_discount?: number | string | null;
        payment_method?: string | null;
        shipping_amount?: number | string | null;
        store_id: string | null;
        store_instance_id: string | null;
        subtotal: number | string;
        subtotal_amount?: number | string | null;
        tax_amount?: number | string | null;
        tax_name?: string | null;
        total: number | string;
        total_amount?: number | string | null;
      } | null;
      const rowStoreId = row?.store_id ?? row?.store_instance_id ?? "";

      if (row && storeInstanceIds.includes(rowStoreId) && normalizePhone(row.customer_phone) === lookupPhone) {
        const { data: rawItems } = await admin
          .from("order_items" as never)
          .select("product_id, product_title, price, quantity, subtotal")
          .eq("order_id" as never, row.id as never);
        const items = ((rawItems ?? []) as unknown as Array<{
          price: number | string | null;
          product_id: string | null;
          product_title: string | null;
          quantity: number | null;
          subtotal: number | string | null;
        }>).map((item) => ({
          id: item.product_id ?? undefined,
          price: numericValue(item.price),
          quantity: item.quantity ?? 1,
          subtotal: numericValue(item.subtotal),
          title: item.product_title ?? "Product"
        }));

        return {
          order: {
            created_at: row.created_at,
            currency: row.currency ?? preview.store.currency,
            customer_address: row.customer_address,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            discount_amount: row.discount_amount ?? 0,
            fulfillment_status: row.fulfillment_status ?? "pending",
            id: row.id,
            items,
            order_subtotal_before_discount: row.order_subtotal_before_discount ?? null,
            payment_method: row.payment_method ?? null,
            shipping_amount: row.shipping_amount ?? row.delivery_fee ?? 0,
            source,
            store_id: preview.store.id,
            subtotal: row.subtotal_amount ?? row.subtotal,
            tax_amount: row.tax_amount ?? 0,
            tax_name: row.tax_name ?? null,
            total: row.total_amount ?? row.total
          } satisfies ReceiptOrder,
          reason: null,
          storeTitle: preview.store.title
        };
      }
    }

    if (source === "store_orders") {
      const { data } = await admin
        .from("store_orders")
        .select("id, store_id, customer_name, customer_phone, customer_email, customer_address, fulfillment_status, items, subtotal, subtotal_amount, shipping_amount, delivery_fee, discount_amount, order_subtotal_before_discount, tax_name, tax_amount, total, total_amount, payment_method, created_at")
        .eq("id", orderId)
        .eq("store_id", preview.store.id)
        .maybeSingle();
      const row = data as {
        created_at: string;
        customer_address: string | null;
        customer_email: string | null;
        customer_name: string;
        customer_phone: string | null;
        delivery_fee?: number | string | null;
        discount_amount?: number | string | null;
        fulfillment_status?: string | null;
        id: string;
        items: Json;
        order_subtotal_before_discount?: number | string | null;
        payment_method?: string | null;
        shipping_amount?: number | string | null;
        subtotal: number | string;
        subtotal_amount?: number | string | null;
        tax_amount?: number | string | null;
        tax_name?: string | null;
        total: number | string;
        total_amount?: number | string | null;
      } | null;

      if (row && normalizePhone(row.customer_phone) === lookupPhone) {
        return {
          order: {
            created_at: row.created_at,
            currency: preview.store.currency,
            customer_address: row.customer_address,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            discount_amount: row.discount_amount ?? 0,
            fulfillment_status: row.fulfillment_status ?? "pending",
            id: row.id,
            items: parseStoreOrderItems(row.items),
            order_subtotal_before_discount: row.order_subtotal_before_discount ?? null,
            payment_method: row.payment_method ?? null,
            shipping_amount: row.shipping_amount ?? row.delivery_fee ?? 0,
            source,
            store_id: preview.store.id,
            subtotal: row.subtotal_amount ?? row.subtotal,
            tax_amount: row.tax_amount ?? 0,
            tax_name: row.tax_name ?? null,
            total: row.total_amount ?? row.total
          } satisfies ReceiptOrder,
          reason: null,
          storeTitle: preview.store.title
        };
      }
    }
  }

  return { order: null, reason: "order-not-found" as const, storeTitle: preview.store.title };
}

export async function generateMetadata({
  params
}: ReceiptPageProps): Promise<Metadata> {
  const { orderId, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Receipt ${orderReference(orderId)} | ${preview.store.title}` : "Receipt | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function ReceiptPage({
  params,
  searchParams
}: ReceiptPageProps) {
  const { orderId, slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const { order, reason, storeTitle } = await loadReceiptOrder({
    orderId,
    phone,
    slug,
    sourceHint: query.source
  });
  const subtotalBeforeDiscount = numericValue(order?.order_subtotal_before_discount) || numericValue(order?.subtotal);
  const discountAmount = numericValue(order?.discount_amount);
  const receiptUrl = order
    ? `/store/${slug}/receipt/${order.id}?phone=${encodeURIComponent(phone)}&source=${encodeURIComponent(order.source)}`
    : `/store/${slug}`;

  if (!order) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">Receipt not available</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            {reason === "missing-lookup"
              ? "Open this receipt from your order page so the order phone can be verified."
              : "We could not find a matching receipt for this store and customer."}
          </p>
          <Link className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white" href={`/store/${slug}`}>
            Back to store
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-ink print:bg-white print:px-0 print:py-0 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link className="rounded-full bg-white px-5 py-3 text-sm font-black text-muted shadow-sm" href={`/store/${slug}/track?reference=${orderReference(order.id)}&phone=${encodeURIComponent(phone)}`}>
            Back to order
          </Link>
          <ReceiptPrintButton />
        </div>

        <article className="rounded-[2rem] bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Invoice / Receipt</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">{storeTitle}</h1>
              <p className="mt-2 text-sm font-semibold text-muted">Receipt URL: {receiptUrl}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Order {orderReference(order.id)}
              </p>
              <p className="mt-2 text-sm font-bold text-muted">{formatDate(order.created_at)}</p>
              <p className="mt-2 text-sm font-bold text-muted">Fulfillment: {statusLabel(order.fulfillment_status)}</p>
              <p className="mt-1 text-sm font-bold text-muted">Payment: {paymentMethodLabel(order.payment_method)}</p>
            </div>
          </header>

          <section className="grid gap-4 border-b border-slate-200 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Customer</p>
              <p className="mt-2 text-sm font-black text-ink">{order.customer_name}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{order.customer_email || "Email not provided"}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{order.customer_phone || "Phone not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Shipping address</p>
              <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-muted">
                {order.customer_address || "Shipping address not provided"}
              </p>
            </div>
          </section>

          <section className="py-6">
            <div className="grid grid-cols-[minmax(0,1fr)_72px_96px_96px] gap-3 border-b border-slate-200 pb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              <span>Product</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y divide-slate-100">
              {order.items.length ? (
                order.items.map((item, index) => (
                  <div className="grid grid-cols-[minmax(0,1fr)_72px_96px_96px] gap-3 py-4 text-sm font-bold text-ink" key={`${item.id ?? item.title}-${index}`}>
                    <span>{item.title}</span>
                    <span className="text-right">{item.quantity}</span>
                    <span className="text-right">{formatMoney(item.price, order.currency)}</span>
                    <span className="text-right">{formatMoney(item.subtotal, order.currency)}</span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm font-semibold text-muted">Product snapshots are not available for this order.</p>
              )}
            </div>
          </section>

          <section className="ml-auto grid max-w-sm gap-3 border-t border-slate-200 pt-6 text-sm font-bold text-muted">
            <ReceiptTotal label="Subtotal" value={formatMoney(subtotalBeforeDiscount, order.currency)} />
            {discountAmount > 0 ? (
              <ReceiptTotal label="Discount" value={`-${formatMoney(discountAmount, order.currency)}`} />
            ) : null}
            <ReceiptTotal label="Shipping" value={formatMoney(order.shipping_amount, order.currency)} />
            {numericValue(order.tax_amount) > 0 ? (
              <ReceiptTotal label={order.tax_name ?? "Tax"} value={formatMoney(order.tax_amount, order.currency)} />
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-ink">
              <span>Grand total</span>
              <span>{formatMoney(order.total, order.currency)}</span>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}

function ReceiptTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
