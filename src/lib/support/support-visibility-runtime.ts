import "server-only";

import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportEventTimelineItem } from "@/src/lib/support/support-event-timeline-runtime";
import { buildSupportMetricsRuntime } from "@/src/lib/support/support-metrics-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE,
  type SupportRegistryEntry
} from "@/src/lib/support/support-registry-runtime";
import type { SupportSearchResultPublicItem } from "@/src/lib/support/support-search-runtime";
import type { SupportFiltersRuntimeSummary } from "@/src/lib/support/support-filters-runtime";
import type { SupportSearchRuntimeSummary } from "@/src/lib/support/support-search-runtime";
import type { SupportTicketConversationMessage } from "@/src/lib/support/support-ticket-conversation-runtime";
import type { SupportTicketDetailRuntimeItem } from "@/src/lib/support/support-ticket-details-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";

export type SupportVisibilityRuntimeSource = "support_visibility_runtime";

export type SupportVisibilityGroupKey = "support-data-visibility" | "support-module-visibility";

export type SupportVisibilityState = "hidden" | "restricted" | "super_admin_only" | "visible";

export type SupportVisibilityAccessLevel = "restricted" | "super_admin_only" | "unauthorized";

export type SupportRecordVisibilityState = "hidden" | "restricted" | "visible";

export type SupportVisibilityAuthorization = {
  accessLevel: SupportVisibilityAccessLevel;
  canViewSupportData: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportVisibilityRuntimeItem = {
  accessLevel: SupportVisibilityAccessLevel;
  groupKey: SupportVisibilityGroupKey;
  moduleKey: string;
  moduleName: string;
  permissionScope: string;
  recordCount: number;
  registryKey: string;
  restrictedRecordCount: number;
  safeSummary: string;
  visibility: SupportVisibilityState;
  visibilityKey: string;
  visibleRecordCount: number;
};

export type SupportVisibilityRuntimeGroup = {
  groupKey: SupportVisibilityGroupKey;
  itemCount: number;
  items: SupportVisibilityRuntimeItem[];
  title: string;
};

export type SupportVisibilityRuntimeSummary = {
  accessLevel: SupportVisibilityAccessLevel;
  emptyMessage: string | null;
  groupCount: number;
  hiddenRecordCount: number;
  loadError: string | null;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedRecordCount: number;
  source: SupportVisibilityRuntimeSource;
  status: "load_error" | "needs_attention" | "unauthorized" | "visibility_runtime_ready";
  summary: string;
  superAdminOnlyModules: number;
  totalModules: number;
  unauthorizedMessage: string | null;
  visibleModules: number;
  visibleRecordCount: number;
};

export const SUPPORT_VISIBILITY_RUNTIME_SOURCE = "support_visibility_runtime" as const;

const VISIBILITY_MODULE_KEYS = [
  "sp-tickets",
  "sp-ticket-details",
  "sp-ticket-conversation",
  "sp-monitoring-events",
  "sp-error-events",
  "sp-event-timeline",
  "sp-metrics",
  "sp-search",
  "sp-filters"
] as const;

const VISIBILITY_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportVisibilityGroupKey;
  title: string;
}> = [
  { groupKey: "support-module-visibility", title: "Support Module Visibility" },
  { groupKey: "support-data-visibility", title: "Support Data Visibility" }
] as const;

function resolveRegistryVisibility(entry: SupportRegistryEntry | null): SupportVisibilityState {
  if (!entry) {
    return "restricted";
  }

  if (entry.visibility === "hidden") {
    return "hidden";
  }

  if (entry.visibility === "super_admin") {
    return "super_admin_only";
  }

  return "visible";
}

export function resolveSupportVisibilityAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportVisibilityAuthorization {
  if (input.role === "super_admin") {
    return {
      accessLevel: "super_admin_only",
      canViewSupportData: true,
      reason: "Super Admin may view Support records through the read-only visibility runtime layer.",
      roleLabel: "super_admin"
    };
  }

  return {
    accessLevel: "unauthorized",
    canViewSupportData: false,
    reason: "Support visibility is restricted to Super Admin in SP-14.",
    roleLabel: input.role
  };
}

function classifyTicketVisibility(
  ticket: SupportTicketRuntimeItem,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!ticket.ticketId || !ticket.tableDetected) {
    return "restricted";
  }

  return "visible";
}

function classifyMonitoringVisibility(
  event: SupportMonitoringEventRuntimeItem,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!event.eventId || !event.tableDetected) {
    return "restricted";
  }

  return "visible";
}

function classifyErrorVisibility(
  event: SupportErrorEventRuntimeItem,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!event.errorId || !event.tableDetected) {
    return "restricted";
  }

  return "visible";
}

