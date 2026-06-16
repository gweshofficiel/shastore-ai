import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  validateBrandSetting,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import {
  exportCurrentDraftTheme,
  exportPublishedTheme,
  type PlatformThemeExportFile
} from "@/src/lib/platform-theme/platform-theme-import-export";
import { listPlatformThemeAssets, getPlatformThemeAsset, type PlatformThemeAssetRecord } from "@/src/lib/platform-theme/platform-theme-assets";
import { listThemePresets } from "@/src/lib/platform-theme/platform-theme-presets";
import { listPlatformThemeSections } from "@/src/lib/platform-theme/platform-theme-registry";
import { listThemeVersions } from "@/src/lib/platform-theme/platform-theme-versions";
import {
  getWhiteLabelSettings,
  parsePlatformWhiteLabelSettings,
  validateWhiteLabelSettings,
  type PlatformWhiteLabelRecord
} from "@/src/lib/platform-theme/platform-white-label";

export type PlatformThemeSecuritySeverity = "critical" | "high" | "low" | "medium";

export type PlatformThemeSecurityArea =
  | "assets"
  | "import_export"
  | "input"
  | "reseller_branding"
  | "white_label";

export type PlatformThemeSecurityFindingType =
  | "archived_asset_referenced"
  | "deleted_asset_referenced"
  | "export_contains_secrets"
  | "import_private_storage_credentials"
  | "import_suspicious_urls"
  | "import_unsupported_keys"
  | "invalid_color_value"
  | "invalid_external_url"
  | "invalid_inheritance_mode"
  | "invalid_support_email"
  | "invalid_typography_value"
  | "javascript_url"
  | "missing_public_safe_url"
  | "oversized_asset"
  | "private_storage_path_exposed"
  | "reseller_unsafe_custom_branding"
  | "reseller_platform_private_leak"
  | "script_tag"
  | "snapshot_contains_secrets"
  | "suspicious_powered_by_label"
  | "unsafe_documentation_url"
  | "unsafe_html"
  | "unsafe_asset_mime"
  | "unsafe_support_url"
  | "unsafe_typography_value";

export type PlatformThemeSecurityFinding = {
  area: PlatformThemeSecurityArea;
  detectedAt: string;
  findingType: PlatformThemeSecurityFindingType;
  message: string;
  severity: PlatformThemeSecuritySeverity;
  suggestedAction: string;
};

export type PlatformThemeSecurityFilters = {
  area?: string | null;
  findingType?: string | null;
  severity?: string | null;
};

export type PlatformThemeSecurityOverview = {
  assetFindings: number;
  criticalFindings: number;
  detectedAt: string;
  highFindings: number;
  importExportFindings: number;
  inputFindings: number;
  monitoredAssets: number;
  monitoredResellers: number;
  monitoredSettings: number;
  monitoredVersions: number;
  resellerBrandingFindings: number;
  totalFindings: number;
  whiteLabelFindings: number;
};

export type PlatformThemeSecurityAuditSummary = {
  cards: {
    assetSecurity: number;
    criticalFindings: number;
    highFindings: number;
    importExportSecurity: number;
    inputSecurity: number;
    resellerBrandingSecurity: number;
    whiteLabelSecurity: number;
  };
  detectedAt: string;
  filterOptions: {
    areas: PlatformThemeSecurityArea[];
    findingTypes: PlatformThemeSecurityFindingType[];
    severities: PlatformThemeSecuritySeverity[];
  };
  filters: {
    area: string;
    findingType: string;
    severity: string;
  };
  findings: PlatformThemeSecurityFinding[];
  overview: PlatformThemeSecurityOverview;
  totalFindings: number;
};

type ResellerBrandingAuditRow = {
  draftValue: Record<string, unknown>;
  inheritanceMode: string;
  publishedValue: Record<string, unknown>;
  resellerId: string;
  status: string;
};

type SecurityAuditContext = {
  assets: PlatformThemeAssetRecord[];
  assetsById: Map<string, PlatformThemeAssetRecord>;
  detectedAt: string;
  draftExport: PlatformThemeExportFile;
  publishedExport: PlatformThemeExportFile;
  registrySections: Awaited<ReturnType<typeof listPlatformThemeSections>>;
  resellerRows: ResellerBrandingAuditRow[];
  settings: PlatformBrandSettingRecord[];
  versions: Awaited<ReturnType<typeof listThemeVersions>>;
  whiteLabel: PlatformWhiteLabelRecord;
};

