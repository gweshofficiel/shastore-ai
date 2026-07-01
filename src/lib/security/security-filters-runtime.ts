import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import {
  classifyAbuseSignalType,
  type SecurityAbuseRow
} from "@/src/lib/security/security-abuse-detection-runtime";
import { mapSecurityAuditLogRowToRecord } from "@/src/lib/security/security-audit-logs-runtime";
import {
  fetchSecurityEventsInput,
  mapSecurityEventRowToRecord
} from "@/src/lib/security/security-events-runtime";
import {
  isFraudSignalRow,
  type SecurityFraudRow
} from "@/src/lib/security/security-fraud-detection-runtime";
import { SECURITY_LOGIN_MONITORING_ACTIONS } from "@/src/lib/security/security-login-monitoring-runtime";
import {
  isRateLimitRow,
  type SecurityRateLimitRow
} from "@/src/lib/security/security-rate-limits-runtime";
import {
  hasRiskScoreData,
  type SecurityRiskScoreRow
} from "@/src/lib/security/security-risk-score-runtime";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import type { SecuritySearchDatasetKey } from "@/src/lib/security/security-search-runtime";

export type SecurityFiltersSource = "security_filters_runtime";

export type SecurityFiltersDatasetKey = SecuritySearchDatasetKey;

export type SecurityFiltersScope = "all" | SecurityFiltersDatasetKey;

export type SecurityFiltersState = "disabled" | "empty" | "error" | "success";

export type SecurityFiltersQuery = {
  dateFrom: string;
  dateTo: string;
  eventType: string;
  riskLevel: string;
  severity: string;
  sourceModule: string;
  status: string;
  targetType: string;
};

export type SecurityFiltersResultRow = {
  action: string;
  actor: string;
  createdAt: string;
  datasets: SecurityFiltersDatasetKey[];
  emailMasked: string;
  eventId: string;
  ipMasked: string;
  recordKey: string;
  riskLevel: string;
  safeSummary: string;
  severity: string;
  sourceModule: string;
  status: string;
  storeId: string;
  targetId: string;
  targetType: string;
  userId: string;
};

export type SecurityFiltersFacets = {
  eventType: string[];
  riskLevel: string[];
  severity: string[];
  sourceModule: string[];
  status: string[];
  targetType: string[];
};

export type SecurityFiltersDatasetDefinition = {
  key: SecurityFiltersDatasetKey;
  label: string;
  registryKey: string;
};

export type SecurityFiltersFieldDefinition = {
  enabled: true;
  key: keyof SecurityFiltersQuery;
  label: string;
  type: "date" | "select";
};

export type SecurityFiltersResult = {
  appliedFilterCount: number;
  dataset: SecurityFiltersScope;
  facets: SecurityFiltersFacets;
  filters: SecurityFiltersQuery;
  message: string;
  readOnly: true;
  resultCount: number;
  results: SecurityFiltersResultRow[];
  scannedCount: number;
  source: SecurityFiltersSource;
  state: SecurityFiltersState;
  truncated: boolean;
};

export type SecurityFiltersSupport = {
  datasets: SecurityFiltersDatasetDefinition[];
  defaultFilters: SecurityFiltersQuery;
  disabledReason: string | null;
  fields: SecurityFiltersFieldDefinition[];
  maxResults: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityFiltersSource;
  supported: boolean;
};

export type SecurityFiltersInput = {
  dataset?: SecurityFiltersScope | null;
  filters?: Partial<SecurityFiltersQuery> | null;
};

export type SecurityFiltersLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityFiltersSource;
};

export const SECURITY_FILTERS_SOURCE = "security_filters_runtime" as const;

export const SECURITY_FILTERS_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_FILTERS_MAX_RESULTS = 100 as const;

export const SECURITY_FILTERS_PAGE_SIZE = 100 as const;

export const SECURITY_FILTERS_MAX_SCAN = 1000 as const;

export const SECURITY_FILTERS_DISABLED_STATE =
  "Security Filters are not available in the current runtime configuration.";

export const SECURITY_FILTERS_DEFAULT_QUERY: SecurityFiltersQuery = {
  dateFrom: "",
  dateTo: "",
  eventType: "",
  riskLevel: "",
  severity: "",
  sourceModule: "",
  status: "",
  targetType: ""
};

