import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStoreRow } from "@/lib/stores/user-stores";

export type AdvancedAnalyticsPeriod = "7d" | "30d" | "custom" | "today";

export type AdvancedAnalyticsRange = {
  end: Date;
  label: string;
  period: AdvancedAnalyticsPeriod;
  start: Date;
};

export type AnalyticsOrderRow = {
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  fulfillment_status?: string | null;
  id: string;
  items?: unknown;
  order_status?: string | null;
  payment_status?: string | null;
  source: "orders" | "store_orders";
  store_id?: string | null;
  store_instance_id?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
};

export type AnalyticsTopProduct = {
  productId: string | null;
  quantity: number;
  sales: number;
  title: string;
};

export type AnalyticsTopCustomer = {
  email: string | null;
  name: string;
  orders: number;
  phone: string | null;
  sales: number;
};

export type AnalyticsPoint = {
  label: string;
  orders: number;
  sales: number;
};

export type AdvancedAnalyticsData = {
  abandonedCarts: {
    emailSent: number;
    estimatedTotal: number;
    pending: number;
    recovered: number;
    total: number;
  };
  activeStore: UserStoreRow | null;
  averageOrderValue: number;
  conversionRate: number | null;
  currency: string;
  customerCount: number;
  errors: string[];
  orderStatusCounts: Array<{ count: number; status: string }>;
  orders: AnalyticsOrderRow[];
  refundsReturns: {
    refunded: number;
    returned: number;
    total: number;
  };
  salesByMonth: AnalyticsPoint[];
  salesByWeek: AnalyticsPoint[];
  salesByDay: AnalyticsPoint[];
  stores: UserStoreRow[];
  topCustomers: AnalyticsTopCustomer[];
  topProducts: AnalyticsTopProduct[];
  totalOrders: number;
  totalSales: number;
};

type RawOrder = Omit<AnalyticsOrderRow, "source">;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function normalizeAnalyticsPeriod(value: string | undefined): AdvancedAnalyticsPeriod {
  return value === "today" || value === "7d" || value === "30d" || value === "custom" ? value : "30d";
}

export function resolveAnalyticsRange({
  from,
  period,
  to
}: {
  from?: string;
  period?: string;
  to?: string;
}): AdvancedAnalyticsRange {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const now = new Date();

  if (normalizedPeriod === "custom") {
    const parsedFrom = from ? new Date(`${from}T00:00:00`) : null;
    const parsedTo = to ? new Date(`${to}T23:59:59`) : null;
    const start = parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? startOfDay(parsedFrom) : startOfDay(addDays(now, -30));
    const end = parsedTo && !Number.isNaN(parsedTo.getTime()) ? endOfDay(parsedTo) : endOfDay(now);

    return {
      end: start > end ? endOfDay(now) : end,
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      period: "custom",
      start: start > end ? startOfDay(addDays(now, -30)) : start
    };
  }

  if (normalizedPeriod === "today") {
    return {
      end: endOfDay(now),
      label: "Today",
      period: "today",
      start: startOfDay(now)
    };
  }

  const days = normalizedPeriod === "7d" ? 7 : 30;
  return {
    end: endOfDay(now),
    label: `${days} days`,
    period: normalizedPeriod,
    start: startOfDay(addDays(now, -(days - 1)))
  };
}

export function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function orderTotal(order: AnalyticsOrderRow) {
  return numericValue(order.total_amount ?? order.total);
}

function isCancelledOrRefunded(order: AnalyticsOrderRow) {
  const statuses = [
    order.order_status?.toLowerCase(),
    order.payment_status?.toLowerCase(),
    order.fulfillment_status?.toLowerCase()
  ];
  return statuses.some((status) => status === "cancelled" || status === "canceled" || status === "refunded");
}

function isReturned(order: AnalyticsOrderRow) {
  return [
    order.order_status?.toLowerCase(),
    order.fulfillment_status?.toLowerCase()
  ].some((status) => status === "returned");
}

function cleanCustomerKey(order: AnalyticsOrderRow) {
  const email = order.customer_email?.trim().toLowerCase();
  const phone = order.customer_phone?.replace(/[^0-9+]/g, "");
  return email ? `email:${email}` : phone ? `phone:${phone}` : `order:${order.source}:${order.id}`;
}

function itemRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function recordProduct(
  products: Map<string, AnalyticsTopProduct>,
  input: {
    productId: string | null;
    quantity: number;
    sales: number;
    title: string;
  }
) {
  const key = input.productId ?? input.title.toLowerCase();
  const current = products.get(key) ?? {
    productId: input.productId,
    quantity: 0,
    sales: 0,
    title: input.title || "Product"
  };

  current.quantity += input.quantity;
  current.sales += input.sales;
  products.set(key, current);
}

