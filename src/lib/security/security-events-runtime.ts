import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityEventsSource = "security_events_runtime";

export type SecurityEventSeverity = "critical" | "high" | "low" | "medium";

export type SecurityEventStatus = "blocked" | "failed" | "recorded" | "reviewed" | "watching";

export type SecurityEventsRuntimeStatus = "empty" | "load_error" | "security_events_ready";

export type SecurityEventRow = {
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

export type SecurityEventRecord = {
  actor: string | null;
  createdAt: string;
  description: string | null;
  deviceLabel: string | null;
  eventId: string;
  eventType: string;
  ipAvailable: boolean;
  ipMasked: string;
  orderId: string | null;
  recordKey: string;
  riskLevel: string | null;
  severity: SecurityEventSeverity;
  sourceModule: string;
  status: SecurityEventStatus;
  storeId: string | null;
  title: string;
  updatedAt: string | null;
  userId: string | null;
};

export type SecurityEventsPagination = {
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

export type SecurityEventsFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityEventsColumn = {
  key: string;
  label: string;
};

export type SecurityEventsMetrics = {
  blockedEvents: number;
  criticalEvents: number;
  highEvents: number;
  returnedEvents: number;
  totalEvents: number;
  watchingEvents: number;
};

export type SecurityEventsSummary = {
  loadError: string | null;
  metrics: SecurityEventsMetrics;
  pagination: SecurityEventsPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityEventsSource;
  status: SecurityEventsRuntimeStatus;
  summary: string;
};

export type SecurityEventsRuntimeInput = {
  loadError: string | null;
  logs: SecurityEventRow[];
  page: number;
  pageSize: number;
  reviewedEventIds?: string[];
  totalCount: number | null;
};

export type SecurityEventsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityEventsSource;
};

export type SecurityEventsFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_EVENTS_SOURCE = "security_events_runtime" as const;

export const SECURITY_EVENTS_TABLE = "security_audit_logs" as const;

export const SECURITY_EVENTS_REGISTRY_KEY = "sec-security-events" as const;

export const SECURITY_EVENTS_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_EVENTS_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_EVENTS_EMPTY_STATE =
  "No security events have been recorded yet. This runtime displays existing security event records only and never fabricates, generates, or simulates events.";

export const SECURITY_EVENTS_COLUMNS: readonly SecurityEventsColumn[] = [
  { key: "eventId", label: "Event ID" },
  { key: "eventType", label: "Event Type" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "severity", label: "Severity" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "status", label: "Status" },
  { key: "sourceModule", label: "Source Module" },
  { key: "userId", label: "Related User ID" },
  { key: "storeId", label: "Related Store ID" },
  { key: "orderId", label: "Related Order ID" },
  { key: "ipMasked", label: "IP Address" },
  { key: "deviceLabel", label: "Device / Browser" },
  { key: "actor", label: "Actor" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" }
] as const;

export const SECURITY_EVENTS_FILTERS: readonly SecurityEventsFilter[] = [
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
    key: "sourceModule",
    label: "Source Module",
    note: "Read-only placeholder. Source module filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All modules"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Security event search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search security events"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityEventRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityEventRow[];
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

function safeText(value: unknown, max = 180): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, max);
}

function metadataOf(row: SecurityEventRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function titleCase(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveSeverity(row: SecurityEventRow): SecurityEventSeverity {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  if (action.includes("token") || reason.includes("token") || action.includes("fraud") || action.includes("chargeback")) {
    return "critical";
  }

  if (
    action.includes("denied") ||
    action.includes("unauthorized") ||
    action.includes("rate_limit") ||
    action.includes("blocked") ||
    reason.includes("abuse")
  ) {
    return "high";
  }

  if (action.includes("login") && (action.includes("failed") || reason.includes("failed"))) {
    return "medium";
  }

  if (action.includes("suspicious")) {
    return "medium";
  }

  return "low";
}

function deriveStatus(
  row: SecurityEventRow,
  severity: SecurityEventSeverity,
  reviewedIds: Set<string>
): SecurityEventStatus {
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

function deriveSourceModule(row: SecurityEventRow): string {
  const metadata = metadataOf(row);
  const explicit = text(metadata.source_module) || text(metadata.source);

  if (explicit) {
    return explicit;
  }

  const action = text(row.action).toLowerCase();

  if (action.includes("rate_limit")) {
    return "rate_limit";
  }

  if (action.includes("fraud") || action.includes("chargeback") || action.includes("dispute")) {
    return "fraud_detection";
  }

  if (action.includes("denied") || action.includes("unauthorized") || action.includes("blocked")) {
    return "access_control";
  }

  if (action.includes("login") || action.includes("password") || action.includes("session")) {
    return "login_monitoring";
  }

  if (action.includes("abuse") || action.includes("suspicious")) {
    return "abuse_detection";
  }

  return "security_audit";
}

function deriveActor(row: SecurityEventRow): string | null {
  const metadata = metadataOf(row);
  const metadataActor = safeText(metadata.actor ?? metadata.actor_email, 120);

  if (metadataActor) {
    return metadataActor;
  }

  return text(row.user_id) || null;
}

function deriveRiskLevel(row: SecurityEventRow): string | null {
  const metadata = metadataOf(row);
  return text(metadata.risk_level) || text(metadata.riskLevel) || null;
}

function deriveOrderId(row: SecurityEventRow): string | null {
  const metadata = metadataOf(row);
  return text(metadata.order_id) || text(metadata.orderId) || null;
}

export function mapSecurityEventRowToRecord(
  row: SecurityEventRow,
  reviewedIds: Set<string>,
  index: number
): SecurityEventRecord {
  const severity = deriveSeverity(row);
  const status = deriveStatus(row, severity, reviewedIds);
  const ip = maskIp(row.ip_address);
  const rawUserAgent = text(row.user_agent) || null;
  const { browserLabel, deviceLabel } = summarizeUserAgent(rawUserAgent);
  const eventType = text(row.action, "security.event");
  const metadata = metadataOf(row);
  const eventId = text(row.id) || `security-event:${text(row.created_at)}:${index}`;
  const updatedAt = text(metadata.updated_at) || text(metadata.updatedAt) || null;

  return {
    actor: deriveActor(row),
    createdAt: text(row.created_at, new Date(0).toISOString()),
    description: safeText(row.reason),
    deviceLabel: rawUserAgent ? `${browserLabel} · ${deviceLabel}` : null,
    eventId,
    eventType,
    ipAvailable: ip.available,
    ipMasked: ip.masked,
    orderId: deriveOrderId(row),
    recordKey: `security-event-record-${eventId}`,
    riskLevel: deriveRiskLevel(row),
    severity,
    sourceModule: deriveSourceModule(row),
    status,
    storeId: text(row.store_id) || null,
    title: safeText(metadata.title, 120) || titleCase(eventType),
    updatedAt,
    userId: text(row.user_id) || null
  };
}

export function securityEventSeverityBadgeTone(severity: SecurityEventSeverity) {
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

export function securityEventStatusBadgeTone(status: SecurityEventStatus) {
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

export function normalizeSecurityEventsPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityEventsPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_EVENTS_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_EVENTS_MAX_PAGE_SIZE);
}

export function buildSecurityEventsPagination(
  input: SecurityEventsRuntimeInput,
  returnedCount: number
): SecurityEventsPagination {
  const page = normalizeSecurityEventsPage(input.page);
  const pageSize = normalizeSecurityEventsPageSize(input.pageSize);
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

export function buildSecurityEventsMetrics(
  records: SecurityEventRecord[],
  pagination: SecurityEventsPagination
): SecurityEventsMetrics {
  return {
    blockedEvents: records.filter((record) => record.status === "blocked").length,
    criticalEvents: records.filter((record) => record.severity === "critical").length,
    highEvents: records.filter((record) => record.severity === "high").length,
    returnedEvents: records.length,
    totalEvents: pagination.totalCount,
    watchingEvents: records.filter((record) => record.status === "watching").length
  };
}

export function getSecurityEventsSummary(
  input: SecurityEventsRuntimeInput,
  records: SecurityEventRecord[]
): SecurityEventsSummary {
  const pagination = buildSecurityEventsPagination(input, records.length);
  const metrics = buildSecurityEventsMetrics(records, pagination);
  const status: SecurityEventsRuntimeStatus = input.loadError
    ? "load_error"
    : records.length === 0
      ? "empty"
      : "security_events_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_EVENTS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_EVENTS_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${pagination.totalCount} total security events`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.criticalEvents} critical`,
          `${metrics.highEvents} high`,
          `${metrics.blockedEvents} blocked`
        ].join("; ")
  };
}

export function buildSecurityEventsLoadingState(): SecurityEventsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security events runtime from existing security event records.",
    readOnly: true,
    source: SECURITY_EVENTS_SOURCE
  };
}

export function buildSecurityEventsErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityEventsRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityEventsPage(page),
    pageSize: normalizeSecurityEventsPageSize(pageSize),
    reviewedEventIds: [],
    totalCount: 0
  };
}

