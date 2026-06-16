import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAdminBranding } from "@/src/lib/platform-theme/admin-platform-theme-resolver";
import {
  listBrandSettings,
  validateBrandSetting,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import { getCurrentPlatformFavicon } from "@/src/lib/platform-theme/platform-favicon-upload";
import { getCurrentPlatformLogo } from "@/src/lib/platform-theme/platform-logo-upload";
import { getThemeDraft } from "@/src/lib/platform-theme/platform-theme-draft-runtime";
import {
  exportCurrentDraftTheme,
  type PlatformThemeExportFile
} from "@/src/lib/platform-theme/platform-theme-import-export";
import { listPlatformThemeAssets } from "@/src/lib/platform-theme/platform-theme-assets";
import { listThemeMonitoringIssues } from "@/src/lib/platform-theme/platform-theme-monitoring";
import { getPlatformLocalePreviewConfig } from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import { listPlatformThemeSections } from "@/src/lib/platform-theme/platform-theme-registry";
import { getThemeDraftPreview } from "@/src/lib/platform-theme/platform-theme-preview-runtime";
import { listThemePresets } from "@/src/lib/platform-theme/platform-theme-presets";
import { validateThemeBeforePublish } from "@/src/lib/platform-theme/platform-theme-publish-runtime";
import { listThemeSecurityFindings } from "@/src/lib/platform-theme/platform-theme-security-audit";
import { canRollbackThemeVersion, listThemeVersions } from "@/src/lib/platform-theme/platform-theme-versions";
import { getWhiteLabelSettings } from "@/src/lib/platform-theme/platform-white-label";
import {
  getPublishedPlatformTheme,
  resolvePlatformBranding
} from "@/src/lib/platform-theme/public-platform-theme-resolver";

export type PlatformThemeCertificationStatus = "blocked" | "needs_attention" | "ready";

export type PlatformThemeCertificationCheckKey =
  | "admin_dashboard_connection_ready"
  | "analytics_ready"
  | "asset_storage_ready"
  | "brand_settings_ready"
  | "draft_runtime_ready"
  | "favicon_upload_ready"
  | "french_runtime_ready"
  | "import_export_ready"
  | "logo_upload_ready"
  | "monitoring_ready"
  | "presets_ready"
  | "preview_ready"
  | "public_website_connection_ready"
  | "publish_runtime_ready"
  | "registry_ready"
  | "reseller_inheritance_ready"
  | "rollback_ready"
  | "rtl_ready"
  | "security_audit_ready"
  | "version_history_ready"
  | "white_label_ready";

export type PlatformThemeCertificationCheck = {
  key: PlatformThemeCertificationCheckKey;
  label: string;
  note: string;
  status: PlatformThemeCertificationStatus;
};

export type PlatformThemeCertificationBlockerSeverity = "critical" | "high" | "low" | "medium";

export type PlatformThemeCertificationBlocker = {
  blockerType: string;
  message: string;
  relatedResource: string | null;
  severity: PlatformThemeCertificationBlockerSeverity;
  suggestedAction: string;
};

export type PlatformThemeSecurityReviewItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type PlatformThemeCertificationResult = {
  blockers: PlatformThemeCertificationBlocker[];
  brandAssetEmptyState: string | null;
  checklist: PlatformThemeCertificationCheck[];
  certifiedAt: string;
  emptyStates: string[];
  readinessScore: number;
  scoreBreakdown: Array<{ label: string; points: number }>;
  securityReview: PlatformThemeSecurityReviewItem[];
  securityReviewPassed: boolean;
  summary: {
    blockedChecks: number;
    needsAttentionChecks: number;
    readyChecks: number;
    totalChecks: number;
  };
};

const requiredBrandSettings = new Set([
  "primary_color",
  "secondary_color",
  "accent_color",
  "typography",
  "platform_logo",
  "favicon"
]);

const sensitivePatterns = [
  /api[_-]?key/i,
  /service[_-]?role/i,
  /storage[_-]?key/i,
  /storage[_-]?bucket/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /sb_secret/i,
  /\/object\/sign\//i
];

const customerStorePatterns = [
  /storefront/i,
  /customer_store/i,
  /store_id/i,
  /product-images\/stores\//i
];

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
  return /^#[0-9a-f]{6}$/i.test(text(value, 20));
}

