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

export type NotificationQueueStatus =
  | "cancelled"
  | "failed"
  | "paused"
  | "processing"
  | "queued"
  | "retry_pending"
  | "sent"
  | "unknown";

export type NotificationQueuePriority = "high" | "low" | "normal" | "unknown";

export type NotificationQueueRecord = {
  attemptCount: number;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  errorSummary: string | null;
  lockedAt: string | null;
  notificationId: string;
  priority: NotificationQueuePriority;
  priorityLabel: string;
  processedAt: string | null;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  queueId: string;
  scheduledAt: string | null;
  status: NotificationQueueStatus;
  statusLabel: string;
  updatedAt: string | null;
};

export type NotificationQueueRuntimeStats = {
  emailQueueItems: number;
  failedItems: number;
  inAppQueueItems: number;
  placeholderChannelQueueItems: number;
  processingItems: number;
  queuedItems: number;
  retryPendingItems: number;
  sentItems: number;
  systemAlertQueueItems: number;
  totalQueueItems: number;
  unknownItems: number;
};

export const NOTIFICATION_QUEUE_STATUSES: readonly NotificationQueueStatus[] = [
  "queued",
  "processing",
  "retry_pending",
  "failed",
  "sent",
  "cancelled",
  "paused",
  "unknown"
] as const;

const statusLabels: Record<NotificationQueueStatus, string> = {
  cancelled: "Cancelled",
  failed: "Failed",
  paused: "Paused",
  processing: "Processing",
  queued: "Queued",
  retry_pending: "Retry pending",
  sent: "Processed",
  unknown: "Unknown"
};

