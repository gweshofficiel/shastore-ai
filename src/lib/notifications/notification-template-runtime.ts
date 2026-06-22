import "server-only";

import {
  classifyNotificationCategoryFromSource,
  getNotificationCategoryLabel,
  type NotificationCategory
} from "@/src/lib/notifications/notification-category-runtime";
import {
  getNotificationChannelLabel,
  type NotificationChannel
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  getNotificationProviderLabel,
  mapNotificationChannelToProvider,
  type NotificationProviderKey
} from "@/src/lib/notifications/notification-provider-runtime";
import {
  classifyNotificationTypeFromSource,
  getNotificationTypeLabel,
  parseNotificationType
} from "@/src/lib/notifications/notification-type-runtime";

export type NotificationTemplateEnabledState = "disabled" | "enabled" | "placeholder";

export type NotificationTemplatePreviewState = "placeholder" | "preview_ready" | "preview_unavailable" | "unknown";

export type NotificationTemplateView = {
  bodyPreview: string;
  category: NotificationCategory;
  categoryLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string | null;
  enabledState: NotificationTemplateEnabledState;
  notificationType: string;
  notificationTypeLabel: string;
  previewState: NotificationTemplatePreviewState;
  providerKey: NotificationProviderKey;
  providerLabel: string;
  subjectPreview: string;
  templateKey: string;
  templateName: string;
  updatedAt: string | null;
  usageCount: number;
};

export type NotificationTemplateStats = {
  disabledTemplates: number;
  emailTemplates: number;
  enabledTemplates: number;
  inAppTemplates: number;
  placeholderTemplates: number;
  previewReadyTemplates: number;
  systemTemplates: number;
  totalTemplates: number;
  unknownTemplates: number;
};

export type NotificationTemplateFoundation = {
  bodyPreview: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabledState?: NotificationTemplateEnabledState;
  notificationType?: string;
  subjectPreview: string;
  templateKey: string;
  templateName: string;
};

export const NOTIFICATION_TEMPLATE_FALLBACK_KEY = "unknown_notification_template" as const;

