import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  validateBrandSetting,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import { listPlatformThemeAssets, getPlatformThemeAsset, type PlatformThemeAssetRecord } from "@/src/lib/platform-theme/platform-theme-assets";
import { compareDraftWithPublished } from "@/src/lib/platform-theme/platform-theme-draft-runtime";
import { getPlatformLocalePreviewConfig } from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import { listThemePresets, type PlatformThemePresetRecord } from "@/src/lib/platform-theme/platform-theme-presets";
import {
  validateThemeBeforePublish,
  type PlatformThemePublishValidation
} from "@/src/lib/platform-theme/platform-theme-publish-runtime";
import { getPublishedPlatformTheme } from "@/src/lib/platform-theme/public-platform-theme-resolver";
import { listThemeVersions } from "@/src/lib/platform-theme/platform-theme-versions";

export type PlatformThemeMonitoringSeverity = "critical" | "high" | "low" | "medium";

export type PlatformThemeMonitoringArea =
  | "assets"
  | "configuration"
  | "locale"
  | "presets"
  | "publishing"
  | "versions";

export type PlatformThemeMonitoringIssueType =
  | "arabic_rtl_preview_missing"
  | "archived_asset_referenced"
  | "archived_preset_referenced"
  | "asset_missing_url"
  | "deleted_asset_referenced"
  | "draft_not_published"
  | "failed_publish"
  | "french_preview_missing"
  | "invalid_color"
  | "invalid_preset_data"
  | "invalid_typography"
  | "locale_theme_config_missing"
  | "missing_asset_record"
  | "missing_favicon"
  | "missing_logo"
  | "missing_primary_color"
  | "missing_published_version"
  | "missing_typography"
  | "no_published_theme"
  | "no_version_history"
  | "outdated_published_theme"
  | "unsafe_asset_mime";

export type PlatformThemeMonitoringIssue = {
  area: PlatformThemeMonitoringArea;
  detectedAt: string;
  issueType: PlatformThemeMonitoringIssueType;
  message: string;
  severity: PlatformThemeMonitoringSeverity;
  suggestedAction: string;
};

export type PlatformThemeMonitoringFilters = {
  area?: string | null;
  issueType?: string | null;
  severity?: string | null;
};

export type PlatformThemeMonitoringOverview = {
  assetIssues: number;
  configurationIssues: number;
  criticalIssues: number;
  detectedAt: string;
  healthyAreas: number;
  highIssues: number;
  localeIssues: number;
  monitoredAssets: number;
  monitoredPresets: number;
  monitoredSettings: number;
  monitoredVersions: number;
  publishingIssues: number;
  totalIssues: number;
};

export type PlatformThemeMonitoringSummary = {
  cards: {
    assetIssues: number;
    configurationIssues: number;
    criticalIssues: number;
    highIssues: number;
    localeIssues: number;
    publishingIssues: number;
  };
  detectedAt: string;
  filterOptions: {
    areas: PlatformThemeMonitoringArea[];
    issueTypes: PlatformThemeMonitoringIssueType[];
    severities: PlatformThemeMonitoringSeverity[];
  };
  filters: {
    area: string;
    issueType: string;
    severity: string;
  };
  issues: PlatformThemeMonitoringIssue[];
  overview: PlatformThemeMonitoringOverview;
  totalIssues: number;
};

type MonitoringEventRow = {
  created_at?: string | null;
  event_type?: string | null;
  metadata?: unknown;
};

type MonitoringContext = {
  assets: PlatformThemeAssetRecord[];
  assetsById: Map<string, PlatformThemeAssetRecord>;
  detectedAt: string;
  draftComparison: Awaited<ReturnType<typeof compareDraftWithPublished>>;
  failedPublishEvents: number;
  presets: PlatformThemePresetRecord[];
  publicTheme: Awaited<ReturnType<typeof getPublishedPlatformTheme>>;
  publishValidation: PlatformThemePublishValidation;
  settings: PlatformBrandSettingRecord[];
  settingsByKey: Map<string, PlatformBrandSettingRecord>;
  versions: Awaited<ReturnType<typeof listThemeVersions>>;
};

