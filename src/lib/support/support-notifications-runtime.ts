import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { classifyNotificationCategoryFromSource } from "@/src/lib/notifications/notification-category-runtime";
import {
  buildNotificationDeliveryRecordsSafe,
  NOTIFICATION_DELIVERY_FALLBACK_ID,
  type NotificationDeliveryRecord
} from "@/src/lib/notifications/notification-delivery-runtime";
import { getNotificationStatusLabel } from "@/src/lib/notifications/notification-status-runtime";
import type { SupportAuditRuntimeItem } from "@/src/lib/support/support-audit-runtime";
import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type { SupportSafeActionsRuntimeSummary } from "@/src/lib/support/support-safe-actions-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import {
  type SupportRecordVisibilityState,
  type SupportVisibilityAuthorization
} from "@/src/lib/support/support-visibility-runtime";

export type SupportNotificationsRuntimeSource = "support_notifications_runtime";

export type SupportNotificationCategory =
  | "error_event"
  | "monitoring_event"
  | "review_requires_attention"
  | "ticket_assigned"
  | "ticket_conversation_added"
  | "ticket_created"
  | "ticket_status_changed"
  | "ticket_unassigned";

export type SupportNotificationSeverity = "critical" | "high" | "info" | "low" | "warning";

export type SupportNotificationReadStatus = "not_applicable" | "read" | "unread" | "unknown";

export type SupportNotificationRecordSource =
  | "certified_notifications_runtime"
  | "support_audit_signal"
  | "support_error_signal"
  | "support_monitoring_signal"
  | "support_review_signal";

export type SupportNotificationLoadingState = "empty" | "error" | "loaded" | "restricted" | "unauthorized";

export type SupportNotificationSafeControlKey = "enqueue" | "retry" | "send";

export type SupportNotificationSafeControl = {
  enabled: false;
  key: SupportNotificationSafeControlKey;
  label: string;
  note: string;
};

export type SupportNotificationRuntimeItem = {
  category: SupportNotificationCategory;
  categoryLabel: string;
  createdAt: string;
  deliveryStatus: string;
  deliveryStatusLabel: string;
  notificationId: string;
  notificationItemKey: string;
  readStatus: SupportNotificationReadStatus;
  recordSource: SupportNotificationRecordSource;
  registryKey: "sp-notifications";
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  safeSummary: string;
  severity: SupportNotificationSeverity;
  targetResourceId: string;
  targetResourceType: string;
  visibilityState: SupportRecordVisibilityState;
};

export type SupportNotificationRuntimeGroup = {
  category: SupportNotificationCategory;
  categoryLabel: string;
  itemCount: number;
  items: SupportNotificationRuntimeItem[];
};

export type SupportNotificationRuntimeSummary = {
  categoryCounts: Array<{ category: SupportNotificationCategory; count: number; label: string }>;
  certifiedDeliveryCount: number;
  emptyMessage: string | null;
  groupCount: number;
  hiddenRecordCount: number;
  loadError: string | null;
  loadingState: SupportNotificationLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedRecordCount: number;
  signalRecordCount: number;
  source: SupportNotificationsRuntimeSource;
  status: "load_error" | "needs_attention" | "notifications_empty" | "notifications_runtime_ready" | "unauthorized";
  summary: string;
  unauthorizedMessage: string | null;
  visibleRecordCount: number;
};

