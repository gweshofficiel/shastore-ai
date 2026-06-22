import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listNotificationTypeCatalog,
  parseNotificationType,
  type NotificationType
} from "@/src/lib/notifications/notification-type-runtime";
import {
  parseNotificationRegistryItemStatusSafe,
  type NotificationCenterStatus
} from "@/src/lib/notifications/notification-status-runtime";
import {
  parseNotificationChannel,
  resolveRegistryNotificationChannelSafe,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  resolveRegistryNotificationCategorySafe,
  type NotificationCategory
} from "@/src/lib/notifications/notification-category-runtime";
import {
  resolveRegistryNotificationProviderSafe,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import {
  parseNotificationTemplateKeySafe
} from "@/src/lib/notifications/notification-template-runtime";

export type { NotificationType } from "@/src/lib/notifications/notification-type-runtime";
export type {
  NotificationCenterStatus,
  NotificationDeliveryStatus,
  NotificationRegistryStatus
} from "@/src/lib/notifications/notification-status-runtime";
export type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
export type { NotificationCategory } from "@/src/lib/notifications/notification-category-runtime";
export type { NotificationProviderKey } from "@/src/lib/notifications/notification-provider-runtime";
export {
  buildNotificationTypeAdminViews,
  buildNotificationTypeStatsSafe,
  classifyNotificationTypeFromSource,
  countNotificationItemsByType,
  getNotificationTypeBadgeTone,
  getNotificationTypeDescription,
  getNotificationTypeLabel,
  isValidNotificationType,
  listNotificationTypeCatalog,
  NOTIFICATION_TYPES,
  parseNotificationType,
  resolveNotificationTypeBadgeTone,
  resolveNotificationTypeFromSourceSafe,
  resolveNotificationTypeLabel
} from "@/src/lib/notifications/notification-type-runtime";
export type {
  NotificationTypeBadgeTone,
  NotificationTypeCatalogEntry,
  NotificationTypeStats
} from "@/src/lib/notifications/notification-type-runtime";
export {
  buildNotificationDeliveryStatusStatsSafe,
  buildNotificationDeliveryStatusSummaryFromLogsSafe,
  buildNotificationRegistryStatusStatsSafe,
  getNotificationStatusBadgeTone,
  getNotificationStatusDescription,
  getNotificationStatusLabel,
  listNotificationDeliveryStatusCatalog,
  listNotificationStatusCatalog,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_REGISTRY_STATUSES,
  NOTIFICATION_STATUS_FUTURE_HOOKS,
  parseNotificationDeliveryStatusSafe,
  parseNotificationRegistryItemStatusSafe,
  parseNotificationRegistryStatus,
  resolveNotificationDeliveryStatusBadgeTone,
  resolveNotificationStatusBadgeTone,
  resolveNotificationStatusLabel
} from "@/src/lib/notifications/notification-status-runtime";
export type {
  NotificationDeliveryStatusStats,
  NotificationRegistryStatusStats,
  NotificationStatusBadgeTone,
  NotificationStatusCatalogEntry
} from "@/src/lib/notifications/notification-status-runtime";
export {
  buildNotificationChannelAdminViews,
  buildNotificationChannelStatsSafe,
  buildNotificationChannelViewsSafe,
  getNotificationChannelBadgeTone,
  getNotificationChannelDescription,
  getNotificationChannelLabel,
  isNotificationPlaceholderChannel,
  listNotificationChannelCatalog,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_FUTURE_HOOKS,
  NOTIFICATION_PLACEHOLDER_CHANNELS,
  parseNotificationChannel,
  parseNotificationChannelSafe,
  resolveNotificationChannelBadgeTone,
  resolveNotificationChannelLabel,
  resolveRegistryNotificationChannelSafe
} from "@/src/lib/notifications/notification-channel-runtime";
export type {
  NotificationChannelBadgeTone,
  NotificationChannelCatalogEntry,
  NotificationChannelRuntimeState,
  NotificationChannelStats,
  NotificationChannelView,
  NotificationRegistryChannelSnapshot
} from "@/src/lib/notifications/notification-channel-runtime";
export {
  buildNotificationRegistryCategoryStatsSafe,
  classifyNotificationCategoryFromSource,
  getNotificationCategoryBadgeTone,
  getNotificationCategoryDescription,
  getNotificationCategoryLabel,
  listNotificationCategoryCatalog,
  mapNotificationTypeToCategory,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_FUTURE_HOOKS,
  parseNotificationCategory,
  parseNotificationCategorySafe,
  resolveNotificationCategoryBadgeTone,
  resolveNotificationCategoryLabel,
  resolveRegistryNotificationCategorySafe
} from "@/src/lib/notifications/notification-category-runtime";
export type {
  NotificationCategoryBadgeTone,
  NotificationCategoryCatalogEntry,
  NotificationCategoryStats
} from "@/src/lib/notifications/notification-category-runtime";
export {
  buildNotificationProviderStatsSafe,
  buildNotificationProviderViewsSafe,
  buildNotificationRegistryProviderStatsSafe,
  getNotificationProviderDescription,
  getNotificationProviderLabel,
  listNotificationProviderCatalog,
  mapNotificationChannelToProvider,
  NOTIFICATION_PLACEHOLDER_PROVIDER_KEYS,
  NOTIFICATION_PROVIDER_FUTURE_HOOKS,
  NOTIFICATION_PROVIDER_KEYS,
  parseNotificationProviderKey,
  parseNotificationProviderKeySafe,
  resolveNotificationProviderLabel,
  resolveRegistryNotificationProviderSafe
} from "@/src/lib/notifications/notification-provider-runtime";
export type {
  NotificationProviderCatalogEntry,
  NotificationProviderStats,
  NotificationProviderView
} from "@/src/lib/notifications/notification-provider-runtime";
export {
  buildNotificationTemplateStatsSafe,
  buildNotificationTemplateViewsSafe,
  NOTIFICATION_TEMPLATE_FALLBACK_KEY,
  NOTIFICATION_TEMPLATE_FUTURE_HOOKS,
  parseNotificationTemplateKey,
  parseNotificationTemplateKeySafe,
  resolveNotificationTemplateLabel,
  sanitizeNotificationTemplatePreviewContent
} from "@/src/lib/notifications/notification-template-runtime";
export type {
  NotificationTemplateEnabledState,
  NotificationTemplateStats,
  NotificationTemplateView
} from "@/src/lib/notifications/notification-template-runtime";
export {
  buildNotificationDeliveryRecordsSafe,
  buildNotificationDeliveryRuntimeStatsSafe,
  maskNotificationDeliveryRecipient,
  NOTIFICATION_DELIVERY_FALLBACK_ID,
  NOTIFICATION_DELIVERY_FUTURE_HOOKS,
  parseNotificationDeliveryAttemptCountSafe,
  sanitizeNotificationDeliveryErrorSummary
} from "@/src/lib/notifications/notification-delivery-runtime";
export type {
  NotificationDeliveryRecord,
  NotificationDeliveryRuntimeStats
} from "@/src/lib/notifications/notification-delivery-runtime";
export {
  buildNotificationQueueRecordsSafe,
  buildNotificationQueueRuntimeStatsSafe,
  getNotificationQueuePriorityLabel,
  getNotificationQueueStatusLabel,
  listNotificationQueueStatusCatalog,
  NOTIFICATION_QUEUE_FUTURE_HOOKS,
  NOTIFICATION_QUEUE_STATUSES,
  parseNotificationQueueAttemptCountSafe,
  parseNotificationQueuePrioritySafe,
  parseNotificationQueueStatusSafe
} from "@/src/lib/notifications/notification-queue-runtime";
export type {
  NotificationQueuePriority,
  NotificationQueueRecord,
  NotificationQueueRuntimeStats,
  NotificationQueueStatus
} from "@/src/lib/notifications/notification-queue-runtime";
export {
  buildNotificationRetryRecordsSafe,
  buildNotificationRetryRuntimeStatsSafe,
  getNotificationRetryStatusLabel,
  listNotificationRetryStatusCatalog,
  NOTIFICATION_RETRY_DEFAULT_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_FUTURE_HOOKS,
  NOTIFICATION_RETRY_STATUSES,
  parseNotificationRetryMaxAttemptsSafe,
  parseNotificationRetryStatusSafe,
  sanitizeNotificationRetryFailureReason
} from "@/src/lib/notifications/notification-retry-runtime";
export type {
  NotificationRetryRecord,
  NotificationRetryRuntimeStats,
  NotificationRetryStatus
} from "@/src/lib/notifications/notification-retry-runtime";
export {
  buildNotificationFailureRecordsSafe,
  buildNotificationFailureRuntimeStatsSafe,
  getNotificationFailureStatusLabel,
  listNotificationFailureStatusCatalog,
  NOTIFICATION_FAILURE_FUTURE_HOOKS,
  NOTIFICATION_FAILURE_STATUSES,
  parseNotificationFailureCodeSafe,
  parseNotificationFailureStatusSafe,
  sanitizeNotificationFailureReason
} from "@/src/lib/notifications/notification-failure-runtime";
export type {
  NotificationFailureRecord,
  NotificationFailureRuntimeStats,
  NotificationFailureStatus
} from "@/src/lib/notifications/notification-failure-runtime";
export {
  buildNotificationAuditRecordsSafe,
  buildNotificationAuditRuntimeStatsSafe,
  getNotificationAuditActionLabel,
  listNotificationAuditActionCatalog,
  maskNotificationAuditIpReference,
  NOTIFICATION_AUDIT_ACTIONS,
  NOTIFICATION_AUDIT_FUTURE_HOOKS,
  parseNotificationAuditActorType,
  sanitizeNotificationAuditMetadata,
  sanitizeNotificationAuditSummary,
  sanitizeNotificationAuditUserAgent
} from "@/src/lib/notifications/notification-audit-runtime";
export type {
  NotificationAuditAction,
  NotificationAuditActorType,
  NotificationAuditRecord,
  NotificationAuditRuntimeStats
} from "@/src/lib/notifications/notification-audit-runtime";
export {
  buildNotificationMonitoringRecordsSafe,
  buildNotificationMonitoringRuntimeStatsSafe,
  getNotificationMonitorStatusLabel,
  listNotificationMonitorStatusCatalog,
  NOTIFICATION_MONITORING_FUTURE_HOOKS,
  NOTIFICATION_MONITOR_STATUSES,
  parseNotificationMonitorStatusSafe,
  sanitizeNotificationMonitoringMetadata
} from "@/src/lib/notifications/notification-monitoring-runtime";
export type {
  NotificationMonitoringRecord,
  NotificationMonitoringRuntimeStats,
  NotificationMonitorStatus
} from "@/src/lib/notifications/notification-monitoring-runtime";
export {
  buildNotificationMetricViewsSafe,
  buildNotificationMetricsSnapshotSafe,
  listNotificationMetricCatalog,
  NOTIFICATION_METRICS_DEFAULT,
  NOTIFICATION_METRICS_FUTURE_HOOKS
} from "@/src/lib/notifications/notification-metrics-runtime";
export type {
  NotificationMetricsSnapshot,
  NotificationMetricView
} from "@/src/lib/notifications/notification-metrics-runtime";
export {
  buildNotificationAnalyticsBreakdownViewsSafe,
  buildNotificationAnalyticsPeriodViewsSafe,
  buildNotificationAnalyticsRateViewsSafe,
  buildNotificationAnalyticsRuntimeStatsSafe,
  buildNotificationAnalyticsSnapshotSafe,
  getNotificationAnalyticsDimensionLabel,
  listNotificationAnalyticsDimensionCatalog,
  NOTIFICATION_ANALYTICS_DEFAULT,
  NOTIFICATION_ANALYTICS_FUTURE_HOOKS,
  resolveNotificationAnalyticsLogInput
} from "@/src/lib/notifications/notification-analytics-runtime";
export type {
  NotificationAnalyticsBreakdownItem,
  NotificationAnalyticsDimension,
  NotificationAnalyticsLogInput,
  NotificationAnalyticsPeriodKey,
  NotificationAnalyticsPeriodView,
  NotificationAnalyticsRateView,
  NotificationAnalyticsRuntimeStats,
  NotificationAnalyticsSnapshot
} from "@/src/lib/notifications/notification-analytics-runtime";
export {
  buildNotificationHealthRecordsSafe,
  buildNotificationHealthRuntimeStatsSafe,
  buildNotificationHealthSnapshotSafe,
  getNotificationHealthDomainLabel,
  getNotificationHealthStatusLabel,
  listNotificationHealthDomainCatalog,
  mapMonitorStatusToHealthStatus,
  mapProviderHealthToHealthStatus,
  NOTIFICATION_HEALTH_DEFAULT,
  NOTIFICATION_HEALTH_FUTURE_HOOKS,
  sanitizeNotificationHealthMetadata
} from "@/src/lib/notifications/notification-health-runtime";
export type {
  NotificationHealthDomain,
  NotificationHealthRecord,
  NotificationHealthRuntimeStats,
  NotificationHealthSnapshot,
  NotificationHealthStatus
} from "@/src/lib/notifications/notification-health-runtime";
export {
  buildNotificationSecurityCertificationSafe,
  buildNotificationSecurityRecordsSafe,
  buildNotificationSecurityRuntimeStatsSafe,
  collectNotificationSecurityCertificationInput,
  containsNotificationSecuritySecretPattern,
  getNotificationSecurityProtectionStateLabel,
  getNotificationSecuritySurfaceLabel,
  isAllowedNotificationProviderSecretStatus,
  isSafelyMaskedNotificationIpReference,
  isSafelyMaskedNotificationRecipientDisplay,
  isSafelySanitizedNotificationDisplayText,
  listNotificationSecuritySurfaceCatalog,
  maskNotificationSecurityEmailSafe,
  maskNotificationSecurityIdentifierSafe,
  maskNotificationSecurityIpReferenceSafe,
  maskNotificationSecurityPhoneSafe,
  maskNotificationSecurityProviderReferenceSafe,
  maskNotificationSecurityRecipientSafe,
  maskNotificationSecurityUserAgentSafe,
  NOTIFICATION_SECURITY_CERTIFICATION_FALLBACK_SUMMARY,
  NOTIFICATION_SECURITY_FUTURE_HOOKS,
  NOTIFICATION_SECURITY_SECRET_PATTERN,
  sanitizeNotificationAdminDisplayTextSafe,
  sanitizeNotificationSecurityText,
  verifyNotificationSecurityFoundationsPresent
} from "@/src/lib/notifications/notification-security-runtime";
export type {
  NotificationSecurityCertificationSummary,
  NotificationSecurityProtectionState,
  NotificationSecurityRecord,
  NotificationSecurityReviewItem,
  NotificationSecurityRuntimeStats,
  NotificationSecuritySurface
} from "@/src/lib/notifications/notification-security-runtime";

export const NOTIFICATION_REGISTRY_TYPES = [
  "channel",
  "type",
  "log_summary",
  "provider",
  "future_hook",
  "metric"
] as const;

export type NotificationRegistryType = (typeof NOTIFICATION_REGISTRY_TYPES)[number];

export const NOTIFICATION_REGISTRY_CHANNELS = [
  "in_app",
  "email",
  "sms",
  "whatsapp",
  "push",
  "system_alert",
  "system_alerts"
] as const;

export type NotificationRegistryChannel = NotificationChannel | "system_alerts";

export type NotificationRegistryTypeView = {
  badgeTone: import("@/src/lib/notifications/notification-type-runtime").NotificationTypeBadgeTone;
  description: string;
  key: NotificationType;
  label: string;
};

export type NotificationRegistryItemRecord = {
  channel: NotificationChannel;
  configuredState: string;
  createdAt: string | null;
  description: string;
  health: string;
  id: string;
  metadata: Record<string, unknown>;
  name: string;
  notificationCategory: NotificationCategory;
  notificationProvider: NotificationProviderKey;
  notificationTemplateKey: string;
  notificationType: string;
  registryType: NotificationRegistryType;
  secretsState: string;
  slug: string;
  status: NotificationCenterStatus;
  updatedAt: string | null;
  usageCount: number;
};

export type NotificationRegistryChannelView = {
  configuredStatus: "configured" | "missing" | "placeholder";
  healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
  key: NotificationChannel;
  name: string;
  secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
};

export type NotificationRegistryProviderView = {
  configuredStatus: "configured" | "missing" | "placeholder";
  healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
  provider: string;
  secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
};

const registrySelect =
  "id, name, slug, registry_type, channel, notification_type, status, health, configured_state, secrets_state, description, usage_count, metadata, created_at, updated_at";

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|sms|whatsapp|push|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for the notification registry.");
  }

  return admin;
}

function sanitizeRegistryMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const cleanedKey = text(key, 80);
    if (!cleanedKey || secretPattern.test(cleanedKey)) continue;

    if (typeof value === "string") {
      const cleanedValue = text(value, 240);
      if (!cleanedValue || secretPattern.test(cleanedValue)) continue;
      sanitized[cleanedKey] = cleanedValue;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[cleanedKey] = value;
    }
  }

  return sanitized;
}

export function parseNotificationRegistryType(value: unknown): NotificationRegistryType | null {
  const cleaned = text(value, 40);
  return NOTIFICATION_REGISTRY_TYPES.includes(cleaned as NotificationRegistryType)
    ? (cleaned as NotificationRegistryType)
    : null;
}

export function parseNotificationRegistryChannel(value: unknown): NotificationChannel | null {
  return parseNotificationChannel(value);
}

export function parseNotificationRegistryTypeKey(value: unknown): NotificationType | null {
  return parseNotificationType(value);
}

export function parseConfiguredState(value: unknown): NotificationRegistryChannelView["configuredStatus"] {
  const cleaned = text(value, 40);

  if (cleaned === "configured") return "configured";
  if (cleaned === "missing") return "missing";
  return "placeholder";
}

export function parseHealthState(value: unknown): NotificationRegistryChannelView["healthStatus"] {
  const cleaned = text(value, 40);

  if (cleaned === "healthy") return "healthy";
  if (cleaned === "warning") return "warning";
  if (cleaned === "missing_config") return "missing_config";
  return "placeholder";
}

