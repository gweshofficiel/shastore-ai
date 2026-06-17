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

export type TemplateRollbackStatus = "cancelled" | "completed" | "failed" | "prepared" | "rolling_back";
export type TemplateRollbackMode = "super_admin_manual";

export type TemplateRollbackConflict = {
  note: string;
  resource: string;
};

export type TemplateRollbackValidation = {
  assignmentId: string | null;
  canRollback: boolean;
  fromVersionId: string | null;
  fromVersionNumber: string | null;
  issues: string[];
  storeName: string | null;
  storeTemplateId: string | null;
  templateName: string | null;
  templateRegistryId: string | null;
  toVersionId: string | null;
  toVersionNumber: string | null;
  updateJobId: string | null;
};

export type TemplateRollbackJobRecord = {
  assignmentId: string | null;
  completedAt: string | null;
  conflicts: TemplateRollbackConflict[];
  createdAt: string | null;
  errorMessage: string | null;
  failedAt: string | null;
  fromVersionId: string | null;
  id: string;
  rollbackMode: TemplateRollbackMode;
  rollbackSummary: Record<string, unknown>;
  startedAt: string | null;
  status: TemplateRollbackStatus;
  storeId: string;
  templateId: string;
  toVersionId: string;
  updateJobId: string | null;
  updatedAt: string | null;
};

export type TemplateRollbackJobFilters = {
  limit?: number;
  status?: TemplateRollbackStatus | TemplateRollbackStatus[];
  storeId?: string;
  templateId?: string;
};

type TemplateRollbackJobRow = {
  assignment_id?: string | null;
  completed_at?: string | null;
  conflicts?: unknown;
  created_at?: string | null;
  error_message?: string | null;
  failed_at?: string | null;
  from_version_id?: string | null;
  id?: string | null;
  rollback_mode?: string | null;
  rollback_summary?: unknown;
  started_at?: string | null;
  status?: string | null;
  store_id?: string | null;
  template_id?: string | null;
  to_version_id?: string | null;
  update_job_id?: string | null;
  updated_at?: string | null;
};

const jobSelect =
  "id, store_id, template_id, from_version_id, to_version_id, assignment_id, update_job_id, status, rollback_mode, started_at, completed_at, failed_at, error_message, rollback_summary, conflicts, created_at, updated_at";

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

function parseConflicts(value: unknown): TemplateRollbackConflict[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const resource = coerceText(entry.resource ?? entry.step, 120);
      const note = coerceText(entry.note ?? entry.message, 2000);

      if (!resource || !note) return null;

      return { note, resource };
    })
    .filter((conflict): conflict is TemplateRollbackConflict => Boolean(conflict));
}

function parseStatus(value: unknown): TemplateRollbackStatus {
  const cleaned = text(value, 40);
  if (cleaned === "rolling_back") return "rolling_back";
  if (cleaned === "completed") return "completed";
  if (cleaned === "failed") return "failed";
  if (cleaned === "cancelled") return "cancelled";
  return "prepared";
}

function parseJob(row: unknown): TemplateRollbackJobRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateRollbackJobRow;
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
    rollbackMode: "super_admin_manual",
    rollbackSummary: safeRecord(value.rollback_summary),
    startedAt: coerceText(value.started_at, 80) || null,
    status: parseStatus(value.status),
    storeId,
    templateId,
    toVersionId,
    updateJobId: coerceText(value.update_job_id, 120) || null,
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

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can run template rollback runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template rollback runtime.");
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

async function collectKnownVersionIds(storeId: string, templateId: string) {
  const admin = requireAdminClient();
  const known = new Set<string>();

  const { data: assignments } = await admin
    .from("store_template_assignments" as never)
    .select("template_version_id, metadata")
    .eq("store_id" as never, storeId as never)
    .eq("template_id" as never, templateId as never)
    .limit(100);

  if (Array.isArray(assignments)) {
    for (const row of assignments) {
      const record = row as unknown;

      if (!isRecord(record)) continue;

      const versionId = coerceText(record.template_version_id, 120);

      if (versionId) known.add(versionId);

      const metadata = safeRecord(record.metadata);

      for (const key of [
        "previous_template_version_id",
        "updated_to_version_id",
        "replaced_assignment_id"
      ]) {
        const value = coerceText(metadata[key], 120);

        if (value) known.add(value);
      }
    }
  }

  const { data: installs } = await admin
    .from("template_installs" as never)
    .select("template_version_id")
    .eq("store_id" as never, storeId as never)
    .eq("template_id" as never, templateId as never)
    .eq("status" as never, "completed" as never)
    .limit(100);

  if (Array.isArray(installs)) {
    for (const row of installs) {
      const record = row as unknown;

      if (!isRecord(record)) continue;

      const versionId = coerceText(record.template_version_id, 120);

      if (versionId) known.add(versionId);
    }
  }

  const { data: updates } = await admin
    .from("template_update_jobs" as never)
    .select("from_version_id, to_version_id")
    .eq("store_id" as never, storeId as never)
    .eq("template_id" as never, templateId as never)
    .eq("status" as never, "completed" as never)
    .limit(100);

  if (Array.isArray(updates)) {
    for (const row of updates) {
      const record = row as unknown;

      if (!isRecord(record)) continue;

      const fromVersionId = coerceText(record.from_version_id, 120);
      const toVersionId = coerceText(record.to_version_id, 120);

      if (fromVersionId) known.add(fromVersionId);
      if (toVersionId) known.add(toVersionId);
    }
  }

  return known;
}

