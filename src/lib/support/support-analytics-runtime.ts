import "server-only";

import type { SupportAuditRuntimeItem } from "@/src/lib/support/support-audit-runtime";
import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import type { SupportNotificationRuntimeItem } from "@/src/lib/support/support-notifications-runtime";
import type { SupportReviewRuntimeItem } from "@/src/lib/support/support-review-runtime";
import type { SupportSafeActionsRuntimeSummary } from "@/src/lib/support/support-safe-actions-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import {
  isOpenCanonicalStatus,
  normalizeStorageStatusToCanonical,
  supportTicketCanonicalStatusLabel,
  type SupportTicketCanonicalStatus
} from "@/src/lib/support/support-ticket-status-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportAnalyticsRuntimeSource = "support_analytics_runtime";

export type SupportAnalyticsLoadingState = "computed" | "empty" | "error" | "restricted" | "unauthorized";

export type SupportAnalyticsScope = "visible_runtime_data";

export type SupportAnalyticsBreakdownItem = {
  count: number;
  key: string;
  label: string;
};

export type SupportAnalyticsTrendItem = {
  count: number;
  key: string;
  label: string;
};

export type SupportAnalyticsSafeControlKey = "export" | "refresh" | "schedule";

export type SupportAnalyticsSafeControl = {
  enabled: false;
  key: SupportAnalyticsSafeControlKey;
  label: string;
  note: string;
};

export type SupportAnalyticsAuthorization = {
  canViewAnalytics: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportAnalyticsRuntimeSummary = {
  analyticsCards: Array<{ label: string; value: string }>;
  assignedTickets: number;
  emptyMessage: string | null;
  errorEventsTrend: SupportAnalyticsTrendItem[];
  errorSeverityDistribution: SupportAnalyticsBreakdownItem[];
  hiddenRecordCount: number;
  loadError: string | null;
  loadingState: SupportAnalyticsLoadingState;
  monitoringEventsTrend: SupportAnalyticsTrendItem[];
  notificationSignalCount: number;
  openTicketCount: number;
  openVsResolvedSummary: string;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  resolvedTicketCount: number;
  restrictedMessage: string | null;
  restrictedRecordCount: number;
  reviewIssuesTrend: SupportAnalyticsTrendItem[];
  safeActionFailureCount: number;
  safeActionSuccessCount: number;
  scope: SupportAnalyticsScope;
  source: SupportAnalyticsRuntimeSource;
  status: "analytics_empty" | "analytics_runtime_ready" | "load_error" | "needs_attention" | "unauthorized";
  summary: string;
  ticketsByCategory: SupportAnalyticsBreakdownItem[];
  ticketsByPriority: SupportAnalyticsBreakdownItem[];
  ticketsByStatus: SupportAnalyticsBreakdownItem[];
  ticketVolumeTrend: SupportAnalyticsTrendItem[];
  totalErrorEvents: number;
  totalMonitoringEvents: number;
  totalReviewIssues: number;
  totalTickets: number;
  unauthorizedMessage: string | null;
  unassignedTickets: number;
  visibleRecordCount: number;
};

export const SUPPORT_ANALYTICS_RUNTIME_SOURCE = "support_analytics_runtime" as const;

export const SUPPORT_ANALYTICS_SAFE_CONTROLS: readonly SupportAnalyticsSafeControl[] = [
  {
    enabled: false,
    key: "refresh",
    label: "Refresh Analytics",
    note: "Read-only placeholder. Analytics recompute only on explicit page load in SP-19."
  },
  {
    enabled: false,
    key: "export",
    label: "Export Analytics",
    note: "Read-only placeholder. No analytics export runs during SP-19 page load."
  },
  {
    enabled: false,
    key: "schedule",
    label: "Schedule Analytics",
    note: "Read-only placeholder. No cron or worker scheduling runs during SP-19 page load."
  }
] as const;

const TREND_BUCKET_LIMIT = 14;

function buildSafeControls() {
  return SUPPORT_ANALYTICS_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function countByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
  labelFn?: (key: string) => string
): SupportAnalyticsBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      count,
      key,
      label: labelFn ? labelFn(key) : key
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveCanonicalStatus(ticket: SupportTicketRuntimeItem): SupportTicketCanonicalStatus {
  if (ticket.canonicalStatus && ticket.canonicalStatus !== "unknown") {
    return ticket.canonicalStatus;
  }

  return normalizeStorageStatusToCanonical(ticket.status);
}

function toDayKey(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "unknown";
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildTrendFromDates(dates: string[]): SupportAnalyticsTrendItem[] {
  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = toDayKey(date);

    if (key === "unknown") {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      count,
      key,
      label: key
    }))
    .sort((left, right) => right.key.localeCompare(left.key))
    .slice(0, TREND_BUCKET_LIMIT)
    .reverse();
}

