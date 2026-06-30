import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { securityAuditActions } from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityLoginMonitoringSource = "security_login_monitoring_runtime";

export type SecurityLoginStatus =
  | "failed"
  | "force_logout"
  | "password_reset"
  | "session_revoked"
  | "success"
  | "suspicious"
  | "unknown";

export type SecurityLoginMonitoringStatus = "empty" | "load_error" | "login_monitoring_ready";

export type SecurityLoginRow = {
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

export type SecurityLoginRecord = {
  action: string;
  browserLabel: string;
  country: string | null;
  createdAt: string;
  deviceLabel: string;
  email: string | null;
  emailAvailable: boolean;
  ipAvailable: boolean;
  ipMasked: string;
  loginEventId: string;
  provider: string | null;
  recordKey: string;
  riskLevel: string | null;
  role: string | null;
  route: string | null;
  safeSummary: string;
  status: SecurityLoginStatus;
  userAgent: string | null;
  userAgentAvailable: boolean;
  userId: string | null;
};

export type SecurityLoginMonitoringPagination = {
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

export type SecurityLoginMonitoringFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityLoginMonitoringColumn = {
  key: string;
  label: string;
};

export type SecurityLoginMonitoringMetrics = {
  failedLogins: number;
  passwordResets: number;
  returnedEvents: number;
  sessionEvents: number;
  successfulLogins: number;
  suspiciousLogins: number;
};

export type SecurityLoginMonitoringSummary = {
  loadError: string | null;
  metrics: SecurityLoginMonitoringMetrics;
  pagination: SecurityLoginMonitoringPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityLoginMonitoringSource;
  status: SecurityLoginMonitoringStatus;
  summary: string;
};

export type SecurityLoginMonitoringRuntimeInput = {
  loadError: string | null;
  logs: SecurityLoginRow[];
  page: number;
  pageSize: number;
  totalCount: number | null;
};

export type SecurityLoginMonitoringLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityLoginMonitoringSource;
};

export type SecurityLoginMonitoringFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_LOGIN_MONITORING_SOURCE = "security_login_monitoring_runtime" as const;

export const SECURITY_LOGIN_MONITORING_TABLE = "security_audit_logs" as const;

export const SECURITY_LOGIN_MONITORING_REGISTRY_KEY = "sec-login-monitoring" as const;

export const SECURITY_LOGIN_MONITORING_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_LOGIN_MONITORING_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_LOGIN_MONITORING_EMPTY_STATE =
  "No login or authentication activity has been recorded yet. This runtime observes existing login audit records only and never fabricates login events.";

export const SECURITY_LOGIN_MONITORING_ACTIONS: readonly string[] = [
  securityAuditActions.loginSuccess,
  securityAuditActions.loginFailed,
  securityAuditActions.suspiciousLogin,
  securityAuditActions.passwordResetRequested,
  securityAuditActions.sessionRevoked,
  securityAuditActions.forceLogoutAll
] as const;

export const SECURITY_LOGIN_MONITORING_COLUMNS: readonly SecurityLoginMonitoringColumn[] = [
  { key: "loginEventId", label: "Login Event ID" },
  { key: "userId", label: "User ID" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "provider", label: "Provider" },
  { key: "ipMasked", label: "IP Address" },
  { key: "userAgent", label: "User Agent" },
  { key: "deviceLabel", label: "Device / Browser" },
  { key: "country", label: "Country / Location" },
  { key: "status", label: "Status" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "createdAt", label: "Created At" }
] as const;

export const SECURITY_LOGIN_MONITORING_FILTERS: readonly SecurityLoginMonitoringFilter[] = [
  {
    enabled: false,
    key: "status",
    label: "Status",
    note: "Read-only placeholder. Login status filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All statuses"
  },
  {
    enabled: false,
    key: "provider",
    label: "Provider",
    note: "Read-only placeholder. Provider filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All providers"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Login search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search login activity"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityLoginRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityLoginRow[];
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

function safeUserAgent(value: unknown): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, 240) : null;
}

function deriveStatus(row: SecurityLoginRow): SecurityLoginStatus {
  const action = text(row.action);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const outcome = text(metadata.loginOutcome).toLowerCase();

  switch (action) {
    case securityAuditActions.loginSuccess:
      return "success";
    case securityAuditActions.loginFailed:
      return "failed";
    case securityAuditActions.suspiciousLogin:
      return "suspicious";
    case securityAuditActions.passwordResetRequested:
      return "password_reset";
    case securityAuditActions.sessionRevoked:
      return "session_revoked";
    case securityAuditActions.forceLogoutAll:
      return "force_logout";
    default:
      break;
  }

  if (outcome === "success") {
    return "success";
  }

  if (outcome === "failed") {
    return "failed";
  }

  return "unknown";
}

function deriveEmail(row: SecurityLoginRow): string | null {
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

function deriveRole(row: SecurityLoginRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const role = text(metadata.actor_role) || text(metadata.role);
  return role || null;
}

function deriveProvider(row: SecurityLoginRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const provider =
    text(metadata.provider) || text(metadata.auth_provider) || text(metadata.loginProvider);
  return provider || null;
}

function deriveCountry(row: SecurityLoginRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const country =
    text(metadata.country) ||
    text(metadata.location) ||
    text(metadata.geo) ||
    text(metadata.city);
  return country ? safeSummary(country) : null;
}

function deriveRiskLevel(row: SecurityLoginRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const riskLevel = text(metadata.risk_level) || text(metadata.riskLevel);
  return riskLevel || null;
}

export function mapSecurityLoginRowToRecord(row: SecurityLoginRow, index: number): SecurityLoginRecord {
  const status = deriveStatus(row);
  const ip = maskIp(row.ip_address);
  const userAgent = safeUserAgent(row.user_agent);
  const { browserLabel, deviceLabel } = summarizeUserAgent(text(row.user_agent) || null);
  const email = deriveEmail(row);
  const loginEventId = text(row.id) || `security-login:${text(row.created_at)}:${index}`;

  return {
    action: text(row.action, "security.login.event"),
    browserLabel,
    country: deriveCountry(row),
    createdAt: text(row.created_at, new Date(0).toISOString()),
    deviceLabel,
    email,
    emailAvailable: Boolean(email),
    ipAvailable: ip.available,
    ipMasked: ip.masked,
    loginEventId,
    provider: deriveProvider(row),
    recordKey: `security-login-record-${loginEventId}`,
    riskLevel: deriveRiskLevel(row),
    role: deriveRole(row),
    route: text(row.route) || null,
    safeSummary: safeSummary(row.reason),
    status,
    userAgent,
    userAgentAvailable: Boolean(userAgent),
    userId: text(row.user_id) || null
  };
}

export function securityLoginStatusBadgeTone(status: SecurityLoginStatus) {
  switch (status) {
    case "success":
      return "green" as const;
    case "failed":
      return "red" as const;
    case "suspicious":
    case "force_logout":
    case "session_revoked":
      return "amber" as const;
    case "password_reset":
      return "blue" as const;
    case "unknown":
      return "slate" as const;
  }
}

export function normalizeSecurityLoginMonitoringPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityLoginMonitoringPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_LOGIN_MONITORING_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_LOGIN_MONITORING_MAX_PAGE_SIZE);
}