async function findLinkedUpdateJob(storeId: string, templateId: string, currentVersionId: string | null) {
  const admin = requireAdminClient();

  if (!currentVersionId) return null;

  const { data: rawData, error } = await admin
    .from("template_update_jobs" as never)
    .select("id")
    .eq("store_id" as never, storeId as never)
    .eq("template_id" as never, templateId as never)
    .eq("to_version_id" as never, currentVersionId as never)
    .eq("status" as never, "completed" as never)
    .order("completed_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  const data = rawData as unknown;

  if (error || !isRecord(data)) return null;

  return coerceText(data.id, 120) || null;
}

function isSafeRollbackTarget(
  toVersion: TemplateVersionRecord,
  currentVersion: TemplateVersionRecord | null,
  knownVersionIds: Set<string>
) {
  if (knownVersionIds.has(toVersion.id)) return true;

  if (toVersion.status !== "published") return false;

  if (!currentVersion) return true;

  return compareVersionNumbers(toVersion.versionNumber, currentVersion.versionNumber) <= 0;
}

async function recordRollbackAudit(
  eventType:
    | "template_rollback_completed"
    | "template_rollback_failed"
    | "template_rollback_prepared"
    | "template_rollback_started",
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
    entity_type: "admin_template_rollback",
    event_status: eventType === "template_rollback_failed" ? "error" : "info",
    event_type: eventType,
    metadata: {
      ...payload.metadata,
      note: "Super Admin manual template rollback runtime. Single-store only. No bulk, automatic, or destructive overwrite.",
      source: "super_admin_template_rollback_runtime"
    },
    store_id: payload.storeId,
    user_id: payload.userId,
    workspace_id: null
  } as never);
}

export async function validateTemplateRollback(
  storeId: string,
  templateId: string,
  toVersionId: string
): Promise<TemplateRollbackValidation> {
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
      canRollback: false,
      fromVersionId: assignment?.templateVersionId ?? null,
      fromVersionNumber: null,
      issues: ["Template registry record was not found."],
      storeName: store?.name ?? null,
      storeTemplateId: null,
      templateName: null,
      templateRegistryId: null,
      toVersionId: toVersion?.id ?? null,
      toVersionNumber: toVersion?.versionNumber ?? null,
      updateJobId: null
    };
  }

  if (template.status === "archived") {
    issues.push("Archived templates cannot be rolled back.");
  }

  if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  if (!assignment) {
    issues.push("An active store template assignment is required before rollback.");
  } else if (assignment.templateId !== template.id) {
    issues.push("Store assignment references a different template than requested.");
  } else if (!["active", "assigned"].includes(assignment.assignmentStatus)) {
    issues.push(`Assignment must be active or assigned (current: ${assignment.assignmentStatus}).`);
  }

  if (!toVersion) {
    issues.push("Target rollback version was not found.");
  } else if (toVersion.templateId !== template.id) {
    issues.push("Target version does not belong to the selected template.");
  } else if (toVersion.status !== "published") {
    issues.push(`Target version must be published (current: ${toVersion.status}).`);
  }

  const fromVersion = assignment?.templateVersionId
    ? await getVersionById(assignment.templateVersionId)
    : null;

  if (toVersion && fromVersion && toVersion.id === fromVersion.id) {
    issues.push("Target rollback version must be different from the current assigned version.");
  }

  const knownVersionIds = await collectKnownVersionIds(storeId, template.id);

  if (toVersion && !isSafeRollbackTarget(toVersion, fromVersion, knownVersionIds)) {
    issues.push(
      "Target version must be a previously assigned/installed version or a safe published rollback version."
    );
  }

  const storeTemplateId = storeTemplateIdFromRegistry(template);
  const storefrontPackage = getTemplatePackageForTemplate(storeTemplateId);

  if (!storefrontPackage) {
    issues.push("No compatible storefront template package registry entry was found for this template.");
  }

  const updateJobId = await findLinkedUpdateJob(
    storeId,
    template.id,
    fromVersion?.id ?? assignment?.templateVersionId ?? null
  );

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
    canRollback: issues.length === 0,
    fromVersionId: fromVersion?.id ?? assignment?.templateVersionId ?? null,
    fromVersionNumber: fromVersion?.versionNumber ?? null,
    issues,
    storeName: store?.name ?? null,
    storeTemplateId,
    templateName: template.name,
    templateRegistryId: template.id,
    toVersionId: toVersion?.id ?? null,
    toVersionNumber: toVersion?.versionNumber ?? null,
    updateJobId
  };
}

