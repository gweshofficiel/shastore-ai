import { PageHeader } from "@/components/dashboard/page-header";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateStoreOrderStatusAction } from "@/lib/store-order-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

const orderStatuses = ["draft", "pending", "confirmed", "cancelled"];
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
  currency?: string | null;
  customer_address: string | null;
  customer_email: string | null;
  customer_name: string;
  customer_phone: string;
  id: string;
  items: Json;
  order_status: string;
  payment_method: string;
  payment_status: string;
  source?: "orders" | "store_orders";
  store_id: string;
  subtotal: number | string;
  total: number | string;
};

type DraftOrderRow = {
  created_at: string;
  currency: string | null;
  customer_address: string | null;
  customer_email: string | null;
  customer_name: string;
  customer_phone: string;
  id: string;
  notes: string | null;
  order_status: string;
  payment_method: string | null;
  payment_status: string | null;
  store_id: string | null;
  store_instance_id: string | null;
  subtotal: number | string;
  total: number | string;
};

type DraftOrderItemRow = {
  currency: string | null;
  order_id: string;
  price: number | string | null;
  product_id: string | null;
  product_title: string | null;
  quantity: number | null;
  subtotal: number | string | null;
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

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "draft") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "confirmed" || status === "processing" || status === "shipped" || status === "pending") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "canceled" || status === "cancelled") {
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
    "invalid-transition": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Cancelled orders cannot be moved back to another status."
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

function draftItemsToOrderItems(items: DraftOrderItemRow[]): StoreOrderItem[] {
  return items.map((item) => ({
    id: item.product_id ?? undefined,
    price: numericValue(item.price),
    quantity: item.quantity ?? 1,
    title: item.product_title ?? "Product",
    total: numericValue(item.subtotal)
  }));
}

function isMissingStoreOrders(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("store_orders") ||
    message.includes("could not find")
  );
}

function isMissingDraftOrders(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("orders") ||
    message.includes("order_items") ||
    message.includes("could not find") ||
    message.includes("schema cache")
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

  let storeOrdersRequest = supabase
    .from("store_orders")
    .select(
      "id, store_id, customer_name, customer_phone, customer_email, customer_address, items, subtotal, total, payment_method, payment_status, order_status, created_at"
    )
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at", { ascending: false })
    .limit(100);

  if (orderStatuses.includes(status)) {
    storeOrdersRequest = storeOrdersRequest.eq("order_status", status);
  }

  const { data: storeOrders, error: storeOrdersError } = await storeOrdersRequest;
  let draftOrdersRequest = supabase
    .from("orders" as never)
    .select(
      "id, store_id, store_instance_id, customer_name, customer_phone, customer_email, customer_address, notes, subtotal, total, currency, payment_method, payment_status, order_status, created_at"
    )
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at", { ascending: false })
    .limit(100);

  if (orderStatuses.includes(status)) {
    draftOrdersRequest = draftOrdersRequest.eq("order_status" as never, status as never);
  }

  const { data: rawDraftOrders, error: draftOrdersError } = await draftOrdersRequest;

  if (storeOrdersError && draftOrdersError) {
    return {
      error:
        isMissingStoreOrders(storeOrdersError) && isMissingDraftOrders(draftOrdersError)
          ? null
          : "Orders could not be loaded. Please try again.",
      orders: [],
      schemaIssue: isMissingStoreOrders(storeOrdersError) && isMissingDraftOrders(draftOrdersError)
        ? "Missing seller orders foundation: run the store_orders and order draft migrations."
        : null,
      stores
    };
  }

  const draftOrders = draftOrdersError ? [] : ((rawDraftOrders ?? []) as unknown as DraftOrderRow[]);
  const draftOrderIds = draftOrders.map((order) => order.id);
  const { data: rawDraftItems, error: draftItemsError } = draftOrderIds.length
    ? await supabase
        .from("order_items" as never)
        .select("order_id, product_id, product_title, price, quantity, subtotal, currency")
        .in("order_id" as never, draftOrderIds as never)
    : { data: [], error: null };

  if (draftItemsError && !isMissingDraftOrders(draftItemsError)) {
    console.error("[dashboard-orders] order items could not be loaded", {
      code: draftItemsError.code,
      message: draftItemsError.message
    });
  }

  const draftItemsByOrderId = new Map<string, DraftOrderItemRow[]>();

  if (!draftItemsError) {
    for (const item of (rawDraftItems ?? []) as unknown as DraftOrderItemRow[]) {
      const current = draftItemsByOrderId.get(item.order_id) ?? [];
      current.push(item);
      draftItemsByOrderId.set(item.order_id, current);
    }
  }

  const normalizedStoreOrders = storeOrdersError
    ? []
    : ((storeOrders ?? []) as StoreOrderRow[]).map((order) => ({
        ...order,
        currency: "USD",
        source: "store_orders" as const
      }));
  const normalizedDraftOrders = draftOrders.map((order) => ({
    created_at: order.created_at,
    currency: order.currency ?? "USD",
    customer_address: order.customer_address ?? order.notes,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    id: order.id,
    items: draftItemsToOrderItems(draftItemsByOrderId.get(order.id) ?? []) as Json,
    order_status: order.order_status,
    payment_method: order.payment_method ?? "manual",
    payment_status: order.payment_status ?? "pending",
    source: "orders" as const,
    store_id: order.store_id ?? order.store_instance_id ?? "",
    subtotal: order.subtotal,
    total: order.total
  }));
  const orders = [...normalizedStoreOrders, ...normalizedDraftOrders]
    .filter((order) => stores.some((store) => store.id === order.store_id))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 100);

  return {
    error: null,
    orders,
    schemaIssue:
      storeOrdersError && isMissingStoreOrders(storeOrdersError)
        ? "Legacy store orders table is missing; showing available draft orders only."
        : draftOrdersError && isMissingDraftOrders(draftOrdersError)
          ? "Order draft tables are missing; showing available legacy store orders only."
          : null,
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

      {!error && stores.length === 0 ? (
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

      {!error && stores.length > 0 ? (
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
                      Order {orderReference(order.id)}
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
                              <span className="font-black text-ink">{formatMoney(item.total ?? 0, order.currency ?? "USD")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-4 self-center text-left lg:text-right">
                    <p className="text-2xl font-black tracking-[-0.03em] text-ink">
                      {formatMoney(order.total, order.currency ?? "USD")}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {order.currency ?? "USD"} total
                    </p>
                    <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-muted">
                      Payment, fulfillment, and shipping actions are not enabled yet.
                    </p>
                    {canManageOrders && order.source ? (
                      <OrderStatusActions
                        action={updateStoreOrderStatusAction}
                        currentStatus={order.order_status}
                        orderId={order.id}
                        source={order.source}
                      />
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