const severities: PlatformThemeMonitoringSeverity[] = ["critical", "high", "medium", "low"];
const areas: PlatformThemeMonitoringArea[] = ["configuration", "publishing", "assets", "presets", "versions", "locale"];
const issueTypes: PlatformThemeMonitoringIssueType[] = [
  "missing_primary_color",
  "invalid_color",
  "missing_typography",
  "invalid_typography",
  "missing_logo",
  "missing_favicon",
  "draft_not_published",
  "no_published_theme",
  "failed_publish",
  "outdated_published_theme",
  "missing_asset_record",
  "archived_asset_referenced",
  "deleted_asset_referenced",
  "unsafe_asset_mime",
  "asset_missing_url",
  "archived_preset_referenced",
  "invalid_preset_data",
  "no_version_history",
  "missing_published_version",
  "arabic_rtl_preview_missing",
  "french_preview_missing",
  "locale_theme_config_missing"
];

const safePreviewMimeTypes = new Set(["image/png", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);
const colorSettingKeys = new Set(["primary_color", "secondary_color", "accent_color"]);

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function validHex(value: unknown) {
  const cleaned = text(value, 20);
  return /^#[0-9a-f]{6}$/i.test(cleaned);
}

function safePublicReference(value: Record<string, unknown>) {
  const path = text(value.path, 1000);
  const url = text(value.url, 1000);
  const assetId = text(value.assetId, 120);

  if (assetId) return true;
  if (path && path.startsWith("/") && !path.startsWith("//")) return true;

  if (url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  return Boolean(path || url);
}

function settingsMatch(
  left: Record<string, Record<string, unknown>>,
  right: Record<string, Record<string, unknown>>
) {
  const rightKeys = Object.keys(right);

  if (!rightKeys.length) {
    return false;
  }

  return rightKeys.every((key) => JSON.stringify(left[key] ?? {}) === JSON.stringify(right[key] ?? {}));
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform theme monitoring.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme monitoring.");
  }

  return admin;
}

function addIssue(
  issues: PlatformThemeMonitoringIssue[],
  input: Omit<PlatformThemeMonitoringIssue, "detectedAt">,
  detectedAt: string
) {
  issues.push({
    ...input,
    detectedAt
  });
}

function countIssues(issues: PlatformThemeMonitoringIssue[], predicate: (issue: PlatformThemeMonitoringIssue) => boolean) {
  return issues.filter(predicate).length;
}

function normalizeFilters(raw?: PlatformThemeMonitoringFilters) {
  return {
    area: areas.includes(raw?.area as PlatformThemeMonitoringArea) ? String(raw?.area) : "all",
    issueType: issueTypes.includes(raw?.issueType as PlatformThemeMonitoringIssueType) ? String(raw?.issueType) : "all",
    severity: severities.includes(raw?.severity as PlatformThemeMonitoringSeverity) ? String(raw?.severity) : "all"
  };
}

function filterIssues(issues: PlatformThemeMonitoringIssue[], filters: PlatformThemeMonitoringSummary["filters"]) {
  return issues.filter((issue) => {
    if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
    if (filters.area !== "all" && issue.area !== filters.area) return false;
    if (filters.issueType !== "all" && issue.issueType !== filters.issueType) return false;
    return true;
  });
}

async function loadMonitoringContext(): Promise<MonitoringContext> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const detectedAt = new Date().toISOString();
  const [settings, assets, presets, versions, publishValidation, publicTheme, draftComparison, monitoringResult] = await Promise.all([
    listBrandSettings(),
    listPlatformThemeAssets(),
    listThemePresets(true),
    listThemeVersions(100),
    validateThemeBeforePublish(),
    getPublishedPlatformTheme(),
    compareDraftWithPublished(),
    admin
      .from("monitoring_events" as never)
      .select("event_type, metadata, created_at")
      .eq("entity_type" as never, "admin_platform_theme_branding" as never)
      .in("event_type" as never, ["admin_platform_theme_publish", "admin_platform_theme_publish_placeholder"] as never)
      .order("created_at" as never, { ascending: false })
      .limit(100)
  ]);

  const referencedAssetIds = settings
    .flatMap((setting) => {
      const draftValue = safeRecord(setting.draftValue);
      const publishedValue = safeRecord(setting.publishedValue);
      return [text(draftValue.assetId, 120), text(publishedValue.assetId, 120)].filter(Boolean);
    });
  const missingAssetIds = referencedAssetIds.filter((assetId) => !assets.some((asset) => asset.id === assetId));

  let referencedAssets = assets;

  if (missingAssetIds.length) {
    const extraAssets = await Promise.all(missingAssetIds.map((assetId) => getPlatformThemeAsset(assetId)));
    referencedAssets = [...assets, ...extraAssets.filter((asset): asset is PlatformThemeAssetRecord => Boolean(asset))];
  }

  const monitoringEvents = (Array.isArray(monitoringResult.data) ? monitoringResult.data : []) as MonitoringEventRow[];
  const failedPublishEvents = monitoringEvents.filter((row) => {
    const metadata = safeRecord(row.metadata);
    return Boolean(text(metadata.error_message, 500));
  }).length;

  return {
    assets: referencedAssets,
    assetsById: new Map(referencedAssets.map((asset) => [asset.id, asset])),
    detectedAt,
    draftComparison,
    failedPublishEvents,
    presets,
    publicTheme,
    publishValidation,
    settings,
    settingsByKey: new Map(settings.map((setting) => [setting.settingKey, setting])),
    versions
  };
}

