import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import {
  getPublishedTemplateVersion,
  listAllTemplateVersions,
  type TemplateVersionRecord
} from "@/src/lib/templates/template-versions";
import {
  createStoreThemeIsolationSnapshot,
  validateStoreThemeIsolation,
  verifyNoCrossStoreTemplateMutation
} from "@/src/lib/templates/store-theme-isolation";

export type StoreAssignmentStatus = "active" | "assigned" | "failed" | "inactive" | "unassigned";
export type StoreAssignmentSource =
  | "migration"
  | "store_creation"
  | "super_admin_manual"
  | "template_install";

export type StoreTemplateAssignmentRecord = {
  assignedAt: string | null;
  assignedBy: string | null;
  assignmentSource: StoreAssignmentSource;
  assignmentStatus: StoreAssignmentStatus;
  createdAt: string | null;
  id: string;
  installId: string | null;
  metadata: Record<string, unknown>;
  storeId: string;
  templateId: string;
  templateVersionId: string | null;
  unassignedAt: string | null;
  updatedAt: string | null;
};

export type StoreTemplateAssignmentFilters = {
  assignmentStatus?: StoreAssignmentStatus | StoreAssignmentStatus[];
  limit?: number;
  storeId?: string;
  templateId?: string;
};

export type StoreTemplateAssignmentValidation = {
  canAssign: boolean;
  existingActiveAssignmentId: string | null;
  issues: string[];
  publishedVersionId: string | null;
  storeName: string | null;
  templateName: string | null;
  templateRegistryId: string | null;
  templateStatus: string | null;
  versionNumber: string | null;
};

type StoreTemplateAssignmentRow = {
  assigned_at?: string | null;
  assigned_by?: string | null;
  assignment_source?: string | null;
  assignment_status?: string | null;
  created_at?: string | null;
  id?: string | null;
  install_id?: string | null;
  metadata?: unknown;
  store_id?: string | null;
  template_id?: string | null;
  template_version_id?: string | null;
  unassigned_at?: string | null;
  updated_at?: string | null;
};

type AssignTemplateOptions = {
  assignmentSource?: StoreAssignmentSource;
  initialStatus?: StoreAssignmentStatus;
  metadata?: Record<string, unknown>;
  replaceConfirmed?: boolean;
};

const assignmentSelect =
  "id, store_id, template_id, template_version_id, install_id, assignment_status, assignment_source, assigned_by, assigned_at, unassigned_at, metadata, created_at, updated_at";

const activeConflictStatuses: StoreAssignmentStatus[] = ["active", "assigned"];

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

function parseStatus(value: unknown): StoreAssignmentStatus {
  const cleaned = text(value, 40);
  if (cleaned === "active") return "active";
  if (cleaned === "inactive") return "inactive";
  if (cleaned === "unassigned") return "unassigned";
  if (cleaned === "failed") return "failed";
  return "assigned";
}

function parseSource(value: unknown): StoreAssignmentSource {
  const cleaned = text(value, 40);
  if (cleaned === "template_install") return "template_install";
  if (cleaned === "store_creation") return "store_creation";
  if (cleaned === "migration") return "migration";
  return "super_admin_manual";
}

function parseAssignment(row: unknown): StoreTemplateAssignmentRecord | null {
  if (!isRecord(row)) return null;

  const value = row as StoreTemplateAssignmentRow;
  const id = coerceText(value.id, 120);
  const storeId = coerceText(value.store_id, 120);
  const templateId = coerceText(value.template_id, 120);

  if (!id || !storeId || !templateId) return null;

  return {
    assignedAt: coerceText(value.assigned_at, 80) || null,
    assignedBy: coerceText(value.assigned_by, 120) || null,
    assignmentSource: parseSource(value.assignment_source),
    assignmentStatus: parseStatus(value.assignment_status),
    createdAt: coerceText(value.created_at, 80) || null,
    id,
    installId: coerceText(value.install_id, 120) || null,
    metadata: safeRecord(value.metadata),
    storeId,
    templateId,
    templateVersionId: coerceText(value.template_version_id, 120) || null,
    unassignedAt: coerceText(value.unassigned_at, 80) || null,
    updatedAt: coerceText(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage store template assignments.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for store template assignments.");
  }

  return admin;
}

async function findRegistryTemplate(identifier: string): Promise<TemplateRegistryRecord | null> {
  const cleaned = coerceText(identifier, 120);

  if (!cleaned) return null;

  const templates = await listTemplates();

  return (
    templates.find(
      (template) =>
        template.id === cleaned || template.slug === cleaned || template.templateKey === cleaned
    ) ?? null
  );
}

async function loadStore(storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data: rawData, error } = await admin
    .from("stores" as never)
    .select("id, name, store_name, user_id, workspace_id")
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  const data = rawData as unknown;

  if (error || !isRecord(data)) return null;

  return {
    id: coerceText(data.id, 120),
    name: coerceText(data.store_name, 120) || coerceText(data.name, 120) || "Store",
    userId: coerceText(data.user_id, 120),
    workspaceId: coerceText(data.workspace_id, 120)
  };
}