const priorityLabels: Record<NotificationQueuePriority, string> = {
  high: "High",
  low: "Low",
  normal: "Normal",
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

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function getNotificationQueueStatusLabel(status: NotificationQueueStatus) {
  return statusLabels[status];
}

export function getNotificationQueuePriorityLabel(priority: NotificationQueuePriority) {
  return priorityLabels[priority];
}

export function parseNotificationQueueStatusSafe(value: unknown, options: { lockedAt?: unknown; sentAt?: unknown } = {}) {
  const cleaned = text(value, 80).toLowerCase();
  const lockedAt = text(options.lockedAt, 80);
  const sentAt = text(options.sentAt, 80);

  if (lockedAt && !sentAt && (cleaned === "pending" || cleaned === "queued" || cleaned === "processing")) {
    return "processing" as const;
  }

  if (!cleaned) {
    return "unknown" as const;
  }

  if (cleaned === "pending" || cleaned === "queued" || cleaned === "queue") {
    return "queued" as const;
  }

  if (cleaned === "retry_pending" || cleaned === "retry-pending" || cleaned === "retry") {
    return "retry_pending" as const;
  }

  if (cleaned === "processing" || cleaned === "in_progress" || cleaned === "in-progress") {
    return "processing" as const;
  }

  if (cleaned === "sent" || cleaned === "success" || cleaned === "succeeded" || cleaned === "processed") {
    return "sent" as const;
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    return "failed" as const;
  }

  if (cleaned === "cancelled" || cleaned === "canceled") {
    return "cancelled" as const;
  }

  if (cleaned === "paused") {
    return "paused" as const;
  }

  if (cleaned === "unread") {
    return "queued" as const;
  }

  if (cleaned === "warning") {
    return "queued" as const;
  }

  return "unknown" as const;
}

export function parseNotificationQueuePrioritySafe(templateKey?: unknown) {
  const key = text(templateKey, 160).toLowerCase();

  if (!key) {
    return "normal" as const;
  }

  if (
    key.includes("payment_failed") ||
    key.includes("subscription") ||
    key.includes("security") ||
    key.includes("billing")
  ) {
    return "high" as const;
  }

  if (key.includes("review_reminder") || key.includes("thank_you") || key.includes("abandoned_cart")) {
    return "low" as const;
  }

  return "normal" as const;
}

export function parseNotificationQueueAttemptCountSafe(value: unknown, fallback = 0) {
  const count = safeCount(value);
  return count > 0 ? count : fallback;
}

function buildQueueRecordBase(params: {
  attemptCount: number;
  channel: NotificationChannel;
  createdAt?: unknown;
  errorSummary?: unknown;
  lockedAt?: unknown;
  notificationId: string;
  priority: NotificationQueuePriority;
  processedAt?: unknown;
  queueId: string;
  scheduledAt?: unknown;
  status: NotificationQueueStatus;
  updatedAt?: unknown;
}): NotificationQueueRecord {
  const channel = parseNotificationChannelSafe(params.channel);
  const providerKey = mapNotificationChannelToProvider(channel);
  const status = params.status;

  return {
    attemptCount: Math.max(0, params.attemptCount),
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    createdAt: text(params.createdAt, 80) || null,
    errorSummary: sanitizeNotificationDeliveryErrorSummary(params.errorSummary),
    lockedAt: text(params.lockedAt, 80) || null,
    notificationId: text(params.notificationId, 160) || "unknown_notification",
    priority: params.priority,
    priorityLabel: getNotificationQueuePriorityLabel(params.priority),
    processedAt: text(params.processedAt, 80) || null,
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    queueId: text(params.queueId, 160) || "unknown_queue",
    scheduledAt: text(params.scheduledAt, 80) || null,
    status,
    statusLabel: getNotificationQueueStatusLabel(status),
    updatedAt: text(params.updatedAt, 80) || text(params.createdAt, 80) || null
  };
}

function isActiveQueueStatus(status: NotificationQueueStatus) {
  return ["queued", "processing", "retry_pending", "failed", "paused"].includes(status);
}

function buildEmailQueueRecord(log: Record<string, unknown>): NotificationQueueRecord | null {
  const status = parseNotificationQueueStatusSafe(log.status, {
    lockedAt: log.locked_at,
    sentAt: log.sent_at
  });

  if (!isActiveQueueStatus(status) && status !== "unknown") {
    return null;
  }

  const priority = parseNotificationQueuePrioritySafe(log.template_key);
  const attemptCount = parseNotificationQueueAttemptCountSafe(
    log.attempt_count ?? log.retry_count,
    status === "failed" || status === "retry_pending" ? 1 : 0
  );

  return buildQueueRecordBase({
    attemptCount,
    channel: "email",
    createdAt: log.created_at,
    errorSummary: status === "failed" ? log.last_error || log.error_message : null,
    lockedAt: log.locked_at,
    notificationId: text(log.id, 160) || `email:${text(log.created_at, 80)}`,
    priority,
    processedAt: log.sent_at,
    queueId: `email-queue:${text(log.id, 160) || text(log.created_at, 80)}`,
    scheduledAt: log.next_retry_at ?? log.created_at,
    status,
    updatedAt: log.updated_at ?? log.last_attempt_at ?? log.created_at
  });
}

function buildInAppQueueRecord(notification: Record<string, unknown>): NotificationQueueRecord | null {
  if (text(notification.read_at, 80)) {
    return null;
  }

  const status = parseNotificationQueueStatusSafe(notification.status || "unread");

  if (status !== "queued" && status !== "unknown") {
    return null;
  }

  const rawType = text(notification.type, 160) || "system";
  const priority = parseNotificationQueuePrioritySafe(`in_app:${rawType}`);

  return buildQueueRecordBase({
    attemptCount: 0,
    channel: "in_app",
    createdAt: notification.created_at,
    notificationId: text(notification.id, 160) || `in_app:${text(notification.created_at, 80)}`,
    priority,
    queueId: `in-app-queue:${text(notification.id, 160) || text(notification.created_at, 80)}`,
    scheduledAt: notification.created_at,
    status: status === "unknown" ? "queued" : status,
    updatedAt: notification.created_at
  });
}

function buildSystemAlertQueueRecord(event: Record<string, unknown>): NotificationQueueRecord | null {
  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
  const eventStatus = text(event.event_status, 80);
  const status = parseNotificationQueueStatusSafe(eventStatus === "failed" ? "failed" : "warning");

  if (!isActiveQueueStatus(status)) {
    return null;
  }

  const rawType = text(event.event_type, 160) || "system_alert";

  return buildQueueRecordBase({
    attemptCount: status === "failed" ? 1 : 0,
    channel: "system_alert",
    createdAt: event.created_at,
    errorSummary: metadata.error || metadata.message || metadata.note || event.event_type,
    notificationId: text(event.id, 160) || `system_alert:${text(event.created_at, 80)}`,
    priority: "high",
    queueId: `system-alert-queue:${text(event.id, 160) || text(event.created_at, 80)}`,
    scheduledAt: event.created_at,
    status,
    updatedAt: event.created_at
  });
}

export function buildNotificationQueueRecordsSafe(params: {
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  notifications?: Array<Record<string, unknown>> | null;
}): { queueItems: NotificationQueueRecord[]; warning: string | null } {
  try {
    const queueItems: NotificationQueueRecord[] = [];

    for (const log of params.emailLogs ?? []) {
      const record = buildEmailQueueRecord(log);
      if (record) {
        queueItems.push(record);
      }
    }

    for (const notification of params.notifications ?? []) {
      const record = buildInAppQueueRecord(notification);
      if (record) {
        queueItems.push(record);
      }
    }

    for (const event of params.monitoringEvents ?? []) {
      if (!["failed", "warning"].includes(text(event.event_status))) {
        continue;
      }

      const record = buildSystemAlertQueueRecord(event);
      if (record) {
        queueItems.push(record);
      }
    }

    return {
      queueItems: queueItems
        .sort((left, right) => dateValue(right.scheduledAt ?? right.createdAt ?? "") - dateValue(left.scheduledAt ?? left.createdAt ?? ""))
        .slice(0, 100),
      warning: null
    };
  } catch (error) {
    console.error("[notification-queue-runtime] queue records build failed", error);

    return {
      queueItems: [],
      warning: "Notification queue records could not be built safely. Showing empty queue state."
    };
  }
}

export function buildNotificationQueueRuntimeStatsSafe(
  queueItems: NotificationQueueRecord[] | null | undefined
): NotificationQueueRuntimeStats {
  try {
    const snapshots = Array.isArray(queueItems) ? queueItems : [];
    const placeholderChannels: NotificationChannel[] = ["sms", "whatsapp", "push"];

    return {
      emailQueueItems: snapshots.filter((record) => record.channel === "email").length,
      failedItems: snapshots.filter((record) => record.status === "failed").length,
      inAppQueueItems: snapshots.filter((record) => record.channel === "in_app").length,
      placeholderChannelQueueItems: snapshots.filter((record) => placeholderChannels.includes(record.channel)).length,
      processingItems: snapshots.filter((record) => record.status === "processing").length,
      queuedItems: snapshots.filter((record) => record.status === "queued").length,
      retryPendingItems: snapshots.filter((record) => record.status === "retry_pending").length,
      sentItems: snapshots.filter((record) => record.status === "sent").length,
      systemAlertQueueItems: snapshots.filter((record) => record.channel === "system_alert").length,
      totalQueueItems: snapshots.length,
      unknownItems: snapshots.filter((record) => record.status === "unknown").length
    };
  } catch (error) {
    console.error("[notification-queue-runtime] queue stats build failed", error);

    return {
      emailQueueItems: 0,
      failedItems: 0,
      inAppQueueItems: 0,
      placeholderChannelQueueItems: 0,
      processingItems: 0,
      queuedItems: 0,
      retryPendingItems: 0,
      sentItems: 0,
      systemAlertQueueItems: 0,
      totalQueueItems: 0,
      unknownItems: 0
    };
  }
}

export function listNotificationQueueStatusCatalog() {
  return NOTIFICATION_QUEUE_STATUSES.map((status) => ({
    label: getNotificationQueueStatusLabel(status),
    status
  }));
}

// NT-10+ placeholders: queue processing, locking, and retry execution stay disconnected.
export const NOTIFICATION_QUEUE_FUTURE_HOOKS = [
  "notification_queue_processing",
  "notification_queue_lock",
  "notification_queue_retry_execution"
] as const;
