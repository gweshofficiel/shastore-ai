import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import type { SupportAnalyticsRuntimeSummary } from "@/src/lib/support/support-analytics-runtime";
import type { SupportAuditActionType, SupportAuditRuntimeItem } from "@/src/lib/support/support-audit-runtime";
import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportEventTimelineItem } from "@/src/lib/support/support-event-timeline-runtime";
import type { SupportFilterQuery } from "@/src/lib/support/support-filters-runtime";
import type { SupportMetricsRuntimeSummary } from "@/src/lib/support/support-metrics-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import type { SupportNotificationRuntimeItem } from "@/src/lib/support/support-notifications-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketConversationMessage } from "@/src/lib/support/support-ticket-conversation-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportExportRuntimeSource = "support_export_runtime";

export type SupportExportFormat = "csv" | "json";

export type SupportExportSectionKey =
  | "all"
  | "analytics_summary"
  | "audit_records"
  | "error_events"
  | "event_timeline"
  | "metrics"
  | "monitoring_events"
  | "notification_summary"
  | "review_records"
  | "ticket_assignment_history"
  | "ticket_conversation_summary"
  | "ticket_details_summary"
  | "ticket_status_history"
  | "tickets";

export type SupportExportLoadingState =
  | "empty"
  | "error"
  | "export_ready"
  | "restricted"
  | "success"
  | "unauthorized";

export type SupportExportResultCode = "empty" | "error" | "restricted" | "success" | "unauthorized";

export type SupportExportSectionEntry = {
  exportAvailable: boolean;
  exportCsvHref: string | null;
  exportJsonHref: string | null;
  helperText: string;
  key: SupportExportSectionKey;
  label: string;
  readOnly: true;
  recordCount: number;
};

export type SupportExportAuthorization = {
  canExportSupportData: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportExportRuntimeSummary = {
  emptyMessage: string | null;
  exportCsvHref: string | null;
  exportHelperText: string;
  exportJsonHref: string | null;
  exportSectionCount: number;
  exportSections: SupportExportSectionEntry[];
  hiddenRecordCount: number;
  loadError: string | null;
  loadingState: SupportExportLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedRecordCount: number;
  source: SupportExportRuntimeSource;
  status: "export_empty" | "export_runtime_ready" | "load_error" | "needs_attention" | "unauthorized";
  summary: string;
  totalExportableRecords: number;
  unauthorizedMessage: string | null;
  visibleRecordCount: number;
};

export type SupportExportValidationResult =
  | {
      available: true;
      payload: Record<string, unknown>;
      recordCount: number;
    }
  | {
      available: false;
      errorMessage: string;
      resultCode: SupportExportResultCode;
      status: 400 | 403 | 409;
    };

export type SupportExportTicketDetailSummary = {
  canonicalStatus: string;
  category: string;
  createdAt: string;
  descriptionState: "available" | "empty";
  lastUpdatedAt: string;
  priority: string;
  relatedMonitoringEventState: "available" | "not_found" | "not_linked";
  safeSummary: string;
  subject: string;
  ticketNumber: string;
};

export type SupportExportRuntimeInput = {
  analyticsRuntime: SupportAnalyticsRuntimeSummary;
  authorization: SupportExportAuthorization;
  filterQuery: SupportFilterQuery;
  filtersApplied: boolean;
  loadError?: string | null;
  metricsRuntime: SupportMetricsRuntimeSummary;
  searchQuery: string | null;
  selectedTicketDetail: SupportExportTicketDetailSummary | null;
  selectedTicketId: string | null;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibleAuditItems: SupportAuditRuntimeItem[];
  visibleConversationMessages: SupportTicketConversationMessage[];
  visibleErrorEvents: SupportErrorEventRuntimeItem[];
  visibleEventTimeline: SupportEventTimelineItem[];
  visibleMonitoringEvents: SupportMonitoringEventRuntimeItem[];
  visibleNotificationItems: SupportNotificationRuntimeItem[];
  visibleReviewItems: SupportReviewRuntimeItem[];
  visibleTickets: SupportTicketRuntimeItem[];
  hiddenRecordCount?: number;
  restrictedRecordCount?: number;
};

export const SUPPORT_EXPORT_RUNTIME_SOURCE = "support_export_runtime" as const;

export const SUPPORT_EXPORT_SECTION_DEFINITIONS: ReadonlyArray<{
  key: Exclude<SupportExportSectionKey, "all">;
  label: string;
}> = [
  { key: "tickets", label: "Tickets" },
  { key: "ticket_details_summary", label: "Ticket details summary" },
  { key: "ticket_status_history", label: "Ticket status history" },
  { key: "ticket_assignment_history", label: "Ticket assignment history" },
  { key: "ticket_conversation_summary", label: "Ticket conversation summary" },
  { key: "monitoring_events", label: "Monitoring events" },
  { key: "error_events", label: "Error events" },
  { key: "event_timeline", label: "Event timeline" },
  { key: "metrics", label: "Metrics" },
  { key: "review_records", label: "Review records" },
  { key: "audit_records", label: "Audit records" },
  { key: "notification_summary", label: "Notification records summary" },
  { key: "analytics_summary", label: "Analytics summary" }
] as const;

const FILTER_QUERY_KEYS = [
  "agent",
  "category",
  "eventSeverity",
  "eventSource",
  "eventStatus",
  "eventType",
  "from",
  "priority",
  "status",
  "store",
  "to",
  "user",
  "workspace"
] as const satisfies readonly (keyof SupportFilterQuery)[];

const BLOCKED_EXPORT_FIELD_PATTERN =
  /secret|token|password|credential|payload|stack|payment|stripe|metadata|message_body|messagebody|description/i;

const PRIVATE_EXPORT_FIELDS = new Set([
  "assignedAgentId",
  "author",
  "description",
  "messageBody",
  "relatedStoreId",
  "relatedUserId",
  "relatedWorkspaceId",
  "targetRecordId"
]);

function safeText(value: unknown, maxLength = 160) {
  const normalized =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, maxLength)
      : "";

  return normalized;
}

