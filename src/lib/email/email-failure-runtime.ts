import "server-only";

import {
  buildEmailRetryRuntimeSummarySafe,
  getEmailRetryReadinessStateLabel,
  resolveEmailRetryStateForLogSafe,
  type EmailRetryLogSnapshot,
  type EmailRetryReadinessState
} from "@/src/lib/email/email-retry-runtime";
import {
  buildEmailQueueRuntimeSummarySafe,
  parseEmailQueueRuntimeStateSafe
} from "@/src/lib/email/email-queue-runtime";

type EmailFailureRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
  status?: string | null;
};

export type EmailFailureLogSnapshot = EmailRetryLogSnapshot & {
  error_message?: string | null;
  id?: string | null;
  last_error?: string | null;
  subject?: string | null;
  template_key?: string | null;
};

export type EmailFailureState =
  | "failed"
  | "no_failures"
  | "provider_error"
  | "recipient_error"
  | "retry_exhausted"
  | "retry_pending"
  | "template_error"
  | "unknown";

export type EmailFailureRuntimeRecord = {
  errorCategoryLabel: string;
  failureState: EmailFailureState;
  failureStateLabel: string;
  id: string;
  lastFailureLabel: string;
  metadataSummary: string;
  retryReadinessState: EmailRetryReadinessState | "unknown";
  retryReadinessStateLabel: string;
  sanitizedErrorSummary: string;
  templateKey: string;
};

export type EmailFailureRuntimeSummary = {
  errorCategoryLabel: string;
  failedCount: number;
  failureState: EmailFailureState;
  failureStateLabel: string;
  lastFailureLabel: string;
  metadataSummary: string;
  retryReadinessState: EmailRetryReadinessState | "unknown";
  retryReadinessStateLabel: string;
  sanitizedErrorSummary: string;
};

export type EmailFailureRuntimeStats = {
  failedFailureItems: number;
  noFailuresItems: number;
  providerErrorFailureItems: number;
  recipientErrorFailureItems: number;
  retryExhaustedFailureItems: number;
  retryPendingFailureItems: number;
  templateErrorFailureItems: number;
  unknownFailureItems: number;
};

export const EMAIL_FAILURE_STATES: readonly EmailFailureState[] = [
  "no_failures",
  "failed",
  "retry_pending",
  "retry_exhausted",
  "provider_error",
  "template_error",
  "recipient_error",
  "unknown"
] as const;

const failureStateLabels: Record<EmailFailureState, string> = {
  failed: "Failed email foundation",
  no_failures: "No failures recorded",
  provider_error: "Provider-related failure",
  recipient_error: "Recipient-related failure",
  retry_exhausted: "Retry exhausted failure",
  retry_pending: "Retry pending failure",
  template_error: "Template-related failure",
  unknown: "Unknown failure state"
};

const failureStateDescriptions: Record<EmailFailureState, string> = {
  failed: "Failed email entries are visible in read-only logs. No failure recovery connected.",
  no_failures: "No failed platform or store email log entries found in read-only foundation data.",
  provider_error: "Provider-related failure indicators found in sanitized read-only logs. No provider calls connected.",
  recipient_error: "Recipient-related failure indicators found in sanitized read-only logs. No recipient data exposed.",
  retry_exhausted: "Retry exhausted failure indicators found in read-only foundation data. No retry execution connected.",
  retry_pending: "Retry pending failure indicators found in read-only logs. No retry execution connected.",
  template_error: "Template-related failure indicators found in sanitized read-only logs.",
  unknown: "Failure state could not be resolved safely."
};

const UNSAFE_SUMMARY_PATTERN =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|authorization:\s*bearer|bearer\s+[a-z0-9._-]{8,})/i;

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSafeDateLabel(value: unknown, fallback: string) {
  const raw = text(value, 80);
  if (!raw) return fallback;

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().slice(0, 10);
}