function classifyTimelineVisibility(
  item: SupportEventTimelineItem,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!item.timelineItemId) {
    return "restricted";
  }

  return "visible";
}

function classifySearchResultVisibility(
  result: SupportSearchResultPublicItem,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!result.recordId || !result.safeSummary) {
    return "restricted";
  }

  return "visible";
}

function classifyTicketDetailVisibility(
  ticketDetail: SupportTicketDetailRuntimeItem | null,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!ticketDetail) {
    return "restricted";
  }

  if (!ticketDetail.tableDetected) {
    return "restricted";
  }

  return "visible";
}

function classifyConversationMessageVisibility(
  message: SupportTicketConversationMessage,
  authorization: SupportVisibilityAuthorization
): SupportRecordVisibilityState {
  if (!authorization.canViewSupportData) {
    return "hidden";
  }

  if (!message.messageId || !message.safeSummary) {
    return "restricted";
  }

  return "visible";
}

function gateRecords<T>(
  items: T[],
  classify: (item: T) => SupportRecordVisibilityState
) {
  let hiddenRecordCount = 0;
  let restrictedRecordCount = 0;
  const visible: T[] = [];

  for (const item of items) {
    const state = classify(item);

    if (state === "visible") {
      visible.push(item);
      continue;
    }

    if (state === "restricted") {
      restrictedRecordCount += 1;
      continue;
    }

    hiddenRecordCount += 1;
  }

  return {
    hiddenRecordCount,
    restrictedRecordCount,
    visible
  };
}

function buildModuleVisibilityItem(input: {
  authorization: SupportVisibilityAuthorization;
  moduleKey: (typeof VISIBILITY_MODULE_KEYS)[number];
  recordCount: number;
  restrictedRecordCount: number;
  visibleRecordCount: number;
}): SupportVisibilityRuntimeItem {
  const entry = getSupportRegistryEntry(input.moduleKey);
  const visibility = !input.authorization.canViewSupportData
    ? ("hidden" as const)
    : resolveRegistryVisibility(entry);
  const accessLevel = input.authorization.accessLevel;

  return {
    accessLevel,
    groupKey: "support-module-visibility",
    moduleKey: input.moduleKey,
    moduleName: entry?.title ?? input.moduleKey,
    permissionScope: entry?.permissions.join(", ") ?? "super_admin:read",
    recordCount: input.recordCount,
    registryKey: input.moduleKey,
    restrictedRecordCount: input.restrictedRecordCount,
    safeSummary: [
      `module ${input.moduleKey}`,
      `visibility ${visibility}`,
      `access ${accessLevel}`,
      `${input.visibleRecordCount}/${input.recordCount} visible`,
      `${input.restrictedRecordCount} restricted`
    ].join("; "),
    visibility,
    visibilityKey: `support-visibility-${input.moduleKey}`,
    visibleRecordCount: input.visibleRecordCount
  };
}

