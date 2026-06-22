import "server-only";

import { summarizeUserAgent } from "@/lib/security/user-agent";
import {
  sanitizeNotificationDeliveryErrorSummary
} from "@/src/lib/notifications/notification-delivery-runtime";

export type NotificationAuditActorType = "platform" | "super_admin" | "system" | "unknown";

export type NotificationAuditRecord = {
  action: string;
  actionLabel: string;
  actorIdReference: string;
  actorType: NotificationAuditActorType;
  auditId: string;
  createdAt: string | null;
  ipReference: string;
  metadataSummary: string;
  notificationId: string;
  safeSummary: string;
  targetIdReference: string;
  targetType: string;
  userAgentSummary: string;
};

export type NotificationAuditRuntimeStats = {
  disableTemplateActions: number;
  markReviewedActions: number;
  platformActions: number;
  retryPlaceholderActions: number;
  superAdminActions: number;
  systemActions: number;
  totalAuditItems: number;
  unknownActions: number;
  viewDetailsActions: number;
};

export const NOTIFICATION_AUDIT_ACTIONS = [
  "admin_notification_details_viewed",
  "admin_notification_disable_template",
  "admin_notification_mark_reviewed",
  "admin_notification_retry_placeholder"
] as const;

export type NotificationAuditAction = (typeof NOTIFICATION_AUDIT_ACTIONS)[number];

const actionLabels: Record<NotificationAuditAction, string> = {
  admin_notification_details_viewed: "View details placeholder",
  admin_notification_disable_template: "Disable template placeholder",
  admin_notification_mark_reviewed: "Mark reviewed placeholder",
  admin_notification_retry_placeholder: "Retry placeholder"
};

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

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

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function maskEntityReference(value: unknown, prefix: string) {
  const raw = text(value, 80);
  if (!raw) return `${prefix}:unknown`;
  if (raw.length <= 8) return `${prefix}:${raw.slice(0, 2)}***`;
  return `${prefix}:${raw.slice(0, 8)}...`;
}