export type SupportNotificationsAuthorization = {
  canViewNotifications: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

export const SUPPORT_NOTIFICATIONS_RUNTIME_SOURCE = "support_notifications_runtime" as const;

export const SUPPORT_NOTIFICATION_CATEGORIES: readonly SupportNotificationCategory[] = [
  "ticket_created",
  "ticket_assigned",
  "ticket_unassigned",
  "ticket_status_changed",
  "ticket_conversation_added",
  "monitoring_event",
  "error_event",
  "review_requires_attention"
] as const;

export const SUPPORT_NOTIFICATION_SAFE_CONTROLS: readonly SupportNotificationSafeControl[] = [
  {
    enabled: false,
    key: "send",
    label: "Send Notification",
    note: "Read-only placeholder. No notification send runs during SP-18 page load."
  },
  {
    enabled: false,
    key: "enqueue",
    label: "Enqueue Delivery",
    note: "Read-only placeholder. No queue enqueue runs during SP-18 page load."
  },
  {
    enabled: false,
    key: "retry",
    label: "Retry Delivery",
    note: "Read-only placeholder. No delivery retry runs during SP-18 page load."
  }
] as const;

const NOTIFICATION_COLUMNS =
  "id, user_id, workspace_id, store_id, type, title, status, read_at, created_at";

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function buildSafeControls() {
  return SUPPORT_NOTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

export function resolveSupportNotificationsAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportNotificationsAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewNotifications: true,
      reason: "Super Admin may view Support notification records through read-only runtime queries.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewNotifications: false,
    reason: "Support notifications are restricted to Super Admin in SP-18.",
    roleLabel: input.role
  };
}

export function supportNotificationCategoryLabel(category: SupportNotificationCategory): string {
  switch (category) {
    case "ticket_created":
      return "Ticket Created";
    case "ticket_assigned":
      return "Ticket Assigned";
    case "ticket_unassigned":
      return "Ticket Unassigned";
    case "ticket_status_changed":
      return "Ticket Status Changed";
    case "ticket_conversation_added":
      return "Ticket Conversation Added";
    case "monitoring_event":
      return "Monitoring Event";
    case "error_event":
      return "Error Event";
    case "review_requires_attention":
      return "Review Requires Attention";
  }
}

export function supportNotificationSeverityBadgeTone(
  severity: SupportNotificationSeverity
): "amber" | "blue" | "green" | "red" | "slate" {
  switch (severity) {
    case "critical":
      return "red";
    case "high":
      return "amber";
    case "warning":
      return "amber";
    case "low":
      return "slate";
    case "info":
      return "blue";
  }
}