function parseStoreOrderProducts(order: AnalyticsOrderRow, products: Map<string, AnalyticsTopProduct>) {
  for (const item of itemRecords(order.items)) {
    const title =
      typeof item.title === "string"
        ? item.title
        : typeof item.product_title === "string"
          ? item.product_title
          : "Product";
    const productId =
      typeof item.productId === "string"
        ? item.productId
        : typeof item.product_id === "string"
          ? item.product_id
          : typeof item.id === "string"
            ? item.id
            : null;
    const quantity = Math.max(1, Math.floor(numericValue(item.quantity as number | string | null | undefined) || 1));
    const sales = numericValue(
      (item.total as number | string | null | undefined) ??
        (item.subtotal as number | string | null | undefined) ??
        (item.total_price as number | string | null | undefined)
    );

    recordProduct(products, {
      productId,
      quantity,
      sales: sales || orderTotal(order),
      title
    });
  }
}

function bucketKey(date: Date, mode: "day" | "month" | "week") {
  if (mode === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (mode === "week") {
    const first = startOfDay(new Date(date));
    first.setDate(first.getDate() - first.getDay());
    return first.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function bucketLabel(key: string, mode: "day" | "month" | "week") {
  if (mode === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, (month ?? 1) - 1, 1));
  }

  if (mode === "week") {
    return `Week of ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(key))}`;
  }

  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(key));
}

function seriesForOrders(orders: AnalyticsOrderRow[], mode: "day" | "month" | "week") {
  const buckets = new Map<string, AnalyticsPoint>();

  for (const order of orders) {
    const date = new Date(order.created_at);
    const key = bucketKey(date, mode);
    const current = buckets.get(key) ?? {
      label: bucketLabel(key, mode),
      orders: 0,
      sales: 0
    };

    current.orders += 1;
    current.sales += isCancelledOrRefunded(order) ? 0 : orderTotal(order);
    buckets.set(key, current);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => point);
}

function summarizeCustomers(orders: AnalyticsOrderRow[]) {
  const customers = new Map<string, AnalyticsTopCustomer>();

  for (const order of orders) {
    const key = cleanCustomerKey(order);
    const current = customers.get(key) ?? {
      email: order.customer_email ?? null,
      name: order.customer_name?.trim() || "Customer",
      orders: 0,
      phone: order.customer_phone ?? null,
      sales: 0
    };

    current.orders += 1;
    current.sales += isCancelledOrRefunded(order) ? 0 : orderTotal(order);
    customers.set(key, current);
  }

  return [...customers.values()].sort((left, right) => right.sales - left.sales).slice(0, 8);
}