export function maskNotificationAuditIpReference(value: unknown) {
  const raw = text(value, 120);
  if (!raw) {
    return "Not recorded";
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:****`;
  }

  const parts = raw.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return "[masked-ip]";
}

export function sanitizeNotificationAuditUserAgent(value: unknown) {
  const raw = text(value, 240);
  if (!raw || secretPattern.test(raw)) {
    return "Not recorded";
  }

  const { browserLabel, deviceLabel } = summarizeUserAgent(raw);
  return `${browserLabel} · ${deviceLabel}`;
}

export function sanitizeNotificationAuditSummary(value: unknown) {
  const cleaned = sanitizeNotificationDeliveryErrorSummary(value);
  return cleaned || "Notification governance action recorded.";
}

export function sanitizeNotificationAuditMetadata(value: unknown) {
  if (!isRecord(value)) {
    return "No safe metadata recorded.";
  }

  const safeEntries: string[] = [];
  const channel = text(value.channel, 80);
  const notificationType = text(value.notification_type, 80);
  const source = text(value.source, 80);
  const note = sanitizeNotificationAuditSummary(value.note);

  if (channel) safeEntries.push(`channel=${channel}`);
  if (notificationType) safeEntries.push(`notification_type=${notificationType}`);
  if (source) safeEntries.push(`source=${source}`);
  if (note) safeEntries.push(`note=${note}`);

  return safeEntries.length ? safeEntries.join(" · ") : "No safe metadata recorded.";
}

export function getNotificationAuditActionLabel(action: string) {
  if (actionLabels[action as NotificationAuditAction]) {
    return actionLabels[action as NotificationAuditAction];
  }

  return action.replace(/^admin_notification_/, "").replace(/_/g, " ") || "Unknown action";
}

export function parseNotificationAuditActorType(event: Record<string, unknown>) {
  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const source = text(metadata.source, 80).toLowerCase();

  if (text(event.user_id, 80) || source.includes("super_admin")) {
    return "super_admin" as const;
  }

  if (source.includes("platform")) {
    return "platform" as const;
  }

  if (text(event.event_type, 80)) {
    return "system" as const;
  }

  return "unknown" as const;
}

function isNotificationAuditEvent(event: Record<string, unknown>) {
  const eventType = text(event.event_type, 160);
  const entityType = text(event.entity_type, 160);

  return (
    entityType === "admin_notification_center" ||
    eventType.startsWith("admin_notification_") ||
    NOTIFICATION_AUDIT_ACTIONS.includes(eventType as NotificationAuditAction)
  );
}

function buildAuditRecordFromMonitoringEvent(event: Record<string, unknown>): NotificationAuditRecord | null {
  if (!isNotificationAuditEvent(event)) {
    return null;
  }

  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const action = text(event.event_type, 160) || "unknown_notification_audit_action";
  const notificationId = text(metadata.notification_id, 160) || text(event.entity_id, 160) || "unknown_notification";
  const channel = text(metadata.channel, 80) || "notification";
  const templateKey = text(metadata.template_key, 160);
  const actorType = parseNotificationAuditActorType(event);
  const actorIdReference =
    actorType === "super_admin"
      ? maskEntityReference(event.user_id, "user")
      : actorType === "platform"
        ? "platform"
        : "system";

  const targetType = templateKey ? "notification_template" : channel ? "notification_channel" : "notification";
  const targetIdReference = templateKey
    ? maskEntityReference(templateKey, "template")
    : maskEntityReference(notificationId, "notification");

  return {
    action,
    actionLabel: getNotificationAuditActionLabel(action),
    actorIdReference,
    actorType,
    auditId: text(event.id, 160) || `audit:${text(event.created_at, 80)}`,
    createdAt: text(event.created_at, 80) || null,
    ipReference: maskNotificationAuditIpReference(metadata.ip_address ?? metadata.ip),
    metadataSummary: sanitizeNotificationAuditMetadata(metadata),
    notificationId,
    safeSummary: sanitizeNotificationAuditSummary(metadata.note ?? metadata.summary ?? action),
    targetIdReference,
    targetType,
    userAgentSummary: sanitizeNotificationAuditUserAgent(metadata.user_agent ?? metadata.userAgent)
  };
}

export function buildNotificationAuditRecordsSafe(params: {
  monitoringEvents?: Array<Record<string, unknown>> | null;
}): { auditItems: NotificationAuditRecord[]; warning: string | null } {
  try {
    const auditItems = (params.monitoringEvents ?? [])
      .map((event) => buildAuditRecordFromMonitoringEvent(event))
      .filter((record): record is NotificationAuditRecord => Boolean(record))
      .sort((left, right) => dateValue(right.createdAt ?? "") - dateValue(left.createdAt ?? ""))
      .slice(0, 100);

    return {
      auditItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-audit-runtime] audit records build failed", error);

    return {
      auditItems: [],
      warning: "Notification audit records could not be built safely. Showing empty audit state."
    };
  }
}

export function buildNotificationAuditRuntimeStatsSafe(
  auditItems: NotificationAuditRecord[] | null | undefined
): NotificationAuditRuntimeStats {
  try {
    const snapshots = Array.isArray(auditItems) ? auditItems : [];

    return {
      disableTemplateActions: snapshots.filter((record) => record.action === "admin_notification_disable_template")
        .length,
      markReviewedActions: snapshots.filter((record) => record.action === "admin_notification_mark_reviewed").length,
      platformActions: snapshots.filter((record) => record.actorType === "platform").length,
      retryPlaceholderActions: snapshots.filter((record) => record.action === "admin_notification_retry_placeholder")
        .length,
      superAdminActions: snapshots.filter((record) => record.actorType === "super_admin").length,
      systemActions: snapshots.filter((record) => record.actorType === "system").length,
      totalAuditItems: snapshots.length,
      unknownActions: snapshots.filter((record) => record.actionLabel === "Unknown action").length,
      viewDetailsActions: snapshots.filter((record) => record.action === "admin_notification_details_viewed").length
    };
  } catch (error) {
    console.error("[notification-audit-runtime] audit stats build failed", error);

    return {
      disableTemplateActions: 0,
      markReviewedActions: 0,
      platformActions: 0,
      retryPlaceholderActions: 0,
      superAdminActions: 0,
      systemActions: 0,
      totalAuditItems: 0,
      unknownActions: 0,
      viewDetailsActions: 0
    };
  }
}

export function listNotificationAuditActionCatalog() {
  return NOTIFICATION_AUDIT_ACTIONS.map((action) => ({
    action,
    label: getNotificationAuditActionLabel(action)
  }));
}

// NT-13+ placeholders: audit export, retention, and immutable storage stay disconnected.
export const NOTIFICATION_AUDIT_FUTURE_HOOKS = [
  "notification_audit_export",
  "notification_audit_retention",
  "notification_audit_immutable_storage"
] as const;
