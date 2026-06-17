import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { installTemplatePackageForTemplate } from "@/lib/storefront/template-package-installer";
import { getTemplatePackageForTemplate } from "@/lib/storefront/template-packages";
import {
  getTemplatePackage,
  validateTemplatePackage
} from "@/src/lib/templates/template-package-runtime";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";
import { assignTemplateToStore } from "@/src/lib/templates/store-template-assignment";
import {
  createStoreThemeIsolationSnapshot,
  validateStoreThemeIsolation
} from "@/src/lib/templates/store-theme-isolation";

export type TemplateInstallStatus = "cancelled" | "completed" | "failed" | "installing" | "prepared";
export type TemplateInstallMode = "super_admin_manual";

export type TemplateInstallValidation = {
  canInstall: boolean;
  issues: string[];
  packageReadiness: string | null;
  publishedVersionId: string | null;
  storeName: string | null;
  storeTemplateId: string | null;
  templateName: string | null;
  templateRegistryId: string | null;
  templateStatus: string | null;
};

export type TemplateInstallRecord = {
  completedAt: string | null;
  createdAt: string | null;
  errorMessage: string | null;
  failedAt: string | null;
  id: string;
  installMode: TemplateInstallMode;
  installedSummary: Record<string, unknown>;
  startedAt: string | null;
  status: TemplateInstallStatus;
  storeId: string;
  templateId: string;
  templateVersionId: string | null;
  updatedAt: string | null;
};

type TemplateInstallRow = {
  completed_at?: string | null;
  created_at?: string | null;
  error_message?: string | null;
  failed_at?: string | null;
  id?: string | null;
  install_mode?: string | null;
  installed_summary?: unknown;
  started_at?: string | null;
  status?: string | null;
  store_id?: string | null;
  template_id?: string | null;
  template_version_id?: string | null;
  updated_at?: string | null;
};

const installSelect =
  "id, template_id, template_version_id, store_id, status, install_mode, started_at, completed_at, failed_at, error_message, installed_summary, created_at, updated_at";

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

