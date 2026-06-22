import "server-only";

import type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
import { getNotificationChannelLabel } from "@/src/lib/notifications/notification-channel-runtime";
import type { NotificationDeliveryRecord } from "@/src/lib/notifications/notification-delivery-runtime";
import { sanitizeNotificationDeliveryErrorSummary } from "@/src/lib/notifications/notification-delivery-runtime";
import type { NotificationEventRecord } from "@/src/lib/notifications/notification-event-runtime";
import type { NotificationProviderKey } from "@/src/lib/notifications/notification-provider-runtime";
import { getNotificationProviderLabel } from "@/src/lib/notifications/notification-provider-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import type { NotificationDeliveryStatus } from "@/src/lib/notifications/notification-status-runtime";
import { getNotificationStatusLabel } from "@/src/lib/notifications/notification-status-runtime";
import {
  maskNotificationSecurityIdentifierSafe,
  maskNotificationSecurityProviderReferenceSafe,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

export type NotificationLogLevel = "debug_hidden" | "error" | "info" | "warning";

export type NotificationLogSourceInput = {
  category: string;
  categoryLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string;
  errorSummary: string | null;
  id: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
  storeOrUser: string;
  templateKey: string;
  templateLabel: string;
  type: string;
  typeLabel: string;
};

export type NotificationLogRecord = {
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  deliveryReference: string;
  eventReference: string;
  logId: string;
  logLevel: NotificationLogLevel;
  logLevelLabel: string;
  metadataSummary: string;
  notificationReference: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  safeMessage: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
};

export type NotificationLogRuntimeStats = {
  debugHiddenLogs: number;
  errorLogs: number;
  infoLogs: number;
  totalLogs: number;
  unknownLogs: number;
  warningLogs: number;
};

export const NOTIFICATION_LOG_FALLBACK_ID = "unknown_notification_log" as const;

export const NOTIFICATION_LOG_LEVELS: readonly NotificationLogLevel[] = [
  "info",
  "warning",
  "error",
  "debug_hidden"
] as const;

const logLevelLabels: Record<NotificationLogLevel, string> = {
  debug_hidden: "Debug hidden",
  error: "Error",
  info: "Info",
  warning: "Warning"
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

export function getNotificationLogLevelLabel(level: NotificationLogLevel) {
  return logLevelLabels[level];
}

export function resolveNotificationLogLevelSafe(params: {
  errorSummary?: unknown;
  status: NotificationDeliveryStatus;
  type?: unknown;
}): NotificationLogLevel {
  const type = text(params.type, 120).toLowerCase();

  if (params.status === "archived" || type.includes("debug") || type.includes("trace")) {
    return "debug_hidden";
  }

  if (text(params.errorSummary, 120) || params.status === "failed") {
    return "error";
  }

  if (["cancelled", "queued", "retry"].includes(params.status)) {
    return "warning";
  }

  if (params.status === "draft" && type.includes("system")) {
    return "warning";
  }

  return "info";
}

export function sanitizeNotificationLogMetadataSafe(params: {
  category?: unknown;
  channel: NotificationChannel;
  errorSummary?: unknown;
  logLevel: NotificationLogLevel;
  providerKey: NotificationProviderKey;
  status: NotificationDeliveryStatus;
  storeOrUser?: unknown;
  templateKey?: unknown;
  type?: unknown;
}) {
  return sanitizeNotificationMonitoringMetadata({
    category: text(params.category, 80) || undefined,
    channel: params.channel,
    event_status: params.status,
    log_level: params.logLevel,
    note: sanitizeNotificationAdminDisplayTextSafe(params.errorSummary, 120) || undefined,
    provider_key: maskNotificationSecurityProviderReferenceSafe(params.providerKey),
    source: "notification_log_runtime",
    store_or_user: sanitizeNotificationAdminDisplayTextSafe(params.storeOrUser, 80) || undefined,
    template_key: text(params.templateKey, 80) || undefined,
    type: text(params.type, 80) || undefined
  });
}

function buildSafeLogMessage(params: {
  channel: NotificationChannel;
  errorSummary?: unknown;
  logLevel: NotificationLogLevel;
  statusLabel: string;
  typeLabel: string;
}) {
  if (params.logLevel === "debug_hidden") {
    return "Debug log details hidden in production.";
  }

  const errorSummary = sanitizeNotificationDeliveryErrorSummary(params.errorSummary);
  if (errorSummary) {
    return errorSummary;
  }

  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `${params.typeLabel} notification log on ${getNotificationChannelLabel(params.channel)} channel.`,
      `Status ${params.statusLabel}.`,
      "Read-only notification log foundation only. No log export or write connected."
    ].join(" "),
    240
  );
}

