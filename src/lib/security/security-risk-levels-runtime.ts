import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityRiskLevelsSource = "security_risk_levels_runtime";

export type SecurityRiskLevelSeverity = "critical" | "high" | "low" | "medium";

export type SecurityRiskLevelStatus = "defined" | "observed";

export type SecurityRiskLevelsRuntimeStatus = "empty" | "load_error" | "risk_levels_ready";

export type SecurityRiskLevelRow = {
  action?: string | null;
  created_at?: string | null;
  id?: string | null;
  metadata?: unknown;
  reason?: string | null;
  store_id?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

export type SecurityRiskLevelRecord = {
  colorLabel: string | null;
  createdAt: string | null;
  description: string;
  displayName: string;
  levelKey: string;
  occurrenceCount: number;
  recordKey: string;
  relatedRiskScoreId: string | null;
  riskLevelId: string;
  scoreRange: string | null;
  severity: SecurityRiskLevelSeverity;
  sourceModule: string;
  status: SecurityRiskLevelStatus;
  targetType: string | null;
  updatedAt: string | null;
};

export type SecurityRiskLevelsPagination = {
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

export type SecurityRiskLevelsFilter = {
  enabled: false;
  key: string;
  label: string;
  note: string;
  placeholder: string;
};

export type SecurityRiskLevelsColumn = {
  key: string;
  label: string;
};

export type SecurityRiskLevelsMetrics = {
  definedLevels: number;
  observedLevels: number;
  scannedEvents: number;
  totalLevels: number;
};

export type SecurityRiskLevelsSummary = {
  loadError: string | null;
  metrics: SecurityRiskLevelsMetrics;
  pagination: SecurityRiskLevelsPagination;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityRiskLevelsSource;
  status: SecurityRiskLevelsRuntimeStatus;
  summary: string;
};

export type SecurityRiskLevelsRuntimeInput = {
  loadError: string | null;
  logs: SecurityRiskLevelRow[];
  page: number;
  pageSize: number;
};

export type SecurityRiskLevelsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityRiskLevelsSource;
};

export type SecurityRiskLevelsFetchOptions = {
  page?: number;
  pageSize?: number;
};

export const SECURITY_RISK_LEVELS_SOURCE = "security_risk_levels_runtime" as const;

export const SECURITY_RISK_LEVELS_TABLE = "security_audit_logs" as const;

export const SECURITY_RISK_LEVELS_REGISTRY_KEY = "sec-risk-levels" as const;

export const SECURITY_RISK_LEVELS_DEFAULT_PAGE_SIZE = 50 as const;

export const SECURITY_RISK_LEVELS_MAX_PAGE_SIZE = 100 as const;

export const SECURITY_RISK_LEVELS_SCAN_LIMIT = 1000 as const;

export const SECURITY_RISK_LEVELS_EMPTY_STATE =
  "No risk level data is available yet. This runtime displays existing risk level definitions and mappings only and never creates, recalculates, or simulates risk levels.";

export const SECURITY_RISK_LEVELS_COLUMNS: readonly SecurityRiskLevelsColumn[] = [
  { key: "riskLevelId", label: "Risk Level ID" },
  { key: "levelKey", label: "Level Key" },
  { key: "displayName", label: "Display Name" },
  { key: "description", label: "Description" },
  { key: "severity", label: "Severity" },
  { key: "scoreRange", label: "Score Range" },
  { key: "colorLabel", label: "Color / Status Label" },
  { key: "targetType", label: "Target Type" },
  { key: "relatedRiskScoreId", label: "Related Risk Score ID" },
  { key: "sourceModule", label: "Source Module" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" }
] as const;

export const SECURITY_RISK_LEVELS_FILTERS: readonly SecurityRiskLevelsFilter[] = [
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
    note: "Read-only placeholder. Risk level status filtering is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "All statuses"
  },
  {
    enabled: false,
    key: "search",
    label: "Search",
    note: "Read-only placeholder. Risk level search is reserved for a future Security Runtime phase and does not execute on page load.",
    placeholder: "Search risk levels"
  }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRows(value: unknown): SecurityRiskLevelRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord) as SecurityRiskLevelRow[];
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

function hashString(raw: string): string {
  let hash = 5381;

  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 33) ^ raw.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function safeText(value: unknown, max = 180): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, max);
}