export function buildSupportVisibilityRuntimeGroups(
  items: SupportVisibilityRuntimeItem[]
): SupportVisibilityRuntimeGroup[] {
  return VISIBILITY_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function supportVisibilityStateBadgeTone(state: SupportVisibilityState | SupportVisibilityRuntimeSummary["status"]) {
  switch (state) {
    case "visible":
    case "super_admin_only":
    case "visibility_runtime_ready":
      return "green" as const;
    case "restricted":
    case "needs_attention":
      return "amber" as const;
    case "hidden":
    case "unauthorized":
      return "red" as const;
    case "load_error":
      return "amber" as const;
  }
}

export function applySupportVisibilityRuntime(input: {
  authorization: SupportVisibilityAuthorization;
  errorEvents: SupportErrorEventRuntimeItem[];
  eventTimeline: SupportEventTimelineItem[];
  filtersApplied: boolean;
  filtersRuntime: SupportFiltersRuntimeSummary;
  loadError?: string | null;
  metricsAuthorization: Parameters<typeof buildSupportMetricsRuntime>[0]["authorization"];
  monitoringEvents: SupportMonitoringEventRuntimeItem[];
  searchQuery: string | null;
  searchResults: SupportSearchResultPublicItem[];
  searchRuntime: SupportSearchRuntimeSummary;
  ticketConversationMessages: SupportTicketConversationMessage[];
  ticketDetail: SupportTicketDetailRuntimeItem | null;
  tickets: SupportTicketRuntimeItem[];
}) {
  if (input.loadError) {
    return buildUnauthorizedVisibilityOutput(input, {
      loadError: input.loadError,
      status: "load_error"
    });
  }

  if (!input.authorization.canViewSupportData) {
    return buildUnauthorizedVisibilityOutput(input, {
      loadError: null,
      status: "unauthorized"
    });
  }

  const ticketGate = gateRecords(input.tickets, (ticket) =>
    classifyTicketVisibility(ticket, input.authorization)
  );
  const monitoringGate = gateRecords(input.monitoringEvents, (event) =>
    classifyMonitoringVisibility(event, input.authorization)
  );
  const errorGate = gateRecords(input.errorEvents, (event) =>
    classifyErrorVisibility(event, input.authorization)
  );
  const timelineGate = gateRecords(input.eventTimeline, (item) =>
    classifyTimelineVisibility(item, input.authorization)
  );
  const searchGate = gateRecords(input.searchResults, (result) =>
    classifySearchResultVisibility(result, input.authorization)
  );
  const conversationGate = gateRecords(input.ticketConversationMessages, (message) =>
    classifyConversationMessageVisibility(message, input.authorization)
  );

  const ticketDetailState = classifyTicketDetailVisibility(input.ticketDetail, input.authorization);
  const visibleTicketDetail =
    ticketDetailState === "visible" ? input.ticketDetail : ticketDetailState === "restricted" ? null : null;

  const visibleMetrics = buildSupportMetricsRuntime({
    authorization: input.metricsAuthorization,
    errorEvents: errorGate.visible,
    eventTimeline: timelineGate.visible,
    filtersApplied: input.filtersApplied,
    loadError: null,
    monitoringEvents: monitoringGate.visible,
    searchQuery: input.searchQuery,
    searchResults: searchGate.visible,
    tickets: ticketGate.visible
  });

  const moduleItems = [
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-tickets",
      recordCount: input.tickets.length,
      restrictedRecordCount: ticketGate.restrictedRecordCount,
      visibleRecordCount: ticketGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-ticket-details",
      recordCount: input.ticketDetail ? 1 : 0,
      restrictedRecordCount: ticketDetailState === "restricted" ? 1 : 0,
      visibleRecordCount: visibleTicketDetail ? 1 : 0
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-ticket-conversation",
      recordCount: input.ticketConversationMessages.length,
      restrictedRecordCount: conversationGate.restrictedRecordCount,
      visibleRecordCount: conversationGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-monitoring-events",
      recordCount: input.monitoringEvents.length,
      restrictedRecordCount: monitoringGate.restrictedRecordCount,
      visibleRecordCount: monitoringGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-error-events",
      recordCount: input.errorEvents.length,
      restrictedRecordCount: errorGate.restrictedRecordCount,
      visibleRecordCount: errorGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-event-timeline",
      recordCount: input.eventTimeline.length,
      restrictedRecordCount: timelineGate.restrictedRecordCount,
      visibleRecordCount: timelineGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-metrics",
      recordCount: 1,
      restrictedRecordCount: visibleMetrics.status === "metrics_empty" ? 1 : 0,
      visibleRecordCount: visibleMetrics.status === "metrics_runtime_ready" ? 1 : 0
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-search",
      recordCount: input.searchResults.length,
      restrictedRecordCount: searchGate.restrictedRecordCount,
      visibleRecordCount: searchGate.visible.length
    }),
    buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey: "sp-filters",
      recordCount: 1,
      restrictedRecordCount: input.filtersRuntime.status === "filters_empty" ? 1 : 0,
      visibleRecordCount: input.filtersRuntime.status === "filters_runtime_ready" || input.filtersRuntime.status === "filters_inactive" ? 1 : 0
    })
  ];

  const hiddenRecordCount =
    ticketGate.hiddenRecordCount +
    monitoringGate.hiddenRecordCount +
    errorGate.hiddenRecordCount +
    timelineGate.hiddenRecordCount +
    searchGate.hiddenRecordCount +
    conversationGate.hiddenRecordCount;
  const restrictedRecordCount =
    ticketGate.restrictedRecordCount +
    monitoringGate.restrictedRecordCount +
    errorGate.restrictedRecordCount +
    timelineGate.restrictedRecordCount +
    searchGate.restrictedRecordCount +
    conversationGate.restrictedRecordCount +
    (ticketDetailState === "restricted" ? 1 : 0);
  const visibleRecordCount =
    ticketGate.visible.length +
    monitoringGate.visible.length +
    errorGate.visible.length +
    timelineGate.visible.length +
    searchGate.visible.length +
    conversationGate.visible.length +
    (visibleTicketDetail ? 1 : 0);

  const superAdminOnlyModules = moduleItems.filter((item) => item.visibility === "super_admin_only").length;
  const visibleModules = moduleItems.filter((item) => item.visibleRecordCount > 0 || item.visibility === "super_admin_only").length;
  const status =
    restrictedRecordCount > 0 || hiddenRecordCount > 0
      ? ("needs_attention" as const)
      : ("visibility_runtime_ready" as const);

  const supportVisibilityRuntime: SupportVisibilityRuntimeSummary = {
    accessLevel: input.authorization.accessLevel,
    emptyMessage:
      visibleRecordCount === 0
        ? "No Support records are visible for the current Super Admin visibility context."
        : null,
    groupCount: buildSupportVisibilityRuntimeGroups(moduleItems).length,
    hiddenRecordCount,
    loadError: null,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      restrictedRecordCount > 0
        ? `${restrictedRecordCount} Support records were restricted because visibility metadata was missing or incomplete.`
        : null,
    restrictedRecordCount,
    source: SUPPORT_VISIBILITY_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `access ${input.authorization.accessLevel}`,
      `${visibleRecordCount} visible records`,
      `${restrictedRecordCount} restricted`,
      `${hiddenRecordCount} hidden`,
      `${superAdminOnlyModules} super-admin modules`
    ].join("; "),
    superAdminOnlyModules,
    totalModules: moduleItems.length,
    unauthorizedMessage: null,
    visibleModules,
    visibleRecordCount
  };

  return {
    supportVisibilityRuntime,
    supportVisibilityRuntimeGroups: buildSupportVisibilityRuntimeGroups(moduleItems),
    supportVisibilityRuntimeItems: moduleItems,
    visibleErrorEvents: errorGate.visible,
    visibleEventTimeline: timelineGate.visible,
    visibleMonitoringEvents: monitoringGate.visible,
    visibleSearchResults: searchGate.visible,
    visibleSupportMetricsRuntime: visibleMetrics,
    visibleTicketConversationMessages: conversationGate.visible,
    visibleTicketDetail,
    visibleTickets: ticketGate.visible
  };
}

