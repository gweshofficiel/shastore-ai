import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityAuditLogsSource = "security_audit_logs_runtime";

export type SecurityAuditLogSeverity = "critical" | "high" | "low" | "medium";

export type SecurityAuditLogStatus = "blocked" | "failed" | "recorded" | "reviewed" | "watching";

export type SecurityAuditLogsStatus = "audit_logs_ready" | "empty" | "load_error";

export type SecurityAuditLogRow = {
  action?: string | null;
  created_at?: string | null;
  id?: string | null;
  ip_address?: string | null;
  metadata?: unknown;
  reason?: string | null;
  route?: string | null;
  store_id?: string | null;
  user_agent?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

export type SecurityAuditLogRecord = {
  action: string;
  actor: string;
  actorRole: string;
  browserLabel: string;
  createdAt: string;
  deviceLabel: string;
  eventId: string;
  ipAvailable: boolean;
  ipMasked: string;
  recordKey: string;
  route: string | null;
  safeSummary: string;
  severity: SecurityAuditLogSeverity;
  status: SecurityAuditLogStatus;
  targetId: string | null;
  targetType: string;
  userAgent: string | null;
  userAgentAvailable: boolean;
};

export type SecurityAuditLogsPagination = {
  hasNext: boolean;
  hasPrevious: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  rangeEnd: number;
  rangeStart: number;
  returnedCount: number;
  totalCount: number;
};

export type SecurityAuditLogsFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityAuditLogsColumn = {
  key: string;
  label: string;
};

export type SecurityAuditLogsSummary = {
  loadError: string | null;
  pagination: SecurityAuditLogsPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityAuditLogsSource;
  status: SecurityAuditLogsStatus;
  summary: string;
};

export type SecurityAuditLogsRuntimeInput = {
  loadError: string | null;
  logs: SecurityAuditLogRow[];
  page: number;
  pageSize: number;
  reviewedEventIds?: string[];
  totalCount: number | null;
};

export type SecurityAuditLogsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityAuditLogsSource;
};

export type SecurityAuditLogsFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_AUDIT_LOGS_SOURCE = "security_audit_logs_runtime" as const;

export const SECURITY_AUDIT_LOGS_TABLE = "security_audit_logs" as const;

export const SECURITY_AUDIT_LOGS_REGISTRY_KEY = "sec-audit-logs" as const;

export const SECURITY_AUDIT_LOGS_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_AUDIT_LOGS_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_AUDIT_LOGS_EMPTY_STATE =
  "No security audit logs have been recorded yet. This runtime reads existing audit records only and never fabricates audit data.";

export const SECURITY_AUDIT_LOGS_COLUMNS: readonly SecurityAuditLogsColumn[] = [
  { key: "eventId", label: "Event ID" },
  { key: "actor", label: "Actor" },
  { key: "actorRole", label: "Actor Role" },
  { key: "action", label: "Action" },
  { key: "targetType", label: "Target Type" },
  { key: "targetId", label: "Target ID" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "ipMasked", label: "IP Address" },
  { key: "userAgent", label: "User Agent" },
  { key: "createdAt", label: "Created At" }
] as const;

export const SECURITY_AUDIT_LOGS_FILTERS: readonly SecurityAuditLogsFilter[] = [
  {
    enabled: false,
    key: "severity",
    label: "Severity",
    note: "Read-only placeholder. Severity filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All severities"
  },
  {
    enabled: false,
    key: "status",
    label: "Status",
    note: "Read-only placeholder. Status filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All statuses"
  },
  {
    enabled: false,
    key: "action",
    label: "Action",
    note: "Read-only placeholder. Action filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All actions"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Audit search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search audit logs"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityAuditLogRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityAuditLogRow[];
}

function maskIp(value: unknown): { available: boolean; masked: string } {
  const raw = text(value);

  if (!raw) {
    return { available: false, masked: "IP not recorded" };
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return { available: true, masked: `${parts.slice(0, 2).join(":")}:****` };
  }

  const parts = raw.split(".");

  if (parts.length === 4) {
    return { available: true, masked: `${parts[0]}.${parts[1]}.***.***` };
  }

  return { available: true, masked: "[masked-ip]" };
}

function safeSummary(value: unknown): string {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return "No safe summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 180);
}

function safeUserAgent(value: unknown): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, 240) : null;
}

