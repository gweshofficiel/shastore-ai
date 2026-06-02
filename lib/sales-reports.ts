import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStoreRow } from "@/lib/stores/user-stores";
import {
  numericValue,
  resolveAnalyticsRange,
  type AdvancedAnalyticsPeriod,
  type AdvancedAnalyticsRange
} from "@/lib/store-analytics-advanced";

export type SalesReportOrder = {
  created_at: string;
  delivery_fee?: number | string | null;
  discount_amount?: number | string | null;
  fulfillment_status?: string | null;
  id: string;
  items?: unknown;
  order_status?: string | null;
  order_subtotal_before_discount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_amount?: number | string | null;
  source: "orders" | "store_orders";
  store_id?: string | null;
  store_instance_id?: string | null;
  subtotal?: number | string | null;
  subtotal_amount?: number | string | null;
  tax_amount?: number | string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
};

export type SalesReportBreakdown = {
  label: string;
  orders: number;
  value: number;
};

export type SalesProductBreakdown = SalesReportBreakdown & {
  quantity: number;
};

export type SalesReportData = {
  activeStore: UserStoreRow | null;
  averageOrderValue: number;
  currency: string;
  dayBreakdown: SalesReportBreakdown[];
  discountsTotal: number;
  errors: string[];
  grossSales: number;
  netSales: number;
  orderStatusBreakdown: SalesReportBreakdown[];
  orders: SalesReportOrder[];
  paymentMethodBreakdown: SalesReportBreakdown[];
  productBreakdown: SalesProductBreakdown[];
  range: AdvancedAnalyticsRange;
  refundsTotal: number;
  shippingTotal: number;
  stores: UserStoreRow[];
  taxTotal: number;
  totalOrders: number;
};

type RawOrder = Omit<SalesReportOrder, "source">;

function isRefunded(order: SalesReportOrder) {
  return [order.order_status, order.payment_status, order.fulfillment_status].some(
    (status) => status?.toLowerCase() === "refunded"
  );
}

function isCancelled(order: SalesReportOrder) {
  return [order.order_status, order.payment_status, order.fulfillment_status].some((status) => {
    const normalized = status?.toLowerCase();
    return normalized === "cancelled" || normalized === "canceled";
  });
}

function orderTotal(order: SalesReportOrder) {
  return numericValue(order.total_amount ?? order.total);
}

function orderDiscount(order: SalesReportOrder) {
  return numericValue(order.discount_amount);
}

function orderShipping(order: SalesReportOrder) {
  return numericValue(order.shipping_amount ?? order.delivery_fee);
}

function orderTax(order: SalesReportOrder) {
  return numericValue(order.tax_amount);
}

