import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ReferralSummary = {
  pending: number;
  qualified: number;
  rewarded: number;
  total: number;
};

type ReferralRow = {
  created_at: string;
  id: string;
  referral_code: string;
  referred_email: string | null;
  referred_phone: string | null;
  status: string;
};

type ReferralsData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  referrals: ReferralRow[];
  stores: UserStoreRow[];
  summary: ReferralSummary;
};

function emptySummary(): ReferralSummary {
  return { pending: 0, qualified: 0, rewarded: 0, total: 0 };
}

function statusClass(status: string) {
  if (status === "rewarded") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "qualified") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-muted";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function getReferralsData(selectedStoreId?: string): Promise<ReferralsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to view referrals.", referrals: [], stores: [], summary: emptySummary() };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "customers.view")) {
    return { activeStore: null, error: "You do not have permission to view referrals.", referrals: [], stores: [], summary: emptySummary() };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      referrals: [],
      stores,
      summary: emptySummary()
    };
  }

  const { data, error } = await supabase
    .from("store_referrals" as never)
    .select("id, referral_code, referred_email, referred_phone, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  if (error) {
    return {
      activeStore,
      error: "Referrals could not be loaded. Apply the referrals migration.",
      referrals: [],
      stores,
      summary: emptySummary()
    };
  }

  const referrals = (data ?? []) as unknown as ReferralRow[];

  return {
    activeStore,
    error: null,
    referrals,
    stores,
    summary: {
      pending: referrals.filter((referral) => referral.status === "pending").length,
      qualified: referrals.filter((referral) => referral.status === "qualified").length,
      rewarded: referrals.filter((referral) => referral.status === "rewarded").length,
      total: referrals.length
    }
  };
}

export default async function ReferralsPage({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, referrals, stores, summary } = await getReferralsData(query.storeId);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Track customer referral codes, qualified referral orders, and future reward readiness."
        title="Referrals"
      />

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
            <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white" type="submit">
              Switch store
            </button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total referrals" value={summary.total} />
        <MetricCard label="Pending" value={summary.pending} />
        <MetricCard label="Qualified" value={summary.qualified} />
        <MetricCard label="Rewarded" value={summary.rewarded} />
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Referral activity</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore ? activeStore.name : "No store selected"}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {referrals.length ? (
            referrals.map((referral) => (
              <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4" key={referral.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {referral.referral_code}
                    </p>
                    <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-ink">
                      {referral.referred_email || referral.referred_phone || "Referred customer"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-muted">{formatDate(referral.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(referral.status)}`}>
                    {referral.status}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No referrals yet</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                Referrals will appear here after customers share their referral codes and referred buyers place orders.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}
