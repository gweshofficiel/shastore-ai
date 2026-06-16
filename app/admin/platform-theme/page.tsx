import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminPlatformThemeControl } from "@/lib/admin/data";
import { PlatformThemeVersionActions } from "@/components/admin/platform-theme-version-actions";
import {
  discardPlatformBrandingDraft,
  createPresetFromCurrentDraftAction,
  previewPlatformFaviconAction,
  previewPlatformBranding,
  previewPlatformLogoAction,
  publishPlatformBrandingPlaceholder,
  publishWhiteLabelSettingsAction,
  removeDraftPlatformFaviconAction,
  removeDraftPlatformLogoAction,
  resetPlatformBrandingPlaceholder,
  savePlatformBrandingDraft,
  saveWhiteLabelDraftAction,
  uploadPlatformFaviconAction,
  uploadPlatformLogoAction
} from "@/lib/admin/platform-theme-actions";
import {
  buildPlatformDirectionAttributes,
  buildPlatformRtlClassNames
} from "@/src/lib/platform-theme/platform-rtl-runtime";
import { getPlatformLocalePreviewConfig } from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import { PlatformThemePresetActions } from "@/components/admin/platform-theme-preset-actions";
import { PlatformThemeImportExportPanel } from "@/components/admin/platform-theme-import-export-panel";
import { PlatformThemeAnalyticsPanel } from "@/components/admin/platform-theme-analytics-panel";
import { canRollbackThemeVersion, snapshotTypeLabel } from "@/src/lib/platform-theme/platform-theme-versions";
import {
  getPlatformThemeAnalyticsDashboard,
  parsePlatformThemeAnalyticsRange
} from "@/src/lib/platform-theme/platform-theme-analytics";
import {
  listThemeMonitoringIssues,
  parsePlatformThemeMonitoringFilters
} from "@/src/lib/platform-theme/platform-theme-monitoring";
import { PlatformThemeMonitoringPanel } from "@/components/admin/platform-theme-monitoring-panel";
import {
  listThemeSecurityFindings,
  parsePlatformThemeSecurityFilters
} from "@/src/lib/platform-theme/platform-theme-security-audit";
import { PlatformThemeSecurityAuditPanel } from "@/components/admin/platform-theme-security-audit-panel";
import { getPlatformThemeCertification } from "@/src/lib/platform-theme/platform-theme-certification";
import { PlatformThemeCertificationPanel } from "@/components/admin/platform-theme-certification-panel";
import {
  getPlatformThemeBranding,
  getPlatformThemeLiveRuntimeStatus
} from "@/src/lib/platform-theme/platform-theme-runtime";
import { PlatformThemeLiveRuntimePanel } from "@/components/admin/platform-theme-live-runtime-panel";
import { runThemeProductionCertification } from "@/src/lib/platform-theme/platform-theme-production-certification";
import { PlatformThemeProductionCertificationPanel } from "@/components/admin/platform-theme-production-certification-panel";

function createdByLabel(createdBy: string | null) {
  if (!createdBy) return "Not recorded";

  return createdBy.length > 12 ? `${createdBy.slice(0, 8)}…` : createdBy;
}

function toneForSnapshotType(snapshotType: string) {
  if (snapshotType === "published") return "green" as const;
  if (snapshotType === "draft_saved") return "amber" as const;
  if (snapshotType === "asset_uploaded") return "blue" as const;
  if (snapshotType === "rollback_to_draft") return "slate" as const;
  return "slate" as const;
}

function toneForStatus(status: string) {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "disabled" || status === "invalid" || status === "needs_attention") {
    return "red" as const;
  }

  if (status === "draft") {
    return "amber" as const;
  }

  return "blue" as const;
}

