import "server-only";

import type { SupportAuditRuntimeItem, SupportAuditRuntimeSummary } from "@/src/lib/support/support-audit-runtime";
import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportEventTimelineRuntimeSummary } from "@/src/lib/support/support-event-timeline-runtime";
import type { SupportFiltersRuntimeSummary } from "@/src/lib/support/support-filters-runtime";
import type { SupportMetricsRuntimeSummary } from "@/src/lib/support/support-metrics-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportSafeActionsRuntimeSummary } from "@/src/lib/support/support-safe-actions-runtime";
import type { SupportSearchRuntimeSummary } from "@/src/lib/support/support-search-runtime";
import type { SupportTicketAssignmentRuntimeSummary } from "@/src/lib/support/support-ticket-assignment-runtime";
import type { SupportTicketConversationRuntimeSummary } from "@/src/lib/support/support-ticket-conversation-runtime";
import type { SupportTicketDetailsRuntimeSummary } from "@/src/lib/support/support-ticket-details-runtime";
import type { SupportTicketStatusRuntimeSummary } from "@/src/lib/support/support-ticket-status-runtime";
import type { SupportTicketRuntimeItem, SupportTicketsRuntimeSummary } from "@/src/lib/support/support-tickets-runtime";
import type { SupportVisibilityRuntimeItem, SupportVisibilityRuntimeSummary } from "@/src/lib/support/support-visibility-runtime";
import {
  type SupportRecordVisibilityState,
  type SupportVisibilityAuthorization
} from "@/src/lib/support/support-visibility-runtime";

export type SupportReviewRuntimeSource = "support_review_runtime";

export type SupportReviewRecordType =
  | "audit_record"
  | "error_event"
  | "event_timeline"
  | "filter"
  | "metric"
  | "monitoring_event"
  | "safe_action"
  | "search_result"
  | "ticket"
  | "ticket_assignment"
  | "ticket_conversation"
  | "ticket_detail"
  | "ticket_status"
  | "visibility_rule";

export type SupportReviewGroupKey =
  | "support-audit-review"
  | "support-event-review"
  | "support-governance-review"
  | "support-platform-review"
  | "support-ticket-review";

export type SupportReviewStatus =
  | "blocked"
  | "clear"
  | "restricted"
  | "review_required"
  | "unauthorized"
  | "warning";

export type SupportReviewRiskLevel = "critical" | "high" | "info" | "low" | "medium";

export type SupportReviewLoadingState = "empty" | "error" | "loaded" | "restricted" | "unauthorized";

export type SupportReviewSafeControlKey =
  | "approve_review"
  | "export_review"
  | "mark_production_ready"
  | "reject_review"
  | "resolve_blocker";

export type SupportReviewSafeControl = {
  enabled: false;
  key: SupportReviewSafeControlKey;
  label: string;
  note: string;
};

export type SupportReviewRuntimeItem = {
  detectedAt: string;
  groupKey: SupportReviewGroupKey;
  issueSummary: string;
  recommendedManualAction: string | null;
  recordId: string;
  recordType: SupportReviewRecordType;
  registryKey: string;
  reviewItemId: string;
  reviewStatus: SupportReviewStatus;
  riskLevel: SupportReviewRiskLevel;
  safeSummary: string;
  visibilityState: SupportRecordVisibilityState;
};

export type SupportReviewRuntimeGroup = {
  groupKey: SupportReviewGroupKey;
  itemCount: number;
  items: SupportReviewRuntimeItem[];
  title: string;
};

export type SupportReviewRuntimeSummary = {
  blockedReviewCount: number;
  clearReviewCount: number;
  coverageModules: number;
  emptyMessage: string | null;
  groupCount: number;
  hiddenReviewCount: number;
  loadError: string | null;
  loadingState: SupportReviewLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedReviewCount: number;
  reviewRequiredCount: number;
  source: SupportReviewRuntimeSource;
  status: "load_error" | "review_empty" | "review_runtime_ready" | "needs_attention" | "unauthorized";
  summary: string;
  unauthorizedMessage: string | null;
  visibleReviewCount: number;
  warningReviewCount: number;
};

