import "server-only";

import type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
import { getNotificationChannelLabel } from "@/src/lib/notifications/notification-channel-runtime";
import type { NotificationDeliveryStatus } from "@/src/lib/notifications/notification-status-runtime";
import { getNotificationStatusLabel } from "@/src/lib/notifications/notification-status-runtime";
import type { NotificationProviderKey } from "@/src/lib/notifications/notification-provider-runtime";
import { getNotificationProviderLabel } from "@/src/lib/notifications/notification-provider-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import {
  maskNotificationSecurityIdentifierSafe,
  maskNotificationSecurityProviderReferenceSafe,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";
import { sanitizeNotificationRecipientDisplaySafe } from "@/src/lib/notifications/notification-recipient-runtime";

export type NotificationEventType =
  | "notification_cancelled"
  | "notification_created"
  | "notification_delivered"
  | "notification_failed"
  | "notification_queued"
  | "notification_read"
  | "notification_retry_scheduled"
  | "notification_sent"
  | "unknown";

export type NotificationEventLogInput = {
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string;
  errorSummary: string | null;
  id: string;
  recipientMasked: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  templateKey: string;
  type: string;
};

export type NotificationEventRecord = {
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  eventId: string;
  eventKey: string;
  eventType: NotificationEventType;
  eventTypeLabel: string;
  metadataSummary: string;
  notificationReference: string;
  occurredAt: string | null;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  recipientReference: string;
  safeSummary: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
};

export type NotificationEventRuntimeStats = {
  cancelledEvents: number;
  createdEvents: number;
  deliveredEvents: number;
  failedEvents: number;
  queuedEvents: number;
  readEvents: number;
  retryScheduledEvents: number;
  sentEvents: number;
  totalEvents: number;
  unknownEvents: number;
};

export const NOTIFICATION_EVENT_FALLBACK_ID = "unknown_notification_event" as const;

export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  "notification_created",
  "notification_queued",
  "notification_sent",
  "notification_delivered",
  "notification_read",
  "notification_failed",
  "notification_retry_scheduled",
  "notification_cancelled",
  "unknown"
] as const;

const eventTypeLabels: Record<NotificationEventType, string> = {
  notification_cancelled: "Notification cancelled",
  notification_created: "Notification created",
  notification_delivered: "Notification delivered",
  notification_failed: "Notification failed",
  notification_queued: "Notification queued",
  notification_read: "Notification read",
  notification_retry_scheduled: "Notification retry scheduled",
  notification_sent: "Notification sent",
  unknown: "Unknown notification event"
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

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNotificationEventTypeLabel(eventType: NotificationEventType) {
  return eventTypeLabels[eventType];
}

export function mapNotificationDeliveryStatusToEventType(
  status: NotificationDeliveryStatus
): NotificationEventType {
  switch (status) {
    case "draft":
      return "notification_created";
    case "queued":
      return "notification_queued";
    case "sent":
      return "notification_sent";
    case "delivered":
      return "notification_delivered";
    case "read":
      return "notification_read";
    case "failed":
      return "notification_failed";
    case "retry":
      return "notification_retry_scheduled";
    case "cancelled":
      return "notification_cancelled";
    default:
      return "unknown";
  }
}

export function sanitizeNotificationEventMetadataSafe(params: {
  channel: NotificationChannel;
  errorSummary?: unknown;
  eventType: NotificationEventType;
  providerKey: NotificationProviderKey;
  templateKey?: unknown;
  type?: unknown;
}) {
  return sanitizeNotificationMonitoringMetadata({
    channel: params.channel,
    event_type: params.eventType,
    note: sanitizeNotificationAdminDisplayTextSafe(params.errorSummary, 120) || undefined,
    provider_key: maskNotificationSecurityProviderReferenceSafe(params.providerKey),
    source: "notification_event_runtime",
    template_key: text(params.templateKey, 80) || undefined,
    type: text(params.type, 80) || undefined
  });
}

function buildEventSafeSummary(params: {
  channel: NotificationChannel;
  eventType: NotificationEventType;
  notificationReference: string;
  recipientReference: string;
  statusLabel: string;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `${getNotificationEventTypeLabel(params.eventType)} on ${getNotificationChannelLabel(params.channel)} channel.`,
      `Notification reference ${params.notificationReference}.`,
      `Recipient reference ${params.recipientReference}.`,
      `Status ${params.statusLabel}.`,
      "Read-only notification event foundation only. No event dispatch or delivery connected."
    ].join(" "),
    240
  );
}

