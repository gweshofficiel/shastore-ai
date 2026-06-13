import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { integrationDefinitions } from "@/lib/integrations/catalog";
import {
  maskIntegrationDiagnostic,
  maskSensitiveText
} from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationAuditStatus = "blocked" | "failed" | "skipped" | "started" | "success";

export type IntegrationAuditLog = {
  category: string;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  id: string;
  operation: string;
  providerKey: string;
  providerName: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  requestId: string | null;
  safeSummary: Record<string, unknown> | null;
  status: IntegrationAuditStatus;
  storeId: string | null;
  userId: string | null;
  workspaceId: string | null;
};

export type IntegrationAuditLogFilters = {
  category?: string | null;
  providerKey?: string | null;
  status?: IntegrationAuditStatus | "all" | null;
};

export type RecordIntegrationAuditLogInput = {
  category: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  operation: string;
  providerKey: string;
  providerName: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  requestId?: string | null;
  safeSummary?: Record<string, unknown> | null;
  status: IntegrationAuditStatus;
  storeId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
};

type AuditTable = {
  insert: (values: never) => PromiseLike<{ error: { message: string } | null }>;
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (limit: number) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type AdminClient = {
  from: (table: string) => unknown;
};

const auditStatuses: IntegrationAuditStatus[] = ["blocked", "failed", "skipped", "started", "success"];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access integration audit logs.");
  }
}

function table(client: AdminClient) {
  return client.from("integration_audit_logs") as AuditTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);

  return cleaned || null;
}

function safeStatus(value: unknown): IntegrationAuditStatus {
  return auditStatuses.includes(value as IntegrationAuditStatus)
    ? (value as IntegrationAuditStatus)
    : "skipped";
}

function parseAuditLog(row: unknown): IntegrationAuditLog | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = cleanText(value.id, 80);
  const providerKey = cleanText(value.provider_key, 120);
  const createdAt = cleanText(value.created_at, 80);

  if (!id || !providerKey || !createdAt) {
    return null;
  }

  return {
    category: cleanText(value.category, 160),
    createdAt,
    errorCode: nullableText(value.error_code, 160),
    errorMessage: nullableText(value.error_message, 500),
    id,
    operation: cleanText(value.operation, 160),
    providerKey,
    providerName: cleanText(value.provider_name, 160),
    relatedEntityId: nullableText(value.related_entity_id, 160),
    relatedEntityType: nullableText(value.related_entity_type, 120),
    requestId: nullableText(value.request_id, 160),
    safeSummary: (maskIntegrationDiagnostic(value.safe_summary) ?? null) as Record<string, unknown> | null,
    status: safeStatus(value.status),
    storeId: nullableText(value.store_id, 80),
    userId: nullableText(value.user_id, 80),
    workspaceId: nullableText(value.workspace_id, 80)
  };
}

function providerMetadata(input: Pick<RecordIntegrationAuditLogInput, "category" | "providerKey" | "providerName">) {
  const definition = integrationDefinitions.find((provider) => provider.key === input.providerKey);

  return {
    category: input.category || definition?.category || "Unknown",
    providerName: input.providerName || definition?.name || input.providerKey
  };
}

export async function recordIntegrationAuditLog(input: RecordIntegrationAuditLogInput) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    console.warn("integration_audit_log_skipped", {
      code: "admin_client_unavailable",
      operation: input.operation,
      providerKey: input.providerKey
    });
    return;
  }

  const metadata = providerMetadata(input);
  const { error } = await table(admin).insert({
    category: cleanText(metadata.category, 160),
    error_code: nullableText(input.errorCode, 160),
    error_message: nullableText(input.errorMessage, 500),
    operation: cleanText(input.operation, 160),
    provider_key: cleanText(input.providerKey, 120),
    provider_name: cleanText(metadata.providerName, 160),
    related_entity_id: nullableText(input.relatedEntityId, 160),
    related_entity_type: nullableText(input.relatedEntityType, 120),
    request_id: nullableText(input.requestId, 160),
    safe_summary: maskIntegrationDiagnostic(input.safeSummary ?? {}),
    status: input.status,
    store_id: input.storeId ?? null,
    user_id: input.userId ?? access.user.id,
    workspace_id: input.workspaceId ?? null
  } as never);

  if (error) {
    console.warn("integration_audit_log_failed", {
      code: "insert_failed",
      message: maskSensitiveText(error.message),
      operation: input.operation,
      providerKey: input.providerKey
    });
  }
}

export async function listIntegrationAuditLogs(filters: IntegrationAuditLogFilters = {}) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await table(admin)
    .select("id, provider_key, provider_name, category, operation, status, store_id, user_id, workspace_id, related_entity_type, related_entity_id, request_id, error_code, error_message, safe_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return [];
  }

  return (data ?? [])
    .map(parseAuditLog)
    .filter((log): log is IntegrationAuditLog => Boolean(log))
    .filter((log) => !filters.providerKey || filters.providerKey === "all" || log.providerKey === filters.providerKey)
    .filter((log) => !filters.category || filters.category === "all" || log.category === filters.category)
    .filter((log) => !filters.status || filters.status === "all" || log.status === filters.status);
}