export function mapSecurityEventsRuntimeToAdminFields(input: SecurityEventsRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_EVENTS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityEventsErrorInput(
      "Security events are not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_EVENTS_COLUMNS,
      emptyState: SECURITY_EVENTS_EMPTY_STATE,
      filters: SECURITY_EVENTS_FILTERS,
      registry: null,
      securityEvents: [] as SecurityEventRecord[],
      summary: getSecurityEventsSummary(safeInput, [])
    };
  }

  const reviewedIds = new Set((input.reviewedEventIds ?? []).filter(Boolean));
  const records = input.loadError
    ? []
    : input.logs.map((row, index) => mapSecurityEventRowToRecord(row, reviewedIds, index));
  const summary = getSecurityEventsSummary(input, records);

  return {
    columns: SECURITY_EVENTS_COLUMNS,
    emptyState: SECURITY_EVENTS_EMPTY_STATE,
    filters: SECURITY_EVENTS_FILTERS,
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
    securityEvents: records,
    summary
  };
}

export async function fetchSecurityEventsInput(
  options: SecurityEventsFetchOptions = {}
): Promise<SecurityEventsRuntimeInput> {
  const page = normalizeSecurityEventsPage(options.page);
  const pageSize = normalizeSecurityEventsPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityEventsErrorInput(
        "Service-role admin access is required to read security events.",
        page,
        pageSize
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { count, data, error } = await admin
      .from(SECURITY_EVENTS_TABLE as never)
      .select(
        "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at" as never, { ascending: false } as never)
      .range(from, to);

    if (error) {
      return buildSecurityEventsErrorInput(`Unable to load security events: ${error.message}`, page, pageSize);
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
    const message = caught instanceof Error ? caught.message : "Unknown error loading security events.";
    return buildSecurityEventsErrorInput(`Unable to load security events: ${message}`, page, pageSize);
  }
}

export async function loadSecurityEventsReadOnlySafe(options: SecurityEventsFetchOptions = {}) {
  const input = await fetchSecurityEventsInput(options);
  return mapSecurityEventsRuntimeToAdminFields(input);
}
