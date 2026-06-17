import "server-only";

import { randomUUID } from "node:crypto";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type TemplateAssetType =
  | "custom"
  | "demo_media"
  | "documentation"
  | "icon"
  | "package_file"
  | "preview_image"
  | "screenshot";

export type TemplateAssetStatus = "archived" | "deleted" | "draft" | "published";

export type TemplateAssetRecord = {
  assetType: TemplateAssetType;
  createdAt: string | null;
  fileSize: number;
  id: string;
  metadata: Record<string, unknown>;
  mimeType: string;
  originalFilename: string;
  previewUrl: string | null;
  status: TemplateAssetStatus;
  storageProvider: string;
  templateId: string;
  updatedAt: string | null;
  uploadedBy: string | null;
  versionId: string | null;
};

export type TemplateAssetValidationResult = {
  error: string | null;
  ok: boolean;
};

export type UploadTemplateAssetOptions = {
  assetType?: TemplateAssetType;
  metadata?: Record<string, unknown>;
  versionId?: string | null;
};

export type ValidateTemplateAssetOptions = {
  assetType?: TemplateAssetType;
};

type TemplateAssetRow = {
  asset_type?: string | null;
  created_at?: string | null;
  file_size?: number | null;
  id?: string | null;
  metadata?: unknown;
  mime_type?: string | null;
  original_filename?: string | null;
  public_url?: string | null;
  status?: string | null;
  storage_provider?: string | null;
  storage_key?: string | null;
  template_id?: string | null;
  updated_at?: string | null;
  uploaded_by?: string | null;
  version_id?: string | null;
};

const assetTypes: TemplateAssetType[] = [
  "screenshot",
  "preview_image",
  "icon",
  "demo_media",
  "package_file",
  "documentation",
  "custom"
];
const assetStatuses: TemplateAssetStatus[] = ["draft", "published", "archived", "deleted"];
const assetBucket = "product-images";
const assetPrefix = "platform/templates/assets";
const maxImageSize = 8 * 1024 * 1024;
const maxDocumentationSize = 10 * 1024 * 1024;
const maxPackageFileSize = 2 * 1024 * 1024;
const imageAssetTypes = new Set<TemplateAssetType>(["demo_media", "icon", "preview_image", "screenshot"]);
const imageMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const imageExtensions = new Set(["jpeg", "jpg", "png", "webp"]);
const documentationMimeTypes = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/x-markdown"
]);
const documentationExtensions = new Set(["md", "pdf", "txt"]);
const packageFileMimeTypes = new Set(["application/json", "text/json"]);
const packageFileExtensions = new Set(["json"]);
const executableExtensions = new Set(["bat", "bin", "cmd", "com", "dll", "exe", "js", "msi", "ps1", "scr", "sh", "svg"]);
const safePreviewMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const assetSelect =
  "id, template_id, version_id, asset_type, storage_provider, public_url, original_filename, mime_type, file_size, metadata, status, uploaded_by, created_at, updated_at";

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

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function safeFileName(fileName: string) {
  const cleaned = text(fileName, 180)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "template-asset";
}

function parseAssetType(value: unknown): TemplateAssetType {
  const cleaned = text(value, 40);
  return assetTypes.includes(cleaned as TemplateAssetType) ? (cleaned as TemplateAssetType) : "custom";
}

function parseStatus(value: unknown): TemplateAssetStatus {
  const cleaned = text(value, 40);
  return assetStatuses.includes(cleaned as TemplateAssetStatus)
    ? (cleaned as TemplateAssetStatus)
    : "draft";
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeContentType(file: File) {
  if (file.type === "image/jpg") return "image/jpeg";
  return file.type;
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

function parseAsset(row: unknown): TemplateAssetRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateAssetRow;
  const id = text(value.id, 120);
  const templateId = text(value.template_id, 120);
  const mimeType = text(value.mime_type, 120);
  const originalFilename = text(value.original_filename, 240) || "asset";

  if (!id || !templateId || !mimeType) return null;

  return {
    assetType: parseAssetType(value.asset_type),
    createdAt: text(value.created_at, 80) || null,
    fileSize: Math.max(0, safeNumber(value.file_size)),
    id,
    metadata: safeRecord(value.metadata),
    mimeType,
    originalFilename,
    previewUrl: safePreviewUrl(value.public_url, mimeType),
    status: parseStatus(value.status),
    storageProvider: text(value.storage_provider, 120) || "supabase-storage",
    templateId,
    updatedAt: text(value.updated_at, 80) || null,
    uploadedBy: text(value.uploaded_by, 120) || null,
    versionId: text(value.version_id, 120) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage template assets.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template assets.");
  }

  return admin;
}

async function resolveTemplateId(templateId: string) {
  const cleaned = text(templateId, 120);

  if (!cleaned) {
    throw new Error("Template id is required.");
  }

  const templates = await listTemplates();
  const template =
    templates.find(
      (item) =>
        item.id === cleaned || item.slug === cleaned || item.templateKey === cleaned
    ) ?? null;

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  return template;
}

async function validatePackageJson(file: File) {
  const raw = await file.text();

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed)) {
      return "Package metadata file must be a JSON object.";
    }
  } catch {
    return "Package metadata file must contain valid JSON.";
  }

  return null;
}

