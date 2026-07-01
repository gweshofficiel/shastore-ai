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

export type SecuritySearchSource = "security_search_runtime";

export type SecuritySearchDatasetKey =
  | "abuse_detection"
  | "audit_logs"
  | "device_monitoring"
  | "fraud_detection"
  | "ip_monitoring"
  | "login_monitoring"
  | "rate_limits"
  | "risk_levels"
  | "risk_score"
  | "security_events";

export type SecuritySearchScope = "all" | SecuritySearchDatasetKey;

export type SecuritySearchState = "disabled" | "empty" | "error" | "idle" | "success";

export type SecuritySearchResultRow = {
  action: string;
  actor: string;
  createdAt: string;
  datasets: SecuritySearchDatasetKey[];
  emailMasked: string;
  eventId: string;
  ipMasked: string;
  recordKey: string;
  safeSummary: string;
  severity: string;
  sourceModule: string;
  status: string;
  storeId: string;
  targetId: string;
  targetType: string;
  userId: string;
};

export type SecuritySearchDatasetDefinition = {
  key: SecuritySearchDatasetKey;
  label: string;
  registryKey: string;
};

export type SecuritySearchResult = {
  dataset: SecuritySearchScope;
  message: string;
  query: string;
  readOnly: true;
  resultCount: number;
  results: SecuritySearchResultRow[];
  scannedCount: number;
  source: SecuritySearchSource;
  state: SecuritySearchState;
  truncated: boolean;
};

export type SecuritySearchSupport = {
  datasets: SecuritySearchDatasetDefinition[];
  debounceMs: number;
  disabledReason: string | null;
  maxResults: number;
  minQueryLength: number;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecuritySearchSource;
  supported: boolean;
};

export type SecuritySearchInput = {
  dataset?: SecuritySearchScope | null;
  query: string;
};

export type SecuritySearchLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecuritySearchSource;
};

export const SECURITY_SEARCH_SOURCE = "security_search_runtime" as const;

export const SECURITY_SEARCH_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_SEARCH_MIN_QUERY_LENGTH = 2 as const;

export const SECURITY_SEARCH_DEBOUNCE_MS = 300 as const;

export const SECURITY_SEARCH_MAX_RESULTS = 100 as const;

export const SECURITY_SEARCH_PAGE_SIZE = 100 as const;

export const SECURITY_SEARCH_MAX_SCAN = 1000 as const;

export const SECURITY_SEARCH_DISABLED_STATE =
  "Security Search is not available in the current runtime configuration.";