function csvValue(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function sanitizeExportRecord(value: Record<string, unknown>) {
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE_EXPORT_FIELDS.has(key) || BLOCKED_EXPORT_FIELD_PATTERN.test(key)) {
      continue;
    }

    if (typeof entry === "number" && Number.isFinite(entry)) {
      output[key] = entry;
      continue;
    }

    if (typeof entry === "boolean") {
      output[key] = entry;
      continue;
    }

    if (typeof entry === "string") {
      output[key] = safeText(entry);
    }
  }

  return output;
}

function countSectionRecords(input: SupportExportRuntimeInput, key: Exclude<SupportExportSectionKey, "all">) {
  switch (key) {
    case "tickets":
      return input.visibleTickets.length;
    case "ticket_details_summary":
      return input.visibleTickets.length + (input.selectedTicketDetail ? 1 : 0);
    case "ticket_status_history":
      return input.visibleAuditItems.filter((item) => item.actionType === "ticket_status_change").length;
    case "ticket_assignment_history":
      return input.visibleAuditItems.filter(
        (item) =>
          item.actionType === "ticket_assignment_change" || item.actionType === "ticket_unassignment_change"
      ).length;
    case "ticket_conversation_summary":
      return input.visibleConversationMessages.length;
    case "monitoring_events":
      return input.visibleMonitoringEvents.length;
    case "error_events":
      return input.visibleErrorEvents.length;
    case "event_timeline":
      return input.visibleEventTimeline.length;
    case "metrics":
      return input.metricsRuntime.metricCards.length;
    case "review_records":
      return input.visibleReviewItems.length;
    case "audit_records":
      return input.visibleAuditItems.length;
    case "notification_summary":
      return input.visibleNotificationItems.length;
    case "analytics_summary":
      return input.analyticsRuntime.analyticsCards.length;
  }
}

export function resolveSupportExportAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportExportAuthorization {
  if (input.role === "super_admin") {
    return {
      canExportSupportData: true,
      reason: "Super Admin may export visible Support records through explicit download action only.",
      roleLabel: "super_admin"
    };
  }

  return {
    canExportSupportData: false,
    reason: "Support export is restricted to Super Admin in SP-20.",
    roleLabel: input.role
  };
}

export function buildSupportExportHref(input: {
  filterQuery: SupportFilterQuery;
  format: SupportExportFormat;
  searchQuery: string | null;
  section: SupportExportSectionKey;
  selectedTicketId: string | null;
}) {
  const params = new URLSearchParams();

  params.set("format", input.format);
  params.set("section", input.section);

  if (input.searchQuery) {
    params.set("q", input.searchQuery);
  }

  if (input.selectedTicketId) {
    params.set("ticket", input.selectedTicketId);
  }

  for (const key of FILTER_QUERY_KEYS) {
    const value = input.filterQuery[key];

    if (value) {
      params.set(key, value);
    }
  }

  return `/admin/support/export?${params.toString()}`;
}