export const NOTIFICATION_TEMPLATE_FOUNDATION: readonly NotificationTemplateFoundation[] = [
  {
    bodyPreview: "Order confirmation notification foundation summary. Variable placeholders only. No HTML rendering connected.",
    category: "transactional",
    channel: "email",
    notificationType: "order_confirmation",
    subjectPreview: "Order confirmation notification preview foundation",
    templateKey: "order_confirmation",
    templateName: "Order confirmation"
  },
  {
    bodyPreview: "Order status update notification foundation summary. Variable placeholders only.",
    category: "transactional",
    channel: "email",
    notificationType: "order_status_update",
    subjectPreview: "Order status update notification preview foundation",
    templateKey: "order_status_update",
    templateName: "Order status update"
  },
  {
    bodyPreview: "Review request notification foundation summary. Variable placeholders only.",
    category: "transactional",
    channel: "email",
    notificationType: "review_request",
    subjectPreview: "Review request notification preview foundation",
    templateKey: "review_request",
    templateName: "Review request"
  },
  {
    bodyPreview: "Thank you notification foundation summary. Variable placeholders only.",
    category: "transactional",
    channel: "email",
    notificationType: "thank_you",
    subjectPreview: "Thank you notification preview foundation",
    templateKey: "thank_you",
    templateName: "Thank you"
  },
  {
    bodyPreview: "Low stock alert notification foundation summary. Variable placeholders only.",
    category: "store",
    channel: "email",
    notificationType: "low_stock",
    subjectPreview: "Low stock alert notification preview foundation",
    templateKey: "low_stock_alert",
    templateName: "Low stock alert"
  },
  {
    bodyPreview: "Customer welcome notification foundation summary. Variable placeholders only.",
    category: "account",
    channel: "email",
    notificationType: "customer_welcome",
    subjectPreview: "Customer welcome notification preview foundation",
    templateKey: "customer_welcome",
    templateName: "Customer welcome"
  },
  {
    bodyPreview: "Abandoned cart recovery notification foundation summary. Variable placeholders only.",
    category: "transactional",
    channel: "email",
    notificationType: "abandoned_cart_recovery",
    subjectPreview: "Abandoned cart recovery notification preview foundation",
    templateKey: "abandoned_cart_recovery",
    templateName: "Abandoned cart recovery"
  },
  {
    bodyPreview: "Review reminder notification foundation summary. Variable placeholders only.",
    category: "transactional",
    channel: "email",
    notificationType: "review_reminder",
    subjectPreview: "Review reminder notification preview foundation",
    templateKey: "review_reminder",
    templateName: "Review reminder"
  },
  {
    bodyPreview: "Payment failed billing notification foundation summary. Variable placeholders only.",
    category: "billing",
    channel: "email",
    notificationType: "payment_failed",
    subjectPreview: "Payment failed for your SHASTORE AI subscription",
    templateKey: "payment_failed",
    templateName: "Payment failed"
  },
  {
    bodyPreview: "Payment recovered billing notification foundation summary. Variable placeholders only.",
    category: "billing",
    channel: "email",
    notificationType: "payment_recovered",
    subjectPreview: "Payment recovered for your SHASTORE AI subscription",
    templateKey: "payment_recovered",
    templateName: "Payment recovered"
  },
  {
    bodyPreview: "Subscription activated billing notification foundation summary. Variable placeholders only.",
    category: "billing",
    channel: "email",
    notificationType: "subscription_activated",
    subjectPreview: "Your SHASTORE AI subscription is active",
    templateKey: "subscription_activated",
    templateName: "Subscription activated"
  },
  {
    bodyPreview: "Subscription canceled billing notification foundation summary. Variable placeholders only.",
    category: "billing",
    channel: "email",
    notificationType: "subscription_canceled",
    subjectPreview: "Your SHASTORE AI subscription was canceled",
    templateKey: "subscription_canceled",
    templateName: "Subscription canceled"
  },
  {
    bodyPreview: "Subscription plan changed billing notification foundation summary. Variable placeholders only.",
    category: "billing",
    channel: "email",
    notificationType: "subscription_plan_changed",
    subjectPreview: "Your SHASTORE AI plan has been updated",
    templateKey: "subscription_plan_changed",
    templateName: "Subscription plan changed"
  },
  {
    bodyPreview: "In-app billing notification foundation summary. No external provider execution connected.",
    category: "billing",
    channel: "in_app",
    notificationType: "billing",
    subjectPreview: "Billing notification preview foundation",
    templateKey: "in_app:billing",
    templateName: "In-app billing"
  },
  {
    bodyPreview: "In-app security notification foundation summary. No external provider execution connected.",
    category: "security",
    channel: "in_app",
    notificationType: "security",
    subjectPreview: "Security notification preview foundation",
    templateKey: "in_app:security",
    templateName: "In-app security"
  },
  {
    bodyPreview: "In-app system health notification foundation summary. No external provider execution connected.",
    category: "system",
    channel: "in_app",
    notificationType: "system_health",
    subjectPreview: "System health notification preview foundation",
    templateKey: "in_app:system_health",
    templateName: "In-app system health"
  },
  {
    bodyPreview: "In-app low stock notification foundation summary. Variable placeholders only.",
    category: "store",
    channel: "in_app",
    notificationType: "low_stock",
    subjectPreview: "Low stock in-app notification preview foundation",
    templateKey: "in_app:low_stock",
    templateName: "In-app low stock"
  },
  {
    bodyPreview: "System alert notification foundation summary. Platform monitoring visibility only.",
    category: "system",
    channel: "system_alert",
    notificationType: "system_alert",
    subjectPreview: "System alert notification preview foundation",
    templateKey: "system_alert:platform",
    templateName: "System alert platform"
  },
  {
    bodyPreview: "SMS notification template placeholder foundation. No SMS delivery connected.",
    category: "transactional",
    channel: "sms",
    enabledState: "placeholder",
    notificationType: "sms_placeholder",
    subjectPreview: "SMS notification placeholder preview foundation",
    templateKey: "sms:placeholder",
    templateName: "SMS placeholder"
  },
  {
    bodyPreview: "WhatsApp notification template placeholder foundation. No WhatsApp delivery connected.",
    category: "transactional",
    channel: "whatsapp",
    enabledState: "placeholder",
    notificationType: "whatsapp_placeholder",
    subjectPreview: "WhatsApp notification placeholder preview foundation",
    templateKey: "whatsapp:placeholder",
    templateName: "WhatsApp placeholder"
  },
  {
    bodyPreview: "Push notification template placeholder foundation. No push delivery connected.",
    category: "system",
    channel: "push",
    enabledState: "placeholder",
    notificationType: "push_placeholder",
    subjectPreview: "Push notification placeholder preview foundation",
    templateKey: "push:placeholder",
    templateName: "Push placeholder"
  },
  {
    bodyPreview: "Notification template reference could not be resolved safely.",
    category: "system",
    channel: "in_app",
    enabledState: "placeholder",
    notificationType: "unknown",
    subjectPreview: "Unknown notification template preview foundation",
    templateKey: NOTIFICATION_TEMPLATE_FALLBACK_KEY,
    templateName: "Unknown notification template"
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|sms|whatsapp|push|provider[_-]?config|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{[^}]+\}\}/g, "[placeholder]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeNotificationTemplatePreviewContent(value: unknown, maxLength = 240) {
  const cleaned = text(value, maxLength);
  if (!cleaned || secretPattern.test(cleaned)) {
    return "";
  }

  return cleaned;
}

