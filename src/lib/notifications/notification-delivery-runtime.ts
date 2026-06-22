import "server-only";

import {
  getNotificationChannelLabel,
  parseNotificationChannelSafe,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  getNotificationProviderLabel,
  mapNotificationChannelToProvider,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import {
  getNotificationStatusLabel,
  parseNotificationDeliveryStatusSafe,
  type NotificationDeliveryStatus
} from "@/src/lib/notifications/notification-status-runtime";
import {
  parseNotificationTemplateKeySafe,
  resolveNotificationTemplateLabel
} from "@/src/lib/notifications/notification-template-runtime";

export type NotificationDeliveryRecord = {
  attemptCount: number;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  deliveredAt: string | null;
  deliveryId: string;
  deliveryStatus: NotificationDeliveryStatus;
  deliveryStatusLabel: string;
  errorSummary: string | null;
  notificationId: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  readAt: string | null;
  recipientMasked: string;
  templateKey: string;
  templateLabel: string;
  updatedAt: string | null;
};

export type NotificationDeliveryRuntimeStats = {
  archivedDeliveries: number;
  cancelledDeliveries: number;
  deliveredDeliveries: number;
  draftDeliveries: number;
  emailDeliveries: number;
  failedDeliveries: number;
  inAppDeliveries: number;
  placeholderChannelDeliveries: number;
  queuedDeliveries: number;
  readDeliveries: number;
  retryDeliveries: number;
  sentDeliveries: number;
  systemAlertDeliveries: number;
  totalDeliveries: number;
  unknownDeliveries: number;
};

export const NOTIFICATION_DELIVERY_FALLBACK_ID = "unknown_notification_delivery" as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|sms|whatsapp|push|provider[_-]?config|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

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

function maskEntityReference(value: unknown, prefix: string) {
  const raw = text(value, 80);
  if (!raw) return "platform recipient";
  if (raw.length <= 8) return `${prefix}:${raw.slice(0, 2)}***`;
  return `${prefix}:${raw.slice(0, 8)}...`;
}

export function maskNotificationDeliveryRecipient(params: {
  channel: NotificationChannel;
  recipient?: unknown;
  userId?: unknown;
  workspaceId?: unknown;
}) {
  if (params.channel === "system_alert") {
    return "platform admins";
  }

  if (params.channel === "in_app") {
    if (text(params.userId, 80)) {
      return maskEntityReference(params.userId, "user");
    }

    if (text(params.workspaceId, 80)) {
      return maskEntityReference(params.workspaceId, "workspace");
    }

    return "platform recipient";
  }

  const raw = text(params.recipient, 160);
  if (!raw) {
    return "Unknown recipient";
  }

  const [local, domain] = raw.split("@");
  if (!local || !domain) {
    return "[masked-recipient]";
  }

  const visibleLocal = local.slice(0, 2);
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const extension = domainParts.slice(1).join(".");

  return `${visibleLocal}${"*".repeat(Math.max(2, local.length - 2))}@${domainName.slice(0, 1)}***${extension ? `.${extension}` : ""}`;
}

export function sanitizeNotificationDeliveryErrorSummary(value: unknown) {
  const cleaned = text(value, 240)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");

  if (!cleaned || secretPattern.test(cleaned)) {
    return null;
  }

  return cleaned.slice(0, 180);
}

export function parseNotificationDeliveryAttemptCountSafe(value: unknown, fallback = 0) {
  const count = safeCount(value);
  return count > 0 ? count : fallback;
}

function resolveDeliveredAt(params: {
  deliveryStatus: NotificationDeliveryStatus;
  readAt?: unknown;
  sentAt?: unknown;
}) {
  if (params.deliveryStatus === "read" && text(params.readAt, 80)) {
    return text(params.readAt, 80);
  }

  if (["sent", "delivered"].includes(params.deliveryStatus) && text(params.sentAt, 80)) {
    return text(params.sentAt, 80);
  }

  return null;
}

function buildDeliveryRecordBase(params: {
  attemptCount: number;
  channel: NotificationChannel;
  createdAt?: unknown;
  deliveredAt?: string | null;
  deliveryId: string;
  deliveryStatus: NotificationDeliveryStatus;
  errorSummary?: unknown;
  notificationId: string;
  readAt?: unknown;
  recipientMasked: string;
  templateKey: unknown;
  updatedAt?: unknown;
}): NotificationDeliveryRecord {
  const channel = parseNotificationChannelSafe(params.channel);
  const providerKey = mapNotificationChannelToProvider(channel);
  const templateKey = parseNotificationTemplateKeySafe(params.templateKey);
  const deliveryStatus = params.deliveryStatus;

  return {
    attemptCount: Math.max(0, params.attemptCount),
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    createdAt: text(params.createdAt, 80) || null,
    deliveredAt: params.deliveredAt ?? null,
    deliveryId: text(params.deliveryId, 160) || NOTIFICATION_DELIVERY_FALLBACK_ID,
    deliveryStatus,
    deliveryStatusLabel: getNotificationStatusLabel(deliveryStatus),
    errorSummary: sanitizeNotificationDeliveryErrorSummary(params.errorSummary),
    notificationId: text(params.notificationId, 160) || NOTIFICATION_DELIVERY_FALLBACK_ID,
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    readAt: text(params.readAt, 80) || null,
    recipientMasked: text(params.recipientMasked, 160) || "Unknown recipient",
    templateKey,
    templateLabel: resolveNotificationTemplateLabel(templateKey),
    updatedAt: text(params.updatedAt, 80) || text(params.createdAt, 80) || null
  };
}

export function buildNotificationDeliveryFallbackRecordSafe(): NotificationDeliveryRecord {
  return buildDeliveryRecordBase({
    attemptCount: 0,
    channel: "in_app",
    createdAt: null,
    deliveredAt: null,
    deliveryId: NOTIFICATION_DELIVERY_FALLBACK_ID,
    deliveryStatus: "draft",
    errorSummary: null,
    notificationId: NOTIFICATION_DELIVERY_FALLBACK_ID,
    recipientMasked: "Unknown recipient",
    templateKey: NOTIFICATION_DELIVERY_FALLBACK_ID,
    updatedAt: null
  });
}

function buildInAppDeliveryRecord(notification: Record<string, unknown>): NotificationDeliveryRecord {
  const rawType = text(notification.type, 160) || "system";
  const readAt = notification.read_at;
  const deliveryStatus = parseNotificationDeliveryStatusSafe(notification.status, { readAt });

  return buildDeliveryRecordBase({
    attemptCount: deliveryStatus === "failed" ? 1 : deliveryStatus === "read" ? 1 : 0,
    channel: "in_app",
    createdAt: notification.created_at,
    deliveredAt: resolveDeliveredAt({ deliveryStatus, readAt }),
    deliveryId: `in_app:${text(notification.id, 160) || text(notification.created_at, 80)}`,
    deliveryStatus,
    notificationId: text(notification.id, 160) || `in_app:${text(notification.created_at, 80)}`,
    readAt,
    recipientMasked: maskNotificationDeliveryRecipient({
      channel: "in_app",
      userId: notification.user_id,
      workspaceId: notification.workspace_id
    }),
    templateKey: `in_app:${rawType}`,
    updatedAt: readAt ?? notification.created_at
  });
}

function buildEmailDeliveryRecord(log: Record<string, unknown>): NotificationDeliveryRecord {
  const deliveryStatus = parseNotificationDeliveryStatusSafe(log.status);
  const attemptCount = parseNotificationDeliveryAttemptCountSafe(
    log.attempt_count ?? log.retry_count,
    deliveryStatus === "failed" || deliveryStatus === "retry" ? 1 : 0
  );

  return buildDeliveryRecordBase({
    attemptCount,
    channel: "email",
    createdAt: log.created_at,
    deliveredAt: resolveDeliveredAt({ deliveryStatus, sentAt: log.sent_at }),
    deliveryId: `email:${text(log.id, 160) || text(log.created_at, 80)}`,
    deliveryStatus,
    errorSummary: deliveryStatus === "failed" ? log.last_error || log.error_message : null,
    notificationId: text(log.id, 160) || `email:${text(log.created_at, 80)}`,
    recipientMasked: maskNotificationDeliveryRecipient({
      channel: "email",
      recipient: log.recipient
    }),
    templateKey: log.template_key,
    updatedAt: log.updated_at ?? log.sent_at ?? log.created_at
  });
}

function buildSystemAlertDeliveryRecord(event: Record<string, unknown>): NotificationDeliveryRecord {
  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
  const rawType = text(event.event_type, 160) || "system_alert";
  const deliveryStatus = parseNotificationDeliveryStatusSafe(
    text(event.event_status) === "failed" ? "failed" : "queued"
  );

  return buildDeliveryRecordBase({
    attemptCount: deliveryStatus === "failed" ? 1 : 0,
    channel: "system_alert",
    createdAt: event.created_at,
    deliveryId: `system_alert:${text(event.id, 160) || text(event.created_at, 80)}`,
    deliveryStatus,
    errorSummary: metadata.error || metadata.message || metadata.note || event.event_type,
    notificationId: text(event.id, 160) || `system_alert:${text(event.created_at, 80)}`,
    recipientMasked: maskNotificationDeliveryRecipient({ channel: "system_alert" }),
    templateKey: `system_alert:${rawType}`,
    updatedAt: event.created_at
  });
}

export function buildNotificationDeliveryRecordsSafe(params: {
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  notifications?: Array<Record<string, unknown>> | null;
}): { deliveries: NotificationDeliveryRecord[]; warning: string | null } {
  try {
    const deliveries: NotificationDeliveryRecord[] = [];

    for (const notification of params.notifications ?? []) {
      deliveries.push(buildInAppDeliveryRecord(notification));
    }

    for (const log of params.emailLogs ?? []) {
      deliveries.push(buildEmailDeliveryRecord(log));
    }

    for (const event of params.monitoringEvents ?? []) {
      if (!["failed", "warning"].includes(text(event.event_status))) {
        continue;
      }

      deliveries.push(buildSystemAlertDeliveryRecord(event));
    }

    const sorted = deliveries.sort((left, right) => {
      const leftDate = dateValue(left.createdAt ?? "");
      const rightDate = dateValue(right.createdAt ?? "");
      return rightDate - leftDate;
    });

    if (!sorted.length) {
      return {
        deliveries: [buildNotificationDeliveryFallbackRecordSafe()],
        warning: null
      };
    }

    return {
      deliveries: sorted.slice(0, 100),
      warning: null
    };
  } catch (error) {
    console.error("[notification-delivery-runtime] delivery records build failed", error);

    return {
      deliveries: [buildNotificationDeliveryFallbackRecordSafe()],
      warning: "Notification delivery records could not be built safely. Showing fallback delivery row."
    };
  }
}

export function buildNotificationDeliveryRuntimeStatsSafe(
  deliveries: NotificationDeliveryRecord[] | null | undefined
): NotificationDeliveryRuntimeStats {
  try {
    const snapshots = Array.isArray(deliveries) ? deliveries : [];
    const placeholderChannels: NotificationChannel[] = ["sms", "whatsapp", "push"];

    return {
      archivedDeliveries: snapshots.filter((record) => record.deliveryStatus === "archived").length,
      cancelledDeliveries: snapshots.filter((record) => record.deliveryStatus === "cancelled").length,
      deliveredDeliveries: snapshots.filter((record) => record.deliveryStatus === "delivered").length,
      draftDeliveries: snapshots.filter((record) => record.deliveryStatus === "draft").length,
      emailDeliveries: snapshots.filter((record) => record.channel === "email").length,
      failedDeliveries: snapshots.filter((record) => record.deliveryStatus === "failed").length,
      inAppDeliveries: snapshots.filter((record) => record.channel === "in_app").length,
      placeholderChannelDeliveries: snapshots.filter((record) => placeholderChannels.includes(record.channel)).length,
      queuedDeliveries: snapshots.filter((record) => record.deliveryStatus === "queued").length,
      readDeliveries: snapshots.filter((record) => record.deliveryStatus === "read").length,
      retryDeliveries: snapshots.filter((record) => record.deliveryStatus === "retry").length,
      sentDeliveries: snapshots.filter((record) => record.deliveryStatus === "sent").length,
      systemAlertDeliveries: snapshots.filter((record) => record.channel === "system_alert").length,
      totalDeliveries: snapshots.length,
      unknownDeliveries: snapshots.filter((record) => record.deliveryId === NOTIFICATION_DELIVERY_FALLBACK_ID).length
    };
  } catch (error) {
    console.error("[notification-delivery-runtime] delivery stats build failed", error);

    return {
      archivedDeliveries: 0,
      cancelledDeliveries: 0,
      deliveredDeliveries: 0,
      draftDeliveries: 0,
      emailDeliveries: 0,
      failedDeliveries: 0,
      inAppDeliveries: 0,
      placeholderChannelDeliveries: 0,
      queuedDeliveries: 0,
      readDeliveries: 0,
      retryDeliveries: 0,
      sentDeliveries: 0,
      systemAlertDeliveries: 0,
      totalDeliveries: 0,
      unknownDeliveries: 0
    };
  }
}

// NT-9+ placeholders: delivery retry, queue processing, and provider execution stay disconnected.
export const NOTIFICATION_DELIVERY_FUTURE_HOOKS = [
  "notification_delivery_retry",
  "notification_delivery_queue_processing",
  "notification_delivery_provider_execution"
] as const;
