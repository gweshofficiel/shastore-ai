import "server-only";

import {
  getNotificationChannelLabel,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import type { NotificationMonitoringRecord } from "@/src/lib/notifications/notification-monitoring-runtime";
import {
  buildNotificationProviderMetadataSummary,
  getNotificationProviderDescription,
  getNotificationProviderLabel,
  isNotificationPlaceholderProvider,
  NOTIFICATION_PROVIDER_KEYS,
  resolveRegistryNotificationProviderSafe,
  type NotificationProviderConfiguredStatus,
  type NotificationProviderHealthStatus,
  type NotificationProviderKey,
  type NotificationProviderSecretStatus,
  type NotificationProviderView,
  type NotificationRegistryProviderSnapshot
} from "@/src/lib/notifications/notification-provider-runtime";
import { sanitizeNotificationAdminDisplayTextSafe } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationProviderAbstractionStatus =
  | "active_foundation"
  | "inactive"
  | "internal"
  | "missing_config"
  | "placeholder";

export type NotificationProviderCapabilityFlag =
  | "credential_validation_disabled"
  | "delivery_disabled"
  | "external_api_disabled"
  | "health_check_read_only"
  | "placeholder_only"
  | "queue_processing_disabled"
  | "send_disabled"
  | "test_send_disabled";

export type NotificationProviderAbstractionRecord = {
  abstractionId: string;
  capabilityFlags: NotificationProviderCapabilityFlag[];
  capabilitySummary: string;
  configSummary: string;
  createdAt: string | null;
  healthReference: string;
  placeholderOnly: boolean;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  providerStatus: NotificationProviderAbstractionStatus;
  providerStatusLabel: string;
  safeSummary: string;
  secretStatus: NotificationProviderSecretStatus;
  supportedChannel: NotificationChannel;
  supportedChannelLabel: string;
  updatedAt: string | null;
};

export type NotificationProviderAbstractionRuntimeStats = {
  activeFoundationProviders: number;
  inactiveProviders: number;
  internalProviders: number;
  missingConfigProviders: number;
  placeholderProviders: number;
  totalAbstractions: number;
};

export type NotificationProviderAbstractionSummary = {
  externalProvidersCalled: false;
  foundationOnly: true;
  policyDescription: string;
  safeSummary: string;
  sendsDisabled: true;
};

export const NOTIFICATION_PROVIDER_ABSTRACTION_FALLBACK_ID = "unknown_notification_provider_abstraction" as const;

export const NOTIFICATION_PROVIDER_CAPABILITY_FLAGS: readonly NotificationProviderCapabilityFlag[] = [
  "send_disabled",
  "test_send_disabled",
  "external_api_disabled",
  "queue_processing_disabled",
  "credential_validation_disabled",
  "delivery_disabled",
  "health_check_read_only",
  "placeholder_only"
] as const;

const abstractionStatusLabels: Record<NotificationProviderAbstractionStatus, string> = {
  active_foundation: "Active foundation",
  inactive: "Inactive",
  internal: "Internal",
  missing_config: "Missing config",
  placeholder: "Placeholder"
};

const baseCapabilityFlags: NotificationProviderCapabilityFlag[] = [
  "send_disabled",
  "test_send_disabled",
  "external_api_disabled",
  "queue_processing_disabled",
  "credential_validation_disabled",
  "delivery_disabled"
];

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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function mapNotificationProviderToChannel(providerKey: NotificationProviderKey): NotificationChannel {
  switch (providerKey) {
    case "email_provider":
      return "email";
    case "sms_provider_placeholder":
      return "sms";
    case "whatsapp_provider_placeholder":
      return "whatsapp";
    case "push_provider_placeholder":
      return "push";
    case "system_alert_provider":
      return "system_alert";
    default:
      return "in_app";
  }
}

export function getNotificationProviderAbstractionStatusLabel(status: NotificationProviderAbstractionStatus) {
  return abstractionStatusLabels[status];
}

export function resolveNotificationProviderAbstractionStatusSafe(params: {
  configuredStatus: NotificationProviderConfiguredStatus;
  healthStatus: NotificationProviderHealthStatus;
  placeholderOnly: boolean;
  providerKey: NotificationProviderKey;
  providerType: NotificationProviderView["providerType"];
}): NotificationProviderAbstractionStatus {
  if (params.placeholderOnly || isNotificationPlaceholderProvider(params.providerKey)) {
    return "placeholder";
  }

  if (params.providerType === "internal") {
    return "internal";
  }

  if (params.configuredStatus === "missing" || params.healthStatus === "missing_config") {
    return "missing_config";
  }

  if (params.providerType === "active") {
    return "active_foundation";
  }

  return "inactive";
}

export function resolveNotificationProviderCapabilityFlagsSafe(params: {
  placeholderOnly: boolean;
  providerKey: NotificationProviderKey;
  providerType: NotificationProviderView["providerType"];
}): NotificationProviderCapabilityFlag[] {
  const flags = [...baseCapabilityFlags];

  if (params.placeholderOnly || isNotificationPlaceholderProvider(params.providerKey)) {
    flags.push("placeholder_only");
  }

  if (params.providerType === "internal" || params.providerKey === "system_alert_provider") {
    flags.push("health_check_read_only");
  }

  return flags;
}

function buildCapabilitySummary(flags: NotificationProviderCapabilityFlag[]) {
  return sanitizeNotificationAdminDisplayTextSafe(
    flags
      .map((flag) => flag.replace(/_/g, " "))
      .join(", ")
      .concat(". No send, test, queue, retry, credential validation, or external provider execution connected."),
    240
  );
}

function buildSafeConfigSummary(params: {
  metadata?: Record<string, unknown>;
  provider: NotificationProviderView;
}) {
  const secretLabel =
    params.provider.secretStatus === "masked_configured"
      ? "Masked credentials configured."
      : params.provider.secretStatus === "masked_partial"
        ? "Masked credentials partially configured."
        : params.provider.secretStatus === "no_secret_required"
          ? "No provider secrets required."
          : "Provider secrets missing or placeholder only.";

  const configuredLabel = `Configured state: ${params.provider.configuredStatus}.`;
  const healthLabel = `Health state: ${params.provider.healthStatus}.`;

  return sanitizeNotificationAdminDisplayTextSafe(
    [
      secretLabel,
      configuredLabel,
      healthLabel,
      buildNotificationProviderMetadataSummary({
        description: params.provider.description,
        metadata: params.metadata,
        providerKey: params.provider.providerKey
      })
    ].join(" "),
    240
  );
}

function resolveHealthReference(params: {
  monitoringItems: NotificationMonitoringRecord[];
  providerKey: NotificationProviderKey;
  supportedChannel: NotificationChannel;
}) {
  const monitor =
    params.monitoringItems.find((item) => item.providerKey === params.providerKey) ??
    params.monitoringItems.find((item) => item.channel === params.supportedChannel);

  if (!monitor) {
    return `monitor:${params.supportedChannel}:placeholder`;
  }

  return sanitizeNotificationAdminDisplayTextSafe(monitor.monitorId, 120) || `monitor:${params.supportedChannel}`;
}

function resolveRegistryTimestamp(metadata: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 80);
    if (value) {
      return value;
    }
  }

  return null;
}

