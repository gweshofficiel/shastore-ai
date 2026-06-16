import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultPlatformWhiteLabelSettings,
  getPublishedWhiteLabelSettings,
  parsePlatformWhiteLabelSettings,
  validateWhiteLabelSettings,
  type PlatformWhiteLabelSettings,
  type PlatformWhiteLabelValidation,
  type WhiteLabelDraftInput
} from "@/src/lib/platform-theme/platform-white-label";

export type ResellerBrandingInheritanceMode = "custom_branding" | "inherit_platform";
export type ResellerBrandingStatus = "archived" | "draft" | "published";
export type ResellerBrandingSource = "platform" | "reseller_custom" | "reseller_defaults";

export type ResellerBrandingRecord = {
  createdAt: string | null;
  customDraft: PlatformWhiteLabelSettings;
  customPublished: PlatformWhiteLabelSettings;
  hasCustomDraftChanges: boolean;
  hasCustomPublished: boolean;
  id: string;
  inheritanceMode: ResellerBrandingInheritanceMode;
  resellerId: string;
  status: ResellerBrandingStatus;
  updatedAt: string | null;
  validation: PlatformWhiteLabelValidation;
};

export type EffectiveResellerBranding = {
  branding: PlatformWhiteLabelSettings;
  customPreview: PlatformWhiteLabelSettings;
  effectiveSource: ResellerBrandingSource;
  inheritanceMode: ResellerBrandingInheritanceMode;
  platformPreview: PlatformWhiteLabelSettings;
  publishStatus: ResellerBrandingStatus;
  record: ResellerBrandingRecord;
};

export type ResellerBrandingAdminSummary = EffectiveResellerBranding;