function metadataOf(row: SecurityRiskLevelRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function severityRank(severity: SecurityRiskLevelSeverity): number {
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

function mapLevelSeverity(levelKey: string, sourceMeta: Record<string, unknown>): SecurityRiskLevelSeverity {
  const explicit = (text(sourceMeta.severity) || "").toLowerCase();

  if (explicit === "critical" || explicit === "high" || explicit === "medium" || explicit === "low") {
    return explicit;
  }

  const key = levelKey.toLowerCase();

  if (key.includes("critical") || key.includes("severe")) {
    return "critical";
  }

  if (key.includes("high")) {
    return "high";
  }

  if (key.includes("medium") || key.includes("moderate") || key.includes("elevated")) {
    return "medium";
  }

  return "low";
}

function deriveScoreRange(sourceMeta: Record<string, unknown>): string | null {
  const explicit = safeText(sourceMeta.score_range ?? sourceMeta.scoreRange, 40);

  if (explicit) {
    return explicit;
  }

  const min = numberOrNull(sourceMeta.min ?? sourceMeta.min_score ?? sourceMeta.minScore);
  const max = numberOrNull(sourceMeta.max ?? sourceMeta.max_score ?? sourceMeta.maxScore);

  if (min !== null || max !== null) {
    return `${min ?? "?"}-${max ?? "?"}`;
  }

  return null;
}

type LevelAccumulator = {
  createdAt: string | null;
  definitionMeta: Record<string, unknown> | null;
  observedMeta: Record<string, unknown>;
  occurrenceCount: number;
  rowStoreId: string | null;
  rowUserId: string | null;
  sourceModule: string;
  status: SecurityRiskLevelStatus;
  updatedAt: string | null;
};

function hasRiskLevelData(row: SecurityRiskLevelRow): boolean {
  const metadata = metadataOf(row);
  const observed = text(metadata.risk_level) || text(metadata.riskLevel);
  const defs = metadata.risk_levels ?? metadata.riskLevels;
  return Boolean(observed) || (Array.isArray(defs) && defs.some(isRecord));
}

export function aggregateSecurityRiskLevels(rows: SecurityRiskLevelRow[]): SecurityRiskLevelRecord[] {
  const accumulators = new Map<string, LevelAccumulator>();

  const register = (
    rawKey: string,
    sourceMeta: Record<string, unknown>,
    createdAt: string | null,
    isDefinition: boolean,
    row: SecurityRiskLevelRow
  ) => {
    const levelKey = rawKey.toLowerCase().slice(0, 60);

    if (!levelKey) {
      return;
    }

    const existing = accumulators.get(levelKey);

    if (!existing) {
      accumulators.set(levelKey, {
        createdAt,
        definitionMeta: isDefinition ? sourceMeta : null,
        observedMeta: sourceMeta,
        occurrenceCount: 1,
        rowStoreId: text(row.store_id) || null,
        rowUserId: text(row.user_id) || null,
        sourceModule: text(sourceMeta.source_module) || text(sourceMeta.source) || "security_audit",
        status: isDefinition ? "defined" : "observed",
        updatedAt: createdAt
      });
      return;
    }

    existing.occurrenceCount += 1;

    if (dateValue(createdAt) < dateValue(existing.createdAt)) {
      existing.createdAt = createdAt;
    }

    if (dateValue(createdAt) > dateValue(existing.updatedAt)) {
      existing.updatedAt = createdAt;
    }

    if (isDefinition) {
      existing.status = "defined";

      if (!existing.definitionMeta) {
        existing.definitionMeta = sourceMeta;
      }
    }
  };

  for (const row of rows) {
    const metadata = metadataOf(row);
    const createdAt = text(row.created_at) || null;
    const observed = text(metadata.risk_level) || text(metadata.riskLevel);

    if (observed) {
      register(observed, metadata, createdAt, false, row);
    }

    const definitions = metadata.risk_levels ?? metadata.riskLevels;

    if (Array.isArray(definitions)) {
      for (const definition of definitions) {
        if (!isRecord(definition)) {
          continue;
        }

        const key = text(definition.key) || text(definition.level) || text(definition.name);

        if (key) {
          register(key, definition, createdAt, true, row);
        }
      }
    }
  }

  const records: SecurityRiskLevelRecord[] = [];

  for (const [levelKey, accumulator] of accumulators) {
    const sourceMeta = accumulator.definitionMeta ?? accumulator.observedMeta;
    const displayName =
      safeText(sourceMeta.risk_level_label ?? sourceMeta.label ?? sourceMeta.display_name, 80) || titleCase(levelKey);
    const description =
      safeText(sourceMeta.risk_level_description ?? sourceMeta.description) ||
      `Observed risk level "${displayName}" derived from existing security data.`;
    const severity = mapLevelSeverity(levelKey, sourceMeta);
    const riskLevelId = `risk-level-${hashString(levelKey)}`;

    records.push({
      colorLabel: safeText(sourceMeta.color ?? sourceMeta.status_label ?? sourceMeta.colorLabel, 40),
      createdAt: accumulator.createdAt,
      description,
      displayName,
      levelKey,
      occurrenceCount: accumulator.occurrenceCount,
      recordKey: `security-risk-level-record-${riskLevelId}`,
      relatedRiskScoreId:
        text(sourceMeta.risk_score_id) || text(sourceMeta.riskScoreId) || null,
      riskLevelId,
      scoreRange: deriveScoreRange(sourceMeta),
      severity,
      sourceModule: accumulator.sourceModule,
      status: accumulator.status,
      targetType: safeText(sourceMeta.target_type ?? sourceMeta.targetType, 40),
      updatedAt: accumulator.updatedAt
    });
  }

  return records.sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.levelKey.localeCompare(right.levelKey);
  });
}