function buildAbstractionSafeSummary(params: {
  capabilityFlags: NotificationProviderCapabilityFlag[];
  provider: NotificationProviderView;
  providerStatus: NotificationProviderAbstractionStatus;
  supportedChannel: NotificationChannel;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `${getNotificationProviderLabel(params.provider.providerKey)} abstraction for ${getNotificationChannelLabel(params.supportedChannel)}.`,
      `${getNotificationProviderAbstractionStatusLabel(params.providerStatus)} provider foundation only.`,
      params.provider.placeholderOnly
        ? "Placeholder provider implementation remains inactive."
        : "Provider implementation remains inactive with read-only masked configuration visibility.",
      buildCapabilitySummary(params.capabilityFlags)
    ].join(" "),
    240
  );
}

function buildAbstractionRecordFromProvider(params: {
  monitoringItems: NotificationMonitoringRecord[];
  provider: NotificationProviderView;
  registry?: NotificationRegistryProviderSnapshot | null;
}): NotificationProviderAbstractionRecord {
  const supportedChannel = mapNotificationProviderToChannel(params.provider.providerKey);
  const metadata = safeRecord(params.registry?.metadata);
  const providerStatus = resolveNotificationProviderAbstractionStatusSafe({
    configuredStatus: params.provider.configuredStatus,
    healthStatus: params.provider.healthStatus,
    placeholderOnly: params.provider.placeholderOnly,
    providerKey: params.provider.providerKey,
    providerType: params.provider.providerType
  });
  const capabilityFlags = resolveNotificationProviderCapabilityFlagsSafe({
    placeholderOnly: params.provider.placeholderOnly,
    providerKey: params.provider.providerKey,
    providerType: params.provider.providerType
  });

  return {
    abstractionId: `provider-abstraction:${params.provider.providerKey}`,
    capabilityFlags,
    capabilitySummary: buildCapabilitySummary(capabilityFlags),
    configSummary: buildSafeConfigSummary({
      metadata,
      provider: params.provider
    }),
    createdAt: resolveRegistryTimestamp(metadata, ["created_at", "createdAt"]),
    healthReference: resolveHealthReference({
      monitoringItems: params.monitoringItems,
      providerKey: params.provider.providerKey,
      supportedChannel
    }),
    placeholderOnly: params.provider.placeholderOnly,
    providerKey: params.provider.providerKey,
    providerLabel: params.provider.providerLabel,
    providerStatus,
    providerStatusLabel: getNotificationProviderAbstractionStatusLabel(providerStatus),
    safeSummary: buildAbstractionSafeSummary({
      capabilityFlags,
      provider: params.provider,
      providerStatus,
      supportedChannel
    }),
    secretStatus: params.provider.secretStatus,
    supportedChannel,
    supportedChannelLabel: getNotificationChannelLabel(supportedChannel),
    updatedAt: resolveRegistryTimestamp(metadata, ["updated_at", "updatedAt"])
  };
}