export function sanitizeEmailFailureSummarySafe(value: unknown, maxLength = 180) {
  const raw = text(value, maxLength + 120);
  if (!raw) {
    return "No error summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(UNSAFE_SUMMARY_PATTERN, "[redacted-secret]")
    .slice(0, maxLength);
}

export function getEmailFailureStateLabel(state: EmailFailureState) {
  return failureStateLabels[state];
}

export function getEmailFailureStateDescription(state: EmailFailureState) {
  return failureStateDescriptions[state];
}

export function resolveEmailFailureErrorCategoryLabel(state: EmailFailureState) {
  switch (state) {
    case "provider_error":
      return "Provider error category";
    case "recipient_error":
      return "Recipient error category";
    case "template_error":
      return "Template error category";
    case "retry_exhausted":
      return "Retry exhausted category";
    case "retry_pending":
      return "Retry pending category";
    case "failed":
      return "General failure category";
    case "no_failures":
      return "No failure category";
    default:
      return "Unknown failure category";
  }
}

export function resolveEmailFailureStateForLogSafe(log: EmailFailureLogSnapshot): EmailFailureState {
  const queueState = parseEmailQueueRuntimeStateSafe(log.status);
  const retryState = resolveEmailRetryStateForLogSafe(log);
  const sanitized = sanitizeEmailFailureSummarySafe(log.last_error || log.error_message, 500).toLowerCase();

  if (queueState === "retry_pending" || retryState === "retry_pending") {
    return "retry_pending";
  }

  if (retryState === "retry_exhausted") {
    return "retry_exhausted";
  }

  if (queueState !== "failed" && retryState !== "failed") {
    return "unknown";
  }

  if (
    /(?:resend|smtp|provider|api key|unauthorized|forbidden|rate limit|429|5\d\d)/i.test(sanitized)
  ) {
    return "provider_error";
  }

  if (/(?:recipient|bounce|mailbox|invalid email|undeliverable|suppressed)/i.test(sanitized)) {
    return "recipient_error";
  }

  if (/(?:template|subject|body|variable|render|missing template)/i.test(sanitized)) {
    return "template_error";
  }

  if (queueState === "failed" || retryState === "failed") {
    return "failed";
  }

  return "unknown";
}

export function resolveEmailFailureAggregateStateSafe(params: {
  dominantFailureState: EmailFailureState;
  failedCount: number;
  retryPendingCount: number;
}): EmailFailureState {
  const { dominantFailureState, failedCount, retryPendingCount } = params;

  if (!failedCount && !retryPendingCount) {
    return "no_failures";
  }

  if (retryPendingCount > 0 && failedCount === 0) {
    return "retry_pending";
  }

  return dominantFailureState === "unknown" && failedCount > 0 ? "failed" : dominantFailureState;
}

function buildFailureMetadataSummary(failureState: EmailFailureState) {
  return `${failureStateDescriptions[failureState]} Failure readiness foundation only.`;
}

function buildFailureRecordSafe(log: EmailFailureLogSnapshot, index: number): EmailFailureRuntimeRecord | null {
  try {
    const failureState = resolveEmailFailureStateForLogSafe(log);
    const retryState = resolveEmailRetryStateForLogSafe(log);
    const templateKey = text(log.template_key, 160) || text(log.subject, 120) || "unknown-template";
    const id = text(log.id, 120) || `failure-record:${index}`;

    return {
      errorCategoryLabel: resolveEmailFailureErrorCategoryLabel(failureState),
      failureState,
      failureStateLabel: getEmailFailureStateLabel(failureState),
      id,
      lastFailureLabel: `Last failure ${formatSafeDateLabel(log.created_at, "Failure timestamp unavailable")}`,
      metadataSummary: buildFailureMetadataSummary(failureState),
      retryReadinessState: retryState,
      retryReadinessStateLabel:
        retryState === "unknown" ? "Unknown retry readiness" : getEmailRetryReadinessStateLabel(retryState),
      sanitizedErrorSummary: sanitizeEmailFailureSummarySafe(log.last_error || log.error_message),
      templateKey
    };
  } catch (error) {
    console.error("[email-failure-runtime] failure record build failed", error);
    return null;
  }
}

export function buildEmailFailureRuntimeRecordsSafe(
  logs: EmailFailureLogSnapshot[] | null | undefined
): EmailFailureRuntimeRecord[] {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];

    return snapshots
      .filter((log) => {
        const state = parseEmailQueueRuntimeStateSafe(log.status);
        return state === "failed" || state === "retry_pending";
      })
      .sort((left, right) => dateValue(text(right.created_at, 80)) - dateValue(text(left.created_at, 80)))
      .slice(0, 25)
      .map((log, index) => buildFailureRecordSafe(log, index))
      .filter((record): record is EmailFailureRuntimeRecord => Boolean(record));
  } catch (error) {
    console.error("[email-failure-runtime] failure records build failed", error);
    return [];
  }
}

