import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { installTemplatePackageForTemplate } from "@/lib/storefront/template-package-installer";
import { getTemplatePackageForTemplate } from "@/lib/storefront/template-packages";
import { getStoreTemplateAssignment } from "@/src/lib/templates/store-template-assignment";
import {
  createStoreThemeIsolationSnapshot,
  validateStoreThemeIsolation,
  verifyNoCrossStoreTemplateMutation
} from "@/src/lib/templates/store-theme-isolation";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import {
  listAllTemplateVersions,
  type TemplateVersionRecord
} from "@/src/lib/templates/template-versions";

export type TemplateUpdateStatus = "cancelled" | "completed" | "failed" | "prepared" | "updating";
export type TemplateUpdateMode = "super_admin_manual";

export type TemplateUpdateConflict = {
  note: string;
  resource: string;
};

export type TemplateUpdateValidation = {
  assignmentId: string | null;
  canUpdate: boolean;
  fromVersionId: string | null;
  fromVersionNumber: string | null;
  issues: string[];
  storeName: string | null;
  storeTemplateId: string | null;
  templateName: string | null;
  templateRegistryId: string | null;
  toVersionId: string | null;
  toVersionNumber: string | null;
};

export type TemplateUpdateJobRecord = {
  assignmentId: string | null;
  completedAt: string | null;
  conflicts: TemplateUpdateConflict[];
  createdAt: string | null;
  errorMessage: string | null;
  failedAt: string | null;
  fromVersionId: string | null;
  id: string;
  startedAt: string | null;
  status: TemplateUpdateStatus;
  storeId: string;
  templateId: string;
  toVersionId: string;
  updateMode: TemplateUpdateMode;
  updateSummary: Record<string, unknown>;
  updatedAt: string | null;
};

export type TemplateUpdateJobFilters = {
  limit?: number;
  status?: TemplateUpdateStatus | TemplateUpdateStatus[];
  storeId?: string;
  templateId?: string;
};

type TemplateUpdateJobRow = {
  assignment_id?: string | null;
  completed_at?: string | null;
  conflicts?: unknown;
  created_at?: string | null;
  error_message?: string | null;
  failed_at?: string | null;
  from_version_id?: string | null;
  id?: string | null;
  started_at?: string | null;
  status?: string | null;
  store_id?: string | null;
  template_id?: string | null;
  to_version_id?: string | null;
  update_mode?: string | null;
  update_summary?: unknown;
  updated_at?: string | null;
};

const jobSelect =
  "id, store_id, template_id, from_version_id, to_version_id, assignment_id, status, update_mode, started_at, completed_at, failed_at, error_message, update_summary, conflicts, created_at, updated_at";

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

function parseConflicts(value: unknown): TemplateUpdateConflict[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const resource = coerceText(entry.resource ?? entry.step, 120);
      const note = coerceText(entry.note ?? entry.message, 2000);

      if (!resource || !note) return null;

      return { note, resource };
    })
    .filter((conflict): conflict is TemplateUpdateConflict => Boolean(conflict));
}

function parseStatus(value: unknown): TemplateUpdateStatus {
  const cleaned = text(value, 40);
  if (cleaned === "updating") return "updating";
  if (cleaned === "completed") return "completed";
  if (cleaned === "failed") return "failed";
  if (cleaned === "cancelled") return "cancelled";
  return "prepared";
}