const severities: PlatformThemeSecuritySeverity[] = ["critical", "high", "medium", "low"];
const areas: PlatformThemeSecurityArea[] = ["input", "assets", "import_export", "white_label", "reseller_branding"];
const findingTypes: PlatformThemeSecurityFindingType[] = [
  "unsafe_html",
  "script_tag",
  "javascript_url",
  "invalid_external_url",
  "invalid_color_value",
  "unsafe_typography_value",
  "invalid_typography_value",
  "unsafe_asset_mime",
  "oversized_asset",
  "private_storage_path_exposed",
  "archived_asset_referenced",
  "deleted_asset_referenced",
  "missing_public_safe_url",
  "export_contains_secrets",
  "import_unsupported_keys",
  "import_suspicious_urls",
  "import_private_storage_credentials",
  "snapshot_contains_secrets",
  "invalid_support_email",
  "unsafe_support_url",
  "unsafe_documentation_url",
  "suspicious_powered_by_label",
  "reseller_platform_private_leak",
  "invalid_inheritance_mode",
  "reseller_unsafe_custom_branding"
];

const sensitiveKeys = new Set([
  "apiKey",
  "api_key",
  "credential",
  "password",
  "secret",
  "storageBucket",
  "storageKey",
  "storage_bucket",
  "storage_key",
  "token",
  "service_role",
  "serviceRole"
]);

const allowedSettingValueKeys = new Set([
  "assetId",
  "fileName",
  "hex",
  "mimeType",
  "mode",
  "path",
  "size",
  "stack",
  "uploadedAt",
  "url",
  "value"
]);

const allowedExportRootKeys = new Set([
  "colors",
  "exportedAt",
  "favicon",
  "format",
  "formatVersion",
  "logo",
  "metadata",
  "presetReferences",
  "settings",
  "source",
  "typography"
]);

const safePreviewMimeTypes = new Set(["image/png", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);
const maxLogoBytes = 5 * 1024 * 1024;
const maxFaviconBytes = 1024 * 1024;
const maxBrandImageBytes = 5 * 1024 * 1024;
const inheritanceModes = new Set(["inherit_platform", "custom_branding"]);

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

function containsScriptTag(value: unknown): boolean {
  if (typeof value === "string") return /<script\b/i.test(value);
  if (Array.isArray(value)) return value.some((item) => containsScriptTag(item));
  if (isRecord(value)) return Object.values(value).some((item) => containsScriptTag(item));
  return false;
}

function containsUnsafeHtml(value: unknown): boolean {
  if (typeof value === "string") {
    return /<[^>]+>/i.test(value) || /\son\w+\s*=/i.test(value);
  }

  if (Array.isArray(value)) return value.some((item) => containsUnsafeHtml(item));
  if (isRecord(value)) return Object.values(value).some((item) => containsUnsafeHtml(item));
  return false;
}

function containsJavascriptUrl(value: unknown): boolean {
  if (typeof value === "string") return /\bjavascript:/i.test(value);
  if (Array.isArray(value)) return value.some((item) => containsJavascriptUrl(item));
  if (isRecord(value)) return Object.values(value).some((item) => containsJavascriptUrl(item));
  return false;
}

function containsSensitiveKey(value: unknown, path = ""): string[] {
  const matches: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => matches.push(...containsSensitiveKey(item, `${path}[${index}]`)));
    return matches;
  }

  if (!isRecord(value)) return matches;

  for (const [key, item] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;

    if (sensitiveKeys.has(key)) {
      matches.push(nextPath);
    }

    matches.push(...containsSensitiveKey(item, nextPath));
  }

  return matches;
}

function containsUnsupportedSettingKeys(value: unknown): string[] {
  const matches: string[] = [];

  if (!isRecord(value)) return matches;

  for (const key of Object.keys(value)) {
    if (!allowedSettingValueKeys.has(key)) {
      matches.push(key);
    }
  }

  return matches;
}

function containsPrivateStorageReference(value: unknown): boolean {
  if (typeof value === "string") {
    const cleaned = value.toLowerCase();
    return (
      cleaned.includes("storage_key") ||
      cleaned.includes("storagekey") ||
      cleaned.includes("service_role") ||
      cleaned.includes("/object/sign/") ||
      cleaned.includes("sb_secret") ||
      cleaned.includes("supabase.co/storage/v1/object/authenticated/")
    );
  }

  if (Array.isArray(value)) return value.some((item) => containsPrivateStorageReference(item));
  if (isRecord(value)) {
    if ("storageKey" in value || "storage_key" in value || "storageBucket" in value || "storage_bucket" in value) {
      return true;
    }

    return Object.values(value).some((item) => containsPrivateStorageReference(item));
  }

  return false;
}

