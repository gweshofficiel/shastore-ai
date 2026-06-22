import "server-only";

import type { NotificationDeliveryRecord } from "@/src/lib/notifications/notification-delivery-runtime";
import { sanitizeNotificationDeliveryErrorSummary } from "@/src/lib/notifications/notification-delivery-runtime";
import type { NotificationFailureRecord } from "@/src/lib/notifications/notification-failure-runtime";
import type { NotificationFailureRuntimeStats } from "@/src/lib/notifications/notification-failure-runtime";
import type {
  NotificationMonitoringRecord,
  NotificationMonitorStatus
} from "@/src/lib/notifications/notification-monitoring-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import type { NotificationProviderKey } from "@/src/lib/notifications/notification-provider-runtime";
import type { NotificationQueueRecord } from "@/src/lib/notifications/notification-queue-runtime";
import type { NotificationQueueRuntimeStats } from "@/src/lib/notifications/notification-queue-runtime";
import type { NotificationRetryRecord } from "@/src/lib/notifications/notification-retry-runtime";
import type { NotificationRetryRuntimeStats } from "@/src/lib/notifications/notification-retry-runtime";

export type NotificationHealthStatus = "degraded" | "healthy" | "unknown";

export type NotificationHealthDomain =
  | "channel"
  | "failure"
  | "platform"
  | "provider"
  | "queue"
  | "retry";

export type NotificationHealthRecord = {
  degraded: boolean;
  domain: NotificationHealthDomain;
  healthId: string;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  metadataSummary: string;
  referenceKey: string;
  referenceLabel: string;
  safeSummary: string;
  status: NotificationHealthStatus;
  statusLabel: string;
  updatedAt: string | null;
};

export type NotificationHealthSnapshot = {
  degraded: boolean;
  degradedCount: number;
  healthDescription: string;
  healthReady: boolean;
  healthyCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  overallStatus: NotificationHealthStatus;
  overallStatusLabel: string;
  safeSummary: string;
  unknownCount: number;
};

export type NotificationHealthRuntimeStats = {
  channelHealthItems: number;
  degradedHealthItems: number;
  failureHealthItems: number;
  healthyHealthItems: number;
  platformHealthItems: number;
  providerHealthItems: number;
  queueHealthItems: number;
  retryHealthItems: number;
  totalHealthItems: number;
  unknownHealthItems: number;
};

export const NOTIFICATION_HEALTH_DEFAULT: NotificationHealthSnapshot = {
  degraded: false,
  degradedCount: 0,
  healthDescription: "Notification health foundation only. No live health checks connected.",
  healthReady: true,
  healthyCount: 0,
  lastFailureAt: null,
  lastSuccessAt: null,
  overallStatus: "unknown",
  overallStatusLabel: "Unknown",
  safeSummary: "Notification health visibility could not be resolved from read-only runtime data.",
  unknownCount: 0
};

const statusLabels: Record<NotificationHealthStatus, string> = {
  degraded: "Degraded",
  healthy: "Healthy",
  unknown: "Unknown"
};

