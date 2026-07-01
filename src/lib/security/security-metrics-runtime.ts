import "server-only";

import {
  classifyAbuseSignalType,
  type SecurityAbuseRow
} from "@/src/lib/security/security-abuse-detection-runtime";
import {
  fetchSecurityEventsInput,
  mapSecurityEventRowToRecord,
  type SecurityEventRow
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
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  hasRiskScoreData,
  type SecurityRiskScoreRow
} from "@/src/lib/security/security-risk-score-runtime";

export type SecurityMetricsSource = "security_metrics_runtime";

export type SecurityMetricsState = "disabled" | "empty" | "error" | "success";

export type SecurityMetricKey =
  | "abuseSignalCount"
  | "activeRateLimitRules"
  | "deviceActivityCount"
  | "failedLoginEvents"
  | "fraudSignalCount"
  | "highRiskTargets"
  | "reviewedEventCount"
  | "securityEventCount"
  | "suspiciousIpCount"
  | "totalAuditLogs"
  | "totalLoginEvents"
  | "unresolvedEventCount";

export type SecurityMetric = {
  available: boolean;
  exact: boolean;
  key: SecurityMetricKey;
  label: string;
  note: string;
  registryKey: string;
  value: number | null;
};

export type SecurityMetricDefinition = {
  exact: boolean;
  key: SecurityMetricKey;
  label: string;
  registryKey: string;
};

export type SecurityMetricsResult = {
  availableMetricCount: number;
  exact: boolean;
  message: string;
  metrics: SecurityMetric[];
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  sampled: boolean;
  scannedCount: number;
  source: SecurityMetricsSource;
  state: SecurityMetricsState;
  totalRecordCount: number | null;
};

export type SecurityMetricsSupport = {
  disabledReason: string | null;
  maxScan: number;
  metrics: SecurityMetricDefinition[];
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityMetricsSource;
  supported: boolean;
};

export type SecurityMetricsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityMetricsSource;
};

export const SECURITY_METRICS_SOURCE = "security_metrics_runtime" as const;

export const SECURITY_METRICS_REGISTRY_KEY = "sec-advanced-security-center" as const;

export const SECURITY_METRICS_PAGE_SIZE = 100 as const;

export const SECURITY_METRICS_MAX_SCAN = 1000 as const;

export const SECURITY_METRICS_REVIEW_ACTION = "security.event.reviewed" as const;

export const SECURITY_METRICS_DISABLED_STATE =
  "Security Metrics are not available in the current runtime configuration.";

