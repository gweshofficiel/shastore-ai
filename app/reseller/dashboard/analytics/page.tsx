import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  getResellerAnalyticsData,
  resellerMigrationMessage,
  type ResellerAnalyticsMetric,
  type ResellerAnalyticsRow
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams: Promise<{ range?: string }>;
};

function MetricGrid({ metrics }: { metrics: ResellerAnalyticsMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <Card className="p-5" key={metric.key}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {metric.label}
          </p>
          <p className="mt-3 text-3xl font-black text-ink">{metric.value}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{metric.note}</p>
        </Card>
      ))}
    </div>
  );
}

function PerformanceSection({
  metrics,
  title
}: {
  metrics: ResellerAnalyticsMetric[];
  title: string;
}) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <div className="rounded-3xl bg-slate-50 p-4" key={metric.key}>
            <p className="text-sm font-black text-ink">{metric.label}</p>
            <p className="mt-2 text-2xl font-black text-ink">{metric.value}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">{metric.note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnalyticsTable({
  emptyMessage,
  rows,
  title
}: {
  emptyMessage: string;
  rows: ResellerAnalyticsRow[];
  title: string;
}) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
        {rows.length ? (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={`${row.itemType}-${row.name}-${row.status}`}>
                  <td className="px-4 py-4 font-black text-ink">{row.name}</td>
                  <td className="px-4 py-4 font-semibold text-muted">{row.category}</td>
                  <td className="px-4 py-4 font-semibold text-muted">{row.status}</td>
                  <td className="px-4 py-4 font-black text-ink">{row.views}</td>
                  <td className="px-4 py-4 font-black text-ink">{row.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">{emptyMessage}</p>
        )}
      </div>
    </Card>
  );
}

export default async function ResellerAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const query = await searchParams;
  const data = await getResellerAnalyticsData(query.range);

  return (
    <>
      <PageHeader
        description="Read-only reseller analytics foundation for profile, listings, templates, leads, and marketplace visibility. Metrics are safe aggregates only."
        title="Analytics Center"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-[2rem] border border-slate-200 bg-white p-2">
        {data.filters.map((filter) => (
          <Link
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-black ${
              filter.isActive ? "bg-ink text-white" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
            }`}
            href={filter.href}
            key={filter.value}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <MetricGrid metrics={data.overview} />

      <div className="grid gap-5 xl:grid-cols-2">
        <PerformanceSection metrics={data.profilePerformance} title="Profile performance" />
        <PerformanceSection metrics={data.listingPerformance} title="Store listings performance" />
        <PerformanceSection metrics={data.templatePerformance} title="Template performance" />
        <PerformanceSection metrics={data.visibilityPerformance} title="Visibility performance" />
      </div>

      <PerformanceSection metrics={data.leadPerformance} title="Lead performance placeholder" />

      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsTable
          emptyMessage="No listing views yet. Store listing analytics will populate after real view tracking is connected."
          rows={data.topListings}
          title="Top viewed listings"
        />
        <AnalyticsTable
          emptyMessage="No template views yet. Template analytics will populate after real view tracking is connected."
          rows={data.topTemplates}
          title="Top viewed templates"
        />
        <AnalyticsTable
          emptyMessage="No category performance yet. Category analytics will populate after real tracking is connected."
          rows={data.bestCategories}
          title="Best performing categories"
        />
        <AnalyticsTable
          emptyMessage="No visibility impact yet. Featured and boost analytics are placeholders only."
          rows={data.visibilityImpact}
          title="Featured and visibility status impact"
        />
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
          Privacy and safety
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.emptyStates.map((state) => (
            <p className="rounded-3xl bg-white/70 p-4 text-sm font-bold text-amber-900" key={state}>
              {state}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold leading-7 text-amber-900">
          Analytics are aggregate-only. Buyer emails, phone numbers, private identity, wallet, payout,
          commission, and fake sales data are not collected or displayed.
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
