import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import {
  resolveEmailProviderStatusSafe
} from "@/src/lib/email/email-provider-runtime";
import {
  buildEmailQueueRuntimeSummarySafe,
  parseEmailQueueRuntimeStateSafe,
  type EmailQueueLogSnapshot
} from "@/src/lib/email/email-queue-runtime";

type EmailRetryRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
  status?: string | null;
};

export type EmailRetryLogSnapshot = EmailQueueLogSnapshot & {
  attempts?: number | null;
  max_attempts?: number | null;
  next_retry_at?: string | null;
  retry_count?: number | null;
};

export type EmailRetryReadinessState =
  | "failed"
  | "not_retryable"
  | "retry_blocked"
  | "retry_exhausted"
  | "retry_pending"
  | "retry_ready"
  | "unknown";

export type EmailRetryRuntimeSummary = {
  failedCount: number;
  lastRetryLabel: string;
  metadataSummary: string;
  nextRetryLabel: string;
  retryAttemptsSummary: string;
  retryPendingCount: number;
  retryReadinessState: EmailRetryReadinessState;
  retryReadinessStateLabel: string;
};

export type EmailRetryRuntimeStats = {
  failedRetryItems: number;
  notRetryableRetryItems: number;
  retryBlockedRetryItems: number;
  retryExhaustedRetryItems: number;
  retryPendingRetryItems: number;
  retryReadyRetryItems: number;
  unknownRetryItems: number;
};