export const SECURITY_METRIC_DEFINITIONS: readonly SecurityMetricDefinition[] = [
  { exact: true, key: "totalAuditLogs", label: "Total Audit Logs", registryKey: "sec-audit-logs" },
  { exact: false, key: "totalLoginEvents", label: "Total Login Events", registryKey: "sec-login-monitoring" },
  { exact: false, key: "failedLoginEvents", label: "Failed Login Events", registryKey: "sec-login-monitoring" },
  { exact: false, key: "suspiciousIpCount", label: "Suspicious IPs", registryKey: "sec-ip-monitoring" },
  { exact: false, key: "deviceActivityCount", label: "Device Activity", registryKey: "sec-device-monitoring" },
  { exact: false, key: "abuseSignalCount", label: "Abuse Signals", registryKey: "sec-abuse-detection" },
  { exact: false, key: "fraudSignalCount", label: "Fraud Signals", registryKey: "sec-fraud-detection" },
  { exact: false, key: "activeRateLimitRules", label: "Active Rate-Limit Rules", registryKey: "sec-rate-limits" },
  { exact: false, key: "highRiskTargets", label: "High Risk Targets", registryKey: "sec-risk-levels" },
  { exact: true, key: "securityEventCount", label: "Security Events", registryKey: "sec-security-events" },
  { exact: false, key: "reviewedEventCount", label: "Reviewed Events", registryKey: "sec-security-events" },
  { exact: false, key: "unresolvedEventCount", label: "Unresolved Events", registryKey: "sec-security-events" }
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function metadataOf(row: SecurityEventRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function isReviewMarker(row: SecurityEventRow): boolean {
  return text(row.action).toLowerCase() === SECURITY_METRICS_REVIEW_ACTION;
}

function reviewedEventId(row: SecurityEventRow): string {
  const metadata = metadataOf(row);
  return text(metadata.event_id) || text(metadata.eventId);
}

function isLoginRow(row: SecurityEventRow): boolean {
  const action = text(row.action).toLowerCase();
  return SECURITY_LOGIN_MONITORING_ACTIONS.some((entry) => action.includes(entry.toLowerCase()));
}

function isFailedLoginRow(row: SecurityEventRow): boolean {
  if (!isLoginRow(row)) {
    return false;
  }

  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();
  return action.includes("fail") || action.includes("denied") || reason.includes("fail");
}

function readRiskLevel(row: SecurityEventRow): string {
  const metadata = metadataOf(row);
  return (text(metadata.risk_level) || text(metadata.riskLevel)).toLowerCase();
}

function isHighRiskRow(row: SecurityEventRow): boolean {
  const riskLevel = readRiskLevel(row);
  return riskLevel === "high" || riskLevel === "critical" || riskLevel === "severe";
}

function rateLimitRuleKey(row: SecurityEventRow): string {
  const metadata = metadataOf(row);
  return text(metadata.rule_key) || text(metadata.action) || text(row.route) || text(row.action, "rate_limit");
}

function isSuspiciousRow(row: SecurityEventRow): boolean {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  return (
    action.includes("suspicious") ||
    action.includes("denied") ||
    action.includes("blocked") ||
    action.includes("unauthorized") ||
    reason.includes("suspicious") ||
    classifyAbuseSignalType(row as SecurityAbuseRow) !== null ||
    isFraudSignalRow(row as SecurityFraudRow)
  );
}

function targetIdentity(row: SecurityEventRow): string {
  return text(row.user_id) || text(row.store_id) || text(row.ip_address);
}

export function resolveSecurityMetricsSupport(): SecurityMetricsSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_METRICS_REGISTRY_KEY);

  const base = {
    maxScan: SECURITY_METRICS_MAX_SCAN,
    metrics: SECURITY_METRIC_DEFINITIONS.map((definition) => ({ ...definition })),
    readOnly: true as const,
    registryKey: SECURITY_METRICS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_METRICS_SOURCE
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

export function buildSecurityMetricsLoadingState(): SecurityMetricsLoadingState {
  return {
    loading: true,
    message: "Calculating read-only security metrics from existing security datasets.",
    readOnly: true,
    source: SECURITY_METRICS_SOURCE
  };
}

type SecurityMetricsTally = {
  abuseSignalCount: number;
  activeRateLimitRuleKeys: Set<string>;
  deviceLabels: Set<string>;
  failedLoginEvents: number;
  fraudSignalCount: number;
  highRiskTargets: Set<string>;
  loginEvents: number;
  reviewedEventIds: Set<string>;
  scannedEventRows: number;
  suspiciousIps: Set<string>;
  unresolvedEventIds: Set<string>;
};

function createTally(): SecurityMetricsTally {
  return {
    abuseSignalCount: 0,
    activeRateLimitRuleKeys: new Set<string>(),
    deviceLabels: new Set<string>(),
    failedLoginEvents: 0,
    fraudSignalCount: 0,
    highRiskTargets: new Set<string>(),
    loginEvents: 0,
    reviewedEventIds: new Set<string>(),
    scannedEventRows: 0,
    suspiciousIps: new Set<string>(),
    unresolvedEventIds: new Set<string>()
  };
}

function accumulateRow(tally: SecurityMetricsTally, row: SecurityEventRow, index: number): void {
  if (isReviewMarker(row)) {
    const eventId = reviewedEventId(row);

    if (eventId) {
      tally.reviewedEventIds.add(eventId);
    }

    return;
  }

  tally.scannedEventRows += 1;

  const record = mapSecurityEventRowToRecord(row, new Set<string>(), index);
  const eventId = text(row.id) || record.eventId;

  if (eventId) {
    tally.unresolvedEventIds.add(eventId);
  }

  if (isLoginRow(row)) {
    tally.loginEvents += 1;

    if (isFailedLoginRow(row)) {
      tally.failedLoginEvents += 1;
    }
  }

  if (record.ipAvailable && isSuspiciousRow(row)) {
    tally.suspiciousIps.add(record.ipMasked);
  }

  if (record.deviceLabel) {
    tally.deviceLabels.add(record.deviceLabel);
  }

  if (classifyAbuseSignalType(row as SecurityAbuseRow) !== null) {
    tally.abuseSignalCount += 1;
  }

  if (isFraudSignalRow(row as SecurityFraudRow)) {
    tally.fraudSignalCount += 1;
  }

  if (isRateLimitRow(row as SecurityRateLimitRow)) {
    tally.activeRateLimitRuleKeys.add(rateLimitRuleKey(row));
  }

  if (isHighRiskRow(row) || hasRiskScoreData(row as SecurityRiskScoreRow)) {
    const target = targetIdentity(row);

    if (target && (isHighRiskRow(row) || record.severity === "critical")) {
      tally.highRiskTargets.add(target);
    }
  }
}

function buildMetric(
  definition: SecurityMetricDefinition,
  value: number | null,
  available: boolean,
  note: string
): SecurityMetric {
  return {
    available,
    exact: definition.exact,
    key: definition.key,
    label: definition.label,
    note,
    registryKey: definition.registryKey,
    value: available ? value : null
  };
}

function buildMetrics(
  tally: SecurityMetricsTally,
  totalRecordCount: number | null,
  available: boolean
): SecurityMetric[] {
  const sampledNote = "Derived from the most recent security records within the safe scan limit.";
  const exactNote = "Exact count from the existing security audit dataset.";
  const unavailableNote = "Dataset unavailable; showing a safe fallback value.";

  const resolvedUnresolved = Array.from(tally.unresolvedEventIds).filter(
    (eventId) => !tally.reviewedEventIds.has(eventId)
  ).length;

  const values: Record<SecurityMetricKey, number> = {
    abuseSignalCount: tally.abuseSignalCount,
    activeRateLimitRules: tally.activeRateLimitRuleKeys.size,
    deviceActivityCount: tally.deviceLabels.size,
    failedLoginEvents: tally.failedLoginEvents,
    fraudSignalCount: tally.fraudSignalCount,
    highRiskTargets: tally.highRiskTargets.size,
    reviewedEventCount: tally.reviewedEventIds.size,
    securityEventCount: totalRecordCount ?? 0,
    suspiciousIpCount: tally.suspiciousIps.size,
    totalAuditLogs: totalRecordCount ?? 0,
    totalLoginEvents: tally.loginEvents,
    unresolvedEventCount: resolvedUnresolved
  };

  return SECURITY_METRIC_DEFINITIONS.map((definition) => {
    if (!available) {
      return buildMetric(definition, null, false, unavailableNote);
    }

    if (definition.exact && totalRecordCount === null) {
      return buildMetric(definition, null, false, unavailableNote);
    }

    return buildMetric(definition, values[definition.key], true, definition.exact ? exactNote : sampledNote);
  });
}

function buildResult(
  state: SecurityMetricsState,
  metrics: SecurityMetric[],
  message: string,
  extra: Partial<SecurityMetricsResult> = {}
): SecurityMetricsResult {
  const availableMetricCount = metrics.filter((metric) => metric.available).length;

  return {
    availableMetricCount,
    exact: false,
    message,
    metrics,
    readOnly: true,
    registryKey: SECURITY_METRICS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    sampled: false,
    scannedCount: 0,
    source: SECURITY_METRICS_SOURCE,
    state,
    totalRecordCount: null,
    ...extra
  };
}

export async function runSecurityMetrics(): Promise<SecurityMetricsResult> {
  const support = resolveSecurityMetricsSupport();

  if (!support.supported) {
    return buildResult("disabled", buildMetrics(createTally(), null, false), support.disabledReason ?? SECURITY_METRICS_DISABLED_STATE);
  }

  try {
    const tally = createTally();
    let scannedCount = 0;
    let totalRecordCount: number | null = null;
    let page = 1;

    while (scannedCount < SECURITY_METRICS_MAX_SCAN) {
      const inputRows = await fetchSecurityEventsInput({ page, pageSize: SECURITY_METRICS_PAGE_SIZE });

      if (inputRows.loadError) {
        return buildResult(
          "error",
          buildMetrics(createTally(), null, false),
          `Unable to calculate security metrics: ${inputRows.loadError}`
        );
      }

      if (page === 1) {
        totalRecordCount = typeof inputRows.totalCount === "number" ? inputRows.totalCount : null;
      }

      if (inputRows.logs.length === 0) {
        break;
      }

      for (let index = 0; index < inputRows.logs.length; index += 1) {
        scannedCount += 1;
        accumulateRow(tally, inputRows.logs[index], index);
      }

      if (inputRows.logs.length < SECURITY_METRICS_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    const metrics = buildMetrics(tally, totalRecordCount, true);
    const sampled = totalRecordCount !== null && totalRecordCount > scannedCount;

    if (scannedCount === 0 && (totalRecordCount === null || totalRecordCount === 0)) {
      return buildResult("empty", metrics, "No security records are available to calculate metrics.", {
        scannedCount,
        totalRecordCount
      });
    }

    return buildResult("success", metrics, `Calculated ${metrics.filter((metric) => metric.available).length} security metric(s).`, {
      exact: !sampled,
      sampled,
      scannedCount,
      totalRecordCount
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while calculating security metrics.";
    return buildResult("error", buildMetrics(createTally(), null, false), `Unable to calculate security metrics: ${message}`);
  }
}
