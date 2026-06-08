import { requireDeliveryAccess } from "@/lib/delivery/access";
import {
  calculateDeliveryPerformanceMetrics,
  getDeliveryRatingsForAgent
} from "@/lib/delivery/performance-data";

export const dynamic = "force-dynamic";

function formatMinutes(value: number) {
  if (!value) {
    return "0 min";
  }

  if (value < 60) {
    return `${Math.round(value)} min`;
  }

  return `${Math.round((value / 60) * 10) / 10} hrs`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function rankClass(rank: string) {
  if (rank === "Platinum") {
    return "border-slate-200 bg-slate-950 text-white";
  }

  if (rank === "Gold") {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  if (rank === "Silver") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-orange-200 bg-orange-100 text-orange-800";
}

export default async function DeliveryPerformancePage() {
  const { agent } = await requireDeliveryAccess();
  const [metrics, ratings] = agent
    ? await Promise.all([
        calculateDeliveryPerformanceMetrics({
          agentId: agent.agentId,
          storeId: agent.storeId,
          workspaceId: agent.workspaceId
        }),
        getDeliveryRatingsForAgent({
          agentId: agent.agentId,
          storeId: agent.storeId,
          workspaceId: agent.workspaceId
        })
      ])
    : [null, []];

  return (
    <div className="grid gap-6 lg:gap-8">
      <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
          Delivery performance
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Performance & Rating
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Metrics are calculated from assigned orders, delivered orders, returns, failed deliveries, and customer ratings.
            </p>
          </div>
          {metrics ? (
            <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${rankClass(metrics.rank)}`}>
              {metrics.rank}
            </span>
          ) : null}
        </div>
      </section>

      {metrics ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Success Rate" value={`${metrics.successRate}%`} />
            <MetricCard label="Return Rate" value={`${metrics.returnRate}%`} />
            <MetricCard label="Average Rating" value={`${metrics.ratingAverage || 0}/5`} />
            <MetricCard label="Rating Count" value={metrics.ratingCount.toLocaleString()} />
            <MetricCard label="Delivered Orders" value={metrics.totalDeliveredOrders.toLocaleString()} />
            <MetricCard label="Failed Orders" value={metrics.failedOrders.toLocaleString()} />
            <MetricCard label="Returned Orders" value={metrics.returnedOrders.toLocaleString()} />
            <MetricCard label="Average Delivery Time" value={formatMinutes(metrics.averageDeliveryTime)} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Recent ratings
              </p>
              <div className="mt-4 grid gap-3">
                {ratings.length ? ratings.map((rating) => (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={rating.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-black text-slate-950">{rating.rating}/5</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        {formatDate(rating.createdAt)}
                      </p>
                    </div>
                    {rating.comment ? (
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{rating.comment}</p>
                    ) : null}
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    No customer delivery ratings yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                Future hooks prepared
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  "Auto Assignment Ranking",
                  "Delivery Bonuses",
                  "Delivery Rewards",
                  "Leaderboard",
                  "AI Assignment Scoring"
                ].map((hook) => (
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-950" key={hook}>
                    {hook}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h2 className="text-xl font-black text-slate-950">Performance unavailable</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Delivery access could not be resolved for this account.
          </p>
        </section>
      )}
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
