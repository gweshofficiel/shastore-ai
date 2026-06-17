import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type StoreThemeIsolationStatus = "failed" | "safe" | "warning";

export type StoreThemeIsolationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type StoreThemeIsolationValidation = {
  canProceed: boolean;
  isolationStatus: StoreThemeIsolationStatus;
  issues: StoreThemeIsolationIssue[];
  storeId: string | null;
  storeName: string | null;
  templateName: string | null;
  templateRegistryId: string | null;
};

export type StoreThemeIsolationSnapshotRecord = {
  createdAt: string | null;
  id: string;
  installId: string | null;
  isolationStatus: StoreThemeIsolationStatus;
  issues: StoreThemeIsolationIssue[];
  snapshot: Record<string, unknown>;
  storeId: string;
  templateId: string | null;
  templateVersionId: string | null;
};

export type StoreThemeIsolationIssueFilters = {
  isolationStatus?: StoreThemeIsolationStatus | StoreThemeIsolationStatus[];
  limit?: number;
  storeId?: string;
  templateId?: string;
};

type IsolationSnapshotRow = {
  created_at?: string | null;
  id?: string | null;
  install_id?: string | null;
  isolation_status?: string | null;
  issues?: unknown;
  snapshot?: unknown;
  store_id?: string | null;
  template_id?: string | null;
  template_version_id?: string | null;
};

type ThemeReference = {
  id: string;
  layoutKey: string | null;
  status: string | null;
  storeInstanceId: string | null;
  themeId: string | null;
  themeKey: string | null;
};

const snapshotSelect =
  "id, store_id, template_id, template_version_id, install_id, snapshot, isolation_status, issues, created_at";

const sensitiveKeys = new Set([
  "apiKey",
  "api_key",
  "credential",
  "email",
  "password",
  "phone",
  "secret",
  "storageBucket",
  "storageKey",
  "storage_bucket",
  "storage_key",
  "token",
  "url"
]);

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

function parseStatus(value: unknown): StoreThemeIsolationStatus {
  const cleaned = text(value, 40);
  if (cleaned === "warning") return "warning";
  if (cleaned === "failed") return "failed";
  return "safe";
}

function parseIssues(value: unknown): StoreThemeIsolationIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const code = coerceText(entry.code, 80);
      const message = coerceText(entry.message, 500);
      const severity = entry.severity === "warning" ? "warning" : "error";

      if (!code || !message) return null;

      return { code, message, severity };
    })
    .filter((issue): issue is StoreThemeIsolationIssue => Boolean(issue));
}

function parseSnapshotRow(row: unknown): StoreThemeIsolationSnapshotRecord | null {
  if (!isRecord(row)) return null;

  const value = row as IsolationSnapshotRow;
  const id = coerceText(value.id, 120);
  const storeId = coerceText(value.store_id, 120);

  if (!id || !storeId) return null;

  return {
    createdAt: coerceText(value.created_at, 80) || null,
    id,
    installId: coerceText(value.install_id, 120) || null,
    isolationStatus: parseStatus(value.isolation_status),
    issues: parseIssues(value.issues),
    snapshot: safeRecord(value.snapshot),
    storeId,
    templateId: coerceText(value.template_id, 120) || null,
    templateVersionId: coerceText(value.template_version_id, 120) || null
  };
}

function sanitizeSnapshotValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeSnapshotValue(entry, depth + 1));
  }

  if (!isRecord(value)) {
    if (typeof value === "string") return text(value, 200);
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    return coerceText(value, 120);
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (sensitiveKeys.has(key)) continue;
    sanitized[key] = sanitizeSnapshotValue(entry, depth + 1);
  }

  return sanitized;
}

