import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityFraudDetectionSource = "security_fraud_detection_runtime";

export type SecurityFraudSignalType =
  | "chargeback"
  | "dispute"
  | "fraud_flag"
  | "payment_fraud"
  | "refund_abuse"
  | "suspicious_payment"
  | "token_abuse";

export type SecurityFraudSourceModule =
  | "audit"
  | "billing"
  | "disputes"
  | "orders"
  | "payments";

export type SecurityFraudSeverity = "critical" | "high" | "low" | "medium";

export type SecurityFraudStatus = "blocked" | "monitoring" | "recorded" | "watching";

export type SecurityFraudDetectionStatus = "empty" | "fraud_detection_ready" | "load_error";

export type SecurityFraudRow = {
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

export type SecurityFraudSignalRecord = {
  amount: number | null;
  browserLabel: string;
  createdAt: string;
  currency: string | null;
  deviceLabel: string;
  email: string | null;
  emailAvailable: boolean;
  eventCount: number;
  fraudSignalId: string;
  ipAvailable: boolean;
  ipMasked: string;
  lastDetectedAt: string;
  orderId: string | null;
  paymentId: string | null;
  provider: string | null;
  recordKey: string;
  riskLevel: string | null;
  safeSummary: string;
  severity: SecurityFraudSeverity;
  signalType: SecurityFraudSignalType;
  sourceModule: SecurityFraudSourceModule;
  status: SecurityFraudStatus;
  storeId: string | null;
  userAgentAvailable: boolean;
  userId: string | null;
};

export type SecurityFraudDetectionPagination = {
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

export type SecurityFraudDetectionFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityFraudDetectionColumn = {
  key: string;
  label: string;
};

export type SecurityFraudDetectionMetrics = {
  blockedSignals: number;
  criticalSignals: number;
  highSignals: number;
  scannedEvents: number;
  totalSignals: number;
  watchingSignals: number;
};

export type SecurityFraudDetectionSummary = {
  loadError: string | null;
  metrics: SecurityFraudDetectionMetrics;
  pagination: SecurityFraudDetectionPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityFraudDetectionSource;
  status: SecurityFraudDetectionStatus;
  summary: string;
};

export type SecurityFraudDetectionRuntimeInput = {
  loadError: string | null;
  logs: SecurityFraudRow[];
  page: number;
  pageSize: number;
};

export type SecurityFraudDetectionLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityFraudDetectionSource;
};

export type SecurityFraudDetectionFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_FRAUD_DETECTION_SOURCE = "security_fraud_detection_runtime" as const;

export const SECURITY_FRAUD_DETECTION_TABLE = "security_audit_logs" as const;

export const SECURITY_FRAUD_DETECTION_REGISTRY_KEY = "sec-fraud-detection" as const;

export const SECURITY_FRAUD_DETECTION_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_FRAUD_DETECTION_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_FRAUD_DETECTION_SCAN_LIMIT = 1000 as const;

export const SECURITY_FRAUD_DETECTION_EMPTY_STATE =
  "No fraud-related security signals have been recorded yet. This runtime observes existing audit, payment, and dispute signals only and never fabricates fraud data.";

export const SECURITY_FRAUD_DETECTION_COLUMNS: readonly SecurityFraudDetectionColumn[] = [
  { key: "fraudSignalId", label: "Fraud Signal ID" },
  { key: "signalType", label: "Signal Type" },
  { key: "userId", label: "Related User ID" },
  { key: "storeId", label: "Related Store ID" },
  { key: "orderId", label: "Related Order ID" },
  { key: "paymentId", label: "Related Payment ID" },
  { key: "provider", label: "Provider" },
  { key: "email", label: "Email" },
  { key: "ipMasked", label: "IP Address" },
  { key: "deviceLabel", label: "Device / Browser" },
  { key: "sourceModule", label: "Source Module" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "severity", label: "Severity" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "status", label: "Status" },
  { key: "lastDetectedAt", label: "Last Detected" },
  { key: "createdAt", label: "Created At" }
] as const;

export const SECURITY_FRAUD_DETECTION_FILTERS: readonly SecurityFraudDetectionFilter[] = [
  {
    enabled: false,
    key: "signalType",
    label: "Signal Type",
    note: "Read-only placeholder. Fraud signal type filtering is reserved for a future Security Runtime phase and does not execute on page load.",
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
    key: "provider",
    label: "Provider",
    note: "Read-only placeholder. Provider filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All providers"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Fraud signal search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search fraud signals"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityFraudRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityFraudRow[];
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

function metadataOf(row: SecurityFraudRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function deriveRowEmail(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
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

function deriveRowRiskLevel(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
  const riskLevel = text(metadata.risk_level) || text(metadata.riskLevel);
  return riskLevel || null;
}

function deriveOrderId(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
  return text(metadata.order_id) || text(metadata.orderId) || null;
}

function derivePaymentId(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
  return (
    text(metadata.payment_id) ||
    text(metadata.paymentId) ||
    text(metadata.transaction_id) ||
    text(metadata.transactionId) ||
    null
  );
}

function deriveProvider(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
  return (
    text(metadata.provider) ||
    text(metadata.payment_provider) ||
    text(metadata.gateway) ||
    null
  );
}

function deriveAmount(row: SecurityFraudRow): number | null {
  const metadata = metadataOf(row);
  return numberOrNull(metadata.amount ?? metadata.total ?? metadata.value);
}

function deriveCurrency(row: SecurityFraudRow): string | null {
  const metadata = metadataOf(row);
  const currency = text(metadata.currency) || text(metadata.currency_code);
  return currency ? currency.slice(0, 12).toUpperCase() : null;
}

export function classifyFraudSignalType(row: SecurityFraudRow): SecurityFraudSignalType | null {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();
  const metadata = metadataOf(row);
  const haystack = `${action} ${reason} ${text(metadata.signal_type)} ${text(metadata.fraud_type)}`.toLowerCase();

  if (haystack.includes("chargeback")) {
    return "chargeback";
  }

  if (haystack.includes("dispute")) {
    return "dispute";
  }

  if (haystack.includes("refund") && (haystack.includes("abuse") || haystack.includes("fraud"))) {
    return "refund_abuse";
  }

  if (haystack.includes("token")) {
    return "token_abuse";
  }

  if (haystack.includes("payment") && haystack.includes("fraud")) {
    return "payment_fraud";
  }

  if (haystack.includes("payment") && (haystack.includes("suspicious") || haystack.includes("risk"))) {
    return "suspicious_payment";
  }

  if (haystack.includes("fraud") || metadata.fraud === true || metadata.fraudSignal === true) {
    return "fraud_flag";
  }

  return null;
}

export function isFraudSignalRow(row: SecurityFraudRow): boolean {
  return classifyFraudSignalType(row) !== null;
}

function resolveSourceModule(signalType: SecurityFraudSignalType): SecurityFraudSourceModule {
  switch (signalType) {
    case "chargeback":
    case "dispute":
      return "disputes";
    case "refund_abuse":
      return "billing";
    case "payment_fraud":
    case "token_abuse":
    case "suspicious_payment":
      return "payments";
    case "fraud_flag":
      return "audit";
  }
}

function severityRank(severity: SecurityFraudSeverity): number {
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

function deriveRowSeverity(signalType: SecurityFraudSignalType): SecurityFraudSeverity {
  switch (signalType) {
    case "chargeback":
    case "payment_fraud":
      return "critical";
    case "dispute":
    case "token_abuse":
    case "refund_abuse":
    case "fraud_flag":
      return "high";
    case "suspicious_payment":
      return "medium";
  }
}

function deriveFraudStatus(input: {
  severity: SecurityFraudSeverity;
  signalType: SecurityFraudSignalType;
}): SecurityFraudStatus {
  if (input.signalType === "chargeback" || input.signalType === "payment_fraud") {
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

export function aggregateSecurityFraudSignals(rows: SecurityFraudRow[]): SecurityFraudSignalRecord[] {
  const groups = new Map<string, { rows: SecurityFraudRow[]; signalType: SecurityFraudSignalType }>();

  for (const row of rows) {
    const signalType = classifyFraudSignalType(row);

    if (!signalType) {
      continue;
    }

    const actorKey =
      derivePaymentId(row) ||
      deriveOrderId(row) ||
      text(row.user_id) ||
      text(row.store_id) ||
      text(row.ip_address) ||
      "global";
    const groupKey = `${signalType}::${actorKey}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(groupKey, { rows: [row], signalType });
    }
  }

  const records: SecurityFraudSignalRecord[] = [];

  for (const [groupKey, group] of groups) {
    const ordered = [...group.rows].sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const mostRecent = ordered[0];
    const oldest = ordered[ordered.length - 1];
    const severity = deriveRowSeverity(group.signalType);
    const email = ordered.map((row) => deriveRowEmail(row)).find((value) => Boolean(value)) ?? null;
    const riskLevel = ordered.map((row) => deriveRowRiskLevel(row)).find((value) => Boolean(value)) ?? null;
    const rawUserAgent = ordered.map((row) => text(row.user_agent)).find(Boolean) ?? null;
    const { browserLabel, deviceLabel } = summarizeUserAgent(rawUserAgent);
    const ip = maskIp(ordered.map((row) => text(row.ip_address)).find(Boolean) ?? null);
    const amount = ordered.map((row) => deriveAmount(row)).find((value) => value !== null) ?? null;
    const fraudSignalId = `fraud-${hashString(groupKey)}`;
    const status = deriveFraudStatus({ severity, signalType: group.signalType });

    records.push({
      amount,
      browserLabel,
      createdAt: text(oldest?.created_at, new Date(0).toISOString()),
      currency: ordered.map((row) => deriveCurrency(row)).find((value) => Boolean(value)) ?? null,
      deviceLabel,
      email,
      emailAvailable: Boolean(email),
      eventCount: ordered.length,
      fraudSignalId,
      ipAvailable: ip.available,
      ipMasked: ip.masked,
      lastDetectedAt: text(mostRecent?.created_at, new Date(0).toISOString()),
      orderId: ordered.map((row) => deriveOrderId(row)).find((value) => Boolean(value)) ?? null,
      paymentId: ordered.map((row) => derivePaymentId(row)).find((value) => Boolean(value)) ?? null,
      provider: ordered.map((row) => deriveProvider(row)).find((value) => Boolean(value)) ?? null,
      recordKey: `security-fraud-record-${fraudSignalId}`,
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

export function securityFraudSeverityBadgeTone(severity: SecurityFraudSeverity) {
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

export function securityFraudStatusBadgeTone(status: SecurityFraudStatus) {
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

export function normalizeSecurityFraudDetectionPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityFraudDetectionPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_FRAUD_DETECTION_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_FRAUD_DETECTION_MAX_PAGE_SIZE);
}

export function buildSecurityFraudDetectionPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityFraudDetectionPagination {
  const normalizedPage = normalizeSecurityFraudDetectionPage(page);
  const normalizedPageSize = normalizeSecurityFraudDetectionPageSize(pageSize);
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

export function buildSecurityFraudDetectionMetrics(
  records: SecurityFraudSignalRecord[],
  scannedEvents: number
): SecurityFraudDetectionMetrics {
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
  records: SecurityFraudSignalRecord[],
  page: number,
  pageSize: number
): SecurityFraudSignalRecord[] {
  const normalizedPage = normalizeSecurityFraudDetectionPage(page);
  const normalizedPageSize = normalizeSecurityFraudDetectionPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityFraudDetectionSummary(
  input: SecurityFraudDetectionRuntimeInput,
  allRecords: SecurityFraudSignalRecord[],
  pageRecords: SecurityFraudSignalRecord[]
): SecurityFraudDetectionSummary {
  const pagination = buildSecurityFraudDetectionPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityFraudDetectionMetrics(allRecords, input.logs.length);
  const status: SecurityFraudDetectionStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "fraud_detection_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_FRAUD_DETECTION_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_FRAUD_DETECTION_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalSignals} fraud signals`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.scannedEvents} events scanned`,
          `${metrics.criticalSignals} critical`,
          `${metrics.highSignals} high`,
          `${metrics.blockedSignals} blocked`
        ].join("; ")
  };
}

export function buildSecurityFraudDetectionLoadingState(): SecurityFraudDetectionLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security fraud detection runtime from existing fraud-related signals.",
    readOnly: true,
    source: SECURITY_FRAUD_DETECTION_SOURCE
  };
}

export function buildSecurityFraudDetectionErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityFraudDetectionRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityFraudDetectionPage(page),
    pageSize: normalizeSecurityFraudDetectionPageSize(pageSize)
  };
}

export function mapSecurityFraudDetectionRuntimeToAdminFields(input: SecurityFraudDetectionRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_FRAUD_DETECTION_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityFraudDetectionErrorInput(
      "Fraud detection is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_FRAUD_DETECTION_COLUMNS,
      emptyState: SECURITY_FRAUD_DETECTION_EMPTY_STATE,
      filters: SECURITY_FRAUD_DETECTION_FILTERS,
      fraudSignals: [] as SecurityFraudSignalRecord[],
      registry: null,
      summary: getSecurityFraudDetectionSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityFraudSignals(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityFraudDetectionSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_FRAUD_DETECTION_COLUMNS,
    emptyState: SECURITY_FRAUD_DETECTION_EMPTY_STATE,
    filters: SECURITY_FRAUD_DETECTION_FILTERS,
    fraudSignals: pageRecords,
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

export async function fetchSecurityFraudDetectionInput(
  options: SecurityFraudDetectionFetchOptions = {}
): Promise<SecurityFraudDetectionRuntimeInput> {
  const page = normalizeSecurityFraudDetectionPage(options.page);
  const pageSize = normalizeSecurityFraudDetectionPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityFraudDetectionErrorInput(
        "Service-role admin access is required to read fraud detection signals.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_FRAUD_DETECTION_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_FRAUD_DETECTION_SCAN_LIMIT);

    if (error) {
      return buildSecurityFraudDetectionErrorInput(
        `Unable to load fraud detection signals: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data).filter(isFraudSignalRow),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading fraud detection signals.";
    return buildSecurityFraudDetectionErrorInput(`Unable to load fraud detection signals: ${message}`, page, pageSize);
  }
}

export async function loadSecurityFraudDetectionReadOnlySafe(
  options: SecurityFraudDetectionFetchOptions = {}
) {
  const input = await fetchSecurityFraudDetectionInput(options);
  return mapSecurityFraudDetectionRuntimeToAdminFields(input);
}
