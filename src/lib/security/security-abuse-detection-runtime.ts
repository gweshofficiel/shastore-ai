import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { securityAuditActions } from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityAbuseDetectionSource = "security_abuse_detection_runtime";

export type SecurityAbuseSignalType =
  | "abuse_flag"
  | "access_denied"
  | "blocked"
  | "rate_limit"
  | "repeated_failure"
  | "suspicious_login"
  | "unauthorized";

export type SecurityAbuseSourceModule =
  | "abuse_reports"
  | "access_control"
  | "audit"
  | "login_monitoring"
  | "rate_limit";

export type SecurityAbuseSeverity = "critical" | "high" | "low" | "medium";

export type SecurityAbuseStatus = "blocked" | "monitoring" | "recorded" | "watching";

export type SecurityAbuseDetectionStatus = "abuse_detection_ready" | "empty" | "load_error";

export type SecurityAbuseRow = {
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

export type SecurityAbuseSignalRecord = {
  abuseSignalId: string;
  browserLabel: string;
  createdAt: string;
  deviceLabel: string;
  email: string | null;
  emailAvailable: boolean;
  eventCount: number;
  ipAvailable: boolean;
  ipMasked: string;
  lastDetectedAt: string;
  recordKey: string;
  riskLevel: string | null;
  safeSummary: string;
  severity: SecurityAbuseSeverity;
  signalType: SecurityAbuseSignalType;
  sourceModule: SecurityAbuseSourceModule;
  status: SecurityAbuseStatus;
  storeId: string | null;
  userAgentAvailable: boolean;
  userId: string | null;
};

export type SecurityAbuseDetectionPagination = {
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

export type SecurityAbuseDetectionFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityAbuseDetectionColumn = {
  key: string;
  label: string;
};

export type SecurityAbuseDetectionMetrics = {
  blockedSignals: number;
  criticalSignals: number;
  highSignals: number;
  scannedEvents: number;
  totalSignals: number;
  watchingSignals: number;
};

export type SecurityAbuseDetectionSummary = {
  loadError: string | null;
  metrics: SecurityAbuseDetectionMetrics;
  pagination: SecurityAbuseDetectionPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityAbuseDetectionSource;
  status: SecurityAbuseDetectionStatus;
  summary: string;
};

export type SecurityAbuseDetectionRuntimeInput = {
  loadError: string | null;
  logs: SecurityAbuseRow[];
  page: number;
  pageSize: number;
};

export type SecurityAbuseDetectionLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityAbuseDetectionSource;
};

export type SecurityAbuseDetectionFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_ABUSE_DETECTION_SOURCE = "security_abuse_detection_runtime" as const;

export const SECURITY_ABUSE_DETECTION_TABLE = "security_audit_logs" as const;

export const SECURITY_ABUSE_DETECTION_REGISTRY_KEY = "sec-abuse-detection" as const;

export const SECURITY_ABUSE_DETECTION_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_ABUSE_DETECTION_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_ABUSE_DETECTION_SCAN_LIMIT = 1000 as const;

export const SECURITY_ABUSE_DETECTION_EMPTY_STATE =
  "No abuse-related security signals have been recorded yet. This runtime observes existing audit, login, and rate-limit signals only and never fabricates abuse data.";

export const SECURITY_ABUSE_DETECTION_COLUMNS: readonly SecurityAbuseDetectionColumn[] = [
  { key: "abuseSignalId", label: "Abuse Signal ID" },
  { key: "signalType", label: "Signal Type" },
  { key: "userId", label: "Related User ID" },
  { key: "storeId", label: "Related Store ID" },
  { key: "email", label: "Email" },
  { key: "ipMasked", label: "IP Address" },
  { key: "deviceLabel", label: "Device / Browser" },
  { key: "sourceModule", label: "Source Module" },
  { key: "eventCount", label: "Event Count" },
  { key: "severity", label: "Severity" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "status", label: "Status" },
  { key: "lastDetectedAt", label: "Last Detected" },
  { key: "createdAt", label: "Created At" }
] as const;

export const SECURITY_ABUSE_DETECTION_FILTERS: readonly SecurityAbuseDetectionFilter[] = [
  {
    enabled: false,
    key: "signalType",
    label: "Signal Type",
    note: "Read-only placeholder. Abuse signal type filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All signal types"
  },
  {
    enabled: false,
    key: "severity",
    label: "Severity",
    note: "Read-only placeholder. Severity filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All severities"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Abuse signal search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search abuse signals"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityAbuseRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityAbuseRow[];
}

function dateValue(value: unknown): number {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
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

function hashString(raw: string): string {
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

function deriveRowEmail(row: SecurityAbuseRow): string | null {
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

function deriveRowRiskLevel(row: SecurityAbuseRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const riskLevel = text(metadata.risk_level) || text(metadata.riskLevel);
  return riskLevel || null;
}

export function classifyAbuseSignalType(row: SecurityAbuseRow): SecurityAbuseSignalType | null {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  if (action.includes("rate_limit") || reason.includes("rate limit")) {
    return "rate_limit";
  }

  if (action.includes("blocked")) {
    return "blocked";
  }

  if (action.includes("unauthorized")) {
    return "unauthorized";
  }

  if (action.includes("denied") || action.includes("access.denied")) {
    return "access_denied";
  }

  if (action === securityAuditActions.suspiciousLogin || action.includes("suspicious")) {
    return "suspicious_login";
  }

  if (reason.includes("abuse")) {
    return "abuse_flag";
  }

  if (action === securityAuditActions.loginFailed || (action.includes("login") && action.includes("failed"))) {
    return "repeated_failure";
  }

  return null;
}

export function isAbuseSignalRow(row: SecurityAbuseRow): boolean {
  return classifyAbuseSignalType(row) !== null;
}

function resolveSourceModule(signalType: SecurityAbuseSignalType): SecurityAbuseSourceModule {
  switch (signalType) {
    case "rate_limit":
      return "rate_limit";
    case "access_denied":
    case "unauthorized":
    case "blocked":
      return "access_control";
    case "suspicious_login":
    case "repeated_failure":
      return "login_monitoring";
    case "abuse_flag":
      return "abuse_reports";
  }
}

function severityRank(severity: SecurityAbuseSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function deriveRowSeverity(row: SecurityAbuseRow, signalType: SecurityAbuseSignalType): SecurityAbuseSeverity {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  if (action.includes("token") || reason.includes("token") || action.includes("fraud")) {
    return "critical";
  }

  if (signalType === "blocked" || signalType === "unauthorized" || signalType === "access_denied" || signalType === "rate_limit") {
    return "high";
  }

  if (signalType === "suspicious_login" || signalType === "repeated_failure") {
    return "medium";
  }

  return "low";
}

function deriveAbuseStatus(input: {
  signalType: SecurityAbuseSignalType;
  severity: SecurityAbuseSeverity;
}): SecurityAbuseStatus {
  if (input.signalType === "blocked" || input.signalType === "rate_limit" || input.signalType === "access_denied") {
    return "blocked";
  }

  if (input.severity === "critical" || input.severity === "high") {
    return "watching";
  }

  if (input.severity === "medium") {
    return "monitoring";
  }

  return "recorded";
}

export function aggregateSecurityAbuseSignals(rows: SecurityAbuseRow[]): SecurityAbuseSignalRecord[] {
  const groups = new Map<string, { rows: SecurityAbuseRow[]; signalType: SecurityAbuseSignalType }>();

  for (const row of rows) {
    const signalType = classifyAbuseSignalType(row);

    if (!signalType) {
      continue;
    }

    const actorKey = text(row.user_id) || text(row.ip_address) || text(row.store_id) || "global";
    const groupKey = `${signalType}::${actorKey}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(groupKey, { rows: [row], signalType });
    }
  }

  const records: SecurityAbuseSignalRecord[] = [];

  for (const [groupKey, group] of groups) {
    const ordered = [...group.rows].sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const mostRecent = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const severity = ordered
      .map((row) => deriveRowSeverity(row, group.signalType))
      .reduce<SecurityAbuseSeverity>(
        (highest, current) => (severityRank(current) > severityRank(highest) ? current : highest),
        "low"
      );
    const email = ordered.map((row) => deriveRowEmail(row)).find((value) => Boolean(value)) ?? null;
    const riskLevel = ordered.map((row) => deriveRowRiskLevel(row)).find((value) => Boolean(value)) ?? null;
    const rawUserAgent = ordered.map((row) => text(row.user_agent)).find(Boolean) ?? null;
    const { browserLabel, deviceLabel } = summarizeUserAgent(rawUserAgent);
    const ip = maskIp(ordered.map((row) => text(row.ip_address)).find(Boolean) ?? null);
    const abuseSignalId = `abuse-${hashString(groupKey)}`;
    const status = deriveAbuseStatus({ severity, signalType: group.signalType });

    records.push({
      abuseSignalId,
      browserLabel,
      createdAt: text(oldest?.created_at, new Date(0).toISOString()),
      deviceLabel,
      email,
      emailAvailable: Boolean(email),
      eventCount: ordered.length,
      ipAvailable: ip.available,
      ipMasked: ip.masked,
      lastDetectedAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      recordKey: `security-abuse-record-${abuseSignalId}`,
      riskLevel,
      safeSummary: safeSummary(mostRecent?.reason),
      severity,
      signalType: group.signalType,
      sourceModule: resolveSourceModule(group.signalType),
      status,
      storeId: ordered.map((row) => text(row.store_id)).find(Boolean) ?? null,
      userAgentAvailable: Boolean(rawUserAgent),
      userId: ordered.map((row) => text(row.user_id)).find(Boolean) ?? null
    });
  }

  return records.sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return dateValue(right.lastDetectedAt) - dateValue(left.lastDetectedAt);
  });
}

export function securityAbuseSeverityBadgeTone(severity: SecurityAbuseSeverity) {
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

export function securityAbuseStatusBadgeTone(status: SecurityAbuseStatus) {
  switch (status) {
    case "blocked":
      return "red" as const;
    case "watching":
      return "amber" as const;
    case "monitoring":
      return "blue" as const;
    case "recorded":
      return "green" as const;
  }
}

export function normalizeSecurityAbuseDetectionPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityAbuseDetectionPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_ABUSE_DETECTION_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_ABUSE_DETECTION_MAX_PAGE_SIZE);
}

export function buildSecurityAbuseDetectionPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityAbuseDetectionPagination {
  const normalizedPage = normalizeSecurityAbuseDetectionPage(page);
  const normalizedPageSize = normalizeSecurityAbuseDetectionPageSize(pageSize);
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

export function buildSecurityAbuseDetectionMetrics(
  records: SecurityAbuseSignalRecord[],
  scannedEvents: number
): SecurityAbuseDetectionMetrics {
  return {
    blockedSignals: records.filter((record) => record.status === "blocked").length,
    criticalSignals: records.filter((record) => record.severity === "critical").length,
    highSignals: records.filter((record) => record.severity === "high").length,
    scannedEvents,
    totalSignals: records.length,
    watchingSignals: records.filter((record) => record.status === "watching").length
  };
}

function paginateRecords(
  records: SecurityAbuseSignalRecord[],
  page: number,
  pageSize: number
): SecurityAbuseSignalRecord[] {
  const normalizedPage = normalizeSecurityAbuseDetectionPage(page);
  const normalizedPageSize = normalizeSecurityAbuseDetectionPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityAbuseDetectionSummary(
  input: SecurityAbuseDetectionRuntimeInput,
  allRecords: SecurityAbuseSignalRecord[],
  pageRecords: SecurityAbuseSignalRecord[]
): SecurityAbuseDetectionSummary {
  const pagination = buildSecurityAbuseDetectionPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityAbuseDetectionMetrics(allRecords, input.logs.length);
  const status: SecurityAbuseDetectionStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "abuse_detection_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_ABUSE_DETECTION_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_ABUSE_DETECTION_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalSignals} abuse signals`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.scannedEvents} events scanned`,
          `${metrics.criticalSignals} critical`,
          `${metrics.highSignals} high`,
          `${metrics.blockedSignals} blocked`
        ].join("; ")
  };
}

export function buildSecurityAbuseDetectionLoadingState(): SecurityAbuseDetectionLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security abuse detection runtime from existing abuse-related signals.",
    readOnly: true,
    source: SECURITY_ABUSE_DETECTION_SOURCE
  };
}

export function buildSecurityAbuseDetectionErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityAbuseDetectionRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityAbuseDetectionPage(page),
    pageSize: normalizeSecurityAbuseDetectionPageSize(pageSize)
  };
}

export function mapSecurityAbuseDetectionRuntimeToAdminFields(input: SecurityAbuseDetectionRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_ABUSE_DETECTION_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityAbuseDetectionErrorInput(
      "Abuse detection is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      abuseSignals: [] as SecurityAbuseSignalRecord[],
      columns: SECURITY_ABUSE_DETECTION_COLUMNS,
      emptyState: SECURITY_ABUSE_DETECTION_EMPTY_STATE,
      filters: SECURITY_ABUSE_DETECTION_FILTERS,
      registry: null,
      summary: getSecurityAbuseDetectionSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityAbuseSignals(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityAbuseDetectionSummary(input, allRecords, pageRecords);

  return {
    abuseSignals: pageRecords,
    columns: SECURITY_ABUSE_DETECTION_COLUMNS,
    emptyState: SECURITY_ABUSE_DETECTION_EMPTY_STATE,
    filters: SECURITY_ABUSE_DETECTION_FILTERS,
    registry: {
      auditEnabled: registryEntry.auditEnabled,
      description: registryEntry.description,
      displayName: registryEntry.displayName,
      implementationStatus: registryEntry.implementationStatus,
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

export async function fetchSecurityAbuseDetectionInput(
  options: SecurityAbuseDetectionFetchOptions = {}
): Promise<SecurityAbuseDetectionRuntimeInput> {
  const page = normalizeSecurityAbuseDetectionPage(options.page);
  const pageSize = normalizeSecurityAbuseDetectionPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityAbuseDetectionErrorInput(
        "Service-role admin access is required to read abuse detection signals.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_ABUSE_DETECTION_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_ABUSE_DETECTION_SCAN_LIMIT);

    if (error) {
      return buildSecurityAbuseDetectionErrorInput(
        `Unable to load abuse detection signals: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data).filter(isAbuseSignalRow),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading abuse detection signals.";
    return buildSecurityAbuseDetectionErrorInput(`Unable to load abuse detection signals: ${message}`, page, pageSize);
  }
}

export async function loadSecurityAbuseDetectionReadOnlySafe(
  options: SecurityAbuseDetectionFetchOptions = {}
) {
  const input = await fetchSecurityAbuseDetectionInput(options);
  return mapSecurityAbuseDetectionRuntimeToAdminFields(input);
}
