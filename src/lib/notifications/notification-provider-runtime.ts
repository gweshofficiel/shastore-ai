import "server-only";

import {
  parseNotificationChannel,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";

export type NotificationProviderKey =
  | "email_provider"
  | "internal_in_app"
  | "push_provider_placeholder"
  | "sms_provider_placeholder"
  | "system_alert_provider"
  | "whatsapp_provider_placeholder";

export type NotificationProviderType = "active" | "internal" | "placeholder";

export type NotificationProviderConfiguredStatus = "configured" | "missing" | "partial" | "placeholder";

export type NotificationProviderHealthStatus = "healthy" | "missing_config" | "placeholder" | "warning";

export type NotificationProviderSecretStatus =
  | "masked_configured"
  | "masked_partial"
  | "missing"
  | "no_secret_required";

export type NotificationProviderCatalogEntry = {
  description: string;
  label: string;
  placeholderOnly: boolean;
  providerKey: NotificationProviderKey;
  providerType: NotificationProviderType;
};

export type NotificationProviderView = {
  configuredStatus: NotificationProviderConfiguredStatus;
  description: string;
  healthStatus: NotificationProviderHealthStatus;
  metadataSummary: string;
  placeholderOnly: boolean;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  providerType: NotificationProviderType;
  registryLabel: string;
  secretStatus: NotificationProviderSecretStatus;
};

export type NotificationProviderStats = {
  activeProviders: number;
  emailProviders: number;
  internalInAppProviders: number;
  placeholderProviders: number;
  pushPlaceholderProviders: number;
  smsPlaceholderProviders: number;
  systemAlertProviders: number;
  totalProviders: number;
  whatsappPlaceholderProviders: number;
};

export type NotificationRegistryProviderSnapshot = {
  channel: NotificationChannel;
  configuredState: string;
  description: string;
  health: string;
  metadata: Record<string, unknown>;
  name: string;
  secretsState: string;
  slug: string;
};

export const NOTIFICATION_PROVIDER_KEYS: readonly NotificationProviderKey[] = [
  "internal_in_app",
  "email_provider",
  "sms_provider_placeholder",
  "whatsapp_provider_placeholder",
  "push_provider_placeholder",
  "system_alert_provider"
] as const;

export const NOTIFICATION_PLACEHOLDER_PROVIDER_KEYS: readonly NotificationProviderKey[] = [
  "sms_provider_placeholder",
  "whatsapp_provider_placeholder",
  "push_provider_placeholder"
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|sms|whatsapp|push|provider[_-]?config|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

const providerCatalog: Record<
  NotificationProviderKey,
  Omit<NotificationProviderCatalogEntry, "providerKey">
> = {
  email_provider: {
    description: "Email notification provider foundation with masked configuration state only.",
    label: "Email provider",
    placeholderOnly: false,
    providerType: "active"
  },
  internal_in_app: {
    description: "Internal in-app notification provider foundation. No external credentials required.",
    label: "Internal in-app",
    placeholderOnly: false,
    providerType: "internal"
  },
  push_provider_placeholder: {
    description: "Push notification provider placeholder foundation. No push delivery connected.",
    label: "Push provider placeholder",
    placeholderOnly: true,
    providerType: "placeholder"
  },
  sms_provider_placeholder: {
    description: "SMS notification provider placeholder foundation. No SMS delivery connected.",
    label: "SMS provider placeholder",
    placeholderOnly: true,
    providerType: "placeholder"
  },
  system_alert_provider: {
    description: "System alert notification provider foundation for platform monitoring summaries.",
    label: "System alert provider",
    placeholderOnly: false,
    providerType: "internal"
  },
  whatsapp_provider_placeholder: {
    description: "WhatsApp notification provider placeholder foundation. No WhatsApp delivery connected.",
    label: "WhatsApp provider placeholder",
    placeholderOnly: true,
    providerType: "placeholder"
  }
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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function envVarPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envConfigurationStatus(names: readonly string[]): NotificationProviderConfiguredStatus {
  if (!names.length) {
    return "configured";
  }

  const configuredCount = names.filter((name) => envVarPresent(name)).length;

  if (configuredCount === names.length) {
    return "configured";
  }

  return configuredCount > 0 ? "partial" : "missing";
}

function integrationSecretStatus(names: readonly string[]): NotificationProviderSecretStatus {
  const status = envConfigurationStatus(names);

  if (!names.length) {
    return "no_secret_required";
  }

  if (status === "configured") {
    return "masked_configured";
  }

  return status === "partial" ? "masked_partial" : "missing";
}

function normalizeNotificationProviderToken(value: unknown) {
  const cleaned = text(value, 120).toLowerCase().replace(/[\s-]+/g, "_");

  if (!cleaned) return "";
  if (cleaned === "email" || cleaned === "email_provider" || cleaned === "resend") return "email_provider";
  if (cleaned === "in_app" || cleaned === "inapp" || cleaned === "internal_in_app" || cleaned === "internal") {
    return "internal_in_app";
  }
  if (cleaned === "sms" || cleaned === "sms_provider" || cleaned === "sms_provider_placeholder") {
    return "sms_provider_placeholder";
  }
  if (cleaned === "whatsapp" || cleaned === "whatsapp_provider" || cleaned === "whatsapp_provider_placeholder") {
    return "whatsapp_provider_placeholder";
  }
  if (cleaned === "push" || cleaned === "push_provider" || cleaned === "push_provider_placeholder") {
    return "push_provider_placeholder";
  }
  if (
    cleaned === "system_alert" ||
    cleaned === "system_alerts" ||
    cleaned === "system_alert_provider" ||
    cleaned === "system"
  ) {
    return "system_alert_provider";
  }

  return cleaned;
}

export function isValidNotificationProviderKey(value: unknown): value is NotificationProviderKey {
  const normalized = normalizeNotificationProviderToken(value);
  return Boolean(normalized && NOTIFICATION_PROVIDER_KEYS.includes(normalized as NotificationProviderKey));
}

export function parseNotificationProviderKey(value: unknown): NotificationProviderKey | null {
  const normalized = normalizeNotificationProviderToken(value);
  return isValidNotificationProviderKey(normalized) ? normalized : null;
}

export function parseNotificationProviderKeySafe(value: unknown): NotificationProviderKey {
  return parseNotificationProviderKey(value) ?? "internal_in_app";
}

export function mapNotificationChannelToProvider(channel: NotificationChannel): NotificationProviderKey {
  if (channel === "email") return "email_provider";
  if (channel === "sms") return "sms_provider_placeholder";
  if (channel === "whatsapp") return "whatsapp_provider_placeholder";
  if (channel === "push") return "push_provider_placeholder";
  if (channel === "system_alert") return "system_alert_provider";
  return "internal_in_app";
}

export function isNotificationPlaceholderProvider(providerKey: NotificationProviderKey) {
  return NOTIFICATION_PLACEHOLDER_PROVIDER_KEYS.includes(providerKey);
}

export function getNotificationProviderLabel(providerKey: NotificationProviderKey) {
  return providerCatalog[providerKey].label;
}

export function getNotificationProviderDescription(providerKey: NotificationProviderKey) {
  return providerCatalog[providerKey].description;
}

export function getNotificationProviderType(providerKey: NotificationProviderKey): NotificationProviderType {
  return providerCatalog[providerKey].providerType;
}

export function resolveNotificationProviderLabel(value: unknown) {
  const providerKey = parseNotificationProviderKey(value);
  return providerKey ? getNotificationProviderLabel(providerKey) : getNotificationProviderLabel("internal_in_app");
}

export function listNotificationProviderCatalog(): NotificationProviderCatalogEntry[] {
  return NOTIFICATION_PROVIDER_KEYS.map((providerKey) => ({
    ...providerCatalog[providerKey],
    providerKey
  }));
}

export function sanitizeNotificationProviderMetadata(metadata: Record<string, unknown>) {
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

export function buildNotificationProviderMetadataSummary(params: {
  description?: string;
  metadata?: Record<string, unknown>;
  providerKey: NotificationProviderKey;
}) {
  const metadata = sanitizeNotificationProviderMetadata(safeRecord(params.metadata));
  const source = text(metadata.source, 120);

  if (source) {
    return `Registry source: ${source}. Notification provider foundation only.`;
  }

  if (params.description) {
    return text(params.description, 500);
  }

  return getNotificationProviderDescription(params.providerKey);
}

export function resolveRegistryNotificationProviderSafe(params: {
  channel?: unknown;
  metadata?: Record<string, unknown>;
  name?: unknown;
  registryType?: unknown;
  slug?: unknown;
}): NotificationProviderKey {
  const metadata = safeRecord(params.metadata);
  const metadataProvider = parseNotificationProviderKey(
    metadata.notification_provider ?? metadata.provider_key ?? metadata.provider
  );
  if (metadataProvider) return metadataProvider;

  const slug = text(params.slug, 160).toLowerCase();
  if (slug.includes("email-provider") || slug === "email") return "email_provider";
  if (slug.includes("sms-provider") || slug === "sms") return "sms_provider_placeholder";
  if (slug.includes("whatsapp-provider") || slug === "whatsapp") return "whatsapp_provider_placeholder";
  if (slug.includes("push-provider") || slug === "push") return "push_provider_placeholder";
  if (slug.includes("system-alert") || slug.includes("system-alerts")) return "system_alert_provider";

  if (text(params.registryType, 80) === "provider") {
    const fromSlug = parseNotificationProviderKey(slug.replace(/-/g, "_"));
    if (fromSlug) return fromSlug;
  }

  const channel = parseNotificationChannel(params.channel);
  if (channel) {
    return mapNotificationChannelToProvider(channel);
  }

  const name = text(params.name, 200).toLowerCase();
  if (name.includes("email provider")) return "email_provider";
  if (name.includes("sms provider")) return "sms_provider_placeholder";
  if (name.includes("whatsapp provider")) return "whatsapp_provider_placeholder";
  if (name.includes("push provider")) return "push_provider_placeholder";
  if (name.includes("system alert")) return "system_alert_provider";

  return "internal_in_app";
}

function parseConfiguredState(value: unknown): NotificationProviderConfiguredStatus {
  const cleaned = text(value, 40);

  if (cleaned === "configured") return "configured";
  if (cleaned === "missing") return "missing";
  if (cleaned === "partial") return "partial";
  return "placeholder";
}

function parseHealthState(value: unknown): NotificationProviderHealthStatus {
  const cleaned = text(value, 40);

  if (cleaned === "healthy") return "healthy";
  if (cleaned === "warning") return "warning";
  if (cleaned === "missing_config") return "missing_config";
  return "placeholder";
}

function parseSecretsState(value: unknown): NotificationProviderSecretStatus {
  const cleaned = text(value, 40);

  if (cleaned === "masked_configured") return "masked_configured";
  if (cleaned === "masked_partial") return "masked_partial";
  if (cleaned === "no_secret_required") return "no_secret_required";
  return "missing";
}

export function resolveNotificationProviderStatusSafe(providerKey: NotificationProviderKey): Pick<
  NotificationProviderView,
  "configuredStatus" | "healthStatus" | "secretStatus"
> {
  if (providerKey === "email_provider") {
    const resendSelected = process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend";
    const requiredEnv = ["RESEND_API_KEY", "EMAIL_FROM"] as const;
    const configuredStatus = resendSelected ? envConfigurationStatus(requiredEnv) : "missing";

    return {
      configuredStatus,
      healthStatus:
        resendSelected && envVarPresent("RESEND_API_KEY") && envVarPresent("EMAIL_FROM")
          ? "healthy"
          : "missing_config",
      secretStatus: resendSelected ? integrationSecretStatus(requiredEnv) : "missing"
    };
  }

  if (providerKey === "internal_in_app" || providerKey === "system_alert_provider") {
    return {
      configuredStatus: "configured",
      healthStatus: "healthy",
      secretStatus: "no_secret_required"
    };
  }

  return {
    configuredStatus: "placeholder",
    healthStatus: "placeholder",
    secretStatus: "missing"
  };
}

function defaultProviderView(providerKey: NotificationProviderKey): NotificationProviderView {
  const catalog = providerCatalog[providerKey];
  const status = resolveNotificationProviderStatusSafe(providerKey);

  return {
    ...status,
    description: catalog.description,
    metadataSummary: catalog.description,
    placeholderOnly: catalog.placeholderOnly,
    providerKey,
    providerLabel: catalog.label,
    providerType: catalog.providerType,
    registryLabel: catalog.label
  };
}

export function buildNotificationProviderRuntimeRecordSafe(
  snapshot: NotificationRegistryProviderSnapshot
): NotificationProviderView {
  try {
    const providerKey = resolveRegistryNotificationProviderSafe({
      channel: snapshot.channel,
      metadata: snapshot.metadata,
      name: snapshot.name,
      registryType: "provider",
      slug: snapshot.slug
    });
    const catalog = providerCatalog[providerKey];
    const envStatus = resolveNotificationProviderStatusSafe(providerKey);
    const registryConfigured = parseConfiguredState(snapshot.configuredState);
    const registryHealth = parseHealthState(snapshot.health);
    const registrySecrets = parseSecretsState(snapshot.secretsState);

    const configuredStatus = catalog.placeholderOnly
      ? "placeholder"
      : providerKey === "email_provider"
        ? envStatus.configuredStatus
        : registryConfigured;
    const healthStatus = catalog.placeholderOnly
      ? "placeholder"
      : providerKey === "email_provider"
        ? envStatus.healthStatus
        : registryHealth;
    const secretStatus = catalog.placeholderOnly
      ? "missing"
      : providerKey === "email_provider"
        ? envStatus.secretStatus
        : registrySecrets;

    return {
      configuredStatus,
      description: text(snapshot.description, 2000) || catalog.description,
      healthStatus,
      metadataSummary: buildNotificationProviderMetadataSummary({
        description: snapshot.description,
        metadata: snapshot.metadata,
        providerKey
      }),
      placeholderOnly: catalog.placeholderOnly,
      providerKey,
      providerLabel: catalog.label,
      providerType: catalog.providerType,
      registryLabel: text(snapshot.name, 200) || catalog.label,
      secretStatus
    };
  } catch (error) {
    console.error("[notification-provider-runtime] provider record build failed", error);
    return defaultProviderView("internal_in_app");
  }
}

export function buildNotificationProviderAdminViews(params: {
  registryProviders?: NotificationRegistryProviderSnapshot[] | null;
  monitoringHasFailed?: boolean;
}): NotificationProviderView[] {
  const registryByProvider = new Map<NotificationProviderKey, NotificationRegistryProviderSnapshot>();

  for (const entry of params.registryProviders ?? []) {
    const providerKey = resolveRegistryNotificationProviderSafe({
      channel: entry.channel,
      metadata: entry.metadata,
      name: entry.name,
      registryType: "provider",
      slug: entry.slug
    });
    registryByProvider.set(providerKey, entry);
  }

  return NOTIFICATION_PROVIDER_KEYS.map((providerKey) => {
    const registry = registryByProvider.get(providerKey);
    const view = registry ? buildNotificationProviderRuntimeRecordSafe(registry) : defaultProviderView(providerKey);

    if (providerKey === "system_alert_provider" && params.monitoringHasFailed) {
      return {
        ...view,
        healthStatus: "warning"
      };
    }

    return view;
  });
}

export function buildNotificationProviderViewsSafe(params: {
  monitoringHasFailed?: boolean;
  registryProviders?: NotificationRegistryProviderSnapshot[] | null;
}): { providers: NotificationProviderView[]; warning: string | null } {
  try {
    return {
      providers: buildNotificationProviderAdminViews(params),
      warning: null
    };
  } catch (error) {
    console.error("[notification-provider-runtime] provider views build failed", error);

    return {
      providers: NOTIFICATION_PROVIDER_KEYS.map((providerKey) => defaultProviderView(providerKey)),
      warning: "Notification provider views could not be built safely. Showing fallback provider rows."
    };
  }
}

export function buildNotificationProviderStatsSafe(
  providers: NotificationProviderView[] | null | undefined
): NotificationProviderStats {
  try {
    const snapshots = Array.isArray(providers) ? providers : [];

    return {
      activeProviders: snapshots.filter((provider) => provider.providerType === "active").length,
      emailProviders: snapshots.filter((provider) => provider.providerKey === "email_provider").length,
      internalInAppProviders: snapshots.filter((provider) => provider.providerKey === "internal_in_app").length,
      placeholderProviders: snapshots.filter((provider) => provider.placeholderOnly).length,
      pushPlaceholderProviders: snapshots.filter((provider) => provider.providerKey === "push_provider_placeholder")
        .length,
      smsPlaceholderProviders: snapshots.filter((provider) => provider.providerKey === "sms_provider_placeholder")
        .length,
      systemAlertProviders: snapshots.filter((provider) => provider.providerKey === "system_alert_provider").length,
      totalProviders: snapshots.length,
      whatsappPlaceholderProviders: snapshots.filter(
        (provider) => provider.providerKey === "whatsapp_provider_placeholder"
      ).length
    };
  } catch (error) {
    console.error("[notification-provider-runtime] provider stats build failed", error);

    return {
      activeProviders: 0,
      emailProviders: 0,
      internalInAppProviders: 0,
      placeholderProviders: 0,
      pushPlaceholderProviders: 0,
      smsPlaceholderProviders: 0,
      systemAlertProviders: 0,
      totalProviders: 0,
      whatsappPlaceholderProviders: 0
    };
  }
}

export function buildNotificationRegistryProviderStatsSafe(
  items: Array<{ notificationProvider: NotificationProviderKey }> | null | undefined
): NotificationProviderStats {
  try {
    const providers = Array.isArray(items)
      ? items.map((item) => defaultProviderView(item.notificationProvider))
      : [];

    return buildNotificationProviderStatsSafe(providers);
  } catch (error) {
    console.error("[notification-provider-runtime] registry provider stats failed", error);

    return {
      activeProviders: 0,
      emailProviders: 0,
      internalInAppProviders: 0,
      placeholderProviders: 0,
      pushPlaceholderProviders: 0,
      smsPlaceholderProviders: 0,
      systemAlertProviders: 0,
      totalProviders: 0,
      whatsappPlaceholderProviders: 0
    };
  }
}

// NT-7+ placeholders: provider health checks, failover routing, and live credential validation stay disconnected.
export const NOTIFICATION_PROVIDER_FUTURE_HOOKS = [
  "notification_provider_health_check",
  "notification_provider_failover_routing",
  "notification_provider_credential_validation"
] as const;