export async function evaluateThemeSettingHealth(context?: MonitoringContext): Promise<PlatformThemeMonitoringIssue[]> {
  const data = context ?? await loadMonitoringContext();
  const issues: PlatformThemeMonitoringIssue[] = [];
  const primary = data.settingsByKey.get("primary_color");
  const typography = data.settingsByKey.get("typography");
  const logo = data.settingsByKey.get("platform_logo");
  const favicon = data.settingsByKey.get("favicon");

  if (!primary || !validHex(safeRecord(primary.draftValue).hex)) {
    addIssue(
      issues,
      {
        area: "configuration",
        issueType: validHex(safeRecord(primary?.draftValue).hex) ? "invalid_color" : "missing_primary_color",
        message: validHex(safeRecord(primary?.draftValue).hex)
          ? "Primary color draft value is not a valid #RRGGBB hex value."
          : "Primary color is missing or empty in draft branding.",
        severity: "critical",
        suggestedAction: "Open Platform Theme settings and set a valid primary color hex value, then publish branding."
      },
      data.detectedAt
    );
  }

  for (const setting of data.settings.filter((item) => colorSettingKeys.has(item.settingKey) && item.settingKey !== "primary_color")) {
    const validation = validateBrandSetting(setting.settingKey, setting.draftValue);

    if (validation.status === "invalid") {
      addIssue(
        issues,
        {
          area: "configuration",
          issueType: "invalid_color",
          message: `${setting.settingKey.replaceAll("_", " ")} has an invalid draft color value.`,
          severity: "high",
          suggestedAction: "Correct the color hex value in draft branding before publishing."
        },
        data.detectedAt
      );
    }
  }

  if (!typography || !text(safeRecord(typography.draftValue).stack, 240)) {
    addIssue(
      issues,
      {
        area: "configuration",
        issueType: "missing_typography",
        message: "Typography stack is missing from draft branding.",
        severity: "high",
        suggestedAction: "Set a safe typography stack in draft branding and publish when ready."
      },
      data.detectedAt
    );
  } else if (validateBrandSetting("typography", typography.draftValue).status === "invalid") {
    addIssue(
      issues,
      {
        area: "configuration",
        issueType: "invalid_typography",
        message: "Typography draft value contains unsupported or unsafe font stack text.",
        severity: "medium",
        suggestedAction: "Use a safe font stack such as Inter or system sans in draft branding."
      },
      data.detectedAt
    );
  }

  if (!logo || !safePublicReference(safeRecord(logo.draftValue))) {
    addIssue(
      issues,
      {
        area: "configuration",
        issueType: "missing_logo",
        message: "Platform logo draft reference is missing or unsafe.",
        severity: "medium",
        suggestedAction: "Upload or configure a platform logo in draft branding."
      },
      data.detectedAt
    );
  }

  if (!favicon || !safePublicReference(safeRecord(favicon.draftValue))) {
    addIssue(
      issues,
      {
        area: "configuration",
        issueType: "missing_favicon",
        message: "Platform favicon draft reference is missing or unsafe.",
        severity: "low",
        suggestedAction: "Upload or configure a platform favicon in draft branding."
      },
      data.detectedAt
    );
  }

  return issues;
}

