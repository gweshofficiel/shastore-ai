import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";

export type TemplateVersionStatus = "archived" | "draft" | "published";

export type TemplateVersionRecord = {
  changelog: string | null;
  createdAt: string | null;
  createdBy: string | null;
  id: string;
  packageSnapshot: Record<string, unknown>;
  publishedAt: string | null;
  status: TemplateVersionStatus;
  templateId: string;
  updatedAt: string | null;
  versionNumber: string;
};

export type TemplateVersionStats = {
  archivedVersions: number;
  draftVersions: number;
  publishedVersions: number;
  templatesWithPublishedVersion: number;
  totalVersions: number;
};

export type CreateTemplateVersionDraftInput = {
  changelog?: string | null;
  createdBy?: string | null;
  packageSnapshot?: Record<string, unknown>;
  versionNumber: string;
};

type TemplateVersionRow = {
  changelog?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  id?: string | null;
  package_snapshot?: unknown;
  published_at?: string | null;
  status?: string | null;
  template_id?: string | null;
  updated_at?: string | null;
  version_number?: string | null;
};

const statuses: TemplateVersionStatus[] = ["draft", "published", "archived"];

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

const versionSelect =
  "id, template_id, version_number, changelog, package_snapshot, status, created_by, published_at, created_at, updated_at";

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
  return isRecord(value) ? (sanitizeValue(value) as Record<string, unknown>) : {};
}

function parseStatus(value: unknown): TemplateVersionStatus {
  const cleaned = text(value, 40);
  return statuses.includes(cleaned as TemplateVersionStatus) ? (cleaned as TemplateVersionStatus) : "draft";
}

function parseRecord(row: unknown): TemplateVersionRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateVersionRow;
  const id = text(value.id, 120);
  const templateId = text(value.template_id, 120);
  const versionNumber = text(value.version_number, 40);

  if (!id || !templateId || !versionNumber) return null;

  return {
    changelog: text(value.changelog, 4000) || null,
    createdAt: text(value.created_at, 80) || null,
    createdBy: text(value.created_by, 120) || null,
    id,
    packageSnapshot: safeRecord(value.package_snapshot),
    publishedAt: text(value.published_at, 80) || null,
    status: parseStatus(value.status),
    templateId,
    updatedAt: text(value.updated_at, 80) || null,
    versionNumber
  };
}

function compareVersionNumbers(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.localeCompare(right);
}

function sortVersions(versions: TemplateVersionRecord[]) {
  return [...versions].sort((left, right) => compareVersionNumbers(right.versionNumber, left.versionNumber));
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template versions.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template versions.");
  }

  return admin;
}

function versionSeedStatus(template: TemplateRegistryRecord): TemplateVersionStatus {
  if (template.status === "active") return "published";
  if (template.status === "archived") return "archived";
  return "draft";
}

