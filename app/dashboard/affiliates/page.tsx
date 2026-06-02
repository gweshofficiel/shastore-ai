import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createStoreAffiliateAction } from "@/lib/store-affiliate-actions";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type AffiliateRow = {
  code: string;
  commission_rate: number | string;
  email: string;
  id: string;
  name: string;
  status: string;
};

type AffiliateOrderRow = {
  affiliate_id: string;
  commission_amount: number | string;
  status: string;
};

type AffiliatesData = {
  activeStore: UserStoreRow | null;
  affiliateOrders: AffiliateOrderRow[];
  affiliates: AffiliateRow[];
  error: string | null;
  stores: UserStoreRow[];
  visitCounts: Map<string, number>;
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage affiliates for that store.",
    "create-failed": "Affiliate could not be created. Apply the affiliates migration and try again.",
    created: "Affiliate created.",
    duplicate: "An affiliate with that code or email already exists for this store.",
    invalid: "Enter a valid affiliate name, email, code, and commission rate."
  };

  return value ? messages[value] ?? null : null;
}

function money(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    style: "currency"
  }).format(money(value));
}

function affiliateLink(store: UserStoreRow | null, code: string) {
  return store?.slug ? `/store/${store.slug}?aff=${encodeURIComponent(code)}` : `?aff=${encodeURIComponent(code)}`;
}

function statusClass(status: string) {
  return status === "active" || status === "approved" || status === "paid"
    ? "bg-emerald-100 text-emerald-700"
    : status === "pending"
      ? "bg-blue-100 text-blue-700"
      : "bg-red-100 text-red-700";
}

async function getAffiliatesData(selectedStoreId?: string): Promise<AffiliatesData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, affiliateOrders: [], affiliates: [], error: "Sign in to manage affiliates.", stores: [], visitCounts: new Map() };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "can_edit_stores")) {
    return { activeStore: null, affiliateOrders: [], affiliates: [], error: "You do not have permission to manage affiliates.", stores: [], visitCounts: new Map() };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      affiliateOrders: [],
      affiliates: [],
      error: storesError ? "Stores could not be loaded." : null,
      stores,
      visitCounts: new Map()
    };
  }

  const [affiliatesResult, visitsResult, ordersResult] = await Promise.all([
    supabase
      .from("store_affiliates" as never)
      .select("id, name, email, code, commission_rate, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("store_affiliate_visits" as never)
      .select("affiliate_id")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .limit(1000),
    supabase
      .from("store_affiliate_orders" as never)
      .select("affiliate_id, commission_amount, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .limit(1000)
  ]);

  if (affiliatesResult.error || visitsResult.error || ordersResult.error) {
    return {
      activeStore,
      affiliateOrders: [],
      affiliates: [],
      error: "Affiliates could not be loaded. Apply the affiliates migration.",
      stores,
      visitCounts: new Map()
    };
  }

  const visitCounts = new Map<string, number>();

  for (const visit of (visitsResult.data ?? []) as unknown as Array<{ affiliate_id?: string | null }>) {
    if (visit.affiliate_id) {
      visitCounts.set(visit.affiliate_id, (visitCounts.get(visit.affiliate_id) ?? 0) + 1);
    }
  }

  return {
    activeStore,
    affiliateOrders: (ordersResult.data ?? []) as unknown as AffiliateOrderRow[],
    affiliates: (affiliatesResult.data ?? []) as unknown as AffiliateRow[],
    error: null,
    stores,
    visitCounts
  };
}

export default async function AffiliatesPage({
  searchParams
}: {
  searchParams: Promise<{ affiliates?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, affiliateOrders, affiliates, error, stores, visitCounts } = await getAffiliatesData(query.storeId);
  const message = statusMessage(query.affiliates);
  const pendingCommission = affiliateOrders
    .filter((order) => order.status === "pending")
    .reduce((sum, order) => sum + money(order.commission_amount), 0);
  const totalCommission = affiliateOrders.reduce((sum, order) => sum + money(order.commission_amount), 0);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create store-scoped affiliate partners, share affiliate links, and track referred sales commissions."
        title="Affiliates"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{error}</p>
        </Card>
      ) : null}

      {stores.length > 1 ? (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Store</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStore?.id ?? ""} name="storeId">
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Switch store</Button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Affiliates" value={affiliates.length} />
        <MetricCard label="Visits" value={[...visitCounts.values()].reduce((sum, count) => sum + count, 0)} />
        <MetricCard label="Orders" value={affiliateOrders.length} />
        <MetricCard label="Pending commission" value={formatMoney(pendingCommission)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Create affiliate</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Commission records are created as pending. Payout approval and payment stay manual.
          </p>
          {activeStore ? (
            <form action={createStoreAffiliateAction} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input label="Name" name="name" placeholder="Partner name" required />
              <Input label="Email" name="email" placeholder="partner@example.com" required type="email" />
              <Input label="Code" name="code" placeholder="PARTNER10" required />
              <Input label="Commission rate (%)" min="0" max="100" name="commissionRate" placeholder="10" required step="0.01" type="number" />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Status</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="active" name="status">
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <Button type="submit">Create affiliate</Button>
            </form>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Affiliate partners</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore ? activeStore.name : "No store selected"}
              </h2>
            </div>
            <p className="text-sm font-bold text-muted">Total commission tracked: {formatMoney(totalCommission)}</p>
          </div>

          <div className="mt-5 grid gap-3">
            {affiliates.length ? (
              affiliates.map((affiliate) => {
                const orders = affiliateOrders.filter((order) => order.affiliate_id === affiliate.id);
                const commission = orders.reduce((sum, order) => sum + money(order.commission_amount), 0);

                return (
                  <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={affiliate.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{affiliate.code}</p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{affiliate.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-muted">{affiliate.email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(affiliate.status)}`}>
                        {affiliate.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-muted sm:grid-cols-2">
                      <p>Rate: {Number(affiliate.commission_rate)}%</p>
                      <p>Visits: {visitCounts.get(affiliate.id) ?? 0}</p>
                      <p>Orders: {orders.length}</p>
                      <p>Commission: {formatMoney(commission)}</p>
                    </div>
                    <div className="mt-4 break-all rounded-2xl border border-slate-100 bg-white p-3 font-mono text-xs font-bold text-ink">
                      {affiliateLink(activeStore, affiliate.code)}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No affiliates yet</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create affiliate partners to generate tracking links and begin recording referred sales.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}