export function normalizeNotificationTemplateKey(value: unknown) {
  const cleaned = text(value, 160).toLowerCase().replace(/[\s-]+/g, "_");
  return cleaned;
}

export function parseNotificationTemplateKey(value: unknown): string | null {
  const cleaned = normalizeNotificationTemplateKey(value);
  return cleaned || null;
}

export function parseNotificationTemplateKeySafe(value: unknown) {
  return parseNotificationTemplateKey(value) ?? NOTIFICATION_TEMPLATE_FALLBACK_KEY;
}

function resolveNotificationTypeLabel(value: string) {
  const direct = parseNotificationType(value);
  if (direct) return getNotificationTypeLabel(direct);

  const classified = classifyNotificationTypeFromSource(value);
  return getNotificationTypeLabel(classified);
}

function resolveTemplatePreviewState(params: {
  channel: NotificationChannel;
  enabledState: NotificationTemplateEnabledState;
  hasPreviewContent: boolean;
}): NotificationTemplatePreviewState {
  if (params.enabledState === "placeholder") {
    return "placeholder";
  }

  if (params.enabledState === "disabled") {
    return "preview_unavailable";
  }

  if (!params.hasPreviewContent) {
    return "preview_unavailable";
  }

  if (params.channel === "sms" || params.channel === "whatsapp" || params.channel === "push") {
    return "placeholder";
  }

  return "preview_ready";
}

function buildTemplateViewFromFoundation(
  foundation: NotificationTemplateFoundation,
  overrides: Partial<NotificationTemplateView> = {}
): NotificationTemplateView {
  const channel = foundation.channel;
  const providerKey = mapNotificationChannelToProvider(channel);
  const notificationType = foundation.notificationType ?? foundation.templateKey;
  const category = foundation.category;
  const enabledState = foundation.enabledState ?? "enabled";
  const subjectPreview =
    sanitizeNotificationTemplatePreviewContent(foundation.subjectPreview) ||
    "Notification template preview foundation";
  const bodyPreview =
    sanitizeNotificationTemplatePreviewContent(foundation.bodyPreview) ||
    "Notification template foundation summary only.";

  return {
    bodyPreview,
    category,
    categoryLabel: getNotificationCategoryLabel(category),
    channel,
    channelLabel: getNotificationChannelLabel(channel),
    createdAt: null,
    enabledState,
    notificationType,
    notificationTypeLabel: resolveNotificationTypeLabel(notificationType),
    previewState: resolveTemplatePreviewState({
      channel,
      enabledState,
      hasPreviewContent: Boolean(subjectPreview && bodyPreview)
    }),
    providerKey,
    providerLabel: getNotificationProviderLabel(providerKey),
    subjectPreview,
    templateKey: foundation.templateKey,
    templateName: foundation.templateName,
    updatedAt: null,
    usageCount: 0,
    ...overrides
  };
}