const domainLabels: Record<NotificationHealthDomain, string> = {
  channel: "Channel health",
  failure: "Failure health",
  platform: "Platform health",
  provider: "Provider reference health",
  queue: "Queue health",
  retry: "Retry health"
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

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .map((value) => text(value, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
}

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function getNotificationHealthStatusLabel(status: NotificationHealthStatus) {
  return statusLabels[status];
}

export function getNotificationHealthDomainLabel(domain: NotificationHealthDomain) {
  return domainLabels[domain];
}

export function sanitizeNotificationHealthMetadata(value: unknown) {
  return sanitizeNotificationMonitoringMetadata(value);
}

export function mapMonitorStatusToHealthStatus(status: NotificationMonitorStatus): NotificationHealthStatus {
  if (status === "healthy" || status === "placeholder") {
    return "healthy";
  }

  if (["warning", "degraded", "failed", "missing_config"].includes(status)) {
    return "degraded";
  }

  return "unknown";
}

export function mapProviderHealthToHealthStatus(params: {
  healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
  placeholderOnly: boolean;
}): NotificationHealthStatus {
  if (params.placeholderOnly || params.healthStatus === "placeholder") {
    return "healthy";
  }

  if (params.healthStatus === "healthy") {
    return "healthy";
  }

  if (params.healthStatus === "warning" || params.healthStatus === "missing_config") {
    return "degraded";
  }

  return "unknown";
}

function resolveOverallHealthStatus(statuses: NotificationHealthStatus[]): NotificationHealthStatus {
  if (!statuses.length) {
    return "unknown";
  }

  if (statuses.some((status) => status === "degraded")) {
    return "degraded";
  }

  if (statuses.some((status) => status === "unknown")) {
    return "unknown";
  }

  return "healthy";
}

function buildHealthRecord(params: {
  degraded: boolean;
  domain: NotificationHealthDomain;
  healthId: string;
  lastFailureAt?: string | null;
  lastSuccessAt?: string | null;
  metadataSummary: string;
  referenceKey: string;
  referenceLabel: string;
  safeSummary: string;
  status: NotificationHealthStatus;
  updatedAt?: string | null;
}): NotificationHealthRecord {
  const lastFailureAt = params.lastFailureAt ?? null;
  const lastSuccessAt = params.lastSuccessAt ?? null;

  return {
    degraded: params.degraded,
    domain: params.domain,
    healthId: params.healthId,
    lastFailureAt,
    lastSuccessAt,
    metadataSummary: params.metadataSummary,
    referenceKey: params.referenceKey,
    referenceLabel: params.referenceLabel,
    safeSummary: params.safeSummary,
    status: params.status,
    statusLabel: getNotificationHealthStatusLabel(params.status),
    updatedAt: latestTimestamp([params.updatedAt, lastFailureAt, lastSuccessAt])
  };
}

function buildChannelHealthRecords(
  monitoringItems: NotificationMonitoringRecord[]
): NotificationHealthRecord[] {
  if (!monitoringItems.length) {
    return [
      buildHealthRecord({
        degraded: false,
        domain: "channel",
        healthId: "health:channel:none",
        metadataSummary: sanitizeNotificationHealthMetadata({ source: "notification_health_runtime" }),
        referenceKey: "none",
        referenceLabel: "No channel health data",
        safeSummary: "No channel health records available from read-only monitoring foundation.",
        status: "unknown"
      })
    ];
  }

  return monitoringItems.map((monitor) => {
    const status = mapMonitorStatusToHealthStatus(monitor.status);

    return buildHealthRecord({
      degraded: status === "degraded",
      domain: "channel",
      healthId: `health:channel:${monitor.channel}`,
      lastFailureAt: monitor.lastFailureAt,
      lastSuccessAt: monitor.lastSuccessAt,
      metadataSummary: monitor.metadataSummary,
      referenceKey: monitor.channel,
      referenceLabel: monitor.channelLabel,
      safeSummary:
        monitor.safeSummary ||
        `${monitor.channelLabel} channel health from read-only monitoring signals. No live checks connected.`,
      status,
      updatedAt: monitor.updatedAt
    });
  });
}

function buildProviderHealthRecords(params: {
  monitoringItems: NotificationMonitoringRecord[];
  providerStatus: Array<{
    description: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    metadataSummary: string;
    placeholderOnly: boolean;
    providerKey: NotificationProviderKey;
    providerLabel: string;
  }>;
}): NotificationHealthRecord[] {
  if (!params.providerStatus.length) {
    return [
      buildHealthRecord({
        degraded: false,
        domain: "provider",
        healthId: "health:provider:none",
        metadataSummary: sanitizeNotificationHealthMetadata({ source: "notification_health_runtime" }),
        referenceKey: "none",
        referenceLabel: "No provider health data",
        safeSummary: "No provider reference health records available from read-only foundation.",
        status: "unknown"
      })
    ];
  }

  return params.providerStatus.map((provider) => {
    const status = mapProviderHealthToHealthStatus({
      healthStatus: provider.healthStatus,
      placeholderOnly: provider.placeholderOnly
    });
    const monitor = params.monitoringItems.find((item) => item.providerKey === provider.providerKey);

    return buildHealthRecord({
      degraded: status === "degraded",
      domain: "provider",
      healthId: `health:provider:${provider.providerKey}`,
      lastFailureAt: monitor?.lastFailureAt ?? null,
      lastSuccessAt: monitor?.lastSuccessAt ?? null,
      metadataSummary: sanitizeNotificationHealthMetadata({
        health_status: provider.healthStatus,
        note: provider.metadataSummary || provider.description,
        provider_key: provider.providerKey,
        source: "notification_health_runtime"
      }),
      referenceKey: provider.providerKey,
      referenceLabel: provider.providerLabel,
      safeSummary:
        sanitizeNotificationDeliveryErrorSummary(provider.metadataSummary || provider.description) ||
        `${provider.providerLabel} provider reference health from read-only configuration state only.`,
      status,
      updatedAt: monitor?.updatedAt ?? null
    });
  });
}

function buildQueueHealthSummary(params: {
  queueItems: NotificationQueueRecord[];
  queueStats: NotificationQueueRuntimeStats;
}): NotificationHealthRecord {
  const stats = params.queueStats;
  const failedTimestamps = params.queueItems
    .filter((item) => item.status === "failed" || item.status === "retry_pending")
    .map((item) => item.updatedAt ?? item.createdAt);
  const successTimestamps = params.queueItems
    .filter((item) => item.status === "sent")
    .map((item) => item.processedAt ?? item.updatedAt ?? item.createdAt);

  let status: NotificationHealthStatus = "healthy";
  if (safeCount(stats.failedItems) > 0 || safeCount(stats.retryPendingItems) > 0) {
    status = "degraded";
  } else if (safeCount(stats.totalQueueItems) === 0) {
    status = "healthy";
  } else if (safeCount(stats.processingItems) > 0 || safeCount(stats.queuedItems) > 0) {
    status = "healthy";
  }

  return buildHealthRecord({
    degraded: status === "degraded",
    domain: "queue",
    healthId: "health:queue:summary",
    lastFailureAt: latestTimestamp(failedTimestamps),
    lastSuccessAt: latestTimestamp(successTimestamps),
    metadataSummary: sanitizeNotificationHealthMetadata({
      failed_items: stats.failedItems,
      processing_items: stats.processingItems,
      queued_items: stats.queuedItems,
      retry_pending_items: stats.retryPendingItems,
      source: "notification_health_runtime",
      total_queue_items: stats.totalQueueItems
    }),
    referenceKey: "queue_summary",
    referenceLabel: "Queue health summary",
    safeSummary:
      safeCount(stats.totalQueueItems) > 0
        ? `Read-only queue health from ${stats.totalQueueItems} queue entries (${stats.queuedItems} queued, ${stats.failedItems} failed, ${stats.retryPendingItems} retry pending). No queue processing connected.`
        : "Queue health summary shows no active queue entries in read-only runtime.",
    status,
    updatedAt: latestTimestamp([...failedTimestamps, ...successTimestamps])
  });
}

function buildRetryHealthSummary(params: {
  retryItems: NotificationRetryRecord[];
  retryStats: NotificationRetryRuntimeStats;
}): NotificationHealthRecord {
  const stats = params.retryStats;
  const failureTimestamps = params.retryItems
    .filter((item) =>
      ["failed", "retry_blocked", "retry_exhausted"].includes(item.retryStatus)
    )
    .map((item) => item.lastRetryAt ?? item.updatedAt ?? item.createdAt);
  const successTimestamps = params.retryItems
    .filter((item) => item.retryStatus === "retry_ready")
    .map((item) => item.lastRetryAt ?? item.updatedAt ?? item.createdAt);

  let status: NotificationHealthStatus = "healthy";
  if (
    safeCount(stats.retryExhaustedItems) > 0 ||
    safeCount(stats.failedRetryItems) > 0 ||
    safeCount(stats.retryBlockedItems) > 0
  ) {
    status = "degraded";
  } else if (safeCount(stats.retryPendingItems) > 0) {
    status = "degraded";
  } else if (safeCount(stats.totalRetryItems) === 0) {
    status = "healthy";
  }

  return buildHealthRecord({
    degraded: status === "degraded",
    domain: "retry",
    healthId: "health:retry:summary",
    lastFailureAt: latestTimestamp(failureTimestamps),
    lastSuccessAt: latestTimestamp(successTimestamps),
    metadataSummary: sanitizeNotificationHealthMetadata({
      failed_retry_items: stats.failedRetryItems,
      retry_blocked_items: stats.retryBlockedItems,
      retry_exhausted_items: stats.retryExhaustedItems,
      retry_pending_items: stats.retryPendingItems,
      source: "notification_health_runtime",
      total_retry_items: stats.totalRetryItems
    }),
    referenceKey: "retry_summary",
    referenceLabel: "Retry health summary",
    safeSummary:
      safeCount(stats.totalRetryItems) > 0
        ? `Read-only retry health from ${stats.totalRetryItems} retry records (${stats.retryPendingItems} pending, ${stats.retryExhaustedItems} exhausted). No retry execution connected.`
        : "Retry health summary shows no retry records in read-only runtime.",
    status,
    updatedAt: latestTimestamp([...failureTimestamps, ...successTimestamps])
  });
}

function buildFailureHealthSummary(params: {
  failureItems: NotificationFailureRecord[];
  failureStats: NotificationFailureRuntimeStats;
}): NotificationHealthRecord {
  const stats = params.failureStats;
  const failureTimestamps = params.failureItems.map((item) => item.createdAt ?? item.updatedAt);
  const reviewedTimestamps = params.failureItems
    .filter((item) => item.reviewed)
    .map((item) => item.reviewedAt ?? item.updatedAt ?? item.createdAt);

  let status: NotificationHealthStatus = "healthy";
  if (safeCount(stats.unreviewedFailures) > 0 || safeCount(stats.providerErrorFailures) > 0) {
    status = "degraded";
  } else if (safeCount(stats.totalFailures) > 0) {
    status = "healthy";
  } else if (safeCount(stats.totalFailures) === 0) {
    status = "healthy";
  }

  return buildHealthRecord({
    degraded: status === "degraded",
    domain: "failure",
    healthId: "health:failure:summary",
    lastFailureAt: latestTimestamp(failureTimestamps),
    lastSuccessAt: latestTimestamp(reviewedTimestamps),
    metadataSummary: sanitizeNotificationHealthMetadata({
      provider_error_failures: stats.providerErrorFailures,
      reviewed_failures: stats.reviewedFailures,
      source: "notification_health_runtime",
      total_failures: stats.totalFailures,
      unreviewed_failures: stats.unreviewedFailures
    }),
    referenceKey: "failure_summary",
    referenceLabel: "Failure health summary",
    safeSummary:
      safeCount(stats.totalFailures) > 0
        ? `Read-only failure health from ${stats.totalFailures} failure records (${stats.unreviewedFailures} unreviewed, ${stats.reviewedFailures} reviewed). No failure remediation connected.`
        : "Failure health summary shows no failure records in read-only runtime.",
    status,
    updatedAt: latestTimestamp([...failureTimestamps, ...reviewedTimestamps])
  });
}

function collectDeliveryTimestamps(deliveries: NotificationDeliveryRecord[]) {
  const successTimestamps: string[] = [];
  const failureTimestamps: string[] = [];

  for (const delivery of deliveries) {
    const timestamp =
      text(delivery.updatedAt, 80) ||
      text(delivery.deliveredAt, 80) ||
      text(delivery.readAt, 80) ||
      text(delivery.createdAt, 80);
    if (!timestamp) continue;

    if (["sent", "delivered", "read"].includes(delivery.deliveryStatus)) {
      successTimestamps.push(timestamp);
    }

    if (delivery.deliveryStatus === "failed" || delivery.deliveryStatus === "retry") {
      failureTimestamps.push(timestamp);
    }
  }

  return {
    lastFailureAt: latestTimestamp(failureTimestamps),
    lastSuccessAt: latestTimestamp(successTimestamps)
  };
}

function buildPlatformHealthRecord(params: {
  deliveries: NotificationDeliveryRecord[];
  healthItems: NotificationHealthRecord[];
}): NotificationHealthRecord {
  const domainStatuses = params.healthItems
    .filter((item) => item.domain !== "platform")
    .map((item) => item.status);
  const status = resolveOverallHealthStatus(domainStatuses);
  const deliveryTimestamps = collectDeliveryTimestamps(params.deliveries);
  const lastFailureAt = latestTimestamp([
    deliveryTimestamps.lastFailureAt,
    ...params.healthItems.map((item) => item.lastFailureAt)
  ]);
  const lastSuccessAt = latestTimestamp([
    deliveryTimestamps.lastSuccessAt,
    ...params.healthItems.map((item) => item.lastSuccessAt)
  ]);

  return buildHealthRecord({
    degraded: status === "degraded",
    domain: "platform",
    healthId: "health:platform:summary",
    lastFailureAt,
    lastSuccessAt,
    metadataSummary: sanitizeNotificationHealthMetadata({
      degraded_items: params.healthItems.filter((item) => item.degraded).length,
      source: "notification_health_runtime",
      total_health_items: params.healthItems.length
    }),
    referenceKey: "platform_summary",
    referenceLabel: "Platform notification health",
    safeSummary:
      status === "healthy"
        ? "Platform notification health is healthy from read-only runtime signals. No live health checks connected."
        : status === "degraded"
          ? "Platform notification health is degraded based on read-only queue, retry, failure, channel, or provider signals."
          : "Platform notification health could not be fully resolved from read-only runtime data.",
    status,
    updatedAt: latestTimestamp([lastFailureAt, lastSuccessAt])
  });
}

const emptyQueueStats: NotificationQueueRuntimeStats = {
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

const emptyRetryStats: NotificationRetryRuntimeStats = {
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

const emptyFailureStats: NotificationFailureRuntimeStats = {
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

export function buildNotificationHealthRecordsSafe(params: {
  deliveries?: NotificationDeliveryRecord[] | null;
  failureItems?: NotificationFailureRecord[] | null;
  failureStats?: NotificationFailureRuntimeStats | null;
  monitoringItems?: NotificationMonitoringRecord[] | null;
  providerStatus?: Array<{
    description: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    metadataSummary: string;
    placeholderOnly: boolean;
    providerKey: NotificationProviderKey;
    providerLabel: string;
  }> | null;
  queueItems?: NotificationQueueRecord[] | null;
  queueStats?: NotificationQueueRuntimeStats | null;
  retryItems?: NotificationRetryRecord[] | null;
  retryStats?: NotificationRetryRuntimeStats | null;
}): { healthItems: NotificationHealthRecord[]; warning: string | null } {
  try {
    const monitoringItems = Array.isArray(params.monitoringItems) ? params.monitoringItems : [];
    const providerStatus = Array.isArray(params.providerStatus) ? params.providerStatus : [];
    const deliveries = Array.isArray(params.deliveries) ? params.deliveries : [];
    const queueItems = Array.isArray(params.queueItems) ? params.queueItems : [];
    const retryItems = Array.isArray(params.retryItems) ? params.retryItems : [];
    const failureItems = Array.isArray(params.failureItems) ? params.failureItems : [];

    const channelHealthItems = buildChannelHealthRecords(monitoringItems);
    const providerHealthItems = buildProviderHealthRecords({ monitoringItems, providerStatus });
    const queueHealthItem = buildQueueHealthSummary({
      queueItems,
      queueStats: params.queueStats ?? emptyQueueStats
    });
    const retryHealthItem = buildRetryHealthSummary({
      retryItems,
      retryStats: params.retryStats ?? emptyRetryStats
    });
    const failureHealthItem = buildFailureHealthSummary({
      failureItems,
      failureStats: params.failureStats ?? emptyFailureStats
    });

    const domainHealthItems = [
      ...channelHealthItems,
      ...providerHealthItems,
      queueHealthItem,
      retryHealthItem,
      failureHealthItem
    ];
    const platformHealthItem = buildPlatformHealthRecord({
      deliveries,
      healthItems: domainHealthItems
    });

    return {
      healthItems: [...domainHealthItems, platformHealthItem],
      warning: null
    };
  } catch (error) {
    console.error("[notification-health-runtime] health records build failed", error);

    return {
      healthItems: [
        buildHealthRecord({
          degraded: false,
          domain: "platform",
          healthId: "health:platform:fallback",
          metadataSummary: sanitizeNotificationHealthMetadata({ source: "notification_health_runtime" }),
          referenceKey: "fallback",
          referenceLabel: "Notification health fallback",
          safeSummary: "Notification health visibility could not be resolved safely.",
          status: "unknown"
        })
      ],
      warning: "Notification health runtime fallback applied."
    };
  }
}

export function buildNotificationHealthSnapshotSafe(
  healthItems: NotificationHealthRecord[] | null | undefined
): NotificationHealthSnapshot {
  try {
    const items = Array.isArray(healthItems) ? healthItems : [];
    if (!items.length) {
      return { ...NOTIFICATION_HEALTH_DEFAULT };
    }

    const platformItem =
      items.find((item) => item.domain === "platform" && item.healthId === "health:platform:summary") ??
      items.find((item) => item.domain === "platform") ??
      items[0];
    const healthyCount = items.filter((item) => item.status === "healthy").length;
    const degradedCount = items.filter((item) => item.status === "degraded").length;
    const unknownCount = items.filter((item) => item.status === "unknown").length;
    const overallStatus = platformItem?.status ?? resolveOverallHealthStatus(items.map((item) => item.status));

    return {
      degraded: overallStatus === "degraded",
      degradedCount,
      healthDescription:
        items.length > 0
          ? `Read-only notification health from ${items.length} safe health records. No live provider tests or health checks connected.`
          : NOTIFICATION_HEALTH_DEFAULT.healthDescription,
      healthReady: true,
      healthyCount,
      lastFailureAt: platformItem?.lastFailureAt ?? null,
      lastSuccessAt: platformItem?.lastSuccessAt ?? null,
      overallStatus,
      overallStatusLabel: getNotificationHealthStatusLabel(overallStatus),
      safeSummary: platformItem?.safeSummary ?? NOTIFICATION_HEALTH_DEFAULT.safeSummary,
      unknownCount
    };
  } catch (error) {
    console.error("[notification-health-runtime] health snapshot build failed", error);
    return { ...NOTIFICATION_HEALTH_DEFAULT };
  }
}

export function buildNotificationHealthRuntimeStatsSafe(
  healthItems: NotificationHealthRecord[] | null | undefined
): NotificationHealthRuntimeStats {
  try {
    const items = Array.isArray(healthItems) ? healthItems : [];

    return {
      channelHealthItems: items.filter((item) => item.domain === "channel").length,
      degradedHealthItems: items.filter((item) => item.status === "degraded").length,
      failureHealthItems: items.filter((item) => item.domain === "failure").length,
      healthyHealthItems: items.filter((item) => item.status === "healthy").length,
      platformHealthItems: items.filter((item) => item.domain === "platform").length,
      providerHealthItems: items.filter((item) => item.domain === "provider").length,
      queueHealthItems: items.filter((item) => item.domain === "queue").length,
      retryHealthItems: items.filter((item) => item.domain === "retry").length,
      totalHealthItems: items.length,
      unknownHealthItems: items.filter((item) => item.status === "unknown").length
    };
  } catch (error) {
    console.error("[notification-health-runtime] health runtime stats build failed", error);

    return {
      channelHealthItems: 0,
      degradedHealthItems: 0,
      failureHealthItems: 0,
      healthyHealthItems: 0,
      platformHealthItems: 0,
      providerHealthItems: 0,
      queueHealthItems: 0,
      retryHealthItems: 0,
      totalHealthItems: 0,
      unknownHealthItems: 0
    };
  }
}

export function listNotificationHealthDomainCatalog() {
  return (Object.keys(domainLabels) as NotificationHealthDomain[]).map((domain) => ({
    description: `Read-only ${domainLabels[domain].toLowerCase()} visibility for Super Admin.`,
    domain,
    label: domainLabels[domain]
  }));
}

// NT-17+ placeholders: live probes, remediation, and alerting stay disconnected.
export const NOTIFICATION_HEALTH_FUTURE_HOOKS = [
  "notification_health_live_probe",
  "notification_health_remediation",
  "notification_health_alerting"
] as const;
