import "server-only";

import {
  getNotificationChannelLabel,
  listNotificationChannelCatalog,
  type NotificationChannel,
  type NotificationChannelHealthStatus,
  type NotificationChannelView
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  sanitizeNotificationDeliveryErrorSummary
} from "@/src/lib/notifications/notification-delivery-runtime";
import {
  getNotificationProviderLabel,
  mapNotificationChannelToProvider,
  type NotificationProviderKey,
  type NotificationProviderView
} from "@/src/lib/notifications/notification-provider-runtime";

export type NotificationMonitorStatus =
  | "degraded"
  | "failed"
  | "healthy"
  | "missing_config"
  | "placeholder"
  | "unknown"
  | "warning";

export type NotificationMonitoringRecord = {
  channel: NotificationChannel;
  channelLabel: string;
  checkedAt: string | null;
  createdAt: string | null;
  failureCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  latencyMs: number | null;
  metadataSummary: string;
  monitorId: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  safeSummary: string;
  status: NotificationMonitorStatus;
  statusLabel: string;
  updatedAt: string | null;
};

export type NotificationMonitoringRuntimeStats = {
  degradedMonitors: number;
  failedMonitors: number;
  healthyMonitors: number;
  missingConfigMonitors: number;
  placeholderMonitors: number;
  totalFailureSignals: number;
  totalMonitors: number;
  unknownMonitors: number;
  warningMonitors: number;
};

export const NOTIFICATION_MONITOR_STATUSES: readonly NotificationMonitorStatus[] = [
  "healthy",
  "warning",
  "degraded",
  "failed",
  "missing_config",
  "placeholder",
  "unknown"
] as const;

