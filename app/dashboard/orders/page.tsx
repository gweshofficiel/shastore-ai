import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateStoreOrderStatusAction } from "@/lib/store-order-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

const orderStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "canceled"];
const filterStatuses = ["all", ...orderStatuses];

type StoreOrderItem = {
  categoryName?: string | null;
  id?: string;
  price?: number;
  priceLabel?: string | null;
  quantity?: number;
  title?: string;
  total?: number;
};

type StoreOrderRow = {
  created_at: string;
  customer_address: string | null;
  customer_email: string | null;
  customer_name: string;
  customer_phone: string;
  id: string;
  items: Json;
  order_status: string;
  payment_method: string;
  payment_status: string;
  store_id: string;
  subtotal: number | string;
  total: number | string;
};

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
    currency,
    style: "currency"
  }).format(numericValue(amount));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "confirmed" || status === "processing" || status === "shipped") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "canceled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function filterHref(status: string) {
  return status === "all" ? "/dashboard/orders" : `/dashboard/orders?status=${status}`;
}

function statusMessage(value: string | undefined) {
  const messages: Record<string, { className: string; text: string }> = {
    "invalid-status": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That order status is not supported."
    },
    "missing-order": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Choose an order before updating status."
    },
    "not-authorized": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "You can only update orders for your own stores."
    },
    "status-failed": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Order status could not be updated. Please try again."
    },
    "status-updated": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Order status updated."
    }
  };

  return value ? messages[value] : null;
}

function parseItems(value: Json): StoreOrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      categoryName: typeof item.categoryName === "string" ? item.categoryName : null,
      id: typeof item.id === "string" ? item.id : undefined,
      price: typeof item.price === "number" ? item.price : undefined,
      priceLabel: typeof item.priceLabel === "string" ? item.priceLabel : null,
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      title: typeof item.title === "string" ? item.title : "Product",
      total: typeof item.total === "number" ? item.total : 0
    }));
}

function itemSummary(items: StoreOrderItem[]) {
  if (!items.length) {
    return "No items";
  }

  return items
    .map((item) => `${item.title ?? "Product"} x${item.quantity ?? 1}`)
    .join(", ");
}

function isMissingStoreOrders(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("store_orders") ||
    message.includes("could not find")
  );
}

