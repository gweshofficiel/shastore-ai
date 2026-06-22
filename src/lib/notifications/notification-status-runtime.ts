import "server-only";

export type NotificationDeliveryStatus =
  | "archived"
  | "cancelled"
  | "delivered"
  | "draft"
  | "failed"
  | "queued"
  | "read"
  | "retry"
  | "sent";

export type NotificationRegistryStatus =
  | "configured"
  | "failed"
  | "healthy"
  | "missing"
  | "placeholder"
  | "queued"
  | "read"
  | "reserved_placeholder"
  | "reviewed"
  | "sent"
  | "unknown"
  | "unread"
  | "warning";

export type NotificationCenterStatus = NotificationDeliveryStatus | NotificationRegistryStatus;

export type NotificationStatusBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type NotificationStatusCatalogEntry = {
  badgeTone: NotificationStatusBadgeTone;
  description: string;
  label: string;
  status: NotificationCenterStatus;
};

export type NotificationDeliveryStatusStats = {
  archivedItems: number;
  cancelledItems: number;
  deliveredItems: number;
  draftItems: number;
  failedItems: number;
  queuedItems: number;
  readItems: number;
  retryItems: number;
  sentItems: number;
  totalItems: number;
};

export type NotificationRegistryStatusStats = {
  configuredItems: number;
  failedItems: number;
  healthyItems: number;
  missingItems: number;
  placeholderItems: number;
  reservedPlaceholderItems: number;
  reviewedItems: number;
  totalItems: number;
  unknownItems: number;
  warningItems: number;
};

export const NOTIFICATION_DELIVERY_STATUSES: readonly NotificationDeliveryStatus[] = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "retry",
  "cancelled",
  "archived"
] as const;

export const NOTIFICATION_REGISTRY_STATUSES: readonly NotificationRegistryStatus[] = [
  "configured",
  "healthy",
  "warning",
  "placeholder",
  "missing",
  "queued",
  "unread",
  "read",
  "sent",
  "failed",
  "reviewed",
  "reserved_placeholder",
  "unknown"
] as const;

export const NOTIFICATION_CENTER_STATUSES: readonly NotificationCenterStatus[] = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "retry",
  "cancelled",
  "archived",
  "configured",
  "healthy",
  "warning",
  "placeholder",
  "missing",
  "unread",
  "reviewed",
  "reserved_placeholder",
  "unknown"
] as const;

const statusLabels: Record<NotificationCenterStatus, string> = {
  archived: "Archived",
  cancelled: "Cancelled",
  configured: "Configured",
  delivered: "Delivered",
  draft: "Draft",
  failed: "Failed",
  healthy: "Healthy",
  missing: "Missing",
  placeholder: "Placeholder",
  queued: "Queued",
  read: "Read",
  reserved_placeholder: "Reserved placeholder",
  retry: "Retry",
  reviewed: "Reviewed",
  sent: "Sent",
  unknown: "Unknown",
  unread: "Unread",
  warning: "Warning"
};

const statusDescriptions: Record<NotificationCenterStatus, string> = {
  archived: "Archived notification state shown from read-only logs. No archive execution connected.",
  cancelled: "Cancelled notification state shown from read-only logs. No cancellation execution connected.",
  configured: "Configured registry foundation state without exposing provider secrets.",
  delivered: "Delivered notification state shown from read-only logs. No delivery execution connected.",
  draft: "Draft notification foundation prepared for internal review only.",
  failed: "Failed delivery state shown from read-only notification logs.",
  healthy: "Healthy registry foundation state without secret exposure.",
  missing: "Missing configuration or registry foundation state.",
  placeholder: "Placeholder foundation reserved for future notification runtime phases.",
  queued: "Queued delivery state shown from read-only notification logs. No queue execution connected.",
  read: "Read notification state shown from read-only logs.",
  reserved_placeholder: "Reserved future hook placeholder. No execution connected.",
  retry: "Retry state shown from read-only logs. No retry execution connected.",
  reviewed: "Reviewed failure state from safe admin placeholder actions.",
  sent: "Sent delivery state shown from read-only notification logs. No sending connected from page load.",
  unknown: "Status could not be resolved safely.",
  unread: "Unread in-app notification state shown from read-only logs.",
  warning: "Warning registry foundation state without secret exposure."
};