export function buildNotificationProviderAbstractionFallbackRecordSafe(): NotificationProviderAbstractionRecord {
  const providerKey: NotificationProviderKey = "internal_in_app";
  const supportedChannel = mapNotificationProviderToChannel(providerKey);
  const capabilityFlags = resolveNotificationProviderCapabilityFlagsSafe({
    placeholderOnly: false,
    providerKey,
    providerType: "internal"
  });

  return {
    abstractionId: NOTIFICATION_PROVIDER_ABSTRACTION_FALLBACK_ID,
    capabilityFlags,
    capabilitySummary: buildCapabilitySummary(capabilityFlags),
    configSummary: "Provider abstraction fallback. No credentials, configs, or raw payloads exposed.",
    createdAt: null,
    healthReference: `monitor:${supportedChannel}:unknown`,
    placeholderOnly: false,
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    providerStatus: "inactive",
    providerStatusLabel: getNotificationProviderAbstractionStatusLabel("inactive"),
    safeSummary:
      "Notification provider abstraction fallback only. No provider send, test, queue, or external API paths connected.",
    secretStatus: "no_secret_required",
    supportedChannel,
    supportedChannelLabel: getNotificationChannelLabel(supportedChannel),
    updatedAt: null
  };
}

export function buildNotificationProviderAbstractionRecordsSafe(params: {
  monitoringItems?: NotificationMonitoringRecord[] | null;
  providers?: NotificationProviderView[] | null;
  registryProviders?: NotificationRegistryProviderSnapshot[] | null;
}): { providerAbstractionItems: NotificationProviderAbstractionRecord[]; warning: string | null } {
  try {
    const providers = Array.isArray(params.providers) ? params.providers : [];
    const monitoringItems = Array.isArray(params.monitoringItems) ? params.monitoringItems : [];
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

    const sourceProviders = providers.length
      ? providers
      : NOTIFICATION_PROVIDER_KEYS.map(
          (providerKey) =>
            ({
              configuredStatus: "placeholder",
              description: getNotificationProviderDescription(providerKey),
              healthStatus: "placeholder",
              metadataSummary: getNotificationProviderDescription(providerKey),
              placeholderOnly: isNotificationPlaceholderProvider(providerKey),
              providerKey,
              providerLabel: getNotificationProviderLabel(providerKey),
              providerType: isNotificationPlaceholderProvider(providerKey) ? "placeholder" : "internal",
              registryLabel: getNotificationProviderLabel(providerKey),
              secretStatus: "missing"
            }) satisfies NotificationProviderView
        );

    const providerAbstractionItems = sourceProviders.map((provider) =>
      buildAbstractionRecordFromProvider({
        monitoringItems,
        provider,
        registry: registryByProvider.get(provider.providerKey)
      })
    );

    return {
      providerAbstractionItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-provider-abstraction-runtime] provider abstraction records build failed", error);

    return {
      providerAbstractionItems: [buildNotificationProviderAbstractionFallbackRecordSafe()],
      warning: "Notification provider abstraction runtime fallback applied."
    };
  }
}

