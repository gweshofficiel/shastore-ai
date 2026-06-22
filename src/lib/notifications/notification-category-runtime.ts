import "server-only";

import {
  classifyNotificationTypeFromSource,
  parseNotificationType,
  type NotificationType
} from "@/src/lib/notifications/notification-type-runtime";

export type NotificationCategory =
  | "account"
  | "ai"
  | "billing"
  | "domain"
  | "email"
  | "security"
  | "store"
  | "support"
  | "system"
  | "transactional";

export type NotificationCategoryBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type NotificationCategoryCatalogEntry = {
  badgeTone: NotificationCategoryBadgeTone;
  category: NotificationCategory;
  description: string;
  label: string;
};

export type NotificationCategoryStats = {
  accountItems: number;
  aiItems: number;
  billingItems: number;
  domainItems: number;
  emailItems: number;
  securityItems: number;
  storeItems: number;
  supportItems: number;
  systemItems: number;
  totalItems: number;
  transactionalItems: number;
  unknownItems: number;
};

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  "transactional",
  "account",
  "billing",
  "security",
  "store",
  "domain",
  "email",
  "ai",
  "support",
  "system"
] as const;

const categoryLabels: Record<NotificationCategory, string> = {
  account: "Account",
  ai: "AI",
  billing: "Billing",
  domain: "Domain",
  email: "Email",
  security: "Security",
  store: "Store",
  support: "Support",
  system: "System",
  transactional: "Transactional"
};

const categoryDescriptions: Record<NotificationCategory, string> = {
  account: "Account lifecycle and profile notification category foundation.",
  ai: "AI visual and generation notification category foundation.",
  billing: "Billing, subscription, and payment notification category foundation.",
  domain: "Domain registration and DNS notification category foundation.",
  email: "Professional email and mailbox setup notification category foundation.",
  security: "Security, login, and access notification category foundation.",
  store: "Store publishing, inventory, and commerce notification category foundation.",
  support: "Support ticket and helpdesk notification category foundation.",
  system: "Platform health and operational notification category foundation.",
  transactional: "Transactional order, receipt, and fulfillment notification category foundation."
};