const statusLabels: Record<NotificationMonitorStatus, string> = {
  degraded: "Degraded",
  failed: "Failed",
  healthy: "Healthy",
  missing_config: "Missing config",
  placeholder: "Placeholder",
  unknown: "Unknown",
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

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAdminNotificationAuditEvent(event: Record<string, unknown>) {
  const eventType = text(event.event_type, 160);
  const entityType = text(event.entity_type, 160);
  return eventType.startsWith("admin_notification_") || entityType === "admin_notification_center";
}

export function getNotificationMonitorStatusLabel(status: NotificationMonitorStatus) {
  return statusLabels[status];
}

export function sanitizeNotificationMonitoringMetadata(value: unknown) {
  if (!isRecord(value)) {
    return "No safe metadata recorded.";
  }

  const safeEntries: string[] = [];
  const channel = text(value.channel, 80);
  const source = text(value.source, 80);
  const eventType = text(value.event_type, 80);
  const note = sanitizeNotificationDeliveryErrorSummary(value.note ?? value.summary);

  if (channel) safeEntries.push(`channel=${channel}`);
  if (source) safeEntries.push(`source=${source}`);
  if (eventType) safeEntries.push(`event_type=${eventType}`);
  if (note) safeEntries.push(`note=${note}`);

  return safeEntries.length ? safeEntries.join(" · ") : "No safe metadata recorded.";
}

export function parseNotificationMonitorStatusSafe(params: {
  failureCount: number;
  healthStatus: NotificationChannelHealthStatus;
  placeholderOnly: boolean;
}) {
  if (params.placeholderOnly) {
    return "placeholder" as const;
  }

  if (params.healthStatus === "missing_config") {
    return "missing_config" as const;
  }

  if (params.healthStatus === "warning") {
    return "warning" as const;
  }

  if (params.failureCount > 0 && params.healthStatus === "healthy") {
    return params.failureCount >= 3 ? ("failed" as const) : ("degraded" as const);
  }

  if (params.healthStatus === "healthy") {
    return "healthy" as const;
  }

  if (params.healthStatus === "placeholder") {
    return "placeholder" as const;
  }

  return "unknown" as const;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .map((value) => text(value, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
}

function collectChannelSignals(params: {
  channel: NotificationChannel;
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  notifications?: Array<Record<string, unknown>> | null;
}) {
  const failureTimestamps: string[] = [];
  const successTimestamps: string[] = [];
  let failureCount = 0;

  if (params.channel === "email") {
    for (const log of params.emailLogs ?? []) {
      const status = text(log.status, 80).toLowerCase();
      const timestamp = text(log.updated_at, 80) || text(log.created_at, 80);

      if (status === "failed" || status === "retry_pending") {
        failureCount += 1;
        if (timestamp) failureTimestamps.push(timestamp);
      }

      if (status === "sent") {
        if (timestamp) successTimestamps.push(timestamp);
      }
    }
  }

  if (params.channel === "in_app") {
    for (const notification of params.notifications ?? []) {
      const timestamp = text(notification.created_at, 80);
      if (timestamp) successTimestamps.push(timestamp);
    }
  }

  if (params.channel === "system_alert") {
    for (const event of params.monitoringEvents ?? []) {
      if (isAdminNotificationAuditEvent(event)) continue;

      const status = text(event.event_status, 80).toLowerCase();
      const timestamp = text(event.created_at, 80);
      if (!timestamp) continue;

      if (status === "failed" || status === "warning") {
        failureCount += 1;
        failureTimestamps.push(timestamp);
      }

      if (status === "success" || status === "info") {
        successTimestamps.push(timestamp);
      }
    }
  }

  return {
    failureCount,
    lastFailureAt: latestTimestamp(failureTimestamps),
    lastSuccessAt: latestTimestamp(successTimestamps)
  };
}

function buildMonitorRecord(params: {
  channelSnapshot: NotificationChannelView;
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  notifications?: Array<Record<string, unknown>> | null;
  providerSnapshot?: NotificationProviderView;
}): NotificationMonitoringRecord {
  const channel = params.channelSnapshot.channel;
  const providerKey = params.providerSnapshot?.providerKey ?? mapNotificationChannelToProvider(channel);
  const signals = collectChannelSignals({
    channel,
    emailLogs: params.emailLogs,
    monitoringEvents: params.monitoringEvents,
    notifications: params.notifications
  });
  const status = parseNotificationMonitorStatusSafe({
    failureCount: signals.failureCount,
    healthStatus: params.channelSnapshot.healthStatus,
    placeholderOnly: params.channelSnapshot.placeholderOnly
  });
  const checkedAt = latestTimestamp([signals.lastFailureAt, signals.lastSuccessAt]);
  const safeSummary =
    sanitizeNotificationDeliveryErrorSummary(params.providerSnapshot?.metadataSummary) ||
    sanitizeNotificationDeliveryErrorSummary(params.channelSnapshot.description) ||
    `${getNotificationChannelLabel(channel)} monitoring foundation summary only.`;

  return {
    channel,
    channelLabel: params.channelSnapshot.channelLabel,
    checkedAt,
    createdAt: checkedAt,
    failureCount: signals.failureCount,
    lastFailureAt: signals.lastFailureAt,
    lastSuccessAt: signals.lastSuccessAt,
    latencyMs: null,
    metadataSummary: sanitizeNotificationMonitoringMetadata({
      channel,
      note: params.channelSnapshot.description,
      source: "notification_monitoring_runtime"
    }),
    monitorId: `monitor:${channel}`,
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    safeSummary,
    status,
    statusLabel: getNotificationMonitorStatusLabel(status),
    updatedAt: latestTimestamp([signals.lastFailureAt, signals.lastSuccessAt, checkedAt])
  };
}

export function buildNotificationMonitoringRecordsSafe(params: {
  channelSnapshots?: NotificationChannelView[] | null;
  emailLogs?: Array<Record<string, unknown>> | null;
  monitoringEvents?: Array<Record<string, unknown>> | null;
  notifications?: Array<Record<string, unknown>> | null;
  providerSnapshots?: NotificationProviderView[] | null;
}): { monitoringItems: NotificationMonitoringRecord[]; warning: string | null } {
  try {
    const channelSnapshots =
      Array.isArray(params.channelSnapshots) && params.channelSnapshots.length
        ? params.channelSnapshots
        : listNotificationChannelCatalog().map((entry) => ({
            channel: entry.channel,
            channelLabel: entry.label,
            configuredStatus: entry.placeholderOnly ? ("placeholder" as const) : ("missing" as const),
            description: entry.description,
            healthStatus: entry.placeholderOnly ? ("placeholder" as const) : ("missing_config" as const),
            placeholderOnly: entry.placeholderOnly,
            runtimeState: entry.placeholderOnly ? ("placeholder" as const) : ("missing_config" as const),
            secretStatus: entry.placeholderOnly ? ("no_secret_required" as const) : ("missing" as const)
          }));

    const operationalMonitoringEvents = (params.monitoringEvents ?? []).filter(
      (event) => !isAdminNotificationAuditEvent(event)
    );

    const monitoringItems = channelSnapshots.map((channelSnapshot) =>
      buildMonitorRecord({
        channelSnapshot,
        emailLogs: params.emailLogs,
        monitoringEvents: operationalMonitoringEvents,
        notifications: params.notifications,
        providerSnapshot: (params.providerSnapshots ?? []).find(
          (provider) => mapNotificationChannelToProvider(channelSnapshot.channel) === provider.providerKey
        )
      })
    );

    return {
      monitoringItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-monitoring-runtime] monitoring records build failed", error);

    return {
      monitoringItems: [],
      warning: "Notification monitoring records could not be built safely. Showing empty monitoring state."
    };
  }
}

export function buildNotificationMonitoringRuntimeStatsSafe(
  monitoringItems: NotificationMonitoringRecord[] | null | undefined
): NotificationMonitoringRuntimeStats {
  try {
    const snapshots = Array.isArray(monitoringItems) ? monitoringItems : [];

    return {
      degradedMonitors: snapshots.filter((record) => record.status === "degraded").length,
      failedMonitors: snapshots.filter((record) => record.status === "failed").length,
      healthyMonitors: snapshots.filter((record) => record.status === "healthy").length,
      missingConfigMonitors: snapshots.filter((record) => record.status === "missing_config").length,
      placeholderMonitors: snapshots.filter((record) => record.status === "placeholder").length,
      totalFailureSignals: snapshots.reduce((total, record) => total + record.failureCount, 0),
      totalMonitors: snapshots.length,
      unknownMonitors: snapshots.filter((record) => record.status === "unknown").length,
      warningMonitors: snapshots.filter((record) => record.status === "warning").length
    };
  } catch (error) {
    console.error("[notification-monitoring-runtime] monitoring stats build failed", error);

    return {
      degradedMonitors: 0,
      failedMonitors: 0,
      healthyMonitors: 0,
      missingConfigMonitors: 0,
      placeholderMonitors: 0,
      totalFailureSignals: 0,
      totalMonitors: 0,
      unknownMonitors: 0,
      warningMonitors: 0
    };
  }
}

export function listNotificationMonitorStatusCatalog() {
  return NOTIFICATION_MONITOR_STATUSES.map((status) => ({
    label: getNotificationMonitorStatusLabel(status),
    status
  }));
}

// NT-14+ placeholders: live health checks, provider probes, and alerting stay disconnected.
export const NOTIFICATION_MONITORING_FUTURE_HOOKS = [
  "notification_monitoring_health_check",
  "notification_monitoring_provider_probe",
  "notification_monitoring_alerting"
] as const;
