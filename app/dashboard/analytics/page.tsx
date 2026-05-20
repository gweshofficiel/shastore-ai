import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  commerceMigrationMessage,
  getCommerceAnalyticsSummary
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

export default async function AnalyticsPage() {
  const summary = await getCommerceAnalyticsSummary();
  const stats = [
    { label: "Total visitors", value: summary.items.visitors },
    { label: "Total orders", value: summary.items.orders },
    { label: "Conversion rate", value: `${summary.items.conversionRate}%` },
    { label: "Sales estimate", value: formatMoney(summary.items.salesEstimate) }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Shared analytics foundation for visitors, WhatsApp clicks, page views, conversions, orders, products, and sources."
        title="Analytics"
      />
      {!summary.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceMigrationMessage()}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card className="p-5 lg:p-6" key={stat.label}>
            <p className="text-sm font-bold text-muted">{stat.label}</p>
            <p className="mt-4 text-4xl font-black tracking-[-0.04em] text-ink">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Top pages and stores
          </h2>
          <div className="mt-5 grid gap-3">
            {summary.items.topSources.length ? (
              summary.items.topSources.map((source) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={`${source.sourceType}-${source.sourceSlug}`}
                >
                  <div>
                    <p className="font-bold text-ink">{source.label}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {source.sourceType}
                    </p>
                  </div>
                  <p className="text-xl font-black text-ink">{source.count}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                Analytics events will populate this list after tracking is connected.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Top products
          </h2>
          <div className="mt-5 grid gap-3">
            {summary.items.topProducts.length ? (
              summary.items.topProducts.map((product) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={product.name}
                >
                  <p className="font-bold text-ink">{product.name}</p>
                  <p className="text-xl font-black text-ink">{product.count}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                Product performance appears here as order products are captured.
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card className="p-6 lg:p-8">
        <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
          Event foundation
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Page views", summary.items.pageViews],
            ["Visitors", summary.items.visitors],
            ["WhatsApp clicks", summary.items.whatsappClicks],
            ["Conversions", summary.items.conversions],
            ["Orders", summary.items.orders]
          ].map(([label, value]) => (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={label}>
              <p className="text-sm font-bold text-muted">{label}</p>
              <p className="mt-3 text-3xl font-black text-ink">{value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
