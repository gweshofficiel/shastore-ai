import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  getResellerBadgesData,
  getResellerReputationData,
  getResellerReviewsData,
  getResellerVerificationData
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function ResellerLevelsPage() {
  const [reputation, reviews, verification, badges] = await Promise.all([
    getResellerReputationData(),
    getResellerReviewsData(),
    getResellerVerificationData(),
    getResellerBadgesData()
  ]);

  return (
    <>
      <PageHeader
        description="Stabilized reseller levels route for reputation, trust, reviews, verification, and badge readiness without sales or payout scoring."
        title="Levels & Reputation"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Current level</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            {reputation.currentLevel}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            {reputation.friendlyExplanation}
          </p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-600" style={{ width: `${reputation.progress}%` }} />
          </div>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            {reputation.progress}% toward {reputation.nextLevel}
          </p>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Public trust inputs</p>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Trust score: {reputation.trustScore}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Reviews: {reviews.summary.approvedReviews} approved, {reviews.summary.pendingReviews} pending
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Verification: {verification.verifiedCount}/4 verified
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Earned badges: {badges.summary.earned}
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reputation metrics</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reputation.metrics.map((metric) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-4" key={metric.key}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-ink">{metric.value}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted">{metric.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Missing requirements</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {reputation.missingRequirements.length ? (
            reputation.missingRequirements.map((requirement) => (
              <p className="rounded-3xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900" key={requirement}>
                {requirement}
              </p>
            ))
          ) : (
            <p className="rounded-3xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
              No missing requirements for the current level foundation.
            </p>
          )}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Levels are reputation guidance only. This route does not create fake sales, wallet balances,
          payouts, commissions, ownership transfers, or public exposure of private scoring data.
        </p>
      </Card>
    </>
  );
}
