import Link from "next/link";
import {
  AdminBadge,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { PlatformThemeMonitoringSummary } from "@/src/lib/platform-theme/platform-theme-monitoring";

function monitoringToneForSeverity(severity: string) {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "medium") return "amber" as const;
  return "blue" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildMonitoringHref(
  monitoring: PlatformThemeMonitoringSummary,
  overrides: Partial<PlatformThemeMonitoringSummary["filters"]>
) {
  const params = new URLSearchParams({
    themeMonitoringArea: overrides.area ?? monitoring.filters.area,
    themeMonitoringIssueType: overrides.issueType ?? monitoring.filters.issueType,
    themeMonitoringSeverity: overrides.severity ?? monitoring.filters.severity
  });

  if (monitoring.filters.area === "all" && !overrides.area) {
    params.delete("themeMonitoringArea");
  }

  if (monitoring.filters.issueType === "all" && !overrides.issueType) {
    params.delete("themeMonitoringIssueType");
  }

  if (monitoring.filters.severity === "all" && !overrides.severity) {
    params.delete("themeMonitoringSeverity");
  }

  const query = params.toString();

  return query ? `/admin/platform-theme?${query}#theme-monitoring` : "/admin/platform-theme#theme-monitoring";
}

export function PlatformThemeMonitoringPanel({ monitoring }: { monitoring: PlatformThemeMonitoringSummary }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-monitoring">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Monitoring</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme runtime health</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only monitoring for configuration, publishing, assets, presets, versions, and locale consistency. No auto-fix actions are available and customer storefront data is excluded.
        </p>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Critical issues", value: monitoring.cards.criticalIssues },
          { label: "High issues", value: monitoring.cards.highIssues },
          { label: "Asset issues", value: monitoring.cards.assetIssues },
          { label: "Configuration issues", value: monitoring.cards.configurationIssues },
          { label: "Publishing issues", value: monitoring.cards.publishingIssues },
          { label: "Locale issues", value: monitoring.cards.localeIssues }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Monitored {monitoring.overview.monitoredSettings} settings, {monitoring.overview.monitoredAssets} assets, {monitoring.overview.monitoredPresets} presets, and {monitoring.overview.monitoredVersions} version snapshots.
        Detected at {formatAdminDate(monitoring.detectedAt)}.
      </p>

      <form action="/admin/platform-theme#theme-monitoring" className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[repeat(3,minmax(160px,1fr))_auto] lg:items-end" method="get">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>Severity</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={monitoring.filters.severity}
            name="themeMonitoringSeverity"
          >
            <option value="all">All</option>
            {monitoring.filterOptions.severities.map((severity) => (
              <option key={severity} value={severity}>
                {optionLabel(severity)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>Area</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={monitoring.filters.area}
            name="themeMonitoringArea"
          >
            <option value="all">All</option>
            {monitoring.filterOptions.areas.map((area) => (
              <option key={area} value={area}>
                {optionLabel(area)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>Issue type</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={monitoring.filters.issueType}
            name="themeMonitoringIssueType"
          >
            <option value="all">All</option>
            {monitoring.filterOptions.issueTypes.map((issueType) => (
              <option key={issueType} value={issueType}>
                {optionLabel(issueType)}
              </option>
            ))}
          </select>
        </label>
        <button className="h-10 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
          Filter issues
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600" href={buildMonitoringHref(monitoring, { severity: "all", area: "all", issueType: "all" })}>
          Clear filters
        </Link>
        <Link className="inline-flex h-9 items-center rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" href={buildMonitoringHref(monitoring, { severity: "critical" })}>
          Critical only
        </Link>
        <Link className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" href={buildMonitoringHref(monitoring, { area: "publishing" })}>
          Publishing only
        </Link>
      </div>

      <AdminTable
        empty={!monitoring.issues.length ? "No platform theme monitoring issues match the current filters." : null}
        headers={["Issue type", "Severity", "Area", "Message", "Suggested action", "Detected at"]}
      >
        {monitoring.issues.map((issue) => (
          <tr key={`${issue.issueType}-${issue.area}-${issue.message}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(issue.issueType)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={monitoringToneForSeverity(issue.severity)}>{issue.severity}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{optionLabel(issue.area)}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{issue.message}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{issue.suggestedAction}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(issue.detectedAt)}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
