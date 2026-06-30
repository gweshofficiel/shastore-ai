import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { securityAuditActions } from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityDeviceMonitoringSource = "security_device_monitoring_runtime";

export type SecurityDeviceStatus = "blocked" | "monitoring" | "unknown" | "watching";

export type SecurityDeviceMonitoringStatus = "device_monitoring_ready" | "empty" | "load_error";

export type SecurityDeviceRow = {
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

export type SecurityDeviceRecord = {
  browser: string;
  country: string | null;
  deviceIdentifier: string;
  deviceType: string;
  email: string | null;
  emailAvailable: boolean;
  eventCount: number;
  firstSeenAt: string;
  ipAvailable: boolean;
  ipMasked: string;
  lastSeenAt: string;
  operatingSystem: string;
  recordKey: string;
  riskLevel: string | null;
  status: SecurityDeviceStatus;
  userAgent: string | null;
  userAgentAvailable: boolean;
  userId: string | null;
};

export type SecurityDeviceMonitoringPagination = {
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

export type SecurityDeviceMonitoringFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityDeviceMonitoringColumn = {
  key: string;
  label: string;
};

export type SecurityDeviceMonitoringMetrics = {
  blockedDevices: number;
  desktopDevices: number;
  mobileDevices: number;
  scannedEvents: number;
  totalDevices: number;
  watchingDevices: number;
};

export type SecurityDeviceMonitoringSummary = {
  loadError: string | null;
  metrics: SecurityDeviceMonitoringMetrics;
  pagination: SecurityDeviceMonitoringPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityDeviceMonitoringSource;
  status: SecurityDeviceMonitoringStatus;
  summary: string;
};

export type SecurityDeviceMonitoringRuntimeInput = {
  loadError: string | null;
  logs: SecurityDeviceRow[];
  page: number;
  pageSize: number;
};

export type SecurityDeviceMonitoringLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityDeviceMonitoringSource;
};

export type SecurityDeviceMonitoringFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_DEVICE_MONITORING_SOURCE = "security_device_monitoring_runtime" as const;

export const SECURITY_DEVICE_MONITORING_TABLE = "security_audit_logs" as const;

export const SECURITY_DEVICE_MONITORING_REGISTRY_KEY = "sec-device-monitoring" as const;

export const SECURITY_DEVICE_MONITORING_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_DEVICE_MONITORING_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_DEVICE_MONITORING_SCAN_LIMIT = 1000 as const;

export const SECURITY_DEVICE_MONITORING_EMPTY_STATE =
  "No device or browser activity has been recorded yet. This runtime derives device context from existing user-agent audit records only and never fabricates device data.";

export const SECURITY_DEVICE_MONITORING_COLUMNS: readonly SecurityDeviceMonitoringColumn[] = [
  { key: "deviceIdentifier", label: "Device Identifier" },
  { key: "userId", label: "Related User ID" },
  { key: "email", label: "Email" },
  { key: "browser", label: "Browser" },
  { key: "operatingSystem", label: "Operating System" },
  { key: "deviceType", label: "Device Type" },
  { key: "userAgent", label: "User Agent" },
  { key: "ipMasked", label: "IP Address" },
  { key: "country", label: "Location / Country" },
  { key: "firstSeenAt", label: "First Seen" },
  { key: "lastSeenAt", label: "Last Seen" },
  { key: "eventCount", label: "Event Count" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "status", label: "Status" }
] as const;

export const SECURITY_DEVICE_MONITORING_FILTERS: readonly SecurityDeviceMonitoringFilter[] = [
  {
    enabled: false,
    key: "deviceType",
    label: "Device Type",
    note: "Read-only placeholder. Device type filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All device types"
  },
  {
    enabled: false,
    key: "status",
    label: "Status",
    note: "Read-only placeholder. Device status filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All statuses"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Device search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search device activity"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityDeviceRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityDeviceRow[];
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

function safeUserAgent(value: unknown): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, 240) : null;
}

function deriveOperatingSystem(userAgent: string | null): string {
  const agent = (userAgent ?? "").toLowerCase();

  if (!agent) {
    return "Unknown OS";
  }

  if (agent.includes("windows nt") || agent.includes("windows")) {
    return "Windows";
  }

  if (agent.includes("android")) {
    return "Android";
  }

  if (agent.includes("iphone") || agent.includes("ipad") || agent.includes("ipod")) {
    return "iOS";
  }

  if (agent.includes("cros")) {
    return "ChromeOS";
  }

  if (agent.includes("mac os x") || agent.includes("macintosh")) {
    return "macOS";
  }

  if (agent.includes("linux")) {
    return "Linux";
  }

  return "Unknown OS";
}

function deriveRowEmail(row: SecurityDeviceRow): string | null {
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

function deriveRowCountry(row: SecurityDeviceRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return (
    safeText(metadata.country) ||
    safeText(metadata.location) ||
    safeText(metadata.geo) ||
    safeText(metadata.city)
  );
}

function deriveRowRiskLevel(row: SecurityDeviceRow): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const riskLevel = text(metadata.risk_level) || text(metadata.riskLevel);
  return riskLevel || null;
}

function isFailedLogin(row: SecurityDeviceRow): boolean {
  const action = text(row.action);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return action === securityAuditActions.loginFailed || text(metadata.loginOutcome).toLowerCase() === "failed";
}

function isSuccessfulLogin(row: SecurityDeviceRow): boolean {
  const action = text(row.action);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return action === securityAuditActions.loginSuccess || text(metadata.loginOutcome).toLowerCase() === "success";
}

function isBlockingSignal(row: SecurityDeviceRow): boolean {
  const action = text(row.action).toLowerCase();
  return action.includes("denied") || action.includes("rate_limit") || action.includes("blocked");
}

function deriveDeviceStatus(input: {
  blockingSignals: number;
  failedLoginCount: number;
  riskLevel: string | null;
  successfulLoginCount: number;
}): SecurityDeviceStatus {
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

  return "monitoring";
}

export function aggregateSecurityDeviceRecords(rows: SecurityDeviceRow[]): SecurityDeviceRecord[] {
  const groups = new Map<string, SecurityDeviceRow[]>();

  for (const row of rows) {
    const userAgent = text(row.user_agent);

    if (!userAgent) {
      continue;
    }

    const groupKey = `${text(row.user_id) || "anonymous"}::${userAgent}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(groupKey, [row]);
    }
  }

  const records: SecurityDeviceRecord[] = [];

  for (const [groupKey, groupRows] of groups) {
    const ordered = [...groupRows].sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const mostRecent = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const failedLoginCount = ordered.filter(isFailedLogin).length;
    const successfulLoginCount = ordered.filter(isSuccessfulLogin).length;
    const blockingSignals = ordered.filter(isBlockingSignal).length;
    const recentUserId = text(mostRecent?.user_id) || null;
    const rawUserAgent = text(mostRecent?.user_agent) || null;
    const userAgent = safeUserAgent(rawUserAgent);
    const { browserLabel, deviceLabel } = summarizeUserAgent(rawUserAgent);
    const email = ordered.map((row) => deriveRowEmail(row)).find((value) => Boolean(value)) ?? null;
    const country = ordered.map((row) => deriveRowCountry(row)).find((value) => Boolean(value)) ?? null;
    const riskLevel = ordered.map((row) => deriveRowRiskLevel(row)).find((value) => Boolean(value)) ?? null;
    const ip = maskIp(ordered.map((row) => text(row.ip_address)).find(Boolean) ?? null);
    const deviceIdentifier = `dev-${hashString(groupKey)}`;
    const status = deriveDeviceStatus({ blockingSignals, failedLoginCount, riskLevel, successfulLoginCount });

    records.push({
      browser: browserLabel,
      country,
      deviceIdentifier,
      deviceType: deviceLabel,
      email,
      emailAvailable: Boolean(email),
      eventCount: ordered.length,
      firstSeenAt: text(oldest?.created_at, new Date(0).toISOString()),
      ipAvailable: ip.available,
      ipMasked: ip.masked,
      lastSeenAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      operatingSystem: deriveOperatingSystem(rawUserAgent),
      recordKey: `security-device-record-${deviceIdentifier}`,
      riskLevel,
      status,
      userAgent,
      userAgentAvailable: Boolean(userAgent),
      userId: recentUserId
    });
  }

  return records.sort((left, right) => dateValue(right.lastSeenAt) - dateValue(left.lastSeenAt));
}

export function securityDeviceStatusBadgeTone(status: SecurityDeviceStatus) {
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

export function normalizeSecurityDeviceMonitoringPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityDeviceMonitoringPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_DEVICE_MONITORING_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_DEVICE_MONITORING_MAX_PAGE_SIZE);
}

export function buildSecurityDeviceMonitoringPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityDeviceMonitoringPagination {
  const normalizedPage = normalizeSecurityDeviceMonitoringPage(page);
  const normalizedPageSize = normalizeSecurityDeviceMonitoringPageSize(pageSize);
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

export function buildSecurityDeviceMonitoringMetrics(
  records: SecurityDeviceRecord[],
  scannedEvents: number
): SecurityDeviceMonitoringMetrics {
  return {
    blockedDevices: records.filter((record) => record.status === "blocked").length,
    desktopDevices: records.filter((record) => record.deviceType === "Desktop").length,
    mobileDevices: records.filter((record) => record.deviceType === "Mobile").length,
    scannedEvents,
    totalDevices: records.length,
    watchingDevices: records.filter((record) => record.status === "watching").length
  };
}

function paginateRecords(records: SecurityDeviceRecord[], page: number, pageSize: number): SecurityDeviceRecord[] {
  const normalizedPage = normalizeSecurityDeviceMonitoringPage(page);
  const normalizedPageSize = normalizeSecurityDeviceMonitoringPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityDeviceMonitoringSummary(
  input: SecurityDeviceMonitoringRuntimeInput,
  allRecords: SecurityDeviceRecord[],
  pageRecords: SecurityDeviceRecord[]
): SecurityDeviceMonitoringSummary {
  const pagination = buildSecurityDeviceMonitoringPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityDeviceMonitoringMetrics(allRecords, input.logs.length);
  const status: SecurityDeviceMonitoringStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "device_monitoring_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_DEVICE_MONITORING_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_DEVICE_MONITORING_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalDevices} distinct devices`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.scannedEvents} events scanned`,
          `${metrics.blockedDevices} blocked`,
          `${metrics.watchingDevices} watching`
        ].join("; ")
  };
}

export function buildSecurityDeviceMonitoringLoadingState(): SecurityDeviceMonitoringLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security device monitoring runtime from existing user-agent audit activity.",
    readOnly: true,
    source: SECURITY_DEVICE_MONITORING_SOURCE
  };
}

export function buildSecurityDeviceMonitoringErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityDeviceMonitoringRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityDeviceMonitoringPage(page),
    pageSize: normalizeSecurityDeviceMonitoringPageSize(pageSize)
  };
}

export function mapSecurityDeviceMonitoringRuntimeToAdminFields(input: SecurityDeviceMonitoringRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_DEVICE_MONITORING_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityDeviceMonitoringErrorInput(
      "Device monitoring is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_DEVICE_MONITORING_COLUMNS,
      deviceActivity: [] as SecurityDeviceRecord[],
      emptyState: SECURITY_DEVICE_MONITORING_EMPTY_STATE,
      filters: SECURITY_DEVICE_MONITORING_FILTERS,
      registry: null,
      summary: getSecurityDeviceMonitoringSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityDeviceRecords(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityDeviceMonitoringSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_DEVICE_MONITORING_COLUMNS,
    deviceActivity: pageRecords,
    emptyState: SECURITY_DEVICE_MONITORING_EMPTY_STATE,
    filters: SECURITY_DEVICE_MONITORING_FILTERS,
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

export async function fetchSecurityDeviceMonitoringInput(
  options: SecurityDeviceMonitoringFetchOptions = {}
): Promise<SecurityDeviceMonitoringRuntimeInput> {
  const page = normalizeSecurityDeviceMonitoringPage(options.page);
  const pageSize = normalizeSecurityDeviceMonitoringPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityDeviceMonitoringErrorInput(
        "Service-role admin access is required to read device monitoring activity.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_DEVICE_MONITORING_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .not("user_agent" as never, "is" as never, null as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_DEVICE_MONITORING_SCAN_LIMIT);

    if (error) {
      return buildSecurityDeviceMonitoringErrorInput(
        `Unable to load device monitoring activity: ${error.message}`,
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
    const message = caught instanceof Error ? caught.message : "Unknown error loading device monitoring activity.";
    return buildSecurityDeviceMonitoringErrorInput(
      `Unable to load device monitoring activity: ${message}`,
      page,
      pageSize
    );
  }
}

export async function loadSecurityDeviceMonitoringReadOnlySafe(
  options: SecurityDeviceMonitoringFetchOptions = {}
) {
  const input = await fetchSecurityDeviceMonitoringInput(options);
  return mapSecurityDeviceMonitoringRuntimeToAdminFields(input);
}