export type SupportReviewAuthorization = {
  canViewReview: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportReviewRuntimeInput = {
  auditRuntime: SupportAuditRuntimeSummary;
  auditItems: SupportAuditRuntimeItem[];
  errorEventsRuntime: { status: string; loadError: string | null; summary: string };
  eventTimelineRuntime: Pick<
    SupportEventTimelineRuntimeSummary,
    "loadError" | "status" | "summary" | "totalItems"
  >;
  filtersRuntime: Pick<SupportFiltersRuntimeSummary, "appliedFilterCount" | "loadError" | "status" | "summary">;
  loadError?: string | null;
  metricsRuntime: Pick<SupportMetricsRuntimeSummary, "loadError" | "status" | "summary" | "totalTickets">;
  monitoringEventsRuntime: { status: string; loadError: string | null; summary: string };
  role: "internal_team" | "super_admin";
  safeActionsRuntime: SupportSafeActionsRuntimeSummary;
  searchRuntime: Pick<SupportSearchRuntimeSummary, "loadError" | "status" | "summary">;
  selectedTicketId: string | null;
  ticketAssignmentRuntime: Pick<
    SupportTicketAssignmentRuntimeSummary,
    "assignmentColumnDetected" | "loadError" | "status" | "summary" | "transitionFoundation"
  >;
  ticketConversationRuntime: Pick<
    SupportTicketConversationRuntimeSummary,
    "canCreateMessage" | "loadError" | "status" | "summary"
  >;
  ticketDetailsRuntime: Pick<SupportTicketDetailsRuntimeSummary, "loadError" | "status" | "summary">;
  ticketStatusRuntime: Pick<
    SupportTicketStatusRuntimeSummary,
    "loadError" | "status" | "summary" | "transitionFoundation"
  >;
  ticketsRuntime: Pick<SupportTicketsRuntimeSummary, "loadError" | "status" | "summary" | "tableDetected" | "totalTickets">;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: Pick<
    SupportVisibilityRuntimeSummary,
    "loadError" | "restrictedRecordCount" | "status" | "summary" | "visibleRecordCount"
  >;
  visibilityRuntimeItems: SupportVisibilityRuntimeItem[];
  visibleAuditItems: SupportAuditRuntimeItem[];
  visibleErrorEvents: SupportErrorEventRuntimeItem[];
  visibleMonitoringEvents: SupportMonitoringEventRuntimeItem[];
  visibleTickets: SupportTicketRuntimeItem[];
};

export const SUPPORT_REVIEW_RUNTIME_SOURCE = "support_review_runtime" as const;

export const SUPPORT_REVIEW_SAFE_CONTROLS: readonly SupportReviewSafeControl[] = [
  {
    enabled: false,
    key: "approve_review",
    label: "Approve Review",
    note: "Read-only placeholder. Review approval must route through SP-15 Safe Actions when implemented."
  },
  {
    enabled: false,
    key: "reject_review",
    label: "Reject Review",
    note: "Read-only placeholder. No review rejection runs during SP-17 page load."
  },
  {
    enabled: false,
    key: "resolve_blocker",
    label: "Resolve Blocker",
    note: "Read-only placeholder. Blocker resolution must use explicit SP-15 Safe Actions only."
  },
  {
    enabled: false,
    key: "mark_production_ready",
    label: "Mark Production Ready",
    note: "Read-only placeholder. No certification mutation runs during SP-17 page load."
  },
  {
    enabled: false,
    key: "export_review",
    label: "Export Review",
    note: "Read-only placeholder. No review export runs during SP-17 page load."
  }
] as const;

const REVIEW_GROUP_DEFINITIONS: ReadonlyArray<{ groupKey: SupportReviewGroupKey; title: string }> = [
  { groupKey: "support-ticket-review", title: "Support Ticket Review" },
  { groupKey: "support-event-review", title: "Support Event Review" },
  { groupKey: "support-governance-review", title: "Support Governance Review" },
  { groupKey: "support-audit-review", title: "Support Audit Review" },
  { groupKey: "support-platform-review", title: "Support Platform Review" }
] as const;

const MAX_RECORD_REVIEWS = 25;

function nowIso() {
  return new Date().toISOString();
}

function buildSafeControls() {
  return SUPPORT_REVIEW_SAFE_CONTROLS.map((control) => ({ ...control }));
}

export function resolveSupportReviewAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportReviewAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewReview: true,
      reason: "Super Admin may view Support review results through read-only runtime inspection.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewReview: false,
    reason: "Support review is restricted to Super Admin in SP-17.",
    roleLabel: input.role
  };
}