export const SECURITY_FILTERS_DATASETS: readonly SecurityFiltersDatasetDefinition[] = [
  { key: "audit_logs", label: "Audit Logs", registryKey: "sec-audit-logs" },
  { key: "login_monitoring", label: "Login Monitoring", registryKey: "sec-login-monitoring" },
  { key: "ip_monitoring", label: "IP Monitoring", registryKey: "sec-ip-monitoring" },
  { key: "device_monitoring", label: "Device Monitoring", registryKey: "sec-device-monitoring" },
  { key: "abuse_detection", label: "Abuse Detection", registryKey: "sec-abuse-detection" },
  { key: "fraud_detection", label: "Fraud Detection", registryKey: "sec-fraud-detection" },
  { key: "rate_limits", label: "Rate Limits", registryKey: "sec-rate-limits" },
  { key: "risk_score", label: "Risk Score", registryKey: "sec-risk-score" },
  { key: "risk_levels", label: "Risk Levels", registryKey: "sec-risk-levels" },
  { key: "security_events", label: "Security Events", registryKey: "sec-security-events" }
] as const;

export const SECURITY_FILTERS_FIELDS: readonly SecurityFiltersFieldDefinition[] = [
  { enabled: true, key: "status", label: "Status", type: "select" },
  { enabled: true, key: "severity", label: "Severity", type: "select" },
  { enabled: true, key: "riskLevel", label: "Risk Level", type: "select" },
  { enabled: true, key: "sourceModule", label: "Source Module", type: "select" },
  { enabled: true, key: "eventType", label: "Event Type", type: "select" },
  { enabled: true, key: "targetType", label: "Target Type", type: "select" },
  { enabled: true, key: "dateFrom", label: "Date From", type: "date" },
  { enabled: true, key: "dateTo", label: "Date To", type: "date" }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function metadataOf(row: { metadata?: unknown }): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function safeText(value: unknown, maxLength = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, maxLength);
}

function maskEmail(value: unknown): string {
  const email = text(value).trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return "";
  }

  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "";
  }

  const maskedLocal = localPart.length <= 2 ? `${localPart.charAt(0)}*` : `${localPart.slice(0, 2)}***`;

  return `${maskedLocal}@${domain}`;
}

function readEmail(metadata: Record<string, unknown>): string {
  return (
    maskEmail(metadata.email) ||
    maskEmail(metadata.user_email) ||
    maskEmail(metadata.actor_email) ||
    maskEmail(metadata.actorEmail)
  );
}

function readRiskLevel(metadata: Record<string, unknown>): string {
  return text(metadata.risk_level) || text(metadata.riskLevel);
}

function readRiskLevelPresent(metadata: Record<string, unknown>): boolean {
  return (
    text(metadata.risk_level) !== "" ||
    text(metadata.riskLevel) !== "" ||
    Array.isArray(metadata.risk_levels) ||
    Array.isArray(metadata.riskLevels)
  );
}

