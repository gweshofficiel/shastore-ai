import "server-only";

import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportEventTimelineItem } from "@/src/lib/support/support-event-timeline-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportSearchResultPublicItem } from "@/src/lib/support/support-search-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";

export type SupportFiltersRuntimeSource = "support_filters_runtime";

export type SupportFilterQuery = {
  agent: string | null;
  category: string | null;
  eventSeverity: string | null;
  eventSource: string | null;
  eventStatus: string | null;
  eventType: string | null;
  from: string | null;
  priority: string | null;
  status: string | null;
  store: string | null;
  to: string | null;
  user: string | null;
  workspace: string | null;
};

export type SupportFilterActiveItem = {
  dimension: keyof SupportFilterQuery;
  label: string;
  value: string;
};

export type SupportFilterOptions = {
  agents: string[];
  categories: string[];
  eventSeverities: string[];
  eventSources: string[];
  eventStatuses: string[];
  eventTypes: string[];
  priorities: string[];
  statuses: string[];
};

export type SupportFiltersLoadingState = "applied" | "inactive" | "unauthorized";

export type SupportFiltersAuthorization = {
  canApplyFilters: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportFiltersRuntimeSummary = {
  activeFilters: SupportFilterActiveItem[];
  appliedFilterCount: number;
  emptyMessage: string | null;
  filterOptions: SupportFilterOptions;
  filteredCounts: {
    errorEvents: number;
    eventTimeline: number;
    monitoringEvents: number;
    searchResults: number;
    tickets: number;
  };
  loadError: string | null;
  loadingState: SupportFiltersLoadingState;
  query: SupportFilterQuery;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  resetHref: string;
  source: SupportFiltersRuntimeSource;
  status: "filters_empty" | "filters_inactive" | "filters_runtime_ready" | "unauthorized";
  summary: string;
  totalCounts: {
    errorEvents: number;
    eventTimeline: number;
    monitoringEvents: number;
    searchResults: number;
    tickets: number;
  };
};

export const SUPPORT_FILTERS_RUNTIME_SOURCE = "support_filters_runtime" as const;

export const SUPPORT_FILTER_QUERY_KEYS = [
  "status",
  "priority",
  "category",
  "agent",
  "eventType",
  "eventSeverity",
  "eventSource",
  "eventStatus",
  "from",
  "to",
  "workspace",
  "store",
  "user"
] as const;

const FILTER_DIMENSION_LABELS: Record<keyof SupportFilterQuery, string> = {
  agent: "Assigned agent",
  category: "Ticket category",
  eventSeverity: "Event severity",
  eventSource: "Event source",
  eventStatus: "Event status",
  eventType: "Event type",
  from: "Date from",
  priority: "Ticket priority",
  status: "Ticket status",
  store: "Related store",
  to: "Date to",
  user: "Related user",
  workspace: "Related workspace"
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeFilterToken(value: unknown, maxLength = 80) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!normalized) {
    return null;
  }

  const safe = normalized.replace(/[^a-z0-9 _\-@./:]/g, "").slice(0, maxLength);
  return safe || null;
}