async function getVersionById(versionId: string): Promise<TemplateVersionRecord | null> {
  const cleaned = coerceText(versionId, 120);

  if (!cleaned) return null;

  const versions = await listAllTemplateVersions();
  return versions.find((version) => version.id === cleaned) ?? null;
}

async function findActiveAssignmentForStore(storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .select(assignmentSelect)
    .eq("store_id" as never, cleanedStoreId as never)
    .in("assignment_status" as never, activeConflictStatuses as never)
    .order("assigned_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Active store template assignment could not be loaded: ${error.message}`);
  }

  return parseAssignment(data);
}

async function recordAssignmentAudit(
  eventType:
    | "template_assigned_to_store"
    | "template_assignment_marked_active"
    | "template_assignment_replaced"
    | "template_assignment_unassigned",
  payload: {
    assignmentId: string;
    metadata: Record<string, unknown>;
    storeId: string;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: payload.assignmentId,
    entity_type: "admin_template_assignment",
    event_status: eventType === "template_assignment_unassigned" ? "warning" : "info",
    event_type: eventType,
    metadata: {
      ...payload.metadata,
      note: "Store template assignment metadata only. No store content, pages, products, or themes were mutated.",
      source: "super_admin_store_template_assignment_runtime"
    },
    store_id: payload.storeId,
    user_id: payload.userId,
    workspace_id: null
  } as never);
}

export async function validateTemplateAssignment(
  storeId: string,
  templateId: string,
  versionId: string | null
): Promise<StoreTemplateAssignmentValidation> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const template = await findRegistryTemplate(templateId);
  const store = await loadStore(storeId);

  if (!store) {
    issues.push("Store was not found.");
  }

  if (!template) {
    return {
      canAssign: false,
      existingActiveAssignmentId: null,
      issues: ["Template registry record was not found."],
      publishedVersionId: null,
      storeName: store?.name ?? null,
      templateName: null,
      templateRegistryId: null,
      templateStatus: null,
      versionNumber: null
    };
  }

  if (template.status === "archived") {
    issues.push("Archived templates cannot be assigned.");
  }

  if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  let resolvedVersion: TemplateVersionRecord | null = null;

  if (versionId) {
    resolvedVersion = await getVersionById(versionId);

    if (!resolvedVersion) {
      issues.push("Template version was not found.");
    } else if (resolvedVersion.templateId !== template.id) {
      issues.push("Template version does not belong to the selected template.");
    } else if (resolvedVersion.status !== "published") {
      issues.push(`Template version must be published (current: ${resolvedVersion.status}).`);
    }
  } else {
    resolvedVersion = await getPublishedTemplateVersion(template.id);

    if (!resolvedVersion) {
      issues.push("A published template version is required.");
    }
  }

  const existingActive = store ? await findActiveAssignmentForStore(store.id) : null;

  return {
    canAssign: issues.length === 0,
    existingActiveAssignmentId: existingActive?.id ?? null,
    issues,
    publishedVersionId: resolvedVersion?.id ?? null,
    storeName: store?.name ?? null,
    templateName: template.name,
    templateRegistryId: template.id,
    templateStatus: template.status,
    versionNumber: resolvedVersion?.versionNumber ?? null
  };
}

async function deactivateAssignment(
  assignmentId: string,
  nextStatus: "inactive" | "unassigned",
  userId: string,
  metadata: Record<string, unknown>
) {
  const admin = requireAdminClient();
  const unassignedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .update({
      assignment_status: nextStatus,
      metadata: {
        ...metadata,
        deactivated_at: unassignedAt,
        deactivated_by: userId
      },
      unassigned_at: unassignedAt
    } as never)
    .eq("id" as never, assignmentId as never)
    .select(assignmentSelect)
    .single();

  if (error) {
    throw new Error(`Store template assignment could not be updated: ${error.message}`);
  }

  return parseAssignment(data);
}