export function supportReviewRecordTypeLabel(recordType: SupportReviewRecordType): string {
  return recordType.replace(/_/g, " ");
}

export function supportReviewStatusLabel(status: SupportReviewStatus): string {
  return status.replace(/_/g, " ");
}

function buildReviewItem(input: Omit<SupportReviewRuntimeItem, "reviewItemId" | "safeSummary" | "visibilityState"> & {
  visibilityState?: SupportRecordVisibilityState;
}): SupportReviewRuntimeItem {
  const reviewItemId = `support-review-${input.recordType}-${input.recordId}`;
  const visibilityState = input.visibilityState ?? "visible";

  return {
    ...input,
    reviewItemId,
    safeSummary: [
      input.recordType,
      input.reviewStatus,
      `risk ${input.riskLevel}`,
      input.issueSummary,
      input.recommendedManualAction ? `action ${input.recommendedManualAction}` : "action manual review only"
    ].join("; "),
    visibilityState
  };
}

function moduleReviewFromRuntime(input: {
  blockedStatuses?: string[];
  detectedAt?: string;
  groupKey: SupportReviewGroupKey;
  loadError?: string | null;
  recordId: string;
  recordType: SupportReviewRecordType;
  registryKey: string;
  runtimeStatus: string;
  runtimeSummary: string;
  warningStatuses?: string[];
}): SupportReviewRuntimeItem {
  const detectedAt = input.detectedAt ?? nowIso();

  if (input.loadError) {
    return buildReviewItem({
      detectedAt,
      groupKey: input.groupKey,
      issueSummary: input.loadError,
      recommendedManualAction: "Inspect runtime load error and retry read-only review after admin client recovery.",
      recordId: input.recordId,
      recordType: input.recordType,
      registryKey: input.registryKey,
      reviewStatus: "review_required",
      riskLevel: "high"
    });
  }

  if (input.runtimeStatus === "unauthorized") {
    return buildReviewItem({
      detectedAt,
      groupKey: input.groupKey,
      issueSummary: "Runtime is unauthorized for the current account context.",
      recommendedManualAction: "Confirm Super Admin access before continuing Support review.",
      recordId: input.recordId,
      recordType: input.recordType,
      registryKey: input.registryKey,
      reviewStatus: "unauthorized",
      riskLevel: "critical"
    });
  }

  if (input.runtimeStatus === "load_error") {
    return buildReviewItem({
      detectedAt,
      groupKey: input.groupKey,
      issueSummary: input.runtimeSummary || "Runtime reported a load error.",
      recommendedManualAction: "Review runtime dependencies and monitoring_events availability read-only.",
      recordId: input.recordId,
      recordType: input.recordType,
      registryKey: input.registryKey,
      reviewStatus: "blocked",
      riskLevel: "high"
    });
  }

  if (input.blockedStatuses?.includes(input.runtimeStatus)) {
    return buildReviewItem({
      detectedAt,
      groupKey: input.groupKey,
      issueSummary: input.runtimeSummary || `Runtime status ${input.runtimeStatus} requires attention.`,
      recommendedManualAction: "Perform manual triage. Use SP-15 Safe Actions for any mutation.",
      recordId: input.recordId,
      recordType: input.recordType,
      registryKey: input.registryKey,
      reviewStatus: "blocked",
      riskLevel: "medium"
    });
  }

  if (input.warningStatuses?.includes(input.runtimeStatus)) {
    return buildReviewItem({
      detectedAt,
      groupKey: input.groupKey,
      issueSummary: input.runtimeSummary || `Runtime status ${input.runtimeStatus} needs review.`,
      recommendedManualAction: "Review scope and confirm records manually. No auto-fix is available.",
      recordId: input.recordId,
      recordType: input.recordType,
      registryKey: input.registryKey,
      reviewStatus: "warning",
      riskLevel: "medium"
    });
  }

  return buildReviewItem({
    detectedAt,
    groupKey: input.groupKey,
    issueSummary: input.runtimeSummary || "Runtime review checks passed for the current scope.",
    recommendedManualAction: null,
    recordId: input.recordId,
    recordType: input.recordType,
    registryKey: input.registryKey,
    reviewStatus: "clear",
    riskLevel: "info"
  });
}

