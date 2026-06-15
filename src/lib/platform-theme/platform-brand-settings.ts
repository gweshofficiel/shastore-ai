import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformBrandSettingType =
  | "color"
  | "custom"
  | "favicon"
  | "language"
  | "layout"
  | "logo"
  | "mode"
  | "typography";

export type PlatformBrandSettingStatus = "archived" | "draft" | "published";
export type PlatformBrandValidationStatus = "invalid" | "needs_attention" | "placeholder" | "ready";

export type PlatformBrandSettingRecord = {
  createdAt: string | null;
  description: string | null;
  draftValue: Record<string, unknown>;
  id: string;
  publishedValue: Record<string, unknown>;
  settingKey: string;
  settingType: PlatformBrandSettingType;
  status: PlatformBrandSettingStatus;
  updatedAt: string | null;
  validationStatus: PlatformBrandValidationStatus;
};

export type PlatformBrandValidationResult = {
  normalizedValue: Record<string, unknown>;
  status: PlatformBrandValidationStatus;
};

type PlatformBrandSettingRow = {
  created_at?: string | null;
  description?: string | null;
  draft_value?: unknown;
  id?: string | null;
  published_value?: unknown;
  setting_key?: string | null;
  setting_type?: string | null;
  status?: string | null;
  updated_at?: string | null;
  validation_status?: string | null;
};

const settingTypes: PlatformBrandSettingType[] = [
  "logo",
  "favicon",
  "color",
  "typography",
  "mode",
  "language",
  "layout",
  "custom"
];
const settingStatuses: PlatformBrandSettingStatus[] = ["draft", "published", "archived"];
const validationStatuses: PlatformBrandValidationStatus[] = ["ready", "placeholder", "invalid", "needs_attention"];

const seedSettings = [
  {
    description: "Draft platform logo path. Upload handling is reserved for a later phase.",
    draft_value: { path: "/brand/platform-logo.svg" },
    published_value: {},
    setting_key: "platform_logo",
    setting_type: "logo",
    status: "draft",
    validation_status: "placeholder"
  },
  {
    description: "Draft platform favicon path. Upload handling is reserved for a later phase.",
    draft_value: { path: "/favicon.ico" },
    published_value: {},
    setting_key: "favicon",
    setting_type: "favicon",
    status: "draft",
    validation_status: "placeholder"
  },
  {
    description: "Draft primary platform brand color.",
    draft_value: { hex: "#0f172a" },
    published_value: {},
    setting_key: "primary_color",
    setting_type: "color",
    status: "draft",
    validation_status: "ready"
  },
  {
    description: "Draft secondary platform brand color.",
    draft_value: { hex: "#2563eb" },
    published_value: {},
    setting_key: "secondary_color",
    setting_type: "color",
    status: "draft",
    validation_status: "ready"
  },
  {
    description: "Draft accent platform brand color.",
    draft_value: { hex: "#f97316" },
    published_value: {},
    setting_key: "accent_color",
    setting_type: "color",
    status: "draft",
    validation_status: "ready"
  },
  {
    description: "Draft platform typography stack.",
    draft_value: { stack: "Inter / system sans" },
    published_value: {},
    setting_key: "typography",
    setting_type: "typography",
    status: "draft",
    validation_status: "ready"
  },
  {
    description: "Dark mode remains a draft placeholder and does not change live UI.",
    draft_value: { mode: "placeholder" },
    published_value: {},
    setting_key: "dark_mode",
    setting_type: "mode",
    status: "draft",
    validation_status: "placeholder"
  },
  {
    description: "Light mode remains a draft placeholder and does not change live UI.",
    draft_value: { mode: "placeholder" },
    published_value: {},
    setting_key: "light_mode",
    setting_type: "mode",
    status: "draft",
    validation_status: "placeholder"
  }
] satisfies Array<{
  description: string;
  draft_value: Record<string, unknown>;
  published_value: Record<string, unknown>;
  setting_key: string;
  setting_type: PlatformBrandSettingType;
  status: PlatformBrandSettingStatus;
  validation_status: PlatformBrandValidationStatus;
}>;

const knownFontPattern = /^(inter|system|sans|serif|mono|roboto|poppins|cairo|tajawal|nunito|arial|helvetica|georgia|ui-sans-serif|ui-serif|ui-monospace|[\s,/()-])+$/i;

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

function parseSettingType(value: unknown): PlatformBrandSettingType {
  const cleaned = text(value, 40);
  return settingTypes.includes(cleaned as PlatformBrandSettingType) ? cleaned as PlatformBrandSettingType : "custom";
}

function parseStatus(value: unknown): PlatformBrandSettingStatus {
  const cleaned = text(value, 40);
  return settingStatuses.includes(cleaned as PlatformBrandSettingStatus) ? cleaned as PlatformBrandSettingStatus : "draft";
}

function parseValidationStatus(value: unknown): PlatformBrandValidationStatus {
  const cleaned = text(value, 40);
  return validationStatuses.includes(cleaned as PlatformBrandValidationStatus) ? cleaned as PlatformBrandValidationStatus : "placeholder";
}

