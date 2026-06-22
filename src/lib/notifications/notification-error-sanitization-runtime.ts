import "server-only";

import { sanitizeNotificationAuditSummary } from "@/src/lib/notifications/notification-audit-runtime";
import { sanitizeNotificationDeliveryErrorSummary } from "@/src/lib/notifications/notification-delivery-runtime";
import { sanitizeNotificationFailureReason } from "@/src/lib/notifications/notification-failure-runtime";
import { sanitizeNotificationHealthMetadata } from "@/src/lib/notifications/notification-health-runtime";
import { sanitizeNotificationLogMessageSafe } from "@/src/lib/notifications/notification-log-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import { sanitizeNotificationReviewNoteSafe } from "@/src/lib/notifications/notification-review-runtime";
import { sanitizeNotificationRetryFailureReason } from "@/src/lib/notifications/notification-retry-runtime";
import { sanitizeNotificationSafeActionErrorMessage } from "@/src/lib/notifications/notification-safe-action-runtime";
import {
  NOTIFICATION_SECURITY_SECRET_PATTERN,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

import type { NotificationAuditRecord } from "@/src/lib/notifications/notification-audit-runtime";
import type { NotificationDeliveryRecord } from "@/src/lib/notifications/notification-delivery-runtime";
import type { NotificationEventRecord } from "@/src/lib/notifications/notification-event-runtime";
import type { NotificationFailureRecord } from "@/src/lib/notifications/notification-failure-runtime";
import type { NotificationHealthRecord, NotificationHealthSnapshot } from "@/src/lib/notifications/notification-health-runtime";
import type { NotificationLogRecord } from "@/src/lib/notifications/notification-log-runtime";
import type { NotificationMonitoringRecord } from "@/src/lib/notifications/notification-monitoring-runtime";
import type { NotificationQueueRecord } from "@/src/lib/notifications/notification-queue-runtime";
import type { NotificationRetryRecord } from "@/src/lib/notifications/notification-retry-runtime";
import type { NotificationReviewRecord } from "@/src/lib/notifications/notification-review-runtime";
import type { NotificationSafeActionRecord } from "@/src/lib/notifications/notification-safe-action-runtime";
import type { NotificationSecurityRecord } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationErrorSanitizationSource =
  | "audit"
  | "delivery"
  | "failure"
  | "health"
  | "log"
  | "monitoring"
  | "queue"
  | "retry"
  | "review"
  | "safe_action"
  | "unknown";

export type NotificationErrorSanitizationRecord = {
  fallbackMessage: string;
  sanitizedFields: string[];
  sanitizationId: string;
  sanitizationReady: boolean;
  safeSummary: string;
  source: NotificationErrorSanitizationSource;
  sourceLabel: string;
};

export type NotificationErrorSanitizationRuntimeStats = {
  readySurfaces: number;
  totalSanitizedFields: number;
  totalSurfaces: number;
  unknownSurfaces: number;
};

export type NotificationErrorSanitizationSummary = {
  foundationOnly: true;
  pageLoadReadOnly: true;
  policyDescription: string;
  safeSummary: string;
  secretsRedacted: true;
};

export const NOTIFICATION_ERROR_SANITIZATION_FALLBACK_ID = "unknown_notification_error_sanitization" as const;

export const NOTIFICATION_ERROR_SANITIZATION_SOURCES: readonly NotificationErrorSanitizationSource[] = [
  "delivery",
  "queue",
  "retry",
  "failure",
  "audit",
  "monitoring",
  "health",
  "log",
  "review",
  "safe_action"
] as const;

const sourceLabels: Record<NotificationErrorSanitizationSource, string> = {
  audit: "Audit records",
  delivery: "Delivery records",
  failure: "Failure records",
  health: "Health records",
  log: "Log records",
  monitoring: "Monitoring records",
  queue: "Queue records",
  retry: "Retry records",
  review: "Review records",
  safe_action: "Safe action placeholders",
  unknown: "Unknown source"
};

const fallbackMessages: Record<NotificationErrorSanitizationSource, string> = {
  audit: "No safe audit summary recorded.",
  delivery: "No safe delivery error summary.",
  failure: "No safe failure reason recorded.",
  health: "No safe health summary recorded.",
  log: "No safe log message recorded.",
  monitoring: "No safe monitoring summary recorded.",
  queue: "No safe queue error summary.",
  retry: "No safe retry failure reason.",
  review: "No safe review note recorded.",
  safe_action: "No safe action message recorded.",
  unknown: "No safe error summary available."
};

const sanitizedFieldsBySource: Record<NotificationErrorSanitizationSource, string[]> = {
  audit: ["metadataSummary", "safeSummary"],
  delivery: ["errorSummary"],
  failure: ["failureReason"],
  health: ["metadataSummary", "safeSummary"],
  log: ["metadataSummary", "safeMessage"],
  monitoring: ["metadataSummary", "safeSummary"],
  queue: ["errorSummary"],
  retry: ["failureReason"],
  review: ["reviewNote", "safeSummary"],
  safe_action: ["description", "guardMessage", "safeSummary"],
  unknown: ["errorSummary"]
};

const stackTracePattern = /(?:at\s+[\w./$]+(?::\d+){1,2}|stack trace|traceback|error:\s*error)/gi;
const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const ipv6Pattern = /\b(?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}\b/gi;

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

function maskIpInText(value: string) {
  return value
    .replace(ipv4Pattern, (match) => {
      const parts = match.split(".");
      return `${parts[0]}.${parts[1]}.***.***`;
    })
    .replace(ipv6Pattern, (match) => {
      const parts = match.split(":").filter(Boolean);
      return `${parts.slice(0, 2).join(":")}:****`;
    });
}

function applyCentralErrorRedaction(value: unknown, maxLength = 240) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  if (!cleaned) {
    return null;
  }

  const redacted = maskIpInText(
    cleaned
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-token]")
      .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
      .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted-key]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(stackTracePattern, "[redacted-trace]")
      .replace(/\b(?:api[_-]?key|secret|token|password|credential|webhook|smtp|provider[_-]?config)\b[:=\s]+[^\s,;]+/gi, "[redacted-secret]")
  );

  if (!redacted || NOTIFICATION_SECURITY_SECRET_PATTERN.test(redacted)) {
    return null;
  }

  return redacted.slice(0, 180);
}

