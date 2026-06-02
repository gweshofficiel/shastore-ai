import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStoreRow } from "@/lib/stores/user-stores";
import {
  numericValue,
  resolveAnalyticsRange,
  type AdvancedAnalyticsPeriod,
  type AdvancedAnalyticsRange
} from "@/lib/store-analytics-advanced";

export type CustomerReportItem = {
  customerId: string | null;
  email: string | null;
  firstOrderAt: string | null;
  isInactive: boolean;
  isNew: boolean;
  isReturning: boolean;
  lastOrderAt: string | null;
  lifetimeValue: number;
  name: string;
  phone: string | null;
  rangeOrders: number;
  rangeRevenue: number;
  totalOrders: number;
  totalSpent: number;
};

export type CustomerReportData = {
  activeStore: UserStoreRow | null;
  averageLifetimeValue: number;
  currency: string;
  customerCount: number;
  customers: CustomerReportItem[];
  errors: string[];
  inactiveCustomers: CustomerReportItem[];
  newCustomers: CustomerReportItem[];
  range: AdvancedAnalyticsRange;
  returningCustomers: CustomerReportItem[];
  stores: UserStoreRow[];
  topCustomersByOrders: CustomerReportItem[];
  topCustomersByRevenue: CustomerReportItem[];
  totalOrders: number;
  totalSpent: number;
};

type CustomerRow = {
  email?: string | null;
  first_order_at?: string | null;
  id: string;
  last_order_at?: string | null;
  name?: string | null;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  phone?: string | null;
  store_id?: string | null;
  total_orders?: number | string | null;
  total_spent?: number | string | null;
};

type RawOrder = {
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  id: string;
  order_status?: string | null;
  payment_status?: string | null;
  source: "orders" | "store_orders";
  store_id?: string | null;
  store_instance_id?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
};

type CustomerAccumulator = {
  customerId: string | null;
  email: string | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  name: string;
  phone: string | null;
  rangeOrders: number;
  rangeRevenue: number;
  totalOrders: number;
  totalSpent: number;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  return value?.replace(/[^0-9+]/g, "") || null;
}

function customerKey(input: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  storeId?: string | null;
}) {
  const storeId = input.storeId ?? "store";
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if (email) {
    return `${storeId}:email:${email}`;
  }

  if (phone) {
    return `${storeId}:phone:${phone}`;
  }

  return `${storeId}:name:${input.name?.trim().toLowerCase() || "customer"}`;
}

function isCancelledOrRefunded(order: RawOrder) {
  return [order.order_status, order.payment_status].some((status) => {
    const normalized = status?.toLowerCase();
    return normalized === "cancelled" || normalized === "canceled" || normalized === "refunded";
  });
}

function orderTotal(order: RawOrder) {
  return numericValue(order.total_amount ?? order.total);
}

function dateInRange(value: string | null | undefined, range: AdvancedAnalyticsRange) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function formatFallbackDate(value: string | null, candidate: string) {
  if (!value) {
    return candidate;
  }

  return new Date(candidate).getTime() < new Date(value).getTime() ? candidate : value;
}

function latestDate(value: string | null, candidate: string) {
  if (!value) {
    return candidate;
  }

  return new Date(candidate).getTime() > new Date(value).getTime() ? candidate : value;
}

function toReportItem(customer: CustomerAccumulator, range: AdvancedAnalyticsRange): CustomerReportItem {
  const firstOrderInRange = dateInRange(customer.firstOrderAt, range);
  const lastOrderBeforeRange = customer.lastOrderAt ? new Date(customer.lastOrderAt).getTime() < range.start.getTime() : true;

  return {
    customerId: customer.customerId,
    email: customer.email,
    firstOrderAt: customer.firstOrderAt,
    isInactive: lastOrderBeforeRange,
    isNew: firstOrderInRange,
    isReturning: customer.rangeOrders > 0 && !firstOrderInRange,
    lastOrderAt: customer.lastOrderAt,
    lifetimeValue: customer.totalSpent,
    name: customer.name,
    phone: customer.phone,
    rangeOrders: customer.rangeOrders,
    rangeRevenue: customer.rangeRevenue,
    totalOrders: customer.totalOrders,
    totalSpent: customer.totalSpent
  };
}

