import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { integrationDefinitions } from "@/lib/integrations/catalog";
import {
  maskIntegrationDiagnostic,
  maskSensitiveText
} from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationErrorStatus = "blocked" | "degraded" | "failed";
export type IntegrationErrorSource = "audit_log" | "health_state";

export type IntegrationErrorCenterItem = {
  category: string;
  createdAt: string;
  errorCode: string | null;
  errorId: string;
  errorMessage: string | null;
  operation: string;
  providerKey: string;
  providerName: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  requestId: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  safeSummary: Record<string, unknown> | null;
  source: IntegrationErrorSource;
  status: IntegrationErrorStatus;
  storeId: string | null;
  userId: string | null;
  workspaceId: string | null;
};

export type IntegrationErrorFilters = {
  category?: string | null;
  from?: string | null;
  providerKey?: string | null;
  status?: IntegrationErrorStatus | "all" | null;
  to?: string | null;
  unresolvedOnly?: boolean;
};

type AuditTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (limit: number) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  update: (values: never) => {
    eq: (column: string, value: string) => PromiseLike<{
      error: { message: string } | null;
    }>;
  };
};

type HealthTable = {
  select: (columns: string) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};

type MonitoringEventsTable = {
  insert: (values: never) => PromiseLike<{ error: { message: string } | null }>;
};

type AdminClient = {
  from: (table: string) => unknown;
};

const errorStatuses: IntegrationErrorStatus[] = ["blocked", "degraded", "failed"];

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access integration errors.");
  }
}

function auditTable(client: AdminClient) {
  return client.from("integration_audit_logs") as AuditTable;
}

function healthTable(client: AdminClient) {
  return client.from("integration_health_states") as HealthTable;
}

function monitoringEventsTable(client: AdminClient) {
  return client.from("monitoring_events") as MonitoringEventsTable;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? maskSensitiveText(value.trim()).slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 500) {
  const text = cleanText(value, maxLength);

  return text || null;
}

function safeStatus(value: unknown): IntegrationErrorStatus | null {
  const status = cleanText(value, 80);

  return errorStatuses.includes(status as IntegrationErrorStatus)
    ? (status as IntegrationErrorStatus)
    : null;
}

function providerName(providerKey: string) {
  return integrationDefinitions.find((definition) => definition.key === providerKey)?.name ?? providerKey;
}

function providerCategory(providerKey: string) {
  return integrationDefinitions.find((definition) => definition.key === providerKey)?.category ?? "Unknown";
}

function dateInRange(value: string, filters: IntegrationErrorFilters) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  if (filters.from && timestamp < Date.parse(filters.from)) {
    return false;
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999);

    if (timestamp > toDate.getTime()) {
      return false;
    }
  }

  return true;
}

function parseAuditError(row: unknown): IntegrationErrorCenterItem | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = cleanText(value.id, 80);
  const status = safeStatus(value.status);
  const providerKey = cleanText(value.provider_key, 120);
  const createdAt = cleanText(value.created_at, 80);

  if (!id || !status || !providerKey || !createdAt) {
    return null;
  }

  return {
    category: cleanText(value.category, 160) || providerCategory(providerKey),
    createdAt,
    errorCode: nullableText(value.error_code, 160),
    errorId: id,
    errorMessage: nullableText(value.error_message, 500),
    operation: cleanText(value.operation, 160),
    providerKey,
    providerName: cleanText(value.provider_name, 160) || providerName(providerKey),
    relatedEntityId: nullableText(value.related_entity_id, 160),
    relatedEntityType: nullableText(value.related_entity_type, 120),
    requestId: nullableText(value.request_id, 160),
    resolvedAt: nullableText(value.resolved_at, 80),
    resolvedBy: nullableText(value.resolved_by, 80),
    resolutionNote: nullableText(value.resolution_note, 500),
    safeSummary: (maskIntegrationDiagnostic(value.safe_summary) ?? null) as Record<string, unknown> | null,
    source: "audit_log",
    status,
    storeId: nullableText(value.store_id, 80),
    userId: nullableText(value.user_id, 80),
    workspaceId: nullableText(value.workspace_id, 80)
  };
}

