import { PageHeader } from "@/components/dashboard/page-header";
import { OrderFulfillmentActions } from "@/components/dashboard/order-fulfillment-actions";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  updateStoreOrderFulfillmentStatusAction,
  updateStoreOrderStatusAction
} from "@/lib/store-order-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ orders?: string; source?: string }>;
};

type OrderSource = "orders" | "store_orders";

type OrderItem = {
  id?: string;
  image?: string | null;
  price: number;
  quantity: number;
  title: string;
  subtotal: number;
};

type OrderEvent = {
  created_at: string;
  event_type: string;
  message: string;
  new_value: string | null;
  previous_value: string | null;
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function deliveryMethodLabel(value: string | null | undefined) {
  if (value === "delivery") {
    return "Delivery";
  }

  if (value === "pickup") {
    return "Pickup";
  }

  return "Not selected";
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "draft") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "confirmed" || status === "pending") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "canceled" || status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function fulfillmentStatusLabel(status: string | null | undefined) {
  return (status && status !== "pending" ? status : "unfulfilled").replaceAll("_", " ");
}

function fulfillmentBadgeClass(status: string | null | undefined) {
  const normalized = status && status !== "pending" ? status : "unfulfilled";

  if (normalized === "fulfilled") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "preparing" || normalized === "ready_for_pickup" || normalized === "out_for_delivery") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

function eventTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

function statusMessage(value: string | undefined) {
  const messages: Record<string, { className: string; text: string }> = {
    "invalid-status": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That order status is not supported."
    },
    "invalid-fulfillment": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That fulfillment status is not allowed for this order delivery method."
    },
    "invalid-transition": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Cancelled orders cannot be moved back to another status."
    },
    "inventory-insufficient": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Order could not be confirmed because one or more products do not have enough stock."
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
    "fulfillment-failed": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Fulfillment status could not be updated. Please try again."
    },
    "fulfillment-updated": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Fulfillment status updated."
    },
    "status-updated": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Order status updated."
    }
  };

  return value ? messages[value] : null;
}

function parseStoreOrderItems(value: Json): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
      image: typeof item.imageUrl === "string" ? item.imageUrl : null,
      price: typeof item.price === "number" ? item.price : numericValue(item.price as string | null),
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      title: typeof item.title === "string" ? item.title : "Product",
      subtotal: typeof item.total === "number" ? item.total : numericValue(item.total as string | null)
    }));
}

async function loadOrderEvents({
  orderId,
  source,
  supabase,
  workspaceId
}: {
  orderId: string;
  source: OrderSource;
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string | null;
}) {
  const { data, error } = await supabase
    .from("order_events" as never)
    .select("event_type, previous_value, new_value, message, created_at")
    .eq("order_id" as never, orderId as never)
    .eq("order_source" as never, source as never)
    .eq("workspace_id" as never, workspaceId as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return [];
  }

  return (data ?? []) as unknown as OrderEvent[];
}