export function parseSecretsState(value: unknown): NotificationRegistryChannelView["secretStatus"] {
  const cleaned = text(value, 40);

  if (cleaned === "masked_configured") return "masked_configured";
  if (cleaned === "masked_partial") return "masked_partial";
  if (cleaned === "no_secret_required") return "no_secret_required";
  return "missing";
}

export function parseNotificationRegistryItem(row: unknown): NotificationRegistryItemRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const slug = text(record.slug, 160);
  const name = text(record.name, 200);
  const registryType = parseNotificationRegistryType(record.registry_type);

  if (!id || !slug || !name || !registryType) {
    return null;
  }

  const metadata = sanitizeRegistryMetadata(safeRecord(record.metadata));
  const notificationType = parseNotificationType(record.notification_type) ?? text(record.notification_type, 80);

  return {
    channel: resolveRegistryNotificationChannelSafe(record.channel),
    configuredState: text(record.configured_state, 80),
    createdAt: text(record.created_at, 80) || null,
    description: text(record.description, 2000),
    health: text(record.health, 80),
    id,
    metadata,
    name,
    notificationCategory: resolveRegistryNotificationCategorySafe({
      metadata,
      name: record.name,
      notificationType: record.notification_type,
      registryType: record.registry_type,
      slug: record.slug
    }),
    notificationProvider: resolveRegistryNotificationProviderSafe({
      channel: record.channel,
      metadata,
      name: record.name,
      registryType: record.registry_type,
      slug: record.slug
    }),
    notificationTemplateKey: parseNotificationTemplateKeySafe(
      metadata.notification_template_key ??
        metadata.template_key ??
        (registryType === "log_summary" ? record.slug : record.notification_type)
    ),
    notificationType,
    registryType,
    secretsState: text(record.secrets_state, 80),
    slug,
    status: parseNotificationRegistryItemStatusSafe(record.status),
    updatedAt: text(record.updated_at, 80) || null,
    usageCount: Math.max(0, Math.trunc(safeNumber(record.usage_count)))
  };
}