function buildUnauthorizedVisibilityOutput(
  input: {
    authorization: SupportVisibilityAuthorization;
    filtersRuntime: SupportFiltersRuntimeSummary;
    loadError?: string | null;
    searchRuntime: SupportSearchRuntimeSummary;
  },
  state: { loadError: string | null; status: "load_error" | "unauthorized" }
) {
  const moduleItems = VISIBILITY_MODULE_KEYS.map((moduleKey) => {
    const entry = getSupportRegistryEntry(moduleKey);

    return buildModuleVisibilityItem({
      authorization: input.authorization,
      moduleKey,
      recordCount: 0,
      restrictedRecordCount: 0,
      visibleRecordCount: 0
    });
  }).map((item, index) => ({
    ...item,
    moduleName: getSupportRegistryEntry(VISIBILITY_MODULE_KEYS[index])?.title ?? item.moduleKey,
    visibility: "hidden" as const
  }));

  return {
    supportVisibilityRuntime: {
      accessLevel: input.authorization.accessLevel,
      emptyMessage: "Support records are hidden for the current account visibility context.",
      groupCount: buildSupportVisibilityRuntimeGroups(moduleItems).length,
      hiddenRecordCount: 0,
      loadError: state.loadError,
      readOnly: true as const,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage: null,
      restrictedRecordCount: 0,
      source: SUPPORT_VISIBILITY_RUNTIME_SOURCE,
      status: state.status,
      summary: state.loadError
        ? `status load_error; ${state.loadError}`
        : `status unauthorized; ${input.authorization.reason}`,
      superAdminOnlyModules: 0,
      totalModules: moduleItems.length,
      unauthorizedMessage:
        state.status === "unauthorized"
          ? "Support visibility is Super Admin only. Records are not shown for the current account."
          : null,
      visibleModules: 0,
      visibleRecordCount: 0
    },
    supportVisibilityRuntimeGroups: buildSupportVisibilityRuntimeGroups(moduleItems),
    supportVisibilityRuntimeItems: moduleItems,
    visibleErrorEvents: [] as SupportErrorEventRuntimeItem[],
    visibleEventTimeline: [] as SupportEventTimelineItem[],
    visibleMonitoringEvents: [] as SupportMonitoringEventRuntimeItem[],
    visibleSearchResults: [] as SupportSearchResultPublicItem[],
    visibleSupportMetricsRuntime: buildSupportMetricsRuntime({
      authorization: {
        canViewMetrics: false,
        reason: input.authorization.reason,
        roleLabel: input.authorization.roleLabel
      },
      errorEvents: [],
      eventTimeline: [],
      filtersApplied: false,
      loadError: state.loadError,
      monitoringEvents: [],
      searchQuery: null,
      searchResults: [],
      tickets: []
    }),
    visibleTicketConversationMessages: [] as SupportTicketConversationMessage[],
    visibleTicketDetail: null,
    visibleTickets: [] as SupportTicketRuntimeItem[]
  };
}

export function mapSupportVisibilityRuntimeToAdminFields(
  input: ReturnType<typeof applySupportVisibilityRuntime>
) {
  return input;
}
