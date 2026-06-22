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

export type NotificationRetryStatus =
  | "failed"
  | "retry_blocked"
  | "retry_exhausted"
  | "retry_pending"
  | "retry_ready"
  | "unknown";

export type NotificationRetryRecord = {
  attemptNumber: number;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  deliveryReference: string;
  failureReason: string | null;
  lastRetryAt: string | null;
  maxAttempts: number;
  nextRetryAt: string | null;
  notificationId: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  queueReference: string;
  retryId: string;
  retryStatus: NotificationRetryStatus;
  retryStatusLabel: string;
  updatedAt: string | null;
};

export type NotificationRetryRuntimeStats = {
  emailRetryItems: number;
  failedRetryItems: number;
  inAppRetryItems: number;
  placeholderChannelRetryItems: number;
  retryBlockedItems: number;
  retryExhaustedItems: number;
  retryPendingItems: number;
  retryReadyItems: number;
  systemAlertRetryItems: number;
  totalRetryItems: number;
  unknownRetryItems: number;
};

export const NOTIFICATION_RETRY_STATUSES: readonly NotificationRetryStatus[] = [
  "retry_pending",
  "retry_ready",
  "failed",
  "retry_exhausted",
  "retry_blocked",
  "unknown"
] as const;

export const NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS = 3;

