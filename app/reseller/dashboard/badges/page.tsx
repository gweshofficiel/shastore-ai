import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  hideBadgeOnPublicProfilePlaceholder,
  requestBadgeReviewPlaceholder,
  showBadgeOnPublicProfilePlaceholder,
  viewBadgeRequirementsPlaceholder
} from "@/lib/reseller-showcase/badge-actions";
import {
  getResellerBadgesData,
  type ResellerBadge,
  type ResellerBadgeStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type BadgesPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerBadgeStatus) {
  if (status === "earned") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "expired") {
    return "bg-red-100 text-red-700";
  }

  if (status === "hidden") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-200 text-slate-700";
}

function BadgeHiddenFields({ badge }: { badge: ResellerBadge }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/badges" />
      <input name="badgeSlug" type="hidden" value={badge.slug} />
      <input name="badgeLabel" type="hidden" value={badge.label} />
    </>
  );
}

function BadgeActions({ badge }: { badge: ResellerBadge }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={showBadgeOnPublicProfilePlaceholder}>
        <BadgeHiddenFields badge={badge} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Show
        </button>
      </form>
      <form action={hideBadgeOnPublicProfilePlaceholder}>
        <BadgeHiddenFields badge={badge} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Hide
        </button>
      </form>
      <form action={viewBadgeRequirementsPlaceholder}>
        <BadgeHiddenFields badge={badge} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Requirements
        </button>
      </form>
      <form action={requestBadgeReviewPlaceholder}>
        <BadgeHiddenFields badge={badge} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Request review
        </button>
      </form>
    </div>
  );
}

export default async function ResellerBadgesPage({ searchParams }: BadgesPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerBadgesData()]);

  return (
    <>
      <PageHeader
        description="Manage safe trust, quality, activity, and expertise badges derived from foundation metrics."
        title="Badge System"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Badge placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Earned</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.earned}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Public</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.publicVisible}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Locked</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.locked}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Hidden</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.hidden}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {data.badges.map((badge) => (
          <Card className="p-6" key={badge.slug}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{badge.slug}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">{badge.label}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(badge.status)}`}>
                {badge.status}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">{badge.description}</p>
            <div className="mt-5 grid gap-2">
              <p className="text-sm font-black text-ink">Requirements preview</p>
              {badge.requirements.map((requirement) => (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3" key={requirement.label}>
                  <div>
                    <p className="text-sm font-black text-ink">{requirement.label}</p>
                    <p className="text-xs font-semibold text-muted">{requirement.value}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                    requirement.met ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                  }`}>
                    {requirement.met ? "met" : "needed"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <BadgeActions badge={badge} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and badge safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Public profiles show only earned and visible badges. Locked, pending, hidden, and internal badge
          states remain dashboard-only. Buyer private data, real orders, payments, ownership transfers,
          wallets, payouts, withdrawals, commissions, fake sales, and real sales counts are not exposed or created.
        </p>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
