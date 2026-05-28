import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams: Promise<{
    period?: string;
    storeId?: string;
  }>;
};

type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

type OrderMetricRow = {
  created_at: string;
  order_status: string | null;
  store_id: string | null;
  store_instance_id?: string | null;
  total: number | string | null;
};

type ProductMetricRow = {
  status: string | null;
  store_id: string | null;
};

const periodOptions: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" }
];

function normalizePeriod(value: string | undefined): AnalyticsPeriod {
  return value === "today" || value === "7d" || value === "30d" || value === "all" ? value : "30d";
}

function periodStart(period: AnalyticsPeriod) {
  if (period === "all") {
    return null;
  }

  const start = new Date();

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  start.setDate(start.getDate() - (period === "7d" ? 7 : 30));
  return start.toISOString();
}

function periodLabel(period: AnalyticsPeriod) {
  return periodOptions.find((option) => option.value === period)?.label ?? "30 days";
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

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function analyticsHref(period: AnalyticsPeriod, storeId?: string | null) {
  const params = new URLSearchParams({ period });

  if (storeId) {
    params.set("storeId", storeId);
  }

  return `/dashboard/analytics?${params.toString()}`;
}

function isProductActive(status: string | null | undefined) {
  return status === "active";
}

function summarizeOrders(rows: OrderMetricRow[]) {
  const totalOrders = rows.length;
  const confirmedOrders = rows.filter((order) => order.order_status === "confirmed").length;
  const cancelledOrders = rows.filter(
    (order) => order.order_status === "cancelled" || order.order_status === "canceled"
  ).length;
  const pendingOrders = rows.filter(
    (order) => order.order_status === "pending" || order.order_status === "draft"
  ).length;
  const totalRevenue = rows
    .filter((order) => order.order_status !== "cancelled" && order.order_status !== "canceled")
    .reduce((sum, order) => sum + numericValue(order.total), 0);

  return {
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    cancelledOrders,
    confirmedOrders,
    pendingOrders,
    totalOrders,
    totalRevenue
  };
}

function summarizeProducts(rows: ProductMetricRow[]) {
  return {
    activeProducts: rows.filter((product) => isProductActive(product.status)).length,
    totalProducts: rows.length
  };
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const query = await searchParams;
  const period = normalizePeriod(query.period);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Store-scoped order and product metrics for the current workspace."
          title="Analytics"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to access analytics.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_analytics")) {
    console.warn("[permission-denied] analytics page denied", {
      permission: "view_analytics",
      role,
      userId: user.id,
      workspaceId
    });

    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Store-scoped order and product metrics for the current workspace."
          title="Analytics"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            You do not have permission to view analytics.
          </p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const selectedStore =
    stores.find((store) => store.id === query.storeId) ?? stores[0] ?? null;
  const selectedStoreIds = selectedStore ? [selectedStore.id] : stores.map((store) => store.id);
  const since = periodStart(period);
  let storeOrdersRequest = supabase
    .from("store_orders")
    .select("id, store_id, order_status, total, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at", { ascending: false });

  if (selectedStoreIds.length) {
    storeOrdersRequest = storeOrdersRequest.in("store_id", selectedStoreIds);
  }

  if (since) {
    storeOrdersRequest = storeOrdersRequest.gte("created_at", since);
  }

  let draftOrdersRequest = supabase
    .from("orders" as never)
    .select("id, store_id, store_instance_id, order_status, total, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never);

  if (selectedStoreIds.length) {
    draftOrdersRequest = draftOrdersRequest.or(
      `store_id.in.(${selectedStoreIds.join(",")}),store_instance_id.in.(${selectedStoreIds.join(",")})` as never
    );
  }

  if (since) {
    draftOrdersRequest = draftOrdersRequest.gte("created_at" as never, since as never);
  }

  let productsRequest = supabase
    .from("store_products" as never)
    .select("id, store_id, status")
    .eq("workspace_id" as never, workspaceId as never);

  if (selectedStoreIds.length) {
    productsRequest = productsRequest.in("store_id", selectedStoreIds);
  }

  const [
    { data: storeOrders, error: storeOrdersError },
    { data: draftOrders, error: draftOrdersError },
    { data: products, error: productsError }
  ] = await Promise.all([storeOrdersRequest, draftOrdersRequest, productsRequest]);
  const orderRows = [
    ...((storeOrders ?? []) as unknown as OrderMetricRow[]),
    ...((draftOrders ?? []) as unknown as OrderMetricRow[])
  ].filter((order) => {
    const storeId = order.store_id ?? order.store_instance_id ?? "";
    return selectedStoreIds.length === 0 || selectedStoreIds.includes(storeId);
  });
  const productRows = ((products ?? []) as unknown as ProductMetricRow[]).filter((product) => {
    return !selectedStoreIds.length || selectedStoreIds.includes(product.store_id ?? "");
  });
  const orderSummary = summarizeOrders(orderRows);
  const productSummary = summarizeProducts(productRows);
  const currency = "USD";
  const stats = [
    { label: "Total orders", value: orderSummary.totalOrders.toLocaleString() },
    { label: "Confirmed orders", value: orderSummary.confirmedOrders.toLocaleString() },
    { label: "Cancelled orders", value: orderSummary.cancelledOrders.toLocaleString() },
    { label: "Pending orders", value: orderSummary.pendingOrders.toLocaleString() },
    { label: "Total revenue", value: formatMoney(orderSummary.totalRevenue, currency) },
    { label: "Average order value", value: formatMoney(orderSummary.averageOrderValue, currency) },
    { label: "Total products", value: productSummary.totalProducts.toLocaleString() },
    { label: "Active products", value: productSummary.activeProducts.toLocaleString() }
  ];
  const hasAnyData = orderSummary.totalOrders > 0 || productSummary.totalProducts > 0;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Store-scoped order and product metrics for the current workspace."
        title="Analytics"
      />

      {storesError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Stores could not be loaded: {storesError}</p>
        </Card>
      ) : null}

      {storeOrdersError || draftOrdersError || productsError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">
            Some analytics sources could not be loaded. Available metrics are shown from the existing schema.
          </p>
        </Card>
      ) : null}

      <Card className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Analytics scope
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
            {selectedStore?.name ?? "All current workspace stores"}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Showing {periodLabel(period).toLowerCase()} of orders and the current product catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <ButtonLink
              className={period === option.value ? "bg-ink text-white hover:bg-slate-800" : ""}
              href={analyticsHref(option.value, selectedStore?.id)}
              key={option.value}
              variant={period === option.value ? "primary" : "secondary"}
            >
              {option.label}
            </ButtonLink>
          ))}
        </div>
      </Card>

      {stores.length > 1 ? (
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Store filter
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {stores.map((store) => (
              <ButtonLink
                href={analyticsHref(period, store.id)}
                key={store.id}
                variant={selectedStore?.id === store.id ? "primary" : "secondary"}
              >
                {store.name}
              </ButtonLink>
            ))}
          </div>
        </Card>
      ) : null}

      {!stores.length ? (
        <Card className="border-blue-200 bg-blue-50 p-6">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores yet</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
            Create a store and publish products to start seeing analytics here.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card className="p-5 lg:p-6" key={stat.label}>
            <p className="text-sm font-bold text-muted">{stat.label}</p>
            <p className="mt-4 text-4xl font-black tracking-[-0.04em] text-ink">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {!hasAnyData && stores.length ? (
        <Card className="border-blue-200 bg-blue-50 p-6">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No analytics data yet</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
            Orders and products for this store will populate these metrics as customers checkout and the catalog grows.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Order mix
          </h2>
          <div className="mt-5 grid gap-3 text-sm font-bold text-muted">
            <MetricLine label="Confirmed" value={orderSummary.confirmedOrders} />
            <MetricLine label="Pending or draft" value={orderSummary.pendingOrders} />
            <MetricLine label="Cancelled" value={orderSummary.cancelledOrders} />
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Future analytics
          </h2>
          <div className="mt-5 grid gap-3 text-sm font-semibold leading-6 text-muted">
            <p>Product performance, customer analytics, conversion analytics, traffic analytics, and admin analytics can build on this workspace/store-scoped foundation.</p>
            <p>No visitor tracking or external analytics providers are connected yet.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <span>{label}</span>
      <span className="text-xl font-black text-ink">{value.toLocaleString()}</span>
    </div>
  );
}