const badgeToneByStatus: Record<NotificationCenterStatus, NotificationStatusBadgeTone> = {
  archived: "slate",
  cancelled: "blue",
  configured: "green",
  delivered: "green",
  draft: "amber",
  failed: "red",
  healthy: "green",
  missing: "red",
  placeholder: "blue",
  queued: "amber",
  read: "green",
  reserved_placeholder: "blue",
  retry: "amber",
  reviewed: "slate",
  sent: "green",
  unknown: "amber",
  unread: "amber",
  warning: "amber"
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isValidNotificationDeliveryStatus(value: unknown): value is NotificationDeliveryStatus {
  return typeof value === "string" && NOTIFICATION_DELIVERY_STATUSES.includes(value as NotificationDeliveryStatus);
}

export function isValidNotificationRegistryStatus(value: unknown): value is NotificationRegistryStatus {
  return typeof value === "string" && NOTIFICATION_REGISTRY_STATUSES.includes(value as NotificationRegistryStatus);
}

export function isValidNotificationCenterStatus(value: unknown): value is NotificationCenterStatus {
  return typeof value === "string" && NOTIFICATION_CENTER_STATUSES.includes(value as NotificationCenterStatus);
}

export function parseNotificationDeliveryStatus(
  value: unknown,
  options: { readAt?: unknown } = {}
): NotificationDeliveryStatus {
  const cleaned = text(value, 80).toLowerCase();

  if (!cleaned) {
    return text(options.readAt, 80) ? "read" : "draft";
  }

  if (cleaned === "draft" || cleaned === "unknown") {
    return "draft";
  }

  if (cleaned === "queued" || cleaned === "pending" || cleaned === "queue") {
    return "queued";
  }

  if (cleaned === "sent") {
    return "sent";
  }

  if (cleaned === "delivered" || cleaned === "unread") {
    return "delivered";
  }

  if (cleaned === "read" || Boolean(text(options.readAt, 80))) {
    return "read";
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    return "failed";
  }

  if (cleaned === "retry" || cleaned === "retry_pending" || cleaned === "retry-pending") {
    return "retry";
  }

  if (cleaned === "cancelled" || cleaned === "canceled") {
    return "cancelled";
  }

  if (cleaned === "archived" || cleaned === "reviewed") {
    return "archived";
  }

  return "draft";
}

export function parseNotificationRegistryStatus(value: unknown): NotificationRegistryStatus | null {
  const cleaned = text(value, 80);

  if (!cleaned) {
    return null;
  }

  if (isValidNotificationRegistryStatus(cleaned)) {
    return cleaned;
  }

  const deliveryStatus = parseNotificationDeliveryStatus(cleaned);

  if (deliveryStatus === "queued") return "queued";
  if (deliveryStatus === "read") return "read";
  if (deliveryStatus === "sent") return "sent";
  if (deliveryStatus === "failed") return "failed";
  if (deliveryStatus === "delivered") return "unread";
  if (deliveryStatus === "archived") return "reviewed";
  if (deliveryStatus === "draft") return "unknown";

  return null;
}

export function parseNotificationCenterStatus(value: unknown): NotificationCenterStatus | null {
  const registryStatus = parseNotificationRegistryStatus(value);
  if (registryStatus) return registryStatus;

  const deliveryStatus = parseNotificationDeliveryStatus(value);
  return deliveryStatus;
}

export function parseNotificationRegistryItemStatusSafe(value: unknown): NotificationCenterStatus {
  return parseNotificationCenterStatus(value) ?? "unknown";
}

export function parseNotificationDeliveryStatusSafe(
  value: unknown,
  options: { readAt?: unknown } = {}
): NotificationDeliveryStatus {
  return parseNotificationDeliveryStatus(value, options);
}

export function getNotificationStatusLabel(status: NotificationCenterStatus) {
  return statusLabels[status];
}

export function getNotificationStatusDescription(status: NotificationCenterStatus) {
  return statusDescriptions[status];
}

export function getNotificationStatusBadgeTone(status: NotificationCenterStatus): NotificationStatusBadgeTone {
  return badgeToneByStatus[status];
}

export function resolveNotificationStatusLabel(value: unknown) {
  const status = parseNotificationCenterStatus(value);
  return status ? getNotificationStatusLabel(status) : "Draft";
}

export function resolveNotificationStatusBadgeTone(value: unknown): NotificationStatusBadgeTone {
  const status = parseNotificationCenterStatus(value);
  return status ? getNotificationStatusBadgeTone(status) : "amber";
}

export function resolveNotificationDeliveryStatusLabel(value: unknown, options: { readAt?: unknown } = {}) {
  const status = parseNotificationDeliveryStatusSafe(value, options);
  return getNotificationStatusLabel(status);
}

export function resolveNotificationDeliveryStatusBadgeTone(
  value: unknown,
  options: { readAt?: unknown } = {}
): NotificationStatusBadgeTone {
  const status = parseNotificationDeliveryStatusSafe(value, options);
  return getNotificationStatusBadgeTone(status);
}

export function listNotificationStatusCatalog(): NotificationStatusCatalogEntry[] {
  return NOTIFICATION_CENTER_STATUSES.map((status) => ({
    badgeTone: getNotificationStatusBadgeTone(status),
    description: getNotificationStatusDescription(status),
    label: getNotificationStatusLabel(status),
    status
  }));
}

export function listNotificationDeliveryStatusCatalog(): NotificationStatusCatalogEntry[] {
  return NOTIFICATION_DELIVERY_STATUSES.map((status) => ({
    badgeTone: getNotificationStatusBadgeTone(status),
    description: getNotificationStatusDescription(status),
    label: getNotificationStatusLabel(status),
    status
  }));
}

export function countNotificationDeliveryItemsByStatus(
  items: Array<{ status?: unknown; readAt?: unknown }>
): NotificationDeliveryStatusStats {
  const snapshots = Array.isArray(items) ? items : [];

  return {
    archivedItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "archived").length,
    cancelledItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "cancelled")
      .length,
    deliveredItems: snapshots.filter(
      (item) => parseNotificationDeliveryStatusSafe(item.status, { readAt: item.readAt }) === "delivered"
    ).length,
    draftItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "draft").length,
    failedItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "failed").length,
    queuedItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "queued").length,
    readItems: snapshots.filter(
      (item) => parseNotificationDeliveryStatusSafe(item.status, { readAt: item.readAt }) === "read"
    ).length,
    retryItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "retry").length,
    sentItems: snapshots.filter((item) => parseNotificationDeliveryStatusSafe(item.status) === "sent").length,
    totalItems: snapshots.length
  };
}

