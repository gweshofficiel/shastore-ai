import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import {
  getPublishedTemplateVersion,
  getTemplateVersionById
} from "@/src/lib/templates/template-versions";

export type ResellerTemplateAccessStatus = "active" | "revoked" | "suspended";
export type ResellerTemplateAccessType = "assigned" | "inherited" | "marketplace";

export type ResellerTemplateAccessRecord = {
  accessStatus: ResellerTemplateAccessStatus;
  accessType: ResellerTemplateAccessType;
  assignedAt: string | null;
  assignedBy: string | null;
  createdAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  resellerId: string;
  templateId: string;
  templateVersionId: string | null;
  updatedAt: string | null;
};

export type ResellerTemplateAccessFilters = {
  accessStatus?: ResellerTemplateAccessStatus | ResellerTemplateAccessStatus[];
  accessType?: ResellerTemplateAccessType | ResellerTemplateAccessType[];
  limit?: number;
  resellerId?: string;
  templateId?: string;
};

export type AssignTemplateToResellerInput = {
  accessType?: ResellerTemplateAccessType;
  metadata?: Record<string, unknown>;
  templateVersionId?: string | null;
};

export type ResellerTemplateEligibility = {
  canAssign: boolean;
  issues: string[];
  publishedVersionId: string | null;
  publishedVersionNumber: string | null;
  resellerId: string;
  templateId: string;
  templateName: string | null;
};

export type ResellerTemplateStats = {
  activeAssignments: number;
  assignedTemplates: number;
  inheritedAssignments: number;
  marketplaceAssignments: number;
  revokedAssignments: number;
  suspendedAssignments: number;
  totalAssignments: number;
};

type ResellerTemplateAccessRow = {
  access_status?: string | null;
  access_type?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  created_at?: string | null;
  id?: string | null;
  metadata?: unknown;
  reseller_id?: string | null;
  template_id?: string | null;
  template_version_id?: string | null;
  updated_at?: string | null;
};

const accessSelect =
  "id, reseller_id, template_id, template_version_id, access_status, access_type, assigned_by, assigned_at, metadata, created_at, updated_at";

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