async function getStoreModeOrders(status: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      error: "We could not verify your session. Please sign in again.",
      orders: [],
      schemaIssue: null,
      stores: []
    };
  }

  if (!user) {
    return {
      error: "Sign in to view your orders.",
      orders: [],
      schemaIssue: null,
      stores: []
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_orders")) {
    console.warn("[permission-denied] orders page denied", {
      permission: "view_orders",
      role,
      userId: user.id,
      workspaceId
    });

    return {
      error: "You do not have permission to view orders.",
      orders: [],
      schemaIssue: null,
      stores: []
    };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      error: "Stores could not be loaded. Please try again.",
      orders: [],
      schemaIssue: null,
      stores
    };
  }

  let request = supabase
    .from("store_orders")
    .select(
      "id, store_id, customer_name, customer_phone, customer_email, customer_address, items, subtotal, total, payment_method, payment_status, order_status, created_at"
    )
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at", { ascending: false })
    .limit(100);

  if (orderStatuses.includes(status)) {
    request = request.eq("order_status", status);
  }

  const { data, error } = await request;

  if (error) {
    return {
      error: isMissingStoreOrders(error) ? null : "Orders could not be loaded. Please try again.",
      orders: [],
      schemaIssue: isMissingStoreOrders(error)
        ? "Missing Store Mode orders foundation: run the store_orders migration."
        : null,
      stores
    };
  }

  return {
    error: null,
    orders: (data ?? []) as StoreOrderRow[],
    schemaIssue: null,
    stores
  };
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{
    orders?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const activeStatus = filterStatuses.includes(params.status ?? "") ? (params.status ?? "all") : "all";
  const message = statusMessage(params.orders);
  const { error, orders, schemaIssue, stores } = await getStoreModeOrders(activeStatus);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const workspaceId = user ? await getUserPrimaryWorkspaceId(supabase, user.id) : null;
  const role = user && workspaceId ? await getUserWorkspaceRole(supabase, workspaceId, user.id) : null;
  const canManageOrders = hasPermission(role, "manage_orders");
  const storesById = new Map(stores.map((store) => [store.id, store]));

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="View Store Mode orders submitted from public storefront carts."
        title="Orders"
      />

      {message ? (
        <Card className={`p-5 ${message.className}`}>
          <p className="text-sm font-bold">{message.text}</p>
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

      {!schemaIssue && !error && stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No stores yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Create and publish a Store Mode storefront before collecting orders.
          </p>
          <ButtonLink className="mt-5" href="/dashboard/stores/new">
            Create store
          </ButtonLink>
        </Card>
      ) : null}

      {!schemaIssue && !error && stores.length > 0 ? (
        orders.length ? (
          <div className="grid gap-5">
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                {filterStatuses.map((status) => (
                  <ButtonLink
                    href={filterHref(status)}
                    key={status}
                    variant={activeStatus === status ? "primary" : "secondary"}
                  >
                    {status}
                  </ButtonLink>
                ))}
              </div>
            </Card>
            <div className="grid gap-4">
              {orders.map((order) => {
                const store = storesById.get(order.store_id);
                const items = parseItems(order.items);

                return (
                  <Card className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]" key={order.id}>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Order {order.id.slice(0, 8)}
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
                      {order.customer_name}
                    </h2>
                    <div className="mt-2 grid gap-1 text-sm text-muted">
                      <p>Phone: {order.customer_phone}</p>
                      <p>Email: {order.customer_email || "Not provided"}</p>
                      <p>Address: {order.customer_address || "Not provided"}</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-muted">
                      Store: {store?.name ?? order.store_id}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">{itemSummary(items)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusBadgeClass(order.order_status)}`}
                      >
                        order {order.order_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        pay via {order.payment_method}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        payment {order.payment_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    {items.length ? (
                      <div className="mt-4 grid gap-2">
                        {items.map((item, index) => (
                          <div className="rounded-2xl bg-slate-50 p-3 text-sm" key={`${order.id}-${item.id ?? index}`}>
                            <div className="flex flex-wrap justify-between gap-3">
                              <div>
                                <p className="font-bold text-ink">
                                  {item.title} x{item.quantity ?? 1}
                                </p>
                                {item.categoryName ? (
                                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                    {item.categoryName}
                                  </p>
                                ) : null}
                              </div>
                              <span className="font-black text-ink">{formatMoney(item.total ?? 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-4 self-center text-left lg:text-right">
                    <p className="text-2xl font-black tracking-[-0.03em] text-ink">
                      {formatMoney(order.total)}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Submitted total
                    </p>
                    {canManageOrders ? (
                      <form action={updateStoreOrderStatusAction} className="grid gap-3">
                        <input name="orderId" type="hidden" value={order.id} />
                        <label className="grid gap-2 text-left text-sm font-semibold text-ink">
                          <span>Order status</span>
                          <select
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            defaultValue={order.order_status}
                            name="status"
                          >
                            {orderStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit">Update status</Button>
                      </form>
                    ) : (
                      <p className="text-sm font-bold text-muted">
                        You do not have permission to update order status.
                      </p>
                    )}
                  </div>
                </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                {filterStatuses.map((status) => (
                  <ButtonLink
                    href={filterHref(status)}
                    key={status}
                    variant={activeStatus === status ? "primary" : "secondary"}
                  >
                    {status}
                  </ButtonLink>
                ))}
              </div>
            </Card>
            <Card className="p-8 text-center">
              <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No orders yet</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
                {activeStatus === "all"
                  ? "Orders submitted from public store carts will appear here."
                  : `No ${activeStatus} orders yet.`}
              </p>
            </Card>
          </div>
        )
      ) : null}
    </div>
  );
}