export function securityRiskLevelSeverityBadgeTone(severity: SecurityRiskLevelSeverity) {
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

export function securityRiskLevelStatusBadgeTone(status: SecurityRiskLevelStatus) {
  switch (status) {
    case "defined":
      return "blue" as const;
    case "observed":
      return "slate" as const;
  }
}

export function normalizeSecurityRiskLevelsPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function normalizeSecurityRiskLevelsPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return SECURITY_RISK_LEVELS_DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(pageSize), SECURITY_RISK_LEVELS_MAX_PAGE_SIZE);
}

export function buildSecurityRiskLevelsPagination(
  page: number,
  pageSize: number,
  totalCount: number,
  returnedCount: number
): SecurityRiskLevelsPagination {
  const normalizedPage = normalizeSecurityRiskLevelsPage(page);
  const normalizedPageSize = normalizeSecurityRiskLevelsPageSize(pageSize);
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

export function buildSecurityRiskLevelsMetrics(
  records: SecurityRiskLevelRecord[],
  scannedEvents: number
): SecurityRiskLevelsMetrics {
  return {
    definedLevels: records.filter((record) => record.status === "defined").length,
    observedLevels: records.filter((record) => record.status === "observed").length,
    scannedEvents,
    totalLevels: records.length
  };
}

function paginateRecords(
  records: SecurityRiskLevelRecord[],
  page: number,
  pageSize: number
): SecurityRiskLevelRecord[] {
  const normalizedPage = normalizeSecurityRiskLevelsPage(page);
  const normalizedPageSize = normalizeSecurityRiskLevelsPageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  return records.slice(from, from + normalizedPageSize);
}

export function getSecurityRiskLevelsSummary(
  input: SecurityRiskLevelsRuntimeInput,
  allRecords: SecurityRiskLevelRecord[],
  pageRecords: SecurityRiskLevelRecord[]
): SecurityRiskLevelsSummary {
  const pagination = buildSecurityRiskLevelsPagination(
    input.page,
    input.pageSize,
    allRecords.length,
    pageRecords.length
  );
  const metrics = buildSecurityRiskLevelsMetrics(allRecords, input.logs.length);
  const status: SecurityRiskLevelsRuntimeStatus = input.loadError
    ? "load_error"
    : allRecords.length === 0
      ? "empty"
      : "risk_levels_ready";

  return {
    loadError: input.loadError,
    metrics,
    pagination,
    readOnly: true,
    registryKey: SECURITY_RISK_LEVELS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_RISK_LEVELS_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${metrics.totalLevels} risk levels`,
          `${pagination.returnedCount} on page ${pagination.page} of ${pagination.pageCount}`,
          `${metrics.definedLevels} defined`,
          `${metrics.observedLevels} observed`,
          `${metrics.scannedEvents} events scanned`
        ].join("; ")
  };
}

export function buildSecurityRiskLevelsLoadingState(): SecurityRiskLevelsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security risk levels runtime from existing risk level data.",
    readOnly: true,
    source: SECURITY_RISK_LEVELS_SOURCE
  };
}

export function buildSecurityRiskLevelsErrorInput(
  message: string,
  page: number,
  pageSize: number
): SecurityRiskLevelsRuntimeInput {
  return {
    loadError: message,
    logs: [],
    page: normalizeSecurityRiskLevelsPage(page),
    pageSize: normalizeSecurityRiskLevelsPageSize(pageSize)
  };
}

export function mapSecurityRiskLevelsRuntimeToAdminFields(input: SecurityRiskLevelsRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_RISK_LEVELS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityRiskLevelsErrorInput(
      "Risk levels are not registered as a super-admin module in the security registry.",
      input.page,
      input.pageSize
    );

    return {
      columns: SECURITY_RISK_LEVELS_COLUMNS,
      emptyState: SECURITY_RISK_LEVELS_EMPTY_STATE,
      filters: SECURITY_RISK_LEVELS_FILTERS,
      registry: null,
      riskLevels: [] as SecurityRiskLevelRecord[],
      summary: getSecurityRiskLevelsSummary(safeInput, [], [])
    };
  }

  const allRecords = input.loadError ? [] : aggregateSecurityRiskLevels(input.logs);
  const pageRecords = paginateRecords(allRecords, input.page, input.pageSize);
  const summary = getSecurityRiskLevelsSummary(input, allRecords, pageRecords);

  return {
    columns: SECURITY_RISK_LEVELS_COLUMNS,
    emptyState: SECURITY_RISK_LEVELS_EMPTY_STATE,
    filters: SECURITY_RISK_LEVELS_FILTERS,
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
    riskLevels: pageRecords,
    summary
  };
}

export async function fetchSecurityRiskLevelsInput(
  options: SecurityRiskLevelsFetchOptions = {}
): Promise<SecurityRiskLevelsRuntimeInput> {
  const page = normalizeSecurityRiskLevelsPage(options.page);
  const pageSize = normalizeSecurityRiskLevelsPageSize(options.pageSize);

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityRiskLevelsErrorInput(
        "Service-role admin access is required to read risk level data.",
        page,
        pageSize
      );
    }

    const { data, error } = await admin
      .from(SECURITY_RISK_LEVELS_TABLE as never)
      .select("id, user_id, store_id, workspace_id, action, reason, metadata, created_at")
      .order("created_at" as never, { ascending: false } as never)
      .limit(SECURITY_RISK_LEVELS_SCAN_LIMIT);

    if (error) {
      return buildSecurityRiskLevelsErrorInput(
        `Unable to load risk level data: ${error.message}`,
        page,
        pageSize
      );
    }

    return {
      loadError: null,
      logs: asRows(data).filter(hasRiskLevelData),
      page,
      pageSize
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading risk level data.";
    return buildSecurityRiskLevelsErrorInput(`Unable to load risk level data: ${message}`, page, pageSize);
  }
}

export async function loadSecurityRiskLevelsReadOnlySafe(options: SecurityRiskLevelsFetchOptions = {}) {
  const input = await fetchSecurityRiskLevelsInput(options);
  return mapSecurityRiskLevelsRuntimeToAdminFields(input);
}