async function loadOrderDetail(orderId: string, sourceHint?: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { canManageOrders: false, error: "Sign in to view this order.", order: null, stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "view_orders")) {
    return {
      canManageOrders: false,
      error: "You do not have permission to view this order.",
      order: null,
      stores: []
    };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { canManageOrders: false, error: "Stores could not be loaded.", order: null, stores };
  }

  const storeIds = new Set(stores.map((store) => store.id));
  const sources: OrderSource[] = sourceHint === "orders" ? ["orders", "store_orders"] : ["store_orders", "orders"];
  const canManageOrders = hasPermission(role, "manage_orders");

  for (const source of sources) {
    if (source === "store_orders") {
      const { data, error } = await supabase
        .from("store_orders")
        .select(
          "id, store_id, customer_name, customer_phone, customer_email, customer_address, delivery_method, delivery_fee, shipping_amount, tax_name, tax_rate, tax_amount, prices_include_tax, fulfillment_status, fulfillment_notes, preparing_at, ready_for_pickup_at, out_for_delivery_at, fulfilled_at, items, subtotal, subtotal_amount, total, total_amount, payment_method, payment_status, order_status, confirmed_at, cancelled_at, internal_note, created_at"
        )
        .eq("id", orderId)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();

      if (error) {
        continue;
      }

      const row = data as unknown as {
        cancelled_at?: string | null;
        confirmed_at?: string | null;
        created_at: string;
        customer_address: string | null;
        customer_email: string | null;
        customer_name: string;
        customer_phone: string;
        delivery_fee?: number | string | null;
        delivery_method?: string | null;
        fulfillment_status?: string | null;
        fulfillment_notes?: string | null;
        fulfilled_at?: string | null;
        id: string;
        internal_note?: string | null;
        items: Json;
        order_status: string;
        out_for_delivery_at?: string | null;
        payment_method: string | null;
        payment_status: string | null;
        preparing_at?: string | null;
        ready_for_pickup_at?: string | null;
        prices_include_tax?: boolean | null;
        store_id: string;
        subtotal: number | string;
        subtotal_amount?: number | string | null;
        tax_amount?: number | string | null;
        tax_name?: string | null;
        tax_rate?: number | string | null;
        total: number | string;
        total_amount?: number | string | null;
      } | null;

      if (row && storeIds.has(row.store_id)) {
        const events = await loadOrderEvents({
          orderId: row.id,
          source: "store_orders",
          supabase,
          workspaceId
        });

        return {
          canManageOrders,
          error: null,
          stores,
          order: {
            cancelled_at: row.cancelled_at ?? null,
            confirmed_at: row.confirmed_at ?? null,
            created_at: row.created_at,
            currency: "USD",
            customer_address: row.customer_address,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            delivery_fee: row.delivery_fee ?? 0,
            delivery_method: row.delivery_method ?? null,
            events,
            fulfillment_status: row.fulfillment_status ?? "unfulfilled",
            fulfillment_notes: row.fulfillment_notes ?? null,
            fulfilled_at: row.fulfilled_at ?? null,
            id: row.id,
            internal_note: row.internal_note ?? null,
            items: parseStoreOrderItems(row.items),
            notes: row.customer_address,
            order_status: row.order_status,
            out_for_delivery_at: row.out_for_delivery_at ?? null,
            payment_method: row.payment_method ?? "manual",
            payment_status: row.payment_status ?? "pending",
            preparing_at: row.preparing_at ?? null,
            ready_for_pickup_at: row.ready_for_pickup_at ?? null,
            source: "store_orders" as const,
            store_id: row.store_id,
            subtotal: row.subtotal_amount ?? row.subtotal,
            tax_amount: row.tax_amount ?? 0,
            tax_name: row.tax_name ?? null,
            tax_rate: row.tax_rate ?? 0,
            prices_include_tax: Boolean(row.prices_include_tax),
            total: row.total_amount ?? row.total
          }
        };
      }
    }

    if (source === "orders") {
      const { data, error } = await supabase
        .from("orders" as never)
        .select(
          "id, store_id, store_instance_id, customer_name, customer_phone, customer_email, customer_address, delivery_method, delivery_fee, shipping_amount, tax_name, tax_rate, tax_amount, prices_include_tax, fulfillment_status, notes, subtotal, subtotal_amount, total, total_amount, currency, payment_method, payment_status, order_status, confirmed_at, cancelled_at, internal_note, created_at"
        )
        .eq("id" as never, orderId as never)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();

      if (error) {
        continue;
      }

      const row = data as unknown as {
        cancelled_at: string | null;
        confirmed_at: string | null;
        created_at: string;
        currency: string | null;
        customer_address: string | null;
        customer_email: string | null;
        customer_name: string;
        customer_phone: string;
        delivery_fee?: number | string | null;
        delivery_method?: string | null;
        fulfillment_status?: string | null;
        id: string;
        internal_note: string | null;
        notes: string | null;
        order_status: string;
        payment_method: string | null;
        payment_status: string | null;
        store_id: string | null;
        store_instance_id: string | null;
        prices_include_tax?: boolean | null;
        subtotal: number | string;
        subtotal_amount?: number | string | null;
        tax_amount?: number | string | null;
        tax_name?: string | null;
        tax_rate?: number | string | null;
        total: number | string;
        total_amount?: number | string | null;
      } | null;
      const storeId = row?.store_id ?? row?.store_instance_id ?? "";

      if (row && storeIds.has(storeId)) {
        const { data: rawItems } = await supabase
          .from("order_items" as never)
          .select("product_id, product_title, product_image, price, quantity, subtotal, currency")
          .eq("order_id" as never, row.id as never);
        const items = ((rawItems ?? []) as unknown as Array<{
          price: number | string | null;
          product_id: string | null;
          product_image: string | null;
          product_title: string | null;
          quantity: number | null;
          subtotal: number | string | null;
        }>).map((item) => ({
          id: item.product_id ?? undefined,
          image: item.product_image,
          price: numericValue(item.price),
          quantity: item.quantity ?? 1,
          title: item.product_title ?? "Product",
          subtotal: numericValue(item.subtotal)
        }));
        const events = await loadOrderEvents({
          orderId: row.id,
          source: "orders",
          supabase,
          workspaceId
        });

        return {
          canManageOrders,
          error: null,
          stores,
          order: {
            cancelled_at: row.cancelled_at,
            confirmed_at: row.confirmed_at,
            created_at: row.created_at,
            currency: row.currency ?? "USD",
            customer_address: row.customer_address,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            delivery_fee: row.delivery_fee ?? 0,
            delivery_method: row.delivery_method ?? null,
            events,
            fulfillment_status: row.fulfillment_status ?? "unfulfilled",
            fulfillment_notes: null,
            fulfilled_at: null,
            id: row.id,
            internal_note: row.internal_note,
            items,
            notes: row.notes,
            order_status: row.order_status,
            out_for_delivery_at: null,
            payment_method: row.payment_method ?? "manual",
            payment_status: row.payment_status ?? "pending",
            preparing_at: null,
            ready_for_pickup_at: null,
            source: "orders" as const,
            store_id: storeId,
            subtotal: row.subtotal_amount ?? row.subtotal,
            tax_amount: row.tax_amount ?? 0,
            tax_name: row.tax_name ?? null,
            tax_rate: row.tax_rate ?? 0,
            prices_include_tax: Boolean(row.prices_include_tax),
            total: row.total_amount ?? row.total
          }
        };
      }
    }
  }

  return { canManageOrders, error: null, order: null, stores };
}

