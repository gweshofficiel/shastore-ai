import "server-only";

export type NotificationChannel =
  | "email"
  | "in_app"
  | "push"
  | "sms"
  | "system_alert"
  | "whatsapp";

export type NotificationChannelBadgeTone = "amber" | "blue" | "green" | "red";

export type NotificationChannelRuntimeState = "active" | "missing_config" | "placeholder";

export type NotificationChannelConfiguredStatus = "configured" | "missing" | "placeholder";

export type NotificationChannelHealthStatus = "healthy" | "missing_config" | "placeholder" | "warning";

export type NotificationChannelSecretStatus =
  | "masked_configured"
  | "masked_partial"
  | "missing"
  | "no_secret_required";

export type NotificationChannelCatalogEntry = {
  badgeTone: NotificationChannelBadgeTone;
  channel: NotificationChannel;
  description: string;
  label: string;
  placeholderOnly: boolean;
};

export type NotificationChannelView = {
  channel: NotificationChannel;
  channelLabel: string;
  configuredStatus: NotificationChannelConfiguredStatus;
  description: string;
  healthStatus: NotificationChannelHealthStatus;
  placeholderOnly: boolean;
  runtimeState: NotificationChannelRuntimeState;
  secretStatus: NotificationChannelSecretStatus;
};

export type NotificationChannelStats = {
  emailItems: number;
  inAppItems: number;
  pushItems: number;
  smsItems: number;
  systemAlertItems: number;
  totalItems: number;
  unknownItems: number;
  whatsappItems: number;
};

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  "in_app",
  "email",
  "sms",
  "whatsapp",
  "push",
  "system_alert"
] as const;

export const NOTIFICATION_PLACEHOLDER_CHANNELS: readonly NotificationChannel[] = [
  "sms",
  "whatsapp",
  "push"
] as const;

const channelLabels: Record<NotificationChannel, string> = {
  email: "Email",
  in_app: "In-app",
  push: "Push",
  sms: "SMS",
  system_alert: "System alert",
  whatsapp: "WhatsApp"
};

const channelDescriptions: Record<NotificationChannel, string> = {
  email: "Email notification channel foundation with masked provider configuration only.",
  in_app: "In-app notification channel foundation for workspace and platform alerts.",
  push: "Push notification channel placeholder foundation. No push delivery connected.",
  sms: "SMS notification channel placeholder foundation. No SMS delivery connected.",
  system_alert: "System alert notification channel foundation for platform monitoring summaries.",
  whatsapp: "WhatsApp notification channel placeholder foundation. No WhatsApp delivery connected."
};

const badgeToneByChannel: Record<NotificationChannel, NotificationChannelBadgeTone> = {
  email: "blue",
  in_app: "green",
  push: "blue",
  sms: "amber",
  system_alert: "amber",
  whatsapp: "green"
};

