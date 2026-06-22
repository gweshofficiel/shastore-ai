import "server-only";

import type { NotificationChannelStats } from "@/src/lib/notifications/notification-channel-runtime";
import type { NotificationDeliveryStatusStats } from "@/src/lib/notifications/notification-status-runtime";

export type NotificationMetricsSnapshot = {
  emailCount: number;
  failedCount: number;
  inAppCount: number;
  pushPlaceholderCount: number;
  queuedCount: number;
  readCount: number;
  retryCount: number;
  reviewedFailuresCount: number;
  sentCount: number;
  smsCount: number;
  totalNotifications: number;
  unreadCount: number;
  whatsappCount: number;
};

export type NotificationMetricView = {
  description: string;
  key: keyof NotificationMetricsSnapshot;
  label: string;
  value: number;
};

export const NOTIFICATION_METRICS_DEFAULT: NotificationMetricsSnapshot = {
  emailCount: 0,
  failedCount: 0,
  inAppCount: 0,
  pushPlaceholderCount: 0,
  queuedCount: 0,
  readCount: 0,
  retryCount: 0,
  reviewedFailuresCount: 0,
  sentCount: 0,
  smsCount: 0,
  totalNotifications: 0,
  unreadCount: 0,
  whatsappCount: 0
};

const metricDefinitions: Array<{
  description: string;
  key: keyof NotificationMetricsSnapshot;
  label: string;
}> = [
  {
    description: "Total notification log entries visible in read-only Super Admin runtime.",
    key: "totalNotifications",
    label: "Total notifications"
  },
  {
    description: "Sent delivery status count from read-only notification logs.",
    key: "sentCount",
    label: "Sent count"
  },
  {
    description: "Read delivery status count from read-only notification logs.",
    key: "readCount",
    label: "Read count"
  },
  {
    description: "Failed delivery status count from read-only notification logs.",
    key: "failedCount",
    label: "Failed count"
  },
  {
    description: "Queued delivery status count from read-only notification logs.",
    key: "queuedCount",
    label: "Queued count"
  },
  {
    description: "Retry delivery status count from read-only notification logs.",
    key: "retryCount",
    label: "Retry count"
  },
  {
    description: "Unread in-app notification count from read-only foundation data.",
    key: "unreadCount",
    label: "Unread count"
  },
  {
    description: "Reviewed failure governance events recorded in monitoring events.",
    key: "reviewedFailuresCount",
    label: "Reviewed failures count"
  },
  {
    description: "SMS channel placeholder log count. No SMS delivery connected.",
    key: "smsCount",
    label: "SMS count"
  },
  {
    description: "WhatsApp channel placeholder log count. No WhatsApp delivery connected.",
    key: "whatsappCount",
    label: "WhatsApp count"
  },
  {
    description: "Email channel notification log count from read-only email event logs.",
    key: "emailCount",
    label: "Email count"
  },
  {
    description: "In-app notification log count from read-only notifications table.",
    key: "inAppCount",
    label: "In-app count"
  },
  {
    description: "Push channel placeholder log count. No push delivery connected.",
    key: "pushPlaceholderCount",
    label: "Push placeholder count"
  }
];

function text(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function countUnreadNotifications(notifications?: Array<Record<string, unknown>> | null) {
  return (notifications ?? []).filter((notification) => {
    const status = text(notification.status, 80).toLowerCase();
    const readAt = text(notification.read_at, 80);
    return status === "unread" || (!readAt && status !== "read");
  }).length;
}

export function buildNotificationMetricsSnapshotSafe(params: {
  channelStats?: NotificationChannelStats | null;
  deliveryStatusStats?: NotificationDeliveryStatusStats | null;
  logCount?: number | null;
  notifications?: Array<Record<string, unknown>> | null;
  reviewedFailuresCount?: number | null;
}): NotificationMetricsSnapshot {
  try {
    const delivery = params.deliveryStatusStats;
    const channels = params.channelStats;

    return {
      emailCount: safeCount(channels?.emailItems),
      failedCount: safeCount(delivery?.failedItems),
      inAppCount: safeCount(channels?.inAppItems),
      pushPlaceholderCount: safeCount(channels?.pushItems),
      queuedCount: safeCount(delivery?.queuedItems),
      readCount: safeCount(delivery?.readItems),
      retryCount: safeCount(delivery?.retryItems),
      reviewedFailuresCount: safeCount(params.reviewedFailuresCount),
      sentCount: safeCount(delivery?.sentItems),
      smsCount: safeCount(channels?.smsItems),
      totalNotifications: safeCount(params.logCount ?? delivery?.totalItems),
      unreadCount: countUnreadNotifications(params.notifications),
      whatsappCount: safeCount(channels?.whatsappItems)
    };
  } catch (error) {
    console.error("[notification-metrics-runtime] metrics snapshot build failed", error);
    return { ...NOTIFICATION_METRICS_DEFAULT };
  }
}

export function buildNotificationMetricViewsSafe(
  snapshot: NotificationMetricsSnapshot | null | undefined
): NotificationMetricView[] {
  try {
    const metrics = snapshot ?? NOTIFICATION_METRICS_DEFAULT;

    return metricDefinitions.map((definition) => ({
      description: definition.description,
      key: definition.key,
      label: definition.label,
      value: safeCount(metrics[definition.key])
    }));
  } catch (error) {
    console.error("[notification-metrics-runtime] metric views build failed", error);

    return metricDefinitions.map((definition) => ({
      description: definition.description,
      key: definition.key,
      label: definition.label,
      value: 0
    }));
  }
}

export function listNotificationMetricCatalog() {
  return metricDefinitions.map((definition) => ({
    description: definition.description,
    key: definition.key,
    label: definition.label
  }));
}

// NT-15+ placeholders: metrics export, timeseries, and alerting stay disconnected.
export const NOTIFICATION_METRICS_FUTURE_HOOKS = [
  "notification_metrics_export",
  "notification_metrics_timeseries",
  "notification_metrics_alerting"
] as const;
