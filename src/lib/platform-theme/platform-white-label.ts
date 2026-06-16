import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformWhiteLabelStatus = "archived" | "draft" | "published";

export type PlatformWhiteLabelShellProps = {
  brandName: string;
  documentationUrl?: string | null;
  poweredByLabel?: string | null;
  showPoweredBy?: boolean;
  supportEmail?: string | null;
  supportUrl?: string | null;
};

export type PlatformWhiteLabelSettings = {
  brandName: string;
  documentationUrl: string | null;
  legalName: string | null;
  poweredByLabel: string | null;
  showPoweredBy: boolean;
  supportEmail: string | null;
  supportUrl: string | null;
};

export type PlatformWhiteLabelValidation = {
  errors: string[];
  ok: boolean;
  settings: PlatformWhiteLabelSettings;
  warnings: string[];
};

export type PlatformWhiteLabelRecord = {
  createdAt: string | null;
  draft: PlatformWhiteLabelSettings;
  hasDraftChanges: boolean;
  hasPublished: boolean;
  id: string;
  published: PlatformWhiteLabelSettings;
  status: PlatformWhiteLabelStatus;
  updatedAt: string | null;
  validation: PlatformWhiteLabelValidation;
};

export type WhiteLabelDraftInput = {
  brandName?: unknown;
  documentationUrl?: unknown;
  legalName?: unknown;
  poweredByLabel?: unknown;
  showPoweredBy?: unknown;
  supportEmail?: unknown;
  supportUrl?: unknown;
};

type PlatformWhiteLabelRow = {
  brand_name?: string | null;
  created_at?: string | null;
  documentation_url?: string | null;
  draft_value?: unknown;
  id?: string | null;
  legal_name?: string | null;
  powered_by_label?: string | null;
  published_value?: unknown;
  show_powered_by?: boolean | null;
  status?: string | null;
  support_email?: string | null;
  support_url?: string | null;
  updated_at?: string | null;
};

const singletonId = "00000000-0000-4000-8000-000000000001";
const statuses: PlatformWhiteLabelStatus[] = ["draft", "published", "archived"];

export const defaultPlatformWhiteLabelSettings: PlatformWhiteLabelSettings = {
  brandName: "SHASTORE AI",
  documentationUrl: null,
  legalName: null,
  poweredByLabel: "Powered by SHASTORE",
  showPoweredBy: true,
  supportEmail: null,
  supportUrl: null
};

const defaultSettings = defaultPlatformWhiteLabelSettings;

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

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "on" || value === "1") return true;
  if (value === "false" || value === "off" || value === "0") return false;
  return fallback;
}

function parseStatus(value: unknown): PlatformWhiteLabelStatus {
  const cleaned = text(value, 40);
  return statuses.includes(cleaned as PlatformWhiteLabelStatus) ? cleaned as PlatformWhiteLabelStatus : "draft";
}

function validEmail(value: string) {
  if (!value) return true;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
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

export function parsePlatformWhiteLabelSettings(
  value: unknown,
  fallback: PlatformWhiteLabelSettings = defaultSettings
): PlatformWhiteLabelSettings {
  return settingsFromJson(value, fallback);
}

function settingsFromJson(value: unknown, fallback: PlatformWhiteLabelSettings = defaultSettings): PlatformWhiteLabelSettings {
  const record = safeRecord(value);

  return {
    brandName: text(record.brandName, 120) || fallback.brandName,
    documentationUrl: text(record.documentationUrl, 1000) || null,
    legalName: text(record.legalName, 240) || null,
    poweredByLabel: text(record.poweredByLabel, 120) || null,
    showPoweredBy: parseBoolean(record.showPoweredBy, fallback.showPoweredBy),
    supportEmail: text(record.supportEmail, 240) || null,
    supportUrl: text(record.supportUrl, 1000) || null
  };
}

function settingsFromRow(row: PlatformWhiteLabelRow): PlatformWhiteLabelSettings {
  const draftJson = settingsFromJson(row.draft_value, defaultSettings);

  return {
    brandName: text(row.brand_name, 120) || draftJson.brandName,
    documentationUrl: text(row.documentation_url, 1000) || draftJson.documentationUrl,
    legalName: text(row.legal_name, 240) || draftJson.legalName,
    poweredByLabel: text(row.powered_by_label, 120) || draftJson.poweredByLabel,
    showPoweredBy: typeof row.show_powered_by === "boolean" ? row.show_powered_by : draftJson.showPoweredBy,
    supportEmail: text(row.support_email, 240) || draftJson.supportEmail,
    supportUrl: text(row.support_url, 1000) || draftJson.supportUrl
  };
}

function settingsToJson(settings: PlatformWhiteLabelSettings) {
  return {
    brandName: settings.brandName,
    documentationUrl: settings.documentationUrl,
    legalName: settings.legalName,
    poweredByLabel: settings.poweredByLabel,
    showPoweredBy: settings.showPoweredBy,
    supportEmail: settings.supportEmail,
    supportUrl: settings.supportUrl
  };
}

function settingsToColumns(settings: PlatformWhiteLabelSettings) {
  return {
    brand_name: settings.brandName,
    documentation_url: settings.documentationUrl,
    legal_name: settings.legalName,
    powered_by_label: settings.poweredByLabel,
    show_powered_by: settings.showPoweredBy,
    support_email: settings.supportEmail,
    support_url: settings.supportUrl
  };
}

function settingsEqual(left: PlatformWhiteLabelSettings, right: PlatformWhiteLabelSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform white-label settings.");
  }

  return admin;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform white-label settings.");
  }
}

