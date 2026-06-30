import "server-only";

import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE,
  type SupportRegistryVisibility
} from "@/src/lib/support/support-registry-runtime";
import type { SupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export type SupportStatusRuntimeSource = "support_status_runtime";

export type SupportStatusGroupKey =
  | "analytics-export-status"
  | "discovery-status"
  | "events-status"
  | "governance-status"
  | "tickets-status";

export type SupportModuleOperationalStatus = "empty" | "error" | "needs_review" | "ready" | "restricted";

export type SupportStatusLoadingState = "computed" | "empty" | "error" | "restricted" | "unauthorized";

export type SupportStatusAuthorization = {
  canViewSupportStatus: boolean;
  reason: string;
  roleLabel: string;
};

export type SupportStatusRuntimeItem = {
  groupKey: SupportStatusGroupKey;
  loadingState: SupportStatusLoadingState;
  moduleKey: string;
  moduleName: string;
  operationalStatus: SupportModuleOperationalStatus;
  operationalStatusLabel: string;
  providerStatus: string;
  readOnly: true;
  recordCount: number | null;
  registryKey: string;
  safeSummary: string;
  supportStatusKey: string;
  visibility: SupportRegistryVisibility;
};

export type SupportStatusRuntimeGroup = {
  groupKey: SupportStatusGroupKey;
  itemCount: number;
  items: SupportStatusRuntimeItem[];
  title: string;
};

export type SupportStatusRuntimeSummary = {
  emptyMessage: string | null;
  emptyModules: number;
  errorModules: number;
  groupCount: number;
  hiddenRecordCount: number;
  loadError: string | null;
  loadingState: SupportStatusLoadingState;
  needsReviewModules: number;
  readOnly: true;
  readyModules: number;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedModules: number;
  restrictedRecordCount: number;
  source: SupportStatusRuntimeSource;
  status: "load_error" | "needs_attention" | "status_empty" | "status_runtime_ready" | "unauthorized";
  summary: string;
  totalModules: number;
  unauthorizedMessage: string | null;
  visibleRecordCount: number;
};

export type SupportStatusRuntimeSnapshot = {
  loadError?: string | null;
  loadingState?: string | null;
  recordCount?: number | null;
  status: string;
  summary: string;
  unauthorized?: boolean;
};

export type SupportStatusRuntimeInput = {
  analyticsRuntime: SupportStatusRuntimeSnapshot;
  auditRuntime: SupportStatusRuntimeSnapshot;
  authorization: SupportStatusAuthorization;
  exportRuntime: SupportStatusRuntimeSnapshot;
  filtersRuntime: SupportStatusRuntimeSnapshot;
  hiddenRecordCount?: number;
  loadError?: string | null;
  metricsRuntime: SupportStatusRuntimeSnapshot;
  monitoringEventsRuntime: SupportStatusRuntimeSnapshot;
  notificationsRuntime: SupportStatusRuntimeSnapshot;
  restrictedRecordCount?: number;
  reviewRuntime: SupportStatusRuntimeSnapshot;
  safeActionsRuntime: SupportStatusRuntimeSnapshot;
  searchRuntime: SupportStatusRuntimeSnapshot;
  ticketAssignmentRuntime: SupportStatusRuntimeSnapshot;
  ticketConversationRuntime: SupportStatusRuntimeSnapshot;
  ticketDetailsRuntime: SupportStatusRuntimeSnapshot;
  ticketStatusRuntime: SupportStatusRuntimeSnapshot;
  ticketsRuntime: SupportStatusRuntimeSnapshot;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibilityRuntime: SupportStatusRuntimeSnapshot;
  errorEventsRuntime: SupportStatusRuntimeSnapshot;
  eventTimelineRuntime: SupportStatusRuntimeSnapshot;
};

export const SUPPORT_STATUS_RUNTIME_SOURCE = "support_status_runtime" as const;

const STATUS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportStatusGroupKey;
  title: string;
}> = [
  { groupKey: "tickets-status", title: "Tickets Status" },
  { groupKey: "events-status", title: "Events Status" },
  { groupKey: "discovery-status", title: "Discovery Status" },
  { groupKey: "governance-status", title: "Governance Status" },
  { groupKey: "analytics-export-status", title: "Analytics & Export Status" }
] as const;

