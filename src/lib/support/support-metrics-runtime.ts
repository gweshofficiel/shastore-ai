import "server-only";

import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportEventTimelineItem } from "@/src/lib/support/support-event-timeline-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportSearchResultPublicItem } from "@/src/lib/support/support-search-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import {
  normalizeStorageStatusToCanonical,
  type SupportTicketCanonicalStatus
} from "@/src/lib/support/support-ticket-status-runtime";

export type SupportMetricsRuntimeSource = "support_metrics_runtime";

export type SupportMetricsLoadingState = "computed" | "empty" | "error" | "unauthorized";

export type SupportMetricsScope = "filtered" | "filtered_and_search" | "unscoped";

export type SupportMetricsBreakdownItem = {
  count: number;
  key: string;
  label: string;
};

export type SupportMetricsAuthorization = {
  canViewMetrics: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportMetricsRuntimeSummary = {
  assignedTickets: number;
  closedTickets: number;
  emptyMessage: string | null;
  errorEventsBySeverity: SupportMetricsBreakdownItem[];
  errorEventsByStatus: SupportMetricsBreakdownItem[];
  inProgressTickets: number;
  loadError: string | null;
  loadingState: SupportMetricsLoadingState;
  metricCards: Array<{ label: string; value: string }>;
  monitoringEventsBySeverity: SupportMetricsBreakdownItem[];
  monitoringEventsByStatus: SupportMetricsBreakdownItem[];
  openTickets: number;
  pendingTickets: number;
  readOnly: true;
  recentActivityCount: number;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  resolvedTickets: number;
  scope: SupportMetricsScope;
  searchResultCount: number;
  source: SupportMetricsRuntimeSource;
  status: "load_error" | "metrics_empty" | "metrics_runtime_ready" | "unauthorized";
  summary: string;
  ticketsByCategory: SupportMetricsBreakdownItem[];
  ticketsByPriority: SupportMetricsBreakdownItem[];
  totalErrorEvents: number;
  totalMonitoringEvents: number;
  totalTickets: number;
  unassignedTickets: number;
};

export const SUPPORT_METRICS_RUNTIME_SOURCE = "support_metrics_runtime" as const;

function countByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
  labelFn?: (key: string) => string
): SupportMetricsBreakdownItem[] {
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

function applySearchScopeToMetricsInput(input: {
  errorEvents: SupportErrorEventRuntimeItem[];
  eventTimeline: SupportEventTimelineItem[];
  monitoringEvents: SupportMonitoringEventRuntimeItem[];
  searchQuery: string | null;
  searchResults: SupportSearchResultPublicItem[];
  tickets: SupportTicketRuntimeItem[];
}) {
  if (!input.searchQuery) {
    return {
      errorEvents: input.errorEvents,
      eventTimeline: input.eventTimeline,
      monitoringEvents: input.monitoringEvents,
      scope: "filtered" as const,
      searchResultCount: 0,
      tickets: input.tickets
    };
  }

  const ticketIds = new Set(
    input.searchResults
      .filter((result) => result.category === "ticket" || result.category === "ticket_detail")
      .map((result) => result.relatedTicketId ?? result.recordId)
      .filter(Boolean)
  );
  const monitoringIds = new Set(
    input.searchResults
      .filter((result) => result.category === "monitoring_event")
      .map((result) => result.recordId)
  );
  const errorIds = new Set(
    input.searchResults
      .filter((result) => result.category === "error_event")
      .map((result) => result.recordId)
  );
  const timelineIds = new Set(
    input.searchResults
      .filter((result) => result.category === "timeline_event")
      .map((result) => result.recordId)
  );

  return {
    errorEvents: input.errorEvents.filter((event) => errorIds.has(event.errorId)),
    eventTimeline: input.eventTimeline.filter((item) => timelineIds.has(item.timelineItemId)),
    monitoringEvents: input.monitoringEvents.filter((event) => monitoringIds.has(event.eventId)),
    scope: "filtered_and_search" as const,
    searchResultCount: input.searchResults.length,
    tickets: input.tickets.filter((ticket) => ticketIds.has(ticket.ticketId))
  };
}

export function resolveSupportMetricsAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportMetricsAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewMetrics: true,
      reason: "Super Admin may view Support metrics through read-only runtime calculations.",
      roleLabel: "super_admin"
    };
  }

  if (
    input.internalRole === "support_agent" ||
    input.internalRole === "admin" ||
    input.internalRole === "super_admin"
  ) {
    return {
      canViewMetrics: true,
      reason: "Authorized internal support role may view Support metrics read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canViewMetrics: false,
    reason: "Current internal team role is not authorized for Support metrics.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportMetricsRuntime(input: {
  authorization: SupportMetricsAuthorization;
  errorEvents: SupportErrorEventRuntimeItem[];
  eventTimeline: SupportEventTimelineItem[];
  filtersApplied: boolean;
  loadError?: string | null;
  monitoringEvents: SupportMonitoringEventRuntimeItem[];
  searchQuery: string | null;
  searchResults: SupportSearchResultPublicItem[];
  tickets: SupportTicketRuntimeItem[];
}): SupportMetricsRuntimeSummary {
  if (!input.authorization.canViewMetrics) {
    return {
      assignedTickets: 0,
      closedTickets: 0,
      emptyMessage: null,
      errorEventsBySeverity: [],
      errorEventsByStatus: [],
      inProgressTickets: 0,
      loadError: null,
      loadingState: "unauthorized",
      metricCards: [],
      monitoringEventsBySeverity: [],
      monitoringEventsByStatus: [],
      openTickets: 0,
      pendingTickets: 0,
      readOnly: true,
      recentActivityCount: 0,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      resolvedTickets: 0,
      scope: "unscoped",
      searchResultCount: 0,
      source: SUPPORT_METRICS_RUNTIME_SOURCE,
      status: "unauthorized",
      summary: `status unauthorized; ${input.authorization.reason}`,
      ticketsByCategory: [],
      ticketsByPriority: [],
      totalErrorEvents: 0,
      totalMonitoringEvents: 0,
      totalTickets: 0,
      unassignedTickets: 0
    };
  }

  if (input.loadError) {
    return {
      assignedTickets: 0,
      closedTickets: 0,
      emptyMessage: null,
      errorEventsBySeverity: [],
      errorEventsByStatus: [],
      inProgressTickets: 0,
      loadError: input.loadError,
      loadingState: "error",
      metricCards: [],
      monitoringEventsBySeverity: [],
      monitoringEventsByStatus: [],
      openTickets: 0,
      pendingTickets: 0,
      readOnly: true,
      recentActivityCount: 0,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      resolvedTickets: 0,
      scope: "unscoped",
      searchResultCount: 0,
      source: SUPPORT_METRICS_RUNTIME_SOURCE,
      status: "load_error",
      summary: `status load_error; ${input.loadError}`,
      ticketsByCategory: [],
      ticketsByPriority: [],
      totalErrorEvents: 0,
      totalMonitoringEvents: 0,
      totalTickets: 0,
      unassignedTickets: 0
    };
  }

  const scoped = applySearchScopeToMetricsInput({
    errorEvents: input.errorEvents,
    eventTimeline: input.eventTimeline,
    monitoringEvents: input.monitoringEvents,
    searchQuery: input.searchQuery,
    searchResults: input.searchResults,
    tickets: input.tickets
  });

  const tickets = scoped.tickets;
  const monitoringEvents = scoped.monitoringEvents;
  const errorEvents = scoped.errorEvents;
  const eventTimeline = scoped.eventTimeline;

  const openTickets = tickets.filter((ticket) => resolveCanonicalStatus(ticket) === "open").length;
  const inProgressTickets = tickets.filter(
    (ticket) => resolveCanonicalStatus(ticket) === "in_progress"
  ).length;
  const pendingTickets = tickets.filter((ticket) => resolveCanonicalStatus(ticket) === "pending").length;
  const resolvedTickets = tickets.filter((ticket) => resolveCanonicalStatus(ticket) === "resolved").length;
  const closedTickets = tickets.filter((ticket) => resolveCanonicalStatus(ticket) === "closed").length;
  const assignedTickets = tickets.filter((ticket) => Boolean(ticket.assignedAgentId)).length;
  const unassignedTickets = tickets.length - assignedTickets;

  const ticketsByPriority = countByKey(tickets, (ticket) => ticket.priority || "unknown");
  const ticketsByCategory = countByKey(tickets, (ticket) => ticket.category || "unknown");
  const monitoringEventsBySeverity = countByKey(monitoringEvents, (event) => event.severity || "unknown");
  const monitoringEventsByStatus = countByKey(monitoringEvents, (event) => event.status || "unknown");
  const errorEventsBySeverity = countByKey(errorEvents, (event) => event.severity || "unknown");
  const errorEventsByStatus = countByKey(errorEvents, (event) => event.status || "unknown");

  const recentActivityCount = eventTimeline.length;
  const totalTickets = tickets.length;
  const totalMonitoringEvents = monitoringEvents.length;
  const totalErrorEvents = errorEvents.length;

  const hasData =
    totalTickets > 0 || totalMonitoringEvents > 0 || totalErrorEvents > 0 || recentActivityCount > 0;
  const status = hasData ? ("metrics_runtime_ready" as const) : ("metrics_empty" as const);

  const scopeSummary =
    scoped.scope === "filtered_and_search"
      ? "filters and search scoped"
      : input.filtersApplied
        ? "filters scoped"
        : "full runtime scope";

  return {
    assignedTickets,
    closedTickets,
    emptyMessage: hasData
      ? null
      : input.searchQuery
        ? "No Support metrics are available for the active search and filter scope."
        : input.filtersApplied
          ? "No Support metrics are available for the active filter scope."
          : "No Support records are available to calculate metrics yet.",
    errorEventsBySeverity,
    errorEventsByStatus,
    inProgressTickets,
    loadError: null,
    loadingState: hasData ? "computed" : "empty",
    metricCards: [
      { label: "Total tickets", value: String(totalTickets) },
      { label: "Open tickets", value: String(openTickets) },
      { label: "In progress", value: String(inProgressTickets) },
      { label: "Pending", value: String(pendingTickets) },
      { label: "Resolved", value: String(resolvedTickets) },
      { label: "Closed", value: String(closedTickets) },
      { label: "Assigned", value: String(assignedTickets) },
      { label: "Unassigned", value: String(unassignedTickets) },
      { label: "Monitoring events", value: String(totalMonitoringEvents) },
      { label: "Error events", value: String(totalErrorEvents) },
      { label: "Recent activity", value: String(recentActivityCount) },
      ...(input.searchQuery
        ? [{ label: "Search results", value: String(scoped.searchResultCount) }]
        : [])
    ],
    monitoringEventsBySeverity,
    monitoringEventsByStatus,
    openTickets,
    pendingTickets,
    readOnly: true,
    recentActivityCount,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    resolvedTickets,
    scope: scoped.scope === "filtered_and_search" ? scoped.scope : input.filtersApplied ? "filtered" : "unscoped",
    searchResultCount: scoped.searchResultCount,
    source: SUPPORT_METRICS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      scopeSummary,
      `${totalTickets} tickets`,
      `${openTickets} open`,
      `${totalMonitoringEvents} monitoring`,
      `${totalErrorEvents} errors`,
      `${recentActivityCount} recent activity`
    ].join("; "),
    ticketsByCategory,
    ticketsByPriority,
    totalErrorEvents,
    totalMonitoringEvents,
    totalTickets,
    unassignedTickets
  };
}

export function mapSupportMetricsRuntimeToAdminFields(
  input: ReturnType<typeof buildSupportMetricsRuntime>
) {
  return {
    supportMetricsRuntime: input
  };
}

export function supportMetricsRuntimeStatusBadgeTone(
  status: SupportMetricsRuntimeSummary["status"]
) {
  switch (status) {
    case "metrics_runtime_ready":
      return "green" as const;
    case "metrics_empty":
      return "slate" as const;
    case "unauthorized":
      return "red" as const;
    case "load_error":
      return "amber" as const;
  }
}
