import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateStoreOwnerOrderStatus } from "@/lib/order-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ordersPath = "/dashboard/orders";
const statuses = [
  "all",
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
];

type OwnedStore = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};

type OrderRow = {
  created_at: string;
  currency: string;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_reference?: string | null;
  fulfillment_status: string;
  id: string;
  notes?: string | null;
  order_number: string;
  order_status: string;
  payment_status: string;
  store_instance_id: string;
  subtotal: number | string;
  total: number | string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_reference?: string | null;
  product_title: string;
  quantity: number;
  total_price: number | string;
  unit_price: number | string;
};

type OrdersDashboardData = {
  activeStore: OwnedStore | null;
  error: string | null;
  items: OrderItemRow[];
  orders: OrderRow[];
  schemaIssue: string | null;
  selectedOrder: OrderRow | null;
  stores: OwnedStore[];
};

function isMissingOrdersFoundation(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    message.includes("get_claimed_store_instances_for_current_user") ||
    message.includes("order_items") ||
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

function formatMoney(amount: number | string, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD"
  }).format(numericValue(amount));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function statusHref(status: string, current: { q?: string; storeId?: string }) {
  const searchParams = new URLSearchParams();

  if (status !== "all") {
    searchParams.set("status", status);
  }

  if (current.q) {
    searchParams.set("q", current.q);
  }

  if (current.storeId) {
    searchParams.set("storeId", current.storeId);
  }

  const search = searchParams.toString();
  return search ? `${ordersPath}?${search}` : ordersPath;
}

function orderHref(order: OrderRow, params: { q?: string; status?: string; storeId?: string }) {
  const search = new URLSearchParams({
    orderId: order.id,
    storeId: params.storeId ?? order.store_instance_id
  });

  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  return `${ordersPath}?${search.toString()}`;
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "paid" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "shipped" || status === "processing") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled" || status === "refunded") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "invalid-status": "That order status is not supported.",
    "missing-order": "Choose an order before updating status.",
    "not-authorized": "You do not have permission to update that order.",
    "status-failed": "Order status could not be updated. Please try again.",
    "status-updated": "Order status updated."
  };

  return status ? messages[status] : null;
}