export function buildSecurityLoginMonitoringPagination(
  input: SecurityLoginMonitoringRuntimeInput,
  returnedCount: number
): SecurityLoginMonitoringPagination {
  const page = normalizeSecurityLoginMonitoringPage(input.page);
  const pageSize = normalizeSecurityLoginMonitoringPageSize(input.pageSize);
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

export function buildSecurityLoginMonitoringMetrics(
  records: SecurityLoginRecord[]
): SecurityLoginMonitoringMetrics {
  return {
    failedLogins: records.filter((record) => record.status === "failed").length,
    passwordResets: records.filter((record) => record.status === "password_reset").length,
    returnedEvents: records.length,
    sessionEvents: records.filter(
      (record) => record.status === "session_revoked" || record.status === "force_logout"
    ).length,
    successfulLogins: records.filter((record) => record.status === "success").length,
    suspiciousLogins: records.filter((record) => record.status === "suspicious").length
  };
}

export function getSecurityLoginMonitoringSummary(
  input: SecurityLoginMonitoringRuntimeInput,
  records: SecurityLoginRecord[]
): SecurityLoginMonitoringSummary {
  const pagination = buildSecurityLoginMonitoringPagination(input, records.length);
  const metrics = buildSecurityLoginMonitoringMetrics(records);
  const status: SecurityLoginMonitoringStatus = input.loadError
    ? "load_error"
    : records.length === 0
      ? "empty"
      : "login_monitoring_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_LOGIN_MONITORING_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_LOGIN_MONITORING_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${pagination.totalCount} total login events`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.successfulLogins} success`,
          `${metrics.failedLogins} failed`,
          `${metrics.suspiciousLogins} suspicious`
        ].join("; ")
  };
}

