import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStoreRow } from "@/lib/stores/user-stores";
import {
  numericValue,
  resolveAnalyticsRange,
  type AdvancedAnalyticsPeriod,
  type AdvancedAnalyticsRange
} from "@/lib/store-analytics-advanced";

export type ProductReportItem = {
  conversionRate: number | null;
  currentStock: number | null;
  inventoryStatus: string;
  isLowStock: boolean;
  isSoldOut: boolean;
  productId: string;
  quantitySold: number;
  revenue: number;
  status: string;
  title: string;
  trackInventory: boolean;
  views: number | null;
};

export type ProductReportData = {
  activeStore: UserStoreRow | null;
  currency: string;
  errors: string[];
  lowSellingProducts: ProductReportItem[];
  lowStockProducts: ProductReportItem[];
  productCount: number;
  products: ProductReportItem[];
  range: AdvancedAnalyticsRange;
  soldOutProducts: ProductReportItem[];
  stores: UserStoreRow[];
  topSellingProducts: ProductReportItem[];
  totalQuantitySold: number;
  totalRevenue: number;
};

type ProductRow = {
  id: string;
  inventory_status?: string | null;
  low_stock_threshold?: number | null;
  name?: string | null;
  price?: string | number | null;
  status?: string | null;
  stock_quantity?: number | string | null;
  store_id?: string | null;
  track_inventory?: boolean | null;
};

type RawOrder = {
  id: string;
  items?: unknown;
  order_status?: string | null;
  payment_status?: string | null;
  source: "orders" | "store_orders";
  store_id?: string | null;
  store_instance_id?: string | null;
};

type ProductSales = {
  quantitySold: number;
  revenue: number;
};

function isCancelledOrRefunded(order: RawOrder) {
  return [order.order_status, order.payment_status].some((status) => {
    const normalized = status?.toLowerCase();
    return normalized === "cancelled" || normalized === "canceled" || normalized === "refunded";
  });
}

function itemRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function addSales(
  salesByProduct: Map<string, ProductSales>,
  input: {
    productId: string;
    quantity: number;
    revenue: number;
  }
) {
  const current = salesByProduct.get(input.productId) ?? {
    quantitySold: 0,
    revenue: 0
  };

  current.quantitySold += input.quantity;
  current.revenue += input.revenue;
  salesByProduct.set(input.productId, current);
}

function parseStoreOrderItems(order: RawOrder, salesByProduct: Map<string, ProductSales>) {
  if (isCancelledOrRefunded(order)) {
    return;
  }

  for (const item of itemRecords(order.items)) {
    const productId =
      typeof item.productId === "string"
        ? item.productId
        : typeof item.product_id === "string"
          ? item.product_id
          : typeof item.id === "string"
            ? item.id
            : "";

    if (!productId) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(numericValue(item.quantity as number | string | null | undefined) || 1));
    const revenue = numericValue(
      (item.total as number | string | null | undefined) ??
        (item.subtotal as number | string | null | undefined) ??
        (item.total_price as number | string | null | undefined)
    );

    addSales(salesByProduct, {
      productId,
      quantity,
      revenue
    });
  }
}

