import { ButtonLink } from "@/components/ui/button";
import { AccountIdCard } from "@/components/account/account-id-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCommerceAnalyticsSummary } from "@/lib/commerce/data";
import { createClient } from "@/lib/supabase/server";
import { countStoresForAuthUser } from "@/lib/stores/user-stores";
import {
  accountProfileUnavailableMessage,
  getOrCreateAccountProfile
} from "@/lib/account-profiles";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

async function getDashboardStats() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      published: 0,
      drafts: 0,
      stores: 0,
      orders: 0,
      generations: 0
    };
  }

  const [
    { count: published },
    { count: drafts },
    storesCount,
    ordersCount,
    { count: generations }
  ] =
    await Promise.all([
      supabase
        .from("landing_pages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "published"),
      supabase
        .from("landing_pages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "draft"),
      countStoresForAuthUser(supabase, user.id),
      supabase
        .from("store_orders")
        .select("id", { count: "exact", head: true })
        .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`),
      supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
    ]);

  return {
    published: published ?? 0,
    drafts: drafts ?? 0,
    stores: storesCount.count ?? 0,
    orders: ordersCount.error ? 0 : (ordersCount.count ?? 0),
    generations: generations ?? 0
  };
}

export default async function DashboardPage() {
  const [stats, commerce, account, access] = await Promise.all([
    getDashboardStats(),
    getCommerceAnalyticsSummary(),
    getOrCreateAccountProfile("user"),
    getCurrentUserSubscriptionAccess()
  ]);
  const statCards = [
    { label: "Published pages", value: stats.published },
    { label: "Drafts", value: stats.drafts },
    { label: "Stores", value: stats.stores },
    { label: "Orders", value: stats.orders },
    { label: "Visitors", value: commerce.items.visitors }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/landings/new">Create landing</ButtonLink>}
        description="Manage product images, AI copy, reusable templates, and published ecommerce landing pages."
        title="Launch center"
      />
      <AccountIdCard account={account} unavailableMessage={accountProfileUnavailableMessage()} />
      {access ? (
        <Card className="p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Subscription
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {access.plan.name} plan
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Professional limits are active for store creation, custom domains, and advanced branding.
              </p>
            </div>
            <ButtonLink href="/pricing" variant="secondary">
              View pricing
            </ButtonLink>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-muted">Stores used / limit</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
                {access.usage.storesUsed} / {formatLimit(access.usage.storeLimit)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-muted">Landing pages used / limit</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
                {access.usage.landingsUsed} / {formatLimit(access.usage.landingLimit)}
              </p>
            </div>
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card className="p-5 lg:p-6" key={stat.label}>
            <p className="text-sm font-bold text-muted">{stat.label}</p>
            <p className="mt-4 text-4xl font-black tracking-[-0.04em] text-ink">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>
      <Card className="p-6 lg:p-8">
        <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
          Production workflow
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {["Create", "Generate", "Select template", "Publish", "Connect domain"].map(
            (step, index) => (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={step}>
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-black text-white">
                  {index + 1}
                </div>
                <p className="font-semibold text-ink">{step}</p>
              </div>
            )
          )}
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Unified commerce
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Shared backend for landing pages and stores
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Orders, customers, payments, analytics, and domains now use one
              commerce foundation while templates and publishing stay independent.
            </p>
          </div>
          <ButtonLink href="/dashboard/orders" variant="secondary">
            View orders
          </ButtonLink>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Customers", "/dashboard/customers"],
            ["Orders", "/dashboard/orders"],
            ["Payments", "/dashboard/payments"],
            ["Analytics", "/dashboard/analytics"]
          ].map(([label, href]) => (
            <ButtonLink className="justify-center" href={href} key={href} variant="secondary">
              {label}
            </ButtonLink>
          ))}
        </div>
      </Card>
    </div>
  );
}
