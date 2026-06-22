import "server-only";

import type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
import { getNotificationChannelLabel } from "@/src/lib/notifications/notification-channel-runtime";
import type { NotificationDeliveryRecord } from "@/src/lib/notifications/notification-delivery-runtime";
import { sanitizeNotificationDeliveryErrorSummary } from "@/src/lib/notifications/notification-delivery-runtime";
import type { NotificationDeliveryStatus } from "@/src/lib/notifications/notification-status-runtime";
import { getNotificationStatusLabel } from "@/src/lib/notifications/notification-status-runtime";
import {
  maskNotificationSecurityEmailSafe,
  maskNotificationSecurityIdentifierSafe,
  maskNotificationSecurityPhoneSafe,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

export type NotificationRecipientType =
  | "email"
  | "in_app"
  | "phone_placeholder"
  | "platform"
  | "store"
  | "unknown"
  | "user"
  | "workspace";

export type NotificationRecipientLogInput = {
  channel: NotificationChannel;
  channelLabel: string;
  createdAt: string;
  id: string;
  recipientMasked: string;
  status: NotificationDeliveryStatus;
  statusLabel: string;
  storeOrUser: string;
};

export type NotificationRecipientRecord = {
  createdAt: string | null;
  deliveryStatusSummary: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  notificationReference: string;
  preferredChannel: NotificationChannel;
  preferredChannelLabel: string;
  recipientId: string;
  recipientReference: string;
  recipientType: NotificationRecipientType;
  recipientTypeLabel: string;
  safeSummary: string;
  tenantReference: string;
  updatedAt: string | null;
};

export type NotificationRecipientRuntimeStats = {
  emailRecipients: number;
  inAppRecipients: number;
  phonePlaceholderRecipients: number;
  platformRecipients: number;
  storeRecipients: number;
  totalRecipients: number;
  unknownRecipients: number;
  userRecipients: number;
  workspaceRecipients: number;
};

export const NOTIFICATION_RECIPIENT_FALLBACK_ID = "unknown_notification_recipient" as const;

const recipientTypeLabels: Record<NotificationRecipientType, string> = {
  email: "Email recipient",
  in_app: "In-app recipient",
  phone_placeholder: "Phone placeholder",
  platform: "Platform recipient",
  store: "Store recipient",
  unknown: "Unknown recipient",
  user: "User recipient",
  workspace: "Workspace recipient"
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

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNotificationRecipientTypeLabel(type: NotificationRecipientType) {
  return recipientTypeLabels[type];
}

export function resolveNotificationRecipientTenantReferenceSafe(params: {
  event?: Record<string, unknown> | null;
  fallback?: unknown;
  notification?: Record<string, unknown> | null;
  storeOrUser?: unknown;
}): string {
  const storeOrUser = sanitizeNotificationAdminDisplayTextSafe(params.storeOrUser, 120);
  if (storeOrUser) {
    return storeOrUser;
  }

  const notification = params.notification;
  if (notification) {
    const storeId = text(notification.store_id, 80);
    const userId = text(notification.user_id, 80);
    const workspaceId = text(notification.workspace_id, 80);

    if (storeId) {
      return maskNotificationSecurityIdentifierSafe(storeId, "store");
    }

    if (userId) {
      return maskNotificationSecurityIdentifierSafe(userId, "user");
    }

    if (workspaceId) {
      return maskNotificationSecurityIdentifierSafe(workspaceId, "workspace");
    }
  }

  const event = params.event;
  if (event) {
    const storeId = text(event.store_id, 80);
    const userId = text(event.user_id, 80);

    if (storeId) {
      return maskNotificationSecurityIdentifierSafe(storeId, "store");
    }

    if (userId) {
      return maskNotificationSecurityIdentifierSafe(userId, "user");
    }
  }

  const fallback = sanitizeNotificationAdminDisplayTextSafe(params.fallback, 120);
  return fallback || "platform";
}

export function resolveNotificationRecipientTypeSafe(params: {
  channel: NotificationChannel;
  tenantReference: string;
}): NotificationRecipientType {
  const tenant = text(params.tenantReference, 120).toLowerCase();

  if (params.channel === "email") {
    return "email";
  }

  if (params.channel === "system_alert" || tenant === "platform" || tenant === "platform admins") {
    return "platform";
  }

  if (params.channel === "sms" || params.channel === "whatsapp") {
    return "phone_placeholder";
  }

  if (params.channel === "in_app") {
    if (tenant.startsWith("store:")) {
      return "store";
    }

    if (tenant.startsWith("user:")) {
      return "user";
    }

    if (tenant.startsWith("workspace:")) {
      return "workspace";
    }

    return "in_app";
  }

  if (tenant.startsWith("store:")) {
    return "store";
  }

  if (tenant.startsWith("user:")) {
    return "user";
  }

  if (tenant.startsWith("workspace:")) {
    return "workspace";
  }

  return "unknown";
}

function buildRecipientSafeSummary(params: {
  channel: NotificationChannel;
  deliveryStatusSummary: string;
  recipientType: NotificationRecipientType;
  tenantReference: string;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `${getNotificationRecipientTypeLabel(params.recipientType)} on ${getNotificationChannelLabel(params.channel)} channel.`,
      `Tenant reference ${params.tenantReference}.`,
      `Delivery status ${params.deliveryStatusSummary}.`,
      "Read-only masked recipient foundation only. No recipient lookup or delivery connected."
    ].join(" "),
    240
  );
}

function buildRecipientRecordFromLog(log: NotificationRecipientLogInput): NotificationRecipientRecord {
  const tenantReference = resolveNotificationRecipientTenantReferenceSafe({ storeOrUser: log.storeOrUser });
  const recipientType = resolveNotificationRecipientTypeSafe({
    channel: log.channel,
    tenantReference
  });
  const deliveryStatusSummary =
    sanitizeNotificationAdminDisplayTextSafe(log.statusLabel, 80) ||
    getNotificationStatusLabel(log.status);
  const recipientReference = sanitizeNotificationAdminDisplayTextSafe(log.recipientMasked, 120) || "Unknown recipient";
  const notificationReference =
    maskNotificationSecurityIdentifierSafe(log.id, "notification") || NOTIFICATION_RECIPIENT_FALLBACK_ID;
  const recipientId = maskNotificationSecurityIdentifierSafe(log.id, "recipient") || NOTIFICATION_RECIPIENT_FALLBACK_ID;
  const maskedEmail = log.channel === "email" ? maskNotificationSecurityEmailSafe(recipientReference) : null;
  const maskedPhone =
    log.channel === "sms" || log.channel === "whatsapp"
      ? maskNotificationSecurityPhoneSafe(null)
      : null;
  const createdAt = text(log.createdAt, 80) || null;

  return {
    createdAt,
    deliveryStatusSummary,
    maskedEmail,
    maskedPhone,
    notificationReference,
    preferredChannel: log.channel,
    preferredChannelLabel: text(log.channelLabel, 80) || getNotificationChannelLabel(log.channel),
    recipientId,
    recipientReference,
    recipientType,
    recipientTypeLabel: getNotificationRecipientTypeLabel(recipientType),
    safeSummary: buildRecipientSafeSummary({
      channel: log.channel,
      deliveryStatusSummary,
      recipientType,
      tenantReference
    }),
    tenantReference,
    updatedAt: createdAt
  };
}

function buildRecipientRecordFromDelivery(params: {
  delivery: NotificationDeliveryRecord;
  tenantReference?: string;
}): NotificationRecipientRecord {
  const tenantReference = resolveNotificationRecipientTenantReferenceSafe({
    fallback: params.tenantReference ?? "platform",
    storeOrUser: params.tenantReference
  });
  const recipientType = resolveNotificationRecipientTypeSafe({
    channel: params.delivery.channel,
    tenantReference
  });
  const deliveryStatusSummary =
    sanitizeNotificationAdminDisplayTextSafe(params.delivery.deliveryStatusLabel, 80) ||
    getNotificationStatusLabel(params.delivery.deliveryStatus);
  const recipientReference =
    sanitizeNotificationAdminDisplayTextSafe(params.delivery.recipientMasked, 120) || "Unknown recipient";
  const notificationReference =
    maskNotificationSecurityIdentifierSafe(params.delivery.notificationId, "notification") ||
    NOTIFICATION_RECIPIENT_FALLBACK_ID;
  const recipientId =
    maskNotificationSecurityIdentifierSafe(params.delivery.deliveryId, "recipient") ||
    NOTIFICATION_RECIPIENT_FALLBACK_ID;
  const maskedEmail = params.delivery.channel === "email" ? maskNotificationSecurityEmailSafe(recipientReference) : null;
  const maskedPhone =
    params.delivery.channel === "sms" || params.delivery.channel === "whatsapp"
      ? maskNotificationSecurityPhoneSafe(null)
      : null;

  return {
    createdAt: text(params.delivery.createdAt, 80) || null,
    deliveryStatusSummary,
    maskedEmail,
    maskedPhone,
    notificationReference,
    preferredChannel: params.delivery.channel,
    preferredChannelLabel: params.delivery.channelLabel,
    recipientId,
    recipientReference,
    recipientType,
    recipientTypeLabel: getNotificationRecipientTypeLabel(recipientType),
    safeSummary: buildRecipientSafeSummary({
      channel: params.delivery.channel,
      deliveryStatusSummary,
      recipientType,
      tenantReference
    }),
    tenantReference,
    updatedAt: text(params.delivery.updatedAt, 80) || text(params.delivery.createdAt, 80) || null
  };
}

export function buildNotificationRecipientFallbackRecordSafe(): NotificationRecipientRecord {
  return {
    createdAt: null,
    deliveryStatusSummary: "Unknown",
    maskedEmail: null,
    maskedPhone: null,
    notificationReference: NOTIFICATION_RECIPIENT_FALLBACK_ID,
    preferredChannel: "in_app",
    preferredChannelLabel: getNotificationChannelLabel("in_app"),
    recipientId: NOTIFICATION_RECIPIENT_FALLBACK_ID,
    recipientReference: "Unknown recipient",
    recipientType: "unknown",
    recipientTypeLabel: getNotificationRecipientTypeLabel("unknown"),
    safeSummary:
      "Notification recipient foundation placeholder only. No recipient lookup, delivery, or contact resolution connected.",
    tenantReference: "platform",
    updatedAt: null
  };
}

export function buildNotificationRecipientRecordsSafe(params: {
  deliveries?: NotificationDeliveryRecord[] | null;
  logs?: NotificationRecipientLogInput[] | null;
}): { recipientItems: NotificationRecipientRecord[]; warning: string | null } {
  try {
    const logs = Array.isArray(params.logs) ? params.logs : [];
    const deliveries = Array.isArray(params.deliveries) ? params.deliveries : [];

    if (logs.length) {
      const recipientItems = logs
        .map((log) => buildRecipientRecordFromLog(log))
        .sort((left, right) => dateValue(right.createdAt ?? "") - dateValue(left.createdAt ?? ""));

      return {
        recipientItems,
        warning: null
      };
    }

    if (deliveries.length) {
      const recipientItems = deliveries
        .filter((delivery) => delivery.deliveryId !== "unknown_notification_delivery")
        .map((delivery) => buildRecipientRecordFromDelivery({ delivery }))
        .sort((left, right) => dateValue(right.createdAt ?? "") - dateValue(left.createdAt ?? ""));

      if (recipientItems.length) {
        return {
          recipientItems,
          warning: null
        };
      }
    }

    return {
      recipientItems: [buildNotificationRecipientFallbackRecordSafe()],
      warning: null
    };
  } catch (error) {
    console.error("[notification-recipient-runtime] recipient records build failed", error);

    return {
      recipientItems: [buildNotificationRecipientFallbackRecordSafe()],
      warning: "Notification recipient runtime fallback applied."
    };
  }
}

export function buildNotificationRecipientRuntimeStatsSafe(
  recipientItems: NotificationRecipientRecord[] | null | undefined
): NotificationRecipientRuntimeStats {
  try {
    const items = Array.isArray(recipientItems) ? recipientItems : [];

    return {
      emailRecipients: items.filter((item) => item.recipientType === "email").length,
      inAppRecipients: items.filter((item) => item.recipientType === "in_app").length,
      phonePlaceholderRecipients: items.filter((item) => item.recipientType === "phone_placeholder").length,
      platformRecipients: items.filter((item) => item.recipientType === "platform").length,
      storeRecipients: items.filter((item) => item.recipientType === "store").length,
      totalRecipients: items.length,
      unknownRecipients: items.filter((item) => item.recipientType === "unknown").length,
      userRecipients: items.filter((item) => item.recipientType === "user").length,
      workspaceRecipients: items.filter((item) => item.recipientType === "workspace").length
    };
  } catch (error) {
    console.error("[notification-recipient-runtime] recipient runtime stats build failed", error);

    return {
      emailRecipients: 0,
      inAppRecipients: 0,
      phonePlaceholderRecipients: 0,
      platformRecipients: 0,
      storeRecipients: 0,
      totalRecipients: 0,
      unknownRecipients: 0,
      userRecipients: 0,
      workspaceRecipients: 0
    };
  }
}

export function listNotificationRecipientTypeCatalog() {
  return (Object.keys(recipientTypeLabels) as NotificationRecipientType[]).map((type) => ({
    description: `Read-only masked ${recipientTypeLabels[type].toLowerCase()} visibility for Super Admin.`,
    label: recipientTypeLabels[type],
    type
  }));
}

export function sanitizeNotificationRecipientDisplaySafe(value: unknown, maxLength = 120) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  if (!cleaned) {
    return "Unknown recipient";
  }

  const errorSanitized = sanitizeNotificationDeliveryErrorSummary(cleaned);
  return errorSanitized ?? cleaned;
}

// NT-19+ placeholders: recipient lookup, enrichment, and delivery stay disconnected.
export const NOTIFICATION_RECIPIENT_FUTURE_HOOKS = [
  "notification_recipient_lookup",
  "notification_recipient_enrichment",
  "notification_recipient_delivery"
] as const;
