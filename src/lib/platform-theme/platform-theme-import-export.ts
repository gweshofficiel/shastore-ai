import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import {
  listBrandSettings,
  updateBrandSettingDraft,
  validateBrandSetting,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import { listThemePresets, type PlatformThemePresetRecord } from "@/src/lib/platform-theme/platform-theme-presets";
import { createThemeVersion } from "@/src/lib/platform-theme/platform-theme-versions";

export type PlatformThemeExportSource = "draft" | "published";

export type PlatformThemeExportFile = {
  colors: {
    accent_color: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
  exportedAt: string;
  favicon: Record<string, unknown> | null;
  format: "shastore_platform_theme_export";
  formatVersion: 1;
  logo: Record<string, unknown> | null;
  metadata: {
    presetReferences: string[];
    settingCount: number;
    source: PlatformThemeExportSource;
  };
  presetReferences: string[];
  settings: Record<string, Record<string, unknown>>;
  source: PlatformThemeExportSource;
  typography: {
    stack: string | null;
  };
};

export type PlatformThemeImportValidation = {
  errors: string[];
  importedSettingCount: number;
  ok: boolean;
  warnings: string[];
};

const exportFormat = "shastore_platform_theme_export";
const exportFormatVersion = 1;
const maxImportBytes = 1024 * 1024;

const allowedRootKeys = new Set([
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

const allowedMetadataKeys = new Set(["presetReferences", "settingCount", "source"]);

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
  "token",
  "audit",
  "created_by",
  "createdBy",
  "user_id",
  "userId"
]);

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

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeys.has(key))
      .map(([key, item]) => [key, sanitizeValue(item)])
  );
}

function sanitizeSettingValue(value: Record<string, unknown>) {
  const sanitized = sanitizeValue(value) as Record<string, unknown>;

  delete sanitized.storageKey;
  delete sanitized.storageBucket;

  return sanitized;
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

function settingValue(setting: PlatformBrandSettingRecord, source: PlatformThemeExportSource) {
  const value = source === "published" ? setting.publishedValue : setting.draftValue;
  return sanitizeSettingValue(safeRecord(value));
}

function colorFromSetting(settings: Record<string, Record<string, unknown>>, key: string) {
  const value = safeRecord(settings[key]);
  const hex = text(value.hex, 20);
  return hex || null;
}

function typographyFromSetting(settings: Record<string, Record<string, unknown>>) {
  const value = safeRecord(settings.typography);
  return text(value.stack, 240) || null;
}

function assetReferenceFromSetting(settings: Record<string, Record<string, unknown>>, key: string) {
  const value = safeRecord(settings[key]);

  if (!Object.keys(value).length) {
    return null;
  }

  return sanitizeSettingValue(value);
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

function findPresetReferences(
  settings: Record<string, Record<string, unknown>>,
  presets: PlatformThemePresetRecord[]
) {
  return presets
    .filter((preset) => settingsMatch(settings, preset.presetData.settings))
    .map((preset) => preset.presetKey);
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Super Admin access is required for platform theme import/export.");
  }

  return access;
}

async function buildExport(source: PlatformThemeExportSource): Promise<PlatformThemeExportFile> {
  await requireSuperAdmin();

  const [settings, presets] = await Promise.all([listBrandSettings(), listThemePresets()]);
  const exportedSettings: Record<string, Record<string, unknown>> = {};

  for (const setting of settings) {
    exportedSettings[setting.settingKey] = settingValue(setting, source);
  }

  const presetReferences = findPresetReferences(exportedSettings, presets.filter((preset) => preset.status === "active"));

  return {
    colors: {
      accent_color: colorFromSetting(exportedSettings, "accent_color"),
      primary_color: colorFromSetting(exportedSettings, "primary_color"),
      secondary_color: colorFromSetting(exportedSettings, "secondary_color")
    },
    exportedAt: new Date().toISOString(),
    favicon: assetReferenceFromSetting(exportedSettings, "favicon"),
    format: exportFormat,
    formatVersion: exportFormatVersion,
    logo: assetReferenceFromSetting(exportedSettings, "platform_logo"),
    metadata: {
      presetReferences,
      settingCount: Object.keys(exportedSettings).length,
      source
    },
    presetReferences,
    settings: exportedSettings,
    source,
    typography: {
      stack: typographyFromSetting(exportedSettings)
    }
  };
}

function parseImportPayload(fileData: unknown): PlatformThemeExportFile {
  let parsed: unknown = fileData;

  if (typeof fileData === "string") {
    const trimmed = fileData.trim();

    if (!trimmed) {
      throw new Error("Import file is empty.");
    }

    if (trimmed.length > maxImportBytes) {
      throw new Error("Import file exceeds the 1 MB limit.");
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Import file must be valid JSON.");
    }
  }

  if (!isRecord(parsed)) {
    throw new Error("Import file must be a JSON object.");
  }

  for (const key of Object.keys(parsed)) {
    if (!allowedRootKeys.has(key)) {
      throw new Error(`Import file contains unsupported root key "${key}".`);
    }
  }

  const format = text(parsed.format, 80);

  if (format !== exportFormat) {
    throw new Error("Import file format is not supported.");
  }

  if (parsed.formatVersion !== exportFormatVersion) {
    throw new Error("Import file format version is not supported.");
  }

  const settingsRecord = safeRecord(parsed.settings);
  const settings: Record<string, Record<string, unknown>> = {};

  for (const [settingKey, settingValue] of Object.entries(settingsRecord)) {
    const key = text(settingKey, 120);

    if (!key) continue;

    settings[key] = sanitizeSettingValue(safeRecord(settingValue));
  }

  const metadataRecord = safeRecord(parsed.metadata);

  for (const key of Object.keys(metadataRecord)) {
    if (!allowedMetadataKeys.has(key)) {
      throw new Error(`Import metadata contains unsupported key "${key}".`);
    }
  }

  const source = text(parsed.source, 40) === "published" ? "published" : "draft";
  const presetReferences = Array.isArray(parsed.presetReferences)
    ? parsed.presetReferences.map((item) => text(item, 120)).filter(Boolean)
    : [];

  return {
    colors: {
      accent_color: text(safeRecord(parsed.colors).accent_color, 20) || colorFromSetting(settings, "accent_color"),
      primary_color: text(safeRecord(parsed.colors).primary_color, 20) || colorFromSetting(settings, "primary_color"),
      secondary_color: text(safeRecord(parsed.colors).secondary_color, 20) || colorFromSetting(settings, "secondary_color")
    },
    exportedAt: text(parsed.exportedAt, 80) || new Date().toISOString(),
    favicon: isRecord(parsed.favicon) ? sanitizeSettingValue(parsed.favicon) : assetReferenceFromSetting(settings, "favicon"),
    format: exportFormat,
    formatVersion: exportFormatVersion,
    logo: isRecord(parsed.logo) ? sanitizeSettingValue(parsed.logo) : assetReferenceFromSetting(settings, "platform_logo"),
    metadata: {
      presetReferences,
      settingCount: Object.keys(settings).length,
      source
    },
    presetReferences,
    settings,
    source,
    typography: {
      stack: text(safeRecord(parsed.typography).stack, 240) || typographyFromSetting(settings)
    }
  };
}

function validateImportSettings(settings: Record<string, Record<string, unknown>>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Object.keys(settings).length) {
    errors.push("Import file does not contain any theme settings.");
  }

  for (const [settingKey, settingValue] of Object.entries(settings)) {
    for (const key of Object.keys(settingValue)) {
      if (sensitiveKeys.has(key)) {
        errors.push(`Setting "${settingKey}" contains unsupported key "${key}".`);
      }

      if (!allowedSettingValueKeys.has(key)) {
        errors.push(`Setting "${settingKey}" contains unsupported key "${key}".`);
      }
    }

    if (containsUnsafeString(settingValue)) {
      errors.push(`Setting "${settingKey}" contains unsafe values.`);
      continue;
    }

    const validation = validateBrandSetting(settingKey, settingValue);

    if (validation.status === "invalid") {
      errors.push(`Setting "${settingKey}" has invalid values.`);
    }

    if (validation.status === "placeholder" || validation.status === "needs_attention") {
      warnings.push(`Setting "${settingKey}" is ${validation.status.replace("_", " ")}.`);
    }
  }

  return { errors, warnings };
}

