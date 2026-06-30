import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityRateLimitsSource = "security_rate_limits_runtime";

export type SecurityRateLimitScope = "global" | "ip" | "store" | "user";

export type SecurityRateLimitTargetType = "global" | "ip" | "route" | "store" | "user";

export type SecurityRateLimitSeverity = "critical" | "high" | "low" | "medium";

export type SecurityRateLimitStatus = "exceeded" | "monitoring" | "watching";

export type SecurityRateLimitsStatus = "empty" | "load_error" | "rate_limits_ready";

export type SecurityRateLimitRow = {
  action?: string | null;
  created_at?: string | null;
  id?: string | null;
  ip_address?: string | null;
  metadata?: unknown;
  reason?: string | null;
  route?: string | null;
  store_id?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

export type SecurityRateLimitRecord = {
  createdAt: string;
  currentUsage: number | null;
  exceededCount: number;
  ipAvailable: boolean;
  ipMasked: string;
  lastExceededAt: string;
  limitValue: number | null;
  recordKey: string;
  route: string | null;
  ruleId: string;
  ruleKey: string;
  safeSummary: string;
  scope: SecurityRateLimitScope;
  severity: SecurityRateLimitSeverity;
  sourceModule: "rate_limit";
  status: SecurityRateLimitStatus;
  storeId: string | null;
  targetIdentifier: string | null;
  targetType: SecurityRateLimitTargetType;
  timeWindowSeconds: number | null;
  updatedAt: string;
  userId: string | null;
};

export type SecurityRateLimitsPagination = {
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

export type SecurityRateLimitsFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityRateLimitsColumn = {
  key: string;
  label: string;
};

export type SecurityRateLimitsMetrics = {
  criticalRules: number;
  highRules: number;
  scannedEvents: number;
  totalExceededEvents: number;
  totalRules: number;
  watchingRules: number;
};

export type SecurityRateLimitsSummary = {
  loadError: string | null;
  metrics: SecurityRateLimitsMetrics;
  pagination: SecurityRateLimitsPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityRateLimitsSource;
  status: SecurityRateLimitsStatus;
  summary: string;
};

export type SecurityRateLimitsRuntimeInput = {
  loadError: string | null;
  logs: SecurityRateLimitRow[];
  page: number;
  pageSize: number;
};

export type SecurityRateLimitsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityRateLimitsSource;
};

export type SecurityRateLimitsFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_RATE_LIMITS_SOURCE = "security_rate_limits_runtime" as const;

export const SECURITY_RATE_LIMITS_TABLE = "security_audit_logs" as const;

export const SECURITY_RATE_LIMITS_REGISTRY_KEY = "sec-rate-limits" as const;

export const SECURITY_RATE_LIMITS_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_RATE_LIMITS_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_RATE_LIMITS_SCAN_LIMIT = 1000 as const;

export const SECURITY_RATE_LIMITS_EMPTY_STATE =
  "No rate-limit activity has been recorded yet. This runtime observes existing rate-limit audit signals only and never fabricates rate-limit rules or request activity.";

export const SECURITY_RATE_LIMITS_COLUMNS: readonly SecurityRateLimitsColumn[] = [
  { key: "ruleId", label: "Rule ID" },
  { key: "ruleKey", label: "Rule Key" },
  { key: "scope", label: "Scope" },
  { key: "targetType", label: "Target Type" },
  { key: "targetIdentifier", label: "Target Identifier" },
  { key: "route", label: "Route / Endpoint" },
  { key: "limitValue", label: "Limit" },
  { key: "timeWindowSeconds", label: "Time Window" },
  { key: "currentUsage", label: "Current Usage" },
  { key: "exceededCount", label: "Exceeded Count" },
  { key: "lastExceededAt", label: "Last Exceeded" },
  { key: "ipMasked", label: "IP Address" },
  { key: "userId", label: "Related User ID" },
  { key: "storeId", label: "Related Store ID" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "sourceModule", label: "Source Module" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" }
] as const;

export const SECURITY_RATE_LIMITS_FILTERS: readonly SecurityRateLimitsFilter[] = [
  {
    enabled: false,
    key: "scope",
    label: "Scope",
    note: "Read-only placeholder. Scope filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All scopes"
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
    note: "Read-only placeholder. Rate-limit search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search rate-limit rules"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityRateLimitRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityRateLimitRow[];
}

function dateValue(value: unknown): number {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function safeSummary(value: unknown): string {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return "No safe summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 180);
}

function metadataOf(row: SecurityRateLimitRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

export function isRateLimitRow(row: SecurityRateLimitRow): boolean {
  const action = text(row.action).toLowerCase();
  return action.includes("rate_limit") || action.includes("rate-limit");
}

function deriveRuleKey(row: SecurityRateLimitRow): string {
  const metadata = metadataOf(row);
  return text(metadata.action) || text(metadata.rule_key) || text(row.action, "rate_limit");
}

function deriveScope(row: SecurityRateLimitRow): SecurityRateLimitScope {
  if (text(row.user_id)) {
    return "user";
  }

  if (text(row.store_id)) {
    return "store";
  }

  if (text(row.ip_address)) {
    return "ip";
  }

  return "global";
}

function deriveTargetType(row: SecurityRateLimitRow): SecurityRateLimitTargetType {
  const metadata = metadataOf(row);
  const metadataTarget = text(metadata.target_type);

  if (metadataTarget === "route" || text(row.route)) {
    if (metadataTarget === "route") {
      return "route";
    }
  }

  const scope = deriveScope(row);
  return scope;
}

function severityRank(severity: SecurityRateLimitSeverity): number {
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

function deriveSeverity(exceededCount: number, metadataSeverity: string | null): SecurityRateLimitSeverity {
  const explicit = (metadataSeverity ?? "").toLowerCase();

  if (explicit === "critical" || explicit === "high" || explicit === "medium" || explicit === "low") {
    return explicit;
  }

  if (exceededCount >= 20) {
    return "critical";
  }

  if (exceededCount >= 10) {
    return "high";
  }

  if (exceededCount >= 3) {
    return "medium";
  }

  return "low";
}

function deriveStatus(severity: SecurityRateLimitSeverity): SecurityRateLimitStatus {
  if (severity === "critical" || severity === "high") {
    return "watching";
  }

  if (severity === "medium") {
    return "exceeded";
  }

  return "monitoring";
}

export function aggregateSecurityRateLimitRules(rows: SecurityRateLimitRow[]): SecurityRateLimitRecord[] {
  const groups = new Map<string, SecurityRateLimitRow[]>();

  for (const row of rows) {
    if (!isRateLimitRow(row)) {
      continue;
    }

    const ruleKey = deriveRuleKey(row);
    const targetKey = text(row.user_id) || text(row.store_id) || text(row.ip_address) || text(row.route) || "global";
    const groupKey = `${ruleKey}::${targetKey}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(groupKey, [row]);
    }
  }

  const records: SecurityRateLimitRecord[] = [];

  for (const [groupKey, groupRows] of groups) {
    const ordered = [...groupRows].sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const mostRecent = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const recentMetadata = metadataOf(mostRecent ?? {});
    const exceededCount = ordered.length;
    const metadataSeverity = text(recentMetadata.severity) || null;
    const severity = deriveSeverity(exceededCount, metadataSeverity);
    const ruleKey = deriveRuleKey(mostRecent ?? {});
    const ip = maskIp(ordered.map((row) => text(row.ip_address)).find(Boolean) ?? null);
    const ruleId = `rate-rule-${hashString(groupKey)}`;
    const scope = deriveScope(mostRecent ?? {});
    const targetIdentifier =
      text(mostRecent?.user_id) ||
      text(mostRecent?.store_id) ||
      (ip.available ? ip.masked : null) ||
      text(mostRecent?.route) ||
      null;

    records.push({
      createdAt: text(oldest?.created_at, new Date(0).toISOString()),
      currentUsage: numberOrNull(recentMetadata.count),
      exceededCount,
      ipAvailable: ip.available,
      ipMasked: ip.masked,
      lastExceededAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      limitValue: numberOrNull(recentMetadata.limit),
      recordKey: `security-rate-limit-record-${ruleId}`,
      route: text(mostRecent?.route) || null,
      ruleId,
      ruleKey,
      safeSummary: safeSummary(mostRecent?.reason),
      scope,
      severity,
      sourceModule: "rate_limit",
      status: deriveStatus(severity),
      storeId: ordered.map((row) => text(row.store_id)).find(Boolean) ?? null,
      targetIdentifier,
      targetType: deriveTargetType(mostRecent ?? {}),
      timeWindowSeconds: numberOrNull(recentMetadata.windowSeconds ?? recentMetadata.window_seconds),
      updatedAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      userId: ordered.map((row) => text(row.user_id)).find(Boolean) ?? null
    });
  }

  return records.sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return dateValue(right.lastExceededAt) - dateValue(left.lastExceededAt);
  });
}

export function securityRateLimitSeverityBadgeTone(severity: SecurityRateLimitSeverity) {
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

export function securityRateLimitStatusBadgeTone(status: SecurityRateLimitStatus) {
  switch (status) {
    case "watching":
      return "amber" as const;
    case "exceeded":
      return "red" as const;
    case "monitoring":
      return "green" as const;
  }
}

export function normalizeSecurityRateLimitsPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityRateLimitsPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_RATE_LIMITS_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_RATE_LIMITS_MAX_PAGE_SIZE);
}

export function buildSecurityRateLimitsPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityRateLimitsPagination {
  const normalizedPage = normalizeSecurityRateLimitsPage(page);
  const normalizedPageSize = normalizeSecurityRateLimitsPageSize(pageSize);
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

export function buildSecurityRateLimitsMetrics(
  records: SecurityRateLimitRecord[],
  scannedEvents: number
): SecurityRateLimitsMetrics {
  return {
    criticalRules: records.filter((record) => record.severity === "critical").length,
    highRules: records.filter((record) => record.severity === "high").length,
    scannedEvents,
    totalExceededEvents: records.reduce((total, record) => total + record.exceededCount, 0),
    totalRules: records.length,
    watchingRules: records.filter((record) => record.status === "watching").length
  };
}

function paginateRecords(
  records: SecurityRateLimitRecord[],
  page: number,
  pageSize: number
): SecurityRateLimitRecord[] {
  const normalizedPage = normalizeSecurityRateLimitsPage(page);
  const normalizedPageSize = normalizeSecurityRateLimitsPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityRateLimitsSummary(
  input: SecurityRateLimitsRuntimeInput,
  allRecords: SecurityRateLimitRecord[],
  pageRecords: SecurityRateLimitRecord[]
): SecurityRateLimitsSummary {
  const pagination = buildSecurityRateLimitsPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityRateLimitsMetrics(allRecords, input.logs.length);
  const status: SecurityRateLimitsStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "rate_limits_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_RATE_LIMITS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_RATE_LIMITS_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalRules} rate-limit rules`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.totalExceededEvents} exceeded events`,
          `${metrics.criticalRules} critical`,
          `${metrics.highRules} high`
        ].join("; ")
  };
}

export function buildSecurityRateLimitsLoadingState(): SecurityRateLimitsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security rate-limits runtime from existing rate-limit audit signals.",
    readOnly: true,
    source: SECURITY_RATE_LIMITS_SOURCE
  };
}

export function buildSecurityRateLimitsErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityRateLimitsRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityRateLimitsPage(page),
    pageSize: normalizeSecurityRateLimitsPageSize(pageSize)
  };
}

export function mapSecurityRateLimitsRuntimeToAdminFields(input: SecurityRateLimitsRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_RATE_LIMITS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityRateLimitsErrorInput(
      "Rate limits are not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_RATE_LIMITS_COLUMNS,
      emptyState: SECURITY_RATE_LIMITS_EMPTY_STATE,
      filters: SECURITY_RATE_LIMITS_FILTERS,
      rateLimitRules: [] as SecurityRateLimitRecord[],
      registry: null,
      summary: getSecurityRateLimitsSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityRateLimitRules(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityRateLimitsSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_RATE_LIMITS_COLUMNS,
    emptyState: SECURITY_RATE_LIMITS_EMPTY_STATE,
    filters: SECURITY_RATE_LIMITS_FILTERS,
    rateLimitRules: pageRecords,
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

export async function fetchSecurityRateLimitsInput(
  options: SecurityRateLimitsFetchOptions = {}
): Promise<SecurityRateLimitsRuntimeInput> {
  const page = normalizeSecurityRateLimitsPage(options.page);
  const pageSize = normalizeSecurityRateLimitsPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityRateLimitsErrorInput(
        "Service-role admin access is required to read rate-limit activity.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_RATE_LIMITS_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .like("action" as never, "rate_limit%" as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_RATE_LIMITS_SCAN_LIMIT);

    if (error) {
      return buildSecurityRateLimitsErrorInput(
        `Unable to load rate-limit activity: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data).filter(isRateLimitRow),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading rate-limit activity.";
    return buildSecurityRateLimitsErrorInput(`Unable to load rate-limit activity: ${message}`, page, pageSize);
  }
}

export async function loadSecurityRateLimitsReadOnlySafe(options: SecurityRateLimitsFetchOptions = {}) {
  const input = await fetchSecurityRateLimitsInput(options);
  return mapSecurityRateLimitsRuntimeToAdminFields(input);
}