function inferTemplateFromKey(templateKey: string): NotificationTemplateFoundation {
  const foundation = NOTIFICATION_TEMPLATE_FOUNDATION.find((entry) => entry.templateKey === templateKey);
  if (foundation) return foundation;

  const channel: NotificationChannel = templateKey.startsWith("in_app:")
    ? "in_app"
    : templateKey.startsWith("system_alert:")
      ? "system_alert"
      : templateKey.startsWith("sms:")
        ? "sms"
        : templateKey.startsWith("whatsapp:")
          ? "whatsapp"
          : templateKey.startsWith("push:")
            ? "push"
            : "email";
  const rawType = templateKey.includes(":") ? templateKey.split(":").slice(1).join(":") : templateKey;
  const category = classifyNotificationCategoryFromSource(rawType);

  return {
    bodyPreview: `${templateKey.replace(/_/g, " ")} notification foundation summary. Variable placeholders only.`,
    category,
    channel,
    notificationType: rawType,
    subjectPreview: `${templateKey.replace(/_/g, " ")} notification preview foundation`,
    templateKey,
    templateName: templateKey.replace(/_/g, " ")
  };
}

export function buildNotificationTemplateRecordSafe(params: {
  createdAt?: string | null;
  disabled?: boolean;
  templateKey: string;
  updatedAt?: string | null;
  usageCount?: number;
}): NotificationTemplateView {
  try {
    const templateKey = parseNotificationTemplateKeySafe(params.templateKey);
    const foundation = inferTemplateFromKey(templateKey);
    const enabledState: NotificationTemplateEnabledState = params.disabled
      ? "disabled"
      : foundation.enabledState ?? "enabled";

    return buildTemplateViewFromFoundation(foundation, {
      createdAt: text(params.createdAt, 80) || null,
      enabledState,
      templateKey,
      updatedAt: text(params.updatedAt, 80) || null,
      usageCount: Math.max(0, params.usageCount ?? 0)
    });
  } catch (error) {
    console.error("[notification-template-runtime] template record build failed", error);
    return buildTemplateViewFromFoundation(
      NOTIFICATION_TEMPLATE_FOUNDATION.find((entry) => entry.templateKey === NOTIFICATION_TEMPLATE_FALLBACK_KEY)!,
      { usageCount: 0 }
    );
  }
}

type TemplateActivity = {
  createdAt: string | null;
  templateKey: string;
  updatedAt: string | null;
  usageCount: number;
};

function mergeTemplateActivity(
  activityByKey: Map<string, TemplateActivity>,
  templateKey: string,
  createdAt?: unknown
) {
  const key = parseNotificationTemplateKeySafe(templateKey);
  const timestamp = text(createdAt, 80) || null;
  const existing = activityByKey.get(key);

  if (!existing) {
    activityByKey.set(key, {
      createdAt: timestamp,
      templateKey: key,
      updatedAt: timestamp,
      usageCount: 1
    });
    return;
  }

  existing.usageCount += 1;

  if (timestamp && (!existing.createdAt || dateValue(timestamp) < dateValue(existing.createdAt))) {
    existing.createdAt = timestamp;
  }

  if (timestamp && (!existing.updatedAt || dateValue(timestamp) > dateValue(existing.updatedAt))) {
    existing.updatedAt = timestamp;
  }
}