export function filterNotificationRegistryItemsByType(
  items: NotificationRegistryItemRecord[],
  registryType: NotificationRegistryType
) {
  return items.filter((item) => item.registryType === registryType);
}

export function buildNotificationRegistryMetadataSummary(item: NotificationRegistryItemRecord) {
  if (item.description) return item.description;
  return "Notification registry foundation only.";
}

export function buildNotificationRegistryChannelsView(
  items: NotificationRegistryItemRecord[]
): NotificationRegistryChannelView[] {
  return filterNotificationRegistryItemsByType(items, "channel")
    .map((item) => {
      const key = parseNotificationRegistryChannel(item.channel);
      if (!key) return null;

      return {
        configuredStatus: parseConfiguredState(item.configuredState),
        healthStatus: parseHealthState(item.health),
        key,
        name: item.name,
        secretStatus: parseSecretsState(item.secretsState)
      };
    })
    .filter((item): item is NotificationRegistryChannelView => Boolean(item));
}

export function buildNotificationRegistryTypesView(
  items: NotificationRegistryItemRecord[]
): NotificationRegistryTypeView[] {
  const registryTypeItems = filterNotificationRegistryItemsByType(items, "type");
  const registryLabelsByType = Object.fromEntries(
    registryTypeItems
      .map((item) => {
        const key = parseNotificationType(item.notificationType);
        return key ? [key, item.name] as const : null;
      })
      .filter((entry): entry is readonly [NotificationType, string] => Boolean(entry))
  ) as Partial<Record<NotificationType, string>>;

  return listNotificationTypeCatalog().map((entry) => ({
    badgeTone: entry.badgeTone,
    description: entry.description,
    key: entry.type,
    label: registryLabelsByType[entry.type] ?? entry.label
  }));
}