function parseSetting(row: unknown): PlatformBrandSettingRecord | null {
  if (!isRecord(row)) return null;

  const value = row as PlatformBrandSettingRow;
  const id = text(value.id, 120);
  const settingKey = text(value.setting_key, 120);

  if (!id || !settingKey) return null;

  return {
    createdAt: text(value.created_at, 80) || null,
    description: text(value.description, 500) || null,
    draftValue: safeRecord(value.draft_value),
    id,
    publishedValue: safeRecord(value.published_value),
    settingKey,
    settingType: parseSettingType(value.setting_type),
    status: parseStatus(value.status),
    updatedAt: text(value.updated_at, 80) || null,
    validationStatus: parseValidationStatus(value.validation_status)
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform brand settings.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform brand settings.");
  }

  return admin;
}

function settingSelect() {
  return "id, setting_key, setting_type, draft_value, published_value, status, validation_status, description, created_at, updated_at";
}

function validHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function safePathOrUrl(value: string) {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return !/[<>"'`]/.test(value);

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeInputValue(setting: PlatformBrandSettingRecord, value: unknown) {
  const record = safeRecord(value);
  const raw = text(record.value ?? record.hex ?? record.path ?? record.url ?? record.stack ?? record.mode, 1000);

  if (setting.settingType === "color") return { hex: raw };
  if (setting.settingType === "typography") return { stack: raw };
  if (setting.settingType === "logo" || setting.settingType === "favicon") {
    return raw.startsWith("http://") || raw.startsWith("https://") ? { url: raw } : { path: raw };
  }
  if (setting.settingType === "mode") return { mode: raw };

  return record;
}

export function validateBrandSetting(settingKey: string, value: unknown): PlatformBrandValidationResult {
  const key = text(settingKey, 120);
  const setting = seedSettings.find((item) => item.setting_key === key);
  const settingType = setting?.setting_type ?? "custom";
  const normalizedValue = normalizeInputValue({
    createdAt: null,
    description: null,
    draftValue: {},
    id: "validation",
    publishedValue: {},
    settingKey: key,
    settingType,
    status: "draft",
    updatedAt: null,
    validationStatus: "placeholder"
  }, value);

  if (settingType === "color") {
    return {
      normalizedValue,
      status: validHex(text(normalizedValue.hex, 20)) ? "ready" : "invalid"
    };
  }

  if (settingType === "typography") {
    const stack = text(normalizedValue.stack, 240);
    return {
      normalizedValue,
      status: stack && knownFontPattern.test(stack) ? "ready" : "invalid"
    };
  }

  if (settingType === "logo" || settingType === "favicon") {
    const path = text(normalizedValue.path ?? normalizedValue.url, 1000);
    return {
      normalizedValue,
      status: safePathOrUrl(path) ? "ready" : "invalid"
    };
  }

  if (settingType === "mode") {
    const mode = text(normalizedValue.mode, 40);
    return {
      normalizedValue,
      status: mode === "light" || mode === "dark" || mode === "placeholder" ? "placeholder" : "invalid"
    };
  }

  return {
    normalizedValue,
    status: Object.keys(normalizedValue).length ? "needs_attention" : "placeholder"
  };
}

async function ensureBrandSettingsSeeded() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_brand_settings" as never)
    .select("setting_key");

  if (error) {
    throw new Error(`Platform brand settings could not be inspected: ${error.message}`);
  }

  const existingKeys = new Set(
    (Array.isArray(data) ? data as unknown[] : [])
      .map((row) => text(safeRecord(row).setting_key, 120))
      .filter(Boolean)
  );
  const missingSettings = seedSettings.filter((setting) => !existingKeys.has(setting.setting_key));

  if (!missingSettings.length) return;

  const { error: insertError } = await admin
    .from("platform_brand_settings" as never)
    .insert(missingSettings as never);

  if (insertError) {
    throw new Error(`Platform brand settings could not be seeded: ${insertError.message}`);
  }
}

export async function listBrandSettings() {
  await requireSuperAdmin();
  await ensureBrandSettingsSeeded();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_brand_settings" as never)
    .select(settingSelect())
    .order("created_at" as never, { ascending: true });

  if (error) {
    throw new Error(`Platform brand settings could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseSetting(row))
    .filter((setting): setting is PlatformBrandSettingRecord => Boolean(setting));
}

export async function getBrandSetting(settingKey: string) {
  await requireSuperAdmin();
  await ensureBrandSettingsSeeded();
  const key = text(settingKey, 120);

  if (!key) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_brand_settings" as never)
    .select(settingSelect())
    .eq("setting_key" as never, key as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform brand setting could not be loaded: ${error.message}`);
  }

  return parseSetting(data);
}

export async function updateBrandSettingDraft(settingKey: string, value: unknown) {
  const current = await getBrandSetting(settingKey);

  if (!current) {
    throw new Error("Platform brand setting was not found.");
  }

  const validation = validateBrandSetting(current.settingKey, value);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_brand_settings" as never)
    .update({
      draft_value: validation.normalizedValue,
      status: "draft",
      validation_status: validation.status
    } as never)
    .eq("setting_key" as never, current.settingKey as never)
    .select(settingSelect())
    .single();

  if (error) {
    throw new Error(`Platform brand setting draft could not be updated: ${error.message}`);
  }

  return parseSetting(data);
}