export function productReportHref({
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

  return `/dashboard/reports/products?${params.toString()}`;
}

export async function loadProductReport({
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
}): Promise<ProductReportData> {
  const range = resolveAnalyticsRange({ from, period, to });
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const storeIds = activeStore ? [activeStore.id] : stores.map((store) => store.id);
  const errors: string[] = [];

  if (!storeIds.length) {
    return {
      activeStore,
      currency: "USD",
      errors,
      lowSellingProducts: [],
      lowStockProducts: [],
      productCount: 0,
      products: [],
      range,
      soldOutProducts: [],
      stores,
      topSellingProducts: [],
      totalQuantitySold: 0,
      totalRevenue: 0
    };
  }

  let productsQuery = supabase
    .from("store_products" as never)
    .select("id, store_id, name, price, status, stock_quantity, track_inventory, low_stock_threshold, inventory_status")
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never);
  let storeOrdersQuery = supabase
    .from("store_orders")
    .select("id, store_id, items, payment_status, order_status")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .limit(1000);
  let draftOrdersQuery = supabase
    .from("orders" as never)
    .select("id, store_id, store_instance_id, payment_status, order_status")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at" as never, range.start.toISOString() as never)
    .lte("created_at" as never, range.end.toISOString() as never)
    .limit(1000);

  if (storeIds.length) {
    productsQuery = productsQuery.in("store_id" as never, storeIds as never);
    storeOrdersQuery = storeOrdersQuery.in("store_id", storeIds);
    draftOrdersQuery = draftOrdersQuery.or(`store_id.in.(${storeIds.join(",")}),store_instance_id.in.(${storeIds.join(",")})` as never);
  }

  const [productsResult, variantsResult, storeOrdersResult, draftOrdersResult, orderItemsResult] = await Promise.all([
    productsQuery,
    supabase
      .from("product_variants" as never)
      .select("product_id, stock_quantity, status")
      .in("store_id" as never, storeIds as never)
      .limit(2000),
    storeOrdersQuery,
    draftOrdersQuery,
    supabase
      .from("order_items" as never)
      .select("order_id, product_id, quantity, price, subtotal, total_price")
      .limit(2000)
  ]);

  if (productsResult.error) {
    errors.push("Products could not be loaded.");
  }

  if (variantsResult.error) {
    errors.push("Product variants could not be loaded.");
  }

  if (storeOrdersResult.error) {
    errors.push("Store order product sales could not be loaded.");
  }

  if (draftOrdersResult.error) {
    errors.push("Draft order product sales could not be loaded.");
  }

  if (orderItemsResult.error) {
    errors.push("Order items could not be loaded.");
  }

  const products = (productsResult.data ?? []) as unknown as ProductRow[];
  const productIds = new Set(products.map((product) => product.id));
  const variantStockByProduct = new Map<string, { count: number; stock: number }>();

  for (const variant of (variantsResult.data ?? []) as unknown as Array<{
    product_id?: string | null;
    status?: string | null;
    stock_quantity?: number | string | null;
  }>) {
    if (!variant.product_id || !productIds.has(variant.product_id) || variant.status === "inactive") {
      continue;
    }

    const current = variantStockByProduct.get(variant.product_id) ?? { count: 0, stock: 0 };
    current.count += 1;
    current.stock += numericValue(variant.stock_quantity);
    variantStockByProduct.set(variant.product_id, current);
  }

  const salesByProduct = new Map<string, ProductSales>();
  const storeOrders = ((storeOrdersResult.data ?? []) as unknown as Array<Omit<RawOrder, "source">>).map((order) => ({
    ...order,
    source: "store_orders" as const
  }));

  for (const order of storeOrders) {
    parseStoreOrderItems(order, salesByProduct);
  }

  const draftOrders = ((draftOrdersResult.data ?? []) as unknown as Array<Omit<RawOrder, "source">>)
    .filter((order) => storeIds.includes(order.store_id ?? order.store_instance_id ?? ""))
    .map((order) => ({
      ...order,
      source: "orders" as const
    }));
  const activeDraftOrderIds = new Set(draftOrders.filter((order) => !isCancelledOrRefunded(order)).map((order) => order.id));

  for (const item of (orderItemsResult.data ?? []) as unknown as Array<{
    order_id?: string | null;
    price?: number | string | null;
    product_id?: string | null;
    quantity?: number | string | null;
    subtotal?: number | string | null;
    total_price?: number | string | null;
  }>) {
    if (!item.order_id || !activeDraftOrderIds.has(item.order_id) || !item.product_id || !productIds.has(item.product_id)) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(numericValue(item.quantity) || 1));
    addSales(salesByProduct, {
      productId: item.product_id,
      quantity,
      revenue: numericValue(item.subtotal ?? item.total_price) || numericValue(item.price) * quantity
    });
  }

  const reportProducts = products.map((product): ProductReportItem => {
    const sales = salesByProduct.get(product.id) ?? { quantitySold: 0, revenue: 0 };
    const variantStock = variantStockByProduct.get(product.id);
    const currentStock = product.track_inventory
      ? variantStock?.count
        ? variantStock.stock
        : numericValue(product.stock_quantity)
      : null;
    const lowStockThreshold = product.low_stock_threshold ?? 5;
    const isSoldOut = product.track_inventory === true && (product.inventory_status === "out_of_stock" || (currentStock ?? 0) <= 0);
    const isLowStock = product.track_inventory === true && !isSoldOut && currentStock !== null && currentStock <= lowStockThreshold;

    return {
      conversionRate: null,
      currentStock,
      inventoryStatus: product.inventory_status ?? "not_tracked",
      isLowStock,
      isSoldOut,
      productId: product.id,
      quantitySold: sales.quantitySold,
      revenue: sales.revenue,
      status: product.status ?? "unknown",
      title: product.name?.trim() || "Product",
      trackInventory: product.track_inventory === true,
      views: null
    };
  });

  return {
    activeStore,
    currency: "USD",
    errors,
    lowSellingProducts: [...reportProducts]
      .sort((left, right) => left.quantitySold - right.quantitySold || left.revenue - right.revenue)
      .slice(0, 10),
    lowStockProducts: reportProducts.filter((product) => product.isLowStock).sort((left, right) => (left.currentStock ?? 0) - (right.currentStock ?? 0)),
    productCount: reportProducts.length,
    products: reportProducts,
    range,
    soldOutProducts: reportProducts.filter((product) => product.isSoldOut),
    stores,
    topSellingProducts: [...reportProducts]
      .sort((left, right) => right.quantitySold - left.quantitySold || right.revenue - left.revenue)
      .slice(0, 10),
    totalQuantitySold: reportProducts.reduce((sum, product) => sum + product.quantitySold, 0),
    totalRevenue: reportProducts.reduce((sum, product) => sum + product.revenue, 0)
  };
}