export function buildNotificationTemplateViewsSafe(params: {
  disabledTemplateKeys?: string[] | null;
  emailLogs?: Array<{ created_at?: unknown; template_key?: unknown }> | null;
  notifications?: Array<{ created_at?: unknown; type?: unknown }> | null;
  registryItems?: Array<{
    createdAt?: string | null;
    notificationType?: string;
    registryType?: string;
    slug?: string;
    updatedAt?: string | null;
  }> | null;
}): { templates: NotificationTemplateView[]; warning: string | null } {
  try {
    const activityByKey = new Map<string, TemplateActivity>();
    const disabledKeys = new Set(
      (params.disabledTemplateKeys ?? [])
        .map((key) => parseNotificationTemplateKeySafe(key))
        .filter(Boolean)
    );

    for (const log of params.emailLogs ?? []) {
      mergeTemplateActivity(activityByKey, text(log.template_key, 160), log.created_at);
    }

    for (const notification of params.notifications ?? []) {
      const notificationType = text(notification.type, 160) || "system";
      mergeTemplateActivity(activityByKey, `in_app:${notificationType}`, notification.created_at);
    }

    for (const item of params.registryItems ?? []) {
      if (text(item.registryType, 80) !== "log_summary") continue;
      const templateKey = text(item.slug, 160) || `registry:${text(item.notificationType, 80)}`;
      mergeTemplateActivity(activityByKey, templateKey, item.createdAt ?? item.updatedAt);
    }

    const templatesByKey = new Map<string, NotificationTemplateView>();

    for (const foundation of NOTIFICATION_TEMPLATE_FOUNDATION) {
      const activity = activityByKey.get(foundation.templateKey);
      templatesByKey.set(
        foundation.templateKey,
        buildNotificationTemplateRecordSafe({
          createdAt: activity?.createdAt ?? null,
          disabled: disabledKeys.has(foundation.templateKey),
          templateKey: foundation.templateKey,
          updatedAt: activity?.updatedAt ?? null,
          usageCount: activity?.usageCount ?? 0
        })
      );
      activityByKey.delete(foundation.templateKey);
    }

    for (const [templateKey, activity] of activityByKey.entries()) {
      if (templatesByKey.has(templateKey)) continue;

      templatesByKey.set(
        templateKey,
        buildNotificationTemplateRecordSafe({
          createdAt: activity.createdAt,
          disabled: disabledKeys.has(templateKey),
          templateKey,
          updatedAt: activity.updatedAt,
          usageCount: activity.usageCount
        })
      );
    }

    return {
      templates: [...templatesByKey.values()].sort((left, right) => {
        if (right.usageCount !== left.usageCount) {
          return right.usageCount - left.usageCount;
        }

        return left.templateName.localeCompare(right.templateName);
      }),
      warning: null
    };
  } catch (error) {
    console.error("[notification-template-runtime] template views build failed", error);

    return {
      templates: NOTIFICATION_TEMPLATE_FOUNDATION.map((foundation) =>
        buildTemplateViewFromFoundation(foundation)
      ),
      warning: "Notification template views could not be built safely. Showing fallback template rows."
    };
  }
}

export function buildNotificationTemplateStatsSafe(
  templates: NotificationTemplateView[] | null | undefined
): NotificationTemplateStats {
  try {
    const snapshots = Array.isArray(templates) ? templates : [];

    return {
      disabledTemplates: snapshots.filter((template) => template.enabledState === "disabled").length,
      emailTemplates: snapshots.filter((template) => template.channel === "email").length,
      enabledTemplates: snapshots.filter((template) => template.enabledState === "enabled").length,
      inAppTemplates: snapshots.filter((template) => template.channel === "in_app").length,
      placeholderTemplates: snapshots.filter((template) => template.enabledState === "placeholder").length,
      previewReadyTemplates: snapshots.filter((template) => template.previewState === "preview_ready").length,
      systemTemplates: snapshots.filter((template) => template.channel === "system_alert").length,
      totalTemplates: snapshots.length,
      unknownTemplates: snapshots.filter((template) => template.templateKey === NOTIFICATION_TEMPLATE_FALLBACK_KEY)
        .length
    };
  } catch (error) {
    console.error("[notification-template-runtime] template stats build failed", error);

    return {
      disabledTemplates: 0,
      emailTemplates: 0,
      enabledTemplates: 0,
      inAppTemplates: 0,
      placeholderTemplates: 0,
      previewReadyTemplates: 0,
      systemTemplates: 0,
      totalTemplates: 0,
      unknownTemplates: 0
    };
  }
}

export function resolveNotificationTemplateLabel(value: unknown) {
  const templateKey = parseNotificationTemplateKeySafe(value);
  const foundation = NOTIFICATION_TEMPLATE_FOUNDATION.find((entry) => entry.templateKey === templateKey);
  return foundation?.templateName ?? templateKey.replace(/_/g, " ");
}

// NT-8+ placeholders: template editor, variable execution, and preview send stay disconnected.
export const NOTIFICATION_TEMPLATE_FUTURE_HOOKS = [
  "notification_template_editor",
  "notification_template_variable_execution",
  "notification_template_preview_send"
] as const;