const placeholderOnlyByChannel: Record<NotificationChannel, boolean> = {
  email: false,
  in_app: false,
  push: true,
  sms: true,
  system_alert: false,
  whatsapp: true
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

function normalizeNotificationChannelToken(value: unknown) {
  const cleaned = text(value, 80).toLowerCase().replace(/[\s-]+/g, "_");

  if (!cleaned) return "";
  if (cleaned === "system_alerts" || cleaned === "system_alert" || cleaned === "system") {
    return "system_alert";
  }
  if (cleaned === "inapp" || cleaned === "in_app" || cleaned === "app") {
    return "in_app";
  }
  if (cleaned === "mail") {
    return "email";
  }

  return cleaned;
}

export function isValidNotificationChannel(value: unknown): value is NotificationChannel {
  const normalized = normalizeNotificationChannelToken(value);
  return Boolean(normalized && NOTIFICATION_CHANNELS.includes(normalized as NotificationChannel));
}

export function parseNotificationChannel(value: unknown): NotificationChannel | null {
  const normalized = normalizeNotificationChannelToken(value);
  return isValidNotificationChannel(normalized) ? normalized : null;
}

export function parseNotificationChannelSafe(value: unknown): NotificationChannel {
  return parseNotificationChannel(value) ?? "in_app";
}

export function resolveRegistryNotificationChannelSafe(value: unknown): NotificationChannel {
  return parseNotificationChannelSafe(value);
}

export function isNotificationPlaceholderChannel(channel: NotificationChannel) {
  return NOTIFICATION_PLACEHOLDER_CHANNELS.includes(channel);
}

export function getNotificationChannelLabel(channel: NotificationChannel) {
  return channelLabels[channel];
}

export function getNotificationChannelDescription(channel: NotificationChannel) {
  return channelDescriptions[channel];
}

export function getNotificationChannelBadgeTone(channel: NotificationChannel): NotificationChannelBadgeTone {
  return badgeToneByChannel[channel];
}

export function resolveNotificationChannelLabel(value: unknown) {
  const channel = parseNotificationChannel(value);
  return channel ? getNotificationChannelLabel(channel) : "In-app";
}

export function resolveNotificationChannelBadgeTone(value: unknown): NotificationChannelBadgeTone {
  const channel = parseNotificationChannel(value);
  return channel ? getNotificationChannelBadgeTone(channel) : "green";
}

export function listNotificationChannelCatalog(): NotificationChannelCatalogEntry[] {
  return NOTIFICATION_CHANNELS.map((channel) => ({
    badgeTone: getNotificationChannelBadgeTone(channel),
    channel,
    description: getNotificationChannelDescription(channel),
    label: getNotificationChannelLabel(channel),
    placeholderOnly: placeholderOnlyByChannel[channel]
  }));
}

export function classifyNotificationChannelRuntimeState(params: {
  channel: NotificationChannel;
  configuredStatus: NotificationChannelConfiguredStatus;
  healthStatus: NotificationChannelHealthStatus;
}): NotificationChannelRuntimeState {
  if (isNotificationPlaceholderChannel(params.channel)) {
    return "placeholder";
  }

  if (params.configuredStatus === "missing" || params.healthStatus === "missing_config") {
    return "missing_config";
  }

  return "active";
}

export type NotificationRegistryChannelSnapshot = {
  configuredStatus: NotificationChannelConfiguredStatus;
  healthStatus: NotificationChannelHealthStatus;
  key: NotificationChannel;
  name: string;
  secretStatus: NotificationChannelSecretStatus;
};

function defaultChannelView(channel: NotificationChannel): NotificationChannelView {
  const placeholderOnly = isNotificationPlaceholderChannel(channel);

  return {
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    configuredStatus: placeholderOnly ? "placeholder" : channel === "email" ? "missing" : "configured",
    description: getNotificationChannelDescription(channel),
    healthStatus: placeholderOnly ? "placeholder" : channel === "email" ? "missing_config" : "healthy",
    placeholderOnly,
    runtimeState: placeholderOnly ? "placeholder" : channel === "email" ? "missing_config" : "active",
    secretStatus: placeholderOnly ? "missing" : channel === "in_app" || channel === "system_alert" ? "no_secret_required" : "missing"
  };
}

export function buildNotificationChannelAdminViews(params: {
  registryChannels?: NotificationRegistryChannelSnapshot[] | null;
}): NotificationChannelView[] {
  const registryByChannel = new Map<NotificationChannel, NotificationRegistryChannelSnapshot>();

  for (const entry of params.registryChannels ?? []) {
    if (!isValidNotificationChannel(entry.key)) continue;
    registryByChannel.set(entry.key, entry);
  }

  return NOTIFICATION_CHANNELS.map((channel) => {
    const registry = registryByChannel.get(channel);
    const placeholderOnly = isNotificationPlaceholderChannel(channel);

    if (!registry) {
      return defaultChannelView(channel);
    }

    const configuredStatus = registry.configuredStatus;
    const healthStatus = registry.healthStatus;
    const runtimeState = classifyNotificationChannelRuntimeState({
      channel,
      configuredStatus,
      healthStatus
    });

    return {
      channel,
      channelLabel: text(registry.name, 200) || getNotificationChannelLabel(channel),
      configuredStatus,
      description: getNotificationChannelDescription(channel),
      healthStatus,
      placeholderOnly,
      runtimeState,
      secretStatus: registry.secretStatus
    };
  });
}

export function enrichNotificationChannelViewsSafe(params: {
  channels: NotificationChannelView[];
  emailConfigured?: boolean;
  monitoringHasFailed?: boolean;
}): NotificationChannelView[] {
  try {
    return params.channels.map((channel) => {
      if (channel.channel === "email") {
        const emailConfigured = Boolean(params.emailConfigured);
        const configuredStatus: NotificationChannelConfiguredStatus = emailConfigured ? "configured" : "missing";
        const healthStatus: NotificationChannelHealthStatus = emailConfigured ? "healthy" : "missing_config";

        return {
          ...channel,
          configuredStatus,
          healthStatus,
          runtimeState: classifyNotificationChannelRuntimeState({
            channel: channel.channel,
            configuredStatus,
            healthStatus
          }),
          secretStatus: emailConfigured ? "masked_configured" : "missing"
        };
      }

      if (channel.channel === "sms" || channel.channel === "whatsapp" || channel.channel === "push") {
        return {
          ...channel,
          configuredStatus: "placeholder",
          healthStatus: "placeholder",
          placeholderOnly: true,
          runtimeState: "placeholder",
          secretStatus: "missing"
        };
      }

      if (channel.channel === "system_alert") {
        const healthStatus: NotificationChannelHealthStatus = params.monitoringHasFailed ? "warning" : "healthy";

        return {
          ...channel,
          healthStatus,
          runtimeState: classifyNotificationChannelRuntimeState({
            channel: channel.channel,
            configuredStatus: channel.configuredStatus,
            healthStatus
          })
        };
      }

      return channel;
    });
  } catch (error) {
    console.error("[notification-channel-runtime] channel view enrichment failed", error);
    return buildNotificationChannelAdminViews({});
  }
}

export function countNotificationItemsByChannel(sources: unknown[]): NotificationChannelStats {
  const counts = Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [channel, 0])
  ) as Record<NotificationChannel, number>;
  let unknownItems = 0;

  for (const source of sources) {
    const channel = parseNotificationChannel(source);

    if (channel) {
      counts[channel] += 1;
      continue;
    }

    unknownItems += 1;
    counts.in_app += 1;
  }

  return {
    emailItems: counts.email,
    inAppItems: counts.in_app,
    pushItems: counts.push,
    smsItems: counts.sms,
    systemAlertItems: counts.system_alert,
    totalItems: sources.length,
    unknownItems,
    whatsappItems: counts.whatsapp
  };
}

