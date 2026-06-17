import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  markTemplateDraft,
  validateTemplateStatusTransition
} from "@/src/lib/templates/template-activation";
import {
  ensureTemplateRegistry,
  listTemplates,
  type TemplateRegistryRecord,
  type TemplateRegistryVisibility
} from "@/src/lib/templates/template-registry";
import { getLatestTemplateVersion, listTemplateVersions } from "@/src/lib/templates/template-versions";

export type TemplateArchiveRecord = {
  archivedAt: string | null;
  category: string | null;
  id: string;
  latestVersionNumber: string | null;
  name: string;
  previousVisibility: TemplateRegistryVisibility | null;
  registryId: string;
  templateKey: string;
  updatedAt: string | null;
  visibility: TemplateRegistryVisibility;
};

export type TemplateArchiveValidation = {
  canArchive: boolean;
  currentStatus: string | null;
  currentVisibility: TemplateRegistryVisibility | null;
  reasons: string[];
};

export type TemplateArchiveImpactSummary = {
  canArchive: boolean;
  currentStatus: string | null;
  currentVisibility: TemplateRegistryVisibility | null;
  installedStoreCount: number;
  latestVersionNumber: string | null;
  preservesHistory: boolean;
  reasons: string[];
  versionCount: number;
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

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template archive runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template archive runtime.");
  }

  return admin;
}

async function getRegistryTemplate(templateId: string): Promise<TemplateRegistryRecord | null> {
  await ensureTemplateRegistry();

  const cleanedTemplateId = text(templateId, 120);

  if (!cleanedTemplateId) return null;

  const templates = await listTemplates();
  return templates.find((template) => template.id === cleanedTemplateId) ?? null;
}

function readPreviousVisibility(template: TemplateRegistryRecord): TemplateRegistryVisibility | null {
  const metadata = safeRecord(template.metadata);
  const archivedVisibility = text(metadata.archivePreviousVisibility, 40);

  if (
    archivedVisibility === "owner" ||
    archivedVisibility === "reseller" ||
    archivedVisibility === "marketplace" ||
    archivedVisibility === "internal"
  ) {
    return archivedVisibility;
  }

  return template.visibility;
}

function readArchivedAt(template: TemplateRegistryRecord): string | null {
  const metadata = safeRecord(template.metadata);
  return text(metadata.archivedAt, 80) || template.updatedAt || null;
}

function toArchiveRecord(template: TemplateRegistryRecord, latestVersionNumber: string | null): TemplateArchiveRecord {
  return {
    archivedAt: readArchivedAt(template),
    category: template.category,
    id: template.templateKey,
    latestVersionNumber,
    name: template.name,
    previousVisibility: readPreviousVisibility(template),
    registryId: template.id,
    templateKey: template.templateKey,
    updatedAt: template.updatedAt,
    visibility: template.visibility
  };
}

export async function validateTemplateCanBeArchived(templateId: string): Promise<TemplateArchiveValidation> {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    return {
      canArchive: false,
      currentStatus: null,
      currentVisibility: null,
      reasons: ["Template registry record was not found."]
    };
  }

  if (template.status === "archived") {
    return {
      canArchive: true,
      currentStatus: template.status,
      currentVisibility: template.visibility,
      reasons: ["Template is already archived."]
    };
  }

  if (!validateTemplateStatusTransition(template.status, "archived")) {
    return {
      canArchive: false,
      currentStatus: template.status,
      currentVisibility: template.visibility,
      reasons: [`Invalid archive transition from status "${template.status}".`]
    };
  }

  return {
    canArchive: true,
    currentStatus: template.status,
    currentVisibility: template.visibility,
    reasons: []
  };
}

export async function getArchiveImpactSummary(
  templateId: string,
  installedStoreCount = 0
): Promise<TemplateArchiveImpactSummary> {
  await requireSuperAdmin();

  const validation = await validateTemplateCanBeArchived(templateId);
  const template = await getRegistryTemplate(templateId);
  const latestVersion = template ? await getLatestTemplateVersion(template.id) : null;
  const versions = template ? await listTemplateVersions(template.id) : [];

  return {
    canArchive: validation.canArchive,
    currentStatus: validation.currentStatus,
    currentVisibility: validation.currentVisibility,
    installedStoreCount,
    latestVersionNumber: latestVersion?.versionNumber ?? null,
    preservesHistory: true,
    reasons: validation.reasons,
    versionCount: versions.length
  };
}

export async function archiveTemplateSafely(templateId: string) {
  await requireSuperAdmin();

  const validation = await validateTemplateCanBeArchived(templateId);

  if (!validation.canArchive) {
    throw new Error(validation.reasons[0] ?? "Template cannot be archived.");
  }

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  if (template.status === "archived") {
    return {
      archivedAt: readArchivedAt(template),
      previousStatus: template.status,
      previousVisibility: readPreviousVisibility(template),
      status: "archived" as const
    };
  }

  const metadata = {
    ...safeRecord(template.metadata),
    archivedAt: new Date().toISOString(),
    archivePreviousVisibility: template.visibility
  };

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_registry" as never)
    .update({
      metadata,
      status: "archived"
    } as never)
    .eq("id" as never, template.id as never)
    .select("status, metadata, updated_at")
    .single();

  if (error) {
    throw new Error(`Template could not be archived safely: ${error.message}`);
  }

  const row = data as { metadata?: unknown; updated_at?: string | null };
  const archivedAt = text(safeRecord(row.metadata).archivedAt, 80) || text(row.updated_at, 80) || null;

  return {
    archivedAt,
    previousStatus: validation.currentStatus,
    previousVisibility: validation.currentVisibility,
    status: "archived" as const
  };
}

export async function restoreArchivedTemplateToDraft(templateId: string) {
  await requireSuperAdmin();

  const template = await getRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  if (template.status !== "archived") {
    throw new Error("Only archived templates can be restored to draft.");
  }

  const result = await markTemplateDraft(templateId);

  return {
    previousStatus: result.previousStatus,
    restoredAt: new Date().toISOString(),
    status: result.status
  };
}

export async function listArchivedTemplates(): Promise<TemplateArchiveRecord[]> {
  await requireSuperAdmin();

  const templates = await listTemplates();
  const archived = templates.filter((template) => template.status === "archived");

  const records = await Promise.all(
    archived.map(async (template) => {
      const latestVersion = await getLatestTemplateVersion(template.id);
      return toArchiveRecord(template, latestVersion?.versionNumber ?? null);
    })
  );

  return records.sort((left, right) => text(right.archivedAt).localeCompare(text(left.archivedAt)));
}
