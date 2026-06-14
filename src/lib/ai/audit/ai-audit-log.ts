import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskIntegrationDiagnostic, maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiAuditEventType,
  AiAuditLog,
  AiAuditLogFilters,
  AiAuditStatus,
  RecordAiAuditLogInput
} from "@/src/lib/ai/audit/ai-audit-types";

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

const aiAuditEventTypes: AiAuditEventType[] = [
  "ai_diagnostic_failed",
  "ai_diagnostic_skipped",
  "ai_diagnostic_started",
  "ai_diagnostic_success",
  "ai_secret_marked_rotated",
  "ai_secret_rotation_required",
  "ai_queue_monitor_viewed",
  "ai_stale_job_detected",
  "ai_asset_created",
  "ai_asset_published",
  "ai_asset_review_cleared",
  "ai_asset_review_marked",
  "ai_job_cancelled",
  "ai_job_completed",
  "ai_job_failed",
  "ai_job_queued",
  "ai_job_requested",
  "ai_job_started"
];
const aiAuditStatuses: AiAuditStatus[] = ["blocked", "failed", "skipped", "started", "success"];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI audit logs.");
  }
}

function table(client: AdminClient) {
  return client.from("ai_audit_logs") as AuditTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);

  return cleaned || null;
}

function safeEventType(value: unknown): AiAuditEventType {
  return aiAuditEventTypes.includes(value as AiAuditEventType)
    ? (value as AiAuditEventType)
    : "ai_job_requested";
}

function safeStatus(value: unknown): AiAuditStatus {
  return aiAuditStatuses.includes(value as AiAuditStatus)
    ? (value as AiAuditStatus)
    : "skipped";
}

function parseAuditLog(row: unknown): AiAuditLog | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = cleanText(value.id, 80);
  const eventType = safeEventType(value.event_type);
  const createdAt = cleanText(value.created_at, 80);

  if (!id || !createdAt) {
    return null;
  }

  return {
    assetType: nullableText(value.asset_type, 120),
    createdAt,
    errorCode: nullableText(value.error_code, 160),
    errorMessage: nullableText(value.error_message, 500),
    eventType,
    id,
    jobId: nullableText(value.job_id, 160),
    providerKey: nullableText(value.provider_key, 120),
    safeSummary: (maskIntegrationDiagnostic(value.safe_summary) ?? null) as Record<string, unknown> | null,
    status: safeStatus(value.status),
    storeId: nullableText(value.store_id, 80),
    userId: nullableText(value.user_id, 80),
    workspaceId: nullableText(value.workspace_id, 80)
  };
}

function safeSummary(value: Record<string, unknown> | null | undefined) {
  const masked = maskIntegrationDiagnostic(value ?? {});

  return masked && typeof masked === "object" && !Array.isArray(masked)
    ? (masked as Record<string, unknown>)
    : {};
}

export async function recordAiAuditLog(input: RecordAiAuditLogInput) {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("ai_audit_log_skipped", {
      code: "admin_client_unavailable",
      eventType: input.eventType,
      providerKey: input.providerKey
    });
    return;
  }

  const { error } = await table(admin).insert({
    asset_type: nullableText(input.assetType, 120),
    error_code: nullableText(input.errorCode, 160),
    error_message: nullableText(input.errorMessage, 500),
    event_type: input.eventType,
    job_id: nullableText(input.jobId, 160),
    provider_key: nullableText(input.providerKey, 120),
    safe_summary: safeSummary(input.safeSummary),
    status: input.status,
    store_id: input.storeId || null,
    user_id: input.userId || null,
    workspace_id: input.workspaceId || null
  } as never);

  if (error) {
    console.warn("ai_audit_log_failed", {
      code: "insert_failed",
      eventType: input.eventType,
      message: maskSensitiveText(error.message),
      providerKey: input.providerKey
    });
  }
}

export async function listAiAuditLogs(filters: AiAuditLogFilters = {}) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await table(admin)
    .select("id, event_type, provider_key, job_id, store_id, user_id, workspace_id, asset_type, status, error_code, error_message, safe_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return [];
  }

  return (data ?? [])
    .map(parseAuditLog)
    .filter((log): log is AiAuditLog => Boolean(log))
    .filter((log) => !filters.status || filters.status === "all" || log.status === filters.status)
    .filter((log) => !filters.providerKey || filters.providerKey === "all" || log.providerKey === filters.providerKey)
    .filter((log) => !filters.assetType || filters.assetType === "all" || log.assetType === filters.assetType)
    .filter((log) => !filters.eventType || filters.eventType === "all" || log.eventType === filters.eventType);
}