function formatBytes(value: number | null) {
  if (!value) return "Not recorded";

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

const themePreviewLocales = ["en", "ar", "fr"] as const;

export default async function AdminPlatformThemePage({
  searchParams
}: {
  searchParams?: Promise<{
    faviconMessage?: string;
    faviconStatus?: string;
    logoMessage?: string;
    logoStatus?: string;
    publishMessage?: string;
    publishStatus?: string;
    rollbackMessage?: string;
    rollbackStatus?: string;
    presetMessage?: string;
    presetStatus?: string;
    importExportMessage?: string;
    importExportStatus?: string;
    importSettingCount?: string;
    importWarnings?: string;
    whiteLabelMessage?: string;
    whiteLabelStatus?: string;
    themeAnalyticsRange?: string;
    themeMonitoringArea?: string;
    themeMonitoringIssueType?: string;
    themeMonitoringSeverity?: string;
    themeSecurityArea?: string;
    themeSecurityFindingType?: string;
    themeSecuritySeverity?: string;
  }>;
}) {
  const params = await searchParams;
  const themeAnalyticsRange = parsePlatformThemeAnalyticsRange(params?.themeAnalyticsRange);
  const themeMonitoringFilters = parsePlatformThemeMonitoringFilters(params);
  const themeSecurityFilters = parsePlatformThemeSecurityFilters(params);
  const control = await getAdminPlatformThemeControl();
  const [themeAnalytics, themeMonitoring, themeSecurityAudit, themeCertification, themeLiveRuntime, themeLiveBranding, themeProductionCertification] = await Promise.all([
    getPlatformThemeAnalyticsDashboard(themeAnalyticsRange),
    listThemeMonitoringIssues(themeMonitoringFilters),
    listThemeSecurityFindings(themeSecurityFilters),
    getPlatformThemeCertification(),
    getPlatformThemeLiveRuntimeStatus(),
    getPlatformThemeBranding(),
    runThemeProductionCertification()
  ]);
  const readySections = control.sections.filter((section) => section.status === "ready").length;
  const readyPublicPreviews = control.previews.publicWebsite.filter((preview) => preview.status === "ready").length;
  const readyAdminPreviews = control.previews.adminDashboard.filter((preview) => preview.status === "ready").length;
  const publishStatus = params?.publishStatus === "success" ? "success" : params?.publishStatus === "error" ? "error" : null;
  const publishMessage = params?.publishMessage;
  const faviconStatus = params?.faviconStatus === "success" ? "success" : params?.faviconStatus === "error" ? "error" : null;
  const faviconMessage = params?.faviconMessage;
  const logoStatus = params?.logoStatus === "success" ? "success" : params?.logoStatus === "error" ? "error" : null;
  const logoMessage = params?.logoMessage;
  const rollbackStatus = params?.rollbackStatus === "success" ? "success" : params?.rollbackStatus === "error" ? "error" : null;
  const rollbackMessage = params?.rollbackMessage;
  const presetStatus = params?.presetStatus === "success" ? "success" : params?.presetStatus === "error" ? "error" : null;
  const presetMessage = params?.presetMessage;
  const importExportStatus =
    params?.importExportStatus === "success"
      ? "success"
      : params?.importExportStatus === "error"
        ? "error"
        : params?.importExportStatus === "validated"
          ? "validated"
          : null;
  const importExportMessage = params?.importExportMessage;
  const importSettingCount = params?.importSettingCount ? Number(params.importSettingCount) : null;
  const importWarnings = params?.importWarnings?.split(" | ").filter(Boolean) ?? [];
  const whiteLabelStatus = params?.whiteLabelStatus === "success" ? "success" : params?.whiteLabelStatus === "error" ? "error" : null;
  const whiteLabelMessage = params?.whiteLabelMessage;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level SHASTORE branding for the SaaS interface and public website only. This does not touch Store Owner Theme Customize, store themes, storefront runtime, or template rendering."
        title="Platform Theme & Branding"
      />

      <AdminStatGrid
        stats={[
          { label: "Theme assets", value: control.assets.length },
          { label: "Public connected", value: "Yes" },
          { label: "Published active", value: control.publicTheme.hasPublishedTheme ? "Yes" : "No" },
          { label: "Admin connected", value: "Yes" },
          { label: "Admin theme active", value: control.adminTheme.hasPublishedTheme ? "Yes" : "No" },
          { label: "Brand sections", value: control.sections.length },
          { label: "Ready sections", value: readySections },
          { label: "Draft changes", value: control.draft.changedCount },
          { label: "Validation errors", value: control.draft.validationErrors.length },
          { label: "Public previews", value: `${readyPublicPreviews}/${control.previews.publicWebsite.length}` },
          { label: "Admin previews", value: `${readyAdminPreviews}/${control.previews.adminDashboard.length}` },
          { label: "RTL languages", value: control.readiness.filter((item) => item.direction === "RTL").length },
          { label: "Theme versions", value: control.versions.length },
          { label: "Theme presets", value: control.presets.filter((preset) => preset.status === "active").length },
          { label: "White label", value: control.whiteLabel.hasPublished ? "Published" : "Draft" },
          { label: "Store themes touched", value: 0 }
        ]}
      />

      {publishStatus && publishMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            publishStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={publishStatus === "success" ? "status" : "alert"}
        >
          {publishMessage}
        </div>
      ) : null}

      {logoStatus && logoMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            logoStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={logoStatus === "success" ? "status" : "alert"}
        >
          {logoMessage}
        </div>
      ) : null}

      {faviconStatus && faviconMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            faviconStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={faviconStatus === "success" ? "status" : "alert"}
        >
          {faviconMessage}
        </div>
      ) : null}

      {rollbackStatus && rollbackMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            rollbackStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={rollbackStatus === "success" ? "status" : "alert"}
        >
          {rollbackMessage}
        </div>
      ) : null}

      {presetStatus && presetMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            presetStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={presetStatus === "success" ? "status" : "alert"}
        >
          {presetMessage}
        </div>
      ) : null}

      {importExportStatus && importExportMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            importExportStatus === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : importExportStatus === "validated"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
          role={importExportStatus === "error" ? "alert" : "status"}
        >
          <p>{importExportMessage}</p>
          {typeof importSettingCount === "number" && !Number.isNaN(importSettingCount) ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
              Imported settings count: {importSettingCount}
            </p>
          ) : null}
          {importWarnings.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-semibold leading-5 opacity-90">
              {importWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {whiteLabelStatus && whiteLabelMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            whiteLabelStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={whiteLabelStatus === "success" ? "status" : "alert"}
        >
          {whiteLabelMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <button
          className="h-11 w-full rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
          form="platform-brand-settings-form"
          type="submit"
        >
          Save draft
        </button>
        <form action={previewPlatformBranding}>
          <button className="h-11 w-full rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
            Preview branding
          </button>
        </form>
        <form action={resetPlatformBrandingPlaceholder}>
          <button className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
            Reset placeholder
          </button>
        </form>
        <form action={discardPlatformBrandingDraft}>
          <button className="h-11 w-full rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
            Discard draft
          </button>
        </form>
        <form action={publishPlatformBrandingPlaceholder}>
          <button className="h-11 w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
            Publish branding
          </button>
        </form>
      </div>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Preview Runtime</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Admin-only theme previews</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Preview draft or published platform branding inside Super Admin only. Draft previews never affect the public website. Published previews mirror published values without changing live routes or storefronts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-11 items-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            href="/admin/platform-theme/preview?mode=draft&locale=en"
          >
            Preview Draft
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
            href="/admin/platform-theme/preview?mode=published&locale=en"
          >
            Preview Published
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
            href="/admin/platform-theme/preview?mode=draft&locale=en"
          >
            Preview English
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-purple-200 bg-purple-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-purple-700"
            href="/admin/platform-theme/preview?mode=draft&locale=ar"
          >
            Preview Arabic
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-indigo-200 bg-indigo-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-indigo-700"
            href="/admin/platform-theme/preview?mode=draft&locale=fr"
          >
            Preview French
          </Link>
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="platform-logo">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Platform Logo</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Logo upload runtime</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Uploading or removing a logo updates the platform branding draft only. It does not auto-publish, does not change public website rendering, and does not touch storefront logos.
            </p>
          </div>
          <AdminBadge tone={control.logo.previewUrl ? "green" : "blue"}>
            {control.logo.previewUrl ? "Draft logo configured" : "Placeholder logo"}
          </AdminBadge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <form action={uploadPlatformLogoAction} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                <span>Upload or replace logo</span>
                <input
                  accept="image/png,image/svg+xml,image/webp"
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
                  name="platformLogo"
                  required
                  type="file"
                />
              </label>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Allowed formats: PNG, SVG, WEBP. Maximum size: 5 MB. SVG files with scripts, event handlers, JavaScript URLs, or embedded foreign objects are rejected.
              </p>
              <button className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                {control.logo.previewUrl ? "Replace logo" : "Upload logo"}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <form action={removeDraftPlatformLogoAction}>
                <button className="h-11 w-full rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                  Remove draft logo
                </button>
              </form>
              <form action={previewPlatformLogoAction}>
                <button className="h-11 w-full rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                  Preview logo
                </button>
              </form>
            </div>

            <AdminTable headers={["Metadata", "Value"]}>
              {[
                ["File name", control.logo.fileName ?? "Placeholder"],
                ["MIME type", control.logo.mimeType ?? "Not recorded"],
                ["Size", formatBytes(control.logo.size)],
                ["Uploaded", control.logo.uploadedAt ?? "Not uploaded"],
                ["Storage bucket", control.logo.storageBucket ?? "Existing platform asset bucket"],
                ["Storage key", control.logo.storageKey ?? "Not stored"]
              ].map(([label, value]) => (
                <tr key={`logo-metadata-${label}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{label}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-600">{value}</td>
                </tr>
              ))}
            </AdminTable>
          </div>

          <div className="grid place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-5">
            {control.logo.previewUrl ? (
              <object
                aria-label="Platform logo preview"
                className="max-h-40 w-full rounded-2xl bg-white p-4"
                data={control.logo.previewUrl}
                type={control.logo.mimeType ?? "image/png"}
              >
                <span className="text-sm font-semibold text-slate-500">Logo preview unavailable.</span>
              </object>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-lg font-black text-slate-950">SHASTORE AI</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Placeholder logo</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="platform-favicon">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Platform Favicon</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Favicon upload runtime</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Uploading or removing a favicon updates the platform branding draft only. It does not auto-publish, does not change public website rendering, and does not touch customer storefront favicons.
            </p>
          </div>
          <AdminBadge tone={control.favicon.previewUrl ? "green" : "blue"}>
            {control.favicon.previewUrl ? "Draft favicon configured" : "Placeholder favicon"}
          </AdminBadge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
          <div className="grid gap-4">
            <form action={uploadPlatformFaviconAction} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                <span>Upload or replace favicon</span>
                <input
                  accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/webp"
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
                  name="platformFavicon"
                  required
                  type="file"
                />
              </label>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Allowed formats: ICO, PNG, SVG, WEBP. Maximum size: 1 MB. SVG files with scripts, event handlers, JavaScript URLs, or embedded foreign objects are rejected.
              </p>
              <button className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                {control.favicon.previewUrl ? "Replace favicon" : "Upload favicon"}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <form action={removeDraftPlatformFaviconAction}>
                <button className="h-11 w-full rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                  Remove draft favicon
                </button>
              </form>
              <form action={previewPlatformFaviconAction}>
                <button className="h-11 w-full rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                  Preview favicon
                </button>
              </form>
            </div>

            <AdminTable headers={["Metadata", "Value"]}>
              {[
                ["File name", control.favicon.fileName ?? "Placeholder"],
                ["MIME type", control.favicon.mimeType ?? "Not recorded"],
                ["Size", formatBytes(control.favicon.size)],
                ["Uploaded", control.favicon.uploadedAt ?? "Not uploaded"],
                ["Storage bucket", control.favicon.storageBucket ?? "Existing platform asset bucket"],
                ["Storage key", control.favicon.storageKey ?? "Not stored"]
              ].map(([label, value]) => (
                <tr key={`favicon-metadata-${label}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{label}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-600">{value}</td>
                </tr>
              ))}
            </AdminTable>
          </div>

          <div className="grid place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-5">
            {control.favicon.previewUrl ? (
              <object
                aria-label="Platform favicon preview"
                className="h-16 w-16 rounded-2xl bg-white p-2"
                data={control.favicon.previewUrl}
                type={control.favicon.mimeType ?? "image/x-icon"}
              >
                <span className="text-sm font-semibold text-slate-500">Favicon preview unavailable.</span>
              </object>
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white">
                <p className="text-sm font-black text-slate-950">S</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-assets">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Assets</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme asset storage</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Unified registry for platform theme assets uploaded by Super Admins. This table does not list customer store assets and does not expose private storage keys.
          </p>
        </div>
        <AdminTable headers={["Preview", "Asset type", "Filename", "MIME type", "Size", "Status", "Uploaded at"]}>
          {control.assets.map((asset) => (
            <tr key={`theme-asset-${asset.id}`}>
              <td className="px-5 py-4">
                {asset.previewUrl ? (
                  <object
                    aria-label={`${asset.assetType} preview`}
                    className="h-14 w-14 rounded-2xl border border-slate-200 bg-white p-2"
                    data={asset.previewUrl}
                    type={asset.mimeType}
                  >
                    <span className="text-xs font-semibold text-slate-500">Preview unavailable</span>
                  </object>
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                    <span className="text-xs font-black text-slate-400">N/A</span>
                  </div>
                )}
              </td>
              <td className="px-5 py-4 font-bold text-slate-950">{asset.assetType}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{asset.originalFilename}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{asset.mimeType}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatBytes(asset.fileSize)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(asset.status)}>{asset.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{asset.createdAt ?? "Not recorded"}</td>
            </tr>
          ))}
          {!control.assets.length ? (
            <tr>
              <td className="px-5 py-6 text-sm font-semibold text-slate-500" colSpan={7}>
                No platform theme assets have been registered yet. Logo and favicon uploads will appear here.
              </td>
            </tr>
          ) : null}
        </AdminTable>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="public-theme-connection">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Public Website Connection</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Published platform theme status</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Published platform branding is connected only to SHASTORE public platform pages and platform blog rendering. Draft values, admin dashboard styling, customer stores, and storefront theme systems are not exposed here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="green">Public website connected: yes</AdminBadge>
            <AdminBadge tone={control.publicTheme.hasPublishedTheme ? "green" : "blue"}>
              Published theme active: {control.publicTheme.hasPublishedTheme ? "yes" : "no"}
            </AdminBadge>
          </div>
        </div>
        <AdminTable headers={["Published value", "Status"]}>
          {control.publicTheme.publishedSummary.map((item) => (
            <tr key={`published-theme-${item.key}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.key}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={item.value ? "green" : "blue"}>{item.value ?? "Fallback design"}</AdminBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="admin-theme-connection">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Admin Dashboard Connection</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Published admin platform theme status</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Published platform branding is connected only to internal SHASTORE admin shell chrome and the owner dashboard sidebar. Customer storefronts, store previews, store builder canvases, template previews, and store theme systems are not connected.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="green">Admin dashboard connected: yes</AdminBadge>
            <AdminBadge tone={control.adminTheme.hasPublishedTheme ? "green" : "blue"}>
              Admin theme active: {control.adminTheme.hasPublishedTheme ? "yes" : "no"}
            </AdminBadge>
          </div>
        </div>
        <AdminTable headers={["Last applied published value", "Status"]}>
          {control.adminTheme.publishedSummary.map((item) => (
            <tr key={`admin-published-theme-${item.key}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.key}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={item.value ? "green" : "blue"}>{item.value ?? "Fallback admin design"}</AdminBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AdminBadge tone={control.publishReadiness.canPublish ? "green" : "amber"}>
            {control.publishReadiness.canPublish ? "Ready to publish" : "Publish needs attention"}
          </AdminBadge>
          <AdminBadge tone={control.publishReadiness.hasChanges ? "amber" : "blue"}>
            {control.publishReadiness.hasChanges ? "Draft changes available" : "No draft changes to publish"}
          </AdminBadge>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          Publishing copies draft values into published values only. Public website, admin dashboard styling, storefronts, and customer stores are still not connected to these values.
        </p>
        {control.publishReadiness.invalidSettings.length ? (
          <div className="grid gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {control.publishReadiness.invalidSettings.map((item) => (
              <p key={`publish-invalid-${item.settingKey}`}>{item.settingKey}: {item.message}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AdminBadge tone={control.draft.hasChanges ? "amber" : "green"}>
            {control.draft.hasChanges ? "Draft changed" : "No draft changes"}
          </AdminBadge>
          <AdminBadge tone={control.draft.validationErrors.length ? "red" : "green"}>
            {control.draft.validationErrors.length ? "Validation errors" : "Validation clear"}
          </AdminBadge>
          <span className="text-sm font-semibold text-slate-500">
            Last saved: {control.draft.lastSavedAt ?? "Not saved yet"}
          </span>
        </div>
        {control.draft.validationErrors.length ? (
          <div className="grid gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {control.draft.validationErrors.map((error) => (
              <p key={`${error.settingKey}-${error.message}`}>{error.settingKey}: {error.message}</p>
            ))}
          </div>
        ) : null}
        <p className="text-sm leading-6 text-slate-500">
          Preview Branding uses these draft values inside this Super Admin screen only. Public website, admin dashboard theme, storefronts, and customer stores are not changed.
        </p>
      </section>

      <form action={savePlatformBrandingDraft} id="platform-brand-settings-form">
        <AdminTable headers={["Branding section", "Draft value", "Published value", "Registry status", "Validation", "Description"]}>
          {control.sections.map((section) => (
            <tr key={section.label}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{section.label}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{section.settingType}</p>
                {section.draftChanged ? (
                  <div className="mt-2">
                    <AdminBadge tone="amber">changed</AdminBadge>
                  </div>
                ) : null}
              </td>
              <td className="px-5 py-4">
                <div className="flex min-w-72 items-center gap-3">
                  {section.value.startsWith("#") ? (
                    <span
                      className="h-8 w-8 rounded-full border border-slate-200"
                      style={{ backgroundColor: section.value }}
                    />
                  ) : null}
                  <input
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    name={`setting_${section.settingKey}`}
                    type="text"
                    defaultValue={section.value}
                  />
                </div>
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{section.publishedValue}</td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(section.validationStatus)}>{section.validationStatus}</AdminBadge>
                {section.validationMessage ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-red-600">{section.validationMessage}</p>
                ) : null}
              </td>
              <td className="px-5 py-4 text-slate-600">
                <p>{section.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Saved: {section.lastSavedAt ?? "not saved"}</p>
              </td>
            </tr>
          ))}
        </AdminTable>
      </form>

      <AdminTable headers={["Setting", "Draft", "Published", "Changed"]}>
        {control.draft.comparisons.map((item) => (
          <tr key={`compare-${item.settingKey}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.settingKey}</td>
            <td className="px-5 py-4 text-sm font-semibold text-slate-600">{item.draftDisplayValue}</td>
            <td className="px-5 py-4 text-sm font-semibold text-slate-600">{item.publishedDisplayValue}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={item.hasChanged ? "amber" : "green"}>{item.hasChanged ? "changed" : "same"}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Publish readiness", "Status", "Message"]}>
        {control.publishReadiness.checklist.map((item) => (
          <tr key={`publish-readiness-${item.key}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={item.ready ? "green" : "red"}>{item.ready ? "ready" : "blocked"}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{item.message}</td>
          </tr>
        ))}
      </AdminTable>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Public website preview</p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <p className="font-black tracking-[-0.03em]" style={{ color: control.branding.primaryColor }}>
                {control.branding.logo}
              </p>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                <span>Pricing</span>
                <span>Login</span>
                <span className="rounded-full px-3 py-2 text-white" style={{ backgroundColor: control.branding.primaryColor }}>
                  Start free
                </span>
              </div>
            </div>
            <div className="bg-slate-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: control.branding.secondaryColor }}>
                SHASTORE platform
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
                Launch stores with one platform brand.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Hero and button previews are platform-only placeholders for future page editor hooks.
              </p>
              <button
                className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ backgroundColor: control.branding.accentColor }}
                type="button"
              >
                Button preview
              </button>
            </div>
            <div className="bg-slate-950 px-5 py-4 text-sm font-semibold text-white">
              Footer preview placeholder
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {control.previews.publicWebsite.map((preview) => (
              <AdminBadge key={preview.label} tone={toneForStatus(preview.status)}>
                {preview.label}
              </AdminBadge>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Admin dashboard preview</p>
          <div className="mt-4 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[180px_1fr]">
            <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: control.branding.primaryColor }}>
              <p className="font-black">{control.branding.logo}</p>
              <div className="mt-5 grid gap-2 text-xs font-bold opacity-90">
                <span>Overview</span>
                <span>Platform Theme</span>
                <span>Settings</span>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-950">Card preview</p>
                <p className="mt-2 text-sm text-slate-500">Admin surfaces keep existing layout while platform branding remains isolated.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AdminBadge tone="green">Badge preview</AdminBadge>
                <button
                  className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"
                  style={{ backgroundColor: control.branding.secondaryColor }}
                  type="button"
                >
                  Button preview
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {control.previews.adminDashboard.map((preview) => (
              <AdminBadge key={preview.label} tone={toneForStatus(preview.status)}>
                {preview.label}
              </AdminBadge>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">RTL Runtime Preview</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform direction previews</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            These previews exercise platform direction attributes inside this Super Admin screen only. The admin dashboard is not forced into RTL globally, and customer storefront layouts are not changed.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {themePreviewLocales.map((locale) => {
            const preview = getPlatformLocalePreviewConfig(locale);
            const directionAttributes = buildPlatformDirectionAttributes(preview.locale);
            const directionClassName = buildPlatformRtlClassNames(preview.locale);

            return (
              <article
                className={`rounded-3xl border border-slate-200 bg-slate-50 p-5 ${directionClassName}`}
                dir={directionAttributes.dir}
                key={locale}
                lang={directionAttributes.lang}
                style={{ fontFamily: preview.typography }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{preview.label}</p>
                  <AdminBadge tone={directionAttributes.dir === "rtl" ? "amber" : "green"}>{directionAttributes.dir}</AdminBadge>
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-[-0.03em] text-slate-950" style={{ color: control.branding.primaryColor }}>
                  SHASTORE AI
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {preview.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white" style={{ backgroundColor: control.branding.accentColor }}>
                    Action
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                    Secondary
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AdminTable headers={["Language", "Direction", "Readiness"]}>
        {control.readiness.map((item) => (
          <tr key={item.language}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.language}</td>
            <td className="px-5 py-4 text-slate-600">{item.direction}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-preset-manager">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Preset Manager</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme presets</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Apply predefined presets to draft branding only. Presets never auto-publish and do not affect customer storefronts. Published theme changes only after Publish Branding.
          </p>
        </div>

        <form action={createPresetFromCurrentDraftAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Preset name</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              name="presetName"
              placeholder="Summer launch"
              required
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Preset key</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              name="presetKey"
              pattern="[a-z0-9_]{2,80}"
              placeholder="summer_launch"
              required
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Description</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              name="presetDescription"
              placeholder="Optional preset description"
              type="text"
            />
          </label>
          <button
            className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
            type="submit"
          >
            Create preset from current draft
          </button>
        </form>

        <AdminTable
          empty={!control.presets.length ? "No theme presets are available yet." : null}
          headers={["Preset", "Description", "Status", "Type", "Created", "Actions"]}
        >
          {control.presets.map((preset) => (
            <tr key={preset.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{preset.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{preset.presetKey}</p>
              </td>
              <td className="px-5 py-4 text-sm leading-6 text-slate-600">{preset.description ?? "No description"}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={preset.status === "active" ? "green" : "slate"}>{preset.status}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={preset.isSystem ? "blue" : "amber"}>{preset.isSystem ? "System" : "Custom"}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(preset.createdAt)}</td>
              <td className="px-5 py-4">
                <PlatformThemePresetActions
                  canApply={preset.status === "active"}
                  canArchive={!preset.isSystem && preset.status === "active"}
                  presetId={preset.id}
                  presetKey={preset.presetKey}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-import-export">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Import / Export</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme configuration files</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Export draft or published platform theme settings as JSON. Import applies values to draft branding only and never auto-publishes. Customer storefronts and store themes are not affected.
          </p>
        </div>
        <PlatformThemeImportExportPanel />
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="white-label-branding">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">White Label Branding</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform shell identity</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Configure platform-level brand name and support links for the admin and public website shell only. Draft changes do not affect live shell until published. Customer storefronts and reseller inheritance are not affected.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Draft preview</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{control.whiteLabel.draft.brandName}</h3>
            <p className="mt-2 text-sm text-slate-600">{control.whiteLabel.draft.legalName ?? "No legal name configured"}</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
              <p>Support email: {control.whiteLabel.draft.supportEmail ?? "Not set"}</p>
              <p>Support URL: {control.whiteLabel.draft.supportUrl ?? "Not set"}</p>
              <p>Documentation URL: {control.whiteLabel.draft.documentationUrl ?? "Not set"}</p>
              <p>Powered by: {control.whiteLabel.draft.showPoweredBy ? control.whiteLabel.draft.poweredByLabel ?? "Enabled" : "Hidden"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminBadge tone={control.whiteLabel.validation.ok ? "green" : "red"}>
                {control.whiteLabel.validation.ok ? "Valid draft" : "Invalid draft"}
              </AdminBadge>
              <AdminBadge tone={control.whiteLabel.hasDraftChanges ? "amber" : "slate"}>
                {control.whiteLabel.hasDraftChanges ? "Unpublished changes" : "Matches published"}
              </AdminBadge>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Published shell preview</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{control.whiteLabel.published.brandName}</h3>
            <p className="mt-2 text-sm text-slate-600">{control.whiteLabel.published.legalName ?? "No legal name configured"}</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
              <p>Support email: {control.whiteLabel.published.supportEmail ?? "Not set"}</p>
              <p>Support URL: {control.whiteLabel.published.supportUrl ?? "Not set"}</p>
              <p>Documentation URL: {control.whiteLabel.published.documentationUrl ?? "Not set"}</p>
              <p>Powered by: {control.whiteLabel.published.showPoweredBy ? control.whiteLabel.published.poweredByLabel ?? "Enabled" : "Hidden"}</p>
            </div>
            <div className="mt-4">
              <AdminBadge tone={control.whiteLabel.hasPublished ? "green" : "amber"}>
                {control.whiteLabel.hasPublished ? "Published shell active" : "Defaults only"}
              </AdminBadge>
            </div>
          </article>
        </div>

        {control.whiteLabel.validation.warnings.length ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-700">
            <p className="font-black uppercase tracking-[0.14em]">Validation warnings</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {control.whiteLabel.validation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <form action={saveWhiteLabelDraftAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Brand name</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.brandName}
              name="brandName"
              required
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Legal name</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.legalName ?? ""}
              name="legalName"
              placeholder="Optional legal entity name"
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Support email</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.supportEmail ?? ""}
              name="supportEmail"
              placeholder="support@example.com"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Support URL</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.supportUrl ?? ""}
              name="supportUrl"
              placeholder="https://support.example.com"
              type="url"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
            <span>Documentation URL</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.documentationUrl ?? ""}
              name="documentationUrl"
              placeholder="https://docs.example.com"
              type="url"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            <span>Powered by label</span>
            <input
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              defaultValue={control.whiteLabel.draft.poweredByLabel ?? ""}
              name="poweredByLabel"
              placeholder="Powered by SHASTORE"
              type="text"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
            <input
              defaultChecked={control.whiteLabel.draft.showPoweredBy}
              name="showPoweredBy"
              type="checkbox"
              value="true"
            />
            <span>Show powered by in public shell</span>
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <button
              className="h-11 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
              type="submit"
            >
              Save White Label Draft
            </button>
          </div>
        </form>

        <form action={publishWhiteLabelSettingsAction} className="flex flex-wrap gap-2">
          <button
            className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
            disabled={!control.whiteLabel.validation.ok}
            type="submit"
          >
            Publish White Label
          </button>
        </form>
      </section>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-version-history">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Version History</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme snapshots</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Version snapshots are recorded when drafts are saved, branding is published, assets are uploaded, or a rollback restores draft values. Rollback replaces draft values only — publish is required to make changes live.
          </p>
        </div>
        <AdminTable
          empty={!control.versions.length ? "No theme versions have been recorded yet. Save a draft, publish branding, or upload an asset to create the first snapshot." : null}
          headers={["Version", "Type", "Created", "Created by", "Note", "Changed settings", "Actions"]}
        >
          {control.versions.map((version) => (
            <tr key={version.id}>
              <td className="px-5 py-4 font-bold text-slate-950">#{version.versionNumber}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForSnapshotType(version.snapshotType)}>
                  {snapshotTypeLabel(version.snapshotType)}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(version.createdAt)}</td>
              <td className="px-5 py-4 text-xs font-semibold text-slate-500">{createdByLabel(version.createdBy)}</td>
              <td className="px-5 py-4 text-slate-600">{version.note ?? "Snapshot"}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{version.changedSettingsSummary}</td>
              <td className="px-5 py-4">
                <PlatformThemeVersionActions
                  canRollback={canRollbackThemeVersion(version.snapshotType)}
                  versionId={version.id}
                  versionNumber={version.versionNumber}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <PlatformThemeAnalyticsPanel analytics={themeAnalytics} />

      <PlatformThemeMonitoringPanel monitoring={themeMonitoring} />

      <PlatformThemeSecurityAuditPanel audit={themeSecurityAudit} />

      <PlatformThemeCertificationPanel certification={themeCertification} />

      <PlatformThemeLiveRuntimePanel runtime={themeLiveRuntime} source={themeLiveBranding.source} />

      <PlatformThemeProductionCertificationPanel certification={themeProductionCertification} />

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
