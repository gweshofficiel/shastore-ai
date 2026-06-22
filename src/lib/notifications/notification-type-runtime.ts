import "server-only";

export type NotificationType =
  | "ai_visuals"
  | "billing"
  | "domains"
  | "email_setup"
  | "security"
  | "store_publishing"
  | "support"
  | "system_health";

export type NotificationTypeBadgeTone = "amber" | "blue" | "green" | "red";

export type NotificationTypeCatalogEntry = {
  badgeTone: NotificationTypeBadgeTone;
  description: string;
  label: string;
  type: NotificationType;
};

export type NotificationTypeStats = {
  aiVisualsItems: number;
  billingItems: number;
  domainsItems: number;
  emailSetupItems: number;
  securityItems: number;
  storePublishingItems: number;
  supportItems: number;
  systemHealthItems: number;
  totalItems: number;
  unknownItems: number;
};

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "billing",
  "security",
  "domains",
  "email_setup",
  "ai_visuals",
  "store_publishing",
  "support",
  "system_health"
] as const;

const typeLabels: Record<NotificationType, string> = {
  ai_visuals: "AI visuals",
  billing: "Billing",
  domains: "Domains",
  email_setup: "Email setup",
  security: "Security",
  store_publishing: "Store publishing",
  support: "Support",
  system_health: "System health"
};

const typeDescriptions: Record<NotificationType, string> = {
  ai_visuals: "AI visual asset and generation notification foundation.",
  billing: "Billing, subscription, invoice, and payment notification foundation.",
  domains: "Domain registration and DNS notification foundation.",
  email_setup: "Professional email and mailbox setup notification foundation.",
  security: "Security, login, and access notification foundation.",
  store_publishing: "Store launch and publishing notification foundation.",
  support: "Support ticket and helpdesk notification foundation.",
  system_health: "Platform health and operational notification foundation."
};

