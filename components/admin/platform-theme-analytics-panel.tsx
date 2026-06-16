import Link from "next/link";
import {
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type {
  PlatformThemeAnalyticsDashboard,
  PlatformThemeAnalyticsRange,
  PlatformThemeTrendWidget
} from "@/src/lib/platform-theme/platform-theme-analytics";

const analyticsRanges: PlatformThemeAnalyticsRange[] = ["today", "last_7_days", "last_30_days", "all_time"];

function rangeLabel(range: PlatformThemeAnalyticsRange) {
  return range.replaceAll("_", " ");
}

function ThemeTrendWidget({ widget }: { widget: PlatformThemeTrendWidget }) {
  const maxValue = Math.max(...widget.points.map((point) => point.value), 1);

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{widget.label}</p>
        <p className="text-lg font-black text-slate-950">{widget.total}</p>
      </div>
      {widget.points.length ? (
        <div className="mt-5 grid gap-3">
          {widget.points.map((point) => (
            <div className="grid gap-2" key={`${widget.label}-${point.date}`}>
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                <span>{point.label}</span>
                <span>{point.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: `${Math.max(8, (point.value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm font-semibold text-slate-500">No activity recorded for this range.</p>
      )}
    </article>
  );
}

export function PlatformThemeAnalyticsPanel({ analytics }: { analytics: PlatformThemeAnalyticsDashboard }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-analytics">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Analytics</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme runtime visibility</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only analytics for platform branding usage, publishing activity, presets, assets, and version snapshots. No personal visitor data or customer storefront metrics are included.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {analyticsRanges.map((range) => (
          <Link
            className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
              analytics.range === range
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            href={`/admin/platform-theme?themeAnalyticsRange=${range}#theme-analytics`}
            key={range}
          >
            {rangeLabel(range)}
          </Link>
        ))}
      </div>

      <div className="grid gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme overview</p>
          <div className="mt-3">
            <AdminStatGrid
              stats={[
                { label: "Total settings", value: analytics.overview.totalSettings },
                { label: "Published settings", value: analytics.overview.publishedSettings },
                { label: "Draft settings", value: analytics.overview.draftSettings },
                { label: "Active assets", value: analytics.overview.activeAssets },
                { label: "Active presets", value: analytics.overview.activePresets }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Publishing</p>
          <div className="mt-3">
            <AdminStatGrid
              stats={[
                { label: "Total publishes", value: analytics.publish.totalPublishes },
                { label: "Publishes last 7 days", value: analytics.publish.publishesLast7Days },
                { label: "Publishes last 30 days", value: analytics.publish.publishesLast30Days },
                {
                  label: "Last publish date",
                  value: analytics.publish.lastPublishDate ? formatAdminDate(analytics.publish.lastPublishDate) : "Not recorded"
                },
                { label: "Publishes in range", value: analytics.publish.publishesInRange, note: rangeLabel(analytics.range) }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Assets</p>
          <div className="mt-3">
            <AdminStatGrid
              stats={[
                { label: "Logos", value: analytics.assets.logosCount },
                { label: "Favicons", value: analytics.assets.faviconsCount },
                { label: "Archived assets", value: analytics.assets.archivedAssets },
                { label: "Storage usage", value: analytics.assets.storageUsageSummary, note: "Active theme assets only" }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Presets</p>
          <div className="mt-3">
            <AdminStatGrid
              stats={[
                { label: "Total presets", value: analytics.presets.totalPresets },
                { label: "System presets", value: analytics.presets.systemPresets },
                { label: "Custom presets", value: analytics.presets.customPresets },
                {
                  label: "Most used preset",
                  value: analytics.presets.mostUsedPreset,
                  note: analytics.presets.mostUsedPresetCount
                    ? `${analytics.presets.mostUsedPresetCount} apply events in range`
                    : "No preset apply events in range"
                }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Versions</p>
          <div className="mt-3">
            <AdminStatGrid
              stats={[
                { label: "Total snapshots", value: analytics.versions.totalSnapshots },
                { label: "Snapshots in range", value: analytics.versions.snapshotsInRange },
                { label: "Rollback count", value: analytics.versions.rollbackCount },
                { label: "Latest version", value: analytics.versions.latestVersionNumber ? `#${analytics.versions.latestVersionNumber}` : "None" }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ThemeTrendWidget widget={analytics.trends.publishActivity} />
        <ThemeTrendWidget widget={analytics.trends.presetUsage} />
        <ThemeTrendWidget widget={analytics.trends.versionCreation} />
        <ThemeTrendWidget widget={analytics.trends.assetUploads} />
      </div>

      <AdminTable headers={["Analytics note", "Value"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Selected range</td>
          <td className="px-5 py-4 text-slate-600">{rangeLabel(analytics.range)}</td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Data sources</td>
          <td className="px-5 py-4 text-slate-600">Theme versions, brand settings, assets, presets, platform theme monitoring events</td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Excluded data</td>
          <td className="px-5 py-4 text-slate-600">Visitor personal data, customer stores, storage credentials, secrets</td>
        </tr>
      </AdminTable>
    </section>
  );
}
