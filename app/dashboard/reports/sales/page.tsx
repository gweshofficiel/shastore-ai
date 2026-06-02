import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  loadSalesReport,
  salesReportHref
} from "@/lib/sales-reports";
import { type AdvancedAnalyticsPeriod } from "@/lib/store-analytics-advanced";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type SalesReportsPageProps = {
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

function exportHref({
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

  return `/dashboard/reports/sales/export?${params.toString()}`;
}

function BreakdownCard({
  currency,
  items,
  title
}: {
  currency: string;
  items: Array<{ label: string; orders: number; quantity?: number; value: number }>;
  title: string;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h2>
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-ink">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {item.orders} orders{typeof item.quantity === "number" ? ` · ${item.quantity} units` : ""}
                </p>
              </div>
              <p className="font-black text-ink">{formatMoney(item.value, currency)}</p>
            </div>
          </div>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">No data in this range.</p>
        )}
      </div>
    </Card>
  );
}

export default async function SalesReportsPage({ searchParams }: SalesReportsPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Detailed store-scoped sales reports from real order data." title="Sales Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to view sales reports.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Detailed store-scoped sales reports from real order data." title="Sales Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">You do not have permission to view sales reports.</p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const report = await loadSalesReport({
    from: query.from,
    period: query.period,
    selectedStoreId: query.storeId,
    stores,
    supabase,
    to: query.to,
    workspaceId
  });
  const activeStoreId = report.activeStore?.id ?? null;
  const period = report.range.period;
  const statCards = [
    { label: "Gross sales", value: formatMoney(report.grossSales, report.currency) },
    { label: "Net sales", value: formatMoney(report.netSales, report.currency) },
    { label: "Discounts total", value: formatMoney(report.discountsTotal, report.currency) },
    { label: "Shipping total", value: formatMoney(report.shippingTotal, report.currency) },
    { label: "Tax total", value: formatMoney(report.taxTotal, report.currency) },
    { label: "Refunds total", value: formatMoney(report.refundsTotal, report.currency) },
    { label: "Total orders", value: report.totalOrders.toLocaleString() },
    { label: "Average order value", value: formatMoney(report.averageOrderValue, report.currency) }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Detailed store-scoped sales reports from existing orders and order item data. No demo data is included."
        title="Sales Reports"
      />

      {storesError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Stores could not be loaded: {storesError}</p>
        </Card>
      ) : null}

      {report.errors.length ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">
            Some report sources could not be loaded: {report.errors.join(" ")}
          </p>
        </Card>
      ) : null}

      <Card className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Report scope</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
            {report.activeStore?.name ?? "All current workspace stores"}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">Showing {report.range.label}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.filter((option) => option.value !== "custom").map((option) => (
            <ButtonLink
              href={salesReportHref({ period: option.value, storeId: activeStoreId })}
              key={option.value}
              variant={period === option.value ? "primary" : "secondary"}
            >
              {option.label}
            </ButtonLink>
          ))}
          <ButtonLink
            href={exportHref({ from: query.from, period, storeId: activeStoreId, to: query.to })}
            variant="secondary"
          >
            Export CSV
          </ButtonLink>
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
                href={salesReportHref({ from: query.from, period, storeId: store.id, to: query.to })}
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
        {statCards.map((stat) => (
          <Card className="p-5" key={stat.label}>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{stat.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard currency={report.currency} items={report.dayBreakdown} title="Breakdown by day" />
        <BreakdownCard currency={report.currency} items={report.productBreakdown} title="Breakdown by product" />
        <BreakdownCard currency={report.currency} items={report.orderStatusBreakdown} title="Breakdown by order status" />
        <BreakdownCard currency={report.currency} items={report.paymentMethodBreakdown} title="Breakdown by payment method" />
      </section>
    </div>
  );
}
