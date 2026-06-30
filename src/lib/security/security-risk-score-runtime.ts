import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityRiskScoreSource = "security_risk_score_runtime";

export type SecurityRiskScoreStatus = "indicator" | "scored" | "unscored";

export type SecurityRiskScoreRuntimeStatus = "empty" | "load_error" | "risk_score_ready";

export type SecurityRiskScoreRow = {
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

export type SecurityRiskScoreRecord = {
  createdAt: string;
  email: string | null;
  emailAvailable: boolean;
  ipAvailable: boolean;
  ipMasked: string;
  lastEvaluatedAt: string | null;
  recordKey: string;
  riskFactors: string[];
  riskLevel: string | null;
  riskScoreId: string;
  scoreValue: number | null;
  sourceModule: string;
  status: SecurityRiskScoreStatus;
  storeId: string | null;
  targetId: string | null;
  targetType: string;
  updatedAt: string | null;
  userId: string | null;
};

export type SecurityRiskScorePagination = {
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

export type SecurityRiskScoreFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityRiskScoreColumn = {
  key: string;
  label: string;
};

export type SecurityRiskScoreMetrics = {
  indicatorOnlyTargets: number;
  scannedEvents: number;
  scoredTargets: number;
  totalTargets: number;
};

export type SecurityRiskScoreSummary = {
  loadError: string | null;
  metrics: SecurityRiskScoreMetrics;
  pagination: SecurityRiskScorePagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityRiskScoreSource;
  status: SecurityRiskScoreRuntimeStatus;
  summary: string;
};

export type SecurityRiskScoreRuntimeInput = {
  loadError: string | null;
  logs: SecurityRiskScoreRow[];
  page: number;
  pageSize: number;
};

export type SecurityRiskScoreLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityRiskScoreSource;
};

export type SecurityRiskScoreFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_RISK_SCORE_SOURCE = "security_risk_score_runtime" as const;

export const SECURITY_RISK_SCORE_TABLE = "security_audit_logs" as const;

export const SECURITY_RISK_SCORE_REGISTRY_KEY = "sec-risk-score" as const;

export const SECURITY_RISK_SCORE_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_RISK_SCORE_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_RISK_SCORE_SCAN_LIMIT = 1000 as const;

export const SECURITY_RISK_SCORE_MAX_FACTORS = 20 as const;

export const SECURITY_RISK_SCORE_EMPTY_STATE =
  "No risk score data is available yet. This runtime displays existing risk score values and indicators only and never calculates, generates, or simulates risk scores.";

export const SECURITY_RISK_SCORE_COLUMNS: readonly SecurityRiskScoreColumn[] = [
  { key: "riskScoreId", label: "Risk Score ID" },
  { key: "targetType", label: "Target Type" },
  { key: "targetId", label: "Target ID" },
  { key: "userId", label: "Related User ID" },
  { key: "storeId", label: "Related Store ID" },
  { key: "email", label: "Email" },
  { key: "scoreValue", label: "Score Value" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "riskFactors", label: "Risk Factors" },
  { key: "sourceModule", label: "Source Module" },
  { key: "lastEvaluatedAt", label: "Last Evaluated" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" }
] as const;

export const SECURITY_RISK_SCORE_FILTERS: readonly SecurityRiskScoreFilter[] = [
  {
    enabled: false,
    key: "riskLevel",
    label: "Risk Level",
    note: "Read-only placeholder. Risk level filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All risk levels"
  },
  {
    enabled: false,
    key: "targetType",
    label: "Target Type",
    note: "Read-only placeholder. Target type filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All target types"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Risk score search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search risk scores"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityRiskScoreRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityRiskScoreRow[];
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

function metadataOf(row: SecurityRiskScoreRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function readScoreValue(metadata: Record<string, unknown>): number | null {
  return numberOrNull(metadata.risk_score ?? metadata.riskScore ?? metadata.score);
}

function readRiskLevel(metadata: Record<string, unknown>): string | null {
  const level = text(metadata.risk_level) || text(metadata.riskLevel);
  return level || null;
}

function readRiskFactors(metadata: Record<string, unknown>): string[] {
  const raw = metadata.risk_factors ?? metadata.riskFactors ?? metadata.factors;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return safeText(String(item));
        }

        if (isRecord(item)) {
          const label = text(item.label) || text(item.name) || text(item.factor) || text(item.key);
          const weight = item.weight ?? item.value ?? item.score;
          const weightText = numberOrNull(weight);
          return safeText(weightText !== null ? `${label || "factor"}: ${weightText}` : label);
        }

        return null;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, SECURITY_RISK_SCORE_MAX_FACTORS);
  }

  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([key, value]) => safeText(`${key}: ${typeof value === "object" ? "[detail]" : String(value)}`))
      .filter((value): value is string => Boolean(value))
      .slice(0, SECURITY_RISK_SCORE_MAX_FACTORS);
  }

  if (typeof raw === "string" && raw.trim()) {
    const single = safeText(raw);
    return single ? [single] : [];
  }

  return [];
}