export async function exportCurrentDraftTheme() {
  return buildExport("draft");
}

export async function exportPublishedTheme() {
  return buildExport("published");
}

export async function validateThemeImport(fileData: unknown): Promise<PlatformThemeImportValidation> {
  await requireSuperAdmin();

  try {
    const payload = parseImportPayload(fileData);
    const { errors, warnings } = validateImportSettings(payload.settings);
    const currentSettings = await listBrandSettings();
    const currentKeys = new Set(currentSettings.map((setting) => setting.settingKey));
    const importedSettingCount = currentSettings.filter((setting) => payload.settings[setting.settingKey]).length;

    for (const settingKey of Object.keys(payload.settings)) {
      if (!currentKeys.has(settingKey)) {
        warnings.push(`Setting "${settingKey}" is not registered in the current platform theme and will be skipped.`);
      }
    }

    if (payload.source === "published") {
      warnings.push("Import source is published. Values will be applied to draft only.");
    }

    if (!importedSettingCount) {
      errors.push("Import file does not match any current platform brand settings.");
    }

    return {
      errors,
      importedSettingCount,
      ok: errors.length === 0,
      warnings
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : "Theme import validation failed."],
      importedSettingCount: 0,
      ok: false,
      warnings: []
    };
  }
}

export async function importThemeToDraft(fileData: unknown) {
  await requireSuperAdmin();

  const validation = await validateThemeImport(fileData);

  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "Theme import validation failed.");
  }

  const payload = parseImportPayload(fileData);
  const currentSettings = await listBrandSettings();
  let appliedCount = 0;

  for (const setting of currentSettings) {
    const draftValue = payload.settings[setting.settingKey];

    if (!draftValue) continue;

    await updateBrandSettingDraft(setting.settingKey, draftValue);
    appliedCount += 1;
  }

  if (!appliedCount) {
    throw new Error("Theme import did not match any current brand settings.");
  }

  await createThemeVersion("manual_snapshot", "Theme imported");

  return {
    appliedSettingCount: appliedCount,
    source: payload.source,
    warnings: validation.warnings
  };
}

export function serializeThemeExport(exportFile: PlatformThemeExportFile) {
  return JSON.stringify(exportFile, null, 2);
}