export function supportNotificationsRuntimeStatusBadgeTone(
  status: SupportNotificationRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "notifications_runtime_ready":
      return "green";
    case "notifications_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

function isSupportNotificationRow(row: AnyRecord) {
  const type = text(row.type, 120).toLowerCase();
  const title = text(row.title, 120).toLowerCase();
  const combined = `${type} ${title}`;

  if (type === "support" || combined.includes("support") || combined.includes("ticket")) {
    return true;
  }

  return classifyNotificationCategoryFromSource(combined) === "support";
}

function mapDeliveryTemplateToCategory(templateKey: string, deliveryStatus: string): SupportNotificationCategory {
  const normalized = templateKey.toLowerCase();

  if (normalized.includes("assign") && !normalized.includes("unassign")) {
    return "ticket_assigned";
  }

  if (normalized.includes("unassign")) {
    return "ticket_unassigned";
  }

  if (normalized.includes("status")) {
    return "ticket_status_changed";
  }

  if (normalized.includes("conversation") || normalized.includes("message")) {
    return "ticket_conversation_added";
  }

  if (normalized.includes("create") || normalized.includes("created")) {
    return "ticket_created";
  }

  if (normalized.includes("review")) {
    return "review_requires_attention";
  }

  if (normalized.includes("error")) {
    return "error_event";
  }

  if (normalized.includes("monitor")) {
    return "monitoring_event";
  }

  if (deliveryStatus === "failed") {
    return "error_event";
  }

  return "ticket_created";
}

function mapAuditActionToCategory(actionType: SupportAuditRuntimeItem["actionType"]): SupportNotificationCategory | null {
  switch (actionType) {
    case "ticket_status_change":
      return "ticket_status_changed";
    case "ticket_assignment_change":
      return "ticket_assigned";
    case "ticket_unassignment_change":
      return "ticket_unassigned";
    case "ticket_conversation_message_create":
      return "ticket_conversation_added";
    case "monitoring_event_link":
      return "monitoring_event";
    case "error_event_link":
      return "error_event";
    case "safe_action_attempt":
      return "review_requires_attention";
    default:
      return null;
  }
}

function resolveReadStatus(delivery: NotificationDeliveryRecord): SupportNotificationReadStatus {
  if (delivery.readAt) {
    return "read";
  }

  if (delivery.deliveryStatus === "read") {
    return "read";
  }

  if (["draft", "queued", "sent", "delivered"].includes(delivery.deliveryStatus)) {
    return "unread";
  }

  return "unknown";
}

function resolveSeverity(category: SupportNotificationCategory, deliveryStatus: string): SupportNotificationSeverity {
  if (category === "error_event" || category === "review_requires_attention") {
    return deliveryStatus === "failed" ? "critical" : "high";
  }

  if (category === "monitoring_event") {
    return "warning";
  }

  if (deliveryStatus === "failed") {
    return "high";
  }

  return "info";
}

function buildTicketLookup(tickets: SupportTicketRuntimeItem[]) {
  return new Map(
    tickets
      .filter((ticket) => ticket.ticketId)
      .map((ticket) => [ticket.ticketId, ticket.ticketNumber || ticket.ticketId])
  );
}

function buildNotificationItem(
  input: Omit<SupportNotificationRuntimeItem, "categoryLabel" | "notificationItemKey" | "safeSummary" | "visibilityState"> & {
    visibilityState?: SupportRecordVisibilityState;
  }
): SupportNotificationRuntimeItem {
  return {
    ...input,
    categoryLabel: supportNotificationCategoryLabel(input.category),
    notificationItemKey: `support-notification-${input.notificationId}`,
    safeSummary: [
      supportNotificationCategoryLabel(input.category),
      `severity ${input.severity}`,
      `delivery ${input.deliveryStatusLabel}`,
      `read ${input.readStatus}`,
      input.relatedTicketNumber ? `ticket ${input.relatedTicketNumber}` : "ticket n/a",
      `source ${input.recordSource}`
    ].join("; "),
    visibilityState: input.visibilityState ?? "visible"
  };
}

function buildFromCertifiedDelivery(
  delivery: NotificationDeliveryRecord,
  ticketLookup: Map<string, string>
): SupportNotificationRuntimeItem {
  const category = mapDeliveryTemplateToCategory(delivery.templateKey, delivery.deliveryStatus);
  const relatedTicketId = delivery.notificationId.startsWith("in_app:")
    ? null
    : text(delivery.notificationId, 80) || null;

  return buildNotificationItem({
    category,
    createdAt: delivery.createdAt ?? "",
    deliveryStatus: delivery.deliveryStatus,
    deliveryStatusLabel: delivery.deliveryStatusLabel || getNotificationStatusLabel(delivery.deliveryStatus),
    notificationId: delivery.notificationId,
    readStatus: resolveReadStatus(delivery),
    recordSource: "certified_notifications_runtime",
    registryKey: "sp-notifications",
    relatedTicketId,
    relatedTicketNumber: relatedTicketId ? ticketLookup.get(relatedTicketId) ?? relatedTicketId : null,
    severity: resolveSeverity(category, delivery.deliveryStatus),
    targetResourceId: delivery.deliveryId,
    targetResourceType: delivery.channelLabel
  });
}

function buildFromAuditSignal(
  audit: SupportAuditRuntimeItem,
  ticketLookup: Map<string, string>
): SupportNotificationRuntimeItem | null {
  const category = mapAuditActionToCategory(audit.actionType);

  if (!category) {
    return null;
  }

  return buildNotificationItem({
    category,
    createdAt: audit.createdAt,
    deliveryStatus: "audit_recorded",
    deliveryStatusLabel: "Audit recorded (no dispatch)",
    notificationId: `audit-signal:${audit.auditId}`,
    readStatus: "not_applicable",
    recordSource: "support_audit_signal",
    registryKey: "sp-notifications",
    relatedTicketId: audit.relatedTicketId,
    relatedTicketNumber:
      audit.relatedTicketNumber ??
      (audit.relatedTicketId ? ticketLookup.get(audit.relatedTicketId) ?? audit.relatedTicketId : null),
    severity: resolveSeverity(category, audit.resultStatus),
    targetResourceId: audit.targetRecordId,
    targetResourceType: audit.targetRecordType
  });
}

function buildFromReviewSignal(review: SupportReviewRuntimeItem): SupportNotificationRuntimeItem | null {
  if (review.reviewStatus !== "review_required" && review.reviewStatus !== "blocked") {
    return null;
  }

  return buildNotificationItem({
    category: "review_requires_attention",
    createdAt: review.detectedAt,
    deliveryStatus: "review_signal",
    deliveryStatusLabel: "Review signal (no dispatch)",
    notificationId: `review-signal:${review.reviewItemId}`,
    readStatus: "not_applicable",
    recordSource: "support_review_signal",
    registryKey: "sp-notifications",
    relatedTicketId: review.recordType === "ticket" ? review.recordId : null,
    relatedTicketNumber: review.recordType === "ticket" ? review.recordId : null,
    severity: review.riskLevel === "critical" ? "critical" : "high",
    targetResourceId: review.recordId,
    targetResourceType: review.recordType
  });
}

function buildFromMonitoringSignal(
  event: SupportMonitoringEventRuntimeItem,
  ticketLookup: Map<string, string>
): SupportNotificationRuntimeItem {
  const relatedTicketId = event.relatedTicketId ?? null;

  return buildNotificationItem({
    category: "monitoring_event",
    createdAt: event.createdAt,
    deliveryStatus: "signal_recorded",
    deliveryStatusLabel: "Monitoring signal (no dispatch)",
    notificationId: `monitoring-signal:${event.eventId}`,
    readStatus: "not_applicable",
    recordSource: "support_monitoring_signal",
    registryKey: "sp-notifications",
    relatedTicketId,
    relatedTicketNumber: relatedTicketId ? ticketLookup.get(relatedTicketId) ?? relatedTicketId : null,
    severity: "warning",
    targetResourceId: event.eventId,
    targetResourceType: "monitoring_event"
  });
}

function buildFromErrorSignal(
  event: SupportErrorEventRuntimeItem,
  ticketLookup: Map<string, string>
): SupportNotificationRuntimeItem {
  const relatedTicketId = event.relatedTicketId ?? null;

  return buildNotificationItem({
    category: "error_event",
    createdAt: event.createdAt,
    deliveryStatus: "signal_recorded",
    deliveryStatusLabel: "Error signal (no dispatch)",
    notificationId: `error-signal:${event.errorId}`,
    readStatus: "not_applicable",
    recordSource: "support_error_signal",
    registryKey: "sp-notifications",
    relatedTicketId,
    relatedTicketNumber: relatedTicketId ? ticketLookup.get(relatedTicketId) ?? relatedTicketId : null,
    severity: "critical",
    targetResourceId: event.errorId,
    targetResourceType: "error_event"
  });
}

function classifyNotificationVisibility(input: {
  authorization: SupportVisibilityAuthorization;
  item: SupportNotificationRuntimeItem;
  visibleTicketIds: Set<string>;
}): SupportRecordVisibilityState {
  if (!input.authorization.canViewSupportData) {
    return "hidden";
  }

  if (input.item.relatedTicketId && !input.visibleTicketIds.has(input.item.relatedTicketId)) {
    return "restricted";
  }

  return "visible";
}

function applySupportNotificationsVisibility(input: {
  authorization: SupportVisibilityAuthorization;
  items: SupportNotificationRuntimeItem[];
  visibleTickets: SupportTicketRuntimeItem[];
}) {
  const visibleTicketIds = new Set(input.visibleTickets.map((ticket) => ticket.ticketId).filter(Boolean));
  const visibleItems: SupportNotificationRuntimeItem[] = [];
  let hiddenRecordCount = 0;
  let restrictedRecordCount = 0;

  for (const item of input.items) {
    const visibilityState = classifyNotificationVisibility({
      authorization: input.authorization,
      item,
      visibleTicketIds
    });
    const nextItem = { ...item, visibilityState };

    if (visibilityState === "visible") {
      visibleItems.push(nextItem);
      continue;
    }

    if (visibilityState === "restricted") {
      restrictedRecordCount += 1;
      continue;
    }

    hiddenRecordCount += 1;
  }

  return {
    hiddenRecordCount,
    restrictedRecordCount,
    visibleItems
  };
}

function buildCategoryCounts(items: SupportNotificationRuntimeItem[]) {
  const counts = new Map<SupportNotificationCategory, number>();

  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  return SUPPORT_NOTIFICATION_CATEGORIES.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
    label: supportNotificationCategoryLabel(category)
  })).filter((entry) => entry.count > 0);
}

