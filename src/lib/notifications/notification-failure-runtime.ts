import "server-only";

import {
  getNotificationChannelLabel,
  parseNotificationChannelSafe,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  sanitizeNotificationDeliveryErrorSummary
} from "@/src/lib/notifications/notification-delivery-runtime";
import {
  getNotificationProviderLabel,
  mapNotificationChannelToProvider,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import {
  NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS,
  parseNotificationRetryMaxAttemptsSafe,
  parseNotificationRetryStatusSafe
} from "@/src/lib/notifications/notification-retry-runtime";

export type NotificationFailureStatus =
  | "failed"
  | "provider_error"
  | "recipient_error"
  | "retry_exhausted"
  | "retry_pending"
  | "template_error"
  | "unknown";

export type NotificationFailureRecord = {
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  deliveryReference: string;
  failureCode: string;
  failureId: string;
  failureReason: string | null;
  failureStatus: NotificationFailureStatus;
  failureStatusLabel: string;
  notificationId: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  queueReference: string;
  retryReference: string;
  reviewed: boolean;
  reviewedAt: string | null;
  updatedAt: string | null;
};

export type NotificationFailureRuntimeStats = {
  emailFailures: number;
  providerErrorFailures: number;
  recipientErrorFailures: number;
  retryExhaustedFailures: number;
  retryPendingFailures: number;
  reviewedFailures: number;
  systemAlertFailures: number;
  templateErrorFailures: number;
  totalFailures: number;
  unreviewedFailures: number;
  unknownFailures: number;
};

export const NOTIFICATION_FAILURE_STATUSES: readonly NotificationFailureStatus[] = [
  "failed",
  "provider_error",
  "recipient_error",
  "retry_exhausted",
  "retry_pending",
  "template_error",
  "unknown"
] as const;

const statusLabels: Record<NotificationFailureStatus, string> = {
  failed: "Failed",
  provider_error: "Provider error",
  recipient_error: "Recipient error",
  retry_exhausted: "Retry exhausted",
  retry_pending: "Retry pending",
  template_error: "Template error",
  unknown: "Unknown"
};

const statusCodes: Record<NotificationFailureStatus, string> = {
  failed: "DELIVERY_FAILED",
  provider_error: "PROVIDER_ERROR",
  recipient_error: "RECIPIENT_ERROR",
  retry_exhausted: "RETRY_EXHAUSTED",
  retry_pending: "RETRY_PENDING",
  template_error: "TEMPLATE_ERROR",
  unknown: "UNKNOWN_FAILURE"
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

function safeCount(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getNotificationFailureStatusLabel(status: NotificationFailureStatus) {
  return statusLabels[status];
}

export function sanitizeNotificationFailureReason(value: unknown) {
  const cleaned = sanitizeNotificationDeliveryErrorSummary(value);
  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/(?:at\s+[\w./]+:\d+:\d+|stack trace|traceback)/gi, "[redacted-trace]")
    .slice(0, 180);
}

export function parseNotificationFailureStatusSafe(
  value: unknown,
  options: { errorText?: unknown; attemptNumber?: number; maxAttempts?: number } = {}
) {
  const cleaned = text(value, 80).toLowerCase();
  const errorText = text(options.errorText, 240).toLowerCase();
  const attemptNumber = options.attemptNumber ?? 0;
  const maxAttempts = options.maxAttempts ?? NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS;
  const retryStatus = parseNotificationRetryStatusSafe(cleaned, { attemptNumber, maxAttempts });

  if (retryStatus === "retry_exhausted") {
    return "retry_exhausted" as const;
  }

  if (retryStatus === "retry_pending") {
    return "retry_pending" as const;
  }

  if (errorText.includes("template") || errorText.includes("render")) {
    return "template_error" as const;
  }

  if (
    errorText.includes("provider") ||
    errorText.includes("resend") ||
    errorText.includes("smtp") ||
    errorText.includes("api")
  ) {
    return "provider_error" as const;
  }

  if (
    errorText.includes("recipient") ||
    errorText.includes("bounce") ||
    errorText.includes("invalid email") ||
    errorText.includes("mailbox")
  ) {
    return "recipient_error" as const;
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    return "failed" as const;
  }

  if (cleaned === "warning") {
    return "failed" as const;
  }

  return "unknown" as const;
}

export function parseNotificationFailureCodeSafe(status: NotificationFailureStatus) {
  return statusCodes[status] ?? statusCodes.unknown;
}

function buildFailureRecordBase(params: {
  channel: NotificationChannel;
  createdAt?: unknown;
  deliveryReference: string;
  failureReason?: unknown;
  failureStatus: NotificationFailureStatus;
  notificationId: string;
  queueReference: string;
  retryReference: string;
  reviewed?: boolean;
  reviewedAt?: unknown;
  updatedAt?: unknown;
}): NotificationFailureRecord {
  const channel = parseNotificationChannelSafe(params.channel);
  const providerKey = mapNotificationChannelToProvider(channel);
  const failureStatus = params.failureStatus;

  return {
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    createdAt: text(params.createdAt, 80) || null,
    deliveryReference: text(params.deliveryReference, 160) || "unknown_delivery",
    failureCode: parseNotificationFailureCodeSafe(failureStatus),
    failureId: `${channel === "email" ? "email" : channel === "system_alert" ? "system-alert" : "notification"}-failure:${text(params.notificationId, 160) || "unknown_notification"}`,
    failureReason: sanitizeNotificationFailureReason(params.failureReason),
    failureStatus,
    failureStatusLabel: getNotificationFailureStatusLabel(failureStatus),
    notificationId: text(params.notificationId, 160) || "unknown_notification",
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    queueReference: text(params.queueReference, 160) || "unknown_queue",
    retryReference: text(params.retryReference, 160) || "unknown_retry",
    reviewed: Boolean(params.reviewed),
    reviewedAt: text(params.reviewedAt, 80) || null,
    updatedAt: text(params.updatedAt, 80) || text(params.createdAt, 80) || null
  };
}

function resolveReviewState(
  notificationId: string,
  reviewedByNotificationId?: Map<string, string> | null
) {
  const reviewedAt = reviewedByNotificationId?.get(notificationId) ?? null;

  return {
    reviewed: Boolean(reviewedAt),
    reviewedAt
  };
}

function buildEmailFailureRecord(
  log: Record<string, unknown>,
  reviewedByNotificationId?: Map<string, string> | null
): NotificationFailureRecord | null {
  const rawStatus = text(log.status, 80).toLowerCase();
  const errorText = log.last_error || log.error_message;
  const hasFailureSignal = rawStatus === "failed" || rawStatus === "retry_pending" || Boolean(text(errorText, 80));

  if (!hasFailureSignal || rawStatus === "sent") {
    return null;
  }

  const attemptNumber = safeCount(log.retry_count ?? log.attempt_count, 0);
  const maxAttempts = parseNotificationRetryMaxAttemptsSafe(log.max_attempts);
  const failureStatus = parseNotificationFailureStatusSafe(rawStatus, {
    attemptNumber,
    errorText,
    maxAttempts
  });

  if (failureStatus === "unknown" && rawStatus !== "failed" && rawStatus !== "retry_pending") {
    return null;
  }

  const notificationId = text(log.id, 160) || `email:${text(log.created_at, 80)}`;
  const reviewState = resolveReviewState(notificationId, reviewedByNotificationId);

  return buildFailureRecordBase({
    channel: "email",
    createdAt: log.created_at,
    deliveryReference: `email:${notificationId}`,
    failureReason: errorText,
    failureStatus,
    notificationId,
    queueReference: `email-queue:${notificationId}`,
    retryReference: `email-retry:${notificationId}`,
    ...reviewState,
    updatedAt: log.updated_at ?? log.last_attempt_at ?? log.created_at
  });
}

function buildSystemAlertFailureRecord(
  event: Record<string, unknown>,
  reviewedByNotificationId?: Map<string, string> | null
): NotificationFailureRecord | null {
  if (text(event.event_status, 80) !== "failed") {
    return null;
  }

  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
  const notificationId = text(event.id, 160) || `system_alert:${text(event.created_at, 80)}`;
  const failureReason = metadata.error || metadata.message || metadata.note || event.event_type;
  const failureStatus = parseNotificationFailureStatusSafe("failed", { errorText: failureReason });
  const reviewState = resolveReviewState(notificationId, reviewedByNotificationId);

  return buildFailureRecordBase({
    channel: "system_alert",
    createdAt: event.created_at,
    deliveryReference: `system_alert:${notificationId}`,
    failureReason,
    failureStatus,
    notificationId,
    queueReference: `system-alert-queue:${notificationId}`,
    retryReference: `system-alert-retry:${notificationId}`,
    ...reviewState,
    updatedAt: event.created_at
  });
}

export function buildNotificationFailureRecordsSafe(params: {
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  reviewedByNotificationId?: Map<string, string> | null;
}): { failureItems: NotificationFailureRecord[]; warning: string | null } {
  try {
    const failureItems: NotificationFailureRecord[] = [];

    for (const log of params.emailLogs ?? []) {
      const record = buildEmailFailureRecord(log, params.reviewedByNotificationId);
      if (record) {
        failureItems.push(record);
      }
    }

    for (const event of params.monitoringEvents ?? []) {
      const record = buildSystemAlertFailureRecord(event, params.reviewedByNotificationId);
      if (record) {
        failureItems.push(record);
      }
    }

    return {
      failureItems: failureItems
        .sort((left, right) => dateValue(right.createdAt ?? "") - dateValue(left.createdAt ?? ""))
        .slice(0, 100),
      warning: null
    };
  } catch (error) {
    console.error("[notification-failure-runtime] failure records build failed", error);

    return {
      failureItems: [],
      warning: "Notification failure records could not be built safely. Showing empty failure state."
    };
  }
}

export function buildNotificationFailureRuntimeStatsSafe(
  failureItems: NotificationFailureRecord[] | null | undefined
): NotificationFailureRuntimeStats {
  try {
    const snapshots = Array.isArray(failureItems) ? failureItems : [];

    return {
      emailFailures: snapshots.filter((record) => record.channel === "email").length,
      providerErrorFailures: snapshots.filter((record) => record.failureStatus === "provider_error").length,
      recipientErrorFailures: snapshots.filter((record) => record.failureStatus === "recipient_error").length,
      retryExhaustedFailures: snapshots.filter((record) => record.failureStatus === "retry_exhausted").length,
      retryPendingFailures: snapshots.filter((record) => record.failureStatus === "retry_pending").length,
      reviewedFailures: snapshots.filter((record) => record.reviewed).length,
      systemAlertFailures: snapshots.filter((record) => record.channel === "system_alert").length,
      templateErrorFailures: snapshots.filter((record) => record.failureStatus === "template_error").length,
      totalFailures: snapshots.length,
      unreviewedFailures: snapshots.filter((record) => !record.reviewed).length,
      unknownFailures: snapshots.filter((record) => record.failureStatus === "unknown").length
    };
  } catch (error) {
    console.error("[notification-failure-runtime] failure stats build failed", error);

    return {
      emailFailures: 0,
      providerErrorFailures: 0,
      recipientErrorFailures: 0,
      retryExhaustedFailures: 0,
      retryPendingFailures: 0,
      reviewedFailures: 0,
      systemAlertFailures: 0,
      templateErrorFailures: 0,
      totalFailures: 0,
      unreviewedFailures: 0,
      unknownFailures: 0
    };
  }
}

export function listNotificationFailureStatusCatalog() {
  return NOTIFICATION_FAILURE_STATUSES.map((status) => ({
    code: parseNotificationFailureCodeSafe(status),
    label: getNotificationFailureStatusLabel(status),
    status
  }));
}

// NT-12+ placeholders: failure review actions, recovery, and escalation stay disconnected.
export const NOTIFICATION_FAILURE_FUTURE_HOOKS = [
  "notification_failure_review_action",
  "notification_failure_recovery",
  "notification_failure_escalation"
] as const;
