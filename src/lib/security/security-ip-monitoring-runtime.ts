import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { securityAuditActions } from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityIpMonitoringSource = "security_ip_monitoring_runtime";

export type SecurityIpStatus = "blocked" | "monitoring" | "unknown" | "watching";

export type SecurityIpMonitoringStatus = "empty" | "ip_monitoring_ready" | "load_error";

export type SecurityIpRow = {
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

export type SecurityIpRecord = {
  browserLabel: string;
  country: string | null;
  deviceLabel: string;
  email: string | null;
  emailAvailable: boolean;
  eventCount: number;
  failedLoginCount: number;
  firstActivityAt: string;
  ipGroupKey: string;
  ipMasked: string;
  lastActivityAt: string;
  recordKey: string;
  relatedUserCount: number;
  riskLevel: string | null;
  status: SecurityIpStatus;
  successfulLoginCount: number;
  userAgentAvailable: boolean;
  userAgentSummary: string | null;
  userId: string | null;
};

export type SecurityIpMonitoringPagination = {
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

export type SecurityIpMonitoringFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityIpMonitoringColumn = {
  key: string;
  label: string;
};

export type SecurityIpMonitoringMetrics = {
  blockedIps: number;
  scannedEvents: number;
  totalFailedLogins: number;
  totalIps: number;
  totalSuccessfulLogins: number;
  watchingIps: number;
};

export type SecurityIpMonitoringSummary = {
  loadError: string | null;
  metrics: SecurityIpMonitoringMetrics;
  pagination: SecurityIpMonitoringPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityIpMonitoringSource;
  status: SecurityIpMonitoringStatus;
  summary: string;
};

export type SecurityIpMonitoringRuntimeInput = {
  loadError: string | null;
  logs: SecurityIpRow[];
  page: number;
  pageSize: number;
};

export type SecurityIpMonitoringLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityIpMonitoringSource;
};

export type SecurityIpMonitoringFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_IP_MONITORING_SOURCE = "security_ip_monitoring_runtime" as const;

export const SECURITY_IP_MONITORING_TABLE = "security_audit_logs" as const;

export const SECURITY_IP_MONITORING_REGISTRY_KEY = "sec-ip-monitoring" as const;

export const SECURITY_IP_MONITORING_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_IP_MONITORING_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_IP_MONITORING_SCAN_LIMIT = 1000 as const;

export const SECURITY_IP_MONITORING_EMPTY_STATE =
  "No IP-related security activity has been recorded yet. This runtime aggregates existing audit records by IP only and never fabricates IP activity.";

export const SECURITY_IP_MONITORING_COLUMNS: readonly SecurityIpMonitoringColumn[] = [
  { key: "ipMasked", label: "IP Address" },
  { key: "userId", label: "Related User ID" },
  { key: "email", label: "Email" },
  { key: "eventCount", label: "Event Count" },
  { key: "failedLoginCount", label: "Failed Logins" },
  { key: "successfulLoginCount", label: "Successful Logins" },
  { key: "lastActivityAt", label: "Last Activity" },
  { key: "country", label: "Country / Location" },
  { key: "userAgentSummary", label: "User Agent Summary" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "status", label: "Status" }
] as const;

export const SECURITY_IP_MONITORING_FILTERS: readonly SecurityIpMonitoringFilter[] = [
  {
    enabled: false,
    key: "status",
    label: "Status",
    note: "Read-only placeholder. IP status filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All statuses"
  },
  {
    enabled: false,
    key: "risk",
    label: "Risk Level",
    note: "Read-only placeholder. Risk filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All risk levels"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. IP search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search IP activity"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityIpRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityIpRow[];
}

function dateValue(value: unknown): number {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function maskIpAddress(raw: string): string {
  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:****`;
  }

  const parts = raw.split(".");

  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return "[masked-ip]";
}

function hashIp(raw: string): string {
  let hash = 5381;

  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 33) ^ raw.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function maskEmail(value: unknown): string | null {
  const raw = text(value).trim().toLowerCase();

  if (!raw || !raw.includes("@")) {
    return null;
  }

  const [localPart = "", domain = ""] = raw.split("@");

  if (!domain) {
    return null;
  }

  const visible = localPart.slice(0, 1);
  return `${visible || "*"}***@${domain}`;
}

function safeText(value: unknown): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 120);
}

function deriveRowEmail(row: SecurityIpRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const masked = maskEmail(metadata.email);

  if (masked) {
    return masked;
  }

  const domain = text(metadata.emailDomain);

  if (domain) {
    return `***@${domain}`;
  }

  return null;
}

function deriveRowCountry(row: SecurityIpRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return (
    safeText(metadata.country) ||
    safeText(metadata.location) ||
    safeText(metadata.geo) ||
    safeText(metadata.city)
  );
}

function deriveRowRiskLevel(row: SecurityIpRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const riskLevel = text(metadata.risk_level) || text(metadata.riskLevel);
  return riskLevel || null;
}

function isFailedLogin(row: SecurityIpRow): boolean {
  const action = text(row.action);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return action === securityAuditActions.loginFailed || text(metadata.loginOutcome).toLowerCase() === "failed";
}

function isSuccessfulLogin(row: SecurityIpRow): boolean {
  const action = text(row.action);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return action === securityAuditActions.loginSuccess || text(metadata.loginOutcome).toLowerCase() === "success";
}

function isBlockingSignal(row: SecurityIpRow): boolean {
  const action = text(row.action).toLowerCase();
  return action.includes("denied") || action.includes("rate_limit") || action.includes("blocked");
}

function deriveIpStatus(input: {
  blockingSignals: number;
  failedLoginCount: number;
  riskLevel: string | null;
  successfulLoginCount: number;
}): SecurityIpStatus {
  if (input.blockingSignals > 0) {
    return "blocked";
  }

  const riskLevel = (input.riskLevel ?? "").toLowerCase();

  if (riskLevel === "high" || riskLevel === "critical") {
    return "watching";
  }

  if (input.failedLoginCount > 0 && input.successfulLoginCount === 0) {
    return "watching";
  }

  if (input.failedLoginCount > 0 || input.successfulLoginCount > 0) {
    return "monitoring";
  }

  return "monitoring";
}

export function aggregateSecurityIpRecords(rows: SecurityIpRow[]): SecurityIpRecord[] {
  const groups = new Map<string, SecurityIpRow[]>();

  for (const row of rows) {
    const rawIp = text(row.ip_address);

    if (!rawIp) {
      continue;
    }

    const existing = groups.get(rawIp);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(rawIp, [row]);
    }
  }

  const records: SecurityIpRecord[] = [];

  for (const [rawIp, groupRows] of groups) {
    const ordered = [...groupRows].sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const mostRecent = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const failedLoginCount = ordered.filter(isFailedLogin).length;
    const successfulLoginCount = ordered.filter(isSuccessfulLogin).length;
    const blockingSignals = ordered.filter(isBlockingSignal).length;
    const relatedUsers = new Set(ordered.map((row) => text(row.user_id)).filter(Boolean));
    const recentUserId = ordered.map((row) => text(row.user_id)).find(Boolean) ?? null;
    const email = ordered.map((row) => deriveRowEmail(row)).find((value) => Boolean(value)) ?? null;
    const country = ordered.map((row) => deriveRowCountry(row)).find((value) => Boolean(value)) ?? null;
    const riskLevel = ordered.map((row) => deriveRowRiskLevel(row)).find((value) => Boolean(value)) ?? null;
    const recentUserAgent = ordered.map((row) => text(row.user_agent)).find(Boolean) ?? null;
    const { browserLabel, deviceLabel } = summarizeUserAgent(recentUserAgent);
    const userAgentSummary = recentUserAgent ? `${browserLabel} · ${deviceLabel}` : null;
    const ipGroupKey = `ip-${hashIp(rawIp)}`;
    const status = deriveIpStatus({ blockingSignals, failedLoginCount, riskLevel, successfulLoginCount });

    records.push({
      browserLabel,
      country,
      deviceLabel,
      email,
      emailAvailable: Boolean(email),
      eventCount: ordered.length,
      failedLoginCount,
      firstActivityAt: text(oldest?.created_at, new Date(0).toISOString()),
      ipGroupKey,
      ipMasked: maskIpAddress(rawIp),
      lastActivityAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      recordKey: `security-ip-record-${ipGroupKey}`,
      relatedUserCount: relatedUsers.size,
      riskLevel,
      status,
      successfulLoginCount,
      userAgentAvailable: Boolean(recentUserAgent),
      userAgentSummary,
      userId: recentUserId
    });
  }

  return records.sort((left, right) => dateValue(right.lastActivityAt) - dateValue(left.lastActivityAt));
}

export function securityIpStatusBadgeTone(status: SecurityIpStatus) {
  switch (status) {
    case "blocked":
      return "red" as const;
    case "watching":
      return "amber" as const;
    case "monitoring":
      return "green" as const;
    case "unknown":
      return "slate" as const;
  }
}

export function normalizeSecurityIpMonitoringPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityIpMonitoringPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_IP_MONITORING_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_IP_MONITORING_MAX_PAGE_SIZE);
}

export function buildSecurityIpMonitoringPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityIpMonitoringPagination {
  const normalizedPage = normalizeSecurityIpMonitoringPage(page);
  const normalizedPageSize = normalizeSecurityIpMonitoringPageSize(pageSize);
  const pageCount = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / normalizedPageSize)) : 1;
  const rangeStart = returnedCount > 0 ? (normalizedPage - 1) * normalizedPageSize + 1 : 0;
  const rangeEnd = returnedCount > 0 ? rangeStart + returnedCount - 1 : 0;

  return {
    hasNext: normalizedPage < pageCount,
    hasPrevious: normalizedPage > 1,
    page: normalizedPage,
    pageCount,
    pageSize: normalizedPageSize,
    rangeEnd,
    rangeStart,
    returnedCount,
    totalCount
  };
}

export function buildSecurityIpMonitoringMetrics(
  records: SecurityIpRecord[],
  scannedEvents: number
): SecurityIpMonitoringMetrics {
  return {
    blockedIps: records.filter((record) => record.status === "blocked").length,
    scannedEvents,
    totalFailedLogins: records.reduce((total, record) => total + record.failedLoginCount, 0),
    totalIps: records.length,
    totalSuccessfulLogins: records.reduce((total, record) => total + record.successfulLoginCount, 0),
    watchingIps: records.filter((record) => record.status === "watching").length
  };
}

function paginateRecords(records: SecurityIpRecord[], page: number, pageSize: number): SecurityIpRecord[] {
  const normalizedPage = normalizeSecurityIpMonitoringPage(page);
  const normalizedPageSize = normalizeSecurityIpMonitoringPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityIpMonitoringSummary(
  input: SecurityIpMonitoringRuntimeInput,
  allRecords: SecurityIpRecord[],
  pageRecords: SecurityIpRecord[]
): SecurityIpMonitoringSummary {
  const pagination = buildSecurityIpMonitoringPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityIpMonitoringMetrics(allRecords, input.logs.length);
  const status: SecurityIpMonitoringStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "ip_monitoring_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_IP_MONITORING_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_IP_MONITORING_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalIps} distinct IPs`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.scannedEvents} events scanned`,
          `${metrics.blockedIps} blocked`,
          `${metrics.watchingIps} watching`
        ].join("; ")
  };
}

export function buildSecurityIpMonitoringLoadingState(): SecurityIpMonitoringLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security IP monitoring runtime from existing IP audit activity.",
    readOnly: true,
    source: SECURITY_IP_MONITORING_SOURCE
  };
}

export function buildSecurityIpMonitoringErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityIpMonitoringRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityIpMonitoringPage(page),
    pageSize: normalizeSecurityIpMonitoringPageSize(pageSize)
  };
}

export function mapSecurityIpMonitoringRuntimeToAdminFields(input: SecurityIpMonitoringRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_IP_MONITORING_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityIpMonitoringErrorInput(
      "IP monitoring is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_IP_MONITORING_COLUMNS,
      emptyState: SECURITY_IP_MONITORING_EMPTY_STATE,
      filters: SECURITY_IP_MONITORING_FILTERS,
      ipActivity: [] as SecurityIpRecord[],
      registry: null,
      summary: getSecurityIpMonitoringSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityIpRecords(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityIpMonitoringSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_IP_MONITORING_COLUMNS,
    emptyState: SECURITY_IP_MONITORING_EMPTY_STATE,
    filters: SECURITY_IP_MONITORING_FILTERS,
    ipActivity: pageRecords,
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

export async function fetchSecurityIpMonitoringInput(
  options: SecurityIpMonitoringFetchOptions = {}
): Promise<SecurityIpMonitoringRuntimeInput> {
  const page = normalizeSecurityIpMonitoringPage(options.page);
  const pageSize = normalizeSecurityIpMonitoringPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityIpMonitoringErrorInput(
        "Service-role admin access is required to read IP monitoring activity.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_IP_MONITORING_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .not("ip_address" as never, "is" as never, null as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_IP_MONITORING_SCAN_LIMIT);

    if (error) {
      return buildSecurityIpMonitoringErrorInput(
        `Unable to load IP monitoring activity: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading IP monitoring activity.";
    return buildSecurityIpMonitoringErrorInput(`Unable to load IP monitoring activity: ${message}`, page, pageSize);
  }
}

export async function loadSecurityIpMonitoringReadOnlySafe(options: SecurityIpMonitoringFetchOptions = {}) {
  const input = await fetchSecurityIpMonitoringInput(options);
  return mapSecurityIpMonitoringRuntimeToAdminFields(input);
}