function resolveDeliveryReference(params: {
  channel: NotificationChannel;
  deliveries: NotificationDeliveryRecord[];
  logId: string;
}): string {
  const direct = params.deliveries.find(
    (delivery) =>
      delivery.notificationId === params.logId ||
      delivery.deliveryId === `${params.channel}:${params.logId}` ||
      delivery.deliveryId.endsWith(`:${params.logId}`)
  );

  if (direct) {
    return maskNotificationSecurityIdentifierSafe(direct.deliveryId, "delivery") || NOTIFICATION_LOG_FALLBACK_ID;
  }

  return maskNotificationSecurityIdentifierSafe(`${params.channel}:${params.logId}`, "delivery") || NOTIFICATION_LOG_FALLBACK_ID;
}

function resolveEventReference(params: {
  eventItems: NotificationEventRecord[];
  notificationReference: string;
}): string {
  const match = params.eventItems.find((item) => item.notificationReference === params.notificationReference);
  if (match) {
    return match.eventId;
  }

  return maskNotificationSecurityIdentifierSafe(params.notificationReference, "event") || NOTIFICATION_LOG_FALLBACK_ID;
}

function buildLogRecordFromSource(params: {
  deliveries: NotificationDeliveryRecord[];
  eventItems: NotificationEventRecord[];
  log: NotificationLogSourceInput;
}): NotificationLogRecord {
  const logLevel = resolveNotificationLogLevelSafe({
    errorSummary: params.log.errorSummary,
    status: params.log.status,
    type: params.log.type
  });
  const notificationReference =
    maskNotificationSecurityIdentifierSafe(params.log.id, "notification") || NOTIFICATION_LOG_FALLBACK_ID;
  const logId = maskNotificationSecurityIdentifierSafe(params.log.id, "log") || NOTIFICATION_LOG_FALLBACK_ID;
  const statusLabel =
    sanitizeNotificationAdminDisplayTextSafe(params.log.statusLabel, 80) ||
    getNotificationStatusLabel(params.log.status);
  const providerKey = params.log.providerKey;
  const providerLabel = text(params.log.providerLabel, 80) || getNotificationProviderLabel(providerKey);
  const createdAt = text(params.log.createdAt, 80) || null;

  return {
    channel: params.log.channel,
    channelLabel: text(params.log.channelLabel, 80) || getNotificationChannelLabel(params.log.channel),
    createdAt,
    deliveryReference: resolveDeliveryReference({
      channel: params.log.channel,
      deliveries: params.deliveries,
      logId: params.log.id
    }),
    eventReference: resolveEventReference({
      eventItems: params.eventItems,
      notificationReference
    }),
    logId,
    logLevel,
    logLevelLabel: getNotificationLogLevelLabel(logLevel),
    metadataSummary: sanitizeNotificationLogMetadataSafe({
      category: params.log.category,
      channel: params.log.channel,
      errorSummary: params.log.errorSummary,
      logLevel,
      providerKey,
      status: params.log.status,
      storeOrUser: params.log.storeOrUser,
      templateKey: params.log.templateKey,
      type: params.log.type
    }),
    notificationReference,
    providerKey,
    providerLabel,
    safeMessage: buildSafeLogMessage({
      channel: params.log.channel,
      errorSummary: params.log.errorSummary,
      logLevel,
      statusLabel,
      typeLabel: text(params.log.typeLabel, 80) || text(params.log.type, 80) || "Notification"
    }),
    status: params.log.status,
    statusLabel
  };
}