function isSuspiciousUrl(value: string) {
  const cleaned = text(value, 1000);

  if (!cleaned) return false;

  if (/\bjavascript:/i.test(cleaned) || /\bdata:/i.test(cleaned) || /\bfile:/i.test(cleaned)) {
    return true;
  }

  try {
    const parsed = new URL(cleaned);
    return parsed.protocol !== "https:" && parsed.protocol !== "http:";
  } catch {
    return cleaned.startsWith("//") || cleaned.includes("..");
  }
}

function validHttpUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validEmail(value: string) {
  if (!value) return true;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function validHex(value: unknown) {
  return /^#[0-9a-f]{6}$/i.test(text(value, 20));
}

function safePublicReference(value: Record<string, unknown>) {
  const path = text(value.path, 1000);
  const url = text(value.url, 1000);
  const assetId = text(value.assetId, 120);

  if (assetId) return true;
  if (path && path.startsWith("/") && !path.startsWith("//")) return !isSuspiciousUrl(path);

  if (url) {
    return validHttpUrl(url) && !isSuspiciousUrl(url);
  }

  return Boolean(path || url);
}

function maxBytesForAsset(asset: PlatformThemeAssetRecord) {
  if (asset.assetType === "favicon") return maxFaviconBytes;
  if (asset.assetType === "logo") return maxLogoBytes;
  return maxBrandImageBytes;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform theme security audit.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme security audit.");
  }

  return admin;
}

function addFinding(
  findings: PlatformThemeSecurityFinding[],
  input: Omit<PlatformThemeSecurityFinding, "detectedAt">,
  detectedAt: string
) {
  findings.push({ ...input, detectedAt });
}

function countFindings(findings: PlatformThemeSecurityFinding[], predicate: (finding: PlatformThemeSecurityFinding) => boolean) {
  return findings.filter(predicate).length;
}

function normalizeFilters(raw?: PlatformThemeSecurityFilters) {
  return {
    area: areas.includes(raw?.area as PlatformThemeSecurityArea) ? String(raw?.area) : "all",
    findingType: findingTypes.includes(raw?.findingType as PlatformThemeSecurityFindingType) ? String(raw?.findingType) : "all",
    severity: severities.includes(raw?.severity as PlatformThemeSecuritySeverity) ? String(raw?.severity) : "all"
  };
}

function filterFindings(findings: PlatformThemeSecurityFinding[], filters: PlatformThemeSecurityAuditSummary["filters"]) {
  return findings.filter((finding) => {
    if (filters.severity !== "all" && finding.severity !== filters.severity) return false;
    if (filters.area !== "all" && finding.area !== filters.area) return false;
    if (filters.findingType !== "all" && finding.findingType !== filters.findingType) return false;
    return true;
  });
}