export function buildNotificationRegistryProvidersView(
  items: NotificationRegistryItemRecord[]
): NotificationRegistryProviderView[] {
  return filterNotificationRegistryItemsByType(items, "provider").map((item) => ({
    configuredStatus: parseConfiguredState(item.configuredState),
    healthStatus: parseHealthState(item.health),
    provider: item.name,
    secretStatus: parseSecretsState(item.secretsState)
  }));
}

export function buildNotificationRegistryFutureHooksView(items: NotificationRegistryItemRecord[]) {
  return filterNotificationRegistryItemsByType(items, "future_hook").map((item) => item.name);
}

type NotificationRegistryFallbackItem = Omit<
  NotificationRegistryItemRecord,
  "notificationCategory" | "notificationProvider" | "notificationTemplateKey"
>;

function finalizeNotificationRegistryFallbackItem(
  item: NotificationRegistryFallbackItem
): NotificationRegistryItemRecord {
  const notificationTemplateKey = parseNotificationTemplateKeySafe(
    item.registryType === "log_summary" ? item.slug : item.notificationType || item.slug
  );

  return {
    ...item,
    notificationCategory: resolveRegistryNotificationCategorySafe({
      metadata: item.metadata,
      name: item.name,
      notificationType: item.notificationType,
      registryType: item.registryType,
      slug: item.slug
    }),
    notificationProvider: resolveRegistryNotificationProviderSafe({
      channel: item.channel,
      metadata: item.metadata,
      name: item.name,
      registryType: item.registryType,
      slug: item.slug
    }),
    notificationTemplateKey
  };
}