export async function assignTemplateToStore(
  storeId: string,
  templateId: string,
  versionId: string | null,
  installId: string | null,
  options: AssignTemplateOptions = {}
) {
  const access = await requireSuperAdmin();
  const validation = await validateTemplateAssignment(storeId, templateId, versionId);

  if (!validation.canAssign || !validation.templateRegistryId || !validation.publishedVersionId) {
    throw new Error(validation.issues.join(" ") || "Template assignment validation failed.");
  }

  const replaceConfirmed = options.replaceConfirmed === true;
  const existingActiveAssignmentId = validation.existingActiveAssignmentId;

  if (existingActiveAssignmentId && !replaceConfirmed) {
    throw new Error(
      "Store already has an active template assignment. Confirm replacement before assigning a new template."
    );
  }

  const isolation = await validateStoreThemeIsolation(storeId, templateId);
  const mutationCheck = await verifyNoCrossStoreTemplateMutation(storeId, templateId, {
    installId
  });

  if (!isolation.canProceed || !mutationCheck.canProceed) {
    throw new Error(
      [...isolation.issues, ...mutationCheck.issues]
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join(" ") || "Store theme isolation blocked template assignment."
    );
  }

  const admin = requireAdminClient();
  const assignmentSource = options.assignmentSource ?? (installId ? "template_install" : "super_admin_manual");
  const initialStatus = options.initialStatus ?? (assignmentSource === "template_install" ? "active" : "assigned");
  const assignedAt = new Date().toISOString();
  let replacedAssignmentId: string | null = null;

  if (existingActiveAssignmentId) {
    const deactivated = await deactivateAssignment(existingActiveAssignmentId, "inactive", access.user.id, {
      replaced_by_assignment_pending: true,
      replacement_reason: assignmentSource
    });

    replacedAssignmentId = deactivated?.id ?? existingActiveAssignmentId;

    await recordAssignmentAudit("template_assignment_replaced", {
      assignmentId: existingActiveAssignmentId,
      metadata: {
        assignment_status: "inactive",
        new_template_id: validation.templateRegistryId,
        new_template_name: validation.templateName,
        new_version_id: validation.publishedVersionId,
        previous_template_id: deactivated?.templateId ?? null,
        store_id: storeId,
        store_name: validation.storeName
      },
      storeId,
      userId: access.user.id
    });
  }

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .insert({
      assigned_at: assignedAt,
      assigned_by: access.user.id,
      assignment_source: assignmentSource,
      assignment_status: initialStatus,
      install_id: coerceText(installId, 120) || null,
      metadata: {
        ...safeRecord(options.metadata),
        replaced_assignment_id: replacedAssignmentId,
        store_name: validation.storeName,
        template_name: validation.templateName,
        version_number: validation.versionNumber
      },
      store_id: coerceText(storeId, 120),
      template_id: validation.templateRegistryId,
      template_version_id: validation.publishedVersionId
    } as never)
    .select(assignmentSelect)
    .single();

  if (error) {
    throw new Error(`Store template assignment could not be created: ${error.message}`);
  }

  const parsed = parseAssignment(data);

  if (!parsed) {
    throw new Error("Store template assignment could not be parsed.");
  }

  await recordAssignmentAudit("template_assigned_to_store", {
    assignmentId: parsed.id,
    metadata: {
      assignment_source: parsed.assignmentSource,
      assignment_status: parsed.assignmentStatus,
      install_id: parsed.installId,
      replaced_assignment_id: replacedAssignmentId,
      store_id: parsed.storeId,
      store_name: validation.storeName,
      template_id: parsed.templateId,
      template_name: validation.templateName,
      template_version_id: parsed.templateVersionId,
      version_number: validation.versionNumber
    },
    storeId: parsed.storeId,
    userId: access.user.id
  });

  const verified = await verifyNoCrossStoreTemplateMutation(storeId, templateId, {
    assignmentId: parsed.id,
    installId: parsed.installId
  });

  if (!verified.canProceed) {
    throw new Error(
      verified.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join(" ") || "Template assignment failed store isolation verification."
    );
  }

  await createStoreThemeIsolationSnapshot(parsed.storeId, parsed.templateId, parsed.installId);

  return {
    assignment: parsed,
    replacedAssignmentId,
    validation
  };
}

export async function getStoreTemplateAssignment(storeId: string) {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .select(assignmentSelect)
    .eq("store_id" as never, cleanedStoreId as never)
    .in("assignment_status" as never, ["active", "assigned"] as never)
    .order("assigned_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Store template assignment could not be loaded: ${error.message}`);
  }

  return parseAssignment(data);
}

