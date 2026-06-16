import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listBrandSettings, type PlatformBrandSettingRecord } from "@/src/lib/platform-theme/platform-brand-settings";
import {
  listPlatformThemeAssets,
  type PlatformThemeAssetRecord
} from "@/src/lib/platform-theme/platform-theme-assets";

export type PlatformThemeSnapshotType =
  | "asset_uploaded"
  | "draft_saved"
  | "manual_snapshot"
  | "published";

export type PlatformThemeVersionSnapshot = {
  assets: Array<{
    assetId: string;
    assetType: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    previewUrl: string | null;
    status: string;
  }>;
  capturedAt: string;
  settings: Array<{
    draftValue: Record<string, unknown>;
    publishedValue: Record<string, unknown>;
    settingKey: string;
    settingType: string;
    validationStatus: string;
  }>;
  summary: {
    assetCount: number;
    changedDraftSettings: string[];
    settingCount: number;
  };
};

export type PlatformThemeVersionRecord = {
  changedSettingsSummary: string;
  createdAt: string | null;
  createdBy: string | null;
  id: string;
  note: string | null;
  snapshot: PlatformThemeVersionSnapshot;
  snapshotType: PlatformThemeSnapshotType;
  versionNumber: number;
};

type PlatformThemeVersionRow = {
  created_at?: string | null;
  created_by?: string | null;
  id?: string | null;
  note?: string | null;
  snapshot?: unknown;
  snapshot_type?: string | null;
  version_number?: number | null;
};