function buildEventRecordFromLog(log: NotificationEventLogInput): NotificationEventRecord {
  const eventType = mapNotificationDeliveryStatusToEventType(log.status);
  const notificationReference =
    maskNotificationSecurityIdentifierSafe(log.id, "notification") || NOTIFICATION_EVENT_FALLBACK_ID;
  const eventId = maskNotificationSecurityIdentifierSafe(`${log.id}:${eventType}`, "event") || NOTIFICATION_EVENT_FALLBACK_ID;
  const eventKey = `${eventType}:${notificationReference}`;
  const recipientReference = sanitizeNotificationRecipientDisplaySafe(log.recipientMasked, 120);
  const statusLabel =
    sanitizeNotificationAdminDisplayTextSafe(log.statusLabel, 80) || getNotificationStatusLabel(log.status);
  const occurredAt = text(log.createdAt, 80) || null;
  const providerKey = log.providerKey;
  const providerLabel = text(log.providerLabel, 80) || getNotificationProviderLabel(providerKey);

  return {
    channel: log.channel,
    channelLabel: text(log.channelLabel, 80) || getNotificationChannelLabel(log.channel),
    createdAt: occurredAt,
    eventId,
    eventKey,
    eventType,
    eventTypeLabel: getNotificationEventTypeLabel(eventType),
    metadataSummary: sanitizeNotificationEventMetadataSafe({
      channel: log.channel,
      errorSummary: log.errorSummary,
      eventType,
      providerKey,
      templateKey: log.templateKey,
      type: log.type
    }),
    notificationReference,
    occurredAt,
    providerKey,
    providerLabel,
    recipientReference,
    safeSummary: buildEventSafeSummary({
      channel: log.channel,
      eventType,
      notificationReference,
      recipientReference,
      statusLabel
    }),
    status: log.status,
    statusLabel
  };
}

export function buildNotificationEventFallbackRecordSafe(): NotificationEventRecord {
  return {
    channel: "in_app",
    channelLabel: getNotificationChannelLabel("in_app"),
    createdAt: null,
    eventId: NOTIFICATION_EVENT_FALLBACK_ID,
    eventKey: "unknown:unknown_notification_event",
    eventType: "unknown",
    eventTypeLabel: getNotificationEventTypeLabel("unknown"),
    metadataSummary: sanitizeNotificationEventMetadataSafe({
      channel: "in_app",
      eventType: "unknown",
      providerKey: "internal_in_app"
    }),
    notificationReference: NOTIFICATION_EVENT_FALLBACK_ID,
    occurredAt: null,
    providerKey: "internal_in_app",
    providerLabel: getNotificationProviderLabel("internal_in_app"),
    recipientReference: "Unknown recipient",
    safeSummary:
      "Notification event foundation placeholder only. No event creation, dispatch, or delivery connected.",
    status: "draft",
    statusLabel: getNotificationStatusLabel("draft")
  };
}

export function buildNotificationEventRecordsSafe(params: {
  logs?: NotificationEventLogInput[] | null;
}): { eventItems: NotificationEventRecord[]; warning: string | null } {
  try {
    const logs = Array.isArray(params.logs) ? params.logs : [];

    if (!logs.length) {
      return {
        eventItems: [buildNotificationEventFallbackRecordSafe()],
        warning: null
      };
    }

    const eventItems = logs
      .map((log) => buildEventRecordFromLog(log))
      .sort((left, right) => dateValue(right.occurredAt ?? "") - dateValue(left.occurredAt ?? ""));

    return {
      eventItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-event-runtime] event records build failed", error);

    return {
      eventItems: [buildNotificationEventFallbackRecordSafe()],
      warning: "Notification event runtime fallback applied."
    };
  }
}

export function buildNotificationEventRuntimeStatsSafe(
  eventItems: NotificationEventRecord[] | null | undefined
): NotificationEventRuntimeStats {
  try {
    const items = Array.isArray(eventItems) ? eventItems : [];

    return {
      cancelledEvents: items.filter((item) => item.eventType === "notification_cancelled").length,
      createdEvents: items.filter((item) => item.eventType === "notification_created").length,
      deliveredEvents: items.filter((item) => item.eventType === "notification_delivered").length,
      failedEvents: items.filter((item) => item.eventType === "notification_failed").length,
      queuedEvents: items.filter((item) => item.eventType === "notification_queued").length,
      readEvents: items.filter((item) => item.eventType === "notification_read").length,
      retryScheduledEvents: items.filter((item) => item.eventType === "notification_retry_scheduled").length,
      sentEvents: items.filter((item) => item.eventType === "notification_sent").length,
      totalEvents: items.length,
      unknownEvents: items.filter((item) => item.eventType === "unknown").length
    };
  } catch (error) {
    console.error("[notification-event-runtime] event runtime stats build failed", error);

    return {
      cancelledEvents: 0,
      createdEvents: 0,
      deliveredEvents: 0,
      failedEvents: 0,
      queuedEvents: 0,
      readEvents: 0,
      retryScheduledEvents: 0,
      sentEvents: 0,
      totalEvents: 0,
      unknownEvents: 0
    };
  }
}

export function listNotificationEventTypeCatalog() {
  return NOTIFICATION_EVENT_TYPES.filter((eventType) => eventType !== "unknown").map((eventType) => ({
    description: `Read-only ${eventTypeLabels[eventType].toLowerCase()} visibility for Super Admin.`,
    eventType,
    label: eventTypeLabels[eventType]
  }));
}

// NT-20+ placeholders: event dispatch, replay, and streaming stay disconnected.
export const NOTIFICATION_EVENT_FUTURE_HOOKS = [
  "notification_event_dispatch",
  "notification_event_replay",
  "notification_event_streaming"
] as const;