function buildTicketRecordReviews(tickets: SupportTicketRuntimeItem[]): SupportReviewRuntimeItem[] {
  return tickets
    .filter((ticket) => ticket.reviewStatus === "review_required")
    .slice(0, MAX_RECORD_REVIEWS)
    .map((ticket) =>
      buildReviewItem({
        detectedAt: ticket.lastUpdatedAt || nowIso(),
        groupKey: "support-ticket-review",
        issueSummary: `Ticket ${ticket.ticketNumber} requires manual review (${ticket.runtimeStatus}, priority ${ticket.priority}).`,
        recommendedManualAction:
          "Inspect ticket status and assignment through read-only detail views. Route mutations through SP-15 Safe Actions.",
        recordId: ticket.ticketId,
        recordType: "ticket",
        registryKey: "sp-tickets",
        reviewStatus: "review_required",
        riskLevel: ticket.priority === "urgent" || ticket.priority === "high" ? "high" : "medium",
        visibilityState: "visible"
      })
    );
}

function buildFailedAuditReviews(auditItems: SupportAuditRuntimeItem[]): SupportReviewRuntimeItem[] {
  return auditItems
    .filter((item) => {
      const result = item.resultStatus.toLowerCase();
      return result === "failed" || result === "error" || result === "unauthorized" || result === "validation";
    })
    .slice(0, MAX_RECORD_REVIEWS)
    .map((item) =>
      buildReviewItem({
        detectedAt: item.createdAt || nowIso(),
        groupKey: "support-audit-review",
        issueSummary: `Audit ${item.auditId} recorded ${item.actionTypeLabel} with result ${item.resultStatus}.`,
        recommendedManualAction:
          item.actionType === "safe_action_attempt"
            ? "Review SP-15 safe action confirmation and authorization, then retry through explicit form submission."
            : "Review audit metadata and retry the explicit Support action if appropriate.",
        recordId: item.auditId,
        recordType: "audit_record",
        registryKey: "sp-audit",
        reviewStatus: "review_required",
        riskLevel: item.resultStatus.toLowerCase() === "unauthorized" ? "critical" : "high",
        visibilityState: "visible"
      })
    );
}

