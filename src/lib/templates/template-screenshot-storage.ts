import "server-only";

import { randomUUID } from "node:crypto";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type TemplateScreenshotType = "desktop" | "gallery" | "hero" | "mobile" | "tablet" | "thumbnail";
export type TemplateScreenshotStatus = "archived" | "deleted" | "draft" | "published";

export type TemplateScreenshotRecord = {
  createdAt: string | null;
  fileSize: number;
  id: string;
  mimeType: string;
  originalFilename: string;
  previewUrl: string | null;
  screenshotType: TemplateScreenshotType;
  sortOrder: number;
  status: TemplateScreenshotStatus;
  storageProvider: string;
  templateId: string;
  updatedAt: string | null;
  uploadedBy: string | null;
  versionId: string | null;
};

export type TemplateScreenshotValidationResult = {
  error: string | null;
  ok: boolean;
};

export type UploadTemplateScreenshotOptions = {
  screenshotType?: TemplateScreenshotType;
  sortOrder?: number;
  versionId?: string | null;
};

type TemplateScreenshotRow = {
  created_at?: string | null;
  file_size?: number | null;
  id?: string | null;
  mime_type?: string | null;
  original_filename?: string | null;
  public_url?: string | null;
  screenshot_type?: string | null;
  sort_order?: number | null;
  status?: string | null;
  storage_provider?: string | null;
  storage_key?: string | null;
  template_id?: string | null;
  updated_at?: string | null;
  uploaded_by?: string | null;
  version_id?: string | null;
};

const screenshotTypes: TemplateScreenshotType[] = ["desktop", "mobile", "tablet", "thumbnail", "hero", "gallery"];
const screenshotStatuses: TemplateScreenshotStatus[] = ["draft", "published", "archived", "deleted"];
const screenshotBucket = "product-images";
const screenshotPrefix = "platform/templates/screenshots";
const maxScreenshotSize = 8 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const allowedExtensions = new Set(["jpeg", "jpg", "png", "webp"]);
const executableExtensions = new Set(["bat", "bin", "cmd", "com", "dll", "exe", "js", "msi", "ps1", "scr", "sh", "svg"]);
const safePreviewMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const screenshotSelect =
  "id, template_id, version_id, screenshot_type, storage_provider, public_url, original_filename, mime_type, file_size, sort_order, status, uploaded_by, created_at, updated_at";

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

  return cleaned || "template-screenshot";
}

function parseScreenshotType(value: unknown): TemplateScreenshotType {
  const cleaned = text(value, 40);
  return screenshotTypes.includes(cleaned as TemplateScreenshotType)
    ? (cleaned as TemplateScreenshotType)
    : "gallery";
}

