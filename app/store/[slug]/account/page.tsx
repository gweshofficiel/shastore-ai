import type { Metadata } from "next";
import Link from "next/link";
import { CustomerAddressBook } from "@/components/storefront/customer-address-book";
import { CartNavLink } from "@/components/storefront/public-store-cart";
import { WishlistPageClient } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomerAccountPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    phone?: string;
  }>;
};

type CustomerOrderSummary = {
  created_at: string;
  currency: string;
  fulfillment_status: string;
  id: string;
  order_status: string;
  payment_status: string;
  source: "orders" | "store_orders";
  total: number | string;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
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

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    delivered: "Delivered",
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

async function loadCustomerOrders({
  phone,
  slug,
  storeId,
  storeCurrency
}: {
  phone: string;
  slug: string;
  storeCurrency: string;
  storeId: string;
}) {
  const admin = createAdminClient();
  const normalizedPhone = normalizePhone(phone);

  if (!admin || !normalizedPhone) {
    return [];
  }

  const storeInstanceIds = await getStoreInstanceIds(storeId, slug);
  const [ordersResult, storeOrdersResult] = await Promise.all([
    admin
      .from("orders" as never)
      .select("id, store_id, store_instance_id, customer_phone, created_at, currency, total, total_amount, order_status, payment_status, fulfillment_status")
      .order("created_at" as never, { ascending: false } as never)
      .limit(50),
    admin
      .from("store_orders")
      .select("id, store_id, customer_phone, created_at, total, total_amount, order_status, payment_status, fulfillment_status")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);
  const orders = ((ordersResult.data ?? []) as unknown as Array<{
    created_at: string;
    currency: string | null;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    store_id: string | null;
    store_instance_id: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter((order) => {
      const rowStoreId = order.store_id ?? order.store_instance_id ?? "";
      return storeInstanceIds.includes(rowStoreId) && normalizePhone(order.customer_phone ?? "") === normalizedPhone;
    })
    .map((order): CustomerOrderSummary => ({
      created_at: order.created_at,
      currency: order.currency ?? storeCurrency,
      fulfillment_status: order.fulfillment_status ?? "pending",
      id: order.id,
      order_status: order.order_status ?? "draft",
      payment_status: order.payment_status ?? "pending",
      source: "orders",
      total: order.total_amount ?? order.total
    }));
  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as Array<{
    created_at: string;
    customer_phone: string | null;
    fulfillment_status: string | null;
    id: string;
    order_status: string | null;
    payment_status: string | null;
    total: number | string;
    total_amount?: number | string | null;
  }>)
    .filter((order) => normalizePhone(order.customer_phone ?? "") === normalizedPhone)
    .map((order): CustomerOrderSummary => ({
      created_at: order.created_at,
      currency: storeCurrency,
      fulfillment_status: order.fulfillment_status ?? "pending",
      id: order.id,
      order_status: order.order_status ?? "draft",
      payment_status: order.payment_status ?? "pending",
      source: "store_orders",
      total: order.total_amount ?? order.total
    }));

  return [...orders, ...storeOrders]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 20);
}

export async function generateMetadata({
  params
}: CustomerAccountPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Account not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  return {
    title: `Account | ${preview.store.title}`,
    description: `View recent orders, saved addresses, and wishlist products from ${preview.store.title}.`,
    robots: { follow: false, index: false }
  };
}

export default async function CustomerAccountPage({
  params,
  searchParams
}: CustomerAccountPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">This account portal is not available.</h1>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-4xl font-black tracking-[-0.05em]">This storefront is temporarily unavailable.</h1>
        </div>
      </main>
    );
  }

  const orders = phone
    ? await loadCustomerOrders({
        phone,
        slug: preview.store.slug,
        storeCurrency: preview.store.currency,
        storeId: preview.store.id
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SHASTORE AI Store</p>
            <p className="mt-1 text-sm font-black text-ink">{preview.store.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CartNavLink currency={preview.store.currency} slug={preview.store.slug} storeId={preview.store.id} />
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${preview.store.slug}/wishlist`}>
              Wishlist
            </Link>
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${preview.store.slug}/account/downloads${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}>
              Downloads
            </Link>
            <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200" href={`/store/${preview.store.slug}`}>
              Back to store
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_420px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Customer account</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">Orders, addresses, and wishlist</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Enter the phone number used at checkout to view recent orders and manage delivery addresses for this store. Wishlist products are scoped to this store and browser session.
            </p>
          </div>
          <form className="grid gap-3" method="get">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Checkout phone number</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={phone}
                name="phone"
                placeholder="+15551234567"
                required
              />
            </label>
            <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
              View account
            </button>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recent orders</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {phone ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}` : "Lookup required"}
              </h2>
            </div>
            {!phone ? (
              <EmptyCard title="Enter your phone number" text="Use the same phone number from checkout to load recent orders." />
            ) : orders.length ? (
              orders.map((order) => (
                <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${order.source}-${order.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Order {orderReference(order.id)}
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                        {formatMoney(order.total, order.currency)}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-muted">{formatDate(order.created_at)}</p>
                    </div>
                    <Link
                      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                      href={`/store/${preview.store.slug}/track?reference=${encodeURIComponent(orderReference(order.id))}&phone=${encodeURIComponent(phone)}`}
                    >
                      Open details
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill label={`Order: ${statusLabel(order.order_status)}`} />
                    <StatusPill label={`Fulfillment: ${statusLabel(order.fulfillment_status)}`} />
                    <StatusPill label={`Payment: ${statusLabel(order.payment_status)}`} />
                  </div>
                </article>
              ))
            ) : (
              <EmptyCard title="No orders found" text="No recent orders matched this phone number for this store." />
            )}
          </div>

          <aside className="grid h-fit gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Wishlist</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Saved products</h2>
            </div>
            <WishlistPageClient
              currency={preview.store.currency}
              products={preview.products}
              slug={preview.store.slug}
              storeId={preview.store.id}
            />
          </aside>
        </section>

        <section className="mt-6 grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Address book</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Delivery addresses</h2>
          </div>
          {phone ? (
            <CustomerAddressBook
              customerPhone={phone}
              slug={preview.store.slug}
              storeId={preview.store.id}
            />
          ) : (
            <EmptyCard title="Enter your phone number" text="Use the account lookup above before adding saved delivery addresses." />
          )}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
      {label}
    </span>
  );
}

function EmptyCard({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