function parseJob(row: unknown): TemplateUpdateJobRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateUpdateJobRow;
  const id = coerceText(value.id, 120);
  const storeId = coerceText(value.store_id, 120);
  const templateId = coerceText(value.template_id, 120);
  const toVersionId = coerceText(value.to_version_id, 120);

  if (!id || !storeId || !templateId || !toVersionId) return null;

  return {
    assignmentId: coerceText(value.assignment_id, 120) || null,
    completedAt: coerceText(value.completed_at, 80) || null,
    conflicts: parseConflicts(value.conflicts),
    createdAt: coerceText(value.created_at, 80) || null,
    errorMessage: coerceText(value.error_message, 2000) || null,
    failedAt: coerceText(value.failed_at, 80) || null,
    fromVersionId: coerceText(value.from_version_id, 120) || null,
    id,
    startedAt: coerceText(value.started_at, 80) || null,
    status: parseStatus(value.status),
    storeId,
    templateId,
    toVersionId,
    updateMode: "super_admin_manual",
    updateSummary: safeRecord(value.update_summary),
    updatedAt: coerceText(value.updated_at, 80) || null
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

function isVersionNewer(target: TemplateVersionRecord, current: TemplateVersionRecord | null) {
  if (!current) return true;
  if (target.id === current.id) return false;
  return compareVersionNumbers(target.versionNumber, current.versionNumber) > 0;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can run template update runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template update runtime.");
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

function storeTemplateIdFromRegistry(template: TemplateRegistryRecord) {
  const fromMetadata = coerceText(template.metadata.storeTemplateId, 120);
  return fromMetadata || coerceText(template.templateKey, 120);
}

async function loadStore(storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data: rawData, error } = await admin
    .from("stores" as never)
    .select("id, name, store_name, user_id, workspace_id, template_id")
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  const data = rawData as unknown;

  if (error || !isRecord(data)) return null;

  const userId = coerceText(data.user_id, 120);
  const workspaceId = coerceText(data.workspace_id, 120);

  if (!userId || !workspaceId) return null;

  return {
    id: coerceText(data.id, 120),
    name: coerceText(data.store_name, 120) || coerceText(data.name, 120) || "Store",
    templateId: coerceText(data.template_id, 120) || null,
    userId,
    workspaceId
  };
}

async function getVersionById(versionId: string) {
  const cleaned = coerceText(versionId, 120);

  if (!cleaned) return null;

  const versions = await listAllTemplateVersions();
  return versions.find((version) => version.id === cleaned) ?? null;
}

async function recordUpdateAudit(
  eventType:
    | "template_update_completed"
    | "template_update_failed"
    | "template_update_prepared"
    | "template_update_started",
  payload: {
    jobId: string;
    metadata: Record<string, unknown>;
    storeId: string;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: payload.jobId,
    entity_type: "admin_template_update",
    event_status: eventType === "template_update_failed" ? "error" : "info",
    event_type: eventType,
    metadata: {
      ...payload.metadata,
      note: "Super Admin manual template update runtime. Single-store only. No bulk, automatic, or destructive overwrite.",
      source: "super_admin_template_update_runtime"
    },
    store_id: payload.storeId,
    user_id: payload.userId,
    workspace_id: null
  } as never);
}