function buildSafeActionConsistencyReviews(
  safeActionsRuntime: SupportSafeActionsRuntimeSummary,
  auditItems: SupportAuditRuntimeItem[]
): SupportReviewRuntimeItem[] {
  const items: SupportReviewRuntimeItem[] = [];
  const failedAttempts = auditItems.filter(
    (item) =>
      item.actionType === "safe_action_attempt" &&
      ["error", "failed", "invalid", "restricted", "unauthorized", "validation"].includes(
        item.resultStatus.toLowerCase()
      )
  ).length;

  if (safeActionsRuntime.status === "unavailable") {
    items.push(
      buildReviewItem({
        detectedAt: nowIso(),
        groupKey: "support-governance-review",
        issueSummary: "SP-15 Safe Actions runtime is unavailable for the current account.",
        recommendedManualAction: "Confirm Super Admin authorization before attempting Support mutations.",
        recordId: "sp-safe-actions",
        recordType: "safe_action",
        registryKey: "sp-safe-actions",
        reviewStatus: "blocked",
        riskLevel: "critical"
      })
    );
  }

  if (failedAttempts > 0) {
    items.push(
      buildReviewItem({
        detectedAt: nowIso(),
        groupKey: "support-governance-review",
        issueSummary: `${failedAttempts} failed safe action attempt(s) detected in SP-16 audit records.`,
        recommendedManualAction:
          "Review failed safe action audit entries and retry only through explicit SP-15 form submission.",
        recordId: "safe-action-consistency",
        recordType: "safe_action",
        registryKey: "sp-safe-actions",
        reviewStatus: "review_required",
        riskLevel: "high"
      })
    );
  }

  return items;
}

function buildVisibilityReviews(
  visibilityRuntime: SupportReviewRuntimeInput["visibilityRuntime"],
  visibilityItems: SupportVisibilityRuntimeItem[]
): SupportReviewRuntimeItem[] {
  const items: SupportReviewRuntimeItem[] = [
    moduleReviewFromRuntime({
      groupKey: "support-governance-review",
      loadError: visibilityRuntime.loadError,
      recordId: "sp-visibility",
      recordType: "visibility_rule",
      registryKey: "sp-visibility",
      runtimeStatus: visibilityRuntime.status,
      runtimeSummary: visibilityRuntime.summary,
      warningStatuses: ["needs_attention"]
    })
  ];

  if (visibilityRuntime.restrictedRecordCount > 0) {
    items.push(
      buildReviewItem({
        detectedAt: nowIso(),
        groupKey: "support-governance-review",
        issueSummary: `${visibilityRuntime.restrictedRecordCount} Support record(s) are restricted under SP-14 visibility rules.`,
        recommendedManualAction:
          "Review restricted records manually. Do not bypass visibility gates or weaken RLS.",
        recordId: "visibility-restricted-records",
        recordType: "visibility_rule",
        registryKey: "sp-visibility",
        reviewStatus: "restricted",
        riskLevel: "medium"
      })
    );
  }

  for (const supportReviewModule of visibilityItems.filter((item) => item.restrictedRecordCount > 0).slice(0, 10)) {
    items.push(
      buildReviewItem({
        detectedAt: nowIso(),
        groupKey: "support-governance-review",
        issueSummary: `${supportReviewModule.moduleName} has ${supportReviewModule.restrictedRecordCount} restricted record(s).`,
        recommendedManualAction: "Inspect module visibility context read-only before any manual action.",
        recordId: supportReviewModule.moduleKey,
        recordType: "visibility_rule",
        registryKey: supportReviewModule.registryKey,
        reviewStatus: "restricted",
        riskLevel: "low"
      })
    );
  }

  return items;
}