const badgeToneByType: Record<NotificationType, NotificationTypeBadgeTone> = {
  ai_visuals: "blue",
  billing: "amber",
  domains: "green",
  email_setup: "blue",
  security: "red",
  store_publishing: "green",
  support: "blue",
  system_health: "amber"
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

function normalizeNotificationTypeToken(value: unknown) {
  const cleaned = text(value, 80).toLowerCase().replace(/[\s-]+/g, "_");

  if (!cleaned) return "";
  if (cleaned === "domain") return "domains";
  if (cleaned === "ai_visual" || cleaned === "ai_visual_asset" || cleaned === "ai_visuals") return "ai_visuals";
  if (cleaned === "email" || cleaned === "mailbox" || cleaned === "email_setup") return "email_setup";
  if (cleaned === "store_publish" || cleaned === "store_publishing") return "store_publishing";
  if (cleaned === "system" || cleaned === "system_health") return "system_health";

  return cleaned;
}

export function isValidNotificationType(value: unknown): value is NotificationType {
  const normalized = normalizeNotificationTypeToken(value);
  return Boolean(normalized && NOTIFICATION_TYPES.includes(normalized as NotificationType));
}

export function parseNotificationType(value: unknown): NotificationType | null {
  const normalized = normalizeNotificationTypeToken(value);
  return isValidNotificationType(normalized) ? normalized : null;
}

export function getNotificationTypeLabel(type: NotificationType) {
  return typeLabels[type];
}

export function getNotificationTypeDescription(type: NotificationType) {
  return typeDescriptions[type];
}

export function getNotificationTypeBadgeTone(type: NotificationType): NotificationTypeBadgeTone {
  return badgeToneByType[type];
}

export function resolveNotificationTypeLabel(value: unknown) {
  const notificationType = parseNotificationType(value);
  return notificationType ? getNotificationTypeLabel(notificationType) : "Unknown type";
}

export function resolveNotificationTypeBadgeTone(value: unknown): NotificationTypeBadgeTone {
  const notificationType = parseNotificationType(value);
  return notificationType ? getNotificationTypeBadgeTone(notificationType) : "red";
}

export function classifyNotificationTypeFromSource(value: unknown): NotificationType {
  const direct = parseNotificationType(value);
  if (direct) return direct;

  const lower = text(value, 240).toLowerCase();
  if (!lower) return "system_health";

  if (lower.includes("billing") || lower.includes("payment") || lower.includes("subscription") || lower.includes("invoice")) {
    return "billing";
  }

  if (lower.includes("security") || lower.includes("login") || lower.includes("access")) {
    return "security";
  }

  if (lower.includes("domain")) {
    return "domains";
  }

  if (lower.includes("email") || lower.includes("mailbox")) {
    return "email_setup";
  }

  if (lower.includes("ai")) {
    return "ai_visuals";
  }

  if (lower.includes("publish") || lower.includes("launch")) {
    return "store_publishing";
  }

  if (lower.includes("support") || lower.includes("ticket")) {
    return "support";
  }

  return "system_health";
}

export function resolveNotificationTypeFromSourceSafe(value: unknown) {
  const source = text(value, 240);
  const direct = parseNotificationType(source);
  const type = direct ?? classifyNotificationTypeFromSource(source);

  return {
    classifiedFromSource: !direct && Boolean(source),
    source: source || "unknown",
    type,
    typeBadgeTone: getNotificationTypeBadgeTone(type),
    typeDescription: getNotificationTypeDescription(type),
    typeLabel: source ? getNotificationTypeLabel(type) : "Unknown type"
  };
}

export function listNotificationTypeCatalog(): NotificationTypeCatalogEntry[] {
  return NOTIFICATION_TYPES.map((type) => ({
    badgeTone: getNotificationTypeBadgeTone(type),
    description: getNotificationTypeDescription(type),
    label: getNotificationTypeLabel(type),
    type
  }));
}

export function countNotificationItemsByType(sources: unknown[]): NotificationTypeStats {
  const counts = Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, 0])) as Record<NotificationType, number>;
  let unknownItems = 0;

  for (const source of sources) {
    const cleaned = text(source, 240);
    const direct = parseNotificationType(cleaned);

    if (direct) {
      counts[direct] += 1;
      continue;
    }

    if (!cleaned) {
      unknownItems += 1;
      counts.system_health += 1;
      continue;
    }

    counts[classifyNotificationTypeFromSource(cleaned)] += 1;
  }

  return {
    aiVisualsItems: counts.ai_visuals,
    billingItems: counts.billing,
    domainsItems: counts.domains,
    emailSetupItems: counts.email_setup,
    securityItems: counts.security,
    storePublishingItems: counts.store_publishing,
    supportItems: counts.support,
    systemHealthItems: counts.system_health,
    totalItems: sources.length,
    unknownItems
  };
}

export function buildNotificationTypeAdminViews(params: {
  logCountsByType?: Partial<Record<NotificationType, number>>;
  registryLabelsByType?: Partial<Record<NotificationType, string>>;
}) {
  const logCountsByType = params.logCountsByType ?? {};

  return listNotificationTypeCatalog().map((entry) => ({
    badgeTone: entry.badgeTone,
    count: logCountsByType[entry.type] ?? 0,
    description: entry.description,
    key: entry.type,
    label: params.registryLabelsByType?.[entry.type] ?? entry.label
  }));
}

export function buildNotificationTypeStatsSafe(sources: unknown[] | null | undefined): NotificationTypeStats {
  try {
    return countNotificationItemsByType(Array.isArray(sources) ? sources : []);
  } catch (error) {
    console.error("[notification-type-runtime] type stats build failed", error);

    return {
      aiVisualsItems: 0,
      billingItems: 0,
      domainsItems: 0,
      emailSetupItems: 0,
      securityItems: 0,
      storePublishingItems: 0,
      supportItems: 0,
      systemHealthItems: 0,
      totalItems: 0,
      unknownItems: 0
    };
  }
}
