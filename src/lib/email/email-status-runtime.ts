import "server-only";

export type EmailRegistryStatus =
  | "active"
  | "configured"
  | "disabled"
  | "draft"
  | "failed"
  | "healthy"
  | "missing"
  | "monitoring"
  | "placeholder"
  | "reserved_placeholder"
  | "unknown";

export type EmailQueueLogStatus = "cancelled" | "failed" | "queued" | "retry_pending" | "sent";

export type EmailCenterStatus =
  | EmailRegistryStatus
  | EmailQueueLogStatus;

export type EmailStatusBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailTemplateDisplayStatus = "active" | "disabled" | "draft";

export type EmailTransactionalSectionStatus = "active" | "draft" | "placeholder";

export type EmailCampaignScopeStatus = "monitoring" | "placeholder";

export type EmailStatusCatalogEntry = {
  badgeTone: EmailStatusBadgeTone;
  description: string;
  label: string;
  status: EmailCenterStatus;
};

export type EmailRegistryStatusStats = {
  activeItems: number;
  configuredItems: number;
  disabledItems: number;
  draftItems: number;
  failedItems: number;
  healthyItems: number;
  missingItems: number;
  monitoringItems: number;
  placeholderItems: number;
  reservedPlaceholderItems: number;
  totalItems: number;
  unknownItems: number;
};

export type EmailQueueStatusSummary = {
  cancelled: number;
  failed: number;
  queued: number;
  retryPending: number;
  sent: number;
};

export const EMAIL_REGISTRY_STATUSES: readonly EmailRegistryStatus[] = [
  "draft",
  "active",
  "placeholder",
  "configured",
  "missing",
  "healthy",
  "failed",
  "monitoring",
  "reserved_placeholder",
  "unknown",
  "disabled"
] as const;

export const EMAIL_QUEUE_LOG_STATUSES: readonly EmailQueueLogStatus[] = [
  "queued",
  "sent",
  "failed",
  "retry_pending",
  "cancelled"
] as const;

export const EMAIL_CENTER_STATUSES: readonly EmailCenterStatus[] = [
  "draft",
  "active",
  "placeholder",
  "configured",
  "missing",
  "healthy",
  "failed",
  "monitoring",
  "queued",
  "sent",
  "retry_pending",
  "cancelled",
  "reserved_placeholder",
  "unknown",
  "disabled"
] as const;

const statusLabels: Record<EmailCenterStatus, string> = {
  active: "Active",
  cancelled: "Cancelled",
  configured: "Configured",
  disabled: "Disabled",
  draft: "Draft",
  failed: "Failed",
  healthy: "Healthy",
  missing: "Missing",
  monitoring: "Monitoring",
  placeholder: "Placeholder",
  queued: "Queued",
  reserved_placeholder: "Reserved placeholder",
  retry_pending: "Retry pending",
  sent: "Sent",
  unknown: "Unknown"
};

const statusDescriptions: Record<EmailCenterStatus, string> = {
  active: "Active email foundation visible to Super Admin review.",
  cancelled: "Cancelled queue entry. No send execution in Email Center page load.",
  configured: "Configured foundation state without exposing provider secrets.",
  disabled: "Disabled template foundation from safe admin placeholder actions.",
  draft: "Draft foundation prepared for internal review only.",
  failed: "Failed delivery state shown from read-only email event logs.",
  healthy: "Healthy provider foundation state without secret exposure.",
  missing: "Missing configuration or registry foundation state.",
  monitoring: "Monitoring-only foundation state for read-only summaries.",
  placeholder: "Placeholder foundation reserved for future email runtime phases.",
  queued: "Queued delivery state shown from read-only email event logs.",
  reserved_placeholder: "Reserved future hook placeholder. No execution connected.",
  retry_pending: "Retry pending state shown from read-only email event logs.",
  sent: "Sent delivery state shown from read-only email event logs.",
  unknown: "Status could not be resolved safely."
};