export async function validateTemplateUpdate(
  storeId: string,
  templateId: string,
  toVersionId: string
): Promise<TemplateUpdateValidation> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const template = await findRegistryTemplate(templateId);
  const store = await loadStore(storeId);
  const assignment = await getStoreTemplateAssignment(storeId);
  const toVersion = await getVersionById(toVersionId);

  if (!store) {
    issues.push("Store was not found or is missing required owner/workspace metadata.");
  }

  if (!template) {
    return {
      assignmentId: assignment?.id ?? null,
      canUpdate: false,
      fromVersionId: assignment?.templateVersionId ?? null,
      fromVersionNumber: null,
      issues: ["Template registry record was not found."],
      storeName: store?.name ?? null,
      storeTemplateId: null,
      templateName: null,
      templateRegistryId: null,
      toVersionId: toVersion?.id ?? null,
      toVersionNumber: toVersion?.versionNumber ?? null
    };
  }

  if (template.status === "archived") {
    issues.push("Archived templates cannot be updated.");
  }

  if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  if (!assignment) {
    issues.push("An active store template assignment is required before updating.");
  } else if (assignment.templateId !== template.id) {
    issues.push("Store assignment references a different template than requested.");
  } else if (!["active", "assigned"].includes(assignment.assignmentStatus)) {
    issues.push(`Assignment must be active or assigned (current: ${assignment.assignmentStatus}).`);
  }

  if (!toVersion) {
    issues.push("Target template version was not found.");
  } else if (toVersion.templateId !== template.id) {
    issues.push("Target version does not belong to the selected template.");
  } else if (toVersion.status !== "published") {
    issues.push(`Target version must be published (current: ${toVersion.status}).`);
  }

  const fromVersion = assignment?.templateVersionId
    ? await getVersionById(assignment.templateVersionId)
    : null;

  if (toVersion && fromVersion && toVersion.id === fromVersion.id) {
    issues.push("Target version must be different from the current assigned version.");
  }

  if (toVersion && !isVersionNewer(toVersion, fromVersion)) {
    issues.push("Target version must be newer than the current assigned version.");
  }

  const storeTemplateId = storeTemplateIdFromRegistry(template);
  const storefrontPackage = getTemplatePackageForTemplate(storeTemplateId);

  if (!storefrontPackage) {
    issues.push("No compatible storefront template package registry entry was found for this template.");
  }

  if (issues.length === 0) {
    const isolation = await validateStoreThemeIsolation(storeId, template.id);
    const mutation = await verifyNoCrossStoreTemplateMutation(storeId, template.id, {
      assignmentId: assignment?.id ?? null
    });

    for (const issue of [...isolation.issues, ...mutation.issues].filter(
      (entry) => entry.severity === "error"
    )) {
      issues.push(issue.message);
    }
  }

  return {
    assignmentId: assignment?.id ?? null,
    canUpdate: issues.length === 0,
    fromVersionId: fromVersion?.id ?? assignment?.templateVersionId ?? null,
    fromVersionNumber: fromVersion?.versionNumber ?? null,
    issues,
    storeName: store?.name ?? null,
    storeTemplateId,
    templateName: template.name,
    templateRegistryId: template.id,
    toVersionId: toVersion?.id ?? null,
    toVersionNumber: toVersion?.versionNumber ?? null
  };
}

