import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreGiftCardAction,
  updateStoreGiftCardStatusAction
} from "@/lib/store-gift-card-actions";
import { maskGiftCardCode } from "@/lib/store-gift-cards";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type GiftCardRow = {
  code: string;
  currency: string;
  expires_at?: string | null;
  id: string;
  initial_balance: number | string;
  remaining_balance: number | string;
  status: string;
};

type GiftCardsData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  giftCards: GiftCardRow[];
  stores: UserStoreRow[];
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage gift cards for that store.",
    "create-failed": "Gift card could not be created. Apply the gift cards migration and try again.",
    created: "Gift card created.",
    duplicate: "A gift card with that code already exists for this store.",
    invalid: "Enter a valid gift card code and balance.",
    updated: "Gift card status updated.",
    "update-failed": "Gift card status could not be updated."
  };

  return value ? messages[value] ?? null : null;
}

function money(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(money(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No expiry";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "used") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "expired") {
    return "bg-slate-100 text-muted";
  }

  return "bg-red-100 text-red-700";
}

async function getGiftCardsData(selectedStoreId?: string): Promise<GiftCardsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage gift cards.", giftCards: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "can_edit_stores")) {
    return { activeStore: null, error: "You do not have permission to manage gift cards.", giftCards: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      giftCards: [],
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_gift_cards" as never)
    .select("id, code, initial_balance, remaining_balance, currency, status, expires_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      error: "Gift cards could not be loaded. Apply the gift cards migration.",
      giftCards: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    giftCards: (data ?? []) as unknown as GiftCardRow[],
    stores
  };
}

export default async function GiftCardsPage({
  searchParams
}: {
  searchParams: Promise<{ giftCards?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, giftCards, stores } = await getGiftCardsData(query.storeId);
  const message = statusMessage(query.giftCards);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create store-scoped gift card codes, track remaining balances, and redeem them during checkout."
        title="Gift Cards"
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

      {activeStore ? (
        <>
          <Card className="p-5 lg:p-6">
            <form className="flex flex-wrap items-end gap-3" method="get">
              <label className="grid min-w-64 gap-2 text-sm font-semibold text-ink">
                <span>Store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name || store.store_name || "Untitled store"}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">View gift cards</Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-5 lg:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create gift card</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                New gift card for {activeStore.name || activeStore.store_name || "this store"}
              </h2>
            </div>
            <form action={createStoreGiftCardAction} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <div className="grid gap-4 md:grid-cols-4">
                <Input id="gift-code" label="Code" name="code" placeholder="GIFT-2026" required />
                <Input id="initial-balance" label="Initial balance" min="0" name="initialBalance" required step="0.01" type="number" />
                <Input id="remaining-balance" label="Remaining balance" min="0" name="remainingBalance" placeholder="Defaults to initial" step="0.01" type="number" />
                <Input defaultValue="USD" id="gift-currency" label="Currency" maxLength={3} name="currency" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Status</span>
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="status"
                  >
                    <option value="active">Active</option>
                    <option value="used">Used</option>
                    <option value="expired">Expired</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <Input id="expires-at" label="Expiry date optional" name="expiresAt" type="datetime-local" />
              </div>
              <Button className="w-fit" type="submit">Create gift card</Button>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Gift cards</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {giftCards.length} {giftCards.length === 1 ? "gift card" : "gift cards"}
              </h2>
            </div>
            {giftCards.length ? giftCards.map((giftCard) => (
              <Card className="grid gap-4 p-5" key={giftCard.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${statusClass(giftCard.status)}`}>
                        {giftCard.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-muted">
                        {giftCard.currency}
                      </span>
                    </div>
                    <h3 className="mt-3 font-mono text-xl font-black tracking-[-0.03em] text-ink">
                      {maskGiftCardCode(giftCard.code)}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-muted">
                      Remaining {formatMoney(giftCard.remaining_balance, giftCard.currency)} of {formatMoney(giftCard.initial_balance, giftCard.currency)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Expires {formatDate(giftCard.expires_at)}
                    </p>
                  </div>
                  <form action={updateStoreGiftCardStatusAction} className="flex flex-wrap gap-2">
                    <input name="giftCardId" type="hidden" value={giftCard.id} />
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={giftCard.status === "active" ? "disabled" : "active"}
                    />
                    <Button type="submit" variant="secondary">
                      {giftCard.status === "active" ? "Disable" : "Activate"}
                    </Button>
                  </form>
                </div>
              </Card>
            )) : (
              <Card className="border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-bold text-muted">No gift cards yet for this store.</p>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