const badgeToneByStatus: Record<EmailCenterStatus, EmailStatusBadgeTone> = {
  active: "green",
  cancelled: "blue",
  configured: "green",
  disabled: "red",
  draft: "amber",
  failed: "red",
  healthy: "green",
  missing: "red",
  monitoring: "blue",
  placeholder: "blue",
  queued: "amber",
  reserved_placeholder: "blue",
  retry_pending: "amber",
  sent: "green",
  unknown: "amber"
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

export function isValidEmailRegistryStatus(value: unknown): value is EmailRegistryStatus {
  return typeof value === "string" && EMAIL_REGISTRY_STATUSES.includes(value as EmailRegistryStatus);
}

export function isValidEmailQueueLogStatus(value: unknown): value is EmailQueueLogStatus {
  return typeof value === "string" && EMAIL_QUEUE_LOG_STATUSES.includes(value as EmailQueueLogStatus);
}

export function isValidEmailCenterStatus(value: unknown): value is EmailCenterStatus {
  return typeof value === "string" && EMAIL_CENTER_STATUSES.includes(value as EmailCenterStatus);
}

export function parseEmailRegistryStatus(value: unknown): EmailRegistryStatus | null {
  const cleaned = text(value, 80);
  return isValidEmailRegistryStatus(cleaned) ? cleaned : null;
}

export function parseEmailQueueLogStatus(value: unknown): EmailQueueLogStatus | null {
  const cleaned = text(value, 80);

  if (cleaned === "pending" || cleaned === "queued") {
    return "queued";
  }

  return isValidEmailQueueLogStatus(cleaned) ? cleaned : null;
}

export function parseEmailCenterStatus(value: unknown): EmailCenterStatus | null {
  const registryStatus = parseEmailRegistryStatus(value);
  if (registryStatus) return registryStatus;

  return parseEmailQueueLogStatus(value);
}

export function assertValidEmailRegistryStatus(value: unknown): EmailRegistryStatus {
  const status = parseEmailRegistryStatus(value);

  if (!status) {
    throw new Error(
      "Email registry status must be draft, active, placeholder, configured, missing, healthy, failed, monitoring, reserved_placeholder, unknown, or disabled."
    );
  }

  return status;
}

export function getEmailStatusLabel(status: EmailCenterStatus) {
  return statusLabels[status];
}

export function getEmailStatusDescription(status: EmailCenterStatus) {
  return statusDescriptions[status];
}

export function getEmailStatusBadgeTone(status: EmailCenterStatus): EmailStatusBadgeTone {
  return badgeToneByStatus[status];
}

export function resolveEmailStatusLabel(value: unknown) {
  const status = parseEmailCenterStatus(value);
  return status ? getEmailStatusLabel(status) : "Unknown";
}

export function resolveEmailStatusBadgeTone(value: unknown): EmailStatusBadgeTone {
  const status = parseEmailCenterStatus(value);
  return status ? getEmailStatusBadgeTone(status) : "amber";
}

export function resolveEmailStatusDescription(value: unknown) {
  const status = parseEmailCenterStatus(value);
  return status ? getEmailStatusDescription(status) : "Email status could not be resolved safely.";
}

export function listEmailStatusCatalog(): EmailStatusCatalogEntry[] {
  return EMAIL_CENTER_STATUSES.map((status) => ({
    badgeTone: getEmailStatusBadgeTone(status),
    description: getEmailStatusDescription(status),
    label: getEmailStatusLabel(status),
    status
  }));
}

export function mapRegistryStatusToTemplateStatus(status: EmailRegistryStatus): EmailTemplateDisplayStatus {
  if (status === "active" || status === "configured" || status === "healthy") return "active";
  if (status === "disabled") return "disabled";
  return "draft";
}

export function mapRegistryStatusToTransactionalStatus(
  status: EmailRegistryStatus
): EmailTransactionalSectionStatus {
  if (status === "active" || status === "configured" || status === "healthy") return "active";
  if (status === "placeholder" || status === "reserved_placeholder") return "placeholder";
  return "draft";
}

export function mapRegistryStatusToCampaignScopeStatus(status: EmailRegistryStatus): EmailCampaignScopeStatus {
  if (status === "monitoring") return "monitoring";
  return "placeholder";
}

export function countEmailRegistryItemsByStatus<T extends { status: EmailRegistryStatus }>(
  items: T[]
): EmailRegistryStatusStats {
  return {
    activeItems: items.filter((item) => item.status === "active").length,
    configuredItems: items.filter((item) => item.status === "configured").length,
    disabledItems: items.filter((item) => item.status === "disabled").length,
    draftItems: items.filter((item) => item.status === "draft").length,
    failedItems: items.filter((item) => item.status === "failed").length,
    healthyItems: items.filter((item) => item.status === "healthy").length,
    missingItems: items.filter((item) => item.status === "missing").length,
    monitoringItems: items.filter((item) => item.status === "monitoring").length,
    placeholderItems: items.filter((item) => item.status === "placeholder").length,
    reservedPlaceholderItems: items.filter((item) => item.status === "reserved_placeholder").length,
    totalItems: items.length,
    unknownItems: items.filter((item) => item.status === "unknown").length
  };
}

export function buildEmailRegistryStatusStatsSafe(
  items: Array<{ status: EmailRegistryStatus | unknown }> | null | undefined
): EmailRegistryStatusStats {
  try {
    const snapshots = Array.isArray(items)
      ? items.filter((item): item is { status: EmailRegistryStatus } => isValidEmailRegistryStatus(item.status))
      : [];

    return countEmailRegistryItemsByStatus(snapshots);
  } catch (error) {
    console.error("[email-status-runtime] registry status stats failed", error);

    return {
      activeItems: 0,
      configuredItems: 0,
      disabledItems: 0,
      draftItems: 0,
      failedItems: 0,
      healthyItems: 0,
      missingItems: 0,
      monitoringItems: 0,
      placeholderItems: 0,
      reservedPlaceholderItems: 0,
      totalItems: 0,
      unknownItems: 0
    };
  }
}

export function buildEmailQueueStatusSummaryFromLogs(
  logs: Array<{ status?: unknown }>
): EmailQueueStatusSummary {
  const snapshots = Array.isArray(logs) ? logs : [];

  return {
    cancelled: snapshots.filter((log) => parseEmailQueueLogStatus(log.status) === "cancelled").length,
    failed: snapshots.filter((log) => parseEmailQueueLogStatus(log.status) === "failed").length,
    queued: snapshots.filter((log) => parseEmailQueueLogStatus(log.status) === "queued").length,
    retryPending: snapshots.filter((log) => parseEmailQueueLogStatus(log.status) === "retry_pending").length,
    sent: snapshots.filter((log) => parseEmailQueueLogStatus(log.status) === "sent").length
  };
}

export function buildEmailQueueStatusSummaryFromLogsSafe(
  logs: Array<{ status?: unknown }> | null | undefined
): EmailQueueStatusSummary {
  try {
    return buildEmailQueueStatusSummaryFromLogs(Array.isArray(logs) ? logs : []);
  } catch (error) {
    console.error("[email-status-runtime] queue status summary failed", error);

    return {
      cancelled: 0,
      failed: 0,
      queued: 0,
      retryPending: 0,
      sent: 0
    };
  }
}

export function groupEmailRegistryItemsByStatus<T extends { status: EmailRegistryStatus }>(items: T[]) {
  return EMAIL_REGISTRY_STATUSES.map((status) => ({
    items: items.filter((item) => item.status === status),
    status,
    statusDescription: getEmailStatusDescription(status),
    statusLabel: getEmailStatusLabel(status)
  }));
}