async function getOrdersDashboardData({
  orderId,
  query = "",
  status = "all",
  storeId
}: {
  orderId?: string;
  query?: string;
  status?: string;
  storeId?: string;
}): Promise<OrdersDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      activeStore: null,
      error: "We could not verify your session. Please sign in again.",
      items: [],
      orders: [],
      schemaIssue: null,
      selectedOrder: null,
      stores: []
    };
  }

  if (!user) {
    return {
      activeStore: null,
      error: "Sign in to view your orders.",
      items: [],
      orders: [],
      schemaIssue: null,
      selectedOrder: null,
      stores: []
    };
  }

  const { data: claimedStores, error: claimedError } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (claimedError) {
    return {
      activeStore: null,
      error: isMissingOrdersFoundation(claimedError)
        ? null
        : "Owned stores could not be loaded. Please try again.",
      items: [],
      orders: [],
      schemaIssue: isMissingOrdersFoundation(claimedError)
        ? "Missing ownership foundation: run the buyer activation and account claim migrations first."
        : null,
      selectedOrder: null,
      stores: []
    };
  }

  const stores = ((claimedStores ?? []) as OwnedStore[]).filter(
    (store) => !store.access_role || store.access_role === "owner" || store.access_role === "admin"
  );
  const activeStore = stores.find((store) => store.id === storeId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      items: [],
      orders: [],
      schemaIssue: null,
      selectedOrder: null,
      stores
    };
  }

  let ordersRequest = supabase
    .from("orders" as never)
    .select(
      "id, store_instance_id, order_number, customer_reference, customer_name, customer_email, customer_phone, order_status, payment_status, fulfillment_status, currency, subtotal, total, notes, created_at, updated_at"
    )
    .eq("store_instance_id", activeStore.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statuses.includes(status) && status !== "all") {
    ordersRequest = ordersRequest.eq("order_status", status);
  }

  const { data: orderRows, error: ordersError } = await ordersRequest;

  if (ordersError) {
    return {
      activeStore,
      error: isMissingOrdersFoundation(ordersError)
        ? null
        : "Orders could not be loaded. Please try again.",
      items: [],
      orders: [],
      schemaIssue: isMissingOrdersFoundation(ordersError)
        ? "Missing orders foundation: run the store owner orders migration."
        : null,
      selectedOrder: null,
      stores
    };
  }

  const normalizedQuery = query.trim().toLowerCase();
  const orders = ((orderRows ?? []) as unknown as OrderRow[]).filter((order) => {
    if (!normalizedQuery) {
      return true;
    }

    return [
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.customer_reference
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const selectedOrder = orders.find((order) => order.id === orderId) ?? orders[0] ?? null;

  if (!selectedOrder) {
    return {
      activeStore,
      error: null,
      items: [],
      orders,
      schemaIssue: null,
      selectedOrder: null,
      stores
    };
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items" as never)
    .select("id, order_id, product_reference, product_title, quantity, unit_price, total_price")
    .eq("order_id", selectedOrder.id)
    .eq("store_instance_id", activeStore.id)
    .order("created_at", { ascending: true });

  return {
    activeStore,
    error: itemsError ? "Order details could not be loaded. Please try again." : null,
    items: (itemRows ?? []) as unknown as OrderItemRow[],
    orders,
    schemaIssue: null,
    selectedOrder,
    stores
  };
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{
    orderId?: string;
    orders?: string;
    q?: string;
    status?: string;
    storeId?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";
  const { activeStore, error, items, orders, schemaIssue, selectedOrder, stores } =
    await getOrdersDashboardData({
      orderId: params.orderId,
      query: params.q,
      status,
      storeId: params.storeId
    });
  const message = statusMessage(params.orders);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="View and update stable ecommerce order records for claimed stores."
        title="Orders"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}

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
            No claimed stores yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Orders are scoped by store instance. Claim a store before reviewing buyer
            orders.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <Card className="grid gap-5 p-5 lg:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.internal_slug || "Claimed store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Only orders for this store instance are visible.
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
                      {store.store_name || store.internal_slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View orders
              </Button>
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <ButtonLink
                href={statusHref(item, { q: params.q, storeId: activeStore.id })}
                key={item}
                variant={status === item ? "primary" : "secondary"}
              >
                {item === "all" ? "All" : item}
              </ButtonLink>
            ))}
          </div>

          <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <input name="status" type="hidden" value={status} />
            <input name="storeId" type="hidden" value={activeStore.id} />
            <Input
              defaultValue={params.q}
              id="q"
              label="Search"
              name="q"
              placeholder="Search by order number, customer, email"
            />
            <Button type="submit">Filter</Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <section className="grid gap-4">
            {orders.length ? (
              orders.map((order) => (
                <Card
                  className={`grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 lg:grid-cols-[minmax(0,1fr)_auto] ${
                    selectedOrder?.id === order.id ? "border-slate-400" : ""
                  }`}
                  key={order.id}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {order.order_number}
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
                      {order.customer_name || "Unknown customer"}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {order.customer_email || "No email captured"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusBadgeClass(order.order_status)}`}
                      >
                        {order.order_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {order.payment_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {order.fulfillment_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="self-center text-left lg:text-right">
                    <p className="text-2xl font-black tracking-[-0.03em] text-ink">
                      {formatMoney(order.total, order.currency)}
                    </p>
                    <ButtonLink
                      className="mt-3"
                      href={orderHref(order, {
                        q: params.q,
                        status,
                        storeId: activeStore.id
                      })}
                      variant="secondary"
                    >
                      View details
                    </ButtonLink>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
                  No orders yet
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
                  Orders will appear here once checkout capture is connected to this
                  foundation.
                </p>
              </Card>
            )}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="grid gap-5 p-5 lg:p-6">
              {selectedOrder ? (
                <>
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {selectedOrder.order_number}
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                      Order details
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {selectedOrder.customer_name || "Unknown customer"}
                      {selectedOrder.customer_email ? ` | ${selectedOrder.customer_email}` : ""}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Payment
                        </p>
                        <p className="mt-1 font-black text-ink">
                          {selectedOrder.payment_status}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Fulfillment
                        </p>
                        <p className="mt-1 font-black text-ink">
                          {selectedOrder.fulfillment_status}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Total
                      </p>
                      <p className="mt-1 text-xl font-black text-ink">
                        {formatMoney(selectedOrder.total, selectedOrder.currency)}
                      </p>
                    </div>
                  </div>

                  <form action={updateStoreOwnerOrderStatus} className="grid gap-3">
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="orderId" type="hidden" value={selectedOrder.id} />
                    <label className="grid gap-2 text-sm font-semibold text-ink">
                      <span>Seller status action</span>
                      <select
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        defaultValue={selectedOrder.order_status}
                        name="status"
                      >
                        {statuses
                          .filter((item) => item !== "all")
                          .map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button type="submit">Update status</Button>
                  </form>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Ordered Products
                    </p>
                    <div className="mt-3 grid gap-3">
                      {items.length ? (
                        items.map((item) => (
                          <div
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                            key={item.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-ink">{item.product_title}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                  Qty {item.quantity} x{" "}
                                  {formatMoney(item.unit_price, selectedOrder.currency)}
                                </p>
                              </div>
                              <p className="font-black text-ink">
                                {formatMoney(item.total_price, selectedOrder.currency)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">
                          No order items recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                    Select an order
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Order item details and status actions appear here.
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