function rowSelect() {
  return "id, brand_name, legal_name, support_email, support_url, documentation_url, show_powered_by, powered_by_label, status, draft_value, published_value, created_at, updated_at";
}

function parseInput(input: WhiteLabelDraftInput, current: PlatformWhiteLabelSettings): PlatformWhiteLabelSettings {
  return {
    brandName: input.brandName !== undefined ? text(input.brandName, 120) : current.brandName,
    documentationUrl: input.documentationUrl !== undefined ? text(input.documentationUrl, 1000) || null : current.documentationUrl,
    legalName: input.legalName !== undefined ? text(input.legalName, 240) || null : current.legalName,
    poweredByLabel: input.poweredByLabel !== undefined ? text(input.poweredByLabel, 120) || null : current.poweredByLabel,
    showPoweredBy: input.showPoweredBy !== undefined ? Boolean(input.showPoweredBy) : current.showPoweredBy,
    supportEmail: input.supportEmail !== undefined ? text(input.supportEmail, 240) || null : current.supportEmail,
    supportUrl: input.supportUrl !== undefined ? text(input.supportUrl, 1000) || null : current.supportUrl
  };
}

function isPlatformWhiteLabelSettings(value: WhiteLabelDraftInput | PlatformWhiteLabelSettings): value is PlatformWhiteLabelSettings {
  return typeof value.brandName === "string" && typeof value.showPoweredBy === "boolean";
}

export function validateWhiteLabelSettings(
  input: WhiteLabelDraftInput | PlatformWhiteLabelSettings,
  base: PlatformWhiteLabelSettings = defaultSettings
): PlatformWhiteLabelValidation {
  const settings = isPlatformWhiteLabelSettings(input) ? input : parseInput(input, base);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!settings.brandName) {
    errors.push("Brand name is required.");
  }

  if (settings.brandName.length > 120) {
    errors.push("Brand name must be 120 characters or fewer.");
  }

  if (settings.legalName && settings.legalName.length > 240) {
    errors.push("Legal name must be 240 characters or fewer.");
  }

  if (settings.supportEmail && !validEmail(settings.supportEmail)) {
    errors.push("Support email must be a valid email address.");
  }

  if (settings.supportUrl && !validHttpUrl(settings.supportUrl)) {
    errors.push("Support URL must be a valid http or https URL.");
  }

  if (settings.documentationUrl && !validHttpUrl(settings.documentationUrl)) {
    errors.push("Documentation URL must be a valid http or https URL.");
  }

  if (settings.showPoweredBy && !settings.poweredByLabel) {
    warnings.push("Powered-by label is empty while show powered by is enabled.");
  }

  if (!settings.supportEmail && !settings.supportUrl) {
    warnings.push("No support contact is configured.");
  }

  return {
    errors,
    ok: errors.length === 0,
    settings,
    warnings
  };
}