const statusLabels: Record<NotificationRetryStatus, string> = {
  failed: "Failed",
  retry_blocked: "Retry blocked",
  retry_exhausted: "Retry exhausted",
  retry_pending: "Retry pending",
  retry_ready: "Retry ready",
  unknown: "Unknown"
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

export function getNotificationRetryStatusLabel(status: NotificationRetryStatus) {
  return statusLabels[status];
}

export function sanitizeNotificationRetryFailureReason(value: unknown) {
  return sanitizeNotificationDeliveryErrorSummary(value);
}

export function parseNotificationRetryMaxAttemptsSafe(value: unknown) {
  const parsed = safeCount(value, 0);
  return parsed > 0 ? parsed : NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS;
}

export function parseNotificationRetryStatusSafe(
  value: unknown,
  options: { attemptNumber?: number; maxAttempts?: number } = {}
) {
  const cleaned = text(value, 80).toLowerCase();
  const attemptNumber = options.attemptNumber ?? 0;
  const maxAttempts = options.maxAttempts ?? NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS;

  if (cleaned === "retry_pending" || cleaned === "retry-pending" || cleaned === "retry") {
    return "retry_pending" as const;
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    if (attemptNumber >= maxAttempts && maxAttempts > 0) {
      return "retry_exhausted" as const;
    }

    return "failed" as const;
  }

  if (cleaned === "retry_blocked" || cleaned === "retry-blocked" || cleaned === "blocked") {
    return "retry_blocked" as const;
  }

  if (cleaned === "retry_exhausted" || cleaned === "retry-exhausted" || cleaned === "exhausted") {
    return "retry_exhausted" as const;
  }

  if (cleaned === "retry_ready" || cleaned === "retry-ready" || cleaned === "ready") {
    return "retry_ready" as const;
  }

  if (!cleaned) {
    return "unknown" as const;
  }

  return "unknown" as const;
}

function isRetryEligibleStatus(status: NotificationRetryStatus) {
  return ["failed", "retry_blocked", "retry_exhausted", "retry_pending", "retry_ready", "unknown"].includes(status);
}

function buildRetryRecordBase(params: {
  attemptNumber: number;
  channel: NotificationChannel;
  createdAt?: unknown;
  deliveryReference: string;
  failureReason?: unknown;
  lastRetryAt?: unknown;
  maxAttempts: number;
  nextRetryAt?: unknown;
  notificationId: string;
  queueReference: string;
  retryId: string;
  retryStatus: NotificationRetryStatus;
  updatedAt?: unknown;
}): NotificationRetryRecord {
  const channel = parseNotificationChannelSafe(params.channel);
  const providerKey = mapNotificationChannelToProvider(channel);

  return {
    attemptNumber: Math.max(0, params.attemptNumber),
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    createdAt: text(params.createdAt, 80) || null,
    deliveryReference: text(params.deliveryReference, 160) || "unknown_delivery",
    failureReason: sanitizeNotificationRetryFailureReason(params.failureReason),
    lastRetryAt: text(params.lastRetryAt, 80) || null,
    maxAttempts: Math.max(1, params.maxAttempts),
    nextRetryAt: text(params.nextRetryAt, 80) || null,
    notificationId: text(params.notificationId, 160) || "unknown_notification",
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    queueReference: text(params.queueReference, 160) || "unknown_queue",
    retryId: text(params.retryId, 160) || "unknown_retry",
    retryStatus: params.retryStatus,
    retryStatusLabel: getNotificationRetryStatusLabel(params.retryStatus),
    updatedAt: text(params.updatedAt, 80) || text(params.createdAt, 80) || null
  };
}

function buildEmailRetryRecord(log: Record<string, unknown>): NotificationRetryRecord | null {
  const rawStatus = text(log.status, 80).toLowerCase();
  const attemptNumber = safeCount(log.retry_count ?? log.attempt_count, 0);
  const maxAttempts = parseNotificationRetryMaxAttemptsSafe(log.max_attempts);
  const hasRetrySignal =
    rawStatus === "retry_pending" ||
    rawStatus === "failed" ||
    attemptNumber > 0 ||
    Boolean(text(log.next_retry_at, 80));

  if (!hasRetrySignal) {
    return null;
  }

  const retryStatus = parseNotificationRetryStatusSafe(rawStatus, { attemptNumber, maxAttempts });
  if (!isRetryEligibleStatus(retryStatus)) {
    return null;
  }

  const notificationId = text(log.id, 160) || `email:${text(log.created_at, 80)}`;

  return buildRetryRecordBase({
    attemptNumber: Math.max(attemptNumber, retryStatus === "failed" || retryStatus === "retry_pending" ? 1 : 0),
    channel: "email",
    createdAt: log.created_at,
    deliveryReference: `email:${notificationId}`,
    failureReason: log.last_error || log.error_message,
    lastRetryAt: log.last_attempt_at,
    maxAttempts,
    nextRetryAt: log.next_retry_at,
    notificationId,
    queueReference: `email-queue:${notificationId}`,
    retryId: `email-retry:${notificationId}`,
    retryStatus,
    updatedAt: log.updated_at ?? log.last_attempt_at ?? log.created_at
  });
}

function buildSystemAlertRetryRecord(event: Record<string, unknown>): NotificationRetryRecord | null {
  if (text(event.event_status, 80) !== "failed") {
    return null;
  }

  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
  const notificationId = text(event.id, 160) || `system_alert:${text(event.created_at, 80)}`;
  const retryStatus = parseNotificationRetryStatusSafe("failed", { attemptNumber: 1, maxAttempts: 1 });

  return buildRetryRecordBase({
    attemptNumber: 1,
    channel: "system_alert",
    createdAt: event.created_at,
    deliveryReference: `system_alert:${notificationId}`,
    failureReason: metadata.error || metadata.message || metadata.note || event.event_type,
    maxAttempts: 1,
    notificationId,
    queueReference: `system-alert-queue:${notificationId}`,
    retryId: `system-alert-retry:${notificationId}`,
    retryStatus: retryStatus === "retry_exhausted" ? "failed" : retryStatus,
    updatedAt: event.created_at
  });
}

export function buildNotificationRetryRecordsSafe(params: {
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
}): { retryItems: NotificationRetryRecord[]; warning: string | null } {
  try {
    const retryItems: NotificationRetryRecord[] = [];

    for (const log of params.emailLogs ?? []) {
      const record = buildEmailRetryRecord(log);
      if (record) {
        retryItems.push(record);
      }
    }

    for (const event of params.monitoringEvents ?? []) {
      const record = buildSystemAlertRetryRecord(event);
      if (record) {
        retryItems.push(record);
      }
    }

    return {
      retryItems: retryItems
        .sort((left, right) => dateValue(right.nextRetryAt ?? right.updatedAt ?? right.createdAt ?? "") - dateValue(left.nextRetryAt ?? left.updatedAt ?? left.createdAt ?? ""))
        .slice(0, 100),
      warning: null
    };
  } catch (error) {
    console.error("[notification-retry-runtime] retry records build failed", error);

    return {
      retryItems: [],
      warning: "Notification retry records could not be built safely. Showing empty retry state."
    };
  }
}

export function buildNotificationRetryRuntimeStatsSafe(
  retryItems: NotificationRetryRecord[] | null | undefined
): NotificationRetryRuntimeStats {
  try {
    const snapshots = Array.isArray(retryItems) ? retryItems : [];
    const placeholderChannels: NotificationChannel[] = ["sms", "whatsapp", "push"];

    return {
      emailRetryItems: snapshots.filter((record) => record.channel === "email").length,
      failedRetryItems: snapshots.filter((record) => record.retryStatus === "failed").length,
      inAppRetryItems: snapshots.filter((record) => record.channel === "in_app").length,
      placeholderChannelRetryItems: snapshots.filter((record) => placeholderChannels.includes(record.channel)).length,
      retryBlockedItems: snapshots.filter((record) => record.retryStatus === "retry_blocked").length,
      retryExhaustedItems: snapshots.filter((record) => record.retryStatus === "retry_exhausted").length,
      retryPendingItems: snapshots.filter((record) => record.retryStatus === "retry_pending").length,
      retryReadyItems: snapshots.filter((record) => record.retryStatus === "retry_ready").length,
      systemAlertRetryItems: snapshots.filter((record) => record.channel === "system_alert").length,
      totalRetryItems: snapshots.length,
      unknownRetryItems: snapshots.filter((record) => record.retryStatus === "unknown").length
    };
  } catch (error) {
    console.error("[notification-retry-runtime] retry stats build failed", error);

    return {
      emailRetryItems: 0,
      failedRetryItems: 0,
      inAppRetryItems: 0,
      placeholderChannelRetryItems: 0,
      retryBlockedItems: 0,
      retryExhaustedItems: 0,
      retryPendingItems: 0,
      retryReadyItems: 0,
      systemAlertRetryItems: 0,
      totalRetryItems: 0,
      unknownRetryItems: 0
    };
  }
}

export function listNotificationRetryStatusCatalog() {
  return NOTIFICATION_RETRY_STATUSES.map((status) => ({
    label: getNotificationRetryStatusLabel(status),
    status
  }));
}

// NT-11+ placeholders: retry execution, scheduling, and worker processing stay disconnected.
export const NOTIFICATION_RETRY_FUTURE_HOOKS = [
  "notification_retry_execution",
  "notification_retry_scheduling",
  "notification_retry_worker"
] as const;