export function buildSecurityLoginMonitoringLoadingState(): SecurityLoginMonitoringLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security login monitoring runtime from existing login audit records.",
    readOnly: true,
    source: SECURITY_LOGIN_MONITORING_SOURCE
  };
}

export function buildSecurityLoginMonitoringErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityLoginMonitoringRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityLoginMonitoringPage(page),
    pageSize: normalizeSecurityLoginMonitoringPageSize(pageSize),
    totalCount: 0
  };
}

export function mapSecurityLoginMonitoringRuntimeToAdminFields(input: SecurityLoginMonitoringRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_LOGIN_MONITORING_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityLoginMonitoringErrorInput(
      "Login monitoring is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_LOGIN_MONITORING_COLUMNS,
      emptyState: SECURITY_LOGIN_MONITORING_EMPTY_STATE,
      filters: SECURITY_LOGIN_MONITORING_FILTERS,
      loginEvents: [] as SecurityLoginRecord[],
      registry: null,
      summary: getSecurityLoginMonitoringSummary(safeInput, [])
    };
  }

  const records = input.loadError
    ? []
    : input.logs.map((row, index) => mapSecurityLoginRowToRecord(row, index));
  const summary = getSecurityLoginMonitoringSummary(input, records);

  return {
    columns: SECURITY_LOGIN_MONITORING_COLUMNS,
    emptyState: SECURITY_LOGIN_MONITORING_EMPTY_STATE,
    filters: SECURITY_LOGIN_MONITORING_FILTERS,
    loginEvents: records,
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

export async function fetchSecurityLoginMonitoringInput(
  options: SecurityLoginMonitoringFetchOptions = {}
): Promise<SecurityLoginMonitoringRuntimeInput> {
  const page = normalizeSecurityLoginMonitoringPage(options.page);
  const pageSize = normalizeSecurityLoginMonitoringPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityLoginMonitoringErrorInput(
        "Service-role admin access is required to read login monitoring activity.",
        page,
        pageSize
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { count, data, error } = await admin
      .from(SECURITY_LOGIN_MONITORING_TABLE as never)
      .select(
        "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at",
        { count: "exact" }
      )
      .in("action" as never, SECURITY_LOGIN_MONITORING_ACTIONS as never)
      .order("created_at" as never, { ascending: false } as never)
      .range(from, to);

    if (error) {
      return buildSecurityLoginMonitoringErrorInput(
        `Unable to load login monitoring activity: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data),
      page,
      pageSize,
      totalCount: typeof count === "number" ? count : null
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading login monitoring activity.";
    return buildSecurityLoginMonitoringErrorInput(
      `Unable to load login monitoring activity: ${message}`,
      page,
      pageSize
    );
  }
}

export async function loadSecurityLoginMonitoringReadOnlySafe(
  options: SecurityLoginMonitoringFetchOptions = {}
) {
  const input = await fetchSecurityLoginMonitoringInput(options);
  return mapSecurityLoginMonitoringRuntimeToAdminFields(input);
}
