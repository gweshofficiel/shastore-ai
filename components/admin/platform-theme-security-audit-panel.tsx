import Link from "next/link";
import {
  AdminBadge,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { PlatformThemeSecurityAuditSummary } from "@/src/lib/platform-theme/platform-theme-security-audit";

function securityToneForSeverity(severity: string) {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "medium") return "amber" as const;
  return "blue" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildSecurityHref(
  audit: PlatformThemeSecurityAuditSummary,
  overrides: Partial<PlatformThemeSecurityAuditSummary["filters"]>
) {
  const params = new URLSearchParams({
    themeSecurityArea: overrides.area ?? audit.filters.area,
    themeSecurityFindingType: overrides.findingType ?? audit.filters.findingType,
    themeSecuritySeverity: overrides.severity ?? audit.filters.severity
  });

  if (audit.filters.area === "all" && !overrides.area) {
    params.delete("themeSecurityArea");
  }

  if (audit.filters.findingType === "all" && !overrides.findingType) {
    params.delete("themeSecurityFindingType");
  }

  if (audit.filters.severity === "all" && !overrides.severity) {
    params.delete("themeSecuritySeverity");
  }

  const query = params.toString();

  return query ? `/admin/platform-theme?${query}#theme-security-audit` : "/admin/platform-theme#theme-security-audit";
}

export function PlatformThemeSecurityAuditPanel({ audit }: { audit: PlatformThemeSecurityAuditSummary }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-security-audit">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Security Audit</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme runtime security</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only security audit for theme inputs, assets, imports/exports, white-label settings, and reseller branding inheritance. No secrets or private storage credentials are displayed, and no auto-fix actions are available.
        </p>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Critical findings", value: audit.cards.criticalFindings },
          { label: "High findings", value: audit.cards.highFindings },
          { label: "Asset security", value: audit.cards.assetSecurity },
          { label: "Input security", value: audit.cards.inputSecurity },
          { label: "Import/export security", value: audit.cards.importExportSecurity },
          { label: "White label security", value: audit.cards.whiteLabelSecurity },
          { label: "Reseller branding security", value: audit.cards.resellerBrandingSecurity }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Audited {audit.overview.monitoredSettings} settings, {audit.overview.monitoredAssets} assets, {audit.overview.monitoredVersions} version snapshots, and {audit.overview.monitoredResellers} reseller branding records.
        Detected at {formatAdminDate(audit.detectedAt)}.
      </p>

      <form action="/admin/platform-theme#theme-security-audit" className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[repeat(3,minmax(160px,1fr))_auto] lg:items-end" method="get">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>Severity</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={audit.filters.severity}
            name="themeSecuritySeverity"
          >
            <option value="all">All</option>
            {audit.filterOptions.severities.map((severity) => (
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
            defaultValue={audit.filters.area}
            name="themeSecurityArea"
          >
            <option value="all">All</option>
            {audit.filterOptions.areas.map((area) => (
              <option key={area} value={area}>
                {optionLabel(area)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>Finding type</span>
          <select
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={audit.filters.findingType}
            name="themeSecurityFindingType"
          >
            <option value="all">All</option>
            {audit.filterOptions.findingTypes.map((findingType) => (
              <option key={findingType} value={findingType}>
                {optionLabel(findingType)}
              </option>
            ))}
          </select>
        </label>
        <button className="h-10 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
          Filter findings
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600" href={buildSecurityHref(audit, { severity: "all", area: "all", findingType: "all" })}>
          Clear filters
        </Link>
        <Link className="inline-flex h-9 items-center rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" href={buildSecurityHref(audit, { severity: "critical" })}>
          Critical only
        </Link>
        <Link className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" href={buildSecurityHref(audit, { area: "import_export" })}>
          Import/export only
        </Link>
      </div>

      <AdminTable
        empty={!audit.findings.length ? "No platform theme security findings match the current filters." : null}
        headers={["Finding type", "Severity", "Area", "Message", "Suggested action", "Detected at"]}
      >
        {audit.findings.map((finding) => (
          <tr key={`${finding.findingType}-${finding.area}-${finding.message}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(finding.findingType)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={securityToneForSeverity(finding.severity)}>{finding.severity}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{optionLabel(finding.area)}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{finding.message}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{finding.suggestedAction}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(finding.detectedAt)}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