function deriveSeverity(row: SecurityAuditLogRow): SecurityAuditLogSeverity {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  if (action.includes("token") || reason.includes("token") || action.includes("fraud")) {
    return "critical";
  }

  if (
    action.includes("denied") ||
    action.includes("unauthorized") ||
    action.includes("rate_limit") ||
    reason.includes("abuse")
  ) {
    return "high";
  }

  if (action.includes("login") && (action.includes("failed") || reason.includes("failed"))) {
    return "medium";
  }

  return "low";
}

function deriveStatus(
  row: SecurityAuditLogRow,
  severity: SecurityAuditLogSeverity,
  reviewedIds: Set<string>
): SecurityAuditLogStatus {
  const id = text(row.id);
  const action = text(row.action).toLowerCase();

  if (id && reviewedIds.has(id)) {
    return "reviewed";
  }

  if (action.includes("denied") || action.includes("rate_limit") || action.includes("blocked")) {
    return "blocked";
  }

  if (action.includes("failed")) {
    return "failed";
  }

  return severity === "high" || severity === "critical" ? "watching" : "recorded";
}

function deriveActor(row: SecurityAuditLogRow): string {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const metadataActor = text(metadata.actor) || text(metadata.actor_email);

  if (metadataActor) {
    return safeSummary(metadataActor);
  }

  const userId = text(row.user_id);

  if (userId) {
    return userId;
  }

  return "anonymous";
}

function deriveActorRole(row: SecurityAuditLogRow): string {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const metadataRole = text(metadata.actor_role) || text(metadata.role);

  if (metadataRole) {
    return metadataRole;
  }

  const action = text(row.action).toLowerCase();

  if (action.startsWith("admin") || action.includes("super_admin")) {
    return "super_admin";
  }

  if (text(row.user_id)) {
    return "authenticated";
  }

  return "unknown";
}

function deriveTarget(row: SecurityAuditLogRow): { id: string | null; type: string } {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const metadataType = text(metadata.target_type);
  const metadataId = text(metadata.target_id);

  if (metadataType || metadataId) {
    return {
      id: metadataId || null,
      type: metadataType || "metadata"
    };
  }

  if (text(row.store_id)) {
    return { id: text(row.store_id), type: "store" };
  }

  if (text(row.workspace_id)) {
    return { id: text(row.workspace_id), type: "workspace" };
  }

  if (text(row.user_id)) {
    return { id: text(row.user_id), type: "user" };
  }

  return { id: null, type: "none" };
}

export function mapSecurityAuditLogRowToRecord(
  row: SecurityAuditLogRow,
  reviewedIds: Set<string>,
  index: number
): SecurityAuditLogRecord {
  const severity = deriveSeverity(row);
  const status = deriveStatus(row, severity, reviewedIds);
  const target = deriveTarget(row);
  const ip = maskIp(row.ip_address);
  const userAgent = safeUserAgent(row.user_agent);
  const { browserLabel, deviceLabel } = summarizeUserAgent(text(row.user_agent) || null);
  const eventId = text(row.id) || `security-audit:${text(row.created_at)}:${index}`;

  return {
    action: text(row.action, "security.event"),
    actor: deriveActor(row),
    actorRole: deriveActorRole(row),
    browserLabel,
    createdAt: text(row.created_at, new Date(0).toISOString()),
    deviceLabel,
    eventId,
    ipAvailable: ip.available,
    ipMasked: ip.masked,
    recordKey: `security-audit-record-${eventId}`,
    route: text(row.route) || null,
    safeSummary: safeSummary(row.reason),
    severity,
    status,
    targetId: target.id,
    targetType: target.type,
    userAgent,
    userAgentAvailable: Boolean(userAgent)
  };
}

export function securityAuditLogSeverityBadgeTone(severity: SecurityAuditLogSeverity) {
  switch (severity) {
    case "critical":
      return "red" as const;
    case "high":
      return "amber" as const;
    case "medium":
      return "blue" as const;
    case "low":
      return "green" as const;
  }
}

export function securityAuditLogStatusBadgeTone(status: SecurityAuditLogStatus) {
  switch (status) {
    case "reviewed":
    case "recorded":
      return "green" as const;
    case "failed":
      return "red" as const;
    case "blocked":
    case "watching":
      return "amber" as const;
  }
}

export function normalizeSecurityAuditLogsPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityAuditLogsPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_AUDIT_LOGS_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_AUDIT_LOGS_MAX_PAGE_SIZE);
}