export function hasRiskScoreData(row: SecurityRiskScoreRow): boolean {
  const metadata = metadataOf(row);
  return (
    readScoreValue(metadata) !== null ||
    readRiskLevel(metadata) !== null ||
    readRiskFactors(metadata).length > 0
  );
}

function deriveTargetType(row: SecurityRiskScoreRow, metadata: Record<string, unknown>): string {
  const metadataType = text(metadata.target_type) || text(metadata.targetType);

  if (metadataType) {
    return metadataType;
  }

  if (text(row.user_id)) {
    return "user";
  }

  if (text(row.store_id)) {
    return "store";
  }

  if (text(row.ip_address)) {
    return "ip";
  }

  return "unknown";
}

function deriveTargetId(row: SecurityRiskScoreRow, metadata: Record<string, unknown>): string | null {
  return (
    text(metadata.target_id) ||
    text(metadata.targetId) ||
    text(row.user_id) ||
    text(row.store_id) ||
    null
  );
}

function deriveStatus(scoreValue: number | null, riskLevel: string | null, riskFactors: string[]): SecurityRiskScoreStatus {
  if (scoreValue !== null) {
    return "scored";
  }

  if (riskLevel !== null || riskFactors.length > 0) {
    return "indicator";
  }

  return "unscored";
}

export function aggregateSecurityRiskScores(rows: SecurityRiskScoreRow[]): SecurityRiskScoreRecord[] {
  const grouped = new Map<string, SecurityRiskScoreRow>();

  for (const row of rows) {
    if (!hasRiskScoreData(row)) {
      continue;
    }

    const metadata = metadataOf(row);
    const targetKey =
      `${deriveTargetType(row, metadata)}::` +
      `${deriveTargetId(row, metadata) || text(row.ip_address) || "global"}`;
    const existing = grouped.get(targetKey);

    if (!existing || dateValue(row.created_at) > dateValue(existing.created_at)) {
      grouped.set(targetKey, row);
    }
  }

  const records: SecurityRiskScoreRecord[] = [];

  for (const [targetKey, row] of grouped) {
    const metadata = metadataOf(row);
    const scoreValue = readScoreValue(metadata);
    const riskLevel = readRiskLevel(metadata);
    const riskFactors = readRiskFactors(metadata);
    const ip = maskIp(row.ip_address);
    const email = maskEmail(metadata.email) ?? (text(metadata.emailDomain) ? `***@${text(metadata.emailDomain)}` : null);
    const riskScoreId = `risk-${hashString(targetKey)}`;
    const lastEvaluatedAt =
      text(metadata.last_evaluated_at) || text(metadata.evaluated_at) || text(metadata.lastEvaluatedAt) || null;
    const updatedAt = text(metadata.updated_at) || text(metadata.updatedAt) || null;

    records.push({
      createdAt: text(row.created_at, new Date(0).toISOString()),
      email,
      emailAvailable: Boolean(email),
      ipAvailable: ip.available,
      ipMasked: ip.masked,
      lastEvaluatedAt,
      recordKey: `security-risk-score-record-${riskScoreId}`,
      riskFactors,
      riskLevel,
      riskScoreId,
      scoreValue,
      sourceModule: text(metadata.source_module) || text(metadata.source) || "security_audit",
      status: deriveStatus(scoreValue, riskLevel, riskFactors),
      storeId: text(row.store_id) || null,
      targetId: deriveTargetId(row, metadata),
      targetType: deriveTargetType(row, metadata),
      updatedAt,
      userId: text(row.user_id) || null
    });
  }

  return records.sort((left, right) => {
    const scoreDelta = (right.scoreValue ?? -1) - (left.scoreValue ?? -1);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return dateValue(right.createdAt) - dateValue(left.createdAt);
  });
}