export function buildNotificationProviderAbstractionRuntimeStatsSafe(
  providerAbstractionItems: NotificationProviderAbstractionRecord[] | null | undefined
): NotificationProviderAbstractionRuntimeStats {
  try {
    const items = Array.isArray(providerAbstractionItems) ? providerAbstractionItems : [];

    return {
      activeFoundationProviders: items.filter((item) => item.providerStatus === "active_foundation").length,
      inactiveProviders: items.filter((item) => item.providerStatus === "inactive").length,
      internalProviders: items.filter((item) => item.providerStatus === "internal").length,
      missingConfigProviders: items.filter((item) => item.providerStatus === "missing_config").length,
      placeholderProviders: items.filter((item) => item.providerStatus === "placeholder").length,
      totalAbstractions: items.length
    };
  } catch (error) {
    console.error("[notification-provider-abstraction-runtime] provider abstraction stats build failed", error);

    return {
      activeFoundationProviders: 0,
      inactiveProviders: 0,
      internalProviders: 0,
      missingConfigProviders: 0,
      placeholderProviders: 0,
      totalAbstractions: 0
    };
  }
}

export function buildNotificationProviderAbstractionSummarySafe(): NotificationProviderAbstractionSummary {
  return {
    externalProvidersCalled: false,
    foundationOnly: true,
    policyDescription:
      "Notification provider abstraction defines read-only provider keys, channels, masked config summaries, and inactive capability flags. Email checks env presence only without live credential validation, send, or test paths. SMS, WhatsApp, and Push remain placeholders. No external provider APIs, queue processing, retries, or background workers run during page load.",
    safeSummary:
      "NT-24 provider abstraction runtime: Super Admin visibility with guarded inactive implementations and safe fallback summaries only.",
    sendsDisabled: true
  };
}

export function listNotificationProviderAbstractionCatalog() {
  return NOTIFICATION_PROVIDER_KEYS.map((providerKey) => ({
    capabilityFlags: resolveNotificationProviderCapabilityFlagsSafe({
      placeholderOnly: isNotificationPlaceholderProvider(providerKey),
      providerKey,
      providerType: isNotificationPlaceholderProvider(providerKey) ? "placeholder" : "internal"
    }),
    label: getNotificationProviderLabel(providerKey),
    providerKey,
    supportedChannel: mapNotificationProviderToChannel(providerKey),
    supportedChannelLabel: getNotificationChannelLabel(mapNotificationProviderToChannel(providerKey))
  }));
}

export function sanitizeNotificationProviderAbstractionMetadataSafe(params: {
  configSummary?: unknown;
  healthReference?: unknown;
  providerKey: NotificationProviderKey;
  providerStatus: NotificationProviderAbstractionStatus;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `provider=${params.providerKey}`,
      `status=${params.providerStatus}`,
      `health=${text(params.healthReference, 80) || "unknown"}`,
      text(params.configSummary, 120) || "No safe config summary."
    ].join(" "),
    240
  );
}

// NT-25+ placeholders: provider routing, live validation, and failover execution stay disconnected.
export const NOTIFICATION_PROVIDER_ABSTRACTION_FUTURE_HOOKS = [
  "notification_provider_routing",
  "notification_provider_live_validation",
  "notification_provider_failover_execution"
] as const;
