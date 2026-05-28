import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveStoreCustomerDetails } from "@/lib/customer-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ customer?: string; storeId?: string }>;
};

type CustomerRow = {
  email: string | null;
  first_order_at: string | null;
  id: string;
  last_order_at: string | null;
  loyalty_points?: number | null;
  loyalty_tier?: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
  segment?: string | null;
  status: string | null;
  store_id: string;
  tags?: string[] | null;
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

type AddressRow = {
  address_line1: string;
  address_line2?: string | null;
  city?: string | null;
  country?: string | null;
  created_at: string;
  full_name?: string | null;
  id: string;
  is_default?: boolean | null;
  phone?: string | null;
  postal_code?: string | null;
  region?: string | null;
};

type CustomerNoteRow = {
  created_at: string;
  id: string;
  note: string;
  tags?: string[] | null;
};

type ReviewRow = {
  comment: string;
  created_at: string;
  id: string;
  product_id: string;
  rating: number;
  status: string;
  title?: string | null;
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

function customerMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "invalid-status": "Choose a valid customer status.",
    "note-failed": "Customer note could not be saved.",
    "not-found": "Customer could not be found for this workspace store.",
    saved: "Customer details saved.",
    "update-failed": "Customer details could not be saved."
  };

  return status ? messages[status] : null;
}

function averageOrderValue(customer: CustomerRow, orders: OrderRow[]) {
  const orderCount = customer.total_orders ?? orders.length;
  return orderCount ? numericValue(customer.total_spent) / orderCount : 0;
}

function formatSegment(value: string | null | undefined) {
  return (value || "new").replace(/_/g, " ");
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
    .from("store_customers" as never)
    .select("id, workspace_id, store_id, name, email, phone, status, segment, loyalty_points, loyalty_tier, tags, total_orders, total_spent, first_order_at, last_order_at, last_order_id")
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
  const [
    { data: storeOrderRows },
    { data: draftOrderRows },
    { data: addressRows },
    { data: noteRows },
    { data: reviewRows }
  ] = await Promise.all([
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
      .limit(150),
    supabase
      .from("customer_addresses" as never)
      .select("id, full_name, phone, address_line1, address_line2, city, region, country, postal_code, is_default, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStoreId as never)
      .eq("customer_id" as never, id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(20),
    supabase
      .from("customer_notes" as never)
      .select("id, note, tags, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStoreId as never)
      .eq("customer_id" as never, id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(20),
    supabase
      .from("product_reviews" as never)
      .select("id, product_id, rating, title, comment, status, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStoreId as never)
      .or(
        [
          customer.phone ? `customer_phone.eq.${customer.phone}` : "",
          `customer_name.ilike.${customer.name.replace(/[%*,]/g, "")}`
        ]
          .filter(Boolean)
          .join(",") as never
      )
      .order("created_at" as never, { ascending: false } as never)
      .limit(20)
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
  const addresses = (addressRows ?? []) as unknown as AddressRow[];
  const notes = (noteRows ?? []) as unknown as CustomerNoteRow[];
  const reviews = (reviewRows ?? []) as unknown as ReviewRow[];
  const message = customerMessage(query.customer);
  const aov = averageOrderValue(customer, orders);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href={`/dashboard/customers?storeId=${activeStoreId}`}>Back to customers</ButtonLink>}
        description={`Real customer profile for ${store?.name ?? "this store"}.`}
        title={customer.name}
      />
      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}
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
              <p className="font-bold text-muted">Segment</p>
              <p className="mt-1 font-semibold capitalize text-ink">{formatSegment(customer.segment)}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Loyalty tier</p>
              <p className="mt-1 font-semibold capitalize text-ink">{customer.loyalty_tier ?? "bronze"}</p>
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
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">AOV</p>
              <p className="mt-1 text-2xl font-black text-ink">{formatMoney(aov)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Reviews</p>
              <p className="mt-1 text-2xl font-black text-ink">{reviews.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Points</p>
              <p className="mt-1 text-2xl font-black text-ink">{customer.loyalty_points ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Tier</p>
              <p className="mt-1 text-2xl font-black capitalize text-ink">{customer.loyalty_tier ?? "bronze"}</p>
            </div>
          </div>
          {(customer.tags ?? []).length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {(customer.tags ?? []).map((tag) => (
                <span
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <form action={saveStoreCustomerDetails} className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <input name="customerId" type="hidden" value={customer.id} />
            <input name="storeId" type="hidden" value={activeStoreId} />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Customer status</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={customer.status ?? "new"}
                name="status"
              >
                <option value="new">New</option>
                <option value="active">Active</option>
                <option value="returning">Returning</option>
                <option value="vip">VIP</option>
              </select>
            </label>
            <Input
              defaultValue={(customer.tags ?? []).join(", ")}
              id="tags"
              label="Customer tags"
              name="tags"
              placeholder="VIP, Wholesale, Frequent buyer"
            />
            <Textarea
              id="note"
              label="Internal note"
              name="note"
              placeholder="Add a private note for this customer."
            />
            <Button type="submit">Save customer details</Button>
          </form>
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
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Shipping addresses
          </p>
          <div className="mt-5 grid gap-3">
            {addresses.length ? (
              addresses.map((address) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={address.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-ink">
                        {address.full_name || customer.name}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                        {[address.address_line1, address.address_line2, address.city, address.region, address.country, address.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {address.phone ? (
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                          {address.phone}
                        </p>
                      ) : null}
                    </div>
                    {address.is_default ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Default
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                Shipping addresses will appear here when orders include customer addresses.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Reviews submitted
          </p>
          <div className="mt-5 grid gap-3">
            {reviews.length ? (
              reviews.map((review) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={review.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-ink">
                      {"★".repeat(Math.max(1, Math.min(5, review.rating)))}
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {review.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-black text-ink">
                    {review.title || `Product ${review.product_id.slice(0, 8)}`}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    {review.comment}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {formatDate(review.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No reviews are linked to this customer yet.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Internal notes
          </p>
          <div className="mt-5 grid gap-3">
            {notes.length ? (
              notes.map((note) => (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={note.id}>
                  <p className="text-sm font-semibold leading-6 text-muted">{note.note}</p>
                  {(note.tags ?? []).length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(note.tags ?? []).map((tag) => (
                        <span
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {formatDate(note.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No internal notes have been saved for this customer yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