export async function listStoreTemplateAssignments(
  filters: StoreTemplateAssignmentFilters = {}
): Promise<StoreTemplateAssignmentRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  let query = admin.from("store_template_assignments" as never).select(assignmentSelect);

  const storeId = coerceText(filters.storeId, 120);

  if (storeId) {
    query = query.eq("store_id" as never, storeId as never);
  }

  const templateId = coerceText(filters.templateId, 120);

  if (templateId) {
    query = query.eq("template_id" as never, templateId as never);
  }

  if (filters.assignmentStatus) {
    const statuses = Array.isArray(filters.assignmentStatus)
      ? filters.assignmentStatus
      : [filters.assignmentStatus];
    query = query.in("assignment_status" as never, statuses as never);
  }

  const { data, error } = await query
    .order("assigned_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Store template assignments could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseAssignment(row))
    .filter((assignment): assignment is StoreTemplateAssignmentRecord => Boolean(assignment));
}

export async function markTemplateAssignmentActive(assignmentId: string) {
  const access = await requireSuperAdmin();
  const admin = requireAdminClient();
  const cleanedId = coerceText(assignmentId, 120);

  if (!cleanedId) {
    throw new Error("Assignment id is required.");
  }

  const { data: existingData, error: existingError } = await admin
    .from("store_template_assignments" as never)
    .select(assignmentSelect)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Store template assignment could not be loaded: ${existingError.message}`);
  }

  const existing = parseAssignment(existingData);

  if (!existing) {
    throw new Error("Store template assignment was not found.");
  }

  if (existing.assignmentStatus === "unassigned" || existing.assignmentStatus === "failed") {
    throw new Error("Unassigned or failed assignments cannot be marked active.");
  }

  const activePeer = await findActiveAssignmentForStore(existing.storeId);

  if (activePeer && activePeer.id !== existing.id) {
    await deactivateAssignment(activePeer.id, "inactive", access.user.id, {
      deactivated_for_assignment_id: existing.id,
      reason: "mark_assignment_active"
    });

    await recordAssignmentAudit("template_assignment_replaced", {
      assignmentId: activePeer.id,
      metadata: {
        assignment_status: "inactive",
        promoted_assignment_id: existing.id,
        store_id: existing.storeId
      },
      storeId: existing.storeId,
      userId: access.user.id
    });
  }

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .update({
      assignment_status: "active",
      metadata: {
        ...existing.metadata,
        marked_active_at: new Date().toISOString(),
        marked_active_by: access.user.id
      },
      unassigned_at: null
    } as never)
    .eq("id" as never, cleanedId as never)
    .select(assignmentSelect)
    .single();

  if (error) {
    throw new Error(`Store template assignment could not be marked active: ${error.message}`);
  }

  const parsed = parseAssignment(data);

  if (!parsed) {
    throw new Error("Updated store template assignment could not be parsed.");
  }

  await recordAssignmentAudit("template_assignment_marked_active", {
    assignmentId: parsed.id,
    metadata: {
      assignment_source: parsed.assignmentSource,
      assignment_status: parsed.assignmentStatus,
      install_id: parsed.installId,
      store_id: parsed.storeId,
      template_id: parsed.templateId,
      template_version_id: parsed.templateVersionId
    },
    storeId: parsed.storeId,
    userId: access.user.id
  });

  return parsed;
}

export async function unassignTemplateFromStore(assignmentId: string) {
  const access = await requireSuperAdmin();
  const admin = requireAdminClient();
  const cleanedId = coerceText(assignmentId, 120);

  if (!cleanedId) {
    throw new Error("Assignment id is required.");
  }

  const { data: existingData, error: existingError } = await admin
    .from("store_template_assignments" as never)
    .select(assignmentSelect)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Store template assignment could not be loaded: ${existingError.message}`);
  }

  const existing = parseAssignment(existingData);

  if (!existing) {
    throw new Error("Store template assignment was not found.");
  }

  if (existing.assignmentStatus === "unassigned") {
    return existing;
  }

  const deactivated = await deactivateAssignment(cleanedId, "unassigned", access.user.id, {
    ...existing.metadata,
    unassigned_by: access.user.id
  });

  if (!deactivated) {
    throw new Error("Store template assignment could not be unassigned.");
  }

  await recordAssignmentAudit("template_assignment_unassigned", {
    assignmentId: deactivated.id,
    metadata: {
      assignment_source: deactivated.assignmentSource,
      assignment_status: deactivated.assignmentStatus,
      install_id: deactivated.installId,
      previous_status: existing.assignmentStatus,
      store_id: deactivated.storeId,
      template_id: deactivated.templateId,
      template_version_id: deactivated.templateVersionId
    },
    storeId: deactivated.storeId,
    userId: access.user.id
  });

  return deactivated;
}