function coerceText(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return text(value, maxLength);
  return text(String(value), maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseAccessStatus(value: unknown): ResellerTemplateAccessStatus {
  const cleaned = text(value, 40);
  if (cleaned === "suspended") return "suspended";
  if (cleaned === "revoked") return "revoked";
  return "active";
}

function parseAccessType(value: unknown): ResellerTemplateAccessType {
  const cleaned = text(value, 40);
  if (cleaned === "inherited") return "inherited";
  if (cleaned === "marketplace") return "marketplace";
  return "assigned";
}

function parseAccess(row: unknown): ResellerTemplateAccessRecord | null {
  if (!isRecord(row)) return null;

  const value = row as ResellerTemplateAccessRow;
  const id = coerceText(value.id, 120);
  const resellerId = coerceText(value.reseller_id, 120);
  const templateId = coerceText(value.template_id, 120);

  if (!id || !resellerId || !templateId) return null;

  return {
    accessStatus: parseAccessStatus(value.access_status),
    accessType: parseAccessType(value.access_type),
    assignedAt: coerceText(value.assigned_at, 80) || null,
    assignedBy: coerceText(value.assigned_by, 120) || null,
    createdAt: coerceText(value.created_at, 80) || null,
    id,
    metadata: safeRecord(value.metadata),
    resellerId,
    templateId,
    templateVersionId: coerceText(value.template_version_id, 120) || null,
    updatedAt: coerceText(value.updated_at, 80) || null
  };
}

function templateAllowsResellerAccess(template: TemplateRegistryRecord) {
  if (template.visibility === "reseller" || template.visibility === "marketplace") return true;

  const metadata = safeRecord(template.metadata);
  return metadata.resellerAllowed === true || metadata.allowReseller === true;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access reseller template runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for reseller template runtime.");
  }

  return admin;
}

async function findRegistryTemplate(templateId: string) {
  return (await listTemplates()).find((template) => template.id === text(templateId, 120)) ?? null;
}

async function ensureResellerExists(resellerId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_profiles" as never)
    .select("id, display_name, slug")
    .eq("id" as never, text(resellerId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Reseller profile could not be loaded: ${error.message}`);
  }

  const row = data as unknown;

  if (!isRecord(row) || !text(row.id, 120)) {
    throw new Error("Reseller profile was not found.");
  }

  return {
    displayName: text(row.display_name, 240) || text(row.slug, 120) || "Reseller",
    id: text(row.id, 120)
  };
}

async function findActiveAccess(resellerId: string, templateId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_template_access" as never)
    .select(accessSelect)
    .eq("reseller_id" as never, resellerId as never)
    .eq("template_id" as never, templateId as never)
    .in("access_status" as never, ["active", "suspended"] as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Reseller template access could not be inspected: ${error.message}`);
  }

  return parseAccess(data);
}

async function recordResellerTemplateAudit(
  eventType:
    | "reseller_template_assigned"
    | "reseller_template_revoked"
    | "reseller_template_suspended",
  params: {
    access: ResellerTemplateAccessRecord;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.access.id,
    entity_type: "admin_reseller_template_access",
    event_status: "info",
    event_type: eventType,
    metadata: {
      access_id: params.access.id,
      access_status: params.access.accessStatus,
      access_type: params.access.accessType,
      note: "Super Admin reseller template runtime. Catalog access only. No install, payment, or store mutation.",
      reseller_id: params.access.resellerId,
      source: "super_admin_reseller_template_runtime",
      template_id: params.access.templateId,
      template_version_id: params.access.templateVersionId,
      ...(params.metadata ?? {})
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function validateResellerTemplateEligibility(
  resellerId: string,
  templateId: string
): Promise<ResellerTemplateEligibility> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const template = await findRegistryTemplate(templateId);
  const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;

  try {
    await ensureResellerExists(resellerId);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Reseller profile was not found.");
  }

  if (!template) {
    issues.push("Template registry record was not found.");
  } else if (template.status === "archived") {
    issues.push("Archived templates cannot be assigned to resellers.");
  } else if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  } else if (!templateAllowsResellerAccess(template)) {
    issues.push(
      "Template visibility must be reseller or marketplace, or template metadata must explicitly allow reseller access."
    );
  }

  if (!publishedVersion) {
    issues.push("A published template version is required before reseller assignment.");
  }

  const existing = await findActiveAccess(text(resellerId, 120), text(templateId, 120));

  if (existing) {
    issues.push("An active or suspended reseller template assignment already exists for this reseller and template.");
  }

  return {
    canAssign: issues.length === 0,
    issues,
    publishedVersionId: publishedVersion?.id ?? null,
    publishedVersionNumber: publishedVersion?.versionNumber ?? null,
    resellerId: text(resellerId, 120),
    templateId: text(templateId, 120),
    templateName: template?.name ?? null
  };
}

export async function assignTemplateToReseller(
  resellerId: string,
  templateId: string,
  input: AssignTemplateToResellerInput = {}
) {
  const access = await requireSuperAdmin();
  const eligibility = await validateResellerTemplateEligibility(resellerId, templateId);

  if (!eligibility.canAssign) {
    throw new Error(eligibility.issues.join(" ") || "Template is not eligible for reseller assignment.");
  }

  const template = await findRegistryTemplate(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const versionId = input.templateVersionId
    ? text(input.templateVersionId, 120)
    : eligibility.publishedVersionId;

  if (versionId) {
    const version = await getTemplateVersionById(versionId);

    if (!version || version.templateId !== template.id) {
      throw new Error("Template version does not belong to the selected template.");
    }

    if (version.status !== "published") {
      throw new Error("Only published template versions can be assigned to resellers.");
    }
  }

  const reseller = await ensureResellerExists(resellerId);
  const admin = requireAdminClient();
  const assignedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("reseller_template_access" as never)
    .insert({
      access_status: "active",
      access_type: input.accessType ? parseAccessType(input.accessType) : "assigned",
      assigned_at: assignedAt,
      assigned_by: access.user.id,
      metadata: {
        ...safeRecord(input.metadata),
        assigned_note: "Super Admin manual reseller template assignment. No automatic install.",
        published_version_number: eligibility.publishedVersionNumber,
        reseller_display_name: reseller.displayName
      },
      reseller_id: reseller.id,
      template_id: template.id,
      template_version_id: versionId
    } as never)
    .select(accessSelect)
    .single();

  if (error) {
    throw new Error(`Reseller template access could not be assigned: ${error.message}`);
  }

  const record = parseAccess(data);

  if (!record) {
    throw new Error("Assigned reseller template access could not be parsed.");
  }

  await recordResellerTemplateAudit("reseller_template_assigned", {
    access: record,
    metadata: {
      assigned_at: assignedAt,
      template_name: template.name
    },
    userId: access.user.id
  });

  return { access: record, eligibility };
}

export async function suspendTemplateForReseller(accessId: string) {
  const adminAccess = await requireSuperAdmin();
  const existing = await getResellerTemplateAccess(accessId);

  if (!existing) {
    throw new Error("Reseller template access record was not found.");
  }

  if (existing.accessStatus === "revoked") {
    throw new Error("Revoked reseller template access cannot be suspended.");
  }

  if (existing.accessStatus === "suspended") {
    return { access: existing };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_template_access" as never)
    .update({
      access_status: "suspended",
      metadata: {
        ...existing.metadata,
        suspended_at: new Date().toISOString(),
        suspended_by: adminAccess.user.id
      }
    } as never)
    .eq("id" as never, existing.id as never)
    .select(accessSelect)
    .single();

  if (error) {
    throw new Error(`Reseller template access could not be suspended: ${error.message}`);
  }

  const access = parseAccess(data);

  if (!access) {
    throw new Error("Suspended reseller template access could not be parsed.");
  }

  await recordResellerTemplateAudit("reseller_template_suspended", {
    access,
    userId: adminAccess.user.id
  });

  return { access };
}

export async function revokeTemplateFromReseller(accessId: string) {
  const adminAccess = await requireSuperAdmin();
  const existing = await getResellerTemplateAccess(accessId);

  if (!existing) {
    throw new Error("Reseller template access record was not found.");
  }

  if (existing.accessStatus === "revoked") {
    return { access: existing };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_template_access" as never)
    .update({
      access_status: "revoked",
      metadata: {
        ...existing.metadata,
        note: "Revoked access removes future reseller catalog visibility only. Existing store installations are not uninstalled.",
        revoked_at: new Date().toISOString(),
        revoked_by: adminAccess.user.id
      }
    } as never)
    .eq("id" as never, existing.id as never)
    .select(accessSelect)
    .single();

  if (error) {
    throw new Error(`Reseller template access could not be revoked: ${error.message}`);
  }

  const access = parseAccess(data);

  if (!access) {
    throw new Error("Revoked reseller template access could not be parsed.");
  }

  await recordResellerTemplateAudit("reseller_template_revoked", {
    access,
    userId: adminAccess.user.id
  });

  return { access };
}

export async function listResellerTemplates(
  filters: ResellerTemplateAccessFilters = {}
): Promise<ResellerTemplateAccessRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  let query = admin.from("reseller_template_access" as never).select(accessSelect);

  if (filters.resellerId) {
    query = query.eq("reseller_id" as never, text(filters.resellerId, 120) as never);
  }

  if (filters.templateId) {
    query = query.eq("template_id" as never, text(filters.templateId, 120) as never);
  }

  if (filters.accessStatus) {
    const statuses = Array.isArray(filters.accessStatus) ? filters.accessStatus : [filters.accessStatus];
    query = query.in("access_status" as never, statuses as never);
  }

  if (filters.accessType) {
    const types = Array.isArray(filters.accessType) ? filters.accessType : [filters.accessType];
    query = query.in("access_type" as never, types as never);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const { data, error } = await query
    .order("assigned_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Reseller template access records could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseAccess(row))
    .filter((access): access is ResellerTemplateAccessRecord => Boolean(access));
}

export async function getResellerTemplateAccess(accessId: string) {
  await requireSuperAdmin();

  const cleanedId = text(accessId, 120);
  if (!cleanedId) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("reseller_template_access" as never)
    .select(accessSelect)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Reseller template access record could not be loaded: ${error.message}`);
  }

  return parseAccess(data);
}

export async function getResellerTemplateStats(): Promise<ResellerTemplateStats> {
  const records = await listResellerTemplates({ limit: 500 });

  return {
    activeAssignments: records.filter((record) => record.accessStatus === "active").length,
    assignedTemplates: new Set(records.map((record) => record.templateId)).size,
    inheritedAssignments: records.filter((record) => record.accessType === "inherited").length,
    marketplaceAssignments: records.filter((record) => record.accessType === "marketplace").length,
    revokedAssignments: records.filter((record) => record.accessStatus === "revoked").length,
    suspendedAssignments: records.filter((record) => record.accessStatus === "suspended").length,
    totalAssignments: records.length
  };
}

export async function listActiveResellerCatalogTemplates(resellerId: string) {
  await requireSuperAdmin();

  return listResellerTemplates({
    accessStatus: "active",
    limit: 200,
    resellerId
  });
}