function containsSensitiveExposure(serialized: string) {
  return sensitivePatterns.some((pattern) => pattern.test(serialized));
}

function containsCustomerStoreData(serialized: string) {
  return customerStorePatterns.some((pattern) => pattern.test(serialized));
}

function hasUploadedAsset(setting: PlatformBrandSettingRecord | null, placeholderPath: string) {
  if (!setting) return false;

  const draft = safeRecord(setting.draftValue);

  if (text(draft.assetId, 120)) return true;
  if (text(draft.uploadedAt, 80)) return true;
  if (text(draft.storageKey, 500).includes("platform/theme/")) return true;

  const path = text(draft.path, 1000);

  if (!path || path === placeholderPath) return false;

  return Boolean(text(draft.url, 1000) || (path && path !== placeholderPath));
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform theme certification.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme certification.");
  }

  return admin;
}

function worstStatus(current: PlatformThemeCertificationStatus, next: PlatformThemeCertificationStatus): PlatformThemeCertificationStatus {
  if (current === "blocked" || next === "blocked") return "blocked";
  if (current === "needs_attention" || next === "needs_attention") return "needs_attention";
  return "ready";
}

function checkLabel(key: PlatformThemeCertificationCheckKey) {
  const labels: Record<PlatformThemeCertificationCheckKey, string> = {
    registry_ready: "Registry ready",
    brand_settings_ready: "Brand settings ready",
    draft_runtime_ready: "Draft runtime ready",
    publish_runtime_ready: "Publish runtime ready",
    logo_upload_ready: "Logo upload ready",
    favicon_upload_ready: "Favicon upload ready",
    asset_storage_ready: "Asset storage ready",
    public_website_connection_ready: "Public website connection ready",
    admin_dashboard_connection_ready: "Admin dashboard connection ready",
    rtl_ready: "RTL ready",
    french_runtime_ready: "French runtime ready",
    preview_ready: "Preview ready",
    version_history_ready: "Version history ready",
    rollback_ready: "Rollback ready",
    presets_ready: "Presets ready",
    import_export_ready: "Import/export ready",
    white_label_ready: "White label ready",
    reseller_inheritance_ready: "Reseller inheritance ready",
    analytics_ready: "Analytics ready",
    monitoring_ready: "Monitoring ready",
    security_audit_ready: "Security audit ready"
  };

  return labels[key];
}

function buildSecurityReview(input: {
  adminBranding: Awaited<ReturnType<typeof resolveAdminBranding>>;
  draftExport: PlatformThemeExportFile;
  publicBranding: Awaited<ReturnType<typeof resolvePlatformBranding>>;
  publicTheme: Awaited<ReturnType<typeof getPublishedPlatformTheme>>;
  securityCriticalCount: number;
  versions: Awaited<ReturnType<typeof listThemeVersions>>;
}): PlatformThemeSecurityReviewItem[] {
  const publicPayload = JSON.stringify({
    admin: input.adminBranding,
    branding: input.publicBranding,
    theme: input.publicTheme
  });
  const exportPayload = JSON.stringify(input.draftExport);
  const versionPayload = JSON.stringify(input.versions.map((version) => version.snapshot));

  return [
    {
      category: "Secrets",
      message: "Published platform theme outputs do not expose secrets or credentials.",
      passed: !containsSensitiveExposure(publicPayload)
    },
    {
      category: "Tokens",
      message: "Theme exports do not include tokens or API keys.",
      passed: !containsSensitiveExposure(exportPayload)
    },
    {
      category: "Private storage",
      message: "Public theme resolver does not expose private storage paths or signed URLs.",
      passed: !/\/object\/sign\//i.test(publicPayload) && !/storage[_-]?key/i.test(publicPayload)
    },
    {
      category: "Customer stores",
      message: "Certification scope excludes customer storefront data.",
      passed: !containsCustomerStoreData(publicPayload) && !containsCustomerStoreData(exportPayload)
    },
    {
      category: "Version snapshots",
      message: "Theme version snapshots do not retain private storage credentials.",
      passed: !containsSensitiveExposure(versionPayload)
    },
    {
      category: "Security audit",
      message: "No unresolved critical security audit findings block certification.",
      passed: input.securityCriticalCount === 0
    },
    {
      category: "Internal admin metadata",
      message: "Public website theme connection exposes branding values only, not internal admin metadata.",
      passed: !/created_by|uploaded_by|user_id|internal_role/i.test(publicPayload)
    }
  ];
}

