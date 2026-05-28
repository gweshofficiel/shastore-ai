import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ storeId?: string }>;
};

type CustomerRow = {
  email: string | null;
  first_order_at: string | null;
  id: string;
  last_order_at: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
  status: string | null;
  store_id: string;
  total_orders: number | null;
  total_spent: number | string | null;
  workspace_id: string | null;
};

type OrderRow = {
  created_at: string;
  customer_email: string | null;
  customer_phone: string | null;
  id: string;
  order_status: string | null;
  payment_status: string | null;
  source: "orders" | "store_orders";
  total: number | string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
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

function formatMoney(amount: number | string | null | undefined) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    style: "currency"
  }).format(numericValue(amount));
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

export default async function CustomerDetailPage({ params, searchParams }: CustomerDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          action={<ButtonLink href="/dashboard/customers">Back</ButtonLink>}
          description="Customer order history and contact details from real store orders."
          title="Customer"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">Sign in to view customers.</p>
        </Card>
      </div>
    );
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "can_view_customers")) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          action={<ButtonLink href="/dashboard/customers">Back</ButtonLink>}
          description="Customer access is assigned by workspace role."
          title="Customer"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            You do not have permission to view customers.
          </p>
        </Card>
      </div>
    );
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const storeIds = stores.map((store) => store.id);
  const { data: customerData, error: customerError } = await supabase
    .from("customers" as never)
    .select("id, workspace_id, store_id, name, email, phone, status, total_orders, total_spent, first_order_at, last_order_at, notes")
    .eq("id" as never, id as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const customer = customerData as unknown as CustomerRow | null;

  if (storesError || customerError || !customer || !storeIds.includes(customer.store_id)) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          action={<ButtonLink href="/dashboard/customers">Back to customers</ButtonLink>}
          description="Customer order history and contact details from real store orders."
          title="Customer not available"
        />
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">
            This customer may not exist, or it may belong to another workspace store.
          </p>
        </Card>
      </div>
    );
  }

  const activeStoreId = query.storeId && storeIds.includes(query.storeId) ? query.storeId : customer.store_id;
  const [{ data: storeOrderRows }, { data: draftOrderRows }] = await Promise.all([
    supabase
      .from("store_orders")
      .select("id, customer_phone, customer_email, order_status, payment_status, total, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("orders" as never)
      .select("id, customer_phone, customer_email, order_status, payment_status, total, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .or(`store_id.eq.${activeStoreId},store_instance_id.eq.${activeStoreId}` as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(150)
  ]);
  const orders = [
    ...((storeOrderRows ?? []) as unknown as Omit<OrderRow, "source">[]).map((order) => ({
      ...order,
      source: "store_orders" as const
    })),
    ...((draftOrderRows ?? []) as unknown as Omit<OrderRow, "source">[]).map((order) => ({
      ...order,
      source: "orders" as const
    }))
  ].filter((order) => matchesCustomer(order, customer));
  const store = stores.find((item) => item.id === activeStoreId);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href={`/dashboard/customers?storeId=${activeStoreId}`}>Back to customers</ButtonLink>}
        description={`Real customer profile for ${store?.name ?? "this store"}.`}
        title={customer.name}
      />
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Profile
          </p>
          <div className="mt-5 grid gap-4 text-sm">
            <div>
              <p className="font-bold text-muted">Email</p>
              <p className="mt-1 font-semibold text-ink">{customer.email ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Phone</p>
              <p className="mt-1 font-semibold text-ink">{customer.phone ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Status</p>
              <p className="mt-1 font-semibold text-ink">{customer.status ?? "active"}</p>
            </div>
            <div>
              <p className="font-bold text-muted">First order</p>
              <p className="mt-1 font-semibold text-ink">{formatDate(customer.first_order_at)}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Last order</p>
              <p className="mt-1 font-semibold text-ink">{formatDate(customer.last_order_at)}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Orders</p>
              <p className="mt-1 text-2xl font-black text-ink">{customer.total_orders ?? orders.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Total spent</p>
              <p className="mt-1 text-2xl font-black text-ink">{formatMoney(customer.total_spent)}</p>
            </div>
          </div>
          {customer.notes ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              {customer.notes}
            </div>
          ) : null}
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Order history
          </p>
          <div className="mt-5 grid gap-3">
            {orders.length ? (
              orders.map((order) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={order.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm font-black text-ink">
                      {formatMoney(order.total)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {order.order_status ?? "pending"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {order.payment_status ?? "pending"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {formatDate(order.created_at)}
                    </span>
                    <ButtonLink href={`/dashboard/orders/${order.id}?source=${order.source}`} variant="secondary">
                      Open order
                    </ButtonLink>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No orders are linked to this customer yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
