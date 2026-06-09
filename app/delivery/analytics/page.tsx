import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryAnalyticsData } from "@/lib/delivery/analytics-data";

export const dynamic = "force-dynamic";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function formatMinutes(value: number) {
  if (!value) {
    return "0 min";
  }

  return value < 60 ? `${Math.round(value)} min` : `${Math.round((value / 60) * 10) / 10} hrs`;
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
    return "bg-slate-950 text-white";
  }

  if (rank === "Gold") {
    return "bg-amber-100 text-amber-800";
  }

  if (rank === "Silver") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-orange-100 text-orange-800";
}

export default async function DeliveryAnalyticsPage() {
  const { agent } = await requireDeliveryAccess();
  const data = await getDeliveryAnalyticsData(agent);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery analytics
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Operations Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Activity, performance, COD, returns, ratings, capacity usage, and productivity metrics for this delivery account.
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${rankClass(data.performance.rank)}`}>
                {data.performance.rank}
              </span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Assigned Orders" value={data.overview.assignedOrders.toLocaleString()} />
            <MetricCard label="Delivered Orders" value={data.overview.deliveredOrders.toLocaleString()} />
            <MetricCard label="Returned Orders" value={data.overview.returnedOrders.toLocaleString()} />
            <MetricCard label="COD Collected" value={formatMoney(data.overview.codCollected)} />
            <MetricCard label="COD Pending" value={formatMoney(data.overview.codPending)} />
            <MetricCard label="Average Rating" value={`${data.overview.averageRating}/5`} />
            <MetricCard label="Success Rate" value={`${data.overview.successRate}%`} />
            <MetricCard label="Capacity Usage" value={`${data.overview.currentCapacityUsage}%`} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Today Deliveries" value={data.activity.todayDeliveries.toLocaleString()} />
            <MetricCard label="Today Returns" value={data.activity.todayReturns.toLocaleString()} />
            <MetricCard label="Today Collections" value={data.activity.todayCollections.toLocaleString()} />
            <MetricCard label="Today Messages" value={data.activity.todayMessages.toLocaleString()} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Weekly Deliveries" value={data.weekly.weeklyDeliveries.toLocaleString()} />
            <MetricCard label="Weekly COD" value={formatMoney(data.weekly.weeklyCod)} />
            <MetricCard label="Weekly Rating Trend" value={`${data.weekly.weeklyRatingTrend}/5`} />
            <MetricCard label="Weekly Success Rate" value={`${data.weekly.weeklySuccessRate}%`} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Monthly Deliveries" value={data.monthly.monthlyDeliveries.toLocaleString()} />
            <MetricCard label="Monthly Returns" value={data.monthly.monthlyReturns.toLocaleString()} />
            <MetricCard label="Monthly Collections" value={formatMoney(data.monthly.monthlyCollections)} />
            <MetricCard label="Monthly Performance" value={`${data.monthly.monthlyPerformance}%`} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                Operations center
              </p>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Current Zone" value={data.operations.currentZone} />
                <InfoRow label="Availability Status" value={data.operations.availabilityStatus} />
                <InfoRow label="Current Load" value={data.operations.currentLoad.toLocaleString()} />
                <InfoRow label="Remaining Capacity" value={data.operations.remainingCapacity.toLocaleString()} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Assigned orders queue
              </p>
              <div className="mt-4 grid gap-3">
                {data.operations.assignedOrdersQueue.length ? data.operations.assignedOrdersQueue.map((order) => (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={order.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-black text-slate-950">{order.orderNumber}</p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        {order.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {order.city ?? "No city"} · {formatMoney(order.amount, order.currency)}
                    </p>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    No active assigned orders in queue.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Performance
              </p>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Success Rate" value={`${data.performance.successRate}%`} />
                <InfoRow label="Return Rate" value={`${data.performance.returnRate}%`} />
                <InfoRow label="Average Delivery Time" value={formatMinutes(data.performance.averageDeliveryTime)} />
                <InfoRow label="Rating Average" value={`${data.performance.ratingAverage}/5`} />
                <InfoRow label="Rank Badge" value={data.performance.rank} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Activity timeline
              </p>
              <div className="mt-4 grid gap-3">
                {data.timeline.length ? data.timeline.map((item, index) => (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={`${item.createdAt}-${index}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-black capitalize text-slate-950">{item.label}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-600">{item.source}</p>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    No operational activity yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Future hooks prepared
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
              Driver Leaderboard, AI Assignment Score, Delivery Rewards, Delivery Bonuses, GPS Analytics, Route Analytics, and Mobile Analytics.
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
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black capitalize text-slate-950">{value}</p>
    </div>
  );
}
