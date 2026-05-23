import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

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
  if (status === "paid" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "processing" || status === "shipped") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled" || status === "refunded") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
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

async function getStoreModeOrders() {
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

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id);

  if (storesError) {
    return {
      error: "Stores could not be loaded. Please try again.",
      orders: [],
      schemaIssue: null,
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_orders")
    .select(
      "id, store_id, customer_name, customer_phone, customer_email, customer_address, items, subtotal, total, payment_method, payment_status, order_status, created_at"
    )
    .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await searchParams;
  const { error, orders, schemaIssue, stores } = await getStoreModeOrders();
  const storesById = new Map(stores.map((store) => [store.id, store]));

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="View Store Mode orders submitted from public storefront carts."
        title="Orders"
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
          <div className="grid gap-4">
            {orders.map((order) => {
              const store = storesById.get(order.store_id);
              const items = parseItems(order.items);

              return (
                <Card className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto]" key={order.id}>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {order.id.slice(0, 8)}
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
                      {order.customer_name}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {order.customer_phone}
                      {order.customer_email ? ` | ${order.customer_email}` : ""}
                    </p>
                    {order.customer_address ? (
                      <p className="mt-1 text-sm text-muted">{order.customer_address}</p>
                    ) : null}
                    <p className="mt-3 text-sm font-semibold text-muted">
                      Store: {store?.name ?? order.store_id}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">{itemSummary(items)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusBadgeClass(order.order_status)}`}
                      >
                        {order.order_status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {order.payment_method}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {order.payment_status}
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
                              <span className="font-bold text-ink">
                                {item.title} x{item.quantity ?? 1}
                              </span>
                              <span className="font-black text-ink">
                                {formatMoney(item.total ?? 0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="self-center text-left lg:text-right">
                    <p className="text-2xl font-black tracking-[-0.03em] text-ink">
                      {formatMoney(order.total)}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Submitted total
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
              Orders submitted from public store carts will appear here.
            </p>
          </Card>
        )
      ) : null}
    </div>
  );
}