async function loadResellerBrandingRows(): Promise<ResellerBrandingAuditRow[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .select("reseller_id, inheritance_mode, draft_value, published_value, status")
    .limit(500);

  if (error) {
    throw new Error(`Reseller branding security audit could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => {
      if (!isRecord(row)) return null;

      const resellerId = text(row.reseller_id, 120);

      if (!resellerId) return null;

      return {
        draftValue: safeRecord(row.draft_value),
        inheritanceMode: text(row.inheritance_mode, 40),
        publishedValue: safeRecord(row.published_value),
        resellerId,
        status: text(row.status, 40)
      } satisfies ResellerBrandingAuditRow;
    })
    .filter((row): row is ResellerBrandingAuditRow => Boolean(row));
}

async function loadSecurityAuditContext(): Promise<SecurityAuditContext> {
  await requireSuperAdmin();

  const detectedAt = new Date().toISOString();
  const [settings, assets, versions, whiteLabel, registrySections, draftExport, publishedExport, resellerRows] = await Promise.all([
    listBrandSettings(),
    listPlatformThemeAssets(),
    listThemeVersions(100),
    getWhiteLabelSettings(),
    listPlatformThemeSections(),
    exportCurrentDraftTheme(),
    exportPublishedTheme(),
    loadResellerBrandingRows()
  ]);

  const referencedAssetIds = settings.flatMap((setting) => {
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

  return {
    assets: referencedAssets,
    assetsById: new Map(referencedAssets.map((asset) => [asset.id, asset])),
    detectedAt,
    draftExport,
    publishedExport,
    registrySections,
    resellerRows,
    settings,
    versions,
    whiteLabel
  };
}

function scanSettingValues(
  findings: PlatformThemeSecurityFinding[],
  context: SecurityAuditContext,
  setting: PlatformBrandSettingRecord,
  scope: "draft" | "published",
  value: Record<string, unknown>
) {
  const label = `${setting.settingKey} (${scope})`;

  if (containsScriptTag(value)) {
    addFinding(
      findings,
      {
        area: "input",
        findingType: "script_tag",
        message: `${label} contains script tag markup.`,
        severity: "critical",
        suggestedAction: "Remove script tags from platform theme settings and use safe text or asset references only."
      },
      context.detectedAt
    );
  }

  if (containsUnsafeHtml(value)) {
    addFinding(
      findings,
      {
        area: "input",
        findingType: "unsafe_html",
        message: `${label} contains unsafe HTML or inline event handlers.`,
        severity: "high",
        suggestedAction: "Sanitize theme setting values to plain text, colors, paths, or approved asset references."
      },
      context.detectedAt
    );
  }

  if (containsJavascriptUrl(value)) {
    addFinding(
      findings,
      {
        area: "input",
        findingType: "javascript_url",
        message: `${label} contains a javascript: URL.`,
        severity: "critical",
        suggestedAction: "Replace javascript: URLs with safe https paths or uploaded assets."
      },
      context.detectedAt
    );
  }

  const unsupportedKeys = containsUnsupportedSettingKeys(value);

  if (unsupportedKeys.length) {
    addFinding(
      findings,
      {
        area: "import_export",
        findingType: "import_unsupported_keys",
        message: `${label} contains unsupported keys: ${unsupportedKeys.join(", ")}.`,
        severity: "high",
        suggestedAction: "Remove unsupported keys from branding settings before publishing or exporting."
      },
      context.detectedAt
    );
  }

  if (containsPrivateStorageReference(value)) {
    addFinding(
      findings,
      {
        area: "import_export",
        findingType: "import_private_storage_credentials",
        message: `${label} references private storage metadata or signed storage paths.`,
        severity: "critical",
        suggestedAction: "Remove storage keys, buckets, and signed URLs from theme settings; use public-safe asset references."
      },
      context.detectedAt
    );
  }

  for (const urlCandidate of [text(value.url, 1000), text(value.path, 1000)]) {
    if (!urlCandidate) continue;

    if (isSuspiciousUrl(urlCandidate)) {
      addFinding(
        findings,
        {
          area: "input",
          findingType: "invalid_external_url",
          message: `${label} contains a suspicious or invalid external URL.`,
          severity: "high",
          suggestedAction: "Use safe https URLs or root-relative public paths in theme settings."
        },
        context.detectedAt
      );
    }
  }

  if (setting.settingType === "color") {
    const hex = text(value.hex, 20);

    if (hex && !validHex(hex)) {
      addFinding(
        findings,
        {
          area: "input",
          findingType: "invalid_color_value",
          message: `${label} color value is not a valid #RRGGBB hex code.`,
          severity: "medium",
          suggestedAction: "Correct the color value to a valid hex code before publishing."
        },
        context.detectedAt
      );
    }
  }

  if (setting.settingType === "typography") {
    const validation = validateBrandSetting(setting.settingKey, value);

    if (validation.status === "invalid") {
      addFinding(
        findings,
        {
          area: "input",
          findingType: "invalid_typography_value",
          message: `${label} typography stack is invalid or unsafe.`,
          severity: "medium",
          suggestedAction: "Use an approved font stack such as Inter or system sans."
        },
        context.detectedAt
      );
    } else if (containsUnsafeHtml(value) || containsJavascriptUrl(value)) {
      addFinding(
        findings,
        {
          area: "input",
          findingType: "unsafe_typography_value",
          message: `${label} typography stack contains unsafe content.`,
          severity: "high",
          suggestedAction: "Replace typography values with safe plain-text font stacks."
        },
        context.detectedAt
      );
    }
  }
}