export function buildNotificationLogFallbackRecordSafe(): NotificationLogRecord {
  return {
    channel: "in_app",
    channelLabel: getNotificationChannelLabel("in_app"),
    createdAt: null,
    deliveryReference: NOTIFICATION_LOG_FALLBACK_ID,
    eventReference: NOTIFICATION_LOG_FALLBACK_ID,
    logId: NOTIFICATION_LOG_FALLBACK_ID,
    logLevel: "info",
    logLevelLabel: getNotificationLogLevelLabel("info"),
    metadataSummary: sanitizeNotificationLogMetadataSafe({
      channel: "in_app",
      logLevel: "info",
      providerKey: "internal_in_app",
      status: "draft"
    }),
    notificationReference: NOTIFICATION_LOG_FALLBACK_ID,
    providerKey: "internal_in_app",
    providerLabel: getNotificationProviderLabel("internal_in_app"),
    safeMessage:
      "Notification log foundation placeholder only. No log creation, export, or write connected.",
    status: "draft",
    statusLabel: getNotificationStatusLabel("draft")
  };
}

export function buildNotificationLogRecordsSafe(params: {
  deliveries?: NotificationDeliveryRecord[] | null;
  eventItems?: NotificationEventRecord[] | null;
  logs?: NotificationLogSourceInput[] | null;
}): { logItems: NotificationLogRecord[]; warning: string | null } {
  try {
    const logs = Array.isArray(params.logs) ? params.logs : [];
    const deliveries = Array.isArray(params.deliveries) ? params.deliveries : [];
    const eventItems = Array.isArray(params.eventItems) ? params.eventItems : [];

    if (!logs.length) {
      return {
        logItems: [buildNotificationLogFallbackRecordSafe()],
        warning: null
      };
    }

    const logItems = logs
      .map((log) =>
        buildLogRecordFromSource({
          deliveries,
          eventItems,
          log
        })
      )
      .sort((left, right) => dateValue(right.createdAt ?? "") - dateValue(left.createdAt ?? ""));

    return {
      logItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-log-runtime] log records build failed", error);

    return {
      logItems: [buildNotificationLogFallbackRecordSafe()],
      warning: "Notification log runtime fallback applied."
    };
  }
}

export function buildNotificationLogRuntimeStatsSafe(
  logItems: NotificationLogRecord[] | null | undefined
): NotificationLogRuntimeStats {
  try {
    const items = Array.isArray(logItems) ? logItems : [];

    return {
      debugHiddenLogs: items.filter((item) => item.logLevel === "debug_hidden").length,
      errorLogs: items.filter((item) => item.logLevel === "error").length,
      infoLogs: items.filter((item) => item.logLevel === "info").length,
      totalLogs: items.length,
      unknownLogs: items.filter((item) => item.logId === NOTIFICATION_LOG_FALLBACK_ID).length,
      warningLogs: items.filter((item) => item.logLevel === "warning").length
    };
  } catch (error) {
    console.error("[notification-log-runtime] log runtime stats build failed", error);

    return {
      debugHiddenLogs: 0,
      errorLogs: 0,
      infoLogs: 0,
      totalLogs: 0,
      unknownLogs: 0,
      warningLogs: 0
    };
  }
}

export function listNotificationLogLevelCatalog() {
  return NOTIFICATION_LOG_LEVELS.map((level) => ({
    description:
      level === "debug_hidden"
        ? "Debug log level with hidden production details."
        : `Read-only ${logLevelLabels[level].toLowerCase()} notification log level.`,
    label: logLevelLabels[level],
    level
  }));
}

export function sanitizeNotificationLogMessageSafe(value: unknown, maxLength = 240) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  if (!cleaned) {
    return "No safe log message recorded.";
  }

  if (cleaned.toLowerCase().includes("stack trace") || cleaned.toLowerCase().includes("at object.")) {
    return "Debug log details hidden in production.";
  }

  return cleaned;
}

// NT-21+ placeholders: log export, retention, and streaming stay disconnected.
export const NOTIFICATION_LOG_FUTURE_HOOKS = [
  "notification_log_export",
  "notification_log_retention",
  "notification_log_streaming"
] as const;
