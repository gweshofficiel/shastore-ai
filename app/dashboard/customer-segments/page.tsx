import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CustomerRow = {
  created_at: string;
  email?: string | null;
  id: string;
  last_order_at?: string | null;
  name?: string | null;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  phone?: string | null;
  segment?: string | null;
  total_orders?: number | null;
  total_spent?: number | string | null;
  updated_at: string;
};

type OrderIdentity = {
  created_at: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  id: string;
  items?: unknown;
  source: "orders" | "store_orders";
};

type CustomerSegmentSummary = {
  count: number;
  description: string;
  key: string;
  lastUpdated: string | null;
  name: string;
  preparation: string;
};

type SegmentsDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  schemaIssue: string | null;
  segments: CustomerSegmentSummary[];
  stores: UserStoreRow[];
};

const segmentDefinitions = [
  {
    description: "Customers with one or fewer completed customer records, based on real store customer/order totals.",
    key: "new_customers",
    name: "New customers",
    preparation: "Welcome flows, first-purchase offers, onboarding emails"
  },
  {
    description: "Customers with repeat order behavior.",
    key: "returning_customers",
    name: "Returning customers",
    preparation: "Retention campaigns, loyalty reminders, cross-sell recommendations"
  },
  {
    description: "High-value customers using existing VIP segment, order count, or spend thresholds.",
    key: "vip_customers",
    name: "VIP customers",
    preparation: "VIP discounts, early access, loyalty tiers"
  },
  {
    description: "Customers with at least one real order recorded for this store.",
    key: "customers_with_orders",
    name: "Customers with orders",
    preparation: "Post-purchase campaigns, order analytics, loyalty accrual"
  },
  {
    description: "Customer profiles without real order history yet.",
    key: "customers_without_orders",
    name: "Customers without orders",
    preparation: "Activation campaigns, first-order discounts, lead nurturing"
  },
  {
    description: "Customers whose orders include digital products or license/download delivery.",
    key: "digital_product_customers",
    name: "Digital product customers",
    preparation: "Download follow-ups, license reminders, digital product analytics"
  }
] as const;

function isMissingSegmentsFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("store_customers") ||
    message.includes("orders") ||
    message.includes("could not find")
  );
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

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function identityKeys(input: {
  customer_email?: string | null;
  customer_phone?: string | null;
  email?: string | null;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  phone?: string | null;
}) {
  const keys = new Set<string>();
  const phone = input.normalized_phone || normalizePhone(input.phone ?? input.customer_phone);
  const email = input.normalized_email || normalizeEmail(input.email ?? input.customer_email);

  if (phone) {
    keys.add(`phone:${phone}`);
  }

  if (email) {
    keys.add(`email:${email}`);
  }

  return keys;
}