function deriveIsolationStatus(issues: StoreThemeIsolationIssue[]): StoreThemeIsolationStatus {
  if (issues.some((issue) => issue.severity === "error")) return "failed";
  if (issues.length > 0) return "warning";
  return "safe";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access store theme isolation runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for store theme isolation runtime.");
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

async function loadStoreContext(storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data: rawData, error } = await admin
    .from("stores" as never)
    .select("id, name, store_name, template_id, user_id, workspace_id")
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  const data = rawData as unknown;

  if (error || !isRecord(data)) return null;

  return {
    id: coerceText(data.id, 120),
    name: coerceText(data.store_name, 120) || coerceText(data.name, 120) || "Store",
    templateId: coerceText(data.template_id, 120) || null,
    userId: coerceText(data.user_id, 120),
    workspaceId: coerceText(data.workspace_id, 120)
  };
}

async function loadActiveAssignment(storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const { data, error } = await admin
    .from("store_template_assignments" as never)
    .select("id, store_id, template_id, template_version_id, install_id, assignment_status, assignment_source")
    .eq("store_id" as never, cleanedStoreId as never)
    .in("assignment_status" as never, ["active", "assigned"] as never)
    .order("assigned_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !isRecord(data)) return null;

  const row = data as Record<string, unknown>;

  return {
    assignmentSource: coerceText(row.assignment_source, 40) || "super_admin_manual",
    assignmentStatus: coerceText(row.assignment_status, 40) || "assigned",
    id: coerceText(row.id, 120),
    installId: coerceText(row.install_id, 120) || null,
    storeId: coerceText(row.store_id, 120),
    templateId: coerceText(row.template_id, 120),
    templateVersionId: coerceText(row.template_version_id, 120) || null
  };
}

async function loadThemeReferences(storeId: string): Promise<ThemeReference[]> {
  const admin = requireAdminClient();

  const { data, error } = await admin
    .from("store_themes" as never)
    .select("id, store_id, store_instance_id, theme_id, theme_key, layout_key, status")
    .or(`store_id.eq.${storeId},store_instance_id.eq.${storeId}` as never)
    .limit(50);

  if (error || !Array.isArray(data)) return [];

  return data
    .map((row) => {
      const record = row as unknown;

      if (!isRecord(record)) return null;

      const id = coerceText(record.id, 120);
      const rowStoreId = coerceText(record.store_id, 120);

      if (!id) return null;

      if (rowStoreId && rowStoreId !== storeId) {
        return null;
      }

      return {
        id,
        layoutKey: coerceText(record.layout_key, 80) || null,
        status: coerceText(record.status, 40) || null,
        storeInstanceId: coerceText(record.store_instance_id, 120) || null,
        themeId: coerceText(record.theme_id, 120) || null,
        themeKey: coerceText(record.theme_key, 120) || null
      };
    })
    .filter((theme): theme is ThemeReference => Boolean(theme));
}

async function loadThemeSettingsReference(storeId: string) {
  const admin = requireAdminClient();

  const { data, error } = await admin
    .from("store_theme_settings" as never)
    .select("id, store_id, template_id")
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (error || !isRecord(data)) return null;

  const row = data as Record<string, unknown>;

  return {
    id: coerceText(row.id, 120),
    storeId: coerceText(row.store_id, 120),
    templateId: coerceText(row.template_id, 120) || null
  };
}

async function countStyleOverrides(storeId: string) {
  const admin = requireAdminClient();

  const { count, error } = await admin
    .from("store_theme_style_overrides" as never)
    .select("id", { count: "exact", head: true })
    .eq("store_id" as never, storeId as never);

  if (error) return 0;
  return count ?? 0;
}

async function collectIsolationIssues(storeId: string, templateId: string): Promise<{
  issues: StoreThemeIsolationIssue[];
  publishedVersion: Awaited<ReturnType<typeof getPublishedTemplateVersion>> | null;
  store: Awaited<ReturnType<typeof loadStoreContext>>;
  template: TemplateRegistryRecord | null;
  themeSettings: Awaited<ReturnType<typeof loadThemeSettingsReference>>;
  themes: ThemeReference[];
}> {
  const issues: StoreThemeIsolationIssue[] = [];
  const cleanedStoreId = coerceText(storeId, 120);
  const template = await findRegistryTemplate(templateId);
  const store = await loadStoreContext(cleanedStoreId);

  if (!store) {
    issues.push({
      code: "store_not_found",
      message: "Target store was not found for theme isolation validation.",
      severity: "error"
    });

    return {
      issues,
      publishedVersion: null,
      store: null,
      template,
      themeSettings: null,
      themes: []
    };
  }

  if (!template) {
    issues.push({
      code: "template_not_found",
      message: "Template registry record was not found for theme isolation validation.",
      severity: "error"
    });
  } else if (template.status === "archived") {
    issues.push({
      code: "template_archived",
      message: "Archived templates cannot pass store theme isolation validation.",
      severity: "error"
    });
  } else if (template.status !== "active") {
    issues.push({
      code: "template_not_active",
      message: `Template must be active for isolated store operations (current: ${template.status}).`,
      severity: "error"
    });
  }

  const themes = await loadThemeReferences(cleanedStoreId);

  for (const theme of themes) {
    if (theme.storeInstanceId && theme.storeInstanceId !== cleanedStoreId) {
      issues.push({
        code: "cross_store_theme_instance_binding",
        message: `Store theme ${theme.id} is bound to a different store instance.`,
        severity: "error"
      });
    }
  }

  const admin = requireAdminClient();
  const { data: foreignThemes, error: foreignThemesError } = await admin
    .from("store_themes" as never)
    .select("id, store_id, store_instance_id")
    .neq("store_id" as never, cleanedStoreId as never)
    .eq("store_instance_id" as never, cleanedStoreId as never)
    .limit(5);

  if (!foreignThemesError && Array.isArray(foreignThemes) && foreignThemes.length > 0) {
    issues.push({
      code: "foreign_theme_instance_collision",
      message: "Another store theme row references this store as instance while bound elsewhere.",
      severity: "error"
    });
  }

  const { data: ambiguousThemes, error: ambiguousThemesError } = await admin
    .from("store_themes" as never)
    .select("id")
    .is("store_id" as never, null)
    .is("store_instance_id" as never, null)
    .limit(1);

  if (!ambiguousThemesError && Array.isArray(ambiguousThemes) && ambiguousThemes.length > 0) {
    issues.push({
      code: "ambiguous_global_theme_scope",
      message: "Published theme rows exist without store scope and may risk cross-store mutation.",
      severity: "error"
    });
  }

  const themeSettings = await loadThemeSettingsReference(cleanedStoreId);

  if (themeSettings && themeSettings.storeId !== cleanedStoreId) {
    issues.push({
      code: "theme_settings_store_mismatch",
      message: "Store theme settings reference a different store id.",
      severity: "error"
    });
  }

  const assignment = await loadActiveAssignment(cleanedStoreId);

  if (assignment && assignment.storeId !== cleanedStoreId) {
    issues.push({
      code: "assignment_store_mismatch",
      message: "Active template assignment does not belong to the selected store.",
      severity: "error"
    });
  }

  if (template && assignment && assignment.templateId !== template.id) {
    issues.push({
      code: "assignment_template_mismatch",
      message: "Active store assignment references a different template than requested.",
      severity: "warning"
    });
  }

  if (!themes.length) {
    issues.push({
      code: "no_store_theme_rows",
      message: "No store-specific theme rows found yet. Install will remain store-scoped.",
      severity: "warning"
    });
  }

  if (!themeSettings) {
    issues.push({
      code: "no_theme_settings_row",
      message: "No legacy store theme settings row found. Store theme customize remains isolated.",
      severity: "warning"
    });
  }

  const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;

  if (template && !publishedVersion) {
    issues.push({
      code: "missing_published_version",
      message: "Published template version is required for isolated template operations.",
      severity: "error"
    });
  }

  return {
    issues,
    publishedVersion,
    store,
    template,
    themeSettings,
    themes
  };
}

export async function verifyNoCrossStoreTemplateMutation(
  storeId: string,
  templateId: string,
  options: { assignmentId?: string | null; installId?: string | null } = {}
): Promise<{
  canProceed: boolean;
  isolationStatus: StoreThemeIsolationStatus;
  issues: StoreThemeIsolationIssue[];
}> {
  await requireSuperAdmin();

  const cleanedStoreId = coerceText(storeId, 120);
  const issues: StoreThemeIsolationIssue[] = [];

  if (!cleanedStoreId) {
    return {
      canProceed: false,
      isolationStatus: "failed" as const,
      issues: [
        {
          code: "invalid_store_id",
          message: "Store id is required for cross-store mutation verification.",
          severity: "error"
        }
      ]
    };
  }

  const installId = coerceText(options.installId, 120);

  if (installId) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from("template_installs" as never)
      .select("id, store_id, template_id")
      .eq("id" as never, installId as never)
      .maybeSingle();

    const row = data as unknown;

    if (error || !isRecord(row)) {
      issues.push({
        code: "install_record_missing",
        message: "Template install record could not be verified for store isolation.",
        severity: "error"
      });
    } else if (coerceText(row.store_id, 120) !== cleanedStoreId) {
      issues.push({
        code: "install_store_mismatch",
        message: "Template install record belongs to a different store.",
        severity: "error"
      });
    }
  }

  const assignmentId = coerceText(options.assignmentId, 120);

  if (assignmentId) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from("store_template_assignments" as never)
      .select("id, store_id, template_id")
      .eq("id" as never, assignmentId as never)
      .maybeSingle();

    const row = data as unknown;

    if (error || !isRecord(row)) {
      issues.push({
        code: "assignment_record_missing",
        message: "Store template assignment could not be verified for isolation.",
        severity: "error"
      });
    } else {
      if (coerceText(row.store_id, 120) !== cleanedStoreId) {
        issues.push({
          code: "assignment_store_mismatch",
          message: "Template assignment belongs to a different store.",
          severity: "error"
        });
      }

      const template = await findRegistryTemplate(templateId);

      if (template && coerceText(row.template_id, 120) !== template.id) {
        issues.push({
          code: "assignment_template_mismatch",
          message: "Template assignment references a different template registry id.",
          severity: "error"
        });
      }
    }
  }

  const isolationStatus = deriveIsolationStatus(issues);

  return {
    canProceed: isolationStatus !== "failed",
    isolationStatus,
    issues
  };
}

