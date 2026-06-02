import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadStoreLoyaltyOverview } from "@/lib/customer-loyalty";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LoyaltyDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  history: Awaited<ReturnType<typeof loadStoreLoyaltyOverview>>["history"];
  stores: UserStoreRow[];
  topCustomers: Awaited<ReturnType<typeof loadStoreLoyaltyOverview>>["topCustomers"];
  totalCustomersWithPoints: number;
  totalPointsIssued: number;
};

function formatDate(value: string | null) {
  if (!value) {
    return "No points yet";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(value);
}

async function getLoyaltyDashboardData(selectedStoreId?: string): Promise<LoyaltyDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      activeStore: null,
      error: "We could not verify your session. Please sign in again.",
      history: [],
      stores: [],
      topCustomers: [],
      totalCustomersWithPoints: 0,
      totalPointsIssued: 0
    };
  }

  if (!user) {
    return {
      activeStore: null,
      error: "Sign in to view loyalty points.",
      history: [],
      stores: [],
      topCustomers: [],
      totalCustomersWithPoints: 0,
      totalPointsIssued: 0
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      history: [],
      stores: [],
      topCustomers: [],
      totalCustomersWithPoints: 0,
      totalPointsIssued: 0
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      history: [],
      stores,
      topCustomers: [],
      totalCustomersWithPoints: 0,
      totalPointsIssued: 0
    };
  }

  const overview = await loadStoreLoyaltyOverview({
    storeId: activeStore.id,
    supabase,
    workspaceId
  });

  return {
    activeStore,
    error: null,
    history: overview.history,
    stores,
    topCustomers: overview.topCustomers,
    totalCustomersWithPoints: overview.totalCustomersWithPoints,
    totalPointsIssued: overview.totalPointsIssued
  };
}

export default async function LoyaltyPage({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "customers.view")) {
      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Loyalty access is assigned by workspace role."
            title="Loyalty"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view loyalty points.
            </p>
          </Card>
        </div>
      );
    }
  }

  const {
    activeStore,
    error,
    history,
    stores,
    topCustomers,
    totalCustomersWithPoints,
    totalPointsIssued
  } = await getLoyaltyDashboardData(params.storeId);
  const currency = "USD";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Basic points foundation: customers earn 1 point per 1 currency unit from paid or completed orders. Redemption is not enabled yet."
        title="Loyalty"
      />

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores in this workspace yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before viewing loyalty points.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Active Store</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.name || activeStore.store_name || "Store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Loyalty totals are calculated only from this store&apos;s paid/completed orders.
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
                      {store.name || store.store_name || store.slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View loyalty
              </Button>
            </form>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Customers with points" value={totalCustomersWithPoints} />
            <SummaryCard label="Total points issued" value={totalPointsIssued} />
            <SummaryCard label="Points rule" value="1 per 1" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="grid gap-4 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Top loyalty customers</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Highest balances</h2>
              </div>
              {topCustomers.length ? (
                <div className="grid gap-3">
                  {topCustomers.map((customer) => (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4" key={`${customer.customerId ?? customer.email ?? customer.phone}-${customer.points}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-ink">{customer.name}</p>
                          <p className="mt-1 text-xs font-semibold text-muted">
                            {customer.email || customer.phone || "No contact"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted">
                            Last earned: {formatDate(customer.lastEarnedAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                          {customer.points} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No loyalty points yet" text="Paid or completed orders will create point balances here." />
              )}
            </Card>

            <Card className="grid gap-4 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Points history</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Earned points</h2>
              </div>
              {history.length ? (
                <div className="grid gap-3">
                  {history.slice(0, 30).map((entry) => (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4" key={`${entry.orderSource}-${entry.orderId}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Order {entry.orderReference}
                          </p>
                          <p className="mt-2 text-sm font-black text-ink">{entry.customerName}</p>
                          <p className="mt-1 text-xs font-semibold text-muted">
                            {formatDate(entry.createdAt)} · {formatMoney(entry.total, currency)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                          +{entry.points} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No history yet" text="Completed order point events will appear here. Redemption is reserved for a future phase." />
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}

function EmptyState({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
