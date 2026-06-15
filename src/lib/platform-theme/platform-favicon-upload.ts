import "server-only";

import { randomUUID } from "node:crypto";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBrandSetting,
  updateBrandSettingDraft,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";

const platformAssetBucket = "product-images";
const platformFaviconPrefix = "platform/theme/favicons";
const maxPlatformFaviconSize = 1024 * 1024;
const allowedFaviconMimeTypes = new Set(["image/png", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);
const allowedFaviconExtensions = new Set(["ico", "png", "svg", "webp"]);
const executableExtensions = new Set(["bat", "bin", "cmd", "com", "dll", "exe", "js", "msi", "ps1", "scr", "sh"]);

export type PlatformFaviconValidationResult = {
  error: string | null;
  ok: boolean;
};

export type PlatformFaviconReference = {
  fileName: string | null;
  mimeType: string | null;
  previewUrl: string | null;
  size: number | null;
  storageBucket: string | null;
  storageKey: string | null;
  uploadedAt: string | null;
};

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

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function safeFileName(fileName: string) {
  const cleaned = text(fileName, 180)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "platform-favicon";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage the platform favicon.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform favicon upload.");
  }

  return admin;
}

function faviconReferenceFromSetting(setting: PlatformBrandSettingRecord | null): PlatformFaviconReference {
  const draftValue = setting?.draftValue ?? {};
  const value = isRecord(draftValue) ? draftValue : {};

  return {
    fileName: text(value.fileName, 240) || null,
    mimeType: text(value.mimeType, 120) || null,
    previewUrl: text(value.url ?? value.path, 1000) || null,
    size: typeof value.size === "number" && Number.isFinite(value.size) ? value.size : null,
    storageBucket: text(value.storageBucket, 120) || null,
    storageKey: text(value.storageKey, 500) || null,
    uploadedAt: text(value.uploadedAt, 80) || null
  };
}

async function svgLooksSafe(file: File) {
  if (file.type !== "image/svg+xml") return true;

  const svg = await file.text();

  return !/<script\b/i.test(svg) &&
    !/\son\w+\s*=/i.test(svg) &&
    !/\bjavascript:/i.test(svg) &&
    !/<foreignObject\b/i.test(svg);
}

export async function validatePlatformFavicon(file: File): Promise<PlatformFaviconValidationResult> {
  const fileExtension = extension(file.name);

  if (!file.size) {
    return { error: "Select a favicon file to upload.", ok: false };
  }

  if (file.size > maxPlatformFaviconSize) {
    return { error: "Favicon file must be 1 MB or smaller.", ok: false };
  }

  if (!allowedFaviconMimeTypes.has(file.type) || !allowedFaviconExtensions.has(fileExtension)) {
    return { error: "Favicon must be ICO, PNG, SVG, or WEBP.", ok: false };
  }

  if (executableExtensions.has(fileExtension)) {
    return { error: "Executable files cannot be uploaded as platform favicons.", ok: false };
  }

  if (!(await svgLooksSafe(file))) {
    return { error: "SVG favicon contains unsafe script, event, or embedded content.", ok: false };
  }

  return { error: null, ok: true };
}

export async function uploadPlatformFavicon(file: File) {
  await requireSuperAdmin();
  const validation = await validatePlatformFavicon(file);

  if (!validation.ok) {
    throw new Error(validation.error ?? "Favicon file failed validation.");
  }

  const admin = requireAdminClient();
  const fileExtension = extension(file.name);
  const storageKey = `${platformFaviconPrefix}/${Date.now()}-${randomUUID()}-${safeFileName(file.name)}.${fileExtension}`;
  const { error: uploadError } = await admin.storage.from(platformAssetBucket).upload(storageKey, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    throw new Error(`Platform favicon upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(platformAssetBucket).getPublicUrl(storageKey);
  const uploadedAt = new Date().toISOString();
  const faviconDraft = await updateBrandSettingDraft("favicon", {
    fileName: text(file.name, 240),
    mimeType: file.type,
    size: file.size,
    storageBucket: platformAssetBucket,
    storageKey,
    uploadedAt,
    url: publicUrl
  });

  return {
    favicon: faviconReferenceFromSetting(faviconDraft),
    setting: faviconDraft
  };
}

export async function getCurrentPlatformFavicon() {
  await requireSuperAdmin();
  const setting = await getBrandSetting("favicon");

  return {
    favicon: faviconReferenceFromSetting(setting),
    setting
  };
}

export async function deleteDraftPlatformFavicon() {
  await requireSuperAdmin();
  const setting = await getBrandSetting("favicon");
  const admin = requireAdminClient();
  const draft = setting?.draftValue ?? {};
  const published = setting?.publishedValue ?? {};
  const draftStorageKey = isRecord(draft) ? text(draft.storageKey, 500) : "";
  const publishedStorageKey = isRecord(published) ? text(published.storageKey, 500) : "";

  if (draftStorageKey && draftStorageKey.startsWith(`${platformFaviconPrefix}/`) && draftStorageKey !== publishedStorageKey) {
    await admin.storage.from(platformAssetBucket).remove([draftStorageKey]);
  }

  const restoredDraft = isRecord(published) && Object.keys(published).length
    ? published
    : { path: "/favicon.ico" };
  const updated = await updateBrandSettingDraft("favicon", restoredDraft);

  return {
    favicon: faviconReferenceFromSetting(updated),
    setting: updated
  };
}
