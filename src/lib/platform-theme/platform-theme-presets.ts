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
import { createThemeVersion } from "@/src/lib/platform-theme/platform-theme-versions";
import {
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformThemePresetStatus = "active" | "archived";

export type PlatformThemePresetData = {
  settings: Record<string, Record<string, unknown>>;
};

export type PlatformThemePresetRecord = {
  createdAt: string | null;
  createdBy: string | null;
  description: string | null;
  id: string;
  isSystem: boolean;
  name: string;
  presetData: PlatformThemePresetData;
  presetKey: string;
  status: PlatformThemePresetStatus;
  updatedAt: string | null;
};

export type CreateThemePresetInput = {
  description?: string | null;
  isSystem?: boolean;
  name: string;
  presetData?: PlatformThemePresetData;
  presetKey: string;
};

export type CreatePresetFromDraftInput = {
  description?: string | null;
  name: string;
  presetKey: string;
};

export type PlatformThemePresetPreview = {
  accentColor: string;
  cssVariables: Record<
    "--platform-accent" | "--platform-font-family" | "--platform-primary" | "--platform-secondary",
    string
  >;
  faviconUrl: string | null;
  locale: PlatformLocale;
  localeTheme: PlatformLocaleTheme;
  logoUrl: string | null;
  presetKey: string;
  presetName: string;
  primaryColor: string;
  secondaryColor: string;
  summary: Array<{ key: string; value: string | null }>;
  typography: string;
};

type PlatformThemePresetRow = {
  created_at?: string | null;
  created_by?: string | null;
  description?: string | null;
  id?: string | null;
  is_system?: boolean | null;
  name?: string | null;
  preset_data?: unknown;
  preset_key?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

const presetStatuses: PlatformThemePresetStatus[] = ["active", "archived"];

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

function parseStatus(value: unknown): PlatformThemePresetStatus {
  const cleaned = text(value, 40);
  return presetStatuses.includes(cleaned as PlatformThemePresetStatus)
    ? cleaned as PlatformThemePresetStatus
    : "active";
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

function validatePresetKey(presetKey: string) {
  return /^[a-z0-9_]{2,80}$/.test(presetKey);
}

function parsePresetData(value: unknown): PlatformThemePresetData {
  const record = safeRecord(value);
  const settingsRecord = safeRecord(record.settings);
  const settings: PlatformThemePresetData["settings"] = {};

  for (const [settingKey, settingValue] of Object.entries(settingsRecord)) {
    const key = text(settingKey, 120);

    if (!key) continue;

    settings[key] = sanitizeSettingValue(safeRecord(settingValue));
  }

  return { settings };
}

function parsePreset(row: unknown): PlatformThemePresetRecord | null {
  if (!isRecord(row)) return null;

  const value = row as PlatformThemePresetRow;
  const id = text(value.id, 120);
  const presetKey = text(value.preset_key, 120);
  const name = text(value.name, 180);

  if (!id || !presetKey || !name) return null;

  return {
    createdAt: text(value.created_at, 80) || null,
    createdBy: text(value.created_by, 120) || null,
    description: text(value.description, 500) || null,
    id,
    isSystem: value.is_system === true,
    name,
    presetData: parsePresetData(value.preset_data),
    presetKey,
    status: parseStatus(value.status),
    updatedAt: text(value.updated_at, 80) || null
  };
}

function validatePresetData(presetData: PlatformThemePresetData) {
  const errors: string[] = [];

  if (!Object.keys(presetData.settings).length) {
    errors.push("Preset must include at least one brand setting.");
  }

  for (const [settingKey, settingValue] of Object.entries(presetData.settings)) {
    for (const key of Object.keys(settingValue)) {
      if (sensitiveKeys.has(key)) {
        errors.push(`Preset setting "${settingKey}" contains unsupported key "${key}".`);
      }

      if (!allowedSettingValueKeys.has(key)) {
        errors.push(`Preset setting "${settingKey}" contains unsupported key "${key}".`);
      }
    }

    if (containsUnsafeString(settingValue)) {
      errors.push(`Preset setting "${settingKey}" contains unsafe values.`);
      continue;
    }

    const validation = validateBrandSetting(settingKey, settingValue);

    if (validation.status === "invalid") {
      errors.push(`Preset setting "${settingKey}" has invalid values.`);
    }
  }

  return errors;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Super Admin access is required for platform theme presets.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme presets.");
  }

  return admin;
}

function presetSelect() {
  return "id, preset_key, name, description, preset_data, status, is_system, created_by, created_at, updated_at";
}

async function buildPresetDataFromDraft(): Promise<PlatformThemePresetData> {
  const settings = await listBrandSettings();
  const presetSettings: PlatformThemePresetData["settings"] = {};

  for (const setting of settings) {
    presetSettings[setting.settingKey] = sanitizeSettingValue(setting.draftValue);
  }

  return { settings: presetSettings };
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

  const asset = data as { public_url?: string | null; status?: string | null } | null;
  return asset?.status === "deleted" ? directUrl : safePublicUrl(asset?.public_url) ?? directUrl;
}

async function buildPresetPreview(
  preset: PlatformThemePresetRecord,
  locale?: string | null
): Promise<PlatformThemePresetPreview> {
  const resolvedLocale = safeLocale(locale);
  const settings = preset.presetData.settings;
  const primaryValue = safeRecord(settings.primary_color);
  const secondaryValue = safeRecord(settings.secondary_color);
  const accentValue = safeRecord(settings.accent_color);
  const typographyValue = safeRecord(settings.typography);
  const logoValue = safeRecord(settings.platform_logo);
  const faviconValue = safeRecord(settings.favicon);
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
    presetKey: preset.presetKey,
    presetName: preset.name,
    primaryColor,
    secondaryColor,
    summary,
    typography
  };
}

export async function listThemePresets(includeArchived = true) {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  let query = admin
    .from("platform_theme_presets" as never)
    .select(presetSelect())
    .order("is_system" as never, { ascending: false })
    .order("created_at" as never, { ascending: true });

  if (!includeArchived) {
    query = query.eq("status" as never, "active" as never);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Platform theme presets could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parsePreset(row))
    .filter((preset): preset is PlatformThemePresetRecord => Boolean(preset));
}

export async function getThemePreset(presetKey: string) {
  await requireSuperAdmin();
  const key = text(presetKey, 120);

  if (!key) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_presets" as never)
    .select(presetSelect())
    .eq("preset_key" as never, key as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform theme preset could not be loaded: ${error.message}`);
  }

  return parsePreset(data);
}

export async function createThemePreset(input: CreateThemePresetInput) {
  const access = await requireSuperAdmin();
  const presetKey = text(input.presetKey, 120);
  const name = text(input.name, 180);

  if (!presetKey || !name) {
    throw new Error("Preset key and name are required.");
  }

  if (!validatePresetKey(presetKey)) {
    throw new Error("Preset key must use lowercase letters, numbers, and underscores.");
  }

  const presetData = parsePresetData(input.presetData ?? { settings: {} });
  const errors = validatePresetData(presetData);

  if (errors.length) {
    throw new Error(errors[0]);
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_presets" as never)
    .insert({
      created_by: access.user.id,
      description: text(input.description, 500) || null,
      is_system: input.isSystem === true,
      name,
      preset_data: presetData,
      preset_key: presetKey,
      status: "active"
    } as never)
    .select(presetSelect())
    .single();

  if (error) {
    throw new Error(`Platform theme preset could not be created: ${error.message}`);
  }

  const preset = parsePreset(data);

  if (!preset) {
    throw new Error("Platform theme preset could not be parsed.");
  }

  return preset;
}

export async function createPresetFromCurrentDraft(input: CreatePresetFromDraftInput) {
  const presetData = await buildPresetDataFromDraft();

  return createThemePreset({
    description: input.description,
    isSystem: false,
    name: input.name,
    presetData,
    presetKey: input.presetKey
  });
}

export async function archiveThemePreset(presetId: string) {
  await requireSuperAdmin();
  const id = text(presetId, 120);

  if (!id) {
    throw new Error("Preset id is required.");
  }

  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("platform_theme_presets" as never)
    .select(presetSelect())
    .eq("id" as never, id as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Platform theme preset could not be loaded: ${existingError.message}`);
  }

  const preset = parsePreset(existing);

  if (!preset) {
    throw new Error("Platform theme preset was not found.");
  }

  if (preset.isSystem) {
    throw new Error("System presets cannot be archived.");
  }

  const { data, error } = await admin
    .from("platform_theme_presets" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, id as never)
    .select(presetSelect())
    .single();

  if (error) {
    throw new Error(`Platform theme preset could not be archived: ${error.message}`);
  }

  const archived = parsePreset(data);

  if (!archived) {
    throw new Error("Archived platform theme preset could not be parsed.");
  }

  return archived;
}