export default async function OrderDetailPage({
  params,
  searchParams
}: OrderDetailPageProps) {
  const { orderId } = await params;
  const query = await searchParams;
  const { canManageOrders, error, order, stores } = await loadOrderDetail(orderId, query.source);
  const message = statusMessage(query.orders);
  const store = order ? stores.find((item) => item.id === order.store_id) : null;
  const returnTo = `/dashboard/orders/${orderId}${query.source ? `?source=${query.source}` : ""}`;

  if (error || !order) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="This order may not exist, or it may belong to another workspace."
          title="Order not available"
        />
        <Card className="border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            {error ? "Order access unavailable" : "Order not found"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            {error ?? "We could not find this order inside your current workspace stores."}
          </p>
          <ButtonLink className="mt-5" href="/dashboard/orders" variant="secondary">
            Back to orders
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          description={`Order ${orderReference(order.id)} from ${store?.name ?? "this store"}.`}
          title="Order details"
        />
        <ButtonLink href="/dashboard/orders" variant="secondary">
          Back to orders
        </ButtonLink>
      </div>

      {message ? (
        <Card className={`p-5 ${message.className}`}>
          <p className="text-sm font-bold">{message.text}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="grid gap-6 p-6">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Order {orderReference(order.id)}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
              {order.customer_name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-muted">
              Store: {store?.name ?? order.store_id}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Phone" value={order.customer_phone} />
            <Info label="Email" value={order.customer_email || "Not provided"} />
            <Info label="Address" value={order.customer_address || "Not provided"} />
            <Info label="Delivery method" value={deliveryMethodLabel(order.delivery_method)} />
            <Info label="Delivery fee" value={formatMoney(order.delivery_fee ?? 0, order.currency)} />
            <Info
              label={order.tax_name ? `${order.tax_name}${order.prices_include_tax ? " included" : ""}` : "Tax"}
              value={formatMoney(order.tax_amount ?? 0, order.currency)}
            />
            <Info label="Fulfillment" value={fulfillmentStatusLabel(order.fulfillment_status)} />
            <Info label="Created" value={formatDate(order.created_at)} />
            <Info label="Confirmed" value={formatDate(order.confirmed_at)} />
            <Info label="Cancelled" value={formatDate(order.cancelled_at)} />
            <Info label="Preparing" value={formatDate(order.preparing_at)} />
            <Info label="Ready for pickup" value={formatDate(order.ready_for_pickup_at)} />
            <Info label="Out for delivery" value={formatDate(order.out_for_delivery_at)} />
            <Info label="Fulfilled" value={formatDate(order.fulfilled_at)} />
          </div>

          {order.notes ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Notes</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{order.notes}</p>
            </div>
          ) : null}

          {order.internal_note ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Internal seller note
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
                {order.internal_note}
              </p>
            </div>
          ) : null}

          {order.fulfillment_notes ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Fulfillment notes
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">
                {order.fulfillment_notes}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Order timeline
            </p>
            {order.events?.length ? (
              <div className="mt-4 grid gap-3">
                {order.events.map((event, index) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                    key={`${event.event_type}-${event.created_at}-${index}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black capitalize text-ink">
                        {eventTypeLabel(event.event_type)}
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                      {event.message}
                    </p>
                    {event.previous_value || event.new_value ? (
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        {event.previous_value ?? "empty"} → {event.new_value ?? "empty"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                No timeline events have been recorded for this order yet.
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <h3 className="text-xl font-black tracking-[-0.03em] text-ink">Order items</h3>
            {order.items.length ? (
              order.items.map((item, index) => (
                <div
                  className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]"
                  key={`${item.id ?? item.title}-${index}`}
                >
                  {item.image ? (
                    <>
                      {/* Product snapshots may point at public Supabase URLs, so keep this as a plain image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={item.title}
                      className="h-20 w-20 rounded-2xl object-cover"
                      src={item.image}
                    />
                    </>
                  ) : (
                    <div className="aspect-square rounded-2xl bg-slate-100" />
                  )}
                  <div>
                    <p className="font-black text-ink">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      Quantity {item.quantity} x {formatMoney(item.price, order.currency)}
                    </p>
                  </div>
                  <p className="font-black text-ink">{formatMoney(item.subtotal, order.currency)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-muted">
                No item snapshots were found for this order.
              </div>
            )}
          </div>
        </Card>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-6">
          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusBadgeClass(order.order_status)}`}>
                Order status: {order.order_status}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${fulfillmentBadgeClass(order.fulfillment_status)}`}>
                Fulfillment: {fulfillmentStatusLabel(order.fulfillment_status)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                Payment method: {order.payment_method}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                Payment status: {order.payment_status}
              </span>
            </div>
            <div>
              <p className="text-3xl font-black tracking-[-0.04em] text-ink">
                {formatMoney(order.total, order.currency)}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {order.currency} total
              </p>
            </div>
            <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-muted">
              Payment, fulfillment, and shipping actions remain disabled. Delivery method:{" "}
              {deliveryMethodLabel(order.delivery_method)}.
            </p>
            {numericValue(order.tax_amount) > 0 ? (
              <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-muted">
                {order.tax_name ?? "Tax"} at {numericValue(order.tax_rate)}%
                {order.prices_include_tax ? " is included in item prices" : " was added at checkout"}:{" "}
                {formatMoney(order.tax_amount, order.currency)}.
              </p>
            ) : null}
          </Card>

          {canManageOrders ? (
            <>
              <OrderStatusActions
                action={updateStoreOrderStatusAction}
                currentStatus={order.order_status}
                internalNote={order.internal_note ?? ""}
                orderId={order.id}
                returnTo={returnTo}
                source={order.source}
              />
              <OrderFulfillmentActions
                action={updateStoreOrderFulfillmentStatusAction}
                currentStatus={order.fulfillment_status ?? "unfulfilled"}
                deliveryMethod={order.delivery_method}
                fulfillmentNotes={order.fulfillment_notes}
                orderId={order.id}
                orderStatus={order.order_status}
                returnTo={returnTo}
                source={order.source}
              />
            </>
          ) : (
            <Card className="p-5">
              <p className="text-sm font-bold text-muted">
                You do not have permission to update order status.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