export function supportExportRuntimeStatusBadgeTone(
  status: SupportExportRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "export_runtime_ready":
      return "green";
    case "export_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

export function supportExportSectionLabel(section: SupportExportSectionKey) {
  if (section === "all") {
    return "All Support sections";
  }

  return SUPPORT_EXPORT_SECTION_DEFINITIONS.find((entry) => entry.key === section)?.label ?? section;
}

function buildTicketExportRows(tickets: SupportTicketRuntimeItem[]) {
  return tickets.map((ticket) =>
    sanitizeExportRecord({
      assignedAgentLabel: ticket.assignedAgentLabel,
      canonicalStatus: ticket.canonicalStatus,
      category: ticket.category,
      createdAt: ticket.createdAt,
      lastUpdatedAt: ticket.lastUpdatedAt,
      priority: ticket.priority,
      reviewStatus: ticket.reviewStatus,
      safeSummary: ticket.safeSummary,
      status: ticket.status,
      subject: ticket.subject,
      ticketNumber: ticket.ticketNumber
    })
  );
}

function buildTicketDetailsExportRows(input: SupportExportRuntimeInput) {
  const rows = input.visibleTickets.map((ticket) =>
    sanitizeExportRecord({
      canonicalStatus: ticket.canonicalStatus,
      category: ticket.category,
      detailScope: "ticket_list_summary",
      priority: ticket.priority,
      safeSummary: ticket.safeSummary,
      subject: ticket.subject,
      ticketNumber: ticket.ticketNumber
    })
  );

  if (input.selectedTicketDetail) {
    const detail = input.selectedTicketDetail;
    rows.unshift(
      sanitizeExportRecord({
        canonicalStatus: detail.canonicalStatus,
        category: detail.category,
        createdAt: detail.createdAt,
        descriptionState: detail.descriptionState,
        detailScope: "selected_ticket_detail",
        lastUpdatedAt: detail.lastUpdatedAt,
        priority: detail.priority,
        relatedMonitoringEventState: detail.relatedMonitoringEventState,
        safeSummary: detail.safeSummary,
        subject: detail.subject,
        ticketNumber: detail.ticketNumber
      })
    );
  }

  return rows;
}

function buildAuditHistoryRows(items: SupportAuditRuntimeItem[], actionTypes: SupportAuditActionType[]) {
  return items
    .filter((item) => actionTypes.includes(item.actionType))
    .map((item) =>
      sanitizeExportRecord({
        actionType: item.actionType,
        actionTypeLabel: item.actionTypeLabel,
        actorRole: item.actorRole,
        createdAt: item.createdAt,
        relatedTicketNumber: item.relatedTicketNumber,
        resultStatus: item.resultStatus,
        safeSummary: item.safeSummary
      })
    );
}

function buildConversationExportRows(messages: SupportTicketConversationMessage[]) {
  return messages.map((message) =>
    sanitizeExportRecord({
      attachmentsIndicator: message.attachmentsIndicator,
      authorRole: message.authorRole,
      createdAt: message.createdAt,
      messageSource: message.messageSource,
      safeSummary: message.safeSummary,
      visibility: message.visibility
    })
  );
}

function buildMonitoringExportRows(events: SupportMonitoringEventRuntimeItem[]) {
  return events.map((event) =>
    sanitizeExportRecord({
      createdAt: event.createdAt,
      entityType: event.entityType,
      eventStatus: event.eventStatus,
      eventType: event.eventType,
      relatedTicketNumber: event.relatedTicketNumber,
      safeSummary: event.safeSummary,
      severity: event.severity,
      source: event.source,
      status: event.status
    })
  );
}

function buildErrorExportRows(events: SupportErrorEventRuntimeItem[]) {
  return events.map((event) =>
    sanitizeExportRecord({
      createdAt: event.createdAt,
      entityType: event.entityType,
      errorMessageSummary: event.errorMessageSummary,
      errorStatus: event.errorStatus,
      errorType: event.errorType,
      relatedTicketNumber: event.relatedTicketNumber,
      safeSummary: event.safeSummary,
      severity: event.severity,
      source: event.source,
      status: event.status
    })
  );
}

function buildTimelineExportRows(items: SupportEventTimelineItem[]) {
  return items.map((item) =>
    sanitizeExportRecord({
      actorLabel: item.actorLabel,
      createdAt: item.createdAt,
      eventType: item.eventType,
      eventTypeLabel: item.eventTypeLabel,
      relatedTicketNumber: item.relatedTicketNumber,
      safeSummary: item.safeSummary,
      severity: item.severity,
      source: item.source,
      status: item.status
    })
  );
}

function buildReviewExportRows(items: SupportReviewRuntimeItem[]) {
  return items.map((item) =>
    sanitizeExportRecord({
      detectedAt: item.detectedAt,
      issueSummary: item.issueSummary,
      recommendedManualAction: item.recommendedManualAction,
      recordType: item.recordType,
      reviewStatus: item.reviewStatus,
      riskLevel: item.riskLevel,
      safeSummary: item.safeSummary,
      visibilityState: item.visibilityState
    })
  );
}

function buildAuditExportRows(items: SupportAuditRuntimeItem[]) {
  return items.map((item) =>
    sanitizeExportRecord({
      actionType: item.actionType,
      actionTypeLabel: item.actionTypeLabel,
      actorRole: item.actorRole,
      createdAt: item.createdAt,
      relatedTicketNumber: item.relatedTicketNumber,
      resultStatus: item.resultStatus,
      safeSummary: item.safeSummary,
      targetRecordType: item.targetRecordType,
      visibilityState: item.visibilityState
    })
  );
}

function buildNotificationExportRows(items: SupportNotificationRuntimeItem[]) {
  return items.map((item) =>
    sanitizeExportRecord({
      category: item.category,
      categoryLabel: item.categoryLabel,
      createdAt: item.createdAt,
      deliveryStatus: item.deliveryStatus,
      deliveryStatusLabel: item.deliveryStatusLabel,
      readStatus: item.readStatus,
      recordSource: item.recordSource,
      relatedTicketNumber: item.relatedTicketNumber,
      safeSummary: item.safeSummary,
      severity: item.severity,
      targetResourceType: item.targetResourceType
    })
  );
}

function sanitizeExportArray(items: Array<Record<string, unknown>>) {
  return items.map((item) => sanitizeExportRecord(item));
}

function buildAnalyticsExportSummary(analytics: SupportAnalyticsRuntimeSummary) {
  return {
    ...sanitizeExportRecord({
      assignedTickets: analytics.assignedTickets,
      openTicketCount: analytics.openTicketCount,
      openVsResolvedSummary: analytics.openVsResolvedSummary,
      resolvedTicketCount: analytics.resolvedTicketCount,
      safeActionFailureCount: analytics.safeActionFailureCount,
      safeActionSuccessCount: analytics.safeActionSuccessCount,
      scope: analytics.scope,
      status: analytics.status,
      summary: analytics.summary,
      totalErrorEvents: analytics.totalErrorEvents,
      totalMonitoringEvents: analytics.totalMonitoringEvents,
      totalReviewIssues: analytics.totalReviewIssues,
      totalTickets: analytics.totalTickets,
      unassignedTickets: analytics.unassignedTickets
    }),
    analyticsCards: sanitizeExportArray(analytics.analyticsCards as Array<Record<string, unknown>>),
    errorEventsTrend: sanitizeExportArray(analytics.errorEventsTrend as Array<Record<string, unknown>>),
    errorSeverityDistribution: sanitizeExportArray(
      analytics.errorSeverityDistribution as Array<Record<string, unknown>>
    ),
    monitoringEventsTrend: sanitizeExportArray(analytics.monitoringEventsTrend as Array<Record<string, unknown>>),
    reviewIssuesTrend: sanitizeExportArray(analytics.reviewIssuesTrend as Array<Record<string, unknown>>),
    ticketsByCategory: sanitizeExportArray(analytics.ticketsByCategory as Array<Record<string, unknown>>),
    ticketsByPriority: sanitizeExportArray(analytics.ticketsByPriority as Array<Record<string, unknown>>),
    ticketsByStatus: sanitizeExportArray(analytics.ticketsByStatus as Array<Record<string, unknown>>),
    ticketVolumeTrend: sanitizeExportArray(analytics.ticketVolumeTrend as Array<Record<string, unknown>>)
  };
}

function buildMetricsExportSummary(metrics: SupportMetricsRuntimeSummary) {
  return {
    ...sanitizeExportRecord({
      scope: metrics.scope,
      status: metrics.status,
      summary: metrics.summary
    }),
    errorEventsBySeverity: sanitizeExportArray(metrics.errorEventsBySeverity as Array<Record<string, unknown>>),
    errorEventsByStatus: sanitizeExportArray(metrics.errorEventsByStatus as Array<Record<string, unknown>>),
    metricCards: sanitizeExportArray(metrics.metricCards as Array<Record<string, unknown>>),
    monitoringEventsBySeverity: sanitizeExportArray(
      metrics.monitoringEventsBySeverity as Array<Record<string, unknown>>
    ),
    monitoringEventsByStatus: sanitizeExportArray(metrics.monitoringEventsByStatus as Array<Record<string, unknown>>),
    ticketsByCategory: sanitizeExportArray(metrics.ticketsByCategory as Array<Record<string, unknown>>),
    ticketsByPriority: sanitizeExportArray(metrics.ticketsByPriority as Array<Record<string, unknown>>)
  };
}

function buildExportSections(input: SupportExportRuntimeInput, section: SupportExportSectionKey) {
  const sections: Record<string, unknown> = {};

  const include = (key: Exclude<SupportExportSectionKey, "all">) => section === "all" || section === key;

  if (include("tickets")) {
    sections.tickets = buildTicketExportRows(input.visibleTickets);
  }

  if (include("ticket_details_summary")) {
    sections.ticket_details_summary = buildTicketDetailsExportRows(input);
  }

  if (include("ticket_status_history")) {
    sections.ticket_status_history = buildAuditHistoryRows(input.visibleAuditItems, ["ticket_status_change"]);
  }

  if (include("ticket_assignment_history")) {
    sections.ticket_assignment_history = buildAuditHistoryRows(input.visibleAuditItems, [
      "ticket_assignment_change",
      "ticket_unassignment_change"
    ]);
  }

  if (include("ticket_conversation_summary")) {
    sections.ticket_conversation_summary = buildConversationExportRows(input.visibleConversationMessages);
  }

  if (include("monitoring_events")) {
    sections.monitoring_events = buildMonitoringExportRows(input.visibleMonitoringEvents);
  }

  if (include("error_events")) {
    sections.error_events = buildErrorExportRows(input.visibleErrorEvents);
  }

  if (include("event_timeline")) {
    sections.event_timeline = buildTimelineExportRows(input.visibleEventTimeline);
  }

  if (include("metrics")) {
    sections.metrics = buildMetricsExportSummary(input.metricsRuntime);
  }

  if (include("review_records")) {
    sections.review_records = buildReviewExportRows(input.visibleReviewItems);
  }

  if (include("audit_records")) {
    sections.audit_records = buildAuditExportRows(input.visibleAuditItems);
  }

  if (include("notification_summary")) {
    sections.notification_summary = buildNotificationExportRows(input.visibleNotificationItems);
  }

  if (include("analytics_summary")) {
    sections.analytics_summary = buildAnalyticsExportSummary(input.analyticsRuntime);
  }

  return sections;
}

function countExportPayloadRecords(sections: Record<string, unknown>) {
  let total = 0;

  for (const value of Object.values(sections)) {
    if (Array.isArray(value)) {
      total += value.length;
      continue;
    }

    if (value && typeof value === "object") {
      total += 1;
    }
  }

  return total;
}

export function buildSupportExportPayload(input: SupportExportRuntimeInput, section: SupportExportSectionKey) {
  const sections = buildExportSections(input, section);

  return {
    exportSource: SUPPORT_EXPORT_RUNTIME_SOURCE,
    exportedAt: new Date().toISOString(),
    formatScope: section,
    safeFieldsOnly: true,
    scope: sanitizeExportRecord({
      filtersApplied: input.filtersApplied,
      searchQuery: input.searchQuery ? safeText(input.searchQuery, 120) : null,
      selectedTicketId: input.selectedTicketId,
      visibleRecordCount: input.visibleTickets.length
    }),
    sections,
    superAdminOnly: true,
    summary: safeText(
      `Support export ${section}; ${countExportPayloadRecords(sections)} exportable record(s) from visible runtime data only.`
    )
  };
}

export function validateSupportExportRequest(input: {
  exportInput: SupportExportRuntimeInput;
  format: SupportExportFormat | null;
  section: SupportExportSectionKey | null;
}): SupportExportValidationResult {
  if (!input.exportInput.authorization.canExportSupportData || !input.exportInput.visibilityAuthorization.canViewSupportData) {
    return {
      available: false,
      errorMessage: "Support export requires Super Admin authorization and visible Support data.",
      resultCode: "unauthorized",
      status: 403
    };
  }

  if (input.exportInput.loadError) {
    return {
      available: false,
      errorMessage: input.exportInput.loadError,
      resultCode: "error",
      status: 409
    };
  }

  if (!input.format || (input.format !== "csv" && input.format !== "json")) {
    return {
      available: false,
      errorMessage: "Support export format must be csv or json.",
      resultCode: "error",
      status: 400
    };
  }

  const section = input.section ?? "all";
  const payload = buildSupportExportPayload(input.exportInput, section);
  const recordCount = countExportPayloadRecords(payload.sections as Record<string, unknown>);

  if (recordCount === 0) {
    return {
      available: false,
      errorMessage: "No visible Support records are available to export for the current scope.",
      resultCode: "empty",
      status: 409
    };
  }

  if ((input.exportInput.restrictedRecordCount ?? 0) > 0 && recordCount === 0) {
    return {
      available: false,
      errorMessage: "Support export is restricted for the current visibility scope.",
      resultCode: "restricted",
      status: 409
    };
  }

  return {
    available: true,
    payload,
    recordCount
  };
}

function flattenExportRows(payload: Record<string, unknown>) {
  const rows: Array<{ field: string; section: string; value: string }> = [];
  const sections = payload.sections;

  if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
    return rows;
  }

  for (const [sectionKey, sectionValue] of Object.entries(sections as Record<string, unknown>)) {
    if (Array.isArray(sectionValue)) {
      sectionValue.forEach((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          for (const [field, value] of Object.entries(item as Record<string, unknown>)) {
            rows.push({
              field: `${field}_${index + 1}`,
              section: sectionKey,
              value: safeText(String(value), 240)
            });
          }
        }
      });
      continue;
    }

    if (sectionValue && typeof sectionValue === "object") {
      for (const [field, value] of Object.entries(sectionValue as Record<string, unknown>)) {
        rows.push({
          field,
          section: sectionKey,
          value: safeText(Array.isArray(value) ? JSON.stringify(value) : String(value), 240)
        });
      }
    }
  }

  return rows;
}