export function buildSecurityAuditLogsPagination(
  input: SecurityAuditLogsRuntimeInput,
  returnedCount: number
): SecurityAuditLogsPagination {
  const page = normalizeSecurityAuditLogsPage(input.page);
  const pageSize = normalizeSecurityAuditLogsPageSize(input.pageSize);
  const totalCount = typeof input.totalCount === "number" && input.totalCount >= 0 ? input.totalCount : returnedCount;
  const pageCount = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const rangeStart = returnedCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = returnedCount > 0 ? rangeStart + returnedCount - 1 : 0;

  return {
    hasNext: page < pageCount,
    hasPrevious: page > 1,
    page,
    pageCount,
    pageSize,
    rangeEnd,
    rangeStart,
    returnedCount,
    totalCount
  };
}

export function getSecurityAuditLogsSummary(
  input: SecurityAuditLogsRuntimeInput,
  records: SecurityAuditLogRecord[]
): SecurityAuditLogsSummary {
  const pagination = buildSecurityAuditLogsPagination(input, records.length);
  const status: SecurityAuditLogsStatus = input.loadError
    ? "load_error"
    : records.length === 0
      ? "empty"
      : "audit_logs_ready";

  return {
    loadError: input.loadError,
    pagination,
    readOnly: true,
    registryKey: SECURITY_AUDIT_LOGS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_AUDIT_LOGS_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${pagination.totalCount} total audit logs`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`
        ].join("; ")
  };
}

export function buildSecurityAuditLogsLoadingState(): SecurityAuditLogsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security audit logs runtime from existing audit records.",
    readOnly: true,
    source: SECURITY_AUDIT_LOGS_SOURCE
  };
}

export function buildSecurityAuditLogsErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityAuditLogsRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityAuditLogsPage(page),
    pageSize: normalizeSecurityAuditLogsPageSize(pageSize),
    reviewedEventIds: [],
    totalCount: 0
  };
}

export function mapSecurityAuditLogsRuntimeToAdminFields(input: SecurityAuditLogsRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_AUDIT_LOGS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityAuditLogsErrorInput(
      "Security audit logs are not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      auditLogs: [] as SecurityAuditLogRecord[],
      columns: SECURITY_AUDIT_LOGS_COLUMNS,
      emptyState: SECURITY_AUDIT_LOGS_EMPTY_STATE,
      filters: SECURITY_AUDIT_LOGS_FILTERS,
      registry: null,
      summary: getSecurityAuditLogsSummary(safeInput, [])
    };
  }

  const reviewedIds = new Set((input.reviewedEventIds ?? []).filter(Boolean));
  const records = input.loadError
    ? []
    : input.logs.map((row, index) => mapSecurityAuditLogRowToRecord(row, reviewedIds, index));
  const summary = getSecurityAuditLogsSummary(input, records);

  return {
    auditLogs: records,
    columns: SECURITY_AUDIT_LOGS_COLUMNS,
    emptyState: SECURITY_AUDIT_LOGS_EMPTY_STATE,
    filters: SECURITY_AUDIT_LOGS_FILTERS,
    registry: {
      auditEnabled: registryEntry.auditEnabled,
      description: registryEntry.description,
      displayName: registryEntry.displayName,
      key: registryEntry.key,
      permissions: [...registryEntry.permissions],
      route: registryEntry.route,
      runtimeStatus: registryEntry.runtimeStatus,
      source: SECURITY_REGISTRY_SOURCE,
      telemetryEnabled: registryEntry.telemetryEnabled,
      visibility: registryEntry.visibility
    },
    summary
  };
}

export async function fetchSecurityAuditLogsInput(
  options: SecurityAuditLogsFetchOptions = {}
): Promise<SecurityAuditLogsRuntimeInput> {
  const page = normalizeSecurityAuditLogsPage(options.page);
  const pageSize = normalizeSecurityAuditLogsPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityAuditLogsErrorInput(
        "Service-role admin access is required to read security audit logs.",
        page,
        pageSize
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { count, data, error } = await admin
      .from(SECURITY_AUDIT_LOGS_TABLE as never)
      .select(
        "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at" as never, { ascending: false } as never)
      .range(from, to);

    if (error) {
      return buildSecurityAuditLogsErrorInput(
        `Unable to load security audit logs: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data),
      page,
      pageSize,
      reviewedEventIds: [],
      totalCount: typeof count === "number" ? count : null
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading security audit logs.";
    return buildSecurityAuditLogsErrorInput(`Unable to load security audit logs: ${message}`, page, pageSize);
  }
}

export async function loadSecurityAuditLogsReadOnlySafe(options: SecurityAuditLogsFetchOptions = {}) {
  const input = await fetchSecurityAuditLogsInput(options);
  return mapSecurityAuditLogsRuntimeToAdminFields(input);
}