async function seedMissingTemplateVersions(templates: TemplateRegistryRecord[]) {
  const admin = requireAdminClient();
  const { data, error } = await admin.from("template_versions" as never).select("template_id, version_number");

  if (error) {
    throw new Error(`Template versions could not be inspected: ${error.message}`);
  }

  const existingKeys = new Set(
    (Array.isArray(data) ? (data as unknown[]) : [])
      .map((row) => {
        const record = safeRecord(row);
        const templateId = text(record.template_id, 120);
        const versionNumber = text(record.version_number, 40);
        return templateId && versionNumber ? `${templateId}:${versionNumber}` : "";
      })
      .filter(Boolean)
  );

  const missing = templates
    .map((template) => {
      const versionNumber = text(template.version, 40) || "1";
      const key = `${template.id}:${versionNumber}`;

      if (existingKeys.has(key)) {
        return null;
      }

      const status = versionSeedStatus(template);

      return {
        changelog: "Initial registry version seeded from template_registry.",
        package_snapshot: template.packageSummary,
        published_at: status === "published" ? new Date().toISOString() : null,
        status,
        template_id: template.id,
        version_number: versionNumber
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!missing.length) return;

  const { error: insertError } = await admin.from("template_versions" as never).insert(missing as never);

  if (insertError) {
    throw new Error(`Template versions could not be seeded: ${insertError.message}`);
  }
}

async function ensureTemplateVersionsSeeded() {
  await requireSuperAdmin();
  const templates = await listTemplates();
  await seedMissingTemplateVersions(templates);
}

export async function listAllTemplateVersions(): Promise<TemplateVersionRecord[]> {
  await ensureTemplateVersionsSeeded();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_versions" as never)
    .select(versionSelect)
    .order("created_at" as never, { ascending: false });

  if (error) {
    throw new Error(`Template versions could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseRecord(row))
    .filter((version): version is TemplateVersionRecord => Boolean(version));
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersionRecord[]> {
  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return [];

  const versions = await listAllTemplateVersions();
  return sortVersions(versions.filter((version) => version.templateId === cleanedTemplateId));
}

export async function getLatestTemplateVersion(templateId: string): Promise<TemplateVersionRecord | null> {
  const versions = await listTemplateVersions(templateId);
  return versions[0] ?? null;
}

export async function getPublishedTemplateVersion(templateId: string): Promise<TemplateVersionRecord | null> {
  const versions = await listTemplateVersions(templateId).then((items) =>
    items.filter((version) => version.status === "published")
  );

  return versions[0] ?? null;
}

export async function createTemplateVersionDraft(
  templateId: string,
  input: CreateTemplateVersionDraftInput
): Promise<TemplateVersionRecord> {
  const access = await requireSuperAdmin();
  await ensureTemplateVersionsSeeded();

  const cleanedTemplateId = text(templateId, 120);
  const versionNumber = text(input.versionNumber, 40);

  if (!cleanedTemplateId || !versionNumber) {
    throw new Error("Template id and version number are required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_versions" as never)
    .insert({
      changelog: text(input.changelog, 4000) || null,
      created_by: text(input.createdBy ?? access.user.id, 120) || null,
      package_snapshot: safeRecord(input.packageSnapshot),
      status: "draft",
      template_id: cleanedTemplateId,
      version_number: versionNumber
    } as never)
    .select(versionSelect)
    .single();

  if (error) {
    throw new Error(`Template version draft could not be created: ${error.message}`);
  }

  const parsed = parseRecord(data);

  if (!parsed) {
    throw new Error("Template version draft could not be parsed.");
  }

  return parsed;
}

export async function archiveTemplateVersion(versionId: string): Promise<TemplateVersionRecord> {
  await requireSuperAdmin();

  const cleanedVersionId = text(versionId, 120);

  if (!cleanedVersionId) {
    throw new Error("Version id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_versions" as never)
    .update({
      status: "archived"
    } as never)
    .eq("id" as never, cleanedVersionId as never)
    .select(versionSelect)
    .single();

  if (error) {
    throw new Error(`Template version could not be archived: ${error.message}`);
  }

  const parsed = parseRecord(data);

  if (!parsed) {
    throw new Error("Archived template version could not be parsed.");
  }

  return parsed;
}

export async function getTemplateVersionById(versionId: string): Promise<TemplateVersionRecord | null> {
  const cleanedVersionId = text(versionId, 120);

  if (!cleanedVersionId) return null;

  const versions = await listAllTemplateVersions();
  return versions.find((version) => version.id === cleanedVersionId) ?? null;
}

export async function getTemplateVersionStats(): Promise<TemplateVersionStats> {
  const versions = await listAllTemplateVersions();
  const publishedTemplateIds = new Set(
    versions.filter((version) => version.status === "published").map((version) => version.templateId)
  );

  return {
    archivedVersions: versions.filter((version) => version.status === "archived").length,
    draftVersions: versions.filter((version) => version.status === "draft").length,
    publishedVersions: versions.filter((version) => version.status === "published").length,
    templatesWithPublishedVersion: publishedTemplateIds.size,
    totalVersions: versions.length
  };
}
