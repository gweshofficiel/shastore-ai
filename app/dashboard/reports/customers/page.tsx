import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  customerReportHref,
  loadCustomerReport,
  type CustomerReportItem
} from "@/lib/customer-reports";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import type { AdvancedAnalyticsPeriod } from "@/lib/store-analytics-advanced";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CustomerReportsPageProps = {
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

function formatDate(value: string | null) {
  if (!value) {
    return "No orders";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function customerContact(customer: CustomerReportItem) {
  return customer.email || customer.phone || "No contact saved";
}

function CustomerList({
  currency,
  emptyText,
  customers,
  metric,
  title
}: {
  currency: string;
  emptyText: string;
  customers: CustomerReportItem[];
  metric: "lifetime" | "orders" | "revenue";
  title: string;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h2>
      <div className="mt-5 grid gap-3">
        {customers.length ? customers.map((customer) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={`${customer.customerId ?? customer.email ?? customer.phone ?? customer.name}-${customer.lastOrderAt ?? "none"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-ink">{customer.name}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{customerContact(customer)}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Last order: {formatDate(customer.lastOrderAt)} · Lifetime: {formatMoney(customer.lifetimeValue, currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-ink">
                  {metric === "orders"
                    ? `${customer.rangeOrders} orders`
                    : formatMoney(metric === "lifetime" ? customer.lifetimeValue : customer.rangeRevenue, currency)}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {customer.totalOrders} total orders
                </p>
              </div>
            </div>
          </div>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}

export default async function CustomerReportsPage({ searchParams }: CustomerReportsPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Store-scoped customer reports from real customer and order data." title="Customer Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to view customer reports.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Store-scoped customer reports from real customer and order data." title="Customer Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">You do not have permission to view customer reports.</p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const report = await loadCustomerReport({
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
    { label: "Customers", value: report.customerCount.toLocaleString() },
    { label: "New customers", value: report.newCustomers.length.toLocaleString() },
    { label: "Returning customers", value: report.returningCustomers.length.toLocaleString() },
    { label: "Inactive customers", value: report.inactiveCustomers.length.toLocaleString() },
    { label: "Customer lifetime value", value: formatMoney(report.averageLifetimeValue, report.currency) },
    { label: "Total spent", value: formatMoney(report.totalSpent, report.currency) },
    { label: "Total orders", value: report.totalOrders.toLocaleString() }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Detailed customer performance, lifetime value, and order insights from existing customer and order data."
        title="Customer Reports"
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
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Showing {report.range.label}. Rankings use order activity in this range; lifetime value uses saved customer totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.filter((option) => option.value !== "custom").map((option) => (
            <ButtonLink
              href={customerReportHref({ period: option.value, storeId: activeStoreId })}
              key={option.value}
              variant={period === option.value ? "primary" : "secondary"}
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
                href={customerReportHref({ from: query.from, period, storeId: store.id, to: query.to })}
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
        <CustomerList
          currency={report.currency}
          customers={report.topCustomersByRevenue}
          emptyText="No customer revenue in this range."
          metric="revenue"
          title="Top customers by revenue"
        />
        <CustomerList
          currency={report.currency}
          customers={report.topCustomersByOrders}
          emptyText="No customer orders in this range."
          metric="orders"
          title="Top customers by orders"
        />
        <CustomerList
          currency={report.currency}
          customers={report.newCustomers}
          emptyText="No new customers in this range."
          metric="lifetime"
          title="New customers"
        />
        <CustomerList
          currency={report.currency}
          customers={report.returningCustomers}
          emptyText="No returning customers in this range."
          metric="revenue"
          title="Returning customers"
        />
        <CustomerList
          currency={report.currency}
          customers={report.inactiveCustomers}
          emptyText="No inactive customers for this range."
          metric="lifetime"
          title="Inactive customers"
        />
      </section>
    </div>
  );
}