export function buildNotificationChannelStatsSafe(sources: unknown[] | null | undefined): NotificationChannelStats {
  try {
    return countNotificationItemsByChannel(Array.isArray(sources) ? sources : []);
  } catch (error) {
    console.error("[notification-channel-runtime] channel stats build failed", error);

    return {
      emailItems: 0,
      inAppItems: 0,
      pushItems: 0,
      smsItems: 0,
      systemAlertItems: 0,
      totalItems: 0,
      unknownItems: 0,
      whatsappItems: 0
    };
  }
}

export function buildNotificationChannelViewsSafe(params: {
  emailConfigured?: boolean;
  monitoringHasFailed?: boolean;
  registryChannels?: NotificationRegistryChannelSnapshot[] | null;
}): { channels: NotificationChannelView[]; warning: string | null } {
  try {
    const channels = enrichNotificationChannelViewsSafe({
      channels: buildNotificationChannelAdminViews({ registryChannels: params.registryChannels }),
      emailConfigured: params.emailConfigured,
      monitoringHasFailed: params.monitoringHasFailed
    });

    return { channels, warning: null };
  } catch (error) {
    console.error("[notification-channel-runtime] channel views build failed", error);

    return {
      channels: buildNotificationChannelAdminViews({}),
      warning: "Notification channel views could not be built safely. Showing fallback channel rows."
    };
  }
}

// NT-5+ placeholders: channel send execution, provider routing, and webhook ingress stay disconnected.
export const NOTIFICATION_CHANNEL_FUTURE_HOOKS = [
  "notification_channel_send_execution",
  "notification_provider_routing",
  "notification_channel_webhook_ingress"
] as const;
