import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  loadProductReport,
  productReportHref,
  type ProductReportItem
} from "@/lib/product-reports";
import type { AdvancedAnalyticsPeriod } from "@/lib/store-analytics-advanced";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type ProductReportsPageProps = {
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

function stockLabel(product: ProductReportItem) {
  if (!product.trackInventory) {
    return "Not tracked";
  }

  return product.currentStock === null ? "Not stored" : product.currentStock.toLocaleString();
}

function statusClass(product: ProductReportItem) {
  if (product.isSoldOut) {
    return "bg-red-100 text-red-700";
  }

  if (product.isLowStock) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function ProductList({
  currency,
  emptyText,
  products,
  title
}: {
  currency: string;
  emptyText: string;
  products: ProductReportItem[];
  title: string;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h2>
      <div className="mt-5 grid gap-3">
        {products.length ? products.map((product) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={product.productId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-ink">{product.title}</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {product.quantitySold} sold · {formatMoney(product.revenue, currency)}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Views: {product.views ?? "not tracked"} · Conversion: {product.conversionRate === null ? "not tracked" : `${product.conversionRate}%`}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(product)}`}>
                Stock: {stockLabel(product)}
              </span>
            </div>
          </div>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}

export default async function ProductReportsPage({ searchParams }: ProductReportsPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Store-scoped product performance reports from real catalog and order data." title="Product Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to view product reports.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader description="Store-scoped product performance reports from real catalog and order data." title="Product Reports" />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">You do not have permission to view product reports.</p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const report = await loadProductReport({
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
    { label: "Products", value: report.productCount.toLocaleString() },
    { label: "Product revenue", value: formatMoney(report.totalRevenue, report.currency) },
    { label: "Quantity sold", value: report.totalQuantitySold.toLocaleString() },
    { label: "Low stock", value: report.lowStockProducts.length.toLocaleString() },
    { label: "Sold out", value: report.soldOutProducts.length.toLocaleString() },
    { label: "Product views", value: "Not tracked" },
    { label: "Conversion", value: "Not tracked" }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Detailed product performance, sales, and inventory insights from existing products and orders."
        title="Product Reports"
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
            Showing {report.range.label}. Product views/conversion are shown only if persistent view data exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.filter((option) => option.value !== "custom").map((option) => (
            <ButtonLink
              href={productReportHref({ period: option.value, storeId: activeStoreId })}
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
                href={productReportHref({ from: query.from, period, storeId: store.id, to: query.to })}
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
        <ProductList
          currency={report.currency}
          emptyText="No product sales in this range."
          products={report.topSellingProducts}
          title="Top selling products"
        />
        <ProductList
          currency={report.currency}
          emptyText="No low-selling products found."
          products={report.lowSellingProducts}
          title="Low selling products"
        />
        <ProductList
          currency={report.currency}
          emptyText="No low-stock products found."
          products={report.lowStockProducts}
          title="Low stock products"
        />
        <ProductList
          currency={report.currency}
          emptyText="No sold-out products found."
          products={report.soldOutProducts}
          title="Sold out products"
        />
      </section>
    </div>
  );
}
