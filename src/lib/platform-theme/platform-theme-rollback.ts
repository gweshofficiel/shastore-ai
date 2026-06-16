import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  updateBrandSettingDraft,
  validateBrandSetting
} from "@/src/lib/platform-theme/platform-brand-settings";
import {
  buildPlatformLocaleThemeAttributes,
  getPlatformLocaleTheme,
  type PlatformLocaleTheme
} from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import {
  buildPlatformThemeCssVariables,
  type PublishedPlatformTheme
} from "@/src/lib/platform-theme/public-platform-theme-resolver";
import {
  canRollbackThemeVersion,
  createRollbackThemeSnapshot,
  getThemeVersion,
  type PlatformThemeSnapshotType,
  type PlatformThemeVersionRecord,
  type PlatformThemeVersionSnapshot
} from "@/src/lib/platform-theme/platform-theme-versions";
import {
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformThemeRollbackValidation = {
  allowed: boolean;
  errors: string[];
  restoredSettingCount: number;
  sourceVersion: PlatformThemeVersionRecord | null;
};

export type PlatformThemeVersionPreview = {
  accentColor: string;
  cssVariables: Record<
    "--platform-accent" | "--platform-font-family" | "--platform-primary" | "--platform-secondary",
    string
  >;
  faviconUrl: string | null;
  locale: PlatformLocale;
  localeTheme: PlatformLocaleTheme;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  sourceVersionNumber: number;
  summary: Array<{ key: string; value: string | null }>;
  typography: string;
  validation: PlatformThemeRollbackValidation;
};

type ThemeAssetRow = {
  id?: string | null;
  public_url?: string | null;
  status?: string | null;
};

const rollbackSourceTypes = new Set<PlatformThemeSnapshotType>([
  "draft_saved",
  "published",
  "manual_snapshot"
]);

const allowedSnapshotRootKeys = new Set(["assets", "capturedAt", "settings", "summary"]);

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
  "token"
]);

const fallbackTheme = {
  accentColor: "#2563eb",
  fontFamily: "Inter, system-ui, sans-serif",
  primaryColor: "#0f172a",
  secondaryColor: "#2563eb"
};

const fontPattern = /^(inter|system|sans|serif|mono|roboto|poppins|cairo|tajawal|nunito|arial|helvetica|georgia|ui-sans-serif|ui-serif|ui-monospace|[\s,/()-])+$/i;

function text(value: unknown, maxLength = 1000) {
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
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned : null;
}

function validFont(value: unknown) {
  const cleaned = text(value, 240);
  return cleaned && fontPattern.test(cleaned) ? cleaned : null;
}

function safePublicUrl(value: unknown) {
  const cleaned = text(value, 1000);

  if (!cleaned) return null;
  if (cleaned.startsWith("/") && !cleaned.startsWith("//") && !/[<>"'`]/.test(cleaned)) return cleaned;

  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:" ? cleaned : null;
  } catch {
    return null;
  }
}

function safeLocale(locale: string | null | undefined): PlatformLocale {
  return isPlatformLocale(locale) ? locale : "en";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Super Admin access is required for platform theme rollback.");
  }

  return access;
}

function containsUnsafeString(value: unknown): boolean {
  if (typeof value === "string") {
    return /<script\b/i.test(value) || /\son\w+\s*=/i.test(value) || /\bjavascript:/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafeString(item));
  }

  if (isRecord(value)) {
    return Object.values(value).some((item) => containsUnsafeString(item));
  }

  return false;
}

function validateSettingValueKeys(settingKey: string, value: Record<string, unknown>) {
  for (const key of Object.keys(value)) {
    if (sensitiveKeys.has(key)) {
      return `Setting "${settingKey}" contains unsupported key "${key}".`;
    }

    if (!allowedSettingValueKeys.has(key)) {
      return `Setting "${settingKey}" contains unsupported key "${key}".`;
    }
  }

  if (containsUnsafeString(value)) {
    return `Setting "${settingKey}" contains unsafe values.`;
  }

  return null;
}