function jsonItems(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function storeOrderHasDigitalItems(value: unknown) {
  return jsonItems(value).some((item) => (
    item.productType === "digital" ||
    item.product_type === "digital" ||
    item.digitalDeliveryStatus === "pending" ||
    item.digitalDeliveryStatus === "ready" ||
    item.digitalFileName
  ));
}

function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function formatDate(value: string | null) {
  if (!value) {
    return "No updates yet";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function buildSegments({
  customers,
  digitalOrderIdentities,
  orderIdentities
}: {
  customers: CustomerRow[];
  digitalOrderIdentities: OrderIdentity[];
  orderIdentities: OrderIdentity[];
}) {
  const orderKeys = new Set<string>();
  const digitalOrderKeys = new Set<string>();
  const orderDatesByKey = new Map<string, string[]>();
  const digitalDatesByKey = new Map<string, string[]>();

  for (const order of orderIdentities) {
    for (const key of identityKeys(order)) {
      orderKeys.add(key);
      orderDatesByKey.set(key, [...(orderDatesByKey.get(key) ?? []), order.created_at]);
    }
  }

  for (const order of digitalOrderIdentities) {
    for (const key of identityKeys(order)) {
      digitalOrderKeys.add(key);
      digitalDatesByKey.set(key, [...(digitalDatesByKey.get(key) ?? []), order.created_at]);
    }
  }

  function hasAnyOrder(customer: CustomerRow) {
    if ((customer.total_orders ?? 0) > 0) {
      return true;
    }

    return [...identityKeys(customer)].some((key) => orderKeys.has(key));
  }

  function hasDigitalOrder(customer: CustomerRow) {
    return [...identityKeys(customer)].some((key) => digitalOrderKeys.has(key));
  }

  function customerOrderDates(customer: CustomerRow) {
    return [...identityKeys(customer)].flatMap((key) => orderDatesByKey.get(key) ?? []);
  }

  function customerDigitalDates(customer: CustomerRow) {
    return [...identityKeys(customer)].flatMap((key) => digitalDatesByKey.get(key) ?? []);
  }

  const groups: Record<(typeof segmentDefinitions)[number]["key"], CustomerRow[]> = {
    customers_with_orders: customers.filter(hasAnyOrder),
    customers_without_orders: customers.filter((customer) => !hasAnyOrder(customer)),
    digital_product_customers: customers.filter(hasDigitalOrder),
    new_customers: customers.filter((customer) => (customer.segment ?? "new") === "new" || (customer.total_orders ?? 0) <= 1),
    returning_customers: customers.filter((customer) => (customer.segment === "returning" || (customer.total_orders ?? 0) >= 2) && customer.segment !== "vip"),
    vip_customers: customers.filter((customer) => customer.segment === "vip" || (customer.total_orders ?? 0) >= 10 || numericValue(customer.total_spent) >= 1000)
  };

  return segmentDefinitions.map((definition): CustomerSegmentSummary => {
    const segmentCustomers = groups[definition.key];
    const orderDates = definition.key === "digital_product_customers"
      ? segmentCustomers.flatMap(customerDigitalDates)
      : segmentCustomers.flatMap(customerOrderDates);

    return {
      count: segmentCustomers.length,
      description: definition.description,
      key: definition.key,
      lastUpdated: latestDate([
        ...segmentCustomers.map((customer) => customer.updated_at ?? customer.created_at),
        ...segmentCustomers.map((customer) => customer.last_order_at),
        ...orderDates
      ]),
      name: definition.name,
      preparation: definition.preparation
    };
  });
}

async function getSegmentsDashboardData(selectedStoreId?: string): Promise<SegmentsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      activeStore: null,
      error: "We could not verify your session. Please sign in again.",
      schemaIssue: null,
      segments: [],
      stores: []
    };
  }

  if (!user) {
    return {
      activeStore: null,
      error: "Sign in to view customer segments.",
      schemaIssue: null,
      segments: [],
      stores: []
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      schemaIssue: null,
      segments: [],
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      schemaIssue: null,
      segments: [],
      stores
    };
  }

  const [
    { data: customerRows, error: customersError },
    { data: storeOrderRows, error: storeOrdersError },
    { data: draftOrderRows, error: draftOrdersError },
    { data: digitalOrderItems, error: digitalOrderItemsError }
  ] = await Promise.all([
    supabase
      .from("store_customers" as never)
      .select("id, name, email, phone, normalized_email, normalized_phone, segment, total_orders, total_spent, last_order_at, created_at, updated_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never),
    supabase
      .from("store_orders")
      .select("id, customer_phone, customer_email, items, has_digital_items, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .limit(500),
    supabase
      .from("orders" as never)
      .select("id, customer_phone, customer_email, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .or(`store_id.eq.${activeStore.id},store_instance_id.eq.${activeStore.id}`)
      .limit(500),
    supabase
      .from("order_items" as never)
      .select("order_id, product_type")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .eq("product_type" as never, "digital" as never)
      .limit(500)
  ]);

  if (digitalOrderItemsError) {
    console.warn("[customer-segments] digital order item lookup skipped", {
      code: digitalOrderItemsError.code,
      message: digitalOrderItemsError.message
    });
  }

  const firstError = customersError ?? storeOrdersError ?? draftOrdersError;
  if (firstError) {
    return {
      activeStore,
      error: firstError && isMissingSegmentsFoundation(firstError)
        ? null
        : "Customer segments could not be loaded. Please try again.",
      schemaIssue: firstError && isMissingSegmentsFoundation(firstError)
        ? "Missing customers foundation: run the store customer/order migrations."
        : null,
      segments: [],
      stores
    };
  }

  const digitalOrderIds = new Set(
    ((digitalOrderItems ?? []) as unknown as Array<{ order_id?: string | null }>)
      .map((item) => item.order_id)
      .filter(Boolean) as string[]
  );
  const storeOrders = ((storeOrderRows ?? []) as unknown as Array<{
    created_at: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    has_digital_items?: boolean | null;
    id: string;
    items?: unknown;
  }>).map((order): OrderIdentity => ({
    created_at: order.created_at,
    customer_email: order.customer_email ?? null,
    customer_phone: order.customer_phone ?? null,
    id: order.id,
    items: order.items,
    source: "store_orders"
  }));
  const draftOrders = ((draftOrderRows ?? []) as unknown as Array<{
    created_at: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    id: string;
  }>).map((order): OrderIdentity => ({
    created_at: order.created_at,
    customer_email: order.customer_email ?? null,
    customer_phone: order.customer_phone ?? null,
    id: order.id,
    source: "orders"
  }));
  const digitalStoreOrders = storeOrders.filter((order) => {
    const row = (storeOrderRows ?? []).find((candidate) => (candidate as { id?: string }).id === order.id) as { has_digital_items?: boolean | null; items?: unknown } | undefined;
    return row?.has_digital_items === true || storeOrderHasDigitalItems(row?.items);
  });
  const digitalDraftOrders = draftOrders.filter((order) => digitalOrderIds.has(order.id));

  return {
    activeStore,
    error: null,
    schemaIssue: null,
    segments: buildSegments({
      customers: (customerRows ?? []) as unknown as CustomerRow[],
      digitalOrderIdentities: [...digitalStoreOrders, ...digitalDraftOrders],
      orderIdentities: [...storeOrders, ...draftOrders]
    }),
    stores
  };
}

export default async function CustomerSegmentsPage({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "can_view_customers")) {
      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Customer segment access is assigned by workspace role."
            title="Customer Segments"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view customer segments.
            </p>
          </Card>
        </div>
      );
    }
  }

  const { activeStore, error, schemaIssue, segments, stores } = await getSegmentsDashboardData(params.storeId);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Store-scoped customer groups based on real customer, order, and digital product behavior."
        title="Customer Segments"
      />

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {schemaIssue ? (
        <Card className="border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-bold text-amber-900">{schemaIssue}</p>
        </Card>
      ) : null}

      {!schemaIssue && stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores in this workspace yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before viewing customer segments.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Active Store</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.name || activeStore.store_name || "Store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Segments are calculated only from this store&apos;s customers and orders.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Switch store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name || store.store_name || store.slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View segments
              </Button>
            </form>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((segment) => (
              <Card className="grid gap-4 p-5" key={segment.key}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Default segment</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{segment.name}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
                    {segment.count}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-6 text-muted">{segment.description}</p>
                <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Customer count</p>
                    <p className="mt-1 text-2xl font-black text-ink">{segment.count}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Last updated</p>
                    <p className="mt-1 font-bold text-ink">{formatDate(segment.lastUpdated)}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Future use</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">{segment.preparation}</p>
                </div>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