export function supportExportPayloadToCsv(payload: Record<string, unknown>) {
  const rows = flattenExportRows(payload);
  const headers = ["section", "field", "value"];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header as keyof typeof row])).join(","))
  ];

  return lines.join("\n");
}

export async function recordSupportExportAttempt(input: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  format: SupportExportFormat;
  recordCount: number;
  resultCode: SupportExportResultCode;
  section: SupportExportSectionKey;
}) {
  await recordMonitoringEventSafe({
    entityId: "support-export",
    entityType: "support_export",
    eventStatus: input.resultCode === "success" ? "success" : "failed",
    eventType: "support_export_attempt",
    metadata: {
      action: "support.export.download",
      actorRole: "super_admin",
      exportFormat: input.format,
      exportSection: input.section,
      exportSource: SUPPORT_EXPORT_RUNTIME_SOURCE,
      recordCount: input.recordCount,
      resultCode: input.resultCode,
      route: "/admin/support",
      safeFieldsOnly: true
    },
    storeId: null,
    userId: input.access.user.id,
    workspaceId: null
  });
}

export function buildSupportExportRuntime(input: SupportExportRuntimeInput): {
  supportExportRuntime: SupportExportRuntimeSummary;
} {
  const registryEntry = getSupportRegistryEntry("sp-export");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (!input.authorization.canExportSupportData || !input.visibilityAuthorization.canViewSupportData) {
    return {
      supportExportRuntime: {
        emptyMessage: "Support export is hidden for the current account.",
        exportCsvHref: null,
        exportHelperText: "Export requires Super Admin authorization.",
        exportJsonHref: null,
        exportSectionCount: 0,
        exportSections: [],
        hiddenRecordCount,
        loadError: null,
        loadingState: "unauthorized",
        readOnly: true,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        restrictedMessage: null,
        restrictedRecordCount,
        source: SUPPORT_EXPORT_RUNTIME_SOURCE,
        status: "unauthorized",
        summary: input.authorization.reason,
        totalExportableRecords: 0,
        unauthorizedMessage: "Support export is Super Admin only. No export runs during page load.",
        visibleRecordCount: 0
      }
    };
  }

  if (input.loadError) {
    return {
      supportExportRuntime: {
        emptyMessage: null,
        exportCsvHref: null,
        exportHelperText: "Export is unavailable while Support runtime data failed to load.",
        exportJsonHref: null,
        exportSectionCount: 0,
        exportSections: [],
        hiddenRecordCount,
        loadError: input.loadError,
        loadingState: "error",
        readOnly: true,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        restrictedMessage: null,
        restrictedRecordCount,
        source: SUPPORT_EXPORT_RUNTIME_SOURCE,
        status: "load_error",
        summary: `status load_error; ${input.loadError}`,
        totalExportableRecords: 0,
        unauthorizedMessage: null,
        visibleRecordCount: 0
      }
    };
  }

  const exportSections: SupportExportSectionEntry[] = SUPPORT_EXPORT_SECTION_DEFINITIONS.map((definition) => {
    const recordCount = countSectionRecords(input, definition.key);
    const exportAvailable = recordCount > 0;
    const helperText = exportAvailable
      ? `${recordCount} visible record(s) available for explicit Super Admin export.`
      : "No visible records in the current scope for this export section.";

    return {
      exportAvailable,
      exportCsvHref: exportAvailable
        ? buildSupportExportHref({
            filterQuery: input.filterQuery,
            format: "csv",
            searchQuery: input.searchQuery,
            section: definition.key,
            selectedTicketId: input.selectedTicketId
          })
        : null,
      exportJsonHref: exportAvailable
        ? buildSupportExportHref({
            filterQuery: input.filterQuery,
            format: "json",
            searchQuery: input.searchQuery,
            section: definition.key,
            selectedTicketId: input.selectedTicketId
          })
        : null,
      helperText,
      key: definition.key,
      label: definition.label,
      readOnly: true,
      recordCount
    };
  });

  const totalExportableRecords = exportSections.reduce((total, section) => total + section.recordCount, 0);
  const visibleRecordCount = totalExportableRecords;
  const hasData = totalExportableRecords > 0;
  const loadingState: SupportExportLoadingState = hasData
    ? restrictedRecordCount > 0
      ? "restricted"
      : "export_ready"
    : restrictedRecordCount > 0
      ? "restricted"
      : "empty";
  const status = hasData
    ? restrictedRecordCount > 0
      ? ("needs_attention" as const)
      : ("export_runtime_ready" as const)
    : ("export_empty" as const);

  return {
    supportExportRuntime: {
      emptyMessage: hasData
        ? null
        : "No visible Support records are available to export for the current scope.",
      exportCsvHref: hasData
        ? buildSupportExportHref({
            filterQuery: input.filterQuery,
            format: "csv",
            searchQuery: input.searchQuery,
            section: "all",
            selectedTicketId: input.selectedTicketId
          })
        : null,
      exportHelperText:
        "Explicit Super Admin download only. Export JSON or Export CSV generates sanitized summaries from visible Support runtime data.",
      exportJsonHref: hasData
        ? buildSupportExportHref({
            filterQuery: input.filterQuery,
            format: "json",
            searchQuery: input.searchQuery,
            section: "all",
            selectedTicketId: input.selectedTicketId
          })
        : null,
      exportSectionCount: exportSections.length,
      exportSections,
      hiddenRecordCount,
      loadError: null,
      loadingState,
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage:
        restrictedRecordCount > 0
          ? `${restrictedRecordCount} record(s) excluded from export under SP-14 visibility rules.`
          : null,
      restrictedRecordCount,
      source: SUPPORT_EXPORT_RUNTIME_SOURCE,
      status,
      summary: [
        `status ${status}`,
        `${visibleRecordCount} exportable records`,
        `${exportSections.filter((section) => section.exportAvailable).length} available sections`,
        registryEntry?.productionReady ? "registry production_ready" : "registry pending"
      ].join("; "),
      totalExportableRecords,
      unauthorizedMessage: null,
      visibleRecordCount
    }
  };
}

export function mapSupportExportRuntimeToAdminFields(input: ReturnType<typeof buildSupportExportRuntime>) {
  return input;
}