function orderGross(order: SalesReportOrder) {
  const explicitGross = numericValue(order.order_subtotal_before_discount);

  if (explicitGross > 0) {
    return explicitGross;
  }

  const subtotal = numericValue(order.subtotal_amount ?? order.subtotal);

  if (subtotal > 0) {
    return subtotal + orderDiscount(order);
  }

  return Math.max(0, orderTotal(order) - orderShipping(order) - orderTax(order) + orderDiscount(order));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function addBreakdown(
  map: Map<string, SalesReportBreakdown>,
  label: string,
  value: number
) {
  const current = map.get(label) ?? { label, orders: 0, value: 0 };
  current.orders += 1;
  current.value += value;
  map.set(label, current);
}

function itemRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function addProductBreakdown(
  map: Map<string, SalesProductBreakdown>,
  input: {
    label: string;
    quantity: number;
    value: number;
  }
) {
  const current = map.get(input.label) ?? {
    label: input.label,
    orders: 0,
    quantity: 0,
    value: 0
  };
  current.orders += 1;
  current.quantity += input.quantity;
  current.value += input.value;
  map.set(input.label, current);
}

function parseStoreOrderItems(order: SalesReportOrder, map: Map<string, SalesProductBreakdown>) {
  for (const item of itemRecords(order.items)) {
    const label =
      typeof item.title === "string"
        ? item.title
        : typeof item.product_title === "string"
          ? item.product_title
          : "Product";
    const quantity = Math.max(1, Math.floor(numericValue(item.quantity as number | string | null | undefined) || 1));
    const value = numericValue(
      (item.total as number | string | null | undefined) ??
        (item.subtotal as number | string | null | undefined) ??
        (item.total_price as number | string | null | undefined)
    );

    addProductBreakdown(map, {
      label,
      quantity,
      value: value || orderGross(order)
    });
  }
}

function sortBreakdowns<T extends SalesReportBreakdown>(items: T[]) {
  return [...items].sort((left, right) => right.value - left.value);
}

export function salesReportHref({
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

  return `/dashboard/reports/sales?${params.toString()}`;
}

export async function loadSalesReport({
  from,
  period,
  selectedStoreId,
  stores,
  supabase,
  to,
  workspaceId
}: {
  from?: string;
  period?: string;
  selectedStoreId?: string;
  stores: UserStoreRow[];
  supabase: SupabaseClient;
  to?: string;
  workspaceId: string;
}): Promise<SalesReportData> {
  const range = resolveAnalyticsRange({ from, period, to });
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const storeIds = activeStore ? [activeStore.id] : stores.map((store) => store.id);
  const errors: string[] = [];

  if (!storeIds.length) {
    return {
      activeStore,
      averageOrderValue: 0,
      currency: "USD",
      dayBreakdown: [],
      discountsTotal: 0,
      errors,
      grossSales: 0,
      netSales: 0,
      orderStatusBreakdown: [],
      orders: [],
      paymentMethodBreakdown: [],
      productBreakdown: [],
      range,
      refundsTotal: 0,
      shippingTotal: 0,
      stores,
      taxTotal: 0,
      totalOrders: 0
    };
  }

  let storeOrdersQuery = supabase
    .from("store_orders")
    .select("id, store_id, items, subtotal, subtotal_amount, total, total_amount, discount_amount, order_subtotal_before_discount, shipping_amount, delivery_fee, tax_amount, payment_method, payment_status, order_status, fulfillment_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  let draftOrdersQuery = supabase
    .from("orders" as never)
    .select("id, store_id, store_instance_id, subtotal, subtotal_amount, total, total_amount, discount_amount, order_subtotal_before_discount, shipping_amount, delivery_fee, tax_amount, payment_method, payment_status, order_status, fulfillment_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at" as never, range.start.toISOString() as never)
    .lte("created_at" as never, range.end.toISOString() as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(1000);

  if (storeIds.length) {
    storeOrdersQuery = storeOrdersQuery.in("store_id", storeIds);
    draftOrdersQuery = draftOrdersQuery.or(`store_id.in.(${storeIds.join(",")}),store_instance_id.in.(${storeIds.join(",")})` as never);
  }

  const [storeOrdersResult, draftOrdersResult, orderItemsResult] = await Promise.all([
    storeOrdersQuery,
    draftOrdersQuery,
    supabase
      .from("order_items" as never)
      .select("order_id, product_title, quantity, price, subtotal, total_price")
      .limit(2000)
  ]);

  if (storeOrdersResult.error) {
    errors.push("Store orders could not be loaded.");
  }

  if (draftOrdersResult.error) {
    errors.push("Draft orders could not be loaded.");
  }

  if (orderItemsResult.error) {
    errors.push("Order item breakdown could not be loaded.");
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
    .map((order) => ({ ...order, source: "orders" as const }));
  const orders = [...storeOrders, ...draftOrders].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const nonCancelledOrders = orders.filter((order) => !isCancelled(order));
  const grossSales = nonCancelledOrders.reduce((sum, order) => sum + orderGross(order), 0);
  const discountsTotal = nonCancelledOrders.reduce((sum, order) => sum + orderDiscount(order), 0);
  const shippingTotal = nonCancelledOrders.reduce((sum, order) => sum + orderShipping(order), 0);
  const taxTotal = nonCancelledOrders.reduce((sum, order) => sum + orderTax(order), 0);
  const refundsTotal = orders.filter(isRefunded).reduce((sum, order) => sum + orderTotal(order), 0);
  const netSales = Math.max(0, grossSales - discountsTotal - refundsTotal);
  const dayMap = new Map<string, SalesReportBreakdown>();
  const statusMap = new Map<string, SalesReportBreakdown>();
  const paymentMap = new Map<string, SalesReportBreakdown>();
  const productMap = new Map<string, SalesProductBreakdown>();

  for (const order of orders) {
    const value = isCancelled(order) || isRefunded(order) ? 0 : orderGross(order) - orderDiscount(order);
    addBreakdown(dayMap, dayKey(order.created_at), value);
    addBreakdown(statusMap, order.order_status || "pending", orderGross(order));
    addBreakdown(paymentMap, order.payment_method || "not stored", orderGross(order));

    if (order.source === "store_orders") {
      parseStoreOrderItems(order, productMap);
    }
  }

  const draftOrderIds = new Set(draftOrders.map((order) => order.id));

  for (const item of (orderItemsResult.data ?? []) as unknown as Array<{
    order_id?: string | null;
    price?: number | string | null;
    product_title?: string | null;
    quantity?: number | string | null;
    subtotal?: number | string | null;
    total_price?: number | string | null;
  }>) {
    if (!item.order_id || !draftOrderIds.has(item.order_id)) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(numericValue(item.quantity) || 1));
    addProductBreakdown(productMap, {
      label: item.product_title || "Product",
      quantity,
      value: numericValue(item.subtotal ?? item.total_price) || numericValue(item.price) * quantity
    });
  }

  return {
    activeStore,
    averageOrderValue: orders.length ? netSales / orders.length : 0,
    currency: "USD",
    dayBreakdown: [...dayMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({ ...value, label: dayLabel(key) })),
    discountsTotal,
    errors,
    grossSales,
    netSales,
    orderStatusBreakdown: sortBreakdowns([...statusMap.values()]),
    orders,
    paymentMethodBreakdown: sortBreakdowns([...paymentMap.values()]),
    productBreakdown: sortBreakdowns([...productMap.values()]).slice(0, 20),
    range,
    refundsTotal,
    shippingTotal,
    stores,
    taxTotal,
    totalOrders: orders.length
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function salesReportToCsv(report: SalesReportData) {
  const rows: Array<Array<string | number>> = [
    ["Metric", "Value"],
    ["Gross sales", report.grossSales.toFixed(2)],
    ["Net sales", report.netSales.toFixed(2)],
    ["Discounts total", report.discountsTotal.toFixed(2)],
    ["Shipping total", report.shippingTotal.toFixed(2)],
    ["Tax total", report.taxTotal.toFixed(2)],
    ["Refunds total", report.refundsTotal.toFixed(2)],
    ["Total orders", report.totalOrders],
    ["Average order value", report.averageOrderValue.toFixed(2)],
    [],
    ["Sales by day"],
    ["Day", "Orders", "Value"],
    ...report.dayBreakdown.map((item) => [item.label, item.orders, item.value.toFixed(2)]),
    [],
    ["Sales by product"],
    ["Product", "Orders", "Quantity", "Value"],
    ...report.productBreakdown.map((item) => [item.label, item.orders, item.quantity, item.value.toFixed(2)]),
    [],
    ["Sales by order status"],
    ["Status", "Orders", "Value"],
    ...report.orderStatusBreakdown.map((item) => [item.label, item.orders, item.value.toFixed(2)]),
    [],
    ["Sales by payment method"],
    ["Payment method", "Orders", "Value"],
    ...report.paymentMethodBreakdown.map((item) => [item.label, item.orders, item.value.toFixed(2)])
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
