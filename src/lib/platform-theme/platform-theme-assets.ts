import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformThemeAssetType = "brand_image" | "custom" | "favicon" | "logo" | "og_image";
export type PlatformThemeAssetStatus = "archived" | "deleted" | "draft" | "published";

export type PlatformThemeAssetRecord = {
  assetType: PlatformThemeAssetType;
  createdAt: string | null;
  fileSize: number;
  id: string;
  mimeType: string;
  originalFilename: string;
  previewUrl: string | null;
  status: PlatformThemeAssetStatus;
  storageProvider: string;
  updatedAt: string | null;
  uploadedBy: string | null;
};

export type RegisterPlatformThemeAssetInput = {
  assetType: PlatformThemeAssetType;
  fileSize: number;
  mimeType: string;
  originalFilename: string;
  publicUrl?: string | null;
  status?: PlatformThemeAssetStatus;
  storageKey: string;
  storageProvider?: string | null;
  uploadedBy?: string | null;
};

type PlatformThemeAssetRow = {
  asset_type?: string | null;
  created_at?: string | null;
  file_size?: number | null;
  id?: string | null;
  mime_type?: string | null;
  original_filename?: string | null;
  public_url?: string | null;
  status?: string | null;
  storage_provider?: string | null;
  updated_at?: string | null;
  uploaded_by?: string | null;
};

const assetTypes: PlatformThemeAssetType[] = ["logo", "favicon", "og_image", "brand_image", "custom"];
const assetStatuses: PlatformThemeAssetStatus[] = ["draft", "published", "archived", "deleted"];
const safePreviewMimeTypes = new Set(["image/png", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);

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

function parseAssetType(value: unknown): PlatformThemeAssetType {
  const cleaned = text(value, 40);
  return assetTypes.includes(cleaned as PlatformThemeAssetType) ? cleaned as PlatformThemeAssetType : "custom";
}

function parseStatus(value: unknown): PlatformThemeAssetStatus {
  const cleaned = text(value, 40);
  return assetStatuses.includes(cleaned as PlatformThemeAssetStatus) ? cleaned as PlatformThemeAssetStatus : "draft";
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safePreviewUrl(value: unknown, mimeType: string) {
  const url = text(value, 1000);

  if (!url || !safePreviewMimeTypes.has(mimeType)) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function parseAsset(row: unknown): PlatformThemeAssetRecord | null {
  if (!isRecord(row)) return null;

  const value = row as PlatformThemeAssetRow;
  const id = text(value.id, 120);
  const mimeType = text(value.mime_type, 120);
  const originalFilename = text(value.original_filename, 240);

  if (!id || !mimeType || !originalFilename) return null;

  return {
    assetType: parseAssetType(value.asset_type),
    createdAt: text(value.created_at, 80) || null,
    fileSize: safeNumber(value.file_size),
    id,
    mimeType,
    originalFilename,
    previewUrl: safePreviewUrl(value.public_url, mimeType),
    status: parseStatus(value.status),
    storageProvider: text(value.storage_provider, 120) || "supabase-storage",
    updatedAt: text(value.updated_at, 80) || null,
    uploadedBy: text(value.uploaded_by, 120) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage platform theme assets.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme assets.");
  }

  return admin;
}

function assetSelect() {
  return "id, asset_type, storage_provider, public_url, mime_type, file_size, original_filename, status, uploaded_by, created_at, updated_at";
}

export async function listPlatformThemeAssets() {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .select(assetSelect())
    .neq("status" as never, "deleted" as never)
    .order("created_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Platform theme assets could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseAsset(row))
    .filter((asset): asset is PlatformThemeAssetRecord => Boolean(asset));
}

export async function getPlatformThemeAsset(assetId: string) {
  await requireSuperAdmin();
  const id = text(assetId, 120);

  if (!id) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .select(assetSelect())
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Platform theme asset could not be loaded: ${error.message}`);
  }

  return parseAsset(data);
}

export async function registerPlatformThemeAsset(input: RegisterPlatformThemeAssetInput) {
  const access = await requireSuperAdmin();
  const assetType = assetTypes.includes(input.assetType) ? input.assetType : "custom";
  const status = input.status && assetStatuses.includes(input.status) ? input.status : "draft";
  const storageKey = text(input.storageKey, 1000);
  const mimeType = text(input.mimeType, 120);
  const originalFilename = text(input.originalFilename, 240);

  if (!storageKey || !mimeType || !originalFilename) {
    throw new Error("Platform theme asset is missing required storage metadata.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .insert({
      asset_type: assetType,
      file_size: Math.max(0, Math.round(input.fileSize)),
      mime_type: mimeType,
      original_filename: originalFilename,
      public_url: text(input.publicUrl, 1000) || null,
      status,
      storage_key: storageKey,
      storage_provider: text(input.storageProvider, 120) || "supabase-storage",
      uploaded_by: text(input.uploadedBy, 120) || access.user.id
    } as never)
    .select(assetSelect())
    .single();

  if (error) {
    throw new Error(`Platform theme asset could not be registered: ${error.message}`);
  }

  return parseAsset(data);
}

export async function archivePlatformThemeAsset(assetId: string) {
  return updatePlatformThemeAssetStatus(assetId, "archived");
}

export async function markThemeAssetPublished(assetId: string) {
  return updatePlatformThemeAssetStatus(assetId, "published");
}

async function updatePlatformThemeAssetStatus(assetId: string, status: PlatformThemeAssetStatus) {
  await requireSuperAdmin();
  const id = text(assetId, 120);

  if (!id) {
    throw new Error("Platform theme asset id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .update({ status } as never)
    .eq("id" as never, id as never)
    .select(assetSelect())
    .single();

  if (error) {
    throw new Error(`Platform theme asset status could not be updated: ${error.message}`);
  }

  return parseAsset(data);
}