function parseStatus(value: unknown): TemplateScreenshotStatus {
  const cleaned = text(value, 40);
  return screenshotStatuses.includes(cleaned as TemplateScreenshotStatus)
    ? (cleaned as TemplateScreenshotStatus)
    : "draft";
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
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

function parseScreenshot(row: unknown): TemplateScreenshotRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateScreenshotRow;
  const id = text(value.id, 120);
  const templateId = text(value.template_id, 120);
  const mimeType = text(value.mime_type, 120);
  const originalFilename = text(value.original_filename, 240) || "screenshot";

  if (!id || !templateId || !mimeType) return null;

  return {
    createdAt: text(value.created_at, 80) || null,
    fileSize: Math.max(0, safeNumber(value.file_size)),
    id,
    mimeType,
    originalFilename,
    previewUrl: safePreviewUrl(value.public_url, mimeType),
    screenshotType: parseScreenshotType(value.screenshot_type),
    sortOrder: safeNumber(value.sort_order),
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
    throw new Error("Only Super Admin can manage template screenshots.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template screenshots.");
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

async function nextSortOrder(templateId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .select("sort_order")
    .eq("template_id" as never, templateId as never)
    .neq("status" as never, "deleted" as never)
    .order("sort_order" as never, { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Template screenshot order could not be resolved: ${error.message}`);
  }

  const row = Array.isArray(data) && data.length ? (data[0] as { sort_order?: number | null }) : null;
  return Math.max(0, safeNumber(row?.sort_order)) + 1;
}

export async function validateTemplateScreenshot(file: File): Promise<TemplateScreenshotValidationResult> {
  const fileExtension = extension(file.name);

  if (!file.size) {
    return { error: "Select a screenshot file to upload.", ok: false };
  }

  if (file.size > maxScreenshotSize) {
    return { error: "Screenshot must be 8 MB or smaller.", ok: false };
  }

  if (file.type === "image/svg+xml" || fileExtension === "svg") {
    return { error: "SVG screenshots are not allowed.", ok: false };
  }

  if (!allowedMimeTypes.has(file.type) || !allowedExtensions.has(fileExtension)) {
    return { error: "Screenshot must be PNG, JPG, JPEG, or WEBP.", ok: false };
  }

  if (executableExtensions.has(fileExtension)) {
    return { error: "Executable files cannot be uploaded as screenshots.", ok: false };
  }

  return { error: null, ok: true };
}

export async function uploadTemplateScreenshot(
  templateId: string,
  file: File,
  options: UploadTemplateScreenshotOptions = {}
) {
  const access = await requireSuperAdmin();
  const validation = await validateTemplateScreenshot(file);

  if (!validation.ok) {
    throw new Error(validation.error ?? "Screenshot file failed validation.");
  }

  const template = await resolveTemplateId(templateId);
  const screenshotType = options.screenshotType ? parseScreenshotType(options.screenshotType) : "gallery";
  const publishedVersion = await getPublishedTemplateVersion(template.id);
  const versionId = text(options.versionId, 120) || publishedVersion?.id || null;
  const sortOrder =
    typeof options.sortOrder === "number" && Number.isFinite(options.sortOrder)
      ? Math.max(0, Math.trunc(options.sortOrder))
      : await nextSortOrder(template.id);

  const admin = requireAdminClient();
  const fileExtension = extension(file.name);
  const storageKey = `${screenshotPrefix}/${template.id}/${Date.now()}-${randomUUID()}-${safeFileName(file.name)}.${fileExtension}`;
  const contentType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const { error: uploadError } = await admin.storage.from(screenshotBucket).upload(storageKey, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false
  });

  if (uploadError) {
    throw new Error(`Template screenshot upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl }
  } = admin.storage.from(screenshotBucket).getPublicUrl(storageKey);

  const { data, error } = await admin
    .from("template_screenshots" as never)
    .insert({
      file_size: file.size,
      mime_type: contentType,
      original_filename: text(file.name, 240),
      public_url: text(publicUrl, 1000) || null,
      screenshot_type: screenshotType,
      sort_order: sortOrder,
      status: "draft",
      storage_key: storageKey,
      storage_provider: "supabase-storage",
      template_id: template.id,
      uploaded_by: access.user.id,
      version_id: versionId
    } as never)
    .select(screenshotSelect)
    .single();

  if (error) {
    throw new Error(`Template screenshot metadata could not be saved: ${error.message}`);
  }

  const parsed = parseScreenshot(data);

  if (!parsed) {
    throw new Error("Uploaded template screenshot could not be parsed.");
  }

  return parsed;
}

export async function listTemplateScreenshots(templateId: string): Promise<TemplateScreenshotRecord[]> {
  await requireSuperAdmin();

  const template = await resolveTemplateId(templateId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .select(screenshotSelect)
    .eq("template_id" as never, template.id as never)
    .neq("status" as never, "deleted" as never)
    .order("sort_order" as never, { ascending: true })
    .order("created_at" as never, { ascending: true });

  if (error) {
    throw new Error(`Template screenshots could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseScreenshot(row))
    .filter((screenshot): screenshot is TemplateScreenshotRecord => Boolean(screenshot));
}

export async function listPublishedTemplateScreenshots(templateId: string): Promise<TemplateScreenshotRecord[]> {
  const template = await resolveTemplateId(templateId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .select(screenshotSelect)
    .eq("template_id" as never, template.id as never)
    .eq("status" as never, "published" as never)
    .order("sort_order" as never, { ascending: true })
    .order("created_at" as never, { ascending: true });

  if (error) {
    throw new Error(`Published template screenshots could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseScreenshot(row))
    .filter((screenshot): screenshot is TemplateScreenshotRecord => Boolean(screenshot));
}

export async function listAllTemplateScreenshots(): Promise<TemplateScreenshotRecord[]> {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .select(screenshotSelect)
    .neq("status" as never, "deleted" as never)
    .order("template_id" as never, { ascending: true })
    .order("sort_order" as never, { ascending: true });

  if (error) {
    throw new Error(`Template screenshots could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseScreenshot(row))
    .filter((screenshot): screenshot is TemplateScreenshotRecord => Boolean(screenshot));
}

async function getScreenshotById(screenshotId: string) {
  const id = text(screenshotId, 120);

  if (!id) {
    throw new Error("Screenshot id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .select(screenshotSelect)
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template screenshot could not be loaded: ${error.message}`);
  }

  const parsed = parseScreenshot(data);

  if (!parsed) {
    throw new Error("Template screenshot was not found.");
  }

  return parsed;
}

export async function publishTemplateScreenshot(screenshotId: string) {
  await requireSuperAdmin();
  const screenshot = await getScreenshotById(screenshotId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .update({ status: "published" } as never)
    .eq("id" as never, screenshot.id as never)
    .select(screenshotSelect)
    .single();

  if (error) {
    throw new Error(`Template screenshot could not be published: ${error.message}`);
  }

  const parsed = parseScreenshot(data);

  if (!parsed) {
    throw new Error("Published template screenshot could not be parsed.");
  }

  return parsed;
}

export async function archiveTemplateScreenshot(screenshotId: string) {
  await requireSuperAdmin();
  const screenshot = await getScreenshotById(screenshotId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_screenshots" as never)
    .update({ status: "archived" } as never)
    .eq("id" as never, screenshot.id as never)
    .select(screenshotSelect)
    .single();

  if (error) {
    throw new Error(`Template screenshot could not be archived: ${error.message}`);
  }

  const parsed = parseScreenshot(data);

  if (!parsed) {
    throw new Error("Archived template screenshot could not be parsed.");
  }

  return parsed;
}

export async function reorderTemplateScreenshots(templateId: string, order: string[]) {
  await requireSuperAdmin();

  const template = await resolveTemplateId(templateId);
  const cleanedOrder = order.map((id) => text(id, 120)).filter(Boolean);

  if (!cleanedOrder.length) {
    throw new Error("Screenshot order is required.");
  }

  const existing = await listTemplateScreenshots(template.id);
  const existingIds = new Set(existing.map((screenshot) => screenshot.id));

  for (const id of cleanedOrder) {
    if (!existingIds.has(id)) {
      throw new Error("Screenshot order includes an unknown screenshot id.");
    }
  }

  const admin = requireAdminClient();

  for (let index = 0; index < cleanedOrder.length; index += 1) {
    const { error } = await admin
      .from("template_screenshots" as never)
      .update({ sort_order: index } as never)
      .eq("id" as never, cleanedOrder[index] as never)
      .eq("template_id" as never, template.id as never);

    if (error) {
      throw new Error(`Template screenshot order could not be updated: ${error.message}`);
    }
  }

  return listTemplateScreenshots(template.id);
}

export function screenshotTypeLabel(type: TemplateScreenshotType) {
  if (type === "desktop") return "Desktop";
  if (type === "mobile") return "Mobile";
  if (type === "tablet") return "Tablet";
  if (type === "thumbnail") return "Thumbnail";
  if (type === "hero") return "Hero";
  return "Gallery";
}
