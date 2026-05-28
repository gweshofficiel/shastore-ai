import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

const customersPath = "/dashboard/customers";

type CustomerRow = {
  created_at: string;
  email?: string | null;
  first_order_at?: string | null;
  id: string;
  last_order_at?: string | null;
  last_order_id?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  status?: string | null;
  store_id: string;
  store_instance_id?: string | null;
  tags?: string[] | null;
  total_orders?: number | null;
  total_spent?: number | string | null;
  updated_at: string;
  workspace_id?: string | null;
};

type OrderRow = {
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  id: string;
  order_status: string;
  payment_status: string;
  source: "orders" | "store_orders";
  total: number | string;
};

type CustomersDashboardData = {
  activeStore: UserStoreRow | null;
  customerOrders: OrderRow[];
  customers: CustomerRow[];
  error: string | null;
  schemaIssue: string | null;
  selectedCustomer: CustomerRow | null;
  stores: UserStoreRow[];
};

function isMissingCustomersFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("customers") ||
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

function formatMoney(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD"
  }).format(numericValue(amount));
}

function formatDate(value: string | null) {
  if (!value) {
    return "No orders";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function customerHref(
  customer: CustomerRow,
  params: {
    q?: string;
    storeId?: string;
  }
) {
  const search = new URLSearchParams({
    customerId: customer.id,
    storeId: params.storeId ?? customer.store_id
  });

  if (params.q) {
    search.set("q", params.q);
  }

  return `${customersPath}?${search.toString()}`;
}

function customerDetailPath(customerId: string, storeId: string) {
  return `/dashboard/customers/${customerId}?storeId=${storeId}`;
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "");
}

function matchesCustomer(order: OrderRow, customer: CustomerRow) {
  const customerEmail = customer.email?.trim().toLowerCase() ?? "";
  const orderEmail = order.customer_email?.trim().toLowerCase() ?? "";
  const customerPhone = normalizePhone(customer.phone);
  const orderPhone = normalizePhone(order.customer_phone);

  return Boolean(
    (customerPhone && orderPhone && customerPhone === orderPhone) ||
      (customerEmail && orderEmail && customerEmail === orderEmail)
  );
}

async function getCustomersDashboardData({
  customerId,
  query = "",
  storeId
}: {
  customerId?: string;
  query?: string;
  storeId?: string;
}): Promise<CustomersDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      activeStore: null,
      customerOrders: [],
      customers: [],
      error: "We could not verify your session. Please sign in again.",
      schemaIssue: null,
      selectedCustomer: null,
      stores: []
    };
  }

  if (!user) {
    return {
      activeStore: null,
      customerOrders: [],
      customers: [],
      error: "Sign in to view customers.",
      schemaIssue: null,
      selectedCustomer: null,
      stores: []
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      customerOrders: [],
      customers: [],
      error: "Stores could not be loaded. Please try again.",
      schemaIssue: null,
      selectedCustomer: null,
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === storeId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      customerOrders: [],
      customers: [],
      error: null,
      schemaIssue: null,
      selectedCustomer: null,
      stores
    };
  }

  const [
    { data: customerRows, error: customersError },
    { data: storeOrderRows, error: storeOrdersError },
    { data: draftOrderRows, error: draftOrdersError }
  ] = await Promise.all([
    supabase
      .from("store_customers" as never)
      .select("id, workspace_id, store_id, name, email, phone, status, tags, total_orders, total_spent, first_order_at, last_order_at, last_order_id, created_at, updated_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("last_order_at" as never, { ascending: false } as never)
      .order("updated_at" as never, { ascending: false } as never),
    supabase
      .from("store_orders")
      .select("id, customer_name, customer_phone, customer_email, order_status, payment_status, total, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("orders" as never)
      .select("id, customer_name, customer_phone, customer_email, order_status, payment_status, total, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .or(`store_id.eq.${activeStore.id},store_instance_id.eq.${activeStore.id}` as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(150)
  ]);

  if (customersError || storeOrdersError || draftOrdersError) {
    const firstError = customersError ?? storeOrdersError ?? draftOrdersError;
    return {
      activeStore,
      customerOrders: [],
      customers: [],
      error: firstError && isMissingCustomersFoundation(firstError)
        ? null
        : "Customers could not be loaded. Please try again.",
      schemaIssue: firstError && isMissingCustomersFoundation(firstError)
        ? "Missing customers foundation: run the store customers management migration after the order migrations."
        : null,
      selectedCustomer: null,
      stores
    };
  }

  const orders = [
    ...((storeOrderRows ?? []) as unknown as Omit<OrderRow, "source">[]).map((order) => ({
      ...order,
      source: "store_orders" as const
    })),
    ...((draftOrderRows ?? []) as unknown as Omit<OrderRow, "source">[]).map((order) => ({
      ...order,
      source: "orders" as const
    }))
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const customers = ((customerRows ?? []) as unknown as CustomerRow[])
    .filter((customer) => {
      if (!normalizedQuery) {
        return true;
      }

      const hasMatchingOrderReference = orders.some(
        (order) =>
          matchesCustomer(order, customer) &&
          (order.id.toLowerCase().includes(normalizedQuery) ||
            order.id.slice(0, 8).toLowerCase().includes(normalizedQuery))
      );

      return (
        hasMatchingOrderReference ||
        [customer.name, customer.email, customer.phone, customer.status, ...(customer.tags ?? [])]
        .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      );
    });
  const selectedCustomer =
    customers.find((customer) => customer.id === customerId) ?? customers[0] ?? null;
  const customerOrders = selectedCustomer
    ? orders.filter((order) => matchesCustomer(order, selectedCustomer))
    : [];

  return (
    {
      activeStore,
      customerOrders,
      customers,
      error: null,
      schemaIssue: null,
      selectedCustomer,
      stores
    }
  );
}

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string; q?: string; storeId?: string }>;
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
      console.warn("[permission-denied] customers page denied", {
        permission: "can_view_customers",
        role,
        userId: user.id,
        workspaceId
      });

      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Store-scoped customers created from real order history."
            title="Customers"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view customers.
            </p>
          </Card>
        </div>
      );
    }
  }

  const { activeStore, customerOrders, customers, error, schemaIssue, selectedCustomer, stores } =
    await getCustomersDashboardData({
      customerId: params.customerId,
      query: params.q,
      storeId: params.storeId
    });

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Store-scoped customer records with contact details and order history for claimed stores."
        title="Customers"
      />

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </Card>
      ) : null}

      {schemaIssue ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">{schemaIssue}</p>
        </Card>
      ) : null}

      {!schemaIssue && stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No stores yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Customers are scoped by workspace stores. Create a store before reviewing customer records.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <Card className="grid gap-5 p-5 lg:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.name || activeStore.store_name || "Store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Only customers for this store are visible.
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
                      {store.name || store.store_name || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View customers
              </Button>
            </form>
          </div>

          <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <input name="storeId" type="hidden" value={activeStore.id} />
            <Input
              defaultValue={params.q}
              id="q"
              label="Search customers"
              name="q"
              placeholder="Search by name, email, phone, status, tag, or order reference"
            />
            <Button type="submit">Search</Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <section className="grid gap-4">
            {customers.length ? (
              customers.map((customer) => (
                <Card
                  className={`grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 lg:grid-cols-[minmax(0,1fr)_auto] ${
                    selectedCustomer?.id === customer.id ? "border-slate-400" : ""
                  }`}
                  key={customer.id}
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black tracking-[-0.02em] text-ink">
                      {customer.name}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {[customer.email, customer.phone].filter(Boolean).join(" | ") ||
                        "No contact details"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {customer.total_orders ?? 0} orders
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        Last order {formatDate(customer.last_order_at ?? null)}
                      </span>
                      {customer.status ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                          {customer.status}
                        </span>
                      ) : null}
                      {(customer.tags ?? []).map((tag) => (
                        <span
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:justify-end">
                    <div className="text-right">
                      <p className="text-sm font-bold text-muted">Total spent</p>
                      <p className="text-xl font-black text-ink">
                        {formatMoney(customer.total_spent ?? 0)}
                      </p>
                    </div>
                    <ButtonLink
                      href={customerHref(customer, {
                        q: params.q,
                        storeId: activeStore.id
                      })}
                      variant="secondary"
                    >
                      Details
                    </ButtonLink>
                    <ButtonLink href={customerDetailPath(customer.id, activeStore.id)} variant="secondary">
                      Open
                    </ButtonLink>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
                  No customers yet
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
                  Customer records will appear here after real orders create customer profiles.
                </p>
              </Card>
            )}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="grid gap-5 p-5 lg:p-6">
              {selectedCustomer ? (
                <>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Customer Details
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                      {selectedCustomer.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {[selectedCustomer.email, selectedCustomer.phone]
                        .filter(Boolean)
                        .join(" | ") || "No contact details"}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Customer status
                      </p>
                      <p className="mt-1 font-black text-ink">
                        {selectedCustomer.status || "active"}
                      </p>
                    </div>
                    {(selectedCustomer.tags ?? []).length ? (
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Tags
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(selectedCustomer.tags ?? []).map((tag) => (
                            <span
                              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Orders
                        </p>
                        <p className="mt-1 font-black text-ink">
                          {selectedCustomer.total_orders ?? 0}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Total
                        </p>
                        <p className="mt-1 font-black text-ink">
                          {formatMoney(selectedCustomer.total_spent ?? 0)}
                        </p>
                      </div>
                    </div>
                    {selectedCustomer.notes ? (
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Notes
                        </p>
                        <p className="mt-1 leading-6 text-ink">{selectedCustomer.notes}</p>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Order History
                    </p>
                    <div className="mt-3 grid gap-3">
                      {customerOrders.length ? (
                        customerOrders.map((order) => (
                          <div
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                            key={order.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                  {order.id.slice(0, 8).toUpperCase()}
                                </p>
                                <p className="mt-2 font-black text-ink">
                                  {formatMoney(order.total)}
                                </p>
                              </div>
                              <ButtonLink
                                href={`/dashboard/orders/${order.id}?source=${order.source}`}
                                variant="secondary"
                              >
                                Open
                              </ButtonLink>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                {order.order_status}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                {order.payment_status}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                {formatDate(order.created_at)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">
                          No orders are linked to this customer yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                    Select a customer
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Contact details and order history appear here.
                  </p>
                </div>
              )}
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