function sanitizeDateToken(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function emptySupportFilterQuery(): SupportFilterQuery {
  return {
    agent: null,
    category: null,
    eventSeverity: null,
    eventSource: null,
    eventStatus: null,
    eventType: null,
    from: null,
    priority: null,
    status: null,
    store: null,
    to: null,
    user: null,
    workspace: null
  };
}

export function parseSupportFilterQuery(input: Record<string, string | undefined>): SupportFilterQuery {
  return {
    agent: sanitizeFilterToken(input.agent),
    category: sanitizeFilterToken(input.category, 64),
    eventSeverity: sanitizeFilterToken(input.eventSeverity, 32),
    eventSource: sanitizeFilterToken(input.eventSource, 64),
    eventStatus: sanitizeFilterToken(input.eventStatus, 32),
    eventType: sanitizeFilterToken(input.eventType, 64),
    from: sanitizeDateToken(input.from),
    priority: sanitizeFilterToken(input.priority, 32),
    status: sanitizeFilterToken(input.status, 32),
    store: sanitizeFilterToken(input.store, 80),
    to: sanitizeDateToken(input.to),
    user: sanitizeFilterToken(input.user, 80),
    workspace: sanitizeFilterToken(input.workspace, 80)
  };
}

export function countActiveSupportFilters(query: SupportFilterQuery) {
  return Object.values(query).filter(Boolean).length;
}

export function buildSupportAdminHref(input: {
  filters?: SupportFilterQuery;
  q?: string | null;
  ticketId?: string | null;
}) {
  const params = new URLSearchParams();
  const filters = input.filters ?? emptySupportFilterQuery();

  if (input.ticketId) {
    params.set("ticket", input.ticketId);
  }

  if (input.q) {
    params.set("q", input.q);
  }

  for (const key of SUPPORT_FILTER_QUERY_KEYS) {
    const value = filters[key];

    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/admin/support?${query}` : "/admin/support";
}

export function buildSupportFilterResetHref(input: { q?: string | null; ticketId?: string | null }) {
  return buildSupportAdminHref({
    q: input.q ?? null,
    ticketId: input.ticketId ?? null
  });
}

export function buildSupportSearchResetHref(input: {
  filters?: SupportFilterQuery;
  ticketId?: string | null;
}) {
  return buildSupportAdminHref({
    filters: input.filters,
    ticketId: input.ticketId ?? null
  });
}

function buildActiveFilters(query: SupportFilterQuery): SupportFilterActiveItem[] {
  return (Object.keys(query) as Array<keyof SupportFilterQuery>)
    .filter((dimension) => Boolean(query[dimension]))
    .map((dimension) => ({
      dimension,
      label: FILTER_DIMENSION_LABELS[dimension],
      value: query[dimension] as string
    }));
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function withinDateRange(createdAt: string | null, from: string | null, to: string | null) {
  if (!from && !to) {
    return true;
  }

  if (!createdAt) {
    return false;
  }

  const time = new Date(createdAt).getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  if (from) {
    const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();

    if (time < fromTime) {
      return false;
    }
  }

  if (to) {
    const toTime = new Date(`${to}T23:59:59.999Z`).getTime();

    if (time > toTime) {
      return false;
    }
  }

  return true;
}

function matchesScopeFilter(input: {
  filters: SupportFilterQuery;
  storeId: string | null;
  userId: string | null;
  workspaceId: string | null;
}) {
  if (input.filters.workspace && normalizeToken(input.workspaceId ?? "") !== input.filters.workspace) {
    return false;
  }

  if (input.filters.store && normalizeToken(input.storeId ?? "") !== input.filters.store) {
    return false;
  }

  if (input.filters.user && normalizeToken(input.userId ?? "") !== input.filters.user) {
    return false;
  }

  return true;
}

function matchesPartialToken(value: string | null | undefined, filterValue: string | null) {
  if (!filterValue) {
    return true;
  }

  return normalizeToken(value ?? "").includes(filterValue);
}

export function matchesSupportTicketFilters(
  ticket: SupportTicketRuntimeItem,
  filters: SupportFilterQuery
) {
  if (filters.status) {
    const statusHaystack = [ticket.status, ticket.canonicalStatus, ticket.runtimeStatus]
      .map((value) => normalizeToken(value))
      .join(" ");

    if (!statusHaystack.includes(filters.status)) {
      return false;
    }
  }

  if (filters.priority && normalizeToken(ticket.priority) !== filters.priority) {
    return false;
  }

  if (filters.category && normalizeToken(ticket.category) !== filters.category) {
    return false;
  }

  if (filters.agent) {
    const agentHaystack = [ticket.assignedAgentId, ticket.assignedAgentLabel]
      .map((value) => normalizeToken(value ?? ""))
      .join(" ");

    if (!agentHaystack.includes(filters.agent)) {
      return false;
    }
  }

  if (
    !matchesScopeFilter({
      filters,
      storeId: ticket.relatedStoreId,
      userId: ticket.relatedUserId,
      workspaceId: ticket.relatedWorkspaceId
    })
  ) {
    return false;
  }

  return withinDateRange(ticket.createdAt, filters.from, filters.to);
}

export function matchesSupportMonitoringEventFilters(
  event: SupportMonitoringEventRuntimeItem,
  filters: SupportFilterQuery
) {
  if (!matchesPartialToken(event.eventType, filters.eventType)) {
    return false;
  }

  if (filters.eventSeverity && normalizeToken(event.severity) !== filters.eventSeverity) {
    return false;
  }

  if (filters.eventSource && normalizeToken(event.source) !== filters.eventSource) {
    return false;
  }

  if (filters.eventStatus && normalizeToken(event.status) !== filters.eventStatus) {
    return false;
  }

  if (
    !matchesScopeFilter({
      filters,
      storeId: event.relatedStoreId,
      userId: event.relatedUserId,
      workspaceId: event.relatedWorkspaceId
    })
  ) {
    return false;
  }

  return withinDateRange(event.createdAt, filters.from, filters.to);
}

export function matchesSupportErrorEventFilters(
  event: SupportErrorEventRuntimeItem,
  filters: SupportFilterQuery
) {
  if (!matchesPartialToken(event.errorType, filters.eventType)) {
    return false;
  }

  if (filters.eventSeverity && normalizeToken(event.severity) !== filters.eventSeverity) {
    return false;
  }

  if (filters.eventSource && normalizeToken(event.source) !== filters.eventSource) {
    return false;
  }

  if (filters.eventStatus && normalizeToken(event.status) !== filters.eventStatus) {
    return false;
  }

  if (
    !matchesScopeFilter({
      filters,
      storeId: event.relatedStoreId,
      userId: event.relatedUserId,
      workspaceId: event.relatedWorkspaceId
    })
  ) {
    return false;
  }

  return withinDateRange(event.createdAt, filters.from, filters.to);
}

export function matchesSupportTimelineFilters(
  item: SupportEventTimelineItem,
  filters: SupportFilterQuery
) {
  if (
    filters.eventType &&
    !matchesPartialToken(item.eventType, filters.eventType) &&
    !matchesPartialToken(item.eventTypeLabel, filters.eventType)
  ) {
    return false;
  }

  if (filters.eventSeverity && normalizeToken(item.severity ?? "") !== filters.eventSeverity) {
    return false;
  }

  if (filters.eventSource && normalizeToken(item.source) !== filters.eventSource) {
    return false;
  }

  if (filters.eventStatus && normalizeToken(item.status ?? "") !== filters.eventStatus) {
    return false;
  }

  if (
    !matchesScopeFilter({
      filters,
      storeId: item.relatedStoreId,
      userId: item.relatedUserId,
      workspaceId: item.relatedWorkspaceId
    })
  ) {
    return false;
  }

  return withinDateRange(item.createdAt, filters.from, filters.to);
}

export function matchesSupportSearchResultFilters(
  result: SupportSearchResultPublicItem,
  filters: SupportFilterQuery
) {
  if (result.category === "ticket" || result.category === "ticket_detail") {
    if (filters.status && !matchesPartialToken(result.status, filters.status)) {
      return false;
    }

    if (filters.priority && !normalizeToken(result.safeSummary).includes(filters.priority)) {
      return false;
    }

    if (filters.category && !normalizeToken(result.safeSummary).includes(filters.category)) {
      return false;
    }
  } else if (
    result.category === "monitoring_event" ||
    result.category === "error_event" ||
    result.category === "timeline_event"
  ) {
    if (
      filters.eventType &&
      !matchesPartialToken(result.resultTitle, filters.eventType) &&
      !matchesPartialToken(result.category, filters.eventType)
    ) {
      return false;
    }

    if (filters.eventSeverity && normalizeToken(result.severity ?? "") !== filters.eventSeverity) {
      return false;
    }

    if (filters.eventSource && normalizeToken(result.source ?? "") !== filters.eventSource) {
      return false;
    }

    if (filters.eventStatus && normalizeToken(result.status ?? "") !== filters.eventStatus) {
      return false;
    }
  }

  if (
    !matchesScopeFilter({
      filters,
      storeId: result.relatedStoreId,
      userId: result.relatedUserId,
      workspaceId: result.relatedWorkspaceId
    })
  ) {
    return false;
  }

  return withinDateRange(result.createdAt, filters.from, filters.to);
}

export function resolveSupportFiltersAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportFiltersAuthorization {
  if (input.role === "super_admin") {
    return {
      canApplyFilters: true,
      reason: "Super Admin may apply Support filters through read-only runtime views.",
      roleLabel: "super_admin"
    };
  }

  if (
    input.internalRole === "support_agent" ||
    input.internalRole === "admin" ||
    input.internalRole === "super_admin"
  ) {
    return {
      canApplyFilters: true,
      reason: "Authorized internal support role may apply Support filters read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canApplyFilters: false,
    reason: "Current internal team role is not authorized for Support filters.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportFilterOptions(input: {
  errorEvents: SupportErrorEventRuntimeItem[];
  eventTimeline: SupportEventTimelineItem[];
  monitoringEvents: SupportMonitoringEventRuntimeItem[];
  tickets: SupportTicketRuntimeItem[];
}): SupportFilterOptions {
  return {
    agents: uniqueSorted(
      input.tickets.flatMap((ticket) => [ticket.assignedAgentId, ticket.assignedAgentLabel])
    ),
    categories: uniqueSorted(input.tickets.map((ticket) => ticket.category)),
    eventSeverities: uniqueSorted([
      ...input.monitoringEvents.map((event) => event.severity),
      ...input.errorEvents.map((event) => event.severity),
      ...input.eventTimeline.map((item) => item.severity)
    ]),
    eventSources: uniqueSorted([
      ...input.monitoringEvents.map((event) => event.source),
      ...input.errorEvents.map((event) => event.source),
      ...input.eventTimeline.map((item) => item.source)
    ]),
    eventStatuses: uniqueSorted([
      ...input.monitoringEvents.map((event) => event.status),
      ...input.errorEvents.map((event) => event.status),
      ...input.eventTimeline.map((item) => item.status)
    ]),
    eventTypes: uniqueSorted([
      ...input.monitoringEvents.map((event) => event.eventType),
      ...input.errorEvents.map((event) => event.errorType),
      ...input.eventTimeline.map((item) => item.eventTypeLabel)
    ]),
    priorities: uniqueSorted(input.tickets.map((ticket) => ticket.priority)),
    statuses: uniqueSorted(
      input.tickets.flatMap((ticket) => [ticket.status, ticket.canonicalStatus, ticket.runtimeStatus])
    )
  };
}

export function applySupportFiltersRuntime(input: {
  authorization: SupportFiltersAuthorization;
  errorEvents: SupportErrorEventRuntimeItem[];
  eventTimeline: SupportEventTimelineItem[];
  filterQuery: SupportFilterQuery;
  monitoringEvents: SupportMonitoringEventRuntimeItem[];
  q?: string | null;
  searchResults: SupportSearchResultPublicItem[];
  ticketId?: string | null;
  tickets: SupportTicketRuntimeItem[];
}) {
  const appliedFilterCount = countActiveSupportFilters(input.filterQuery);
  const resetHref = buildSupportFilterResetHref({
    q: input.q ?? null,
    ticketId: input.ticketId ?? null
  });

  if (!input.authorization.canApplyFilters) {
    return {
      filteredErrorEvents: input.errorEvents,
      filteredEventTimeline: input.eventTimeline,
      filteredMonitoringEvents: input.monitoringEvents,
      filteredSearchResults: input.searchResults,
      filteredTickets: input.tickets,
      supportFiltersRuntime: {
        activeFilters: [],
        appliedFilterCount: 0,
        emptyMessage: null,
        filterOptions: buildSupportFilterOptions({
          errorEvents: input.errorEvents,
          eventTimeline: input.eventTimeline,
          monitoringEvents: input.monitoringEvents,
          tickets: input.tickets
        }),
        filteredCounts: {
          errorEvents: input.errorEvents.length,
          eventTimeline: input.eventTimeline.length,
          monitoringEvents: input.monitoringEvents.length,
          searchResults: input.searchResults.length,
          tickets: input.tickets.length
        },
        loadError: null,
        loadingState: "unauthorized" as const,
        query: input.filterQuery,
        readOnly: true as const,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        resetHref,
        source: SUPPORT_FILTERS_RUNTIME_SOURCE,
        status: "unauthorized" as const,
        summary: `status unauthorized; ${input.authorization.reason}`,
        totalCounts: {
          errorEvents: input.errorEvents.length,
          eventTimeline: input.eventTimeline.length,
          monitoringEvents: input.monitoringEvents.length,
          searchResults: input.searchResults.length,
          tickets: input.tickets.length
        }
      }
    };
  }

  const filterOptions = buildSupportFilterOptions({
    errorEvents: input.errorEvents,
    eventTimeline: input.eventTimeline,
    monitoringEvents: input.monitoringEvents,
    tickets: input.tickets
  });

  if (appliedFilterCount === 0) {
    return {
      filteredErrorEvents: input.errorEvents,
      filteredEventTimeline: input.eventTimeline,
      filteredMonitoringEvents: input.monitoringEvents,
      filteredSearchResults: input.searchResults,
      filteredTickets: input.tickets,
      supportFiltersRuntime: {
        activeFilters: [],
        appliedFilterCount: 0,
        emptyMessage: null,
        filterOptions,
        filteredCounts: {
          errorEvents: input.errorEvents.length,
          eventTimeline: input.eventTimeline.length,
          monitoringEvents: input.monitoringEvents.length,
          searchResults: input.searchResults.length,
          tickets: input.tickets.length
        },
        loadError: null,
        loadingState: "inactive" as const,
        query: input.filterQuery,
        readOnly: true as const,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        resetHref,
        source: SUPPORT_FILTERS_RUNTIME_SOURCE,
        status: "filters_inactive" as const,
        summary: "status filters_inactive; submit filters to narrow Support records",
        totalCounts: {
          errorEvents: input.errorEvents.length,
          eventTimeline: input.eventTimeline.length,
          monitoringEvents: input.monitoringEvents.length,
          searchResults: input.searchResults.length,
          tickets: input.tickets.length
        }
      }
    };
  }

  const filteredTickets = input.tickets.filter((ticket) =>
    matchesSupportTicketFilters(ticket, input.filterQuery)
  );
  const filteredMonitoringEvents = input.monitoringEvents.filter((event) =>
    matchesSupportMonitoringEventFilters(event, input.filterQuery)
  );
  const filteredErrorEvents = input.errorEvents.filter((event) =>
    matchesSupportErrorEventFilters(event, input.filterQuery)
  );
  const filteredEventTimeline = input.eventTimeline.filter((item) =>
    matchesSupportTimelineFilters(item, input.filterQuery)
  );
  const filteredSearchResults = input.searchResults.filter((result) =>
    matchesSupportSearchResultFilters(result, input.filterQuery)
  );

  const filteredCounts = {
    errorEvents: filteredErrorEvents.length,
    eventTimeline: filteredEventTimeline.length,
    monitoringEvents: filteredMonitoringEvents.length,
    searchResults: filteredSearchResults.length,
    tickets: filteredTickets.length
  };
  const totalCounts = {
    errorEvents: input.errorEvents.length,
    eventTimeline: input.eventTimeline.length,
    monitoringEvents: input.monitoringEvents.length,
    searchResults: input.searchResults.length,
    tickets: input.tickets.length
  };
  const allFilteredEmpty =
    filteredCounts.tickets === 0 &&
    filteredCounts.monitoringEvents === 0 &&
    filteredCounts.errorEvents === 0 &&
    filteredCounts.eventTimeline === 0 &&
    (input.searchResults.length === 0 || filteredCounts.searchResults === 0);
  const status = allFilteredEmpty ? ("filters_empty" as const) : ("filters_runtime_ready" as const);

  return {
    filteredErrorEvents,
    filteredEventTimeline,
    filteredMonitoringEvents,
    filteredSearchResults,
    filteredTickets,
    supportFiltersRuntime: {
      activeFilters: buildActiveFilters(input.filterQuery),
      appliedFilterCount,
      emptyMessage: allFilteredEmpty
        ? "No Support records match the active filters. Reset filters to restore the full runtime views."
        : null,
      filterOptions,
      filteredCounts,
      loadError: null,
      loadingState: "applied" as const,
      query: input.filterQuery,
      readOnly: true as const,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      resetHref,
      source: SUPPORT_FILTERS_RUNTIME_SOURCE,
      status,
      summary: [
        `status ${status}`,
        `${appliedFilterCount} filters active`,
        `${filteredCounts.tickets}/${totalCounts.tickets} tickets`,
        `${filteredCounts.monitoringEvents}/${totalCounts.monitoringEvents} monitoring`,
        `${filteredCounts.errorEvents}/${totalCounts.errorEvents} errors`,
        `${filteredCounts.eventTimeline}/${totalCounts.eventTimeline} timeline`
      ].join("; "),
      totalCounts
    }
  };
}

export function mapSupportFiltersRuntimeToAdminFields(
  input: ReturnType<typeof applySupportFiltersRuntime>
) {
  return {
    filteredErrorEvents: input.filteredErrorEvents,
    filteredEventTimeline: input.filteredEventTimeline,
    filteredMonitoringEvents: input.filteredMonitoringEvents,
    filteredSearchResults: input.filteredSearchResults,
    filteredTickets: input.filteredTickets,
    supportFiltersRuntime: input.supportFiltersRuntime
  };
}

export function supportFiltersRuntimeStatusBadgeTone(
  status: SupportFiltersRuntimeSummary["status"]
) {
  switch (status) {
    case "filters_runtime_ready":
      return "green" as const;
    case "filters_inactive":
      return "blue" as const;
    case "filters_empty":
      return "slate" as const;
    case "unauthorized":
      return "red" as const;
  }
}