function draftValueFromSnapshot(
  setting: PlatformThemeVersionSnapshot["settings"][number],
  sourceSnapshotType: PlatformThemeSnapshotType
) {
  if (sourceSnapshotType === "published") {
    const draftValue = safeRecord(setting.draftValue);
    const publishedValue = safeRecord(setting.publishedValue);

    return Object.keys(draftValue).length ? draftValue : publishedValue;
  }

  return safeRecord(setting.draftValue);
}

function validateSnapshotStructure(
  snapshot: PlatformThemeVersionSnapshot,
  sourceSnapshotType: PlatformThemeSnapshotType
) {
  const errors: string[] = [];

  if (!snapshot.settings.length) {
    errors.push("Snapshot does not contain any brand settings.");
  }

  for (const key of Object.keys(snapshot)) {
    if (!allowedSnapshotRootKeys.has(key)) {
      errors.push(`Snapshot contains unsupported root key "${key}".`);
    }
  }

  for (const setting of snapshot.settings) {
    if (!setting.settingKey) {
      errors.push("Snapshot setting is missing settingKey.");
      continue;
    }

    const draftValue = draftValueFromSnapshot(setting, sourceSnapshotType);
    const keyError = validateSettingValueKeys(setting.settingKey, draftValue);

    if (keyError) {
      errors.push(keyError);
      continue;
    }

    const validation = validateBrandSetting(setting.settingKey, draftValue);

    if (validation.status === "invalid") {
      errors.push(`Setting "${setting.settingKey}" has invalid rollback values.`);
    }
  }

  return errors;
}

function buildDraftValuesFromSnapshot(version: PlatformThemeVersionRecord) {
  const values = new Map<string, Record<string, unknown>>();

  for (const setting of version.snapshot.settings) {
    values.set(setting.settingKey, draftValueFromSnapshot(setting, version.snapshotType));
  }

  return values;
}

async function assetBackedUrl(value: Record<string, unknown>) {
  const assetId = text(value.assetId, 120);
  const directUrl = safePublicUrl(value.url ?? value.path);

  if (!assetId) return directUrl;

  const admin = createAdminClient();
  if (!admin) return directUrl;

  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .select("id, public_url, status")
    .eq("id" as never, assetId as never)
    .maybeSingle();

  if (error) return directUrl;

  const asset = data as ThemeAssetRow | null;
  return asset?.status === "deleted" ? directUrl : safePublicUrl(asset?.public_url) ?? directUrl;
}

async function buildPreviewFromDraftValues(
  draftValues: Map<string, Record<string, unknown>>,
  version: PlatformThemeVersionRecord,
  validation: PlatformThemeRollbackValidation,
  locale?: string | null
): Promise<PlatformThemeVersionPreview> {
  const resolvedLocale = safeLocale(locale);
  const primaryValue = safeRecord(draftValues.get("primary_color"));
  const secondaryValue = safeRecord(draftValues.get("secondary_color"));
  const accentValue = safeRecord(draftValues.get("accent_color"));
  const typographyValue = safeRecord(draftValues.get("typography"));
  const logoValue = safeRecord(draftValues.get("platform_logo"));
  const faviconValue = safeRecord(draftValues.get("favicon"));
  const primaryColor = validHex(primaryValue.hex) ?? fallbackTheme.primaryColor;
  const secondaryColor = validHex(secondaryValue.hex) ?? fallbackTheme.secondaryColor;
  const accentColor = validHex(accentValue.hex) ?? fallbackTheme.accentColor;
  const typography = validFont(typographyValue.stack) ?? fallbackTheme.fontFamily;
  const [logoUrl, faviconUrl] = await Promise.all([
    assetBackedUrl(logoValue),
    assetBackedUrl(faviconValue)
  ]);
  const summary = [
    { key: "primary_color", value: primaryColor },
    { key: "secondary_color", value: secondaryColor },
    { key: "accent_color", value: accentColor },
    { key: "typography", value: typography },
    { key: "platform_logo", value: logoUrl ? "Logo available" : null },
    { key: "favicon", value: faviconUrl ? "Favicon available" : null }
  ];
  const themeForCss: PublishedPlatformTheme = {
    accentColor,
    faviconUrl,
    hasPublishedTheme: summary.some((item) => Boolean(item.value)),
    logoUrl,
    primaryColor,
    publishedSummary: summary.map((item) => ({ key: item.key, value: item.value })),
    secondaryColor,
    typography
  };
  const localeTheme = getPlatformLocaleTheme(resolvedLocale);

  return {
    accentColor,
    cssVariables: buildPlatformThemeCssVariables(themeForCss),
    faviconUrl,
    locale: resolvedLocale,
    localeTheme,
    logoUrl,
    primaryColor,
    secondaryColor,
    sourceVersionNumber: version.versionNumber,
    summary,
    typography,
    validation
  };
}