export const EMAIL_RETRY_READINESS_STATES: readonly EmailRetryReadinessState[] = [
  "retry_ready",
  "retry_pending",
  "retry_blocked",
  "retry_exhausted",
  "not_retryable",
  "failed",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailRetryReadinessState, string> = {
  failed: "Failed retry foundation",
  not_retryable: "Not retryable",
  retry_blocked: "Retry execution blocked",
  retry_exhausted: "Retry attempts exhausted",
  retry_pending: "Retry pending",
  retry_ready: "Retry readiness foundation ready",
  unknown: "Unknown retry readiness"
};

const readinessStateDescriptions: Record<EmailRetryReadinessState, string> = {
  failed: "Failed email entries are visible in read-only logs. No retry execution connected.",
  not_retryable: "No failed or retry pending entries found in read-only email event logs.",
  retry_blocked: "Retry failed email remains a reserved placeholder. No retry execution connected.",
  retry_exhausted: "Retry attempts appear exhausted in read-only foundation data. No retry execution connected.",
  retry_pending: "Retry pending entries shown from read-only email event logs. No retry execution connected.",
  retry_ready:
    "Retry readiness foundation looks available for admin review. No retry execution, queue processing, or sending connected.",
  unknown: "Retry readiness could not be resolved safely."
};

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

function safeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  const parsed = Number(text(value, 40));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
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

export function getEmailRetryReadinessStateLabel(state: EmailRetryReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailRetryReadinessStateDescription(state: EmailRetryReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailRetryStateForLogSafe(log: EmailRetryLogSnapshot): EmailRetryReadinessState {
  const queueState = parseEmailQueueRuntimeStateSafe(log.status);
  const attempts = safeCount(log.attempts ?? log.retry_count);
  const maxAttempts = safeCount(log.max_attempts);

  if (queueState === "retry_pending") {
    return "retry_pending";
  }

  if (queueState === "failed") {
    if (attempts !== null && maxAttempts !== null && attempts >= maxAttempts && maxAttempts > 0) {
      return "retry_exhausted";
    }

    return "failed";
  }

  if (queueState === "sent" || queueState === "cancelled" || queueState === "queued") {
    return "not_retryable";
  }

  return "unknown";
}

export function resolveEmailRetryReadinessStateSafe(params: {
  failedCount: number;
  futureHookReserved: boolean;
  providerReady: boolean;
  retryPendingCount: number;
  retryExhaustedCount: number;
}): EmailRetryReadinessState {
  const { failedCount, futureHookReserved, providerReady, retryPendingCount, retryExhaustedCount } = params;

  if (retryPendingCount > 0) {
    return "retry_pending";
  }

  if (retryExhaustedCount > 0) {
    return "retry_exhausted";
  }

  if (failedCount > 0 && futureHookReserved) {
    return "retry_blocked";
  }

  if (failedCount > 0 && providerReady) {
    return "retry_ready";
  }

  if (failedCount > 0) {
    return "failed";
  }

  if (futureHookReserved) {
    return "retry_blocked";
  }

  return "not_retryable";
}

function resolveLastRetryLabelSafe(logs: EmailRetryLogSnapshot[]) {
  const latestTimestamp = logs
    .filter((log) => {
      const state = resolveEmailRetryStateForLogSafe(log);
      return state === "retry_pending" || state === "failed" || state === "retry_exhausted";
    })
    .map((log) => text(log.created_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  if (!latestTimestamp) {
    return "No retry activity recorded";
  }

  return `Last retry activity ${formatSafeDateLabel(latestTimestamp, "Retry activity timestamp unavailable")}`;
}

function resolveNextRetryLabelSafe(logs: EmailRetryLogSnapshot[]) {
  const nextRetryTimestamp = logs
    .filter((log) => resolveEmailRetryStateForLogSafe(log) === "retry_pending")
    .map((log) => text(log.next_retry_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(left) - dateValue(right))[0];

  if (nextRetryTimestamp) {
    return `Next retry ${formatSafeDateLabel(nextRetryTimestamp, "Next retry timestamp unavailable")}`;
  }

  return "Next retry not scheduled in read-only foundation";
}

function resolveRetryAttemptsSummarySafe(logs: EmailRetryLogSnapshot[], failedCount: number, retryPendingCount: number) {
  const retryPendingLogs = logs.filter((log) => resolveEmailRetryStateForLogSafe(log) === "retry_pending");
  const attemptValues = retryPendingLogs
    .map((log) => safeCount(log.attempts ?? log.retry_count))
    .filter((value): value is number => value !== null);

  if (attemptValues.length) {
    const maxAttempt = Math.max(...attemptValues);
    return `${retryPendingCount} retry pending, ${failedCount} failed, highest recorded attempt ${maxAttempt}. Read-only foundation only.`;
  }

  return `${retryPendingCount} retry pending, ${failedCount} failed in read-only email event logs. No retry execution connected.`;
}

function buildRetryMetadataSummary(
  futureHookNote: string | null,
  readinessState: EmailRetryReadinessState
) {
  if (futureHookNote) {
    return `${futureHookNote} Retry readiness foundation only.`;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailRetryRuntimeSummarySafe(
  logs: EmailRetryLogSnapshot[] | null | undefined,
  registryItems?: EmailRetryRegistryItem[] | null
): EmailRetryRuntimeSummary {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const queueSummary = buildEmailQueueRuntimeSummarySafe(snapshots, registryItems);
    const retryPendingCount = queueSummary.retryPendingCount;
    const failedCount = queueSummary.failedCount;
    const retryHook = filterEmailRegistryItemsByType(registryItems ?? [], "future_hook").find(
      (item) =>
        text(item.slug, 80) === "retry-failed-email" ||
        text(item.registryKey, 80) === "future-hook:retry-failed-email"
    );
    const futureHookReserved =
      text(retryHook?.status, 80) === "reserved_placeholder" ||
      /placeholder/i.test(text(retryHook?.description, 500));
    const futureHookNote =
      text(retryHook?.metadata?.note, 500) ||
      text(retryHook?.description, 500) ||
      "Retry failed email remains a reserved placeholder.";
    const providerReady = (() => {
      const resendStatus = resolveEmailProviderStatusSafe("resend");
      return resendStatus.configurationStatus === "configured" && resendStatus.healthStatus === "healthy";
    })();
    const perLogStates = snapshots.map((log) => resolveEmailRetryStateForLogSafe(log));
    const retryExhaustedCount = perLogStates.filter((state) => state === "retry_exhausted").length;
    const retryReadinessState = resolveEmailRetryReadinessStateSafe({
      failedCount,
      futureHookReserved,
      providerReady,
      retryExhaustedCount,
      retryPendingCount
    });

    return {
      failedCount,
      lastRetryLabel: resolveLastRetryLabelSafe(snapshots),
      metadataSummary: buildRetryMetadataSummary(futureHookNote, retryReadinessState),
      nextRetryLabel: resolveNextRetryLabelSafe(snapshots),
      retryAttemptsSummary: resolveRetryAttemptsSummarySafe(snapshots, failedCount, retryPendingCount),
      retryPendingCount,
      retryReadinessState,
      retryReadinessStateLabel: getEmailRetryReadinessStateLabel(retryReadinessState)
    };
  } catch (error) {
    console.error("[email-retry-runtime] retry runtime summary build failed", error);

    return {
      failedCount: 0,
      lastRetryLabel: "Retry activity unavailable",
      metadataSummary: "Retry readiness foundation could not be resolved safely.",
      nextRetryLabel: "Next retry unavailable",
      retryAttemptsSummary: "Retry attempts unavailable",
      retryPendingCount: 0,
      retryReadinessState: "unknown",
      retryReadinessStateLabel: getEmailRetryReadinessStateLabel("unknown")
    };
  }
}

export function buildEmailRetryRuntimeStatsSafe(
  logs: EmailRetryLogSnapshot[] | null | undefined,
  registryItems?: EmailRetryRegistryItem[] | null
): EmailRetryRuntimeStats {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const summary = buildEmailRetryRuntimeSummarySafe(snapshots, registryItems);
    const perLogStates = snapshots.map((log) => resolveEmailRetryStateForLogSafe(log));

    return {
      failedRetryItems: perLogStates.filter((state) => state === "failed").length || summary.failedCount,
      notRetryableRetryItems: perLogStates.filter((state) => state === "not_retryable").length,
      retryBlockedRetryItems: summary.retryReadinessState === "retry_blocked" ? 1 : 0,
      retryExhaustedRetryItems: perLogStates.filter((state) => state === "retry_exhausted").length,
      retryPendingRetryItems: perLogStates.filter((state) => state === "retry_pending").length || summary.retryPendingCount,
      retryReadyRetryItems: summary.retryReadinessState === "retry_ready" ? 1 : 0,
      unknownRetryItems: perLogStates.filter((state) => state === "unknown").length
    };
  } catch (error) {
    console.error("[email-retry-runtime] retry runtime stats build failed", error);

    return {
      failedRetryItems: 0,
      notRetryableRetryItems: 0,
      retryBlockedRetryItems: 0,
      retryExhaustedRetryItems: 0,
      retryPendingRetryItems: 0,
      retryReadyRetryItems: 0,
      unknownRetryItems: 0
    };
  }
}

export function listEmailRetryReadinessCatalog() {
  return EMAIL_RETRY_READINESS_STATES.map((readinessState) => ({
    description: getEmailRetryReadinessStateDescription(readinessState),
    label: getEmailRetryReadinessStateLabel(readinessState),
    readinessState
  }));
}