export async function evaluateThemeInputSecurity(context?: SecurityAuditContext): Promise<PlatformThemeSecurityFinding[]> {
  const data = context ?? await loadSecurityAuditContext();
  const findings: PlatformThemeSecurityFinding[] = [];

  for (const setting of data.settings) {
    scanSettingValues(findings, data, setting, "draft", safeRecord(setting.draftValue));
    scanSettingValues(findings, data, setting, "published", safeRecord(setting.publishedValue));
  }

  for (const section of data.registrySections) {
    if (containsScriptTag(section.value) || containsJavascriptUrl(section.value)) {
      addFinding(
        findings,
        {
          area: "input",
          findingType: "script_tag",
          message: `Registry section "${section.sectionKey}" contains unsafe script or javascript content.`,
          severity: "high",
          suggestedAction: "Review platform theme registry section values for unsafe markup."
        },
        data.detectedAt
      );
    }
  }

  return findings;
}

export async function evaluateThemeAssetSecurity(context?: SecurityAuditContext): Promise<PlatformThemeSecurityFinding[]> {
  const data = context ?? await loadSecurityAuditContext();
  const findings: PlatformThemeSecurityFinding[] = [];

  for (const asset of data.assets) {
    if (!safePreviewMimeTypes.has(asset.mimeType)) {
      addFinding(
        findings,
        {
          area: "assets",
          findingType: "unsafe_asset_mime",
          message: `Asset "${asset.originalFilename}" uses unsupported mime type ${asset.mimeType}.`,
          severity: "high",
          suggestedAction: "Replace the asset with PNG, SVG, WEBP, or ICO files approved for platform branding."
        },
        data.detectedAt
      );
    }

    if (asset.fileSize > maxBytesForAsset(asset)) {
      addFinding(
        findings,
        {
          area: "assets",
          findingType: "oversized_asset",
          message: `Asset "${asset.originalFilename}" exceeds the recommended size limit.`,
          severity: "medium",
          suggestedAction: "Compress or resize the asset to stay within platform upload limits."
        },
        data.detectedAt
      );
    }

    if (asset.previewUrl && (isSuspiciousUrl(asset.previewUrl) || asset.previewUrl.includes("/object/sign/"))) {
      addFinding(
        findings,
        {
          area: "assets",
          findingType: "private_storage_path_exposed",
          message: `Asset "${asset.originalFilename}" exposes a private or signed storage URL.`,
          severity: "critical",
          suggestedAction: "Use public-safe asset URLs or root-relative paths instead of signed storage links."
        },
        data.detectedAt
      );
    }
  }

  for (const setting of data.settings) {
    if (setting.settingType !== "logo" && setting.settingType !== "favicon") continue;

    for (const [scope, value] of [
      ["draft", setting.draftValue],
      ["published", setting.publishedValue]
    ] as const) {
      const record = safeRecord(value);
      const assetId = text(record.assetId, 120);

      if (assetId) {
        const asset = data.assetsById.get(assetId);

        if (asset?.status === "archived") {
          addFinding(
            findings,
            {
              area: "assets",
              findingType: "archived_asset_referenced",
              message: `${setting.settingKey} ${scope} references archived asset "${asset.originalFilename}".`,
              severity: "high",
              suggestedAction: "Replace archived asset references with active public-safe assets."
            },
            data.detectedAt
          );
        }

        if (asset?.status === "deleted") {
          addFinding(
            findings,
            {
              area: "assets",
              findingType: "deleted_asset_referenced",
              message: `${setting.settingKey} ${scope} references deleted asset "${asset.originalFilename}".`,
              severity: "critical",
              suggestedAction: "Remove deleted asset references and upload a replacement asset."
            },
            data.detectedAt
          );
        }
      }

      if (containsPrivateStorageReference(record)) {
        addFinding(
          findings,
          {
            area: "assets",
            findingType: "private_storage_path_exposed",
            message: `${setting.settingKey} ${scope} exposes private storage metadata.`,
            severity: "critical",
            suggestedAction: "Remove storage keys and signed URLs from branding asset references."
          },
          data.detectedAt
        );
      }

      if ((setting.settingType === "logo" || setting.settingType === "favicon") && Object.keys(record).length && !safePublicReference(record)) {
        addFinding(
          findings,
          {
            area: "assets",
            findingType: "missing_public_safe_url",
            message: `${setting.settingKey} ${scope} is missing a public-safe URL or path reference.`,
            severity: scope === "published" ? "high" : "medium",
            suggestedAction: "Provide a safe public path, https URL, or active asset reference."
          },
          data.detectedAt
        );
      }
    }
  }

  return findings;
}