function buildNotificationGroups(items: SupportNotificationRuntimeItem[]): SupportNotificationRuntimeGroup[] {
  return SUPPORT_NOTIFICATION_CATEGORIES.map((category) => {
    const groupItems = items.filter((item) => item.category === category);

    return {
      category,
      categoryLabel: supportNotificationCategoryLabel(category),
      itemCount: groupItems.length,
      items: groupItems
    };
  }).filter((group) => group.itemCount > 0);
}

export async function loadSupportNotificationsRuntimeReadOnlySafe(params: {
  authorization: SupportNotificationsAuthorization;
  loadError?: string | null;
  safeActionsRuntime: Pick<SupportSafeActionsRuntimeSummary, "status" | "summary">;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibleAuditItems: SupportAuditRuntimeItem[];
  visibleErrorEvents: SupportErrorEventRuntimeItem[];
  visibleMonitoringEvents: SupportMonitoringEventRuntimeItem[];
  visibleReviewItems: SupportReviewRuntimeItem[];
  visibleTickets: SupportTicketRuntimeItem[];
}) {
  const emptySummary: SupportNotificationRuntimeSummary = {
    categoryCounts: [],
    certifiedDeliveryCount: 0,
    emptyMessage: "Support notifications are hidden for the current account.",
    groupCount: 0,
    hiddenRecordCount: 0,
    loadError: null,
    loadingState: "unauthorized",
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage: null,
    restrictedRecordCount: 0,
    signalRecordCount: 0,
    source: SUPPORT_NOTIFICATIONS_RUNTIME_SOURCE,
    status: "unauthorized",
    summary: params.authorization.reason,
    unauthorizedMessage: "Support notifications are Super Admin only. No notification dispatch runs during page load.",
    visibleRecordCount: 0
  };

  if (!params.authorization.canViewNotifications || !params.visibilityAuthorization.canViewSupportData) {
    return {
      supportNotificationsRuntime: emptySummary,
      supportNotificationsRuntimeGroups: [] as SupportNotificationRuntimeGroup[],
      supportNotificationsRuntimeItems: [] as SupportNotificationRuntimeItem[],
      supportNotificationsSafeControls: buildSafeControls(),
      visibleSupportNotificationsRuntimeItems: [] as SupportNotificationRuntimeItem[]
    };
  }

  if (!params.supabase || params.loadError) {
    const errorSummary: SupportNotificationRuntimeSummary = {
      ...emptySummary,
      emptyMessage: null,
      loadError: params.loadError ?? "Admin client unavailable",
      loadingState: "error",
      status: "load_error",
      summary: params.loadError ?? "Admin client unavailable",
      unauthorizedMessage: null
    };

    return {
      supportNotificationsRuntime: errorSummary,
      supportNotificationsRuntimeGroups: [],
      supportNotificationsRuntimeItems: [],
      supportNotificationsSafeControls: buildSafeControls(),
      visibleSupportNotificationsRuntimeItems: []
    };
  }

  const notificationsLoad = await params.supabase
    .from("notifications" as never)
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);

  const supportNotificationRows = (Array.isArray(notificationsLoad.data) ? notificationsLoad.data : []).filter(
    (row) => isSupportNotificationRow(row as AnyRecord)
  );

  const selectedTicketId = params.selectedTicketId?.trim() || null;
  const filteredSupportRows = selectedTicketId
    ? supportNotificationRows.filter((row) => {
        const record = row as AnyRecord;
        const id = text(record.id, 80);
        const storeId = text(record.store_id, 80);
        const title = text(record.title, 120).toLowerCase();
        return id === selectedTicketId || title.includes(selectedTicketId.slice(0, 8).toLowerCase()) || storeId === selectedTicketId;
      })
    : supportNotificationRows;

  const deliveryViews = buildNotificationDeliveryRecordsSafe({
    notifications: filteredSupportRows as AnyRecord[]
  });
  const certifiedDeliveries = deliveryViews.deliveries.filter(
    (delivery) => delivery.deliveryId !== NOTIFICATION_DELIVERY_FALLBACK_ID
  );
  const ticketLookup = buildTicketLookup(params.visibleTickets);

  const certifiedItems = certifiedDeliveries.map((delivery) => buildFromCertifiedDelivery(delivery, ticketLookup));
  const auditItems = params.visibleAuditItems
    .map((audit) => buildFromAuditSignal(audit, ticketLookup))
    .filter((item): item is SupportNotificationRuntimeItem => item !== null);
  const reviewItems = params.visibleReviewItems
    .map((review) => buildFromReviewSignal(review))
    .filter((item): item is SupportNotificationRuntimeItem => item !== null);
  const monitoringItems = params.visibleMonitoringEvents
    .slice(0, 20)
    .map((event) => buildFromMonitoringSignal(event, ticketLookup));
  const errorItems = params.visibleErrorEvents.slice(0, 20).map((event) => buildFromErrorSignal(event, ticketLookup));

  const mergedItems = [...certifiedItems, ...auditItems, ...reviewItems, ...monitoringItems, ...errorItems]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 200);

  const visibilityGate = applySupportNotificationsVisibility({
    authorization: params.visibilityAuthorization,
    items: mergedItems,
    visibleTickets: params.visibleTickets
  });

  const loadError = notificationsLoad.error?.message ?? deliveryViews.warning ?? null;
  const loadingState: SupportNotificationLoadingState = loadError
    ? "error"
    : visibilityGate.visibleItems.length === 0
      ? visibilityGate.restrictedRecordCount > 0
        ? "restricted"
        : "empty"
      : "loaded";
  const registryEntry = getSupportRegistryEntry("sp-notifications");
  const signalRecordCount = visibilityGate.visibleItems.filter(
    (item) => item.recordSource !== "certified_notifications_runtime"
  ).length;
  const status = loadError
    ? ("load_error" as const)
    : visibilityGate.visibleItems.length === 0
      ? ("notifications_empty" as const)
      : signalRecordCount > 0 && certifiedDeliveries.length === 0
        ? ("needs_attention" as const)
        : ("notifications_runtime_ready" as const);

  const supportNotificationsRuntime: SupportNotificationRuntimeSummary = {
    categoryCounts: buildCategoryCounts(visibilityGate.visibleItems),
    certifiedDeliveryCount: visibilityGate.visibleItems.filter(
      (item) => item.recordSource === "certified_notifications_runtime"
    ).length,
    emptyMessage:
      status === "notifications_empty"
        ? "No Support notification records are visible for the current scope. Certified delivery and read-only signals appear after Support activity."
        : null,
    groupCount: buildNotificationGroups(visibilityGate.visibleItems).length,
    hiddenRecordCount: visibilityGate.hiddenRecordCount,
    loadError,
    loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      visibilityGate.restrictedRecordCount > 0
        ? `${visibilityGate.restrictedRecordCount} notification record(s) are restricted under SP-14 visibility rules.`
        : null,
    restrictedRecordCount: visibilityGate.restrictedRecordCount,
    signalRecordCount,
    source: SUPPORT_NOTIFICATIONS_RUNTIME_SOURCE,
    status,
    summary: loadError
      ? `status load_error; ${loadError}`
      : [
          `status ${status}`,
          `${visibilityGate.visibleItems.length} visible records`,
          `${certifiedDeliveries.length} certified deliveries`,
          `${signalRecordCount} read-only signals`,
          params.safeActionsRuntime.status,
          registryEntry?.productionReady ? "registry production_ready" : "registry pending"
        ].join("; "),
    unauthorizedMessage: null,
    visibleRecordCount: visibilityGate.visibleItems.length
  };

  return {
    supportNotificationsRuntime,
    supportNotificationsRuntimeGroups: buildNotificationGroups(visibilityGate.visibleItems),
    supportNotificationsRuntimeItems: mergedItems,
    supportNotificationsSafeControls: buildSafeControls(),
    visibleSupportNotificationsRuntimeItems: visibilityGate.visibleItems
  };
}

export function mapSupportNotificationsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportNotificationsRuntimeReadOnlySafe>>
) {
  return input;
}
