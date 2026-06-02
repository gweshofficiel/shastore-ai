import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  loadAdvancedStoreAnalytics,
  resolveAnalyticsRange,
  type AdvancedAnalyticsPeriod,
  type AnalyticsPoint
} from "@/lib/store-analytics-advanced";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type AnalyticsAdvancedPageProps = {
  searchParams: Promise<{
    from?: string;
    period?: string;
    storeId?: string;
    to?: string;
  }>;
};

const periodOptions: Array<{ label: string; value: AdvancedAnalyticsPeriod }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "Custom range", value: "custom" }
];

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function analyticsHref({
  from,
  period,
  storeId,
  to
}: {
  from?: string;
  period: AdvancedAnalyticsPeriod;
  storeId?: string | null;
  to?: string;
}) {
  const params = new URLSearchParams({ period });

  if (storeId) {
    params.set("storeId", storeId);
  }

  if (period === "custom") {
    if (from) {
      params.set("from", from);
    }

    if (to) {
      params.set("to", to);
    }
  }

  return `/dashboard/analytics-advanced?${params.toString()}`;
}

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();

  if (["delivered", "fulfilled", "paid", "confirmed"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (["cancelled", "canceled", "refunded", "returned"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }

  if (["pending", "draft"].includes(normalized)) {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-blue-100 text-blue-700";
}

function SeriesList({ currency, points }: { currency: string; points: AnalyticsPoint[] }) {
  if (!points.length) {
    return <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">No sales data in this range.</p>;
  }

  const maxSales = Math.max(...points.map((point) => point.sales), 1);

  return (
    <div className="grid gap-3">
      {points.map((point) => (
        <div className="grid gap-2" key={point.label}>
          <div className="flex items-center justify-between gap-3 text-sm font-bold">
            <span className="text-ink">{point.label}</span>
            <span className="text-muted">{formatMoney(point.sales, currency)} · {point.orders} orders</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${Math.max(4, Math.round((point.sales / maxSales) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsAdvancedPage({ searchParams }: AnalyticsAdvancedPageProps) {
  const query = await searchParams;
  const range = resolveAnalyticsRange({
    from: query.from,
    period: query.period,
    to: query.to
  });
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Advanced store analytics from real order, customer, product, and cart data."
          title="Analytics Advanced"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to access advanced analytics.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Advanced store analytics from real order, customer, product, and cart data."
          title="Analytics Advanced"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">You do not have permission to view analytics.</p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const analytics = await loadAdvancedStoreAnalytics({
    range,
    selectedStoreId: query.storeId,
    stores,
    supabase,
    workspaceId
  });
  const activeStoreId = analytics.activeStore?.id ?? null;
  const topStats = [
    { label: "Total sales", value: formatMoney(analytics.totalSales, analytics.currency) },
    { label: "Total orders", value: analytics.totalOrders.toLocaleString() },
    { label: "Average order value", value: formatMoney(analytics.averageOrderValue, analytics.currency) },
    {
      label: "Conversion foundation",
      value: analytics.conversionRate === null ? "No visit data" : `${analytics.conversionRate}%`
    }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Advanced store analytics from real orders, customers, products, abandoned carts, and statuses."
        title="Analytics Advanced"
      />

      {storesError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Stores could not be loaded: {storesError}</p>
        </Card>
      ) : null}

      {analytics.errors.length ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">
            Some analytics sources could not be loaded: {analytics.errors.join(" ")}
          </p>
        </Card>
      ) : null}

      <Card className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Analytics scope</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
            {analytics.activeStore?.name ?? "All current workspace stores"}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Showing {range.label}. No fake or demo analytics are included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.filter((option) => option.value !== "custom").map((option) => (
            <ButtonLink
              href={analyticsHref({ period: option.value, storeId: activeStoreId })}
              key={option.value}
              variant={range.period === option.value ? "primary" : "secondary"}
            >
              {option.label}
            </ButtonLink>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <input name="period" type="hidden" value="custom" />
          {activeStoreId ? <input name="storeId" type="hidden" value={activeStoreId} /> : null}
          <Input defaultValue={query.from ?? ""} label="From" name="from" type="date" />
          <Input defaultValue={query.to ?? ""} label="To" name="to" type="date" />
          <Button type="submit">Apply custom range</Button>
        </form>
      </Card>

      {stores.length > 1 ? (
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Store filter</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {stores.map((store) => (
              <ButtonLink
                href={analyticsHref({ from: query.from, period: range.period, storeId: store.id, to: query.to })}
                key={store.id}
                variant={activeStoreId === store.id ? "primary" : "secondary"}
              >
                {store.name}
              </ButtonLink>
            ))}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topStats.map((stat) => (
          <Card className="p-5" key={stat.label}>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{stat.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Sales by day</h2>
          <div className="mt-5">
            <SeriesList currency={analytics.currency} points={analytics.salesByDay} />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Sales by week</h2>
          <div className="mt-5">
            <SeriesList currency={analytics.currency} points={analytics.salesByWeek} />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Sales by month</h2>
          <div className="mt-5">
            <SeriesList currency={analytics.currency} points={analytics.salesByMonth} />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Top products</h2>
          <div className="mt-5 grid gap-3">
            {analytics.topProducts.length ? analytics.topProducts.map((product) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={`${product.productId ?? product.title}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{product.title}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">{product.quantity} units sold</p>
                  </div>
                  <p className="font-black text-ink">{formatMoney(product.sales, analytics.currency)}</p>
                </div>
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">No product sales in this range.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Top customers</h2>
          <div className="mt-5 grid gap-3">
            {analytics.topCustomers.length ? analytics.topCustomers.map((customer) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={`${customer.email ?? customer.phone ?? customer.name}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{customer.name}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {customer.email || customer.phone || "No contact"} · {customer.orders} orders
                    </p>
                  </div>
                  <p className="font-black text-ink">{formatMoney(customer.sales, analytics.currency)}</p>
                </div>
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">No customer orders in this range.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Orders by status</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {analytics.orderStatusCounts.length ? analytics.orderStatusCounts.map((item) => (
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusBadgeClass(item.status)}`} key={item.status}>
                {item.status}: {item.count}
              </span>
            )) : (
              <p className="text-sm font-semibold text-muted">No orders in this range.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Abandoned carts</h2>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-muted">
            <p>Total: {analytics.abandonedCarts.total}</p>
            <p>Pending: {analytics.abandonedCarts.pending}</p>
            <p>Email sent: {analytics.abandonedCarts.emailSent}</p>
            <p>Recovered: {analytics.abandonedCarts.recovered}</p>
            <p>Estimated value: {formatMoney(analytics.abandonedCarts.estimatedTotal, analytics.currency)}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">Refunds & returns</h2>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-muted">
            <p>Refunded orders: {analytics.refundsReturns.refunded}</p>
            <p>Returned orders: {analytics.refundsReturns.returned}</p>
            <p>Total refund/return signals: {analytics.refundsReturns.total}</p>
            <p>Customers in scope: {analytics.customerCount}</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