export function getNotificationErrorSanitizationFallback(source: NotificationErrorSanitizationSource) {
  return fallbackMessages[source];
}

export function getNotificationErrorSanitizationSourceLabel(source: NotificationErrorSanitizationSource) {
  return sourceLabels[source];
}

export function sanitizeNotificationErrorDisplaySafe(
  value: unknown,
  params?: {
    fallback?: string;
    maxLength?: number;
    source?: NotificationErrorSanitizationSource;
  }
) {
  const source = params?.source ?? "unknown";
  const fallback = params?.fallback ?? getNotificationErrorSanitizationFallback(source);
  const sanitized = sanitizeNotificationErrorForSourceSafe(value, source, params?.maxLength);
  return sanitized ?? fallback;
}

export function sanitizeNotificationErrorForSourceSafe(
  value: unknown,
  source: NotificationErrorSanitizationSource,
  maxLength = 240
): string | null {
  let sanitized: string | null = null;

  switch (source) {
    case "delivery":
    case "queue":
      sanitized = sanitizeNotificationDeliveryErrorSummary(value);
      break;
    case "retry":
      sanitized = sanitizeNotificationRetryFailureReason(value);
      break;
    case "failure":
      sanitized = sanitizeNotificationFailureReason(value);
      break;
    case "audit":
      sanitized = sanitizeNotificationAuditSummary(value);
      break;
    case "monitoring":
      sanitized = sanitizeNotificationDeliveryErrorSummary(value) || text(sanitizeNotificationMonitoringMetadata({ note: value }), maxLength) || null;
      break;
    case "health":
      sanitized = sanitizeNotificationDeliveryErrorSummary(value) || text(sanitizeNotificationHealthMetadata({ note: value }), maxLength) || null;
      break;
    case "log":
      sanitized = sanitizeNotificationLogMessageSafe(value, maxLength);
      break;
    case "review":
      sanitized = sanitizeNotificationReviewNoteSafe(value, maxLength);
      break;
    case "safe_action":
      sanitized = sanitizeNotificationSafeActionErrorMessage(value, maxLength);
      break;
    default:
      sanitized = applyCentralErrorRedaction(value, maxLength);
      break;
  }

  if (sanitized) {
    return sanitized;
  }

  return applyCentralErrorRedaction(value, maxLength);
}

function sanitizeNullableErrorField(
  value: string | null | undefined,
  source: NotificationErrorSanitizationSource
) {
  if (value == null) {
    return null;
  }

  return sanitizeNotificationErrorForSourceSafe(value, source);
}

function sanitizeRequiredErrorField(value: string, source: NotificationErrorSanitizationSource) {
  return sanitizeNotificationErrorDisplaySafe(value, { source });
}

export function sanitizeNotificationDeliveryRecordErrorsSafe(
  record: NotificationDeliveryRecord
): NotificationDeliveryRecord {
  return {
    ...record,
    errorSummary: sanitizeNullableErrorField(record.errorSummary, "delivery")
  };
}

export function sanitizeNotificationQueueRecordErrorsSafe(record: NotificationQueueRecord): NotificationQueueRecord {
  return {
    ...record,
    errorSummary: sanitizeNullableErrorField(record.errorSummary, "queue")
  };
}