export async function validateThemeVersionForRollback(versionId: string): Promise<PlatformThemeRollbackValidation> {
  await requireSuperAdmin();

  const id = text(versionId, 120);

  if (!id) {
    return {
      allowed: false,
      errors: ["Theme version id is required."],
      restoredSettingCount: 0,
      sourceVersion: null
    };
  }

  const sourceVersion = await getThemeVersion(id);

  if (!sourceVersion) {
    return {
      allowed: false,
      errors: ["Theme version was not found."],
      restoredSettingCount: 0,
      sourceVersion: null
    };
  }

  if (!rollbackSourceTypes.has(sourceVersion.snapshotType) || !canRollbackThemeVersion(sourceVersion.snapshotType)) {
    return {
      allowed: false,
      errors: [`Snapshot type "${sourceVersion.snapshotType}" cannot be rolled back to draft.`],
      restoredSettingCount: 0,
      sourceVersion
    };
  }

  const errors = validateSnapshotStructure(sourceVersion.snapshot, sourceVersion.snapshotType);
  const currentSettings = await listBrandSettings();
  const snapshotKeys = new Set(sourceVersion.snapshot.settings.map((setting) => setting.settingKey));
  const restoredSettingCount = currentSettings.filter((setting) => snapshotKeys.has(setting.settingKey)).length;

  if (!restoredSettingCount) {
    errors.push("No matching brand settings were found in the snapshot.");
  }

  return {
    allowed: errors.length === 0,
    errors,
    restoredSettingCount,
    sourceVersion
  };
}

export async function previewThemeVersion(versionId: string, locale?: string | null) {
  const validation = await validateThemeVersionForRollback(versionId);

  if (!validation.sourceVersion) {
    throw new Error(validation.errors[0] ?? "Theme version preview is unavailable.");
  }

  if (!validation.allowed) {
    throw new Error(validation.errors.join(" "));
  }

  const draftValues = buildDraftValuesFromSnapshot(validation.sourceVersion);

  return buildPreviewFromDraftValues(draftValues, validation.sourceVersion, validation, locale);
}

export async function rollbackThemeVersionToDraft(versionId: string) {
  await requireSuperAdmin();

  const validation = await validateThemeVersionForRollback(versionId);

  if (!validation.allowed || !validation.sourceVersion) {
    throw new Error(validation.errors[0] ?? "Theme version cannot be rolled back to draft.");
  }

  const draftValues = buildDraftValuesFromSnapshot(validation.sourceVersion);
  const currentSettings = await listBrandSettings();
  let restoredCount = 0;

  for (const setting of currentSettings) {
    const draftValue = draftValues.get(setting.settingKey);

    if (!draftValue) continue;

    await updateBrandSettingDraft(setting.settingKey, draftValue);
    restoredCount += 1;
  }

  const rollbackVersion = await createRollbackThemeSnapshot(
    `Rollback to draft from version ${validation.sourceVersion.versionNumber}`
  );

  return {
    restoredSettingCount: restoredCount,
    rollbackVersionNumber: rollbackVersion.versionNumber,
    sourceVersionNumber: validation.sourceVersion.versionNumber
  };
}

export function buildThemeVersionPreviewDirectionAttributes(locale: string | null | undefined) {
  return buildPlatformLocaleThemeAttributes(locale);
}

export function canRestoreThemeVersion(snapshotType: PlatformThemeSnapshotType) {
  return canRollbackThemeVersion(snapshotType);
}