export function customerReportHref({
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

  return `/dashboard/reports/customers?${params.toString()}`;
}

export async function loadCustomerReport({
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
}): Promise<CustomerReportData> {
  const range = resolveAnalyticsRange({ from, period, to });
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const storeIds = activeStore ? [activeStore.id] : stores.map((store) => store.id);
  const errors: string[] = [];

  if (!storeIds.length) {
    return {
      activeStore,
      averageLifetimeValue: 0,
      currency: "USD",
      customerCount: 0,
      customers: [],
      errors,
      inactiveCustomers: [],
      newCustomers: [],
      range,
      returningCustomers: [],
      stores,
      topCustomersByOrders: [],
      topCustomersByRevenue: [],
      totalOrders: 0,
      totalSpent: 0
    };
  }

  let customersQuery = supabase
    .from("store_customers" as never)
    .select("id, store_id, name, email, phone, normalized_email, normalized_phone, total_orders, total_spent, first_order_at, last_order_at")
    .eq("workspace_id" as never, workspaceId as never)
    .order("last_order_at" as never, { ascending: false, nullsFirst: false } as never)
    .limit(2000);
  let storeOrdersQuery = supabase
    .from("store_orders")
    .select("id, store_id, customer_name, customer_phone, customer_email, total, total_amount, payment_status, order_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .limit(1000);
  let draftOrdersQuery = supabase
    .from("orders" as never)
    .select("id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, total_amount, payment_status, order_status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .gte("created_at" as never, range.start.toISOString() as never)
    .lte("created_at" as never, range.end.toISOString() as never)
    .limit(1000);

  if (storeIds.length) {
    customersQuery = customersQuery.in("store_id" as never, storeIds as never);
    storeOrdersQuery = storeOrdersQuery.in("store_id", storeIds);
    draftOrdersQuery = draftOrdersQuery.or(`store_id.in.(${storeIds.join(",")}),store_instance_id.in.(${storeIds.join(",")})` as never);
  }

  const [customersResult, storeOrdersResult, draftOrdersResult] = await Promise.all([
    customersQuery,
    storeOrdersQuery,
    draftOrdersQuery
  ]);

  if (customersResult.error) {
    errors.push("Customers could not be loaded.");
  }

  if (storeOrdersResult.error) {
    errors.push("Store order customer activity could not be loaded.");
  }

  if (draftOrdersResult.error) {
    errors.push("Draft order customer activity could not be loaded.");
  }

  const customerMap = new Map<string, CustomerAccumulator>();

  for (const customer of (customersResult.data ?? []) as unknown as CustomerRow[]) {
    const key = customerKey({
      email: customer.normalized_email ?? customer.email,
      name: customer.name,
      phone: customer.normalized_phone ?? customer.phone,
      storeId: customer.store_id
    });

    customerMap.set(key, {
      customerId: customer.id,
      email: customer.email ?? customer.normalized_email ?? null,
      firstOrderAt: customer.first_order_at ?? null,
      lastOrderAt: customer.last_order_at ?? null,
      name: customer.name?.trim() || "Customer",
      phone: customer.phone ?? customer.normalized_phone ?? null,
      rangeOrders: 0,
      rangeRevenue: 0,
      totalOrders: Math.max(0, Math.floor(numericValue(customer.total_orders))),
      totalSpent: numericValue(customer.total_spent)
    });
  }

  const orders: RawOrder[] = [
    ...((storeOrdersResult.data ?? []) as unknown as Array<Omit<RawOrder, "source">>).map((order) => ({
      ...order,
      source: "store_orders" as const
    })),
    ...((draftOrdersResult.data ?? []) as unknown as Array<Omit<RawOrder, "source">>)
      .filter((order) => storeIds.includes(order.store_id ?? order.store_instance_id ?? ""))
      .map((order) => ({
        ...order,
        source: "orders" as const
      }))
  ];

  for (const order of orders) {
    const rowStoreId = order.store_id ?? order.store_instance_id ?? null;
    const key = customerKey({
      email: order.customer_email,
      name: order.customer_name,
      phone: order.customer_phone,
      storeId: rowStoreId
    });
    const existing = customerMap.get(key);
    const orderRevenue = isCancelledOrRefunded(order) ? 0 : orderTotal(order);
    const customer = existing ?? {
      customerId: null,
      email: normalizeEmail(order.customer_email),
      firstOrderAt: order.created_at,
      lastOrderAt: order.created_at,
      name: order.customer_name?.trim() || "Customer",
      phone: normalizePhone(order.customer_phone),
      rangeOrders: 0,
      rangeRevenue: 0,
      totalOrders: 0,
      totalSpent: 0
    };

    customer.rangeOrders += 1;
    customer.rangeRevenue += orderRevenue;
    customer.totalOrders = Math.max(customer.totalOrders, customer.rangeOrders);
    customer.totalSpent = Math.max(customer.totalSpent, customer.rangeRevenue);
    customer.firstOrderAt = formatFallbackDate(customer.firstOrderAt, order.created_at);
    customer.lastOrderAt = latestDate(customer.lastOrderAt, order.created_at);
    customerMap.set(key, customer);
  }

  const customers = [...customerMap.values()].map((customer) => toReportItem(customer, range));
  const activeCustomers = customers.filter((customer) => customer.rangeOrders > 0);
  const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);

  return {
    activeStore,
    averageLifetimeValue: customers.length ? totalSpent / customers.length : 0,
    currency: "USD",
    customerCount: customers.length,
    customers,
    errors,
    inactiveCustomers: customers
      .filter((customer) => customer.isInactive)
      .sort((left, right) => (left.lastOrderAt ?? "").localeCompare(right.lastOrderAt ?? ""))
      .slice(0, 10),
    newCustomers: customers
      .filter((customer) => customer.isNew)
      .sort((left, right) => (right.firstOrderAt ?? "").localeCompare(left.firstOrderAt ?? ""))
      .slice(0, 10),
    range,
    returningCustomers: customers
      .filter((customer) => customer.isReturning)
      .sort((left, right) => right.rangeRevenue - left.rangeRevenue)
      .slice(0, 10),
    stores,
    topCustomersByOrders: [...activeCustomers]
      .sort((left, right) => right.rangeOrders - left.rangeOrders || right.rangeRevenue - left.rangeRevenue)
      .slice(0, 10),
    topCustomersByRevenue: [...activeCustomers]
      .sort((left, right) => right.rangeRevenue - left.rangeRevenue || right.rangeOrders - left.rangeOrders)
      .slice(0, 10),
    totalOrders: customers.reduce((sum, customer) => sum + customer.totalOrders, 0),
    totalSpent
  };
}