export async function prepareTemplateRollback(storeId: string, templateId: string, toVersionId: string) {
  const access = await requireSuperAdmin();
  const validation = await validateTemplateRollback(storeId, templateId, toVersionId);

  if (!validation.canRollback || !validation.templateRegistryId || !validation.toVersionId) {
    throw new Error(validation.issues.join(" ") || "Template rollback validation failed.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_rollback_jobs" as never)
    .insert({
      assignment_id: validation.assignmentId,
      from_version_id: validation.fromVersionId,
      rollback_mode: "super_admin_manual",
      status: "prepared",
      store_id: coerceText(storeId, 120),
      template_id: validation.templateRegistryId,
      to_version_id: validation.toVersionId,
      update_job_id: validation.updateJobId,
      rollback_summary: {
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
    throw new Error(`Template rollback job could not be prepared: ${error.message}`);
  }

  const parsed = parseJob(data);

  if (!parsed) {
    throw new Error("Prepared template rollback job could not be parsed.");
  }

  await recordRollbackAudit("template_rollback_prepared", {
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
      to_version_number: validation.toVersionNumber,
      update_job_id: parsed.updateJobId
    },
    storeId: parsed.storeId,
    userId: access.user.id
  });

  return {
    job: parsed,
    validation
  };
}

export async function applyTemplateRollback(rollbackJobId: string) {
  const access = await requireSuperAdmin();
  const admin = requireAdminClient();
  const cleanedJobId = coerceText(rollbackJobId, 120);

  if (!cleanedJobId) {
    throw new Error("Rollback job id is required.");
  }

  const { data: rawJob, error: loadError } = await admin
    .from("template_rollback_jobs" as never)
    .select(jobSelect)
    .eq("id" as never, cleanedJobId as never)
    .maybeSingle();

  const job = parseJob(rawJob);

  if (loadError || !job) {
    throw new Error("Template rollback job was not found.");
  }

  if (job.status !== "prepared") {
    throw new Error(`Template rollback job must be prepared before applying (current: ${job.status}).`);
  }

  const validation = await validateTemplateRollback(job.storeId, job.templateId, job.toVersionId);

  if (!validation.canRollback || !validation.storeTemplateId) {
    throw new Error(validation.issues.join(" ") || "Template rollback validation failed before apply.");
  }

  const store = await loadStore(job.storeId);

  if (!store) {
    throw new Error("Store could not be loaded for template rollback.");
  }

  const startedAt = new Date().toISOString();
  const { error: startError } = await admin
    .from("template_rollback_jobs" as never)
    .update({
      started_at: startedAt,
      status: "rolling_back"
    } as never)
    .eq("id" as never, job.id as never);

  if (startError) {
    throw new Error(`Template rollback could not be started: ${startError.message}`);
  }

  await recordRollbackAudit("template_rollback_started", {
    jobId: job.id,
    metadata: {
      assignment_id: job.assignmentId,
      from_version_id: job.fromVersionId,
      status: "rolling_back",
      store_id: job.storeId,
      store_name: validation.storeName,
      template_id: job.templateId,
      template_name: validation.templateName,
      to_version_id: job.toVersionId,
      update_job_id: job.updateJobId
    },
    storeId: job.storeId,
    userId: access.user.id
  });

  const conflicts: TemplateRollbackConflict[] = [];
  const rollbackSummary: Record<string, unknown> = {
    fromVersionId: job.fromVersionId,
    fromVersionNumber: validation.fromVersionNumber,
    storeTemplateId: validation.storeTemplateId,
    toVersionId: job.toVersionId,
    toVersionNumber: validation.toVersionNumber,
    updateJobId: job.updateJobId
  };

  try {
    if (job.assignmentId) {
      const { data: assignmentData, error: assignmentError } = await admin
        .from("store_template_assignments" as never)
        .select("id, metadata, template_version_id")
        .eq("id" as never, job.assignmentId as never)
        .maybeSingle();

      const assignmentRow = assignmentData as unknown;

      if (assignmentError || !isRecord(assignmentRow)) {
        conflicts.push({
          note: assignmentError?.message ?? "Assignment row could not be loaded for rollback.",
          resource: "assignment-version-reference"
        });
      } else {
        const existingMetadata = safeRecord(assignmentRow.metadata);
        const previousVersionId =
          coerceText(assignmentRow.template_version_id, 120) || job.fromVersionId;

        const { error: versionUpdateError } = await admin
          .from("store_template_assignments" as never)
          .update({
            metadata: {
              ...existingMetadata,
              previous_template_version_id: previousVersionId,
              rolled_back_from_version_id: previousVersionId,
              template_rollback_job_id: job.id,
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
          rollbackSummary.assignmentVersionUpdated = true;
          rollbackSummary.previousAssignmentVersionId = previousVersionId;
        }
      }
    } else {
      conflicts.push({
        note: "No assignment id linked to rollback job; assignment version reference was skipped.",
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

    rollbackSummary.packageId = packageResult.packageId;
    rollbackSummary.packageInstallStatus = packageResult.status;
    rollbackSummary.steps = packageResult.steps;

    for (const step of packageResult.steps.filter((entry) => entry.status === "skipped")) {
      conflicts.push({
        note: step.error ?? "Existing store data prevented template-controlled rollback changes.",
        resource: step.name
      });
    }

    if (packageResult.status === "failed") {
      const failedSteps = packageResult.steps
        .filter((step) => step.status === "failed")
        .map((step) => step.error ?? step.name)
        .join(" · ");
      throw new Error(failedSteps || "Template package rollback install steps failed.");
    }

    try {
      await createStoreThemeIsolationSnapshot(store.id, job.templateId, null);
      rollbackSummary.isolationSnapshotCreated = true;
    } catch (snapshotError) {
      conflicts.push({
        note:
          snapshotError instanceof Error
            ? snapshotError.message
            : "Isolation snapshot could not be created after rollback.",
        resource: "store-theme-isolation-snapshot"
      });
    }

    rollbackSummary.conflictCount = conflicts.length;
    rollbackSummary.note =
      conflicts.length > 0
        ? "Rollback completed with skipped conflicts. Customer products, pages, custom themes, orders, payments, and domains were not deleted."
        : "Rollback completed safely. Assignment version restored and template-controlled resources updated where supported.";

    const completedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("template_rollback_jobs" as never)
      .update({
        completed_at: completedAt,
        conflicts,
        rollback_summary: rollbackSummary,
        status: "completed"
      } as never)
      .eq("id" as never, job.id as never)
      .select(jobSelect)
      .single();

    if (error) {
      throw new Error(`Template rollback completion could not be recorded: ${error.message}`);
    }

    const parsed = parseJob(data);

    if (!parsed) {
      throw new Error("Completed template rollback job could not be parsed.");
    }

    await recordRollbackAudit("template_rollback_completed", {
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
        to_version_id: parsed.toVersionId,
        update_job_id: parsed.updateJobId
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
    const message = error instanceof Error ? error.message : "Template rollback failed.";
    const failedAt = new Date().toISOString();

    await admin
      .from("template_rollback_jobs" as never)
      .update({
        conflicts,
        error_message: message,
        failed_at: failedAt,
        rollback_summary: {
          ...rollbackSummary,
          conflictCount: conflicts.length,
          failed: true
        },
        status: "failed"
      } as never)
      .eq("id" as never, job.id as never);

    await recordRollbackAudit("template_rollback_failed", {
      jobId: job.id,
      metadata: {
        assignment_id: job.assignmentId,
        error_message: message,
        status: "failed",
        store_id: job.storeId,
        store_name: validation.storeName,
        template_id: job.templateId,
        to_version_id: job.toVersionId,
        update_job_id: job.updateJobId
      },
      storeId: job.storeId,
      userId: access.user.id
    });

    throw new Error(message);
  }
}

export async function getTemplateRollbackStatus(rollbackJobId: string) {
  await requireSuperAdmin();

  const id = coerceText(rollbackJobId, 120);

  if (!id) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_rollback_jobs" as never)
    .select(jobSelect)
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template rollback status could not be loaded: ${error.message}`);
  }

  return parseJob(data);
}

export async function listTemplateRollbackJobs(
  filters: TemplateRollbackJobFilters = {}
): Promise<TemplateRollbackJobRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  let query = admin.from("template_rollback_jobs" as never).select(jobSelect);

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
    throw new Error(`Template rollback jobs could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseJob(row))
    .filter((job): job is TemplateRollbackJobRecord => Boolean(job));
}