const badgeToneByCategory: Record<NotificationCategory, NotificationCategoryBadgeTone> = {
  account: "blue",
  ai: "blue",
  billing: "amber",
  domain: "green",
  email: "blue",
  security: "red",
  store: "green",
  support: "blue",
  system: "slate",
  transactional: "green"
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

function normalizeNotificationCategoryToken(value: unknown) {
  const cleaned = text(value, 120).toLowerCase().replace(/[\s-]+/g, "_");

  if (!cleaned) return "";
  if (cleaned === "domains" || cleaned === "domain_dns" || cleaned === "dns") return "domain";
  if (cleaned === "ai_visual" || cleaned === "ai_visuals" || cleaned === "ai_visual_asset") return "ai";
  if (cleaned === "email_setup" || cleaned === "mailbox" || cleaned === "professional_email") return "email";
  if (
    cleaned === "store_publishing" ||
    cleaned === "store_publish" ||
    cleaned === "low_stock" ||
    cleaned === "inventory"
  ) {
    return "store";
  }
  if (cleaned === "system_health" || cleaned === "system_alert" || cleaned === "system_alerts") {
    return "system";
  }
  if (
    cleaned === "order" ||
    cleaned === "order_confirmation" ||
    cleaned === "review_request" ||
    cleaned === "thank_you" ||
    cleaned === "receipt"
  ) {
    return "transactional";
  }
  if (cleaned === "login" || cleaned === "profile" || cleaned === "account_status") {
    return "account";
  }

  return cleaned;
}

export function isValidNotificationCategory(value: unknown): value is NotificationCategory {
  const normalized = normalizeNotificationCategoryToken(value);
  return Boolean(normalized && NOTIFICATION_CATEGORIES.includes(normalized as NotificationCategory));
}

export function parseNotificationCategory(value: unknown): NotificationCategory | null {
  const normalized = normalizeNotificationCategoryToken(value);
  return isValidNotificationCategory(normalized) ? normalized : null;
}

export function parseNotificationCategorySafe(value: unknown): NotificationCategory {
  return parseNotificationCategory(value) ?? "system";
}

export function mapNotificationTypeToCategory(value: unknown): NotificationCategory | null {
  const notificationType = parseNotificationType(value);
  if (!notificationType) return null;

  const mapping: Record<NotificationType, NotificationCategory> = {
    ai_visuals: "ai",
    billing: "billing",
    domains: "domain",
    email_setup: "email",
    security: "security",
    store_publishing: "store",
    support: "support",
    system_health: "system"
  };

  return mapping[notificationType];
}

export function classifyNotificationCategoryFromSource(value: unknown): NotificationCategory {
  const direct = parseNotificationCategory(value);
  if (direct) return direct;

  const fromType = mapNotificationTypeToCategory(value);
  if (fromType) return fromType;

  const lower = text(value, 240).toLowerCase();
  if (!lower) return "system";

  if (lower.includes("billing") || lower.includes("payment") || lower.includes("subscription") || lower.includes("invoice")) {
    return "billing";
  }

  if (lower.includes("security") || lower.includes("login") || lower.includes("access") || lower.includes("password")) {
    return "security";
  }

  if (lower.includes("account") || lower.includes("profile") || lower.includes("claim")) {
    return "account";
  }

  if (lower.includes("domain") || lower.includes("dns")) {
    return "domain";
  }

  if (lower.includes("email") || lower.includes("mailbox")) {
    return "email";
  }

  if (lower.includes("ai") || lower.includes("visual")) {
    return "ai";
  }

  if (
    lower.includes("order") ||
    lower.includes("receipt") ||
    lower.includes("thank") ||
    lower.includes("review") ||
    lower.includes("confirmation")
  ) {
    return "transactional";
  }

  if (lower.includes("publish") || lower.includes("launch") || lower.includes("stock") || lower.includes("store")) {
    return "store";
  }

  if (lower.includes("support") || lower.includes("ticket")) {
    return "support";
  }

  const classifiedType = classifyNotificationTypeFromSource(value);
  return mapNotificationTypeToCategory(classifiedType) ?? "system";
}

export function resolveRegistryNotificationCategorySafe(params: {
  category?: unknown;
  metadata?: Record<string, unknown>;
  name?: unknown;
  notificationType?: unknown;
  registryType?: unknown;
  slug?: unknown;
}): NotificationCategory {
  const metadataCategory = parseNotificationCategory(
    params.metadata?.notification_category ?? params.metadata?.category
  );
  if (metadataCategory) return metadataCategory;

  const explicitCategory = parseNotificationCategory(params.category);
  if (explicitCategory) return explicitCategory;

  const fromNotificationType = mapNotificationTypeToCategory(params.notificationType);
  if (fromNotificationType) return fromNotificationType;

  const registryType = text(params.registryType, 80);
  if (registryType === "channel" || registryType === "provider") {
    return "system";
  }

  if (registryType === "future_hook") {
    return "system";
  }

  const slug = text(params.slug, 160).toLowerCase();
  const name = text(params.name, 200).toLowerCase();

  return classifyNotificationCategoryFromSource(
    [params.notificationType, slug, name].filter(Boolean).join(" ")
  );
}

export function getNotificationCategoryLabel(category: NotificationCategory) {
  return categoryLabels[category];
}

export function getNotificationCategoryDescription(category: NotificationCategory) {
  return categoryDescriptions[category];
}

export function getNotificationCategoryBadgeTone(category: NotificationCategory): NotificationCategoryBadgeTone {
  return badgeToneByCategory[category];
}

export function resolveNotificationCategoryLabel(value: unknown) {
  const category = parseNotificationCategory(value);
  return category ? getNotificationCategoryLabel(category) : getNotificationCategoryLabel("system");
}

export function resolveNotificationCategoryBadgeTone(value: unknown): NotificationCategoryBadgeTone {
  const category = parseNotificationCategory(value);
  return category ? getNotificationCategoryBadgeTone(category) : getNotificationCategoryBadgeTone("system");
}

export function listNotificationCategoryCatalog(): NotificationCategoryCatalogEntry[] {
  return NOTIFICATION_CATEGORIES.map((category) => ({
    badgeTone: getNotificationCategoryBadgeTone(category),
    category,
    description: getNotificationCategoryDescription(category),
    label: getNotificationCategoryLabel(category)
  }));
}

export function countNotificationItemsByCategory(sources: unknown[]): NotificationCategoryStats {
  const counts = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, 0])
  ) as Record<NotificationCategory, number>;
  let unknownItems = 0;

  for (const source of sources) {
    const cleaned = text(source, 240);
    const direct = parseNotificationCategory(source);

    if (direct) {
      counts[direct] += 1;
      continue;
    }

    if (!cleaned) {
      counts.system += 1;
      continue;
    }

    unknownItems += 1;
    counts[classifyNotificationCategoryFromSource(source)] += 1;
  }

  return {
    accountItems: counts.account,
    aiItems: counts.ai,
    billingItems: counts.billing,
    domainItems: counts.domain,
    emailItems: counts.email,
    securityItems: counts.security,
    storeItems: counts.store,
    supportItems: counts.support,
    systemItems: counts.system,
    totalItems: sources.length,
    transactionalItems: counts.transactional,
    unknownItems
  };
}

export function buildNotificationCategoryStatsSafe(sources: unknown[] | null | undefined): NotificationCategoryStats {
  try {
    return countNotificationItemsByCategory(Array.isArray(sources) ? sources : []);
  } catch (error) {
    console.error("[notification-category-runtime] category stats build failed", error);

    return {
      accountItems: 0,
      aiItems: 0,
      billingItems: 0,
      domainItems: 0,
      emailItems: 0,
      securityItems: 0,
      storeItems: 0,
      supportItems: 0,
      systemItems: 0,
      totalItems: 0,
      transactionalItems: 0,
      unknownItems: 0
    };
  }
}

export function buildNotificationRegistryCategoryStatsSafe(
  items: Array<{ notificationCategory: NotificationCategory }> | null | undefined
): NotificationCategoryStats {
  try {
    return countNotificationItemsByCategory(
      Array.isArray(items) ? items.map((item) => item.notificationCategory) : []
    );
  } catch (error) {
    console.error("[notification-category-runtime] registry category stats failed", error);

    return {
      accountItems: 0,
      aiItems: 0,
      billingItems: 0,
      domainItems: 0,
      emailItems: 0,
      securityItems: 0,
      storeItems: 0,
      supportItems: 0,
      systemItems: 0,
      totalItems: 0,
      transactionalItems: 0,
      unknownItems: 0
    };
  }
}

export function groupNotificationRegistryItemsByCategory<T extends { notificationCategory: NotificationCategory }>(
  items: T[]
) {
  return NOTIFICATION_CATEGORIES.map((category) => ({
    category,
    categoryDescription: getNotificationCategoryDescription(category),
    categoryLabel: getNotificationCategoryLabel(category),
    items: items.filter((item) => item.notificationCategory === category)
  }));
}

// NT-6+ placeholders: category routing rules and audience segmentation stay disconnected.
export const NOTIFICATION_CATEGORY_FUTURE_HOOKS = [
  "notification_category_routing_rules",
  "notification_audience_segmentation",
  "notification_category_policy_engine"
] as const;