export function buildSupportReviewRuntime(input: SupportReviewRuntimeInput): {
  supportReviewRuntime: SupportReviewRuntimeSummary;
  supportReviewRuntimeGroups: SupportReviewRuntimeGroup[];
  supportReviewRuntimeItems: SupportReviewRuntimeItem[];
  supportReviewSafeControls: ReturnType<typeof buildSafeControls>;
  visibleSupportReviewRuntimeItems: SupportReviewRuntimeItem[];
} {
  const authorization = resolveSupportReviewAuthorization({ role: input.role });
  const registryEntry = getSupportRegistryEntry("sp-review");

  if (!authorization.canViewReview || !input.visibilityAuthorization.canViewSupportData) {
    const emptySummary: SupportReviewRuntimeSummary = {
      blockedReviewCount: 0,
      clearReviewCount: 0,
      coverageModules: 0,
      emptyMessage: "Support review is hidden for the current account.",
      groupCount: REVIEW_GROUP_DEFINITIONS.length,
      hiddenReviewCount: 0,
      loadError: null,
      loadingState: "unauthorized",
      readOnly: true,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      restrictedReviewCount: 0,
      reviewRequiredCount: 0,
      source: SUPPORT_REVIEW_RUNTIME_SOURCE,
      status: "unauthorized",
      summary: authorization.reason,
      unauthorizedMessage: "Support review is Super Admin only. No review executes during page load.",
      visibleReviewCount: 0,
      warningReviewCount: 0
    };

    return {
      supportReviewRuntime: emptySummary,
      supportReviewRuntimeGroups: REVIEW_GROUP_DEFINITIONS.map((group) => ({
        ...group,
        itemCount: 0,
        items: []
      })),
      supportReviewRuntimeItems: [],
      supportReviewSafeControls: buildSafeControls(),
      visibleSupportReviewRuntimeItems: []
    };
  }

  const reviewItems: SupportReviewRuntimeItem[] = [
    moduleReviewFromRuntime({
      blockedStatuses: ["needs_attention"],
      groupKey: "support-ticket-review",
      loadError: input.ticketsRuntime.loadError,
      recordId: "sp-tickets",
      recordType: "ticket",
      registryKey: "sp-tickets",
      runtimeStatus: input.ticketsRuntime.status,
      runtimeSummary: input.ticketsRuntime.summary,
      warningStatuses: input.ticketsRuntime.tableDetected ? [] : ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-ticket-review",
      loadError: input.ticketDetailsRuntime.loadError,
      recordId: "sp-ticket-details",
      recordType: "ticket_detail",
      registryKey: "sp-ticket-details",
      runtimeStatus: input.ticketDetailsRuntime.status,
      runtimeSummary: input.selectedTicketId
        ? input.ticketDetailsRuntime.summary
        : "No ticket selected. Ticket detail review remains module-level only.",
      warningStatuses: ["needs_attention", "not_found"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-ticket-review",
      loadError: input.ticketStatusRuntime.loadError,
      recordId: "sp-ticket-status",
      recordType: "ticket_status",
      registryKey: "sp-ticket-status",
      runtimeStatus: input.ticketStatusRuntime.status,
      runtimeSummary: input.ticketStatusRuntime.summary,
      warningStatuses:
        input.ticketStatusRuntime.transitionFoundation === "read_only" ? ["needs_attention"] : []
    }),
    moduleReviewFromRuntime({
      groupKey: "support-ticket-review",
      loadError: input.ticketAssignmentRuntime.loadError,
      recordId: "sp-ticket-assignment",
      recordType: "ticket_assignment",
      registryKey: "sp-ticket-assignment",
      runtimeStatus: input.ticketAssignmentRuntime.status,
      runtimeSummary: input.ticketAssignmentRuntime.summary,
      warningStatuses:
        !input.ticketAssignmentRuntime.assignmentColumnDetected ||
        input.ticketAssignmentRuntime.transitionFoundation === "read_only"
          ? ["needs_attention"]
          : []
    }),
    moduleReviewFromRuntime({
      groupKey: "support-ticket-review",
      loadError: input.ticketConversationRuntime.loadError,
      recordId: "sp-ticket-conversation",
      recordType: "ticket_conversation",
      registryKey: "sp-ticket-conversation",
      runtimeStatus: input.ticketConversationRuntime.status,
      runtimeSummary: input.ticketConversationRuntime.summary,
      warningStatuses: ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-event-review",
      loadError: input.monitoringEventsRuntime.loadError,
      recordId: "sp-monitoring-events",
      recordType: "monitoring_event",
      registryKey: "sp-monitoring-events",
      runtimeStatus: input.monitoringEventsRuntime.status,
      runtimeSummary: `${input.monitoringEventsRuntime.summary}; visible ${input.visibleMonitoringEvents.length}`,
      warningStatuses: ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-event-review",
      loadError: input.errorEventsRuntime.loadError,
      recordId: "sp-error-events",
      recordType: "error_event",
      registryKey: "sp-error-events",
      runtimeStatus: input.errorEventsRuntime.status,
      runtimeSummary: `${input.errorEventsRuntime.summary}; visible ${input.visibleErrorEvents.length}`,
      warningStatuses: ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-event-review",
      loadError: input.eventTimelineRuntime.loadError,
      recordId: "sp-event-timeline",
      recordType: "event_timeline",
      registryKey: "sp-event-timeline",
      runtimeStatus: input.eventTimelineRuntime.status,
      runtimeSummary: `${input.eventTimelineRuntime.summary}; items ${input.eventTimelineRuntime.totalItems}`,
      warningStatuses: ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-platform-review",
      loadError: input.searchRuntime.loadError,
      recordId: "sp-search",
      recordType: "search_result",
      registryKey: "sp-search",
      runtimeStatus: input.searchRuntime.status,
      runtimeSummary: input.searchRuntime.summary,
      warningStatuses: ["needs_attention"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-platform-review",
      loadError: input.filtersRuntime.loadError,
      recordId: "sp-filters",
      recordType: "filter",
      registryKey: "sp-filters",
      runtimeStatus: input.filtersRuntime.status,
      runtimeSummary: `${input.filtersRuntime.summary}; applied ${input.filtersRuntime.appliedFilterCount}`,
      warningStatuses: ["filters_empty"]
    }),
    moduleReviewFromRuntime({
      groupKey: "support-platform-review",
      loadError: input.metricsRuntime.loadError,
      recordId: "sp-metrics",
      recordType: "metric",
      registryKey: "sp-metrics",
      runtimeStatus: input.metricsRuntime.status,
      runtimeSummary: input.metricsRuntime.summary,
      warningStatuses: ["metrics_empty", "load_error"]
    }),
    ...buildVisibilityReviews(input.visibilityRuntime, input.visibilityRuntimeItems),
    moduleReviewFromRuntime({
      groupKey: "support-governance-review",
      loadError: input.safeActionsRuntime.loadError,
      recordId: "sp-safe-actions",
      recordType: "safe_action",
      registryKey: "sp-safe-actions",
      runtimeStatus: input.safeActionsRuntime.status,
      runtimeSummary: input.safeActionsRuntime.summary,
      warningStatuses: ["needs_attention"]
    }),
    ...buildSafeActionConsistencyReviews(input.safeActionsRuntime, input.visibleAuditItems),
    moduleReviewFromRuntime({
      groupKey: "support-audit-review",
      loadError: input.auditRuntime.loadError,
      recordId: "sp-audit",
      recordType: "audit_record",
      registryKey: "sp-audit",
      runtimeStatus: input.auditRuntime.status,
      runtimeSummary: `${input.auditRuntime.summary}; visible ${input.visibleAuditItems.length}`,
      warningStatuses: ["audit_empty", "needs_attention"]
    }),
    ...buildTicketRecordReviews(input.visibleTickets),
    ...buildFailedAuditReviews(input.visibleAuditItems)
  ];

  const visibleTicketIds = new Set(input.visibleTickets.map((ticket) => ticket.ticketId).filter(Boolean));
  const visibleSupportReviewRuntimeItems = reviewItems.filter((item) => {
    if (item.visibilityState === "hidden") {
      return false;
    }

    if (item.recordType === "ticket" && item.recordId !== "sp-tickets") {
      return visibleTicketIds.has(item.recordId);
    }

    if (item.recordType === "audit_record" && item.recordId !== "sp-audit") {
      const audit = input.visibleAuditItems.find((entry) => entry.auditId === item.recordId);
      if (audit?.relatedTicketId && !visibleTicketIds.has(audit.relatedTicketId)) {
        return false;
      }
    }

    return item.visibilityState !== "restricted";
  });

  const visibleIds = new Set(visibleSupportReviewRuntimeItems.map((item) => item.reviewItemId));
  const hiddenReviewCount = reviewItems.filter((item) => item.visibilityState === "hidden").length;
  const restrictedReviewCount = reviewItems.filter(
    (item) =>
      item.visibilityState === "restricted" ||
      (item.visibilityState === "visible" && !visibleIds.has(item.reviewItemId))
  ).length;
  const blockedReviewCount = visibleSupportReviewRuntimeItems.filter((item) => item.reviewStatus === "blocked").length;
  const reviewRequiredCount = visibleSupportReviewRuntimeItems.filter(
    (item) => item.reviewStatus === "review_required"
  ).length;
  const warningReviewCount = visibleSupportReviewRuntimeItems.filter((item) => item.reviewStatus === "warning").length;
  const clearReviewCount = visibleSupportReviewRuntimeItems.filter((item) => item.reviewStatus === "clear").length;
  const loadError = input.loadError ?? null;
  const loadingState: SupportReviewLoadingState = loadError
    ? "error"
    : visibleSupportReviewRuntimeItems.length === 0
      ? restrictedReviewCount > 0
        ? "restricted"
        : "empty"
      : "loaded";
  const status = loadError
    ? ("load_error" as const)
    : blockedReviewCount > 0 || reviewRequiredCount > 0
      ? ("needs_attention" as const)
      : visibleSupportReviewRuntimeItems.length === 0
        ? ("review_empty" as const)
        : ("review_runtime_ready" as const);

  const supportReviewRuntime: SupportReviewRuntimeSummary = {
    blockedReviewCount,
    clearReviewCount,
    coverageModules: 14,
    emptyMessage:
      status === "review_empty"
        ? "No Support review items are visible for the current scope."
        : null,
    groupCount: REVIEW_GROUP_DEFINITIONS.length,
    hiddenReviewCount,
    loadError,
    loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedReviewCount > 0
        ? `${restrictedReviewCount} review item(s) are restricted under SP-14 visibility rules.`
        : null,
    restrictedReviewCount,
    reviewRequiredCount,
    source: SUPPORT_REVIEW_RUNTIME_SOURCE,
    status,
    summary: loadError
      ? `status load_error; ${loadError}`
      : [
          `status ${status}`,
          `${visibleSupportReviewRuntimeItems.length} visible review items`,
          `${reviewRequiredCount} review required`,
          `${warningReviewCount} warning`,
          registryEntry?.productionReady ? "registry production_ready" : "registry pending"
        ].join("; "),
    unauthorizedMessage: null,
    visibleReviewCount: visibleSupportReviewRuntimeItems.length,
    warningReviewCount
  };

  const supportReviewRuntimeGroups = REVIEW_GROUP_DEFINITIONS.map((group) => {
    const items = visibleSupportReviewRuntimeItems.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: items.length,
      items,
      title: group.title
    };
  });

  return {
    supportReviewRuntime,
    supportReviewRuntimeGroups,
    supportReviewRuntimeItems: reviewItems,
    supportReviewSafeControls: buildSafeControls(),
    visibleSupportReviewRuntimeItems
  };
}

export function mapSupportReviewRuntimeToAdminFields(
  input: ReturnType<typeof buildSupportReviewRuntime>
) {
  return input;
}

export function supportReviewRuntimeStatusBadgeTone(
  status: SupportReviewRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "review_runtime_ready":
      return "green";
    case "review_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

export function supportReviewStatusBadgeTone(status: SupportReviewStatus): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "clear":
      return "green";
    case "warning":
    case "review_required":
    case "restricted":
      return "amber";
    case "blocked":
    case "unauthorized":
      return "red";
  }
}

export function supportReviewRiskBadgeTone(risk: SupportReviewRiskLevel): "amber" | "blue" | "green" | "red" | "slate" {
  switch (risk) {
    case "critical":
      return "red";
    case "high":
      return "amber";
    case "medium":
      return "blue";
    case "low":
      return "slate";
    case "info":
      return "green";
  }
}