type StatusModuleBinding = {
  category: string;
  groupKey: SupportStatusGroupKey;
  moduleKey: string;
  moduleName: string;
  registryKey: string;
  resolveSnapshot: (input: SupportStatusRuntimeInput) => SupportStatusRuntimeSnapshot;
  supportStatusKey: string;
};

const STATUS_MODULE_BINDINGS: readonly StatusModuleBinding[] = [
  {
    category: "Tickets",
    groupKey: "tickets-status",
    moduleKey: "support_tickets_runtime",
    moduleName: "Tickets runtime",
    registryKey: "sp-tickets",
    resolveSnapshot: (input) => input.ticketsRuntime,
    supportStatusKey: "sp-status-tickets"
  },
  {
    category: "Tickets",
    groupKey: "tickets-status",
    moduleKey: "support_ticket_details_runtime",
    moduleName: "Ticket details runtime",
    registryKey: "sp-ticket-details",
    resolveSnapshot: (input) => input.ticketDetailsRuntime,
    supportStatusKey: "sp-status-ticket-details"
  },
  {
    category: "Tickets",
    groupKey: "tickets-status",
    moduleKey: "support_ticket_status_runtime",
    moduleName: "Ticket status runtime",
    registryKey: "sp-ticket-status",
    resolveSnapshot: (input) => input.ticketStatusRuntime,
    supportStatusKey: "sp-status-ticket-status"
  },
  {
    category: "Tickets",
    groupKey: "tickets-status",
    moduleKey: "support_ticket_assignment_runtime",
    moduleName: "Ticket assignment runtime",
    registryKey: "sp-ticket-assignment",
    resolveSnapshot: (input) => input.ticketAssignmentRuntime,
    supportStatusKey: "sp-status-ticket-assignment"
  },
  {
    category: "Tickets",
    groupKey: "tickets-status",
    moduleKey: "support_ticket_conversation_runtime",
    moduleName: "Ticket conversation runtime",
    registryKey: "sp-ticket-conversation",
    resolveSnapshot: (input) => input.ticketConversationRuntime,
    supportStatusKey: "sp-status-ticket-conversation"
  },
  {
    category: "Events",
    groupKey: "events-status",
    moduleKey: "support_monitoring_events_runtime",
    moduleName: "Monitoring events runtime",
    registryKey: "sp-monitoring-events",
    resolveSnapshot: (input) => input.monitoringEventsRuntime,
    supportStatusKey: "sp-status-monitoring-events"
  },
  {
    category: "Events",
    groupKey: "events-status",
    moduleKey: "support_error_events_runtime",
    moduleName: "Error events runtime",
    registryKey: "sp-error-events",
    resolveSnapshot: (input) => input.errorEventsRuntime,
    supportStatusKey: "sp-status-error-events"
  },
  {
    category: "Events",
    groupKey: "events-status",
    moduleKey: "support_event_timeline_runtime",
    moduleName: "Event timeline runtime",
    registryKey: "sp-event-timeline",
    resolveSnapshot: (input) => input.eventTimelineRuntime,
    supportStatusKey: "sp-status-event-timeline"
  },
  {
    category: "Discovery",
    groupKey: "discovery-status",
    moduleKey: "support_search_runtime",
    moduleName: "Search runtime",
    registryKey: "sp-search",
    resolveSnapshot: (input) => input.searchRuntime,
    supportStatusKey: "sp-status-search"
  },
  {
    category: "Discovery",
    groupKey: "discovery-status",
    moduleKey: "support_filters_runtime",
    moduleName: "Filters runtime",
    registryKey: "sp-filters",
    resolveSnapshot: (input) => input.filtersRuntime,
    supportStatusKey: "sp-status-filters"
  },
  {
    category: "Discovery",
    groupKey: "discovery-status",
    moduleKey: "support_metrics_runtime",
    moduleName: "Metrics runtime",
    registryKey: "sp-metrics",
    resolveSnapshot: (input) => input.metricsRuntime,
    supportStatusKey: "sp-status-metrics"
  },
  {
    category: "Governance",
    groupKey: "governance-status",
    moduleKey: "support_visibility_runtime",
    moduleName: "Visibility runtime",
    registryKey: "sp-visibility",
    resolveSnapshot: (input) => input.visibilityRuntime,
    supportStatusKey: "sp-status-visibility"
  },
  {
    category: "Governance",
    groupKey: "governance-status",
    moduleKey: "support_safe_actions_runtime",
    moduleName: "Safe actions runtime",
    registryKey: "sp-safe-actions",
    resolveSnapshot: (input) => input.safeActionsRuntime,
    supportStatusKey: "sp-status-safe-actions"
  },
  {
    category: "Governance",
    groupKey: "governance-status",
    moduleKey: "support_audit_runtime",
    moduleName: "Audit runtime",
    registryKey: "sp-audit",
    resolveSnapshot: (input) => input.auditRuntime,
    supportStatusKey: "sp-status-audit"
  },
  {
    category: "Governance",
    groupKey: "governance-status",
    moduleKey: "support_review_runtime",
    moduleName: "Review runtime",
    registryKey: "sp-review",
    resolveSnapshot: (input) => input.reviewRuntime,
    supportStatusKey: "sp-status-review"
  },
  {
    category: "Governance",
    groupKey: "governance-status",
    moduleKey: "support_notifications_runtime",
    moduleName: "Notifications runtime",
    registryKey: "sp-notifications",
    resolveSnapshot: (input) => input.notificationsRuntime,
    supportStatusKey: "sp-status-notifications"
  },
  {
    category: "Analytics & Export",
    groupKey: "analytics-export-status",
    moduleKey: "support_analytics_runtime",
    moduleName: "Analytics runtime",
    registryKey: "sp-analytics",
    resolveSnapshot: (input) => input.analyticsRuntime,
    supportStatusKey: "sp-status-analytics"
  },
  {
    category: "Analytics & Export",
    groupKey: "analytics-export-status",
    moduleKey: "support_export_runtime",
    moduleName: "Export runtime",
    registryKey: "sp-export",
    resolveSnapshot: (input) => input.exportRuntime,
    supportStatusKey: "sp-status-export"
  }
] as const;