export function resolveSecurityFiltersSupport(): SecurityFiltersSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_FILTERS_REGISTRY_KEY);

  const base = {
    datasets: SECURITY_FILTERS_DATASETS.map((dataset) => ({ ...dataset })),
    defaultFilters: { ...SECURITY_FILTERS_DEFAULT_QUERY },
    fields: SECURITY_FILTERS_FIELDS.map((field) => ({ ...field })),
    maxResults: SECURITY_FILTERS_MAX_RESULTS,
    readOnly: true as const,
    registryKey: SECURITY_FILTERS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_FILTERS_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "The advanced security center is not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

export function buildSecurityFiltersDefaultQuery(): SecurityFiltersQuery {
  return { ...SECURITY_FILTERS_DEFAULT_QUERY };
}

export function resetSecurityFilters(): SecurityFiltersQuery {
  return buildSecurityFiltersDefaultQuery();
}

export function normalizeSecurityFiltersQuery(
  filters: Partial<SecurityFiltersQuery> | null | undefined
): SecurityFiltersQuery {
  return {
    dateFrom: text(filters?.dateFrom).trim(),
    dateTo: text(filters?.dateTo).trim(),
    eventType: text(filters?.eventType).trim(),
    riskLevel: text(filters?.riskLevel).trim(),
    severity: text(filters?.severity).trim(),
    sourceModule: text(filters?.sourceModule).trim(),
    status: text(filters?.status).trim(),
    targetType: text(filters?.targetType).trim()
  };
}

function countAppliedFilters(filters: SecurityFiltersQuery): number {
  return Object.values(filters).filter((value) => value !== "").length;
}

function normalizeScope(dataset: SecurityFiltersScope | null | undefined): SecurityFiltersScope {
  if (!dataset || dataset === "all") {
    return "all";
  }

  return SECURITY_FILTERS_DATASETS.some((entry) => entry.key === dataset) ? dataset : "all";
}

type SecurityFiltersRawRow = {
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

function deriveDatasets(
  row: SecurityFiltersRawRow,
  flags: { ipAvailable: boolean; userAgentAvailable: boolean }
): SecurityFiltersDatasetKey[] {
  const datasets: SecurityFiltersDatasetKey[] = ["audit_logs", "security_events"];
  const action = text(row.action).toLowerCase();
  const metadata = metadataOf(row);

  if (SECURITY_LOGIN_MONITORING_ACTIONS.some((entry) => action.includes(entry.toLowerCase()))) {
    datasets.push("login_monitoring");
  }

  if (flags.ipAvailable) {
    datasets.push("ip_monitoring");
  }

  if (flags.userAgentAvailable) {
    datasets.push("device_monitoring");
  }

  if (classifyAbuseSignalType(row as SecurityAbuseRow) !== null) {
    datasets.push("abuse_detection");
  }

  if (isFraudSignalRow(row as SecurityFraudRow)) {
    datasets.push("fraud_detection");
  }

  if (isRateLimitRow(row as SecurityRateLimitRow)) {
    datasets.push("rate_limits");
  }

  if (hasRiskScoreData(row as SecurityRiskScoreRow)) {
    datasets.push("risk_score");
  }

  if (readRiskLevelPresent(metadata)) {
    datasets.push("risk_levels");
  }

  return datasets;
}

function buildFilterRow(row: SecurityFiltersRawRow, index: number): SecurityFiltersResultRow {
  const reviewed = new Set<string>();
  const eventRecord = mapSecurityEventRowToRecord(row as never, reviewed, index);
  const auditRecord = mapSecurityAuditLogRowToRecord(row as never, reviewed, index);
  const metadata = metadataOf(row);
  const datasets = deriveDatasets(row, {
    ipAvailable: auditRecord.ipAvailable,
    userAgentAvailable: auditRecord.userAgentAvailable
  });

  return {
    action: safeText(eventRecord.eventType),
    actor: safeText(eventRecord.actor ?? auditRecord.actor),
    createdAt: safeText(eventRecord.createdAt),
    datasets,
    emailMasked: readEmail(metadata),
    eventId: safeText(eventRecord.eventId),
    ipMasked: auditRecord.ipAvailable ? safeText(auditRecord.ipMasked) : "",
    recordKey: `security-filter-${safeText(eventRecord.eventId) || index}`,
    riskLevel: safeText(text(eventRecord.riskLevel) || readRiskLevel(metadata)),
    safeSummary: safeText(auditRecord.safeSummary),
    severity: safeText(eventRecord.severity),
    sourceModule: safeText(eventRecord.sourceModule),
    status: safeText(eventRecord.status),
    storeId: safeText(eventRecord.storeId ?? ""),
    targetId: safeText(auditRecord.targetId ?? ""),
    targetType: safeText(auditRecord.targetType),
    userId: safeText(eventRecord.userId ?? "")
  };
}

function parseDateBoundary(value: string, endOfDay: boolean): number | null {
  if (!value) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const normalized = isDateOnly ? `${value}T${endOfDay ? "23:59:59.999Z" : "00:00:00.000Z"}` : value;
  const parsed = Date.parse(normalized);

  return Number.isNaN(parsed) ? null : parsed;
}

function matchesFilters(record: SecurityFiltersResultRow, filters: SecurityFiltersQuery): boolean {
  const equals = (recordValue: string, filterValue: string) =>
    filterValue === "" || recordValue.toLowerCase() === filterValue.toLowerCase();
  const includes = (recordValue: string, filterValue: string) =>
    filterValue === "" || recordValue.toLowerCase().includes(filterValue.toLowerCase());

  if (!equals(record.status, filters.status)) {
    return false;
  }

  if (!equals(record.severity, filters.severity)) {
    return false;
  }

  if (!equals(record.riskLevel, filters.riskLevel)) {
    return false;
  }

  if (!equals(record.sourceModule, filters.sourceModule)) {
    return false;
  }

  if (!includes(record.action, filters.eventType)) {
    return false;
  }

  if (!equals(record.targetType, filters.targetType)) {
    return false;
  }

  const fromMs = parseDateBoundary(filters.dateFrom, false);
  const toMs = parseDateBoundary(filters.dateTo, true);

  if (fromMs !== null || toMs !== null) {
    const createdMs = Date.parse(record.createdAt);

    if (Number.isNaN(createdMs)) {
      return false;
    }

    if (fromMs !== null && createdMs < fromMs) {
      return false;
    }

    if (toMs !== null && createdMs > toMs) {
      return false;
    }
  }

  return true;
}

function emptyFacets(): SecurityFiltersFacets {
  return {
    eventType: [],
    riskLevel: [],
    severity: [],
    sourceModule: [],
    status: [],
    targetType: []
  };
}

function collectFacets(records: SecurityFiltersResultRow[]): SecurityFiltersFacets {
  const status = new Set<string>();
  const severity = new Set<string>();
  const riskLevel = new Set<string>();
  const sourceModule = new Set<string>();
  const eventType = new Set<string>();
  const targetType = new Set<string>();

  for (const record of records) {
    if (record.status) status.add(record.status);
    if (record.severity) severity.add(record.severity);
    if (record.riskLevel) riskLevel.add(record.riskLevel);
    if (record.sourceModule) sourceModule.add(record.sourceModule);
    if (record.action) eventType.add(record.action);
    if (record.targetType) targetType.add(record.targetType);
  }

  const sorted = (values: Set<string>) => Array.from(values).sort((left, right) => left.localeCompare(right));

  return {
    eventType: sorted(eventType),
    riskLevel: sorted(riskLevel),
    severity: sorted(severity),
    sourceModule: sorted(sourceModule),
    status: sorted(status),
    targetType: sorted(targetType)
  };
}

export function buildSecurityFiltersLoadingState(): SecurityFiltersLoadingState {
  return {
    loading: true,
    message: "Applying read-only filters across the security datasets.",
    readOnly: true,
    source: SECURITY_FILTERS_SOURCE
  };
}

function buildResult(
  state: SecurityFiltersState,
  dataset: SecurityFiltersScope,
  filters: SecurityFiltersQuery,
  message: string,
  extra: Partial<SecurityFiltersResult> = {}
): SecurityFiltersResult {
  return {
    appliedFilterCount: countAppliedFilters(filters),
    dataset,
    facets: emptyFacets(),
    filters,
    message,
    readOnly: true,
    resultCount: 0,
    results: [],
    scannedCount: 0,
    source: SECURITY_FILTERS_SOURCE,
    state,
    truncated: false,
    ...extra
  };
}

export async function runSecurityFilters(input: SecurityFiltersInput): Promise<SecurityFiltersResult> {
  const dataset = normalizeScope(input.dataset);
  const filters = normalizeSecurityFiltersQuery(input.filters);
  const support = resolveSecurityFiltersSupport();

  if (!support.supported) {
    return buildResult("disabled", dataset, filters, support.disabledReason ?? SECURITY_FILTERS_DISABLED_STATE);
  }

  try {
    const scopeRecords: SecurityFiltersResultRow[] = [];
    const results: SecurityFiltersResultRow[] = [];
    let scannedCount = 0;
    let truncated = false;
    let page = 1;

    while (scannedCount < SECURITY_FILTERS_MAX_SCAN) {
      const inputRows = await fetchSecurityEventsInput({ page, pageSize: SECURITY_FILTERS_PAGE_SIZE });

      if (inputRows.loadError) {
        return buildResult("error", dataset, filters, `Unable to apply security filters: ${inputRows.loadError}`);
      }

      if (inputRows.logs.length === 0) {
        break;
      }

      for (let index = 0; index < inputRows.logs.length; index += 1) {
        scannedCount += 1;
        const record = buildFilterRow(inputRows.logs[index] as SecurityFiltersRawRow, index);

        if (dataset !== "all" && !record.datasets.includes(dataset)) {
          continue;
        }

        scopeRecords.push(record);

        if (!matchesFilters(record, filters)) {
          continue;
        }

        if (results.length >= SECURITY_FILTERS_MAX_RESULTS) {
          truncated = true;
          continue;
        }

        results.push(record);
      }

      if (inputRows.logs.length < SECURITY_FILTERS_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    const facets = collectFacets(scopeRecords);

    if (results.length === 0) {
      return buildResult("empty", dataset, filters, "No security records matched the selected filters.", {
        facets,
        scannedCount
      });
    }

    return buildResult("success", dataset, filters, `${results.length} security record(s) matched the selected filters.`, {
      facets,
      resultCount: results.length,
      results,
      scannedCount,
      truncated
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while applying security filters.";
    return buildResult("error", dataset, filters, `Unable to apply security filters: ${message}`);
  }
}