function matchesImageRules(file: File, fileExtension: string) {
  if (file.type === "image/svg+xml" || fileExtension === "svg") {
    return "SVG files are not allowed.";
  }

  const imageAllowed =
    imageMimeTypes.has(file.type) || imageMimeTypes.has(normalizeContentType(file)) ||
    (!file.type && imageExtensions.has(fileExtension));

  if (!imageAllowed || !imageExtensions.has(fileExtension)) {
    return "Image assets must be PNG, JPG, JPEG, or WEBP.";
  }

  if (file.size > maxImageSize) {
    return "Image assets must be 8 MB or smaller.";
  }

  return null;
}

function matchesDocumentationRules(file: File, fileExtension: string) {
  const mimeAllowed =
    documentationMimeTypes.has(file.type) ||
    (file.type === "text/plain" && documentationExtensions.has(fileExtension));

  if (!mimeAllowed || !documentationExtensions.has(fileExtension)) {
    return "Documentation assets must be PDF, TXT, or MD.";
  }

  if (file.size > maxDocumentationSize) {
    return "Documentation assets must be 10 MB or smaller.";
  }

  return null;
}

export async function validateTemplateAsset(
  file: File,
  options: ValidateTemplateAssetOptions = {}
): Promise<TemplateAssetValidationResult> {
  const assetType = parseAssetType(options.assetType);
  const fileExtension = extension(file.name);

  if (!file.size) {
    return { error: "Select a file to upload.", ok: false };
  }

  if (executableExtensions.has(fileExtension)) {
    return { error: "Executable files cannot be uploaded as template assets.", ok: false };
  }

  if (assetType === "screenshot") {
    return {
      error: "Screenshots are managed in Screenshot Management. Use that workflow instead of template assets upload.",
      ok: false
    };
  }

  if (imageAssetTypes.has(assetType)) {
    const imageError = matchesImageRules(file, fileExtension);
    return imageError ? { error: imageError, ok: false } : { error: null, ok: true };
  }

  if (assetType === "documentation") {
    const documentationError = matchesDocumentationRules(file, fileExtension);
    return documentationError ? { error: documentationError, ok: false } : { error: null, ok: true };
  }

  if (assetType === "package_file") {
    const jsonAllowed =
      packageFileMimeTypes.has(file.type) ||
      file.type === "application/octet-stream" ||
      !file.type;

    if (!jsonAllowed || !packageFileExtensions.has(fileExtension)) {
      return { error: "Package metadata files must be JSON.", ok: false };
    }

    if (file.size > maxPackageFileSize) {
      return { error: "Package metadata files must be 2 MB or smaller.", ok: false };
    }

    const jsonError = await validatePackageJson(file);
    return jsonError ? { error: jsonError, ok: false } : { error: null, ok: true };
  }

  if (assetType === "custom") {
    const imageError = matchesImageRules(file, fileExtension);
    if (!imageError) {
      return { error: null, ok: true };
    }

    const documentationError = matchesDocumentationRules(file, fileExtension);
    if (!documentationError) {
      return { error: null, ok: true };
    }

    if (packageFileExtensions.has(fileExtension)) {
      if (file.size > maxPackageFileSize) {
        return { error: "Custom JSON assets must be 2 MB or smaller.", ok: false };
      }

      const jsonError = await validatePackageJson(file);
      return jsonError ? { error: jsonError, ok: false } : { error: null, ok: true };
    }

    return {
      error: "Custom assets must be an allowed image, documentation, or JSON file.",
      ok: false
    };
  }

  return { error: "Unknown asset type.", ok: false };
}