const snapshotTypes: PlatformThemeSnapshotType[] = [
  "draft_saved",
  "published",
  "asset_uploaded",
  "manual_snapshot"
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
  "token"
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

function safePreviewUrl(value: unknown) {
  const cleaned = text(value, 1000);

  if (!cleaned) return null;

  try {
    const parsed = new URL(cleaned);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? cleaned : null;
  } catch {
    return cleaned.startsWith("/") && !cleaned.startsWith("//") ? cleaned : null;
  }
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

function safeRecord(value: unknown) {
  return isRecord(value) ? sanitizeValue(value) as Record<string, unknown> : {};
}

function parseSnapshotType(value: unknown): PlatformThemeSnapshotType {
  const cleaned = text(value, 40);
  return snapshotTypes.includes(cleaned as PlatformThemeSnapshotType)
    ? cleaned as PlatformThemeSnapshotType
    : "manual_snapshot";
}

function settingsDiffer(draftValue: Record<string, unknown>, publishedValue: Record<string, unknown>) {
  return JSON.stringify(draftValue) !== JSON.stringify(publishedValue);
}

function sanitizeSetting(setting: PlatformBrandSettingRecord) {
  const draftValue = safeRecord(setting.draftValue);
  const publishedValue = safeRecord(setting.publishedValue);

  if (isRecord(draftValue)) {
    delete draftValue.storageKey;
    delete draftValue.storageBucket;
  }

  if (isRecord(publishedValue)) {
    delete publishedValue.storageKey;
    delete publishedValue.storageBucket;
  }

  return {
    draftValue,
    publishedValue,
    settingKey: setting.settingKey,
    settingType: setting.settingType,
    validationStatus: setting.validationStatus
  };
}

function sanitizeAsset(asset: PlatformThemeAssetRecord) {
  return {
    assetId: asset.id,
    assetType: asset.assetType,
    fileName: asset.originalFilename,
    fileSize: asset.fileSize,
    mimeType: asset.mimeType,
    previewUrl: asset.previewUrl,
    status: asset.status
  };
}

function buildChangedSettingsSummary(snapshot: PlatformThemeVersionSnapshot) {
  const changed = snapshot.summary.changedDraftSettings;

  if (!changed.length) {
    return `${snapshot.summary.settingCount} settings, ${snapshot.summary.assetCount} assets`;
  }

  if (changed.length <= 3) {
    return changed.join(", ");
  }

  return `${changed.slice(0, 3).join(", ")} +${changed.length - 3} more`;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Super Admin access is required for platform theme versions.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme versions.");
  }

  return admin;
}

async function buildThemeSnapshot(): Promise<PlatformThemeVersionSnapshot> {
  const [settings, assets] = await Promise.all([listBrandSettings(), listPlatformThemeAssets()]);
  const sanitizedSettings = settings.map((setting) => sanitizeSetting(setting));
  const changedDraftSettings = sanitizedSettings
    .filter((setting) => settingsDiffer(setting.draftValue, setting.publishedValue))
    .map((setting) => setting.settingKey);

  return {
    assets: assets.map((asset) => sanitizeAsset(asset)),
    capturedAt: new Date().toISOString(),
    settings: sanitizedSettings,
    summary: {
      assetCount: assets.length,
      changedDraftSettings,
      settingCount: sanitizedSettings.length
    }
  };
}

async function nextVersionNumber() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_versions" as never)
    .select("version_number")
    .order("version_number" as never, { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Platform theme version number could not be loaded: ${error.message}`);
  }

  const latestRow: Record<string, unknown> = Array.isArray(data) && isRecord(data[0]) ? data[0] : {};
  const latest = typeof latestRow.version_number === "number" ? latestRow.version_number : 0;

  return latest + 1;
}

function parseSnapshot(value: unknown): PlatformThemeVersionSnapshot {
  const record = safeRecord(value);
  const summaryRecord = safeRecord(record.summary);
  const settings = Array.isArray(record.settings)
    ? record.settings
        .map((item) => {
          const setting = safeRecord(item);
          const settingKey = text(setting.settingKey, 120);

          if (!settingKey) return null;

          return {
            draftValue: safeRecord(setting.draftValue),
            publishedValue: safeRecord(setting.publishedValue),
            settingKey,
            settingType: text(setting.settingType, 40) || "custom",
            validationStatus: text(setting.validationStatus, 40) || "placeholder"
          };
        })
        .filter((item): item is PlatformThemeVersionSnapshot["settings"][number] => Boolean(item))
    : [];
  const assets = Array.isArray(record.assets)
    ? record.assets
        .map((item) => {
          const asset = safeRecord(item);
          const assetId = text(asset.assetId, 120);

          if (!assetId) return null;

          return {
            assetId,
            assetType: text(asset.assetType, 40) || "custom",
            fileName: text(asset.fileName, 240) || "Unknown file",
            fileSize: typeof asset.fileSize === "number" && Number.isFinite(asset.fileSize) ? asset.fileSize : 0,
            mimeType: text(asset.mimeType, 120) || "unknown",
            previewUrl: safePreviewUrl(asset.previewUrl),
            status: text(asset.status, 40) || "draft"
          };
        })
        .filter((item): item is PlatformThemeVersionSnapshot["assets"][number] => Boolean(item))
    : [];
  const changedDraftSettings = Array.isArray(summaryRecord.changedDraftSettings)
    ? summaryRecord.changedDraftSettings
        .map((item) => text(item, 120))
        .filter(Boolean)
    : [];

  return {
    assets,
    capturedAt: text(record.capturedAt, 80) || new Date().toISOString(),
    settings,
    summary: {
      assetCount: typeof summaryRecord.assetCount === "number" ? summaryRecord.assetCount : assets.length,
      changedDraftSettings,
      settingCount: typeof summaryRecord.settingCount === "number" ? summaryRecord.settingCount : settings.length
    }
  };
}

function parseVersion(row: unknown): PlatformThemeVersionRecord | null {
  if (!isRecord(row)) return null;

  const value = row as PlatformThemeVersionRow;
  const id = text(value.id, 120);
  const versionNumber = typeof value.version_number === "number" ? value.version_number : 0;

  if (!id || versionNumber <= 0) return null;

  const snapshot = parseSnapshot(value.snapshot);

  return {
    changedSettingsSummary: buildChangedSettingsSummary(snapshot),
    createdAt: text(value.created_at, 80) || null,
    createdBy: text(value.created_by, 120) || null,
    id,
    note: text(value.note, 500) || null,
    snapshot,
    snapshotType: parseSnapshotType(value.snapshot_type),
    versionNumber
  };
}

export async function createThemeVersion(snapshotType: PlatformThemeSnapshotType, note?: string | null) {
  const access = await requireSuperAdmin();
  const type = parseSnapshotType(snapshotType);
  const snapshot = await buildThemeSnapshot();
  const versionNumber = await nextVersionNumber();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_versions" as never)
    .insert({
      created_by: access.user.id,
      note: text(note, 500) || null,
      snapshot,
      snapshot_type: type,
      version_number: versionNumber
    } as never)
    .select("id, version_number, snapshot_type, snapshot, created_by, created_at, note")
    .single();

  if (error) {
    throw new Error(`Platform theme version could not be created: ${error.message}`);
  }

  const version = parseVersion(data);

  if (!version) {
    throw new Error("Platform theme version could not be parsed.");
  }

  return version;
}

export async function createDraftThemeSnapshot(note?: string | null) {
  return createThemeVersion("draft_saved", note ?? "Draft branding saved");
}

export async function createPublishedThemeSnapshot(note?: string | null) {
  return createThemeVersion("published", note ?? "Branding published");
}

export async function listThemeVersions(limit = 25) {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_versions" as never)
    .select("id, version_number, snapshot_type, snapshot, created_by, created_at, note")
    .order("version_number" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Platform theme versions could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseVersion(row))
    .filter((version): version is PlatformThemeVersionRecord => Boolean(version));
}

export async function getThemeVersion(versionId: string) {
  await requireSuperAdmin();
  const id = text(versionId, 120);

  if (!id) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_versions" as never)
    .select("id, version_number, snapshot_type, snapshot, created_by, created_at, note")
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform theme version could not be loaded: ${error.message}`);
  }

  return parseVersion(data);
}

export function snapshotTypeLabel(snapshotType: PlatformThemeSnapshotType) {
  if (snapshotType === "draft_saved") return "Draft saved";
  if (snapshotType === "published") return "Published";
  if (snapshotType === "asset_uploaded") return "Asset uploaded";
  return "Manual snapshot";
}
