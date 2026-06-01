import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markDueAbandonedCartsSafe,
  sendAbandonedCartRecoveryEmailAction
} from "@/lib/abandoned-cart-recovery";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type AbandonedCartsPageProps = {
  searchParams: Promise<{
    carts?: string;
    storeId?: string;
  }>;
};

type AbandonedCartRow = {
  abandoned_at: string | null;
  created_at: string;
  currency: string;
  customer_email: string | null;
  customer_phone: string | null;
  estimated_total: number | string;
  id: string;
  items: Json;
  items_count: number;
  last_activity_at: string;
  recovery_email_sent_at: string | null;
  recovery_status: string;
};

type AbandonedCartsData = {
  activeStore: UserStoreRow | null;
  carts: AbandonedCartRow[];
  error: string | null;
  stores: UserStoreRow[];
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
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    email_sent: "Email Sent",
    expired: "Expired",
    pending: "Pending",
    recovered: "Recovered"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    email_sent: "bg-blue-100 text-blue-700",
    expired: "bg-slate-100 text-slate-700",
    pending: "bg-amber-100 text-amber-700",
    recovered: "bg-emerald-100 text-emerald-700"
  };

  return classes[status] ?? "bg-slate-100 text-slate-700";
}

function message(value: string | undefined) {
  const messages: Record<string, string> = {
    duplicate: "A recovery email has already been queued for this cart.",
    "email-failed": "Recovery email could not be queued.",
    "email-sent": "Recovery email queued.",
    "missing-cart": "Cart was not found.",
    "missing-email": "This cart does not have a customer email.",
    "not-authorized": "You are not authorized to manage this cart."
  };

  return value ? messages[value] : null;
}

function cartPreview(items: Json) {
  if (!Array.isArray(items)) {
    return "Cart items unavailable";
  }

  return items
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, Json | undefined>;
      const title = typeof record.title === "string" ? record.title : "Product";
      const quantity = typeof record.quantity === "number" ? record.quantity : 1;

      return `${title} x${quantity}`;
    })
    .filter(Boolean)
    .join(", ") || "Cart items unavailable";
}

async function getAbandonedCartsData(selectedStoreId?: string): Promise<AbandonedCartsData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, carts: [], error: "Sign in to view abandoned carts.", stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, carts: [], error: "Stores could not be loaded.", stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, carts: [], error: null, stores };
  }

  await markDueAbandonedCartsSafe({
    storeId: activeStore.id,
    workspaceId
  });

  const { data, error } = await supabase
    .from("store_abandoned_carts" as never)
    .select("id, customer_email, customer_phone, currency, items, items_count, estimated_total, recovery_status, last_activity_at, abandoned_at, recovery_email_sent_at, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .gt("items_count" as never, 0 as never)
    .or("abandoned_at.not.is.null,recovery_status.neq.pending")
    .order("last_activity_at" as never, { ascending: false } as never)
    .limit(50);

  if (error) {
    return { activeStore, carts: [], error: "Abandoned carts could not be loaded.", stores };
  }

  return {
    activeStore,
    carts: (data ?? []) as unknown as AbandonedCartRow[],
    error: null,
    stores
  };
}

export default async function AbandonedCartsPage({
  searchParams
}: AbandonedCartsPageProps) {
  const query = await searchParams;
  const { activeStore, carts, error, stores } = await getAbandonedCartsData(query.storeId);
  const notice = message(query.carts);
  const returnTo = `/dashboard/abandoned-carts${activeStore ? `?storeId=${encodeURIComponent(activeStore.id)}` : ""}`;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Review carts with product snapshots that did not become orders after the recovery threshold."
        title="Abandoned carts"
      />

      {notice ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {notice}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {carts.length ? (
          carts.map((cart) => (
            <Card className="grid gap-4 p-5" key={cart.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(cart.recovery_status)}`}>
                      {statusLabel(cart.recovery_status)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
                      {cart.items_count} {cart.items_count === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
                    {formatMoney(cart.estimated_total, cart.currency)}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    {cartPreview(cart.items)}
                  </p>
                </div>
                <div className="text-left text-sm font-bold text-muted sm:text-right">
                  <p>{cart.customer_email || "No customer email"}</p>
                  <p>{cart.customer_phone || "No phone"}</p>
                  <p className="mt-2">Last activity: {formatDate(cart.last_activity_at)}</p>
                  <p>Abandoned: {formatDate(cart.abandoned_at)}</p>
                  {cart.recovery_email_sent_at ? <p>Email: {formatDate(cart.recovery_email_sent_at)}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {cart.customer_email && cart.recovery_status === "pending" ? (
                  <form action={sendAbandonedCartRecoveryEmailAction}>
                    <input name="cartId" type="hidden" value={cart.id} />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <Button type="submit">Send recovery email</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card className="border-dashed p-8 text-center">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">No abandoned carts yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-muted">
              Carts appear here after product snapshots remain inactive beyond the recovery threshold.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