function isOpenStatus(status: SupportTicketCanonicalStatus) {
  return isOpenCanonicalStatus(status);
}

function isResolvedStatus(status: SupportTicketCanonicalStatus) {
  return status === "resolved" || status === "closed";
}

function isSafeActionFailure(resultStatus: string) {
  const normalized = resultStatus.toLowerCase();
  return (
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "unauthorized" ||
    normalized === "validation" ||
    normalized === "invalid" ||
    normalized === "restricted"
  );
}

function isSafeActionSuccess(resultStatus: string) {
  const normalized = resultStatus.toLowerCase();
  return normalized === "success" || normalized === "unchanged";
}

export function resolveSupportAnalyticsAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportAnalyticsAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewAnalytics: true,
      reason: "Super Admin may view Support analytics through read-only runtime calculations.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewAnalytics: false,
    reason: "Support analytics is restricted to Super Admin in SP-19.",
    roleLabel: input.role
  };
}

export function supportAnalyticsRuntimeStatusBadgeTone(
  status: SupportAnalyticsRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "analytics_runtime_ready":
      return "green";
    case "analytics_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

export function buildSupportAnalyticsRuntime(input: {
  authorization: SupportAnalyticsAuthorization;
  filtersApplied: boolean;
  loadError?: string | null;
  safeActionsRuntime: Pick<SupportSafeActionsRuntimeSummary, "enabledActionCount" | "status">;
  searchQuery: string | null;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibleAuditItems: SupportAuditRuntimeItem[];
  visibleErrorEvents: SupportErrorEventRuntimeItem[];
  visibleMonitoringEvents: SupportMonitoringEventRuntimeItem[];
  visibleNotificationItems: SupportNotificationRuntimeItem[];
  visibleReviewItems: SupportReviewRuntimeItem[];
  visibleTickets: SupportTicketRuntimeItem[];
  hiddenRecordCount?: number;
  restrictedRecordCount?: number;
}): {
  supportAnalyticsRuntime: SupportAnalyticsRuntimeSummary;
  supportAnalyticsSafeControls: ReturnType<typeof buildSafeControls>;
} {
  const registryEntry = getSupportRegistryEntry("sp-analytics");

  if (!input.authorization.canViewAnalytics || !input.visibilityAuthorization.canViewSupportData) {
    return {
      supportAnalyticsRuntime: {
        analyticsCards: [],
        assignedTickets: 0,
        emptyMessage: "Support analytics are hidden for the current account.",
        errorEventsTrend: [],
        errorSeverityDistribution: [],
        hiddenRecordCount: input.hiddenRecordCount ?? 0,
        loadError: null,
        loadingState: "unauthorized",
        monitoringEventsTrend: [],
        notificationSignalCount: 0,
        openTicketCount: 0,
        openVsResolvedSummary: "unauthorized",
        readOnly: true,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        resolvedTicketCount: 0,
        restrictedMessage: null,
        restrictedRecordCount: input.restrictedRecordCount ?? 0,
        reviewIssuesTrend: [],
        safeActionFailureCount: 0,
        safeActionSuccessCount: 0,
        scope: "visible_runtime_data",
        source: SUPPORT_ANALYTICS_RUNTIME_SOURCE,
        status: "unauthorized",
        summary: input.authorization.reason,
        ticketsByCategory: [],
        ticketsByPriority: [],
        ticketsByStatus: [],
        ticketVolumeTrend: [],
        totalErrorEvents: 0,
        totalMonitoringEvents: 0,
        totalReviewIssues: 0,
        totalTickets: 0,
        unauthorizedMessage: "Support analytics are Super Admin only. No analytics pipeline runs during page load.",
        unassignedTickets: 0,
        visibleRecordCount: 0
      },
      supportAnalyticsSafeControls: buildSafeControls()
    };
  }

  if (input.loadError) {
    return {
      supportAnalyticsRuntime: {
        analyticsCards: [],
        assignedTickets: 0,
        emptyMessage: null,
        errorEventsTrend: [],
        errorSeverityDistribution: [],
        hiddenRecordCount: input.hiddenRecordCount ?? 0,
        loadError: input.loadError,
        loadingState: "error",
        monitoringEventsTrend: [],
        notificationSignalCount: 0,
        openTicketCount: 0,
        openVsResolvedSummary: "load_error",
        readOnly: true,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        resolvedTicketCount: 0,
        restrictedMessage: null,
        restrictedRecordCount: input.restrictedRecordCount ?? 0,
        reviewIssuesTrend: [],
        safeActionFailureCount: 0,
        safeActionSuccessCount: 0,
        scope: "visible_runtime_data",
        source: SUPPORT_ANALYTICS_RUNTIME_SOURCE,
        status: "load_error",
        summary: `status load_error; ${input.loadError}`,
        ticketsByCategory: [],
        ticketsByPriority: [],
        ticketsByStatus: [],
        ticketVolumeTrend: [],
        totalErrorEvents: 0,
        totalMonitoringEvents: 0,
        totalReviewIssues: 0,
        totalTickets: 0,
        unauthorizedMessage: null,
        unassignedTickets: 0,
        visibleRecordCount: 0
      },
      supportAnalyticsSafeControls: buildSafeControls()
    };
  }

  const tickets = input.visibleTickets;
  const monitoringEvents = input.visibleMonitoringEvents;
  const errorEvents = input.visibleErrorEvents;
  const reviewIssues = input.visibleReviewItems.filter(
    (item) => item.reviewStatus === "review_required" || item.reviewStatus === "blocked" || item.reviewStatus === "warning"
  );
  const safeActionAudits = input.visibleAuditItems.filter((item) => item.actionType === "safe_action_attempt");

  const openTicketCount = tickets.filter((ticket) => isOpenStatus(resolveCanonicalStatus(ticket))).length;
  const resolvedTicketCount = tickets.filter((ticket) => isResolvedStatus(resolveCanonicalStatus(ticket))).length;
  const assignedTickets = tickets.filter((ticket) => Boolean(ticket.assignedAgentId)).length;
  const unassignedTickets = tickets.length - assignedTickets;

  const ticketsByStatus = countByKey(tickets, (ticket) => resolveCanonicalStatus(ticket), (key) =>
    supportTicketCanonicalStatusLabel(key as SupportTicketCanonicalStatus)
  );
  const ticketsByPriority = countByKey(tickets, (ticket) => ticket.priority || "unknown");
  const ticketsByCategory = countByKey(tickets, (ticket) => ticket.category || "unknown");
  const errorSeverityDistribution = countByKey(errorEvents, (event) => event.severity || "unknown");

  const ticketVolumeTrend = buildTrendFromDates(
    tickets.flatMap((ticket) => [ticket.createdAt, ticket.lastUpdatedAt].filter(Boolean))
  );
  const monitoringEventsTrend = buildTrendFromDates(monitoringEvents.map((event) => event.createdAt));
  const errorEventsTrend = buildTrendFromDates(errorEvents.map((event) => event.createdAt));
  const reviewIssuesTrend = buildTrendFromDates(reviewIssues.map((item) => item.detectedAt));

  const safeActionSuccessCount = safeActionAudits.filter((item) => isSafeActionSuccess(item.resultStatus)).length;
  const safeActionFailureCount = safeActionAudits.filter((item) => isSafeActionFailure(item.resultStatus)).length;

  const totalTickets = tickets.length;
  const totalMonitoringEvents = monitoringEvents.length;
  const totalErrorEvents = errorEvents.length;
  const totalReviewIssues = reviewIssues.length;
  const notificationSignalCount = input.visibleNotificationItems.length;
  const visibleRecordCount =
    totalTickets + totalMonitoringEvents + totalErrorEvents + totalReviewIssues + safeActionAudits.length;
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  const scopeNote = input.searchQuery
    ? "visible runtime data with search scope"
    : input.filtersApplied
      ? "visible runtime data with filters applied"
      : "visible runtime data";

  const hasData = visibleRecordCount > 0;
  const loadingState: SupportAnalyticsLoadingState = hasData
    ? restrictedRecordCount > 0
      ? "restricted"
      : "computed"
    : restrictedRecordCount > 0
      ? "restricted"
      : "empty";
  const status = hasData
    ? safeActionFailureCount > 0 || totalReviewIssues > 0
      ? ("needs_attention" as const)
      : ("analytics_runtime_ready" as const)
    : ("analytics_empty" as const);

  const supportAnalyticsRuntime: SupportAnalyticsRuntimeSummary = {
    analyticsCards: [
      { label: "Visible tickets", value: String(totalTickets) },
      { label: "Open tickets", value: String(openTicketCount) },
      { label: "Resolved tickets", value: String(resolvedTicketCount) },
      { label: "Assigned tickets", value: String(assignedTickets) },
      { label: "Unassigned tickets", value: String(unassignedTickets) },
      { label: "Monitoring events", value: String(totalMonitoringEvents) },
      { label: "Error events", value: String(totalErrorEvents) },
      { label: "Review issues", value: String(totalReviewIssues) },
      { label: "Safe action success", value: String(safeActionSuccessCount) },
      { label: "Safe action failure", value: String(safeActionFailureCount) },
      { label: "Notification signals", value: String(notificationSignalCount) }
    ],
    assignedTickets,
    emptyMessage: hasData
      ? null
      : "No Support analytics data is visible for the current scope. Analytics derive from visible runtime records only.",
    errorEventsTrend,
    errorSeverityDistribution,
    hiddenRecordCount,
    loadError: null,
    loadingState,
    monitoringEventsTrend,
    notificationSignalCount,
    openTicketCount,
    openVsResolvedSummary: `${openTicketCount} open vs ${resolvedTicketCount} resolved/closed`,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    resolvedTicketCount,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} record(s) excluded from analytics under SP-14 visibility rules.`
        : null,
    restrictedRecordCount,
    reviewIssuesTrend,
    safeActionFailureCount,
    safeActionSuccessCount,
    scope: "visible_runtime_data",
    source: SUPPORT_ANALYTICS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      scopeNote,
      `${visibleRecordCount} visible records analyzed`,
      `${openTicketCount} open`,
      `${resolvedTicketCount} resolved`,
      input.safeActionsRuntime.status,
      registryEntry?.productionReady ? "registry production_ready" : "registry pending"
    ].join("; "),
    ticketsByCategory,
    ticketsByPriority,
    ticketsByStatus,
    ticketVolumeTrend,
    totalErrorEvents,
    totalMonitoringEvents,
    totalReviewIssues,
    totalTickets,
    unauthorizedMessage: null,
    unassignedTickets,
    visibleRecordCount
  };

  return {
    supportAnalyticsRuntime,
    supportAnalyticsSafeControls: buildSafeControls()
  };
}

export function mapSupportAnalyticsRuntimeToAdminFields(
  input: ReturnType<typeof buildSupportAnalyticsRuntime>
) {
  return input;
}