export async function applyThemePresetToDraft(presetKey: string) {
  await requireSuperAdmin();
  const preset = await getThemePreset(presetKey);

  if (!preset) {
    throw new Error("Platform theme preset was not found.");
  }

  if (preset.status !== "active") {
    throw new Error("Archived presets cannot be applied to draft.");
  }

  const errors = validatePresetData(preset.presetData);

  if (errors.length) {
    throw new Error(errors[0]);
  }

  const currentSettings = await listBrandSettings();
  let appliedCount = 0;

  for (const setting of currentSettings) {
    const draftValue = preset.presetData.settings[setting.settingKey];

    if (!draftValue) continue;

    await updateBrandSettingDraft(setting.settingKey, draftValue);
    appliedCount += 1;
  }

  if (!appliedCount) {
    throw new Error("Preset did not match any current brand settings.");
  }

  await createThemeVersion("manual_snapshot", "Applied preset to draft");

  return {
    appliedSettingCount: appliedCount,
    presetKey: preset.presetKey,
    presetName: preset.name
  };
}

export async function previewThemePreset(presetKey: string, locale?: string | null) {
  const preset = await getThemePreset(presetKey);

  if (!preset) {
    throw new Error("Platform theme preset was not found.");
  }

  const errors = validatePresetData(preset.presetData);

  if (errors.length) {
    throw new Error(errors[0]);
  }

  return buildPresetPreview(preset, locale);
}

export function buildThemePresetPreviewDirectionAttributes(locale: string | null | undefined) {
  return buildPlatformLocaleThemeAttributes(locale);
}