function statusCounts(orders: AnalyticsOrderRow[]) {
  const counts = new Map<string, number>();

  for (const order of orders) {
    const status = order.order_status || "pending";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
    .sort((left, right) => right.count - left.count);
}

export async function loadAdvancedStoreAnalytics({
  range,
  selectedStoreId,
  stores,
  supabase,
  workspaceId
}: {
  range: AdvancedAnalyticsRange;
  selectedStoreId?: string;
  stores: UserStoreRow[];
  supabase: SupabaseClient;
  workspaceId: string;
}): Promise<AdvancedAnalyticsData> {
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const storeIds = activeStore ? [activeStore.id] : stores.map((store) => store.id);
  const errors: string[] = [];

  if (!storeIds.length) {
    return {
      abandonedCarts: { emailSent: 0, estimatedTotal: 0, pending: 0, recovered: 0, total: 0 },
      activeStore,
      averageOrderValue: 0,
      conversionRate: null,
      currency: "USD",
      customerCount: 0,
      errors,
      orderStatusCounts: [],
      orders: [],
      refundsReturns: { refunded: 0, returned: 0, total: 0 },
      salesByDay: [],
      salesByMonth: [],
      salesByWeek: [],
      stores,
      topCustomers: [],
      topProducts: [],
      totalOrders: 0,
      totalSales: 0
    };
  }

  let storeOrdersQuery = supabase
    .from("store_orders")
    .select("id, store_id, customer_name, customer_phone, customer_email, items, total, total_amount, payment_status, order_status, fulfillment_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  let draftOrdersQuery = supabase
    .from("orders" as never)
    .select("id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, total_amount, payment_status, order_status, fulfillment_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at" as never, range.start.toISOString() as never)
    .lte("created_at" as never, range.end.toISOString() as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(1000);
  let customersQuery = supabase
    .from("store_customers" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never);
  let abandonedCartsQuery = supabase
    .from("store_abandoned_carts" as never)
    .select("recovery_status, estimated_total")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("last_activity_at" as never, range.start.toISOString() as never)
    .lte("last_activity_at" as never, range.end.toISOString() as never)
    .limit(1000);

  if (storeIds.length) {
    storeOrdersQuery = storeOrdersQuery.in("store_id", storeIds);
    draftOrdersQuery = draftOrdersQuery.or(`store_id.in.(${storeIds.join(",")}),store_instance_id.in.(${storeIds.join(",")})` as never);
    customersQuery = customersQuery.in("store_id" as never, storeIds as never);
    abandonedCartsQuery = abandonedCartsQuery.in("store_id" as never, storeIds as never);
  }

  const [storeOrdersResult, draftOrdersResult, orderItemsResult, customersResult, abandonedCartsResult] = await Promise.all([
    storeOrdersQuery,
    draftOrdersQuery,
    supabase
      .from("order_items" as never)
      .select("order_id, product_id, product_title, quantity, price, subtotal, total_price")
      .limit(2000),
    customersQuery,
    abandonedCartsQuery
  ]);

  if (storeOrdersResult.error) {
    errors.push("Store orders could not be loaded.");
  }

  if (draftOrdersResult.error) {
    errors.push("Draft orders could not be loaded.");
  }

  if (orderItemsResult.error) {
    errors.push("Order item product metrics could not be loaded.");
  }

  if (customersResult.error) {
    errors.push("Customer count could not be loaded.");
  }

  if (abandonedCartsResult.error) {
    errors.push("Abandoned cart summary could not be loaded.");
  }

  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as RawOrder[]).map((order) => ({
    ...order,
    source: "store_orders" as const
  }));
  const draftOrders = ((draftOrdersResult.data ?? []) as unknown as RawOrder[])
    .filter((order) => {
      const rowStoreId = order.store_id ?? order.store_instance_id ?? "";
      return storeIds.includes(rowStoreId);
    })
    .map((order) => ({
      ...order,
      source: "orders" as const
    }));
  const orders = [...storeOrders, ...draftOrders].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const nonRefundedOrders = orders.filter((order) => !isCancelledOrRefunded(order));
  const totalSales = nonRefundedOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const productMap = new Map<string, AnalyticsTopProduct>();

  for (const order of storeOrders) {
    parseStoreOrderProducts(order, productMap);
  }

  const itemRows = (orderItemsResult.data ?? []) as unknown as Array<{
    order_id: string | null;
    price?: number | string | null;
    product_id?: string | null;
    product_title?: string | null;
    quantity?: number | string | null;
    subtotal?: number | string | null;
    total_price?: number | string | null;
  }>;
  const draftOrderIds = new Set(draftOrders.map((order) => order.id));

  for (const item of itemRows) {
    if (!item.order_id || !draftOrderIds.has(item.order_id)) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(numericValue(item.quantity) || 1));
    const sales = numericValue(item.subtotal ?? item.total_price) || numericValue(item.price) * quantity;
    recordProduct(productMap, {
      productId: item.product_id ?? null,
      quantity,
      sales,
      title: item.product_title || "Product"
    });
  }

  const abandonedRows = (abandonedCartsResult.data ?? []) as unknown as Array<{
    estimated_total?: number | string | null;
    recovery_status?: string | null;
  }>;
  const abandonedCarts = {
    emailSent: abandonedRows.filter((cart) => cart.recovery_status === "email_sent").length,
    estimatedTotal: abandonedRows.reduce((sum, cart) => sum + numericValue(cart.estimated_total), 0),
    pending: abandonedRows.filter((cart) => cart.recovery_status === "pending").length,
    recovered: abandonedRows.filter((cart) => cart.recovery_status === "recovered").length,
    total: abandonedRows.length
  };
  const refunded = orders.filter((order) =>
    [order.order_status, order.payment_status, order.fulfillment_status].some((status) => status?.toLowerCase() === "refunded")
  ).length;
  const returned = orders.filter(isReturned).length;
  const totalVisits = abandonedCarts.total + orders.length;

  return {
    abandonedCarts,
    activeStore,
    averageOrderValue: orders.length ? totalSales / orders.length : 0,
    conversionRate: totalVisits > 0 ? Number(((orders.length / totalVisits) * 100).toFixed(2)) : null,
    currency: "USD",
    customerCount: (customersResult.data ?? []).length,
    errors,
    orderStatusCounts: statusCounts(orders),
    orders,
    refundsReturns: {
      refunded,
      returned,
      total: refunded + returned
    },
    salesByDay: seriesForOrders(orders, "day"),
    salesByMonth: seriesForOrders(orders, "month"),
    salesByWeek: seriesForOrders(orders, "week"),
    stores,
    topCustomers: summarizeCustomers(orders),
    topProducts: [...productMap.values()].sort((left, right) => right.sales - left.sales).slice(0, 8),
    totalOrders: orders.length,
    totalSales
  };
}
