import "server-only";

import type { NotificationCategory } from "@/src/lib/notifications/notification-category-runtime";
import {
  getNotificationCategoryLabel,
  listNotificationCategoryCatalog
} from "@/src/lib/notifications/notification-category-runtime";
import type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
import {
  getNotificationChannelLabel,
  listNotificationChannelCatalog
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  getNotificationProviderLabel,
  listNotificationProviderCatalog,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import type { NotificationDeliveryStatus } from "@/src/lib/notifications/notification-status-runtime";
import {
  getNotificationStatusLabel,
  listNotificationDeliveryStatusCatalog,
  type NotificationDeliveryStatusStats
} from "@/src/lib/notifications/notification-status-runtime";
import type { NotificationType } from "@/src/lib/notifications/notification-type-runtime";
import {
  getNotificationTypeLabel,
  listNotificationTypeCatalog
} from "@/src/lib/notifications/notification-type-runtime";

export type NotificationAnalyticsDimension =
  | "category"
  | "channel"
  | "provider"
  | "status"
  | "type";

export type NotificationAnalyticsPeriodKey = "daily" | "monthly" | "weekly";

export type NotificationAnalyticsLogInput = {
  category: NotificationCategory;
  categoryLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
  typeKey: NotificationType;
  typeLabel: string;
};

export type NotificationAnalyticsSnapshot = {
  analyticsDescription: string;
  analyticsReady: boolean;
  dailyCount: number;
  deliverySuccessRate: number;
  failureRate: number;
  monthlyCount: number;
  queuedVolume: number;
  readRate: number;
  retryRate: number;
  totalAnalyzed: number;
  weeklyCount: number;
};

export type NotificationAnalyticsBreakdownItem = {
  count: number;
  description: string;
  dimension: NotificationAnalyticsDimension;
  key: string;
  label: string;
  sharePercent: number;
};

export type NotificationAnalyticsRateView = {
  description: string;
  key: string;
  label: string;
  ratePercent: number;
  valueLabel: string;
};

export type NotificationAnalyticsPeriodView = {
  count: number;
  description: string;
  key: NotificationAnalyticsPeriodKey;
  label: string;
};

export type NotificationAnalyticsRuntimeStats = {
  dailyAnalyticsItems: number;
  failureRateAnalyticsItems: number;
  monthlyAnalyticsItems: number;
  queuedVolumeAnalyticsItems: number;
  readRateAnalyticsItems: number;
  retryRateAnalyticsItems: number;
  successRateAnalyticsItems: number;
  totalAnalyticsItems: number;
  weeklyAnalyticsItems: number;
};

export const NOTIFICATION_ANALYTICS_DEFAULT: NotificationAnalyticsSnapshot = {
  analyticsDescription: "Notification analytics foundation only. No external analytics integration connected.",
  analyticsReady: true,
  dailyCount: 0,
  deliverySuccessRate: 0,
  failureRate: 0,
  monthlyCount: 0,
  queuedVolume: 0,
  readRate: 0,
  retryRate: 0,
  totalAnalyzed: 0,
  weeklyCount: 0
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const periodDefinitions: Array<{
  description: string;
  key: NotificationAnalyticsPeriodKey;
  label: string;
  windowMs: number;
}> = [
  {
    description: "Notification log entries created within the last 24 hours from read-only page load.",
    key: "daily",
    label: "Daily (24h)",
    windowMs: MS_PER_DAY
  },
  {
    description: "Notification log entries created within the last 7 days from read-only page load.",
    key: "weekly",
    label: "Weekly (7d)",
    windowMs: 7 * MS_PER_DAY
  },
  {
    description: "Notification log entries created within the last 30 days from read-only page load.",
    key: "monthly",
    label: "Monthly (30d)",
    windowMs: 30 * MS_PER_DAY
  }
];

const rateDefinitions: Array<{
  description: string;
  key: keyof Pick<
    NotificationAnalyticsSnapshot,
    "deliverySuccessRate" | "failureRate" | "queuedVolume" | "readRate" | "retryRate"
  >;
  label: string;
}> = [
  {
    description: "Share of analyzed logs with sent, delivered, or read status.",
    key: "deliverySuccessRate",
    label: "Delivery success rate"
  },
  {
    description: "Share of analyzed logs with failed delivery status.",
    key: "failureRate",
    label: "Failure rate"
  },
  {
    description: "Share of analyzed logs with retry delivery status.",
    key: "retryRate",
    label: "Retry rate"
  },
  {
    description: "Share of analyzed logs with read delivery status.",
    key: "readRate",
    label: "Read rate"
  },
  {
    description: "Count of queued delivery status entries in analyzed logs.",
    key: "queuedVolume",
    label: "Queued volume"
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

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  const rate = (numerator / denominator) * 100;
  if (!Number.isFinite(rate) || rate < 0) {
    return 0;
  }

  return Math.round(rate * 10) / 10;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countLogsInWindow(logs: NotificationAnalyticsLogInput[], windowMs: number, referenceMs: number) {
  const cutoff = referenceMs - windowMs;

  return logs.filter((log) => {
    const createdAt = dateValue(log.createdAt);
    return createdAt > 0 && createdAt >= cutoff && createdAt <= referenceMs;
  }).length;
}

function countByKey<T extends string>(items: T[]) {
  const counts = new Map<T, number>();

  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  return counts;
}

function buildBreakdownItems(params: {
  counts: Map<string, number>;
  defaultDescription: string;
  dimension: NotificationAnalyticsDimension;
  labelByKey: Map<string, string>;
  total: number;
}): NotificationAnalyticsBreakdownItem[] {
  const entries = [...params.counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  if (!entries.length) {
    return [
      {
        count: 0,
        description: params.defaultDescription,
        dimension: params.dimension,
        key: "none",
        label: "No data",
        sharePercent: 0
      }
    ];
  }

  return entries.map(([key, count]) => ({
    count,
    description: params.defaultDescription,
    dimension: params.dimension,
    key,
    label: params.labelByKey.get(key) ?? key,
    sharePercent: safeRate(count, params.total)
  }));
}

function buildTypeBreakdown(logs: NotificationAnalyticsLogInput[], total: number) {
  const labelByKey = new Map(listNotificationTypeCatalog().map((entry) => [entry.type, entry.label]));
  const counts = countByKey(logs.map((log) => log.typeKey));

  return buildBreakdownItems({
    counts,
    defaultDescription: "Aggregated notification log count by notification type.",
    dimension: "type",
    labelByKey,
    total
  });
}

function buildStatusBreakdown(logs: NotificationAnalyticsLogInput[], total: number) {
  const labelByKey = new Map(
    listNotificationDeliveryStatusCatalog().map((entry) => [entry.status, entry.label])
  );
  const counts = countByKey(logs.map((log) => log.status));

  return buildBreakdownItems({
    counts,
    defaultDescription: "Aggregated notification log count by delivery status.",
    dimension: "status",
    labelByKey,
    total
  });
}

function buildChannelBreakdown(logs: NotificationAnalyticsLogInput[], total: number) {
  const labelByKey = new Map(listNotificationChannelCatalog().map((entry) => [entry.channel, entry.label]));
  const counts = countByKey(logs.map((log) => log.channel));

  return buildBreakdownItems({
    counts,
    defaultDescription: "Aggregated notification log count by delivery channel.",
    dimension: "channel",
    labelByKey,
    total
  });
}

function buildCategoryBreakdown(logs: NotificationAnalyticsLogInput[], total: number) {
  const labelByKey = new Map(listNotificationCategoryCatalog().map((entry) => [entry.category, entry.label]));
  const counts = countByKey(logs.map((log) => log.category));

  return buildBreakdownItems({
    counts,
    defaultDescription: "Aggregated notification log count by notification category.",
    dimension: "category",
    labelByKey,
    total
  });
}

function buildProviderBreakdown(logs: NotificationAnalyticsLogInput[], total: number) {
  const labelByKey = new Map(
    listNotificationProviderCatalog().map((entry) => [entry.providerKey, entry.label])
  );
  const counts = countByKey(logs.map((log) => log.providerKey));

  return buildBreakdownItems({
    counts,
    defaultDescription: "Aggregated notification log count by provider reference key only.",
    dimension: "provider",
    labelByKey,
    total
  });
}

export function buildNotificationAnalyticsSnapshotSafe(params: {
  deliveryStatusStats?: NotificationDeliveryStatusStats | null;
  logs?: NotificationAnalyticsLogInput[] | null;
  referenceMs?: number | null;
}): NotificationAnalyticsSnapshot {
  try {
    const logs = Array.isArray(params.logs) ? params.logs : [];
    const delivery = params.deliveryStatusStats;
    const referenceMs = safeCount(params.referenceMs) || Date.now();
    const totalAnalyzed = safeCount(logs.length || delivery?.totalItems);
    const sentLike =
      safeCount(delivery?.sentItems) +
      safeCount(delivery?.deliveredItems) +
      safeCount(delivery?.readItems);
    const failedCount = safeCount(delivery?.failedItems);
    const retryCount = safeCount(delivery?.retryItems);
    const readCount = safeCount(delivery?.readItems);
    const queuedVolume = safeCount(delivery?.queuedItems);

    const dailyCount = countLogsInWindow(logs, MS_PER_DAY, referenceMs);
    const weeklyCount = countLogsInWindow(logs, 7 * MS_PER_DAY, referenceMs);
    const monthlyCount = countLogsInWindow(logs, 30 * MS_PER_DAY, referenceMs);

    return {
      analyticsDescription:
        totalAnalyzed > 0
          ? `Read-only notification analytics from ${totalAnalyzed} safe log entries. No external analytics, export, or backfill connected.`
          : "Notification analytics foundation only. No notification log entries available for summary.",
      analyticsReady: true,
      dailyCount,
      deliverySuccessRate: safeRate(sentLike, totalAnalyzed),
      failureRate: safeRate(failedCount, totalAnalyzed),
      monthlyCount,
      queuedVolume,
      readRate: safeRate(readCount, totalAnalyzed),
      retryRate: safeRate(retryCount, totalAnalyzed),
      totalAnalyzed,
      weeklyCount
    };
  } catch (error) {
    console.error("[notification-analytics-runtime] analytics snapshot build failed", error);
    return { ...NOTIFICATION_ANALYTICS_DEFAULT };
  }
}

export function buildNotificationAnalyticsBreakdownViewsSafe(
  logs: NotificationAnalyticsLogInput[] | null | undefined
): NotificationAnalyticsBreakdownItem[] {
  try {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const total = safeLogs.length;

    if (!total) {
      return [
        {
          count: 0,
          description: "No notification logs available for analytics breakdown.",
          dimension: "type",
          key: "none",
          label: "No data",
          sharePercent: 0
        }
      ];
    }

    return [
      ...buildTypeBreakdown(safeLogs, total),
      ...buildStatusBreakdown(safeLogs, total),
      ...buildChannelBreakdown(safeLogs, total),
      ...buildCategoryBreakdown(safeLogs, total),
      ...buildProviderBreakdown(safeLogs, total)
    ];
  } catch (error) {
    console.error("[notification-analytics-runtime] analytics breakdown build failed", error);

    return [
      {
        count: 0,
        description: "Notification analytics breakdown could not be resolved safely.",
        dimension: "type",
        key: "none",
        label: "No data",
        sharePercent: 0
      }
    ];
  }
}

export function buildNotificationAnalyticsRateViewsSafe(
  snapshot: NotificationAnalyticsSnapshot | null | undefined
): NotificationAnalyticsRateView[] {
  try {
    const analytics = snapshot ?? NOTIFICATION_ANALYTICS_DEFAULT;

    return rateDefinitions.map((definition) => {
      const rawValue = analytics[definition.key];

      return {
        description: definition.description,
        key: definition.key,
        label: definition.label,
        ratePercent: definition.key === "queuedVolume" ? 0 : safeCount(rawValue),
        valueLabel:
          definition.key === "queuedVolume"
            ? String(safeCount(rawValue))
            : `${safeCount(rawValue).toFixed(1)}%`
      };
    });
  } catch (error) {
    console.error("[notification-analytics-runtime] analytics rate views build failed", error);

    return rateDefinitions.map((definition) => ({
      description: definition.description,
      key: definition.key,
      label: definition.label,
      ratePercent: 0,
      valueLabel: definition.key === "queuedVolume" ? "0" : "0.0%"
    }));
  }
}

export function buildNotificationAnalyticsPeriodViewsSafe(params: {
  logs?: NotificationAnalyticsLogInput[] | null;
  referenceMs?: number | null;
}): NotificationAnalyticsPeriodView[] {
  try {
    const logs = Array.isArray(params.logs) ? params.logs : [];
    const referenceMs = safeCount(params.referenceMs) || Date.now();

    return periodDefinitions.map((definition) => ({
      count: countLogsInWindow(logs, definition.windowMs, referenceMs),
      description: definition.description,
      key: definition.key,
      label: definition.label
    }));
  } catch (error) {
    console.error("[notification-analytics-runtime] analytics period views build failed", error);

    return periodDefinitions.map((definition) => ({
      count: 0,
      description: definition.description,
      key: definition.key,
      label: definition.label
    }));
  }
}

export function buildNotificationAnalyticsRuntimeStatsSafe(
  snapshot: NotificationAnalyticsSnapshot | null | undefined
): NotificationAnalyticsRuntimeStats {
  try {
    const analytics = snapshot ?? NOTIFICATION_ANALYTICS_DEFAULT;

    return {
      dailyAnalyticsItems: safeCount(analytics.dailyCount),
      failureRateAnalyticsItems: safeCount(analytics.failureRate),
      monthlyAnalyticsItems: safeCount(analytics.monthlyCount),
      queuedVolumeAnalyticsItems: safeCount(analytics.queuedVolume),
      readRateAnalyticsItems: safeCount(analytics.readRate),
      retryRateAnalyticsItems: safeCount(analytics.retryRate),
      successRateAnalyticsItems: safeCount(analytics.deliverySuccessRate),
      totalAnalyticsItems: safeCount(analytics.totalAnalyzed),
      weeklyAnalyticsItems: safeCount(analytics.weeklyCount)
    };
  } catch (error) {
    console.error("[notification-analytics-runtime] analytics runtime stats build failed", error);

    return {
      dailyAnalyticsItems: 0,
      failureRateAnalyticsItems: 0,
      monthlyAnalyticsItems: 0,
      queuedVolumeAnalyticsItems: 0,
      readRateAnalyticsItems: 0,
      retryRateAnalyticsItems: 0,
      successRateAnalyticsItems: 0,
      totalAnalyticsItems: 0,
      weeklyAnalyticsItems: 0
    };
  }
}

export function listNotificationAnalyticsDimensionCatalog() {
  return [
    { description: "Notification type analytics dimension.", dimension: "type" as const, label: "Type" },
    { description: "Delivery status analytics dimension.", dimension: "status" as const, label: "Status" },
    { description: "Delivery channel analytics dimension.", dimension: "channel" as const, label: "Channel" },
    { description: "Notification category analytics dimension.", dimension: "category" as const, label: "Category" },
    {
      description: "Provider reference analytics dimension without exposing secrets.",
      dimension: "provider" as const,
      label: "Provider reference"
    }
  ];
}

export function getNotificationAnalyticsDimensionLabel(dimension: NotificationAnalyticsDimension) {
  return listNotificationAnalyticsDimensionCatalog().find((entry) => entry.dimension === dimension)?.label ?? dimension;
}

export function resolveNotificationAnalyticsLogInput(log: {
  category: NotificationCategory;
  categoryLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
  typeKey: NotificationType;
  typeLabel: string;
}): NotificationAnalyticsLogInput {
  return {
    category: log.category,
    categoryLabel: text(log.categoryLabel) || getNotificationCategoryLabel(log.category),
    channel: log.channel,
    channelLabel: text(log.channelLabel) || getNotificationChannelLabel(log.channel),
    createdAt: text(log.createdAt, 80),
    providerKey: log.providerKey,
    providerLabel: text(log.providerLabel) || getNotificationProviderLabel(log.providerKey),
    status: log.status,
    statusLabel: text(log.statusLabel) || getNotificationStatusLabel(log.status),
    typeKey: log.typeKey,
    typeLabel: text(log.typeLabel) || getNotificationTypeLabel(log.typeKey)
  };
}

// NT-16+ placeholders: analytics export, dashboards, and alerting stay disconnected.
export const NOTIFICATION_ANALYTICS_FUTURE_HOOKS = [
  "notification_analytics_export",
  "notification_analytics_dashboard",
  "notification_analytics_alerting"
] as const;