export async function prepareTemplateUpdate(storeId: string, templateId: string, toVersionId: string) {
  const access = await requireSuperAdmin();
  const validation = await validateTemplateUpdate(storeId, templateId, toVersionId);

  if (!validation.canUpdate || !validation.templateRegistryId || !validation.toVersionId) {
    throw new Error(validation.issues.join(" ") || "Template update validation failed.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_update_jobs" as never)
    .insert({
      assignment_id: validation.assignmentId,
      from_version_id: validation.fromVersionId,
      status: "prepared",
      store_id: coerceText(storeId, 120),
      template_id: validation.templateRegistryId,
      to_version_id: validation.toVersionId,
      update_mode: "super_admin_manual",
      update_summary: {
        from_version_number: validation.fromVersionNumber,
        prepared_by: access.user.id,
        store_name: validation.storeName,
        template_name: validation.templateName,
        to_version_number: validation.toVersionNumber
      }
    } as never)
    .select(jobSelect)
    .single();

  if (error) {
    throw new Error(`Template update job could not be prepared: ${error.message}`);
  }

  const parsed = parseJob(data);

  if (!parsed) {
    throw new Error("Prepared template update job could not be parsed.");
  }

  await recordUpdateAudit("template_update_prepared", {
    jobId: parsed.id,
    metadata: {
      assignment_id: parsed.assignmentId,
      from_version_id: parsed.fromVersionId,
      from_version_number: validation.fromVersionNumber,
      status: parsed.status,
      store_id: parsed.storeId,
      store_name: validation.storeName,
      template_id: parsed.templateId,
      template_name: validation.templateName,
      to_version_id: parsed.toVersionId,
      to_version_number: validation.toVersionNumber
    },
    storeId: parsed.storeId,
    userId: access.user.id
  });

  return {
    job: parsed,
    validation
  };
}

export async function applyTemplateUpdate(updateJobId: string) {
  const access = await requireSuperAdmin();
  const admin = requireAdminClient();
  const cleanedJobId = coerceText(updateJobId, 120);

  if (!cleanedJobId) {
    throw new Error("Update job id is required.");
  }

  const { data: rawJob, error: loadError } = await admin
    .from("template_update_jobs" as never)
    .select(jobSelect)
    .eq("id" as never, cleanedJobId as never)
    .maybeSingle();

  const job = parseJob(rawJob);

  if (loadError || !job) {
    throw new Error("Template update job was not found.");
  }

  if (job.status !== "prepared") {
    throw new Error(`Template update job must be prepared before applying (current: ${job.status}).`);
  }

  const validation = await validateTemplateUpdate(job.storeId, job.templateId, job.toVersionId);

  if (!validation.canUpdate || !validation.storeTemplateId) {
    throw new Error(validation.issues.join(" ") || "Template update validation failed before apply.");
  }

  const store = await loadStore(job.storeId);

  if (!store) {
    throw new Error("Store could not be loaded for template update.");
  }

  const startedAt = new Date().toISOString();
  const { error: startError } = await admin
    .from("template_update_jobs" as never)
    .update({
      started_at: startedAt,
      status: "updating"
    } as never)
    .eq("id" as never, job.id as never);

  if (startError) {
    throw new Error(`Template update could not be started: ${startError.message}`);
  }

  await recordUpdateAudit("template_update_started", {
    jobId: job.id,
    metadata: {
      assignment_id: job.assignmentId,
      from_version_id: job.fromVersionId,
      status: "updating",
      store_id: job.storeId,
      store_name: validation.storeName,
      template_id: job.templateId,
      template_name: validation.templateName,
      to_version_id: job.toVersionId
    },
    storeId: job.storeId,
    userId: access.user.id
  });

  const conflicts: TemplateUpdateConflict[] = [];
  const updateSummary: Record<string, unknown> = {
    fromVersionId: job.fromVersionId,
    fromVersionNumber: validation.fromVersionNumber,
    storeTemplateId: validation.storeTemplateId,
    toVersionId: job.toVersionId,
    toVersionNumber: validation.toVersionNumber
  };

  try {
    if (job.assignmentId) {
      const { data: assignmentData, error: assignmentError } = await admin
        .from("store_template_assignments" as never)
        .select("id, metadata")
        .eq("id" as never, job.assignmentId as never)
        .maybeSingle();

      const assignmentRow = assignmentData as unknown;

      if (assignmentError || !isRecord(assignmentRow)) {
        conflicts.push({
          note: assignmentError?.message ?? "Assignment row could not be loaded for version update.",
          resource: "assignment-version-reference"
        });
      } else {
        const existingMetadata = safeRecord(assignmentRow.metadata);
        const { error: versionUpdateError } = await admin
          .from("store_template_assignments" as never)
          .update({
            metadata: {
              ...existingMetadata,
              previous_template_version_id: job.fromVersionId,
              template_update_job_id: job.id,
              updated_to_version_id: job.toVersionId,
              updated_to_version_number: validation.toVersionNumber
            },
            template_version_id: job.toVersionId
          } as never)
          .eq("id" as never, job.assignmentId as never);

        if (versionUpdateError) {
          conflicts.push({
            note: versionUpdateError.message,
            resource: "assignment-version-reference"
          });
        } else {
          updateSummary.assignmentVersionUpdated = true;
        }
      }
    } else {
      conflicts.push({
        note: "No assignment id linked to update job; assignment version reference was skipped.",
        resource: "assignment-version-reference"
      });
    }

    const packageResult = await installTemplatePackageForTemplate({
      storeId: store.id,
      supabase: admin,
      templateId: validation.storeTemplateId,
      userId: store.userId,
      workspaceId: store.workspaceId
    });

    updateSummary.packageId = packageResult.packageId;
    updateSummary.packageInstallStatus = packageResult.status;
    updateSummary.steps = packageResult.steps;

    for (const step of packageResult.steps.filter((entry) => entry.status === "skipped")) {
      conflicts.push({
        note: step.error ?? "Existing store data prevented template-controlled changes.",
        resource: step.name
      });
    }

    if (packageResult.status === "failed") {
      const failedSteps = packageResult.steps
        .filter((step) => step.status === "failed")
        .map((step) => step.error ?? step.name)
        .join(" · ");
      throw new Error(failedSteps || "Template package update install steps failed.");
    }

    try {
      await createStoreThemeIsolationSnapshot(store.id, job.templateId, null);
      updateSummary.isolationSnapshotCreated = true;
    } catch (snapshotError) {
      conflicts.push({
        note:
          snapshotError instanceof Error
            ? snapshotError.message
            : "Isolation snapshot could not be created after update.",
        resource: "store-theme-isolation-snapshot"
      });
    }

    updateSummary.conflictCount = conflicts.length;
    updateSummary.note =
      conflicts.length > 0
        ? "Update completed with skipped conflicts. Customer products, pages, custom themes, orders, payments, and domains were not deleted."
        : "Update completed safely. Only template-controlled metadata/resources were touched where supported.";

    const completedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("template_update_jobs" as never)
      .update({
        completed_at: completedAt,
        conflicts,
        status: "completed",
        update_summary: updateSummary
      } as never)
      .eq("id" as never, job.id as never)
      .select(jobSelect)
      .single();

    if (error) {
      throw new Error(`Template update completion could not be recorded: ${error.message}`);
    }

    const parsed = parseJob(data);

    if (!parsed) {
      throw new Error("Completed template update job could not be parsed.");
    }

    await recordUpdateAudit("template_update_completed", {
      jobId: parsed.id,
      metadata: {
        assignment_id: parsed.assignmentId,
        conflict_count: conflicts.length,
        package_install_status: packageResult.status,
        status: parsed.status,
        store_id: parsed.storeId,
        store_name: validation.storeName,
        template_id: parsed.templateId,
        template_name: validation.templateName,
        to_version_id: parsed.toVersionId
      },
      storeId: parsed.storeId,
      userId: access.user.id
    });

    return {
      job: parsed,
      packageResult,
      validation
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template update failed.";
    const failedAt = new Date().toISOString();

    await admin
      .from("template_update_jobs" as never)
      .update({
        conflicts,
        error_message: message,
        failed_at: failedAt,
        status: "failed",
        update_summary: {
          ...updateSummary,
          conflictCount: conflicts.length,
          failed: true
        }
      } as never)
      .eq("id" as never, job.id as never);

    await recordUpdateAudit("template_update_failed", {
      jobId: job.id,
      metadata: {
        assignment_id: job.assignmentId,
        error_message: message,
        status: "failed",
        store_id: job.storeId,
        store_name: validation.storeName,
        template_id: job.templateId,
        to_version_id: job.toVersionId
      },
      storeId: job.storeId,
      userId: access.user.id
    });

    throw new Error(message);
  }
}

export async function getTemplateUpdateStatus(updateJobId: string) {
  await requireSuperAdmin();

  const id = coerceText(updateJobId, 120);

  if (!id) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_update_jobs" as never)
    .select(jobSelect)
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template update status could not be loaded: ${error.message}`);
  }

  return parseJob(data);
}

export async function listTemplateUpdateJobs(
  filters: TemplateUpdateJobFilters = {}
): Promise<TemplateUpdateJobRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  let query = admin.from("template_update_jobs" as never).select(jobSelect);

  const storeId = coerceText(filters.storeId, 120);

  if (storeId) {
    query = query.eq("store_id" as never, storeId as never);
  }

  const templateId = coerceText(filters.templateId, 120);

  if (templateId) {
    query = query.eq("template_id" as never, templateId as never);
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("status" as never, statuses as never);
  }

  const { data, error } = await query
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Template update jobs could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseJob(row))
    .filter((job): job is TemplateUpdateJobRecord => Boolean(job));
}

export async function checkTemplateUpdateAvailability(
  storeId: string,
  templateId: string,
  toVersionId: string
) {
  return validateTemplateUpdate(storeId, templateId, toVersionId);
}