export function sanitizeNotificationRetryRecordErrorsSafe(record: NotificationRetryRecord): NotificationRetryRecord {
  return {
    ...record,
    failureReason: sanitizeNullableErrorField(record.failureReason, "retry")
  };
}

export function sanitizeNotificationFailureRecordErrorsSafe(
  record: NotificationFailureRecord
): NotificationFailureRecord {
  return {
    ...record,
    failureReason: sanitizeNullableErrorField(record.failureReason, "failure")
  };
}

export function sanitizeNotificationAuditRecordErrorsSafe(record: NotificationAuditRecord): NotificationAuditRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "audit"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "audit")
  };
}

export function sanitizeNotificationMonitoringRecordErrorsSafe(
  record: NotificationMonitoringRecord
): NotificationMonitoringRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "monitoring"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "monitoring")
  };
}

export function sanitizeNotificationHealthRecordErrorsSafe(record: NotificationHealthRecord): NotificationHealthRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "health"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "health")
  };
}

export function sanitizeNotificationHealthSnapshotErrorsSafe(
  snapshot: NotificationHealthSnapshot
): NotificationHealthSnapshot {
  return {
    ...snapshot,
    healthDescription: sanitizeRequiredErrorField(snapshot.healthDescription, "health"),
    safeSummary: sanitizeRequiredErrorField(snapshot.safeSummary, "health")
  };
}

export function sanitizeNotificationLogRecordErrorsSafe(record: NotificationLogRecord): NotificationLogRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "log"),
    safeMessage: sanitizeRequiredErrorField(record.safeMessage, "log")
  };
}

export function sanitizeNotificationReviewRecordErrorsSafe(record: NotificationReviewRecord): NotificationReviewRecord {
  return {
    ...record,
    reviewNote: sanitizeRequiredErrorField(record.reviewNote, "review"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "review")
  };
}

export function sanitizeNotificationSafeActionRecordErrorsSafe(
  record: NotificationSafeActionRecord
): NotificationSafeActionRecord {
  return {
    ...record,
    description: sanitizeRequiredErrorField(record.description, "safe_action"),
    guardMessage: sanitizeRequiredErrorField(record.guardMessage, "safe_action"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "safe_action")
  };
}

export function sanitizeNotificationEventRecordErrorsSafe(record: NotificationEventRecord): NotificationEventRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "audit"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "audit")
  };
}

export function sanitizeNotificationSecurityRecordErrorsSafe(
  record: NotificationSecurityRecord
): NotificationSecurityRecord {
  return {
    ...record,
    metadataSummary: sanitizeRequiredErrorField(record.metadataSummary, "monitoring"),
    safeSummary: sanitizeRequiredErrorField(record.safeSummary, "monitoring")
  };
}

export function sanitizeNotificationLegacyLogErrorsSafe<T extends { errorSummary: string | null }>(record: T): T {
  return {
    ...record,
    errorSummary: sanitizeNullableErrorField(record.errorSummary, "log")
  };
}

export function applyNotificationControlErrorSanitizationSafe(params: {
  auditItems?: NotificationAuditRecord[];
  deliveries?: NotificationDeliveryRecord[];
  eventItems?: NotificationEventRecord[];
  failureItems?: NotificationFailureRecord[];
  health?: NotificationHealthSnapshot;
  healthItems?: NotificationHealthRecord[];
  logItems?: NotificationLogRecord[];
  logs?: Array<{ errorSummary: string | null }>;
  monitoringItems?: NotificationMonitoringRecord[];
  queueItems?: NotificationQueueRecord[];
  retryItems?: NotificationRetryRecord[];
  reviewItems?: NotificationReviewRecord[];
  safeActionItems?: NotificationSafeActionRecord[];
  securityRecords?: NotificationSecurityRecord[];
}) {
  return {
    auditItems: (params.auditItems ?? []).map(sanitizeNotificationAuditRecordErrorsSafe),
    deliveries: (params.deliveries ?? []).map(sanitizeNotificationDeliveryRecordErrorsSafe),
    eventItems: (params.eventItems ?? []).map(sanitizeNotificationEventRecordErrorsSafe),
    failureItems: (params.failureItems ?? []).map(sanitizeNotificationFailureRecordErrorsSafe),
    health: params.health ? sanitizeNotificationHealthSnapshotErrorsSafe(params.health) : params.health,
    healthItems: (params.healthItems ?? []).map(sanitizeNotificationHealthRecordErrorsSafe),
    logItems: (params.logItems ?? []).map(sanitizeNotificationLogRecordErrorsSafe),
    logs: (params.logs ?? []).map((log) => sanitizeNotificationLegacyLogErrorsSafe(log)),
    monitoringItems: (params.monitoringItems ?? []).map(sanitizeNotificationMonitoringRecordErrorsSafe),
    queueItems: (params.queueItems ?? []).map(sanitizeNotificationQueueRecordErrorsSafe),
    retryItems: (params.retryItems ?? []).map(sanitizeNotificationRetryRecordErrorsSafe),
    reviewItems: (params.reviewItems ?? []).map(sanitizeNotificationReviewRecordErrorsSafe),
    safeActionItems: (params.safeActionItems ?? []).map(sanitizeNotificationSafeActionRecordErrorsSafe),
    securityRecords: (params.securityRecords ?? []).map(sanitizeNotificationSecurityRecordErrorsSafe)
  };
}