const NOTIFICATION_REGISTRY_FALLBACK_ITEMS_RAW: readonly NotificationRegistryFallbackItem[] = [
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "In-app notification channel foundation.",
    health: "healthy",
    id: "fallback-channel-in-app",
    metadata: { source: "notification_registry_fallback" },
    name: "In-app",
    notificationType: "",
    registryType: "channel",
    secretsState: "no_secret_required",
    slug: "in-app",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "email",
    configuredState: "missing",
    createdAt: null,
    description: "Email notification channel foundation.",
    health: "missing_config",
    id: "fallback-channel-email",
    metadata: { source: "notification_registry_fallback" },
    name: "Email",
    notificationType: "",
    registryType: "channel",
    secretsState: "missing",
    slug: "email",
    status: "missing",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "sms",
    configuredState: "placeholder",
    createdAt: null,
    description: "SMS notification channel placeholder foundation.",
    health: "placeholder",
    id: "fallback-channel-sms",
    metadata: { source: "notification_registry_fallback" },
    name: "SMS placeholder",
    notificationType: "",
    registryType: "channel",
    secretsState: "missing",
    slug: "sms",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "whatsapp",
    configuredState: "placeholder",
    createdAt: null,
    description: "WhatsApp notification channel placeholder foundation.",
    health: "placeholder",
    id: "fallback-channel-whatsapp",
    metadata: { source: "notification_registry_fallback" },
    name: "WhatsApp placeholder",
    notificationType: "",
    registryType: "channel",
    secretsState: "missing",
    slug: "whatsapp",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "push",
    configuredState: "placeholder",
    createdAt: null,
    description: "Push notification channel placeholder foundation.",
    health: "placeholder",
    id: "fallback-channel-push",
    metadata: { source: "notification_registry_fallback" },
    name: "Push placeholder",
    notificationType: "",
    registryType: "channel",
    secretsState: "no_secret_required",
    slug: "push",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "system_alert",
    configuredState: "configured",
    createdAt: null,
    description: "System alerts notification channel foundation.",
    health: "healthy",
    id: "fallback-channel-system-alerts",
    metadata: { source: "notification_registry_fallback" },
    name: "System alerts",
    notificationType: "",
    registryType: "channel",
    secretsState: "no_secret_required",
    slug: "system-alerts",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Billing notification type foundation.",
    health: "healthy",
    id: "fallback-type-billing",
    metadata: { source: "notification_registry_fallback" },
    name: "Billing",
    notificationType: "billing",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "billing",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Security notification type foundation.",
    health: "healthy",
    id: "fallback-type-security",
    metadata: { source: "notification_registry_fallback" },
    name: "Security",
    notificationType: "security",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "security",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Domains notification type foundation.",
    health: "healthy",
    id: "fallback-type-domains",
    metadata: { source: "notification_registry_fallback" },
    name: "Domains",
    notificationType: "domains",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "domains",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Email setup notification type foundation.",
    health: "healthy",
    id: "fallback-type-email-setup",
    metadata: { source: "notification_registry_fallback" },
    name: "Email setup",
    notificationType: "email_setup",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "email-setup",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "AI visuals notification type foundation.",
    health: "healthy",
    id: "fallback-type-ai-visuals",
    metadata: { source: "notification_registry_fallback" },
    name: "AI visuals",
    notificationType: "ai_visuals",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "ai-visuals",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Store publishing notification type foundation.",
    health: "healthy",
    id: "fallback-type-store-publishing",
    metadata: { source: "notification_registry_fallback" },
    name: "Store publishing",
    notificationType: "store_publishing",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "store-publishing",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Support notification type foundation.",
    health: "healthy",
    id: "fallback-type-support",
    metadata: { source: "notification_registry_fallback" },
    name: "Support",
    notificationType: "support",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "support",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "System health notification type foundation.",
    health: "healthy",
    id: "fallback-type-system-health",
    metadata: { source: "notification_registry_fallback" },
    name: "System health",
    notificationType: "system_health",
    registryType: "type",
    secretsState: "no_secret_required",
    slug: "system-health",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "email",
    configuredState: "missing",
    createdAt: null,
    description: "Email provider notification foundation.",
    health: "missing_config",
    id: "fallback-provider-email",
    metadata: { source: "notification_registry_fallback" },
    name: "Email provider",
    notificationType: "",
    registryType: "provider",
    secretsState: "missing",
    slug: "email-provider",
    status: "missing",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "sms",
    configuredState: "placeholder",
    createdAt: null,
    description: "SMS provider notification placeholder foundation.",
    health: "placeholder",
    id: "fallback-provider-sms",
    metadata: { source: "notification_registry_fallback" },
    name: "SMS provider",
    notificationType: "",
    registryType: "provider",
    secretsState: "missing",
    slug: "sms-provider",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "whatsapp",
    configuredState: "placeholder",
    createdAt: null,
    description: "WhatsApp provider notification placeholder foundation.",
    health: "placeholder",
    id: "fallback-provider-whatsapp",
    metadata: { source: "notification_registry_fallback" },
    name: "WhatsApp provider",
    notificationType: "",
    registryType: "provider",
    secretsState: "missing",
    slug: "whatsapp-provider",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "push",
    configuredState: "placeholder",
    createdAt: null,
    description: "Push provider notification placeholder foundation.",
    health: "placeholder",
    id: "fallback-provider-push",
    metadata: { source: "notification_registry_fallback" },
    name: "Push provider",
    notificationType: "",
    registryType: "provider",
    secretsState: "no_secret_required",
    slug: "push-provider",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "In-app low_stock unread log summary foundation.",
    health: "healthy",
    id: "fallback-log-in-app-low-stock",
    metadata: { source: "notification_registry_fallback", summary_key: "in_app:low_stock:unread" },
    name: "In-app low_stock unread",
    notificationType: "low_stock",
    registryType: "log_summary",
    secretsState: "no_secret_required",
    slug: "in-app-low-stock-unread",
    status: "unread",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "email",
    configuredState: "configured",
    createdAt: null,
    description: "Email review_request queued log summary foundation.",
    health: "healthy",
    id: "fallback-log-email-review-request",
    metadata: { source: "notification_registry_fallback", summary_key: "email:review_request:queued" },
    name: "Email review_request queued",
    notificationType: "review_request",
    registryType: "log_summary",
    secretsState: "no_secret_required",
    slug: "email-review-request-queued",
    status: "queued",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "email",
    configuredState: "configured",
    createdAt: null,
    description: "Email thank_you queued log summary foundation.",
    health: "healthy",
    id: "fallback-log-email-thank-you",
    metadata: { source: "notification_registry_fallback", summary_key: "email:thank_you:queued" },
    name: "Email thank_you queued",
    notificationType: "thank_you",
    registryType: "log_summary",
    secretsState: "no_secret_required",
    slug: "email-thank-you-queued",
    status: "queued",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "configured",
    createdAt: null,
    description: "Retry failed notification future hook placeholder.",
    health: "healthy",
    id: "fallback-hook-retry-failed",
    metadata: { source: "notification_registry_fallback" },
    name: "Retry failed notification",
    notificationType: "",
    registryType: "future_hook",
    secretsState: "no_secret_required",
    slug: "retry-failed-notification",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "placeholder",
    createdAt: null,
    description: "Configure channels future hook placeholder.",
    health: "placeholder",
    id: "fallback-hook-configure-channels",
    metadata: { source: "notification_registry_fallback" },
    name: "Configure channels",
    notificationType: "",
    registryType: "future_hook",
    secretsState: "no_secret_required",
    slug: "configure-channels",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "placeholder",
    createdAt: null,
    description: "Send test notification future hook placeholder.",
    health: "placeholder",
    id: "fallback-hook-send-test",
    metadata: { source: "notification_registry_fallback" },
    name: "Send test notification",
    notificationType: "",
    registryType: "future_hook",
    secretsState: "no_secret_required",
    slug: "send-test-notification",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "placeholder",
    createdAt: null,
    description: "Export notification logs future hook placeholder.",
    health: "placeholder",
    id: "fallback-hook-export-logs",
    metadata: { source: "notification_registry_fallback" },
    name: "Export notification logs",
    notificationType: "",
    registryType: "future_hook",
    secretsState: "no_secret_required",
    slug: "export-notification-logs",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    channel: "in_app",
    configuredState: "placeholder",
    createdAt: null,
    description: "Notification template editor future hook placeholder.",
    health: "placeholder",
    id: "fallback-hook-template-editor",
    metadata: { source: "notification_registry_fallback" },
    name: "Notification template editor",
    notificationType: "",
    registryType: "future_hook",
    secretsState: "no_secret_required",
    slug: "notification-template-editor",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  }
];