async function ensureWhiteLabelSeeded() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_white_label_settings" as never)
    .select("id")
    .eq("id" as never, singletonId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform white-label settings could not be inspected: ${error.message}`);
  }

  if (data) return;

  const draftValue = settingsToJson(defaultSettings);
  const { error: insertError } = await admin
    .from("platform_white_label_settings" as never)
    .insert({
      brand_name: defaultSettings.brandName,
      draft_value: draftValue,
      id: singletonId,
      powered_by_label: defaultSettings.poweredByLabel,
      published_value: {},
      show_powered_by: defaultSettings.showPoweredBy,
      status: "draft"
    } as never);

  if (insertError) {
    throw new Error(`Platform white-label settings could not be seeded: ${insertError.message}`);
  }
}

function parseRecord(row: unknown): PlatformWhiteLabelRecord | null {
  if (!isRecord(row)) return null;

  const value = row as PlatformWhiteLabelRow;
  const id = text(value.id, 120);

  if (!id) return null;

  const draft = settingsFromRow(value);
  const published = settingsFromJson(value.published_value, defaultSettings);
  const validation = validateWhiteLabelSettings(draft);
  const hasPublished = Object.keys(safeRecord(value.published_value)).length > 0;

  return {
    createdAt: text(value.created_at, 80) || null,
    draft,
    hasDraftChanges: hasPublished ? !settingsEqual(draft, published) : true,
    hasPublished,
    id,
    published: hasPublished ? published : defaultSettings,
    status: parseStatus(value.status),
    updatedAt: text(value.updated_at, 80) || null,
    validation
  };
}

async function loadWhiteLabelRecord() {
  await ensureWhiteLabelSeeded();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_white_label_settings" as never)
    .select(rowSelect())
    .eq("id" as never, singletonId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform white-label settings could not be loaded: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Platform white-label settings record was not found.");
  }

  return record;
}

export async function getWhiteLabelSettings(): Promise<PlatformWhiteLabelRecord> {
  await requireSuperAdmin();
  return loadWhiteLabelRecord();
}

export async function updateWhiteLabelDraft(input: WhiteLabelDraftInput): Promise<PlatformWhiteLabelRecord> {
  await requireSuperAdmin();

  const current = await loadWhiteLabelRecord();
  const nextSettings = parseInput(input, current.draft);
  const validation = validateWhiteLabelSettings(nextSettings);

  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "White-label draft validation failed.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_white_label_settings" as never)
    .update({
      ...settingsToColumns(nextSettings),
      draft_value: settingsToJson(nextSettings),
      status: "draft"
    } as never)
    .eq("id" as never, singletonId as never)
    .select(rowSelect())
    .single();

  if (error) {
    throw new Error(`Platform white-label draft could not be updated: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Platform white-label draft could not be parsed.");
  }

  return record;
}

export async function publishWhiteLabelSettings(): Promise<PlatformWhiteLabelRecord> {
  await requireSuperAdmin();

  const current = await loadWhiteLabelRecord();
  const validation = validateWhiteLabelSettings(current.draft);

  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "White-label settings cannot be published.");
  }

  const publishedValue = settingsToJson(current.draft);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_white_label_settings" as never)
    .update({
      ...settingsToColumns(current.draft),
      published_value: publishedValue,
      status: "published"
    } as never)
    .eq("id" as never, singletonId as never)
    .select(rowSelect())
    .single();

  if (error) {
    throw new Error(`Platform white-label settings could not be published: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Published white-label settings could not be parsed.");
  }

  return record;
}

export async function getPublishedWhiteLabelSettings(): Promise<PlatformWhiteLabelSettings> {
  const admin = createAdminClient();

  if (!admin) {
    return defaultSettings;
  }

  const { data, error } = await admin
    .from("platform_white_label_settings" as never)
    .select("published_value, status")
    .eq("id" as never, singletonId as never)
    .maybeSingle();

  if (error || !isRecord(data)) {
    return defaultSettings;
  }

  const row = data as PlatformWhiteLabelRow;

  if (row.status !== "published" || !Object.keys(safeRecord(row.published_value)).length) {
    return defaultSettings;
  }

  return settingsFromJson(row.published_value, defaultSettings);
}

export function buildWhiteLabelShellProps(settings: PlatformWhiteLabelSettings): PlatformWhiteLabelShellProps {
  return {
    brandName: settings.brandName,
    documentationUrl: settings.documentationUrl,
    poweredByLabel: settings.poweredByLabel,
    showPoweredBy: settings.showPoweredBy,
    supportEmail: settings.supportEmail,
    supportUrl: settings.supportUrl
  };
}