export function buildNotificationDeliveryStatusStatsSafe(
  items: Array<{ status?: unknown; readAt?: unknown }> | null | undefined
): NotificationDeliveryStatusStats {
  try {
    return countNotificationDeliveryItemsByStatus(Array.isArray(items) ? items : []);
  } catch (error) {
    console.error("[notification-status-runtime] delivery status stats failed", error);

    return {
      archivedItems: 0,
      cancelledItems: 0,
      deliveredItems: 0,
      draftItems: 0,
      failedItems: 0,
      queuedItems: 0,
      readItems: 0,
      retryItems: 0,
      sentItems: 0,
      totalItems: 0
    };
  }
}

export function countNotificationRegistryItemsByStatus<T extends { status: NotificationCenterStatus }>(
  items: T[]
): NotificationRegistryStatusStats {
  return {
    configuredItems: items.filter((item) => item.status === "configured").length,
    failedItems: items.filter((item) => item.status === "failed").length,
    healthyItems: items.filter((item) => item.status === "healthy").length,
    missingItems: items.filter((item) => item.status === "missing").length,
    placeholderItems: items.filter((item) => item.status === "placeholder").length,
    reservedPlaceholderItems: items.filter((item) => item.status === "reserved_placeholder").length,
    reviewedItems: items.filter((item) => item.status === "reviewed").length,
    totalItems: items.length,
    unknownItems: items.filter((item) => item.status === "unknown").length,
    warningItems: items.filter((item) => item.status === "warning").length
  };
}

export function buildNotificationRegistryStatusStatsSafe(
  items: Array<{ status: NotificationCenterStatus | unknown }> | null | undefined
): NotificationRegistryStatusStats {
  try {
    const snapshots = Array.isArray(items)
      ? items
          .map((item) => {
            const status = parseNotificationRegistryItemStatusSafe(item.status);
            return { status };
          })
          .filter((item): item is { status: NotificationCenterStatus } => isValidNotificationCenterStatus(item.status))
      : [];

    return countNotificationRegistryItemsByStatus(snapshots);
  } catch (error) {
    console.error("[notification-status-runtime] registry status stats failed", error);

    return {
      configuredItems: 0,
      failedItems: 0,
      healthyItems: 0,
      missingItems: 0,
      placeholderItems: 0,
      reservedPlaceholderItems: 0,
      reviewedItems: 0,
      totalItems: 0,
      unknownItems: 0,
      warningItems: 0
    };
  }
}

export function buildNotificationDeliveryStatusSummaryFromLogs(
  logs: Array<{ status?: unknown; readAt?: unknown }>
): NotificationDeliveryStatusStats {
  return countNotificationDeliveryItemsByStatus(Array.isArray(logs) ? logs : []);
}

export function buildNotificationDeliveryStatusSummaryFromLogsSafe(
  logs: Array<{ status?: unknown; readAt?: unknown }> | null | undefined
): NotificationDeliveryStatusStats {
  try {
    return buildNotificationDeliveryStatusSummaryFromLogs(Array.isArray(logs) ? logs : []);
  } catch (error) {
    console.error("[notification-status-runtime] delivery status summary failed", error);

    return {
      archivedItems: 0,
      cancelledItems: 0,
      deliveredItems: 0,
      draftItems: 0,
      failedItems: 0,
      queuedItems: 0,
      readItems: 0,
      retryItems: 0,
      sentItems: 0,
      totalItems: 0
    };
  }
}

export function groupNotificationRegistryItemsByStatus<T extends { status: NotificationCenterStatus }>(items: T[]) {
  return NOTIFICATION_CENTER_STATUSES.map((status) => ({
    items: items.filter((item) => item.status === status),
    status,
    statusDescription: getNotificationStatusDescription(status),
    statusLabel: getNotificationStatusLabel(status)
  }));
}

// NT-4+ placeholders: queue execution, retry workers, and delivery webhooks stay disconnected.
export const NOTIFICATION_STATUS_FUTURE_HOOKS = [
  "notification_queue_execution",
  "notification_retry_worker",
  "notification_delivery_webhooks"
] as const;
