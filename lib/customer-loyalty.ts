import type { SupabaseClient } from "@supabase/supabase-js";

export type LoyaltyHistoryEntry = {
  createdAt: string;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  orderId: string;
  orderReference: string;
  orderSource: "orders" | "store_orders";
  points: number;
  total: number;
};

export type LoyaltyCustomerSummary = {
  customerId: string | null;
  email: string | null;
  lastEarnedAt: string | null;
  name: string;
  phone: string | null;
  points: number;
};

export type LoyaltyOverview = {
  history: LoyaltyHistoryEntry[];
  topCustomers: LoyaltyCustomerSummary[];
  totalCustomersWithPoints: number;
  totalPointsIssued: number;
};

type CustomerIdentity = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  phone?: string | null;
};

type OrderRow = {
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  id: string;
  order_status?: string | null;
  payment_status?: string | null;
  store_id?: string | null;
  store_instance_id?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
};

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
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

export function loyaltyPointsForAmount(value: number | string | null | undefined) {
  return Math.max(0, Math.floor(numericValue(value)));
}

export function loyaltyOrderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function identityKeys(input: CustomerIdentity | OrderRow) {
  const keys = new Set<string>();
  const customerInput = input as CustomerIdentity;
  const orderInput = input as OrderRow;
  const rawPhone = customerInput.phone ?? orderInput.customer_phone;
  const rawEmail = customerInput.email ?? orderInput.customer_email;
  const phone = "normalized_phone" in input && input.normalized_phone
    ? input.normalized_phone
    : normalizePhone(rawPhone);
  const email = "normalized_email" in input && input.normalized_email
    ? input.normalized_email
    : normalizeEmail(rawEmail);

  if (phone) {
    keys.add(`phone:${phone}`);
  }

  if (email) {
    keys.add(`email:${email}`);
  }

  return keys;
}

function completedOrder(order: OrderRow) {
  const orderStatus = String(order.order_status ?? "").toLowerCase();
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();

  return (
    ["paid", "captured", "succeeded", "completed"].includes(paymentStatus) ||
    ["paid", "completed", "fulfilled", "delivered"].includes(orderStatus)
  );
}

function historyEntry(order: OrderRow, source: "orders" | "store_orders"): LoyaltyHistoryEntry | null {
  if (!completedOrder(order)) {
    return null;
  }

  const total = numericValue(order.total_amount ?? order.total);
  const points = loyaltyPointsForAmount(total);

  if (points <= 0) {
    return null;
  }

  return {
    createdAt: order.created_at,
    customerEmail: order.customer_email ?? null,
    customerName: order.customer_name?.trim() || "Customer",
    customerPhone: order.customer_phone ?? null,
    orderId: order.id,
    orderReference: loyaltyOrderReference(order.id),
    orderSource: source,
    points,
    total
  };
}

export async function loadStoreLoyaltyOverview({
  storeId,
  supabase,
  workspaceId
}: {
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}): Promise<LoyaltyOverview> {
  const [customersResult, storeOrdersResult, draftOrdersResult] = await Promise.all([
    supabase
      .from("store_customers" as never)
      .select("id, name, email, phone, normalized_email, normalized_phone")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never),
    supabase
      .from("store_orders")
      .select("id, customer_name, customer_phone, customer_email, order_status, payment_status, total, total_amount, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("orders" as never)
      .select("id, store_id, store_instance_id, customer_name, customer_phone, customer_email, order_status, payment_status, total, total_amount, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .or(`store_id.eq.${storeId},store_instance_id.eq.${storeId}`)
      .order("created_at" as never, { ascending: false } as never)
      .limit(500)
  ]);

  if (customersResult.error || storeOrdersResult.error || draftOrdersResult.error) {
    console.warn("[loyalty] overview load failed", {
      customersError: customersResult.error?.message,
      draftOrdersError: draftOrdersResult.error?.message,
      storeOrdersError: storeOrdersResult.error?.message
    });
  }

  const customers = (customersResult.data ?? []) as unknown as CustomerIdentity[];
  const customersByKey = new Map<string, CustomerIdentity>();

  for (const customer of customers) {
    for (const key of identityKeys(customer)) {
      customersByKey.set(key, customer);
    }
  }

  const history = [
    ...((storeOrdersResult.data ?? []) as unknown as OrderRow[]).map((order) => historyEntry(order, "store_orders")),
    ...((draftOrdersResult.data ?? []) as unknown as OrderRow[]).map((order) => historyEntry(order, "orders"))
  ]
    .filter((entry): entry is LoyaltyHistoryEntry => Boolean(entry))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const customerPoints = new Map<string, LoyaltyCustomerSummary>();

  for (const entry of history) {
    const keys = identityKeys({
      customer_email: entry.customerEmail,
      customer_phone: entry.customerPhone
    } as OrderRow);
    const primaryKey = [...keys][0] ?? `order:${entry.orderSource}:${entry.orderId}`;
    const customer = [...keys].map((key) => customersByKey.get(key)).find(Boolean) ?? null;
    const current = customerPoints.get(primaryKey) ?? {
      customerId: customer?.id ?? null,
      email: customer?.email ?? entry.customerEmail,
      lastEarnedAt: null,
      name: customer?.name?.trim() || entry.customerName,
      phone: customer?.phone ?? entry.customerPhone,
      points: 0
    };

    current.points += entry.points;
    current.lastEarnedAt = current.lastEarnedAt && new Date(current.lastEarnedAt) > new Date(entry.createdAt)
      ? current.lastEarnedAt
      : entry.createdAt;
    customerPoints.set(primaryKey, current);
  }

  const topCustomers = [...customerPoints.values()]
    .filter((customer) => customer.points > 0)
    .sort((left, right) => right.points - left.points || new Date(right.lastEarnedAt ?? 0).getTime() - new Date(left.lastEarnedAt ?? 0).getTime())
    .slice(0, 10);

  return {
    history,
    topCustomers,
    totalCustomersWithPoints: [...customerPoints.values()].filter((customer) => customer.points > 0).length,
    totalPointsIssued: history.reduce((total, entry) => total + entry.points, 0)
  };
}

export async function loadCustomerLoyalty({
  phone,
  storeId,
  supabase,
  workspaceId
}: {
  phone: string;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string | null;
}) {
  if (!workspaceId || !normalizePhone(phone)) {
    return {
      history: [],
      points: 0
    };
  }

  const overview = await loadStoreLoyaltyOverview({ storeId, supabase, workspaceId });
  const lookupPhone = normalizePhone(phone);
  const history = overview.history.filter((entry) => normalizePhone(entry.customerPhone) === lookupPhone);

  return {
    history,
    points: history.reduce((total, entry) => total + entry.points, 0)
  };
}