function auditExportPayload(
  findings: PlatformThemeSecurityFinding[],
  context: SecurityAuditContext,
  exportFile: PlatformThemeExportFile,
  sourceLabel: string
) {
  const serialized = JSON.stringify(exportFile);
  const sensitiveMatches = containsSensitiveKey(exportFile);

  if (sensitiveMatches.length) {
    addFinding(
      findings,
      {
        area: "import_export",
        findingType: "export_contains_secrets",
        message: `${sourceLabel} export contains sensitive field names (${sensitiveMatches.slice(0, 3).join(", ")}${sensitiveMatches.length > 3 ? ", …" : ""}).`,
        severity: "critical",
        suggestedAction: "Review export sanitization and remove secrets or private storage metadata before sharing exports."
      },
      context.detectedAt
    );
  }

  for (const key of Object.keys(exportFile)) {
    if (!allowedExportRootKeys.has(key)) {
      addFinding(
        findings,
        {
          area: "import_export",
          findingType: "import_unsupported_keys",
          message: `${sourceLabel} export contains unsupported root key "${key}".`,
          severity: "high",
          suggestedAction: "Ensure export payloads only include supported platform theme keys."
        },
        context.detectedAt
      );
    }
  }

  if (containsPrivateStorageReference(exportFile) || serialized.includes("/object/sign/")) {
    addFinding(
      findings,
      {
        area: "import_export",
        findingType: "import_private_storage_credentials",
        message: `${sourceLabel} export may expose private storage references.`,
        severity: "critical",
        suggestedAction: "Strip storage keys, buckets, and signed URLs from export payloads."
      },
      context.detectedAt
    );
  }

  if (containsJavascriptUrl(exportFile) || containsScriptTag(exportFile)) {
    addFinding(
      findings,
      {
        area: "import_export",
        findingType: "import_suspicious_urls",
        message: `${sourceLabel} export contains suspicious script or javascript URL content.`,
        severity: "critical",
        suggestedAction: "Remove unsafe strings from export settings before import or sharing."
      },
      context.detectedAt
    );
  }

  for (const [settingKey, settingValue] of Object.entries(exportFile.settings ?? {})) {
    for (const urlCandidate of [text(settingValue.url, 1000), text(settingValue.path, 1000)]) {
      if (urlCandidate && isSuspiciousUrl(urlCandidate)) {
        addFinding(
          findings,
          {
            area: "import_export",
            findingType: "import_suspicious_urls",
            message: `${sourceLabel} export setting "${settingKey}" contains a suspicious URL.`,
            severity: "high",
            suggestedAction: "Replace suspicious URLs with safe https or root-relative public paths."
          },
          context.detectedAt
        );
      }
    }
  }
}

export async function evaluateThemeExportSecurity(context?: SecurityAuditContext): Promise<PlatformThemeSecurityFinding[]> {
  const data = context ?? await loadSecurityAuditContext();
  const findings: PlatformThemeSecurityFinding[] = [];

  auditExportPayload(findings, data, data.draftExport, "Draft");
  auditExportPayload(findings, data, data.publishedExport, "Published");

  for (const version of data.versions) {
    const sensitiveMatches = containsSensitiveKey(version.snapshot);

    if (sensitiveMatches.length || containsPrivateStorageReference(version.snapshot)) {
      addFinding(
        findings,
        {
          area: "import_export",
          findingType: "snapshot_contains_secrets",
          message: `Version v${version.versionNumber} snapshot may contain sensitive metadata.`,
          severity: "high",
          suggestedAction: "Review theme version snapshots and ensure storage credentials are never persisted."
        },
        data.detectedAt
      );
    }
  }

  const presets = await listThemePresets(true);

  for (const preset of presets) {
    if (containsPrivateStorageReference(preset.presetData) || containsJavascriptUrl(preset.presetData)) {
      addFinding(
        findings,
        {
          area: "import_export",
          findingType: "import_suspicious_urls",
          message: `Preset "${preset.name}" contains suspicious URLs or private storage references.`,
          severity: preset.status === "active" ? "high" : "medium",
          suggestedAction: "Sanitize preset data to remove private storage paths and suspicious URLs."
        },
        data.detectedAt
      );
    }
  }

  return findings;
}