function textOr(value: unknown, fallback: string, maxLength = 500) {
  const cleaned = coerceText(value, maxLength);
  return cleaned || text(fallback, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseStatus(value: unknown): TemplateInstallStatus {
  const cleaned = text(value, 40);
  if (cleaned === "installing") return "installing";
  if (cleaned === "completed") return "completed";
  if (cleaned === "failed") return "failed";
  if (cleaned === "cancelled") return "cancelled";
  return "prepared";
}

function parseInstall(row: unknown): TemplateInstallRecord | null {
  if (!isRecord(row)) return null;

  const value = row as TemplateInstallRow;
  const id = text(value.id, 120);
  const templateId = text(value.template_id, 120);
  const storeId = text(value.store_id, 120);

  if (!id || !templateId || !storeId) return null;

  return {
    completedAt: text(value.completed_at, 80) || null,
    createdAt: text(value.created_at, 80) || null,
    errorMessage: text(value.error_message, 2000) || null,
    failedAt: text(value.failed_at, 80) || null,
    id,
    installMode: "super_admin_manual",
    installedSummary: safeRecord(value.installed_summary),
    startedAt: text(value.started_at, 80) || null,
    status: parseStatus(value.status),
    storeId,
    templateId,
    templateVersionId: text(value.template_version_id, 120) || null,
    updatedAt: text(value.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can run template install runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template install runtime.");
  }

  return admin;
}

async function findRegistryTemplate(identifier: string): Promise<TemplateRegistryRecord | null> {
  const cleaned = text(identifier, 120);

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
    .select("id, name, store_name, user_id, workspace_id, template_id, store_data")
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  const data = rawData as unknown;

  if (error || !isRecord(data)) return null;

  const userId = coerceText(data.user_id, 120);
  const workspaceId = coerceText(data.workspace_id, 120);

  if (!userId || !workspaceId) return null;

  return {
    id: coerceText(data.id, 120),
    name: textOr(data.store_name, coerceText(data.name, 120) || "Store"),
    storeData: safeRecord(data.store_data),
    templateId: coerceText(data.template_id, 120) || null,
    userId,
    workspaceId
  };
}

async function recordInstallAudit(
  eventType:
    | "template_install_completed"
    | "template_install_failed"
    | "template_install_prepared"
    | "template_install_started",
  payload: {
    installId: string;
    metadata: Record<string, unknown>;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: payload.installId,
    entity_type: "admin_template_install",
    event_status: eventType === "template_install_failed" ? "error" : "info",
    event_type: eventType,
    metadata: {
      ...payload.metadata,
      note: "Super Admin manual template install runtime. Single-store only. No bulk or marketplace install.",
      source: "super_admin_template_install_runtime"
    },
    store_id: text(payload.metadata.store_id, 120) || null,
    user_id: payload.userId,
    workspace_id: null
  } as never);
}

export async function validateTemplateInstall(
  templateId: string,
  storeId: string
): Promise<TemplateInstallValidation> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const template = await findRegistryTemplate(templateId);
  const store = await loadStore(storeId);

  if (!template) {
    return {
      canInstall: false,
      issues: ["Template registry record was not found."],
      packageReadiness: null,
      publishedVersionId: null,
      storeName: store?.name ?? null,
      storeTemplateId: null,
      templateName: null,
      templateRegistryId: null,
      templateStatus: null
    };
  }

  if (!store) {
    issues.push("Store was not found or is missing required owner/workspace metadata.");
  }

  if (template.status === "archived") {
    issues.push("Archived templates cannot be installed.");
  }

  if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  const publishedVersion = await getPublishedTemplateVersion(template.id);

  if (!publishedVersion) {
    issues.push("A published template version is required.");
  }

  const packageValidation = await validateTemplatePackage(template.id);
  const pkg = await getTemplatePackage(template.id);

  if (!packageValidation.ready) {
    issues.push(...packageValidation.issues);
  }

  if (pkg && pkg.readinessStatus !== "ready") {
    issues.push(`Package readiness must be ready (current: ${pkg.readinessStatus}).`);
  }

  const storeTemplateId = storeTemplateIdFromRegistry(template);
  const storefrontPackage = getTemplatePackageForTemplate(storeTemplateId);

  if (!storefrontPackage) {
    issues.push("No compatible storefront template package registry entry was found for this template.");
  }

  return {
    canInstall: issues.length === 0,
    issues,
    packageReadiness: pkg?.readinessStatus ?? null,
    publishedVersionId: publishedVersion?.id ?? null,
    storeName: store?.name ?? null,
    storeTemplateId,
    templateName: template.name,
    templateRegistryId: template.id,
    templateStatus: template.status
  };
}

export async function prepareTemplateInstall(templateId: string, storeId: string) {
  const access = await requireSuperAdmin();
  const validation = await validateTemplateInstall(templateId, storeId);

  if (!validation.canInstall || !validation.templateRegistryId || !validation.publishedVersionId) {
    throw new Error(validation.issues.join(" ") || "Template install validation failed.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_installs" as never)
    .insert({
      install_mode: "super_admin_manual",
      status: "prepared",
      store_id: text(storeId, 120),
      template_id: validation.templateRegistryId,
      template_version_id: validation.publishedVersionId
    } as never)
    .select(installSelect)
    .single();

  if (error) {
    throw new Error(`Template install could not be prepared: ${error.message}`);
  }

  const parsed = parseInstall(data);

  if (!parsed) {
    throw new Error("Prepared template install could not be parsed.");
  }

  await recordInstallAudit("template_install_prepared", {
    installId: parsed.id,
    metadata: {
      install_mode: parsed.installMode,
      package_readiness: validation.packageReadiness,
      status: parsed.status,
      store_id: parsed.storeId,
      store_name: validation.storeName,
      store_template_id: validation.storeTemplateId,
      template_id: parsed.templateId,
      template_name: validation.templateName,
      template_version_id: parsed.templateVersionId
    },
    userId: access.user.id
  });

  return {
    install: parsed,
    validation
  };
}

export async function installTemplateToStore(templateId: string, storeId: string) {
  const access = await requireSuperAdmin();
  const isolation = await validateStoreThemeIsolation(storeId, templateId);

  if (!isolation.canProceed) {
    throw new Error(
      isolation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join(" ") || "Store theme isolation validation failed."
    );
  }

  const prepared = await prepareTemplateInstall(templateId, storeId);
  const validation = prepared.validation;
  const install = prepared.install;
  const admin = requireAdminClient();
  const store = await loadStore(storeId);
  const storeTemplateId = validation.storeTemplateId;

  if (!store || !storeTemplateId) {
    throw new Error("Store or template mapping is invalid for install.");
  }

  const startedAt = new Date().toISOString();
  const { error: startError } = await admin
    .from("template_installs" as never)
    .update({
      started_at: startedAt,
      status: "installing"
    } as never)
    .eq("id" as never, install.id as never);

  if (startError) {
    throw new Error(`Template install could not be started: ${startError.message}`);
  }

  await recordInstallAudit("template_install_started", {
    installId: install.id,
    metadata: {
      install_mode: install.installMode,
      status: "installing",
      store_id: store.id,
      store_name: store.name,
      store_template_id: storeTemplateId,
      template_id: install.templateId,
      template_name: validation.templateName,
      template_version_id: install.templateVersionId
    },
    userId: access.user.id
  });

  const conflicts: Array<{ note: string; step: string }> = [];

  try {
    const packageResult = await installTemplatePackageForTemplate({
      storeId: store.id,
      supabase: admin,
      templateId: storeTemplateId,
      userId: store.userId,
      workspaceId: store.workspaceId
    });

    if (packageResult.steps.some((step) => step.status === "skipped")) {
      for (const step of packageResult.steps.filter((step) => step.status === "skipped")) {
        conflicts.push({
          note: step.error ?? "Existing store data or duplicate package prevented changes.",
          step: step.name
        });
      }
    }

    if (packageResult.status === "failed") {
      const failedSteps = packageResult.steps
        .filter((step) => step.status === "failed")
        .map((step) => step.error ?? step.name)
        .join(" · ");
      throw new Error(failedSteps || "Template package install failed.");
    }

    const installedSummary: Record<string, unknown> = {
      conflicts,
      packageId: packageResult.packageId,
      packageInstallStatus: packageResult.status,
      registryTemplateId: install.templateId,
      steps: packageResult.steps,
      storeTemplateId
    };

    if (store.templateId !== storeTemplateId) {
      const { error: templateRefError } = await admin
        .from("stores" as never)
        .update({ template_id: storeTemplateId, updated_at: new Date().toISOString() } as never)
        .eq("id" as never, store.id as never);

      if (templateRefError) {
        conflicts.push({
          note: templateRefError.message,
          step: "template-reference-update"
        });
      } else {
        installedSummary.templateReferenceUpdated = true;
      }
    }

    const completedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("template_installs" as never)
      .update({
        completed_at: completedAt,
        installed_summary: installedSummary,
        status: "completed"
      } as never)
      .eq("id" as never, install.id as never)
      .select(installSelect)
      .single();

    if (error) {
      throw new Error(`Template install completion could not be recorded: ${error.message}`);
    }

    const parsed = parseInstall(data);

    if (!parsed) {
      throw new Error("Completed template install could not be parsed.");
    }

    await recordInstallAudit("template_install_completed", {
      installId: parsed.id,
      metadata: {
        conflicts: conflicts.length,
        install_mode: parsed.installMode,
        package_install_status: packageResult.status,
        status: parsed.status,
        store_id: parsed.storeId,
        store_name: store.name,
        store_template_id: storeTemplateId,
        template_id: parsed.templateId,
        template_name: validation.templateName
      },
      userId: access.user.id
    });

    try {
      await assignTemplateToStore(
        store.id,
        install.templateId,
        install.templateVersionId,
        install.id,
        {
          assignmentSource: "template_install",
          initialStatus: "active",
          metadata: {
            install_mode: install.installMode,
            package_install_status: packageResult.status
          },
          replaceConfirmed: true
        }
      );
    } catch (assignmentError) {
      conflicts.push({
        note:
          assignmentError instanceof Error
            ? assignmentError.message
            : "Template assignment record could not be created after install.",
        step: "store-template-assignment"
      });

      await admin
        .from("template_installs" as never)
        .update({
          installed_summary: {
            ...installedSummary,
            assignmentWarning: conflicts[conflicts.length - 1]?.note ?? "Assignment failed."
          }
        } as never)
        .eq("id" as never, install.id as never);
    }

    try {
      await createStoreThemeIsolationSnapshot(store.id, install.templateId, install.id);
    } catch (snapshotError) {
      conflicts.push({
        note:
          snapshotError instanceof Error
            ? snapshotError.message
            : "Store theme isolation snapshot could not be created after install.",
        step: "store-theme-isolation-snapshot"
      });

      await admin
        .from("template_installs" as never)
        .update({
          installed_summary: {
            ...installedSummary,
            isolationSnapshotWarning: conflicts[conflicts.length - 1]?.note ?? "Isolation snapshot failed."
          }
        } as never)
        .eq("id" as never, install.id as never);
    }

    return {
      install: parsed,
      packageResult,
      validation
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template install failed.";
    const failedAt = new Date().toISOString();

    await admin
      .from("template_installs" as never)
      .update({
        error_message: message,
        failed_at: failedAt,
        installed_summary: {
          conflicts,
          registryTemplateId: install.templateId,
          storeTemplateId
        },
        status: "failed"
      } as never)
      .eq("id" as never, install.id as never);

    await recordInstallAudit("template_install_failed", {
      installId: install.id,
      metadata: {
        error_message: message,
        install_mode: install.installMode,
        status: "failed",
        store_id: install.storeId,
        store_name: store.name,
        store_template_id: storeTemplateId,
        template_id: install.templateId,
        template_name: validation.templateName
      },
      userId: access.user.id
    });

    throw new Error(message);
  }
}

export async function getTemplateInstallStatus(installId: string): Promise<TemplateInstallRecord | null> {
  await requireSuperAdmin();

  const id = text(installId, 120);

  if (!id) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_installs" as never)
    .select(installSelect)
    .eq("id" as never, id as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template install status could not be loaded: ${error.message}`);
  }

  return parseInstall(data);
}

export async function listTemplateInstalls(limit = 100): Promise<TemplateInstallRecord[]> {
  await requireSuperAdmin();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_installs" as never)
    .select(installSelect)
    .order("created_at" as never, { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    throw new Error(`Template installs could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseInstall(row))
    .filter((install): install is TemplateInstallRecord => Boolean(install));
}
