import type { Metadata } from "next";
import Link from "next/link";
import {
  AccountLookupForm,
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import {
  accountStatusLabel,
  formatAccountDate,
  formatAccountMoney,
  loadCustomerAccountPortal,
  orderReference
} from "@/lib/customer-account";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ phone?: string }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Orders | ${preview.store.title}` : "Orders not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerOrdersPage({ params, searchParams }: OrdersPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This orders portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({ storeId: preview.store.id, supabase: admin })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <Unavailable title="This storefront is temporarily unavailable." />;
  }

  const portal = phone ? await loadCustomerAccountPortal({ phone, slug: preview.store.slug }) : null;
  const orders = portal?.orders ?? [];

  return (
    <CustomerAccountShell
      active="orders"
      currency={preview.store.currency}
      description="Review order totals, dates, payment status, and fulfillment status for this store account."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Orders"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Order history</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {phone ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}` : "Lookup required"}
            </h2>
          </div>
          {!phone ? (
            <EmptyAccountCard title="Enter your phone number" text="Use the same phone number from checkout to load your orders." />
          ) : orders.length ? (
            orders.map((order) => (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${order.source}-${order.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Order {orderReference(order.id)}
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                      {formatAccountMoney(order.total, order.currency)}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-muted">
                      {formatAccountDate(order.createdAt)} · {order.itemCount || 1} item{(order.itemCount || 1) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                    href={`/store/${preview.store.slug}/track?reference=${encodeURIComponent(orderReference(order.id))}&phone=${encodeURIComponent(phone)}`}
                  >
                    Details
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill label={`Order: ${accountStatusLabel(order.orderStatus)}`} />
                  <StatusPill label={`Fulfillment: ${accountStatusLabel(order.fulfillmentStatus)}`} />
                  <StatusPill label={`Payment: ${accountStatusLabel(order.paymentStatus)}`} />
                </div>
              </article>
            ))
          ) : (
            <EmptyAccountCard title="No orders found" text="No orders matched this phone number for this store." />
          )}
        </div>
        <AccountLookupForm phone={phone} />
      </section>
    </CustomerAccountShell>
  );
}

function Unavailable({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">{title}</h1>
      </div>
    </main>
  );
}