export const NOTIFICATION_REGISTRY_FALLBACK_ITEMS: readonly NotificationRegistryItemRecord[] =
  NOTIFICATION_REGISTRY_FALLBACK_ITEMS_RAW.map(finalizeNotificationRegistryFallbackItem);

export async function listNotificationRegistryItemsReadOnly(): Promise<NotificationRegistryItemRecord[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("notification_registry_items" as never)
    .select(registrySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Notification registry items could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseNotificationRegistryItem(row))
    .filter((item): item is NotificationRegistryItemRecord => Boolean(item));
}

export async function listNotificationRegistryItemsReadOnlySafe(): Promise<{
  items: NotificationRegistryItemRecord[];
  source: "database" | "fallback";
  warning: string | null;
}> {
  try {
    const items = await listNotificationRegistryItemsReadOnly();

    if (!items.length) {
      return {
        items: [...NOTIFICATION_REGISTRY_FALLBACK_ITEMS],
        source: "fallback",
        warning: "Notification registry table is empty. Showing fallback registry rows."
      };
    }

    return {
      items,
      source: "database",
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[notification-registry-runtime] read-only registry load failed", error);

    return {
      items: [...NOTIFICATION_REGISTRY_FALLBACK_ITEMS],
      source: "fallback",
      warning: message
    };
  }
}

export function buildNotificationRegistryViewsSafe(params: {
  items: NotificationRegistryItemRecord[] | null | undefined;
}) {
  try {
    const items =
      Array.isArray(params.items) && params.items.length ? params.items : [...NOTIFICATION_REGISTRY_FALLBACK_ITEMS];

    return {
      channels: buildNotificationRegistryChannelsView(items),
      futureHooks: buildNotificationRegistryFutureHooksView(items),
      providers: buildNotificationRegistryProvidersView(items),
      types: buildNotificationRegistryTypesView(items),
      warning: null as string | null
    };
  } catch (error) {
    console.error("[notification-registry-runtime] registry view build failed", error);

    const fallbackItems = [...NOTIFICATION_REGISTRY_FALLBACK_ITEMS];

    return {
      channels: buildNotificationRegistryChannelsView(fallbackItems),
      futureHooks: buildNotificationRegistryFutureHooksView(fallbackItems),
      providers: buildNotificationRegistryProvidersView(fallbackItems),
      types: buildNotificationRegistryTypesView(fallbackItems),
      warning: "Notification registry views could not be built safely. Showing fallback registry rows."
    };
  }
}