export async function evaluateThemeAssetHealth(context?: MonitoringContext): Promise<PlatformThemeMonitoringIssue[]> {
  const data = context ?? await loadMonitoringContext();
  const issues: PlatformThemeMonitoringIssue[] = [];

  for (const setting of data.settings) {
    if (setting.settingType !== "logo" && setting.settingType !== "favicon") {
      continue;
    }

    for (const [scope, value] of [
      ["draft", setting.draftValue],
      ["published", setting.publishedValue]
    ] as const) {
      const record = safeRecord(value);
      const assetId = text(record.assetId, 120);

      if (!assetId) {
        continue;
      }

      const asset = data.assetsById.get(assetId);

      if (!asset) {
        addIssue(
          issues,
          {
            area: "assets",
            issueType: "missing_asset_record",
            message: `${setting.settingKey} ${scope} references asset ${assetId}, but no asset record was found.`,
            severity: scope === "published" ? "high" : "medium",
            suggestedAction: "Re-upload the asset or remove the stale asset reference from branding settings."
          },
          data.detectedAt
        );
        continue;
      }

      if (asset.status === "archived") {
        addIssue(
          issues,
          {
            area: "assets",
            issueType: "archived_asset_referenced",
            message: `${setting.settingKey} ${scope} references archived asset "${asset.originalFilename}".`,
            severity: "high",
            suggestedAction: "Replace the archived asset reference with an active draft or published asset."
          },
          data.detectedAt
        );
      }

      if (asset.status === "deleted") {
        addIssue(
          issues,
          {
            area: "assets",
            issueType: "deleted_asset_referenced",
            message: `${setting.settingKey} ${scope} references deleted asset "${asset.originalFilename}".`,
            severity: "critical",
            suggestedAction: "Remove the deleted asset reference and upload a replacement asset."
          },
          data.detectedAt
        );
      }

      if (!safePreviewMimeTypes.has(asset.mimeType)) {
        addIssue(
          issues,
          {
            area: "assets",
            issueType: "unsafe_asset_mime",
            message: `Asset "${asset.originalFilename}" uses unsupported mime type ${asset.mimeType}.`,
            severity: "medium",
            suggestedAction: "Upload PNG, SVG, WEBP, or ICO assets for platform theme branding."
          },
          data.detectedAt
        );
      }

      if (!asset.previewUrl && !text(record.path, 1000) && !text(record.url, 1000)) {
        addIssue(
          issues,
          {
            area: "assets",
            issueType: "asset_missing_url",
            message: `Asset "${asset.originalFilename}" has no safe public URL or path reference.`,
            severity: "high",
            suggestedAction: "Publish the asset or provide a safe path/URL reference in branding settings."
          },
          data.detectedAt
        );
      }
    }
  }

  return issues;
}