export function buildEmailFailureRuntimeSummarySafe(
  logs: EmailFailureLogSnapshot[] | null | undefined,
  registryItems?: EmailFailureRegistryItem[] | null
): EmailFailureRuntimeSummary {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const queueSummary = buildEmailQueueRuntimeSummarySafe(snapshots, registryItems);
    const retrySummary = buildEmailRetryRuntimeSummarySafe(snapshots, registryItems);
    const records = buildEmailFailureRuntimeRecordsSafe(snapshots);
    const failedCount = queueSummary.failedCount;
    const retryPendingCount = queueSummary.retryPendingCount;
    const dominantFailureState =
      records[0]?.failureState ??
      (retryPendingCount > 0 ? "retry_pending" : failedCount > 0 ? "failed" : "no_failures");
    const failureState = resolveEmailFailureAggregateStateSafe({
      dominantFailureState,
      failedCount,
      retryPendingCount
    });

    const latestFailureTimestamp = snapshots
      .filter((log) => {
        const state = parseEmailQueueRuntimeStateSafe(log.status);
        return state === "failed" || state === "retry_pending";
      })
      .map((log) => text(log.created_at, 80))
      .filter(Boolean)
      .sort((left, right) => dateValue(right) - dateValue(left))[0];

    return {
      errorCategoryLabel: resolveEmailFailureErrorCategoryLabel(failureState),
      failedCount,
      failureState,
      failureStateLabel: getEmailFailureStateLabel(failureState),
      lastFailureLabel: latestFailureTimestamp
        ? `Last failure ${formatSafeDateLabel(latestFailureTimestamp, "Failure timestamp unavailable")}`
        : "No failed platform/store email log entries found.",
      metadataSummary: buildFailureMetadataSummary(failureState),
      retryReadinessState: retrySummary.retryReadinessState,
      retryReadinessStateLabel: retrySummary.retryReadinessStateLabel,
      sanitizedErrorSummary:
        records[0]?.sanitizedErrorSummary ??
        (failureState === "no_failures"
          ? "No failed platform/store email log entries found."
          : "Failure summary unavailable in read-only foundation.")
    };
  } catch (error) {
    console.error("[email-failure-runtime] failure runtime summary build failed", error);

    return {
      errorCategoryLabel: "Unknown failure category",
      failedCount: 0,
      failureState: "unknown",
      failureStateLabel: getEmailFailureStateLabel("unknown"),
      lastFailureLabel: "Failure activity unavailable",
      metadataSummary: "Failure readiness foundation could not be resolved safely.",
      retryReadinessState: "unknown",
      retryReadinessStateLabel: "Unknown retry readiness",
      sanitizedErrorSummary: "Failure summary unavailable"
    };
  }
}

export function buildEmailFailureRuntimeStatsSafe(
  logs: EmailFailureLogSnapshot[] | null | undefined,
  registryItems?: EmailFailureRegistryItem[] | null
): EmailFailureRuntimeStats {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const summary = buildEmailFailureRuntimeSummarySafe(snapshots, registryItems);
    const records = buildEmailFailureRuntimeRecordsSafe(snapshots);

    if (!records.length && summary.failureState === "no_failures") {
      return {
        failedFailureItems: 0,
        noFailuresItems: 1,
        providerErrorFailureItems: 0,
        recipientErrorFailureItems: 0,
        retryExhaustedFailureItems: 0,
        retryPendingFailureItems: 0,
        templateErrorFailureItems: 0,
        unknownFailureItems: 0
      };
    }

    return {
      failedFailureItems: records.filter((record) => record.failureState === "failed").length,
      noFailuresItems: summary.failureState === "no_failures" ? 1 : 0,
      providerErrorFailureItems: records.filter((record) => record.failureState === "provider_error").length,
      recipientErrorFailureItems: records.filter((record) => record.failureState === "recipient_error").length,
      retryExhaustedFailureItems: records.filter((record) => record.failureState === "retry_exhausted").length,
      retryPendingFailureItems: records.filter((record) => record.failureState === "retry_pending").length,
      templateErrorFailureItems: records.filter((record) => record.failureState === "template_error").length,
      unknownFailureItems: records.filter((record) => record.failureState === "unknown").length
    };
  } catch (error) {
    console.error("[email-failure-runtime] failure runtime stats build failed", error);

    return {
      failedFailureItems: 0,
      noFailuresItems: 0,
      providerErrorFailureItems: 0,
      recipientErrorFailureItems: 0,
      retryExhaustedFailureItems: 0,
      retryPendingFailureItems: 0,
      templateErrorFailureItems: 0,
      unknownFailureItems: 0
    };
  }
}

export function listEmailFailureCatalog() {
  return EMAIL_FAILURE_STATES.map((failureState) => ({
    description: getEmailFailureStateDescription(failureState),
    label: getEmailFailureStateLabel(failureState),
    failureState
  }));
}