export function buildNotificationErrorSanitizationFallbackRecordSafe(
  source: NotificationErrorSanitizationSource = "unknown"
): NotificationErrorSanitizationRecord {
  return {
    fallbackMessage: getNotificationErrorSanitizationFallback(source),
    sanitizedFields: sanitizedFieldsBySource[source],
    sanitizationId: NOTIFICATION_ERROR_SANITIZATION_FALLBACK_ID,
    sanitizationReady: false,
    safeSummary: "Notification error sanitization fallback applied. Unsafe content was replaced with safe summaries.",
    source,
    sourceLabel: getNotificationErrorSanitizationSourceLabel(source)
  };
}

export function buildNotificationErrorSanitizationRecordsSafe(): {
  errorSanitizationItems: NotificationErrorSanitizationRecord[];
  warning: string | null;
} {
  try {
    const errorSanitizationItems = NOTIFICATION_ERROR_SANITIZATION_SOURCES.map((source) => ({
      fallbackMessage: getNotificationErrorSanitizationFallback(source),
      sanitizedFields: sanitizedFieldsBySource[source],
      sanitizationId: `surface:${source}`,
      sanitizationReady: true,
      safeSummary: sanitizeNotificationErrorDisplaySafe(
        `${getNotificationErrorSanitizationSourceLabel(source)} errors are sanitized before Super Admin display. Secrets, payloads, stack traces, and full identifiers are redacted.`,
        { source }
      ),
      source,
      sourceLabel: getNotificationErrorSanitizationSourceLabel(source)
    }));

    return {
      errorSanitizationItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-error-sanitization-runtime] error sanitization records build failed", error);

    return {
      errorSanitizationItems: [buildNotificationErrorSanitizationFallbackRecordSafe()],
      warning: "Notification error sanitization runtime fallback applied."
    };
  }
}

export function buildNotificationErrorSanitizationRuntimeStatsSafe(
  errorSanitizationItems: NotificationErrorSanitizationRecord[] | null | undefined
): NotificationErrorSanitizationRuntimeStats {
  try {
    const items = Array.isArray(errorSanitizationItems) ? errorSanitizationItems : [];

    return {
      readySurfaces: items.filter((item) => item.sanitizationReady).length,
      totalSanitizedFields: items.reduce((total, item) => total + item.sanitizedFields.length, 0),
      totalSurfaces: items.length,
      unknownSurfaces: items.filter((item) => item.sanitizationId === NOTIFICATION_ERROR_SANITIZATION_FALLBACK_ID).length
    };
  } catch (error) {
    console.error("[notification-error-sanitization-runtime] error sanitization stats build failed", error);

    return {
      readySurfaces: 0,
      totalSanitizedFields: 0,
      totalSurfaces: 0,
      unknownSurfaces: 0
    };
  }
}

export function buildNotificationErrorSanitizationSummarySafe(): NotificationErrorSanitizationSummary {
  return {
    foundationOnly: true,
    pageLoadReadOnly: true,
    policyDescription:
      "Notification Center error sanitization replaces unsafe delivery, queue, retry, failure, audit, monitoring, health, log, review, and safe-action messages with redacted summaries. API keys, tokens, SMTP passwords, webhook secrets, provider credentials, raw payloads, stack traces, full recipients, full IPs, and unsafe HTML never render in Super Admin views.",
    safeSummary:
      "NT-23 error sanitization runtime: read-only page load with safe fallback messages for unknown or malformed errors.",
    secretsRedacted: true
  };
}

export function listNotificationErrorSanitizationCatalog() {
  return NOTIFICATION_ERROR_SANITIZATION_SOURCES.map((source) => ({
    fallbackMessage: getNotificationErrorSanitizationFallback(source),
    sanitizedFields: sanitizedFieldsBySource[source],
    source,
    sourceLabel: getNotificationErrorSanitizationSourceLabel(source)
  }));
}

// NT-24+ placeholders: error classification, alerting, and replay stay disconnected.
export const NOTIFICATION_ERROR_SANITIZATION_FUTURE_HOOKS = [
  "notification_error_classification",
  "notification_error_alerting",
  "notification_error_replay"
] as const;