export async function evaluateThemePublishingHealth(context?: MonitoringContext): Promise<PlatformThemeMonitoringIssue[]> {
  const data = context ?? await loadMonitoringContext();
  const issues: PlatformThemeMonitoringIssue[] = [];
  const unpublishedChanges = data.draftComparison.filter((item) => item.hasChanged).length;

  if (!data.publicTheme.hasPublishedTheme) {
    addIssue(
      issues,
      {
        area: "publishing",
        issueType: "no_published_theme",
        message: "No published platform theme is active for the public/admin shell.",
        severity: "critical",
        suggestedAction: "Publish platform branding when draft values are valid."
      },
      data.detectedAt
    );
  }

  if (unpublishedChanges > 0) {
    addIssue(
      issues,
      {
        area: "publishing",
        issueType: "draft_not_published",
        message: `${unpublishedChanges} brand setting(s) have draft changes that are not published.`,
        severity: data.publicTheme.hasPublishedTheme ? "medium" : "high",
        suggestedAction: "Review draft branding and publish when ready."
      },
      data.detectedAt
    );
  }

  if (data.publicTheme.hasPublishedTheme && unpublishedChanges > 0) {
    addIssue(
      issues,
      {
        area: "publishing",
        issueType: "outdated_published_theme",
        message: "Published platform theme is older than the current draft branding configuration.",
        severity: "medium",
        suggestedAction: "Compare draft and published values, then publish to refresh the live platform shell."
      },
      data.detectedAt
    );
  }

  if (!data.publishValidation.canPublish && data.publishValidation.invalidSettings.length) {
    addIssue(
      issues,
      {
        area: "publishing",
        issueType: "failed_publish",
        message: `Publish is blocked by invalid setting "${data.publishValidation.invalidSettings[0]?.settingKey ?? "unknown"}".`,
        severity: "high",
        suggestedAction: data.publishValidation.invalidSettings[0]?.message ?? "Fix invalid draft settings before publishing."
      },
      data.detectedAt
    );
  }

  if (data.failedPublishEvents > 0) {
    addIssue(
      issues,
      {
        area: "publishing",
        issueType: "failed_publish",
        message: `${data.failedPublishEvents} recent platform theme publish attempt(s) recorded errors.`,
        severity: "high",
        suggestedAction: "Review Theme Version History and resolve invalid draft settings before retrying publish."
      },
      data.detectedAt
    );
  }

  return issues;
}

function evaluatePresetHealth(context: MonitoringContext, issues: PlatformThemeMonitoringIssue[]) {
  const draftSettings = Object.fromEntries(
    context.settings.map((setting) => [setting.settingKey, safeRecord(setting.draftValue)])
  );

  for (const preset of context.presets) {
    const settingsEntries = Object.entries(preset.presetData.settings ?? {});

    for (const [settingKey, settingValue] of settingsEntries) {
      const validation = validateBrandSetting(settingKey, settingValue);

      if (validation.status === "invalid") {
        addIssue(
          issues,
          {
            area: "presets",
            issueType: "invalid_preset_data",
            message: `Preset "${preset.name}" contains invalid data for setting "${settingKey}".`,
            severity: preset.status === "active" ? "high" : "medium",
            suggestedAction: preset.isSystem
              ? "Review the system preset seed data in platform theme presets."
              : "Archive or update the custom preset with valid branding values."
          },
          context.detectedAt
        );
      }
    }

    if (preset.status === "archived" && settingsMatch(draftSettings, preset.presetData.settings)) {
      addIssue(
        issues,
        {
          area: "presets",
          issueType: "archived_preset_referenced",
          message: `Draft branding matches archived preset "${preset.name}" (${preset.presetKey}).`,
          severity: "medium",
          suggestedAction: "Apply an active preset or update draft branding before publishing."
        },
        context.detectedAt
      );
    }
  }
}

function evaluateVersionHealth(context: MonitoringContext, issues: PlatformThemeMonitoringIssue[]) {
  if (!context.versions.length) {
    addIssue(
      issues,
      {
        area: "versions",
        issueType: "no_version_history",
        message: "No platform theme version snapshots have been recorded yet.",
        severity: "low",
        suggestedAction: "Save a draft, upload an asset, or publish branding to create the first snapshot."
      },
      context.detectedAt
    );
  }

  if (!context.versions.some((version) => version.snapshotType === "published")) {
    addIssue(
      issues,
      {
        area: "versions",
        issueType: "missing_published_version",
        message: "Theme version history does not contain a published snapshot.",
        severity: "medium",
        suggestedAction: "Publish platform branding to create a published version snapshot."
      },
      context.detectedAt
    );
  }
}