type ResellerBrandingRow = {
  created_at?: string | null;
  draft_value?: unknown;
  id?: string | null;
  inheritance_mode?: string | null;
  published_value?: unknown;
  reseller_id?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

const inheritanceModes: ResellerBrandingInheritanceMode[] = ["inherit_platform", "custom_branding"];
const statuses: ResellerBrandingStatus[] = ["draft", "published", "archived"];

const emptyCustomBranding: PlatformWhiteLabelSettings = {
  brandName: "",
  documentationUrl: null,
  legalName: null,
  poweredByLabel: null,
  showPoweredBy: true,
  supportEmail: null,
  supportUrl: null
};

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

function parseInheritanceMode(value: unknown): ResellerBrandingInheritanceMode {
  const cleaned = text(value, 40);
  return inheritanceModes.includes(cleaned as ResellerBrandingInheritanceMode)
    ? cleaned as ResellerBrandingInheritanceMode
    : "inherit_platform";
}

function parseStatus(value: unknown): ResellerBrandingStatus {
  const cleaned = text(value, 40);
  return statuses.includes(cleaned as ResellerBrandingStatus) ? cleaned as ResellerBrandingStatus : "draft";
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

function settingsEqual(left: PlatformWhiteLabelSettings, right: PlatformWhiteLabelSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
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

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage reseller branding settings.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for reseller branding settings.");
  }

  return admin;
}

function rowSelect() {
  return "id, reseller_id, inheritance_mode, draft_value, published_value, status, created_at, updated_at";
}

function parseRecord(row: unknown): ResellerBrandingRecord | null {
  if (!isRecord(row)) return null;

  const value = row as ResellerBrandingRow;
  const id = text(value.id, 120);
  const resellerId = text(value.reseller_id, 120);

  if (!id || !resellerId) return null;

  const customDraft = parsePlatformWhiteLabelSettings(value.draft_value, emptyCustomBranding);
  const customPublished = parsePlatformWhiteLabelSettings(value.published_value, emptyCustomBranding);
  const hasCustomPublished = Object.keys(safeRecord(value.published_value)).length > 0;

  return {
    createdAt: text(value.created_at, 80) || null,
    customDraft,
    customPublished: hasCustomPublished ? customPublished : emptyCustomBranding,
    hasCustomDraftChanges: hasCustomPublished ? !settingsEqual(customDraft, customPublished) : Object.keys(safeRecord(value.draft_value)).length > 0,
    hasCustomPublished,
    id,
    inheritanceMode: parseInheritanceMode(value.inheritance_mode),
    resellerId,
    status: parseStatus(value.status),
    updatedAt: text(value.updated_at, 80) || null,
    validation: validateWhiteLabelSettings(customDraft, emptyCustomBranding)
  };
}

async function ensureResellerBrandingRow(resellerId: string) {
  const cleanedResellerId = text(resellerId, 120);

  if (!cleanedResellerId) {
    throw new Error("Reseller id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .select("id")
    .eq("reseller_id" as never, cleanedResellerId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Reseller branding settings could not be inspected: ${error.message}`);
  }

  if (data) return cleanedResellerId;

  const { error: insertError } = await admin
    .from("reseller_branding_settings" as never)
    .insert({
      draft_value: {},
      inheritance_mode: "inherit_platform",
      published_value: {},
      reseller_id: cleanedResellerId,
      status: "draft"
    } as never);

  if (insertError) {
    throw new Error(`Reseller branding settings could not be seeded: ${insertError.message}`);
  }

  return cleanedResellerId;
}

async function loadResellerBrandingRecord(resellerId: string) {
  const cleanedResellerId = await ensureResellerBrandingRow(resellerId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .select(rowSelect())
    .eq("reseller_id" as never, cleanedResellerId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Reseller branding settings could not be loaded: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Reseller branding settings record was not found.");
  }

  return record;
}

function resolveEffectiveBranding(
  record: ResellerBrandingRecord,
  platformPreview: PlatformWhiteLabelSettings
): EffectiveResellerBranding {
  let effectiveSource: ResellerBrandingSource = "platform";
  let branding = platformPreview;

  if (record.inheritanceMode === "custom_branding") {
    if (record.hasCustomPublished) {
      effectiveSource = "reseller_custom";
      branding = record.customPublished;
    } else {
      effectiveSource = "reseller_defaults";
      branding = defaultPlatformWhiteLabelSettings;
    }
  }

  return {
    branding,
    customPreview: record.customDraft,
    effectiveSource,
    inheritanceMode: record.inheritanceMode,
    platformPreview,
    publishStatus: record.status,
    record
  };
}

export async function getResellerBranding(resellerId: string): Promise<ResellerBrandingRecord> {
  await requireSuperAdmin();
  return loadResellerBrandingRecord(resellerId);
}

export async function getEffectiveResellerBranding(resellerId: string): Promise<EffectiveResellerBranding> {
  await requireSuperAdmin();

  const [record, platformPreview] = await Promise.all([
    loadResellerBrandingRecord(resellerId),
    getPublishedWhiteLabelSettings()
  ]);

  return resolveEffectiveBranding(record, platformPreview);
}

export async function listResellerBrandingSummaries(resellerIds: string[]): Promise<Map<string, EffectiveResellerBranding>> {
  await requireSuperAdmin();

  const cleanedIds = [...new Set(resellerIds.map((id) => text(id, 120)).filter(Boolean))];
  const summaries = new Map<string, EffectiveResellerBranding>();

  if (!cleanedIds.length) {
    return summaries;
  }

  await Promise.all(cleanedIds.map((resellerId) => ensureResellerBrandingRow(resellerId)));

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .select(rowSelect())
    .in("reseller_id" as never, cleanedIds as never);

  if (error) {
    throw new Error(`Reseller branding settings could not be listed: ${error.message}`);
  }

  const platformPreview = await getPublishedWhiteLabelSettings();
  const records = new Map(
    (Array.isArray(data) ? data : [])
      .map((row) => parseRecord(row))
      .filter((record): record is ResellerBrandingRecord => Boolean(record))
      .map((record) => [record.resellerId, record] as const)
  );

  for (const resellerId of cleanedIds) {
    const record = records.get(resellerId) ?? {
      createdAt: null,
      customDraft: emptyCustomBranding,
      customPublished: emptyCustomBranding,
      hasCustomDraftChanges: false,
      hasCustomPublished: false,
      id: "pending",
      inheritanceMode: "inherit_platform" as const,
      resellerId,
      status: "draft" as const,
      updatedAt: null,
      validation: validateWhiteLabelSettings(emptyCustomBranding, emptyCustomBranding)
    };

    summaries.set(resellerId, resolveEffectiveBranding(record, platformPreview));
  }

  return summaries;
}

export async function updateResellerBrandingDraft(resellerId: string, input: WhiteLabelDraftInput) {
  await requireSuperAdmin();

  const current = await loadResellerBrandingRecord(resellerId);
  const nextSettings = parseInput(input, current.customDraft);
  const validation = validateWhiteLabelSettings(nextSettings, emptyCustomBranding);

  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "Reseller branding draft validation failed.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .update({
      draft_value: settingsToJson(nextSettings),
      inheritance_mode: "custom_branding",
      status: "draft"
    } as never)
    .eq("reseller_id" as never, current.resellerId as never)
    .select(rowSelect())
    .single();

  if (error) {
    throw new Error(`Reseller branding draft could not be updated: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Reseller branding draft could not be parsed.");
  }

  return record;
}

export async function publishResellerBranding(resellerId: string) {
  await requireSuperAdmin();

  const current = await loadResellerBrandingRecord(resellerId);

  if (current.inheritanceMode !== "custom_branding") {
    throw new Error("Switch to custom branding before publishing reseller branding.");
  }

  const validation = validateWhiteLabelSettings(current.customDraft, emptyCustomBranding);

  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "Reseller branding cannot be published.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .update({
      inheritance_mode: "custom_branding",
      published_value: settingsToJson(current.customDraft),
      status: "published"
    } as never)
    .eq("reseller_id" as never, current.resellerId as never)
    .select(rowSelect())
    .single();

  if (error) {
    throw new Error(`Reseller branding could not be published: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Published reseller branding could not be parsed.");
  }

  return record;
}

export async function switchInheritanceMode(resellerId: string, mode: ResellerBrandingInheritanceMode) {
  await requireSuperAdmin();

  if (!inheritanceModes.includes(mode)) {
    throw new Error("Unsupported reseller branding inheritance mode.");
  }

  await ensureResellerBrandingRow(resellerId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_branding_settings" as never)
    .update({
      inheritance_mode: mode
    } as never)
    .eq("reseller_id" as never, text(resellerId, 120) as never)
    .select(rowSelect())
    .single();

  if (error) {
    throw new Error(`Reseller branding inheritance mode could not be updated: ${error.message}`);
  }

  const record = parseRecord(data);

  if (!record) {
    throw new Error("Reseller branding inheritance mode could not be parsed.");
  }

  return record;
}