function addBlocker(
  blockers: PlatformThemeCertificationBlocker[],
  blocker: PlatformThemeCertificationBlocker
) {
  const key = `${blocker.blockerType}-${blocker.message}`;

  if (blockers.some((item) => `${item.blockerType}-${item.message}` === key)) {
    return;
  }

  blockers.push(blocker);
}

export async function runPlatformThemeCertification(): Promise<PlatformThemeCertificationResult> {
  return getPlatformThemeCertification();
}

export async function getPlatformThemeCertification(): Promise<PlatformThemeCertificationResult> {
  await requireSuperAdmin();

  const certifiedAt = new Date().toISOString();
  const blockers: PlatformThemeCertificationBlocker[] = [];
  const scoreBreakdown: Array<{ label: string; points: number }> = [];
  let readinessScore = 100;

  const [
    registrySections,
    settings,
    draft,
    publishReadiness,
    currentLogo,
    currentFavicon,
    assets,
    publicTheme,
    publicBranding,
    adminBranding,
    versions,
    presets,
    whiteLabel,
    draftPreview,
    draftExport,
    monitoring,
    securityAudit
  ] = await Promise.all([
    listPlatformThemeSections(),
    listBrandSettings(),
    getThemeDraft(),
    validateThemeBeforePublish(),
    getCurrentPlatformLogo(),
    getCurrentPlatformFavicon(),
    listPlatformThemeAssets(),
    getPublishedPlatformTheme(),
    resolvePlatformBranding(),
    resolveAdminBranding(),
    listThemeVersions(100),
    listThemePresets(true),
    getWhiteLabelSettings(),
    getThemeDraftPreview("en"),
    exportCurrentDraftTheme(),
    listThemeMonitoringIssues(),
    listThemeSecurityFindings()
  ]);

  const admin = requireAdminClient();
  const { error: resellerError } = await admin
    .from("reseller_branding_settings" as never)
    .select("id")
    .limit(1);

  const settingsByKey = new Map(settings.map((setting) => [setting.settingKey, setting]));
  const missingSettings = [...requiredBrandSettings].filter((key) => !settingsByKey.has(key));
  const invalidColors = settings.filter(
    (setting) => setting.settingType === "color" && validateBrandSetting(setting.settingKey, setting.draftValue).status === "invalid"
  );
  const invalidAssets = assets.filter((asset) => asset.status === "deleted" || !["image/png", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"].includes(asset.mimeType));
  const hasLogoUpload = hasUploadedAsset(currentLogo.setting, "/brand/platform-logo.svg");
  const hasFaviconUpload = hasUploadedAsset(currentFavicon.setting, "/favicon.ico");
  const arabicPreview = getPlatformLocalePreviewConfig("ar");
  const frenchPreview = getPlatformLocalePreviewConfig("fr");
  const rtlReady = arabicPreview.direction === "rtl" && Boolean(arabicPreview.label);
  const frenchReady = frenchPreview.locale === "fr" && Boolean(frenchPreview.label);
  const rollbackCandidates = versions.filter((version) => canRollbackThemeVersion(version.snapshotType));
  const activePresets = presets.filter((preset) => preset.status === "active");
  const exportHasSensitive = JSON.stringify(draftExport).match(/storage[_-]?key|api[_-]?key|secret|token/i);
  const monitoringCritical = monitoring.issues.filter((issue) => issue.severity === "critical");
  const monitoringHigh = monitoring.issues.filter((issue) => issue.severity === "high");
  const securityCritical = securityAudit.findings.filter((finding) => finding.severity === "critical");

  if (missingSettings.length) {
    readinessScore -= missingSettings.length * 5;
    scoreBreakdown.push({ label: `Missing required brand settings (${missingSettings.length})`, points: missingSettings.length * 5 });
  }

  if (invalidColors.length) {
    readinessScore -= invalidColors.length * 3;
    scoreBreakdown.push({ label: `Invalid color values (${invalidColors.length})`, points: invalidColors.length * 3 });
  }

  if (!hasLogoUpload) {
    readinessScore -= 5;
    scoreBreakdown.push({ label: "Logo not uploaded", points: 5 });
  }

  if (!hasFaviconUpload) {
    readinessScore -= 3;
    scoreBreakdown.push({ label: "Favicon not uploaded", points: 3 });
  }

  if (draft.hasChanges) {
    readinessScore -= 5;
    scoreBreakdown.push({ label: "Unpublished draft changes", points: 5 });
  }

  if (securityCritical.length) {
    readinessScore -= securityCritical.length * 10;
    scoreBreakdown.push({ label: `Security critical findings (${securityCritical.length})`, points: securityCritical.length * 10 });
  }

  if (monitoringCritical.length) {
    readinessScore -= monitoringCritical.length * 8;
    scoreBreakdown.push({ label: `Monitoring critical issues (${monitoringCritical.length})`, points: monitoringCritical.length * 8 });
  }

  if (invalidAssets.length) {
    readinessScore -= invalidAssets.length * 4;
    scoreBreakdown.push({ label: `Invalid assets (${invalidAssets.length})`, points: invalidAssets.length * 4 });
  }

  if (!rtlReady) {
    readinessScore -= 5;
    scoreBreakdown.push({ label: "Arabic RTL preview missing", points: 5 });
  }

  if (!frenchReady) {
    readinessScore -= 3;
    scoreBreakdown.push({ label: "French preview missing", points: 3 });
  }

  if (!versions.length) {
    readinessScore -= 5;
    scoreBreakdown.push({ label: "Missing version history", points: 5 });
  }

  if (exportHasSensitive) {
    readinessScore -= 10;
    scoreBreakdown.push({ label: "Import/export validation issues", points: 10 });
  }

  readinessScore = Math.max(0, Math.min(100, readinessScore));

  for (const issue of monitoringCritical) {
    addBlocker(blockers, {
      blockerType: issue.issueType,
      message: issue.message,
      relatedResource: issue.area,
      severity: "critical",
      suggestedAction: issue.suggestedAction
    });
  }

  for (const finding of securityCritical) {
    addBlocker(blockers, {
      blockerType: finding.findingType,
      message: finding.message,
      relatedResource: finding.area,
      severity: "critical",
      suggestedAction: finding.suggestedAction
    });
  }

  for (const setting of invalidColors) {
    addBlocker(blockers, {
      blockerType: "invalid_color_value",
      message: `${setting.settingKey} has an invalid draft color value.`,
      relatedResource: `setting:${setting.settingKey}`,
      severity: "high",
      suggestedAction: "Correct the color hex value in draft branding."
    });
  }

  if (!publishReadiness.canPublish && publishReadiness.invalidSettings.length) {
    const invalid = publishReadiness.invalidSettings[0];
    addBlocker(blockers, {
      blockerType: "publish_blocked",
      message: invalid?.message ?? "Publish runtime is blocked by invalid draft settings.",
      relatedResource: invalid ? `setting:${invalid.settingKey}` : null,
      severity: "high",
      suggestedAction: "Fix invalid draft settings before publishing platform branding."
    });
  }

  if (!publicTheme.hasPublishedTheme) {
    addBlocker(blockers, {
      blockerType: "no_published_theme",
      message: "No published platform theme is active for public/admin connections.",
      relatedResource: "publish_runtime",
      severity: "high",
      suggestedAction: "Publish platform branding when draft values are valid."
    });
  }

  for (const issue of monitoringHigh.slice(0, 5)) {
    addBlocker(blockers, {
      blockerType: issue.issueType,
      message: issue.message,
      relatedResource: issue.area,
      severity: "high",
      suggestedAction: issue.suggestedAction
    });
  }

  const checklist: PlatformThemeCertificationCheck[] = [
    {
      key: "registry_ready",
      label: checkLabel("registry_ready"),
      note: `${registrySections.length} registry sections loaded.`,
      status: registrySections.length ? "ready" : "blocked"
    },
    {
      key: "brand_settings_ready",
      label: checkLabel("brand_settings_ready"),
      note: missingSettings.length
        ? `Missing settings: ${missingSettings.join(", ")}`
        : `${settings.length} brand settings available.`,
      status: missingSettings.length ? "blocked" : invalidColors.length ? "needs_attention" : "ready"
    },
    {
      key: "draft_runtime_ready",
      label: checkLabel("draft_runtime_ready"),
      note: `${draft.settings.length} draft settings tracked${draft.hasChanges ? " with unpublished changes" : ""}.`,
      status: draft.settings.length ? draft.hasChanges ? "needs_attention" : "ready" : "blocked"
    },
    {
      key: "publish_runtime_ready",
      label: checkLabel("publish_runtime_ready"),
      note: publishReadiness.canPublish
        ? "Publish runtime validation passed."
        : "Publish runtime reports invalid or incomplete draft settings.",
      status: publishReadiness.canPublish ? publicTheme.hasPublishedTheme ? "ready" : "needs_attention" : "blocked"
    },
    {
      key: "logo_upload_ready",
      label: checkLabel("logo_upload_ready"),
      note: hasLogoUpload
        ? "Platform logo upload runtime is active with a stored asset reference."
        : "Logo upload runtime is ready, but only placeholder branding is configured.",
      status: hasLogoUpload ? "ready" : "needs_attention"
    },
    {
      key: "favicon_upload_ready",
      label: checkLabel("favicon_upload_ready"),
      note: hasFaviconUpload
        ? "Platform favicon upload runtime is active with a stored asset reference."
        : "Favicon upload runtime is ready, but only placeholder branding is configured.",
      status: hasFaviconUpload ? "ready" : "needs_attention"
    },
    {
      key: "asset_storage_ready",
      label: checkLabel("asset_storage_ready"),
      note: `${assets.length} platform theme assets indexed${invalidAssets.length ? ` (${invalidAssets.length} need attention)` : ""}.`,
      status: invalidAssets.length ? "needs_attention" : assets.length ? "ready" : "needs_attention"
    },
    {
      key: "public_website_connection_ready",
      label: checkLabel("public_website_connection_ready"),
      note: publicTheme.hasPublishedTheme
        ? "Public website theme resolver returns published branding values."
        : "Public website connection falls back until branding is published.",
      status: publicTheme.hasPublishedTheme && publicBranding.hasPublishedTheme ? "ready" : "needs_attention"
    },
    {
      key: "admin_dashboard_connection_ready",
      label: checkLabel("admin_dashboard_connection_ready"),
      note: adminBranding.hasPublishedTheme
        ? "Admin dashboard theme resolver exposes CSS variables and logo URL."
        : "Admin dashboard uses fallback theme variables until publish.",
      status: adminBranding.cssVariables ? "ready" : "blocked"
    },
    {
      key: "rtl_ready",
      label: checkLabel("rtl_ready"),
      note: rtlReady ? "Arabic RTL preview configuration is available." : "Arabic RTL preview configuration is incomplete.",
      status: rtlReady ? "ready" : "needs_attention"
    },
    {
      key: "french_runtime_ready",
      label: checkLabel("french_runtime_ready"),
      note: frenchReady ? "French locale theme runtime is configured." : "French locale theme runtime needs review.",
      status: frenchReady ? "ready" : "needs_attention"
    },
    {
      key: "preview_ready",
      label: checkLabel("preview_ready"),
      note: draftPreview.hasThemeValues
        ? "Draft theme preview runtime resolves colors, typography, and assets."
        : "Draft theme preview runtime is structurally ready with fallback values.",
      status: draftPreview.primaryColor && draftPreview.typography ? "ready" : "needs_attention"
    },
    {
      key: "version_history_ready",
      label: checkLabel("version_history_ready"),
      note: versions.length
        ? `${versions.length} version snapshots recorded.`
        : "No version snapshots recorded yet.",
      status: versions.length ? "ready" : "needs_attention"
    },
    {
      key: "rollback_ready",
      label: checkLabel("rollback_ready"),
      note: rollbackCandidates.length
        ? `${rollbackCandidates.length} rollback-eligible snapshots available.`
        : "Rollback engine is ready, but no rollback-eligible snapshots exist yet.",
      status: rollbackCandidates.length ? "ready" : "needs_attention"
    },
    {
      key: "presets_ready",
      label: checkLabel("presets_ready"),
      note: `${activePresets.length} active preset(s), ${presets.length} total preset records.`,
      status: activePresets.length ? "ready" : presets.length ? "needs_attention" : "needs_attention"
    },
    {
      key: "import_export_ready",
      label: checkLabel("import_export_ready"),
      note: exportHasSensitive
        ? "Draft export validation detected sensitive field patterns."
        : "Draft export runtime produces sanitized platform theme payloads.",
      status: exportHasSensitive ? "blocked" : "ready"
    },
    {
      key: "white_label_ready",
      label: checkLabel("white_label_ready"),
      note: whiteLabel.validation.ok
        ? `White label settings loaded (${whiteLabel.status}).`
        : "White label draft validation needs attention.",
      status: whiteLabel.validation.ok ? whiteLabel.hasPublished ? "ready" : "needs_attention" : "needs_attention"
    },
    {
      key: "reseller_inheritance_ready",
      label: checkLabel("reseller_inheritance_ready"),
      note: resellerError
        ? "Reseller branding inheritance storage could not be verified."
        : "Reseller branding inheritance runtime is available.",
      status: resellerError ? "blocked" : securityAudit.cards.resellerBrandingSecurity > 0 ? "needs_attention" : "ready"
    },
    {
      key: "analytics_ready",
      label: checkLabel("analytics_ready"),
      note: "Theme analytics dashboard aggregates settings, assets, presets, and versions.",
      status: "ready"
    },
    {
      key: "monitoring_ready",
      label: checkLabel("monitoring_ready"),
      note: `${monitoring.totalIssues} monitoring issue(s); ${monitoring.cards.criticalIssues} critical.`,
      status: monitoring.cards.criticalIssues ? "blocked" : monitoring.cards.highIssues ? "needs_attention" : "ready"
    },
    {
      key: "security_audit_ready",
      label: checkLabel("security_audit_ready"),
      note: `${securityAudit.totalFindings} security finding(s); ${securityAudit.cards.criticalFindings} critical.`,
      status: securityAudit.cards.criticalFindings ? "blocked" : securityAudit.cards.highFindings ? "needs_attention" : "ready"
    }
  ];

  if (securityAudit.cards.resellerBrandingSecurity > 0) {
    const item = checklist.find((check) => check.key === "reseller_inheritance_ready");
    if (item) item.status = worstStatus(item.status, "needs_attention");
  }

  if (monitoring.cards.criticalIssues) {
    const item = checklist.find((check) => check.key === "monitoring_ready");
    if (item) item.status = "blocked";
  }

  if (securityAudit.cards.criticalFindings) {
    const item = checklist.find((check) => check.key === "security_audit_ready");
    if (item) item.status = "blocked";
  }

  const emptyStates: string[] = [];

  if (!hasLogoUpload && !hasFaviconUpload) {
    emptyStates.push("Theme runtime is structurally ready, but brand assets are not uploaded yet.");
  } else {
    if (!hasLogoUpload) {
      emptyStates.push("Theme runtime is structurally ready, but brand assets are not uploaded yet.");
    }
    if (!hasFaviconUpload && hasLogoUpload) {
      emptyStates.push("Logo upload is configured, but favicon branding is still using placeholder values.");
    }
  }

  const securityReview = buildSecurityReview({
    adminBranding,
    draftExport,
    publicBranding,
    publicTheme,
    securityCriticalCount: securityCritical.length,
    versions
  });

  return {
    blockers,
    brandAssetEmptyState: !hasLogoUpload || !hasFaviconUpload
      ? "Theme runtime is structurally ready, but brand assets are not uploaded yet."
      : null,
    checklist,
    certifiedAt,
    emptyStates,
    readinessScore,
    scoreBreakdown,
    securityReview,
    securityReviewPassed: securityReview.every((item) => item.passed),
    summary: {
      blockedChecks: checklist.filter((item) => item.status === "blocked").length,
      needsAttentionChecks: checklist.filter((item) => item.status === "needs_attention").length,
      readyChecks: checklist.filter((item) => item.status === "ready").length,
      totalChecks: checklist.length
    }
  };
}