function evaluateLocaleHealth(context: MonitoringContext, issues: PlatformThemeMonitoringIssue[]) {
  for (const locale of ["ar", "fr"] as const) {
    const preview = getPlatformLocalePreviewConfig(locale);

    if (!preview.label || !preview.description) {
      addIssue(
        issues,
        {
          area: "locale",
          issueType: locale === "ar" ? "arabic_rtl_preview_missing" : "french_preview_missing",
          message: `${locale === "ar" ? "Arabic RTL" : "French"} locale theme preview configuration is missing.`,
          severity: locale === "ar" ? "high" : "medium",
          suggestedAction: "Verify platform locale theme runtime configuration for preview readiness."
        },
        context.detectedAt
      );
    }

    if (!preview.typography || !preview.direction) {
      addIssue(
        issues,
        {
          area: "locale",
          issueType: "locale_theme_config_missing",
          message: `${locale.toUpperCase()} locale theme config is missing typography or direction metadata.`,
          severity: "medium",
          suggestedAction: "Review platform locale theme runtime settings for typography and direction."
        },
        context.detectedAt
      );
    }
  }

  const arabicPreview = getPlatformLocalePreviewConfig("ar");

  if (arabicPreview.direction !== "rtl") {
    addIssue(
      issues,
      {
        area: "locale",
        issueType: "arabic_rtl_preview_missing",
        message: "Arabic locale preview is not configured for RTL direction.",
        severity: "high",
        suggestedAction: "Ensure Arabic locale theme runtime resolves to RTL for platform previews."
      },
      context.detectedAt
    );
  }
}

export async function listThemeMonitoringIssues(
  rawFilters?: PlatformThemeMonitoringFilters
): Promise<PlatformThemeMonitoringSummary> {
  const context = await loadMonitoringContext();
  const filters = normalizeFilters(rawFilters);
  const issues: PlatformThemeMonitoringIssue[] = [
    ...(await evaluateThemeSettingHealth(context)),
    ...(await evaluateThemeAssetHealth(context)),
    ...(await evaluateThemePublishingHealth(context))
  ];

  evaluatePresetHealth(context, issues);
  evaluateVersionHealth(context, issues);
  evaluateLocaleHealth(context, issues);

  const filteredIssues = filterIssues(issues, filters);
  const overview = buildOverview(issues, context);

  return {
    cards: {
      assetIssues: countIssues(issues, (issue) => issue.area === "assets"),
      configurationIssues: countIssues(issues, (issue) => issue.area === "configuration"),
      criticalIssues: countIssues(issues, (issue) => issue.severity === "critical"),
      highIssues: countIssues(issues, (issue) => issue.severity === "high"),
      localeIssues: countIssues(issues, (issue) => issue.area === "locale"),
      publishingIssues: countIssues(issues, (issue) => issue.area === "publishing")
    },
    detectedAt: context.detectedAt,
    filterOptions: {
      areas,
      issueTypes,
      severities
    },
    filters,
    issues: filteredIssues,
    overview,
    totalIssues: issues.length
  };
}

function buildOverview(issues: PlatformThemeMonitoringIssue[], context: MonitoringContext): PlatformThemeMonitoringOverview {
  const areaCounts = new Map<PlatformThemeMonitoringArea, number>();

  for (const area of areas) {
    areaCounts.set(area, countIssues(issues, (issue) => issue.area === area));
  }

  const healthyAreas = areas.filter((area) => (areaCounts.get(area) ?? 0) === 0).length;

  return {
    assetIssues: areaCounts.get("assets") ?? 0,
    configurationIssues: areaCounts.get("configuration") ?? 0,
    criticalIssues: countIssues(issues, (issue) => issue.severity === "critical"),
    detectedAt: context.detectedAt,
    healthyAreas,
    highIssues: countIssues(issues, (issue) => issue.severity === "high"),
    localeIssues: areaCounts.get("locale") ?? 0,
    monitoredAssets: context.assets.length,
    monitoredPresets: context.presets.length,
    monitoredSettings: context.settings.length,
    monitoredVersions: context.versions.length,
    publishingIssues: areaCounts.get("publishing") ?? 0,
    totalIssues: issues.length
  };
}

export async function getThemeMonitoringOverview(): Promise<PlatformThemeMonitoringOverview> {
  const summary = await listThemeMonitoringIssues();
  return summary.overview;
}

export function parsePlatformThemeMonitoringFilters(searchParams?: {
  themeMonitoringArea?: string;
  themeMonitoringIssueType?: string;
  themeMonitoringSeverity?: string;
}): PlatformThemeMonitoringFilters {
  return {
    area: searchParams?.themeMonitoringArea,
    issueType: searchParams?.themeMonitoringIssueType,
    severity: searchParams?.themeMonitoringSeverity
  };
}