export const SECURITY_SEARCH_DATASETS: readonly SecuritySearchDatasetDefinition[] = [
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

  const maskedLocal =
    localPart.length <= 2 ? `${localPart.charAt(0)}*` : `${localPart.slice(0, 2)}***`;

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

function readRiskLevelPresent(metadata: Record<string, unknown>): boolean {
  return (
    text(metadata.risk_level) !== "" ||
    text(metadata.riskLevel) !== "" ||
    Array.isArray(metadata.risk_levels) ||
    Array.isArray(metadata.riskLevels)
  );
}

export function resolveSecuritySearchSupport(): SecuritySearchSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_SEARCH_REGISTRY_KEY);

  const base = {
    datasets: SECURITY_SEARCH_DATASETS.map((dataset) => ({ ...dataset })),
    debounceMs: SECURITY_SEARCH_DEBOUNCE_MS,
    maxResults: SECURITY_SEARCH_MAX_RESULTS,
    minQueryLength: SECURITY_SEARCH_MIN_QUERY_LENGTH,
    readOnly: true as const,
    registryKey: SECURITY_SEARCH_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_SEARCH_SOURCE
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

function normalizeScope(dataset: SecuritySearchScope | null | undefined): SecuritySearchScope {
  if (!dataset) {
    return "all";
  }

  if (dataset === "all") {
    return "all";
  }

  return SECURITY_SEARCH_DATASETS.some((entry) => entry.key === dataset) ? dataset : "all";
}

type SecuritySearchRawRow = {
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
  row: SecuritySearchRawRow,
  flags: { ipAvailable: boolean; userAgentAvailable: boolean }
): SecuritySearchDatasetKey[] {
  const datasets: SecuritySearchDatasetKey[] = ["audit_logs", "security_events"];
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

function buildSearchRow(row: SecuritySearchRawRow, index: number): SecuritySearchResultRow {
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
    recordKey: `security-search-${safeText(eventRecord.eventId) || index}`,
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

function rowMatchesQuery(record: SecuritySearchResultRow, query: string): boolean {
  const haystack = [
    record.eventId,
    record.action,
    record.status,
    record.severity,
    record.sourceModule,
    record.targetType,
    record.targetId,
    record.userId,
    record.storeId,
    record.ipMasked,
    record.emailMasked,
    record.createdAt,
    record.actor,
    record.safeSummary
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function buildSecuritySearchIdleResult(dataset: SecuritySearchScope = "all"): SecuritySearchResult {
  return {
    dataset,
    message: `Enter at least ${SECURITY_SEARCH_MIN_QUERY_LENGTH} characters to search read-only security datasets.`,
    query: "",
    readOnly: true,
    resultCount: 0,
    results: [],
    scannedCount: 0,
    source: SECURITY_SEARCH_SOURCE,
    state: "idle",
    truncated: false
  };
}

function buildResult(
  state: SecuritySearchState,
  query: string,
  dataset: SecuritySearchScope,
  message: string,
  extra: Partial<SecuritySearchResult> = {}
): SecuritySearchResult {
  return {
    dataset,
    message,
    query,
    readOnly: true,
    resultCount: 0,
    results: [],
    scannedCount: 0,
    source: SECURITY_SEARCH_SOURCE,
    state,
    truncated: false,
    ...extra
  };
}

export function buildSecuritySearchLoadingState(): SecuritySearchLoadingState {
  return {
    loading: true,
    message: "Searching the read-only security datasets.",
    readOnly: true,
    source: SECURITY_SEARCH_SOURCE
  };
}

export async function runSecuritySearch(input: SecuritySearchInput): Promise<SecuritySearchResult> {
  const dataset = normalizeScope(input.dataset);
  const query = text(input.query).trim().toLowerCase();

  const support = resolveSecuritySearchSupport();

  if (!support.supported) {
    return buildResult("disabled", query, dataset, support.disabledReason ?? SECURITY_SEARCH_DISABLED_STATE);
  }

  if (query.length < SECURITY_SEARCH_MIN_QUERY_LENGTH) {
    return {
      ...buildSecuritySearchIdleResult(dataset),
      query
    };
  }

  try {
    const results: SecuritySearchResultRow[] = [];
    let scannedCount = 0;
    let truncated = false;
    let page = 1;

    while (scannedCount < SECURITY_SEARCH_MAX_SCAN && results.length < SECURITY_SEARCH_MAX_RESULTS) {
      const inputRows = await fetchSecurityEventsInput({ page, pageSize: SECURITY_SEARCH_PAGE_SIZE });

      if (inputRows.loadError) {
        return buildResult("error", query, dataset, `Unable to search security datasets: ${inputRows.loadError}`);
      }

      if (inputRows.logs.length === 0) {
        break;
      }

      for (let index = 0; index < inputRows.logs.length; index += 1) {
        scannedCount += 1;
        const record = buildSearchRow(inputRows.logs[index] as SecuritySearchRawRow, index);

        if (dataset !== "all" && !record.datasets.includes(dataset)) {
          continue;
        }

        if (!rowMatchesQuery(record, query)) {
          continue;
        }

        if (results.length >= SECURITY_SEARCH_MAX_RESULTS) {
          truncated = true;
          break;
        }

        results.push(record);
      }

      if (inputRows.logs.length < SECURITY_SEARCH_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    if (results.length === 0) {
      return buildResult("empty", query, dataset, "No security records matched the search query.", {
        scannedCount
      });
    }

    return buildResult("success", query, dataset, `${results.length} security record(s) matched the search query.`, {
      resultCount: results.length,
      results,
      scannedCount,
      truncated
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while searching security datasets.";
    return buildResult("error", query, dataset, `Unable to search security datasets: ${message}`);
  }
}
