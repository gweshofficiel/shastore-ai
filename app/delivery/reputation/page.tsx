import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryReputationData } from "@/lib/delivery/reputation-data";

export const dynamic = "force-dynamic";

function levelClass(value: string) {
  if (value === "Elite" || value === "Platinum") {
    return "bg-slate-950 text-white";
  }

  if (value === "Gold" || value === "Excellent") {
    return "bg-amber-100 text-amber-800";
  }

  if (value === "Silver" || value === "Good") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-orange-100 text-orange-800";
}

export default async function DeliveryReputationPage() {
  const { agent } = await requireDeliveryAccess();
  const reputation = await getDeliveryReputationData(agent);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery reputation
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Rewards & Reputation Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Reputation score, delivery level, badges, reward placeholders, and future leaderboard hooks for this delivery account.
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${levelClass(reputation.level)}`}>
                {reputation.level}
              </span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Reputation Score" value={`${reputation.score}/100`} />
            <MetricCard label="Score Level" value={reputation.scoreLevel} />
            <MetricCard label="Current Level" value={reputation.level} />
            <MetricCard label="Next Level Progress" value={`${reputation.nextLevelProgress}%`} />
            <MetricCard label="Reward Points" value={reputation.rewards.rewardPointsPlaceholder.toLocaleString()} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Reputation metrics
              </p>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Success Rate" value={`${reputation.metrics.successRate}%`} />
                <InfoRow label="Average Rating" value={`${reputation.metrics.averageRating}/5`} />
                <InfoRow label="Completed Deliveries" value={reputation.metrics.completedDeliveries.toLocaleString()} />
                <InfoRow label="Return Rate" value={`${reputation.metrics.returnRate}%`} />
                <InfoRow label="Incident Count" value={reputation.metrics.incidentCount.toLocaleString()} />
                <InfoRow label="COD Reliability" value={`${reputation.metrics.codReliability}%`} />
                <InfoRow label="On-time Rate" value={`${reputation.metrics.onTimeRatePlaceholder}% placeholder`} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                Badges
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {reputation.badges.length ? reputation.badges.map((badge) => (
                  <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" key={badge}>
                    {badge}
                  </span>
                )) : (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-sm font-bold text-emerald-800">
                    Badges unlock as delivery performance, ratings, COD reliability, and incident history improve.
                  </div>
                )}
              </div>
              <div className="mt-6 rounded-2xl bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                  Rewards foundation
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
                  Reward points placeholder: {reputation.rewards.rewardPointsPlaceholder.toLocaleString()} · Monthly bonus placeholder: {reputation.rewards.monthlyBonusPlaceholder.toLocaleString()} · Recognition: {reputation.rewards.recognitionBadgePlaceholder}
                </p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                  No wallet · No payout · No withdrawal
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Future hooks prepared
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
              Leaderboard, delivery rewards, bonus payouts, gamification, AI assignment scoring, and auto assignment priority.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