export async function validateStoreThemeIsolation(
  storeId: string,
  templateId: string
): Promise<StoreThemeIsolationValidation> {
  await requireSuperAdmin();

  const context = await collectIsolationIssues(storeId, templateId);
  const mutation = await verifyNoCrossStoreTemplateMutation(storeId, templateId);
  const issues: StoreThemeIsolationIssue[] = [...context.issues, ...mutation.issues];
  const isolationStatus = deriveIsolationStatus(issues);

  return {
    canProceed: isolationStatus !== "failed",
    isolationStatus,
    issues,
    storeId: context.store?.id ?? null,
    storeName: context.store?.name ?? null,
    templateName: context.template?.name ?? null,
    templateRegistryId: context.template?.id ?? null
  };
}

export async function getStoreThemeIsolationSnapshot(storeId: string) {
  await requireSuperAdmin();

  const cleanedStoreId = coerceText(storeId, 120);

  if (!cleanedStoreId) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("store_template_isolation_snapshots" as never)
    .select(snapshotSelect)
    .eq("store_id" as never, cleanedStoreId as never)
    .order("created_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Store theme isolation snapshot could not be loaded: ${error.message}`);
  }

  return parseSnapshotRow(data);
}

export async function createStoreThemeIsolationSnapshot(
  storeId: string,
  templateId: string,
  installId: string | null
) {
  const access = await requireSuperAdmin();

  const cleanedStoreId = coerceText(storeId, 120);
  const cleanedTemplateId = coerceText(templateId, 120);
  const cleanedInstallId = coerceText(installId, 120) || null;

  if (!cleanedStoreId) {
    throw new Error("Store id is required to create a theme isolation snapshot.");
  }

  const context = await collectIsolationIssues(cleanedStoreId, cleanedTemplateId);
  const mutation = await verifyNoCrossStoreTemplateMutation(cleanedStoreId, cleanedTemplateId, {
    installId: cleanedInstallId
  });
  const issues: StoreThemeIsolationIssue[] = [...context.issues, ...mutation.issues];
  const isolationStatus = deriveIsolationStatus(issues);
  const assignment = await loadActiveAssignment(cleanedStoreId);
  const styleOverrideCount = await countStyleOverrides(cleanedStoreId);

  const snapshot = sanitizeSnapshotValue({
    assignment: assignment
      ? {
          assignmentSource: assignment.assignmentSource,
          assignmentStatus: assignment.assignmentStatus,
          id: assignment.id,
          installId: assignment.installId,
          storeId: assignment.storeId,
          templateId: assignment.templateId,
          templateVersionId: assignment.templateVersionId
        }
      : null,
    capturedAt: new Date().toISOString(),
    conflicts: issues,
    installId: cleanedInstallId,
    registryTemplateId: context.template?.id ?? cleanedTemplateId,
    storeId: cleanedStoreId,
    storeName: context.store?.name ?? null,
    storeTemplateRef: context.store?.templateId ?? null,
    styleOverrideCount,
    templateVersionId: context.publishedVersion?.id ?? null,
    templateVersionNumber: context.publishedVersion?.versionNumber ?? null,
    themeReferences: context.themes,
    themeSettingsReference: context.themeSettings
  }) as Record<string, unknown>;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("store_template_isolation_snapshots" as never)
    .insert({
      install_id: cleanedInstallId,
      isolation_status: isolationStatus,
      issues,
      snapshot,
      store_id: cleanedStoreId,
      template_id: context.template?.id ?? (cleanedTemplateId || null),
      template_version_id: context.publishedVersion?.id ?? null
    } as never)
    .select(snapshotSelect)
    .single();

  if (error) {
    throw new Error(`Store theme isolation snapshot could not be created: ${error.message}`);
  }

  const parsed = parseSnapshotRow(data);

  if (!parsed) {
    throw new Error("Store theme isolation snapshot could not be parsed.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: parsed.id,
    entity_type: "admin_template_isolation",
    event_status: isolationStatus === "failed" ? "error" : isolationStatus === "warning" ? "warning" : "info",
    event_type: "template_theme_isolation_snapshot_created",
    metadata: {
      install_id: cleanedInstallId,
      isolation_status: isolationStatus,
      issue_count: issues.length,
      note: "Store theme isolation snapshot recorded. Metadata only; no storefront rendering or cross-store mutations.",
      source: "super_admin_store_theme_isolation_runtime",
      store_id: cleanedStoreId,
      template_id: parsed.templateId
    },
    store_id: cleanedStoreId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return parsed;
}

export async function listStoreThemeIsolationIssues(
  filters: StoreThemeIsolationIssueFilters = {}
): Promise<StoreThemeIsolationSnapshotRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  let query = admin.from("store_template_isolation_snapshots" as never).select(snapshotSelect);

  const storeId = coerceText(filters.storeId, 120);

  if (storeId) {
    query = query.eq("store_id" as never, storeId as never);
  }

  const templateId = coerceText(filters.templateId, 120);

  if (templateId) {
    query = query.eq("template_id" as never, templateId as never);
  }

  if (filters.isolationStatus) {
    const statuses = Array.isArray(filters.isolationStatus)
      ? filters.isolationStatus
      : [filters.isolationStatus];
    query = query.in("isolation_status" as never, statuses as never);
  }

  const { data, error } = await query
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Store theme isolation snapshots could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseSnapshotRow(row))
    .filter((snapshot): snapshot is StoreThemeIsolationSnapshotRecord => Boolean(snapshot));
}