function auditWhiteLabelScope(
  findings: PlatformThemeSecurityFinding[],
  context: SecurityAuditContext,
  scope: "draft" | "published",
  settings: ReturnType<typeof parsePlatformWhiteLabelSettings>,
  area: PlatformThemeSecurityArea
) {
  const label = scope === "draft" ? "draft" : "published";

  if (settings.supportEmail && !validEmail(settings.supportEmail)) {
    addFinding(
      findings,
      {
        area,
        findingType: "invalid_support_email",
        message: `${label} support email is invalid.`,
        severity: "medium",
        suggestedAction: "Provide a valid support email address or leave the field empty."
      },
      context.detectedAt
    );
  }

  if (settings.supportUrl && (!validHttpUrl(settings.supportUrl) || isSuspiciousUrl(settings.supportUrl))) {
    addFinding(
      findings,
      {
        area,
        findingType: "unsafe_support_url",
        message: `${label} support URL is unsafe or invalid.`,
        severity: "high",
        suggestedAction: "Use a valid https support URL without javascript or data schemes."
      },
      context.detectedAt
    );
  }

  if (settings.documentationUrl && (!validHttpUrl(settings.documentationUrl) || isSuspiciousUrl(settings.documentationUrl))) {
    addFinding(
      findings,
      {
        area,
        findingType: "unsafe_documentation_url",
        message: `${label} documentation URL is unsafe or invalid.`,
        severity: "high",
        suggestedAction: "Use a valid https documentation URL."
      },
      context.detectedAt
    );
  }

  if (
    settings.poweredByLabel &&
    (containsUnsafeHtml(settings.poweredByLabel) || containsScriptTag(settings.poweredByLabel) || containsJavascriptUrl(settings.poweredByLabel))
  ) {
    addFinding(
      findings,
      {
        area,
        findingType: "suspicious_powered_by_label",
        message: `${label} powered-by label contains suspicious HTML or script content.`,
        severity: "high",
        suggestedAction: "Use plain text for the powered-by label."
      },
      context.detectedAt
    );
  }

  if (containsPrivateStorageReference(settings)) {
    addFinding(
      findings,
      {
        area,
        findingType: "reseller_platform_private_leak",
        message: `${label} white-label values reference private storage metadata.`,
        severity: "critical",
        suggestedAction: "Remove private storage references from white-label settings."
      },
      context.detectedAt
    );
  }
}

export async function evaluateWhiteLabelSecurity(context?: SecurityAuditContext): Promise<PlatformThemeSecurityFinding[]> {
  const data = context ?? await loadSecurityAuditContext();
  const findings: PlatformThemeSecurityFinding[] = [];

  auditWhiteLabelScope(findings, data, "draft", data.whiteLabel.draft, "white_label");

  if (data.whiteLabel.hasPublished) {
    auditWhiteLabelScope(findings, data, "published", data.whiteLabel.published, "white_label");
  }

  const draftValidation = validateWhiteLabelSettings(data.whiteLabel.draft);

  for (const error of draftValidation.errors) {
    if (error.toLowerCase().includes("email")) {
      addFinding(
        findings,
        {
          area: "white_label",
          findingType: "invalid_support_email",
          message: `White-label draft validation failed: ${error}`,
          severity: "medium",
          suggestedAction: "Correct the support email in white-label draft settings."
        },
        data.detectedAt
      );
    }
  }

  return findings;
}