function parseHealthError(row: unknown): IntegrationErrorCenterItem | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const value = row as Record<string, unknown>;
  const providerKey = cleanText(value.provider_key, 120);
  const rawStatus = cleanText(value.status, 80);
  const createdAt = cleanText(value.last_failure_at, 80) || cleanText(value.last_checked_at, 80);

  if (!providerKey || !createdAt || !["degraded", "failed", "missing_config"].includes(rawStatus)) {
    return null;
  }

  return {
    category: cleanText(value.category, 160) || providerCategory(providerKey),
    createdAt,
    errorCode: nullableText(value.last_error_code, 160) ?? rawStatus,
    errorId: `health:${providerKey}`,
    errorMessage: nullableText(value.last_error_message, 500),
    operation: "provider_health_state",
    providerKey,
    providerName: cleanText(value.provider_name, 160) || providerName(providerKey),
    relatedEntityId: null,
    relatedEntityType: "integration_health_state",
    requestId: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    safeSummary: (maskIntegrationDiagnostic(value.last_safe_response_summary) ?? null) as Record<string, unknown> | null,
    source: "health_state",
    status: rawStatus === "missing_config" ? "failed" : (rawStatus as IntegrationErrorStatus),
    storeId: null,
    userId: null,
    workspaceId: null
  };
}

function matchesFilters(error: IntegrationErrorCenterItem, filters: IntegrationErrorFilters) {
  if (filters.providerKey && filters.providerKey !== "all" && error.providerKey !== filters.providerKey) {
    return false;
  }

  if (filters.category && filters.category !== "all" && error.category !== filters.category) {
    return false;
  }

  if (filters.status && filters.status !== "all" && error.status !== filters.status) {
    return false;
  }

  if (filters.unresolvedOnly && error.resolvedAt) {
    return false;
  }

  return dateInRange(error.createdAt, filters);
}

async function recordErrorCenterMonitoringEvent({
  access,
  errorId,
  eventType,
  note
}: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  errorId: string;
  eventType: "integration_error_marked_resolved" | "integration_error_reopened";
  note?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await monitoringEventsTable(admin).insert({
    entity_id: errorId,
    entity_type: "integration_error",
    event_status: "info",
    event_type: eventType,
    metadata: maskIntegrationDiagnostic({
      error_id: errorId,
      note
    }),
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);
}

export async function listIntegrationErrors(filters: IntegrationErrorFilters = {}) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const [auditResult, healthResult] = await Promise.all([
    auditTable(admin)
      .select("id, provider_key, provider_name, category, operation, status, store_id, user_id, workspace_id, related_entity_type, related_entity_id, request_id, error_code, error_message, safe_summary, created_at, resolved_at, resolved_by, resolution_note")
      .order("created_at", { ascending: false })
      .limit(300),
    healthTable(admin)
      .select("provider_key, provider_name, category, status, last_checked_at, last_failure_at, last_error_code, last_error_message, last_safe_response_summary")
  ]);

  const auditErrors = auditResult.error
    ? []
    : (auditResult.data ?? [])
        .map(parseAuditError)
        .filter((error): error is IntegrationErrorCenterItem => Boolean(error));
  const healthErrors = healthResult.error
    ? []
    : (healthResult.data ?? [])
        .map(parseHealthError)
        .filter((error): error is IntegrationErrorCenterItem => Boolean(error));

  return [...auditErrors, ...healthErrors]
    .filter((error) => matchesFilters(error, filters))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export async function markIntegrationErrorResolved(errorId: string, note?: string | null) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  if (errorId.startsWith("health:")) {
    throw new Error("Provider health state errors resolve after the next healthy check.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for integration error updates.");
  }

  const { error } = await auditTable(admin)
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: access.user.id,
      resolution_note: nullableText(note, 500)
    } as never)
    .eq("id", errorId);

  if (error) {
    throw new Error("Integration error could not be marked resolved.");
  }

  await recordErrorCenterMonitoringEvent({
    access,
    errorId,
    eventType: "integration_error_marked_resolved",
    note
  });
}

export async function reopenIntegrationError(errorId: string) {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  if (errorId.startsWith("health:")) {
    throw new Error("Provider health state errors reopen automatically when unhealthy.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for integration error updates.");
  }

  const { error } = await auditTable(admin)
    .update({
      resolved_at: null,
      resolved_by: null,
      resolution_note: null
    } as never)
    .eq("id", errorId);

  if (error) {
    throw new Error("Integration error could not be reopened.");
  }

  await recordErrorCenterMonitoringEvent({
    access,
    errorId,
    eventType: "integration_error_reopened"
  });
}
