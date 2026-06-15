import "server-only";

import { randomUUID } from "node:crypto";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBrandSetting,
  updateBrandSettingDraft,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import { registerPlatformThemeAsset } from "@/src/lib/platform-theme/platform-theme-assets";

const platformAssetBucket = "product-images";
const platformLogoPrefix = "platform/theme/logos";
const maxPlatformLogoSize = 5 * 1024 * 1024;
const allowedLogoMimeTypes = new Set(["image/png", "image/svg+xml", "image/webp"]);
const allowedLogoExtensions = new Set(["png", "svg", "webp"]);
const executableExtensions = new Set(["bat", "bin", "cmd", "com", "dll", "exe", "js", "msi", "ps1", "scr", "sh"]);

export type PlatformLogoValidationResult = {
  error: string | null;
  ok: boolean;
};

export type PlatformLogoReference = {
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

  return cleaned || "platform-logo";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage the platform logo.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform logo upload.");
  }

  return admin;
}

function logoReferenceFromSetting(setting: PlatformBrandSettingRecord | null): PlatformLogoReference {
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

export async function validatePlatformLogo(file: File): Promise<PlatformLogoValidationResult> {
  const fileExtension = extension(file.name);

  if (!file.size) {
    return { error: "Select a logo file to upload.", ok: false };
  }

  if (file.size > maxPlatformLogoSize) {
    return { error: "Logo file must be 5 MB or smaller.", ok: false };
  }

  if (!allowedLogoMimeTypes.has(file.type) || !allowedLogoExtensions.has(fileExtension)) {
    return { error: "Logo must be PNG, SVG, or WEBP.", ok: false };
  }

  if (executableExtensions.has(fileExtension)) {
    return { error: "Executable files cannot be uploaded as platform logos.", ok: false };
  }

  if (!(await svgLooksSafe(file))) {
    return { error: "SVG logo contains unsafe script, event, or embedded content.", ok: false };
  }

  return { error: null, ok: true };
}

export async function uploadPlatformLogo(file: File) {
  await requireSuperAdmin();
  const validation = await validatePlatformLogo(file);

  if (!validation.ok) {
    throw new Error(validation.error ?? "Logo file failed validation.");
  }

  const admin = requireAdminClient();
  const fileExtension = extension(file.name);
  const storageKey = `${platformLogoPrefix}/${Date.now()}-${randomUUID()}-${safeFileName(file.name)}.${fileExtension}`;
  const { error: uploadError } = await admin.storage.from(platformAssetBucket).upload(storageKey, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    throw new Error(`Platform logo upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(platformAssetBucket).getPublicUrl(storageKey);
  const uploadedAt = new Date().toISOString();
  const themeAsset = await registerPlatformThemeAsset({
    assetType: "logo",
    fileSize: file.size,
    mimeType: file.type,
    originalFilename: text(file.name, 240),
    publicUrl,
    status: "draft",
    storageKey,
    storageProvider: "supabase-storage"
  });
  const logoDraft = await updateBrandSettingDraft("platform_logo", {
    assetId: themeAsset?.id,
    fileName: text(file.name, 240),
    mimeType: file.type,
    size: file.size,
    storageBucket: platformAssetBucket,
    storageKey,
    uploadedAt,
    url: publicUrl
  });

  return {
    logo: logoReferenceFromSetting(logoDraft),
    setting: logoDraft
  };
}

export async function getCurrentPlatformLogo() {
  await requireSuperAdmin();
  const setting = await getBrandSetting("platform_logo");

  return {
    logo: logoReferenceFromSetting(setting),
    setting
  };
}

export async function deleteDraftPlatformLogo() {
  await requireSuperAdmin();
  const setting = await getBrandSetting("platform_logo");
  const admin = requireAdminClient();
  const draft = setting?.draftValue ?? {};
  const published = setting?.publishedValue ?? {};
  const draftStorageKey = isRecord(draft) ? text(draft.storageKey, 500) : "";
  const publishedStorageKey = isRecord(published) ? text(published.storageKey, 500) : "";

  if (draftStorageKey && draftStorageKey.startsWith(`${platformLogoPrefix}/`) && draftStorageKey !== publishedStorageKey) {
    await admin.storage.from(platformAssetBucket).remove([draftStorageKey]);
  }

  const restoredDraft = isRecord(published) && Object.keys(published).length
    ? published
    : { path: "/brand/platform-logo.svg" };
  const updated = await updateBrandSettingDraft("platform_logo", restoredDraft);

  return {
    logo: logoReferenceFromSetting(updated),
    setting: updated
  };
}
