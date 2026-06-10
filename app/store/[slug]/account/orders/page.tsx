import type { Metadata } from "next";
import Link from "next/link";
import {
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getAccountRoleForUser } from "@/lib/account-roles";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import {
  accountStatusLabel,
  formatAccountDate,
  formatAccountMoney,
  loadAuthenticatedCustomerAccountPortal,
  orderReference
} from "@/lib/customer-account";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

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
  await searchParams;
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

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const accountRole = user ? await getAccountRoleForUser(supabase, user.id) : null;
  const isAuthenticatedCustomer = Boolean(user && accountRole?.role === "customer" && accountRole.status === "active");
  const portal = isAuthenticatedCustomer && user
    ? await loadAuthenticatedCustomerAccountPortal({ slug: preview.store.slug, userId: user.id })
    : null;
  const orders = portal?.orders ?? [];
  const accountPhone = portal?.profile?.phone ?? "";

  return (
    <CustomerAccountShell
      active="orders"
      currency={preview.store.currency}
      description="Review order totals, dates, payment status, and fulfillment status for this store account."
      phone={accountPhone}
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
              {isAuthenticatedCustomer ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}` : "Login required"}
            </h2>
          </div>
          {!isAuthenticatedCustomer ? (
            <EmptyAccountCard title="Log in to view your orders" text="Phone-only order access is no longer the primary secure access method." />
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
                    href={`/store/${preview.store.slug}/track?reference=${encodeURIComponent(orderReference(order.id))}&phone=${encodeURIComponent(accountPhone)}`}
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
            <EmptyAccountCard title="No orders found" text="No orders are linked to your customer account for this store." />
          )}
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 text-sm font-bold leading-6 text-muted shadow-sm">
          Log in through `/customer/login` to view authenticated order history. Legacy phone lookup is not used for secure order access.
        </div>
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