function evaluateResellerBrandingSecurity(context: SecurityAuditContext, findings: PlatformThemeSecurityFinding[]) {
  for (const row of context.resellerRows) {
    if (!inheritanceModes.has(row.inheritanceMode)) {
      addFinding(
        findings,
        {
          area: "reseller_branding",
          findingType: "invalid_inheritance_mode",
          message: `Reseller ${row.resellerId.slice(0, 8)}… has unsupported inheritance mode "${row.inheritanceMode}".`,
          severity: "high",
          suggestedAction: "Set inheritance mode to inherit_platform or custom_branding."
        },
        context.detectedAt
      );
    }

    if (row.inheritanceMode !== "custom_branding") {
      continue;
    }

    for (const [scope, rawValue] of [
      ["draft", row.draftValue],
      ["published", row.publishedValue]
    ] as const) {
      const settings = parsePlatformWhiteLabelSettings(rawValue);
      const validation = validateWhiteLabelSettings(settings);

      if (!validation.ok) {
        addFinding(
          findings,
          {
            area: "reseller_branding",
            findingType: "reseller_unsafe_custom_branding",
            message: `Reseller ${row.resellerId.slice(0, 8)}… ${scope} custom branding failed validation.`,
            severity: "medium",
            suggestedAction: "Correct invalid reseller branding values before publishing custom branding."
          },
          context.detectedAt
        );
      }

      if (containsPrivateStorageReference(rawValue) || containsSensitiveKey(rawValue).length) {
        addFinding(
          findings,
          {
            area: "reseller_branding",
            findingType: "reseller_platform_private_leak",
            message: `Reseller ${row.resellerId.slice(0, 8)}… ${scope} custom branding may leak private platform values.`,
            severity: "critical",
            suggestedAction: "Remove storage keys, secrets, and internal platform metadata from reseller branding."
          },
          context.detectedAt
        );
      }

      if (
        (settings.supportUrl && isSuspiciousUrl(settings.supportUrl)) ||
        (settings.documentationUrl && isSuspiciousUrl(settings.documentationUrl)) ||
        containsScriptTag(settings.brandName) ||
        containsScriptTag(settings.poweredByLabel)
      ) {
        addFinding(
          findings,
          {
            area: "reseller_branding",
            findingType: "reseller_unsafe_custom_branding",
            message: `Reseller ${row.resellerId.slice(0, 8)}… ${scope} custom branding contains unsafe URLs or markup.`,
            severity: "high",
            suggestedAction: "Sanitize reseller branding to plain text and safe https URLs only."
          },
          context.detectedAt
        );
      }
    }
  }
}

function buildOverview(findings: PlatformThemeSecurityFinding[], context: SecurityAuditContext): PlatformThemeSecurityOverview {
  return {
    assetFindings: countFindings(findings, (finding) => finding.area === "assets"),
    criticalFindings: countFindings(findings, (finding) => finding.severity === "critical"),
    detectedAt: context.detectedAt,
    highFindings: countFindings(findings, (finding) => finding.severity === "high"),
    importExportFindings: countFindings(findings, (finding) => finding.area === "import_export"),
    inputFindings: countFindings(findings, (finding) => finding.area === "input"),
    monitoredAssets: context.assets.length,
    monitoredResellers: context.resellerRows.length,
    monitoredSettings: context.settings.length,
    monitoredVersions: context.versions.length,
    resellerBrandingFindings: countFindings(findings, (finding) => finding.area === "reseller_branding"),
    totalFindings: findings.length,
    whiteLabelFindings: countFindings(findings, (finding) => finding.area === "white_label")
  };
}

export async function listThemeSecurityFindings(
  rawFilters?: PlatformThemeSecurityFilters
): Promise<PlatformThemeSecurityAuditSummary> {
  const context = await loadSecurityAuditContext();
  const filters = normalizeFilters(rawFilters);
  const findings: PlatformThemeSecurityFinding[] = [
    ...(await evaluateThemeInputSecurity(context)),
    ...(await evaluateThemeAssetSecurity(context)),
    ...(await evaluateThemeExportSecurity(context)),
    ...(await evaluateWhiteLabelSecurity(context))
  ];

  evaluateResellerBrandingSecurity(context, findings);

  const filteredFindings = filterFindings(findings, filters);
  const overview = buildOverview(findings, context);

  return {
    cards: {
      assetSecurity: overview.assetFindings,
      criticalFindings: overview.criticalFindings,
      highFindings: overview.highFindings,
      importExportSecurity: overview.importExportFindings,
      inputSecurity: overview.inputFindings,
      resellerBrandingSecurity: overview.resellerBrandingFindings,
      whiteLabelSecurity: overview.whiteLabelFindings
    },
    detectedAt: context.detectedAt,
    filterOptions: {
      areas,
      findingTypes,
      severities
    },
    filters,
    findings: filteredFindings,
    overview,
    totalFindings: findings.length
  };
}

export async function runThemeSecurityAudit(rawFilters?: PlatformThemeSecurityFilters): Promise<PlatformThemeSecurityAuditSummary> {
  return listThemeSecurityFindings(rawFilters);
}

export function parsePlatformThemeSecurityFilters(searchParams?: {
  themeSecurityArea?: string;
  themeSecurityFindingType?: string;
  themeSecuritySeverity?: string;
}): PlatformThemeSecurityFilters {
  return {
    area: searchParams?.themeSecurityArea,
    findingType: searchParams?.themeSecurityFindingType,
    severity: searchParams?.themeSecuritySeverity
  };
}