export async function uploadTemplateAsset(
  templateId: string,
  file: File,
  options: UploadTemplateAssetOptions = {}
) {
  const access = await requireSuperAdmin();
  const assetType = parseAssetType(options.assetType);
  const validation = await validateTemplateAsset(file, { assetType });

  if (!validation.ok) {
    throw new Error(validation.error ?? "Template asset failed validation.");
  }

  const template = await resolveTemplateId(templateId);
  const publishedVersion = await getPublishedTemplateVersion(template.id);
  const versionId = text(options.versionId, 120) || publishedVersion?.id || null;
  const metadata = safeRecord(options.metadata);

  const admin = requireAdminClient();
  const fileExtension = extension(file.name);
  const storageKey = `${assetPrefix}/${template.id}/${assetType}/${Date.now()}-${randomUUID()}-${safeFileName(file.name)}.${fileExtension}`;
  const contentType = normalizeContentType(file);
  const { error: uploadError } = await admin.storage.from(assetBucket).upload(storageKey, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false
  });

  if (uploadError) {
    throw new Error(`Template asset upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(assetBucket).getPublicUrl(storageKey);

  const { data, error } = await admin
    .from("template_assets" as never)
    .insert({
      asset_type: assetType,
      file_size: file.size,
      metadata,
      mime_type: contentType,
      original_filename: text(file.name, 240),
      public_url: text(publicUrl, 1000) || null,
      status: "draft",
      storage_key: storageKey,
      storage_provider: "supabase-storage",
      template_id: template.id,
      uploaded_by: access.user.id,
      version_id: versionId
    } as never)
    .select(assetSelect)
    .single();

  if (error) {
    throw new Error(`Template asset metadata could not be saved: ${error.message}`);
  }

  const parsed = parseAsset(data);

  if (!parsed) {
    throw new Error("Uploaded template asset could not be parsed.");
  }

  return parsed;
}

export async function listTemplateAssets(templateId: string): Promise<TemplateAssetRecord[]> {
  await requireSuperAdmin();

  const template = await resolveTemplateId(templateId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_assets" as never)
    .select(assetSelect)
    .eq("template_id" as never, template.id as never)
    .neq("status" as never, "deleted" as never)
    .order("created_at" as never, { ascending: false });

  if (error) {
    throw new Error(`Template assets could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseAsset(row))
    .filter((asset): asset is TemplateAssetRecord => Boolean(asset));
}

export async function listAllTemplateAssets(): Promise<TemplateAssetRecord[]> {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_assets" as never)
    .select(assetSelect)
    .neq("status" as never, "deleted" as never)
    .order("template_id" as never, { ascending: true })
    .order("created_at" as never, { ascending: false });

  if (error) {
    throw new Error(`Template assets could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseAsset(row))
    .filter((asset): asset is TemplateAssetRecord => Boolean(asset));
}

async function getAssetRowById(assetId: string) {
  const id = text(assetId, 120);

  if (!id) {
    throw new Error("Template asset id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_assets" as never)
    .select(`${assetSelect}, storage_key`)
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template asset could not be loaded: ${error.message}`);
  }

  if (!isRecord(data)) {
    throw new Error("Template asset was not found.");
  }

  const parsed = parseAsset(data);

  if (!parsed) {
    throw new Error("Template asset was not found.");
  }

  return {
    asset: parsed,
    storageKey: text((data as TemplateAssetRow).storage_key, 1000)
  };
}

export async function getTemplateAsset(assetId: string): Promise<TemplateAssetRecord | null> {
  await requireSuperAdmin();

  try {
    const { asset } = await getAssetRowById(assetId);
    return asset;
  } catch {
    return null;
  }
}

async function updateAssetStatus(assetId: string, status: TemplateAssetStatus) {
  await requireSuperAdmin();
  const { asset } = await getAssetRowById(assetId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_assets" as never)
    .update({ status } as never)
    .eq("id" as never, asset.id as never)
    .select(assetSelect)
    .single();

  if (error) {
    throw new Error(`Template asset status could not be updated: ${error.message}`);
  }

  const parsed = parseAsset(data);

  if (!parsed) {
    throw new Error("Updated template asset could not be parsed.");
  }

  return parsed;
}

export async function publishTemplateAsset(assetId: string) {
  return updateAssetStatus(assetId, "published");
}

export async function archiveTemplateAsset(assetId: string) {
  return updateAssetStatus(assetId, "archived");
}

export async function deleteDraftTemplateAsset(assetId: string) {
  await requireSuperAdmin();
  const { asset, storageKey } = await getAssetRowById(assetId);

  if (asset.status !== "draft") {
    throw new Error("Only draft template assets can be deleted.");
  }

  const admin = requireAdminClient();

  if (storageKey.startsWith(`${assetPrefix}/`)) {
    await admin.storage.from(assetBucket).remove([storageKey]);
  }

  const { data, error } = await admin
    .from("template_assets" as never)
    .update({ status: "deleted" } as never)
    .eq("id" as never, asset.id as never)
    .select(assetSelect)
    .single();

  if (error) {
    throw new Error(`Template asset could not be deleted: ${error.message}`);
  }

  const parsed = parseAsset(data);

  if (!parsed) {
    throw new Error("Deleted template asset could not be parsed.");
  }

  return parsed;
}

export function assetTypeLabel(type: TemplateAssetType | string) {
  if (type === "screenshot") return "Screenshot";
  if (type === "preview_image") return "Preview image";
  if (type === "icon") return "Icon";
  if (type === "demo_media") return "Demo media";
  if (type === "package_file") return "Package file";
  if (type === "documentation") return "Documentation";
  return "Custom";
}

export function formatAssetFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