export function securityRiskScoreStatusBadgeTone(status: SecurityRiskScoreStatus) {
  switch (status) {
    case "scored":
      return "blue" as const;
    case "indicator":
      return "amber" as const;
    case "unscored":
      return "slate" as const;
  }
}

export function normalizeSecurityRiskScorePage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityRiskScorePageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_RISK_SCORE_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_RISK_SCORE_MAX_PAGE_SIZE);
}

export function buildSecurityRiskScorePagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityRiskScorePagination {
  const normalizedPage = normalizeSecurityRiskScorePage(page);
  const normalizedPageSize = normalizeSecurityRiskScorePageSize(pageSize);
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

export function buildSecurityRiskScoreMetrics(
  records: SecurityRiskScoreRecord[],
  scannedEvents: number
): SecurityRiskScoreMetrics {
  return {
    indicatorOnlyTargets: records.filter((record) => record.status === "indicator").length,
    scannedEvents,
    scoredTargets: records.filter((record) => record.status === "scored").length,
    totalTargets: records.length
  };
}

function paginateRecords(
  records: SecurityRiskScoreRecord[],
  page: number,
  pageSize: number
): SecurityRiskScoreRecord[] {
  const normalizedPage = normalizeSecurityRiskScorePage(page);
  const normalizedPageSize = normalizeSecurityRiskScorePageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityRiskScoreSummary(
  input: SecurityRiskScoreRuntimeInput,
  allRecords: SecurityRiskScoreRecord[],
  pageRecords: SecurityRiskScoreRecord[]
): SecurityRiskScoreSummary {
  const pagination = buildSecurityRiskScorePagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityRiskScoreMetrics(allRecords, input.logs.length);
  const status: SecurityRiskScoreRuntimeStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "risk_score_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_RISK_SCORE_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_RISK_SCORE_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalTargets} risk targets`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.scoredTargets} scored`,
          `${metrics.indicatorOnlyTargets} indicator only`,
          `${metrics.scannedEvents} events scanned`
        ].join("; ")
  };
}

export function buildSecurityRiskScoreLoadingState(): SecurityRiskScoreLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security risk score runtime from existing risk score data.",
    readOnly: true,
    source: SECURITY_RISK_SCORE_SOURCE
  };
}

export function buildSecurityRiskScoreErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityRiskScoreRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityRiskScorePage(page),
    pageSize: normalizeSecurityRiskScorePageSize(pageSize)
  };
}

export function mapSecurityRiskScoreRuntimeToAdminFields(input: SecurityRiskScoreRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_RISK_SCORE_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityRiskScoreErrorInput(
      "Risk score is not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_RISK_SCORE_COLUMNS,
      emptyState: SECURITY_RISK_SCORE_EMPTY_STATE,
      filters: SECURITY_RISK_SCORE_FILTERS,
      registry: null,
      riskScores: [] as SecurityRiskScoreRecord[],
      summary: getSecurityRiskScoreSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityRiskScores(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityRiskScoreSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_RISK_SCORE_COLUMNS,
    emptyState: SECURITY_RISK_SCORE_EMPTY_STATE,
    filters: SECURITY_RISK_SCORE_FILTERS,
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
    riskScores: pageRecords,
    summary
  };
}

export async function fetchSecurityRiskScoreInput(
  options: SecurityRiskScoreFetchOptions = {}
): Promise<SecurityRiskScoreRuntimeInput> {
  const page = normalizeSecurityRiskScorePage(options.page);
  const pageSize = normalizeSecurityRiskScorePageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityRiskScoreErrorInput(
        "Service-role admin access is required to read risk score data.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_RISK_SCORE_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, route, ip_address, user_agent, metadata, created_at")
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_RISK_SCORE_SCAN_LIMIT);

    if (error) {
      return buildSecurityRiskScoreErrorInput(
        `Unable to load risk score data: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data).filter(hasRiskScoreData),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading risk score data.";
    return buildSecurityRiskScoreErrorInput(`Unable to load risk score data: ${message}`, page, pageSize);
  }
}

export async function loadSecurityRiskScoreReadOnlySafe(options: SecurityRiskScoreFetchOptions = {}) {
  const input = await fetchSecurityRiskScoreInput(options);
  return mapSecurityRiskScoreRuntimeToAdminFields(input);
}