function safeText(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function resolveSupportStatusAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportStatusAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewSupportStatus: true,
      reason: "Super Admin may view Support status through read-only runtime summaries.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewSupportStatus: false,
    reason: "Support status is restricted to Super Admin in SP-21.",
    roleLabel: input.role
  };
}

export function supportModuleOperationalStatusLabel(status: SupportModuleOperationalStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "needs_review":
      return "Needs Review";
    case "restricted":
      return "Restricted";
    case "empty":
      return "Empty";
    case "error":
      return "Error";
  }
}

export function supportModuleOperationalStatusBadgeTone(
  status: SupportModuleOperationalStatus
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "ready":
      return "green";
    case "needs_review":
      return "amber";
    case "restricted":
      return "amber";
    case "empty":
      return "slate";
    case "error":
      return "red";
  }
}

export function supportStatusRuntimeStatusBadgeTone(
  status: SupportStatusRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "status_runtime_ready":
      return "green";
    case "status_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

function mapSnapshotToOperationalStatus(snapshot: SupportStatusRuntimeSnapshot): SupportModuleOperationalStatus {
  const providerStatus = snapshot.status.toLowerCase();
  const loadingState = safeText(snapshot.loadingState, 40).toLowerCase();

  if (snapshot.unauthorized || providerStatus.includes("unauthorized") || loadingState === "unauthorized") {
    return "restricted";
  }

  if (providerStatus.includes("load_error") || loadingState === "error" || Boolean(snapshot.loadError)) {
    return "error";
  }

  if (loadingState === "restricted" || providerStatus.includes("restricted")) {
    return "restricted";
  }

  if (
    providerStatus.includes("_empty") ||
    providerStatus === "unselected" ||
    providerStatus === "search_inactive" ||
    providerStatus === "filters_inactive" ||
    loadingState === "empty"
  ) {
    return "empty";
  }

  if (providerStatus.includes("needs_attention")) {
    return "needs_review";
  }

  if (providerStatus.includes("_ready") || providerStatus.endsWith("_ready")) {
    return "ready";
  }

  return "needs_review";
}

function resolveModuleLoadingState(
  snapshot: SupportStatusRuntimeSnapshot,
  authorized: boolean
): SupportStatusLoadingState {
  if (!authorized) {
    return "unauthorized";
  }

  const loadingState = safeText(snapshot.loadingState, 40).toLowerCase();

  if (snapshot.loadError || snapshot.status.includes("load_error") || loadingState === "error") {
    return "error";
  }

  if (loadingState === "restricted") {
    return "restricted";
  }

  if (loadingState === "empty" || snapshot.status.includes("_empty") || snapshot.status === "unselected") {
    return "empty";
  }

  return "computed";
}

function buildStatusModuleItem(binding: StatusModuleBinding, input: SupportStatusRuntimeInput): SupportStatusRuntimeItem {
  const registryEntry = getSupportRegistryEntry(binding.registryKey);
  const snapshot = binding.resolveSnapshot(input);
  const authorized = input.authorization.canViewSupportStatus && input.visibilityAuthorization.canViewSupportData;
  const operationalStatus = authorized ? mapSnapshotToOperationalStatus(snapshot) : "restricted";

  return {
    groupKey: binding.groupKey,
    loadingState: resolveModuleLoadingState(snapshot, authorized),
    moduleKey: binding.moduleKey,
    moduleName: binding.moduleName,
    operationalStatus,
    operationalStatusLabel: supportModuleOperationalStatusLabel(operationalStatus),
    providerStatus: snapshot.status,
    readOnly: true,
    recordCount: snapshot.recordCount ?? null,
    registryKey: binding.registryKey,
    safeSummary: safeText(snapshot.summary),
    supportStatusKey: binding.supportStatusKey,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

export function buildSupportStatusRuntimeGroups(items: SupportStatusRuntimeItem[]): SupportStatusRuntimeGroup[] {
  return STATUS_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

function countModulesByStatus(items: SupportStatusRuntimeItem[], status: SupportModuleOperationalStatus) {
  return items.filter((item) => item.operationalStatus === status).length;
}

export function buildSupportStatusRuntimeReadOnlySafe(input: SupportStatusRuntimeInput): {
  supportStatusRuntime: SupportStatusRuntimeSummary;
  supportStatusRuntimeGroups: SupportStatusRuntimeGroup[];
  supportStatusRuntimeItems: SupportStatusRuntimeItem[];
} {
  const registryEntry = getSupportRegistryEntry("sp-status");
  const hiddenRecordCount = input.hiddenRecordCount ?? 0;
  const restrictedRecordCount = input.restrictedRecordCount ?? 0;

  if (!input.authorization.canViewSupportStatus || !input.visibilityAuthorization.canViewSupportData) {
    return {
      supportStatusRuntime: {
        emptyMessage: "Support status is hidden for the current account.",
        emptyModules: 0,
        errorModules: 0,
        groupCount: 0,
        hiddenRecordCount,
        loadError: null,
        loadingState: "unauthorized",
        needsReviewModules: 0,
        readOnly: true,
        readyModules: 0,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        restrictedMessage: null,
        restrictedModules: 0,
        restrictedRecordCount,
        source: SUPPORT_STATUS_RUNTIME_SOURCE,
        status: "unauthorized",
        summary: input.authorization.reason,
        totalModules: STATUS_MODULE_BINDINGS.length,
        unauthorizedMessage: "Support status is Super Admin only. No status mutation runs during page load.",
        visibleRecordCount: 0
      },
      supportStatusRuntimeGroups: [],
      supportStatusRuntimeItems: []
    };
  }

  if (input.loadError) {
    return {
      supportStatusRuntime: {
        emptyMessage: null,
        emptyModules: 0,
        errorModules: STATUS_MODULE_BINDINGS.length,
        groupCount: 0,
        hiddenRecordCount,
        loadError: input.loadError,
        loadingState: "error",
        needsReviewModules: 0,
        readOnly: true,
        readyModules: 0,
        registrySource: SUPPORT_REGISTRY_SOURCE,
        restrictedMessage: null,
        restrictedModules: 0,
        restrictedRecordCount,
        source: SUPPORT_STATUS_RUNTIME_SOURCE,
        status: "load_error",
        summary: `status load_error; ${input.loadError}`,
        totalModules: STATUS_MODULE_BINDINGS.length,
        unauthorizedMessage: null,
        visibleRecordCount: 0
      },
      supportStatusRuntimeGroups: [],
      supportStatusRuntimeItems: []
    };
  }

  const supportStatusRuntimeItems = STATUS_MODULE_BINDINGS.map((binding) => buildStatusModuleItem(binding, input));
  const supportStatusRuntimeGroups = buildSupportStatusRuntimeGroups(supportStatusRuntimeItems);
  const readyModules = countModulesByStatus(supportStatusRuntimeItems, "ready");
  const needsReviewModules = countModulesByStatus(supportStatusRuntimeItems, "needs_review");
  const restrictedModules = countModulesByStatus(supportStatusRuntimeItems, "restricted");
  const emptyModules = countModulesByStatus(supportStatusRuntimeItems, "empty");
  const errorModules = countModulesByStatus(supportStatusRuntimeItems, "error");
  const visibleRecordCount = supportStatusRuntimeItems.reduce(
    (total, item) => total + (item.recordCount ?? 0),
    0
  );
  const hasOperationalData = readyModules > 0 || needsReviewModules > 0;
  const loadingState: SupportStatusLoadingState =
    restrictedRecordCount > 0 || restrictedModules > 0
      ? "restricted"
      : !hasOperationalData && emptyModules === supportStatusRuntimeItems.length
        ? "empty"
        : "computed";
  const status =
    needsReviewModules > 0 || restrictedModules > 0 || errorModules > 0 || restrictedRecordCount > 0
      ? ("needs_attention" as const)
      : !hasOperationalData
        ? ("status_empty" as const)
        : ("status_runtime_ready" as const);

  return {
    supportStatusRuntime: {
      emptyMessage:
        status === "status_empty"
          ? "No Support runtime modules report ready operational status for the current scope."
          : null,
      emptyModules,
      errorModules,
      groupCount: supportStatusRuntimeGroups.length,
      hiddenRecordCount,
      loadError: null,
      loadingState,
      needsReviewModules,
      readOnly: true,
      readyModules,
      registrySource: SUPPORT_REGISTRY_SOURCE,
      restrictedMessage:
        restrictedRecordCount > 0
          ? `${restrictedRecordCount} record(s) excluded from Support status under SP-14 visibility rules.`
          : null,
      restrictedModules,
      restrictedRecordCount,
      source: SUPPORT_STATUS_RUNTIME_SOURCE,
      status,
      summary: [
        `status ${status}`,
        `${supportStatusRuntimeItems.length} modules tracked`,
        `${readyModules} ready`,
        `${needsReviewModules} needs review`,
        `${restrictedModules} restricted`,
        `${emptyModules} empty`,
        `${errorModules} error`,
        registryEntry?.productionReady ? "registry production_ready" : "registry pending"
      ].join("; "),
      totalModules: supportStatusRuntimeItems.length,
      unauthorizedMessage: null,
      visibleRecordCount
    },
    supportStatusRuntimeGroups,
    supportStatusRuntimeItems
  };
}

export function mapSupportStatusRuntimeToAdminFields(
  input: ReturnType<typeof buildSupportStatusRuntimeReadOnlySafe>
) {
  return input;
}

export function toSupportStatusRuntimeSnapshot(input: {
  loadError?: string | null;
  loadingState?: string | null;
  recordCount?: number | null;
  status: string;
  summary: string;
  unauthorized?: boolean;
}): SupportStatusRuntimeSnapshot {
  return {
    loadError: input.loadError ?? null,
    loadingState: input.loadingState ?? null,
    recordCount: input.recordCount ?? null,
    status: input.status,
    summary: input.summary,
    unauthorized: input.unauthorized ?? false
  };
}
