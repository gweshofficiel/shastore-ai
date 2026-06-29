import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportMonitoringEventsRuntimeSource = "support_monitoring_events_runtime";

export type SupportMonitoringEventsGroupKey = "platform-monitoring-events";

export type SupportMonitoringEventSeverity = "critical" | "info" | "low" | "warning";

export type SupportMonitoringEventsLoadingState = "error" | "loaded" | "unauthorized";

export type SupportMonitoringEventSafeControlKey = "acknowledge" | "export" | "inspect" | "resolve";

export type SupportMonitoringEventSafeControl = {
  enabled: false;
  key: SupportMonitoringEventSafeControlKey;
  label: string;
  note: string;
};

export type SupportMonitoringEventRuntimeItem = {
  createdAt: string;
  entityType: string;
  eventId: string;
  eventKey: string;
  eventStatus: string;
  eventType: string;
  groupKey: SupportMonitoringEventsGroupKey;
  lastUpdatedAt: string;
  relatedStoreId: string | null;
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  relatedTicketState: "available" | "not_linked";
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  registryKey: "sp-monitoring-events";
  safeSummary: string;
  severity: SupportMonitoringEventSeverity;
  source: string;
  status: string;
  tableDetected: boolean;
};

export type SupportMonitoringEventsRuntimeGroup = {
  groupKey: SupportMonitoringEventsGroupKey;
  itemCount: number;
  items: SupportMonitoringEventRuntimeItem[];
  title: string;
};

export type SupportMonitoringEventsRuntimeSummary = {
  criticalEvents: number;
  failedEvents: number;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportMonitoringEventsLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  source: SupportMonitoringEventsRuntimeSource;
  status: "load_error" | "monitoring_events_runtime_ready" | "needs_attention" | "unauthorized";
  summary: string;
  tableDetected: boolean;
  totalEvents: number;
  warningEvents: number;
};

export type SupportMonitoringEventsAuthorization = {
  canViewEvents: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

type RelatedTicketLookup = {
  ticketId: string;
  ticketNumber: string;
};

export const SUPPORT_MONITORING_EVENTS_RUNTIME_SOURCE = "support_monitoring_events_runtime" as const;

export const SUPPORT_MONITORING_EVENT_SAFE_CONTROLS: readonly SupportMonitoringEventSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No monitoring inspect action runs during SP-8 page load."
  },
  {
    enabled: false,
    key: "acknowledge",
    label: "Acknowledge",
    note: "Read-only placeholder. No monitoring acknowledge action runs during SP-8 page load."
  },
  {
    enabled: false,
    key: "resolve",
    label: "Resolve",
    note: "Read-only placeholder. No monitoring resolve action runs during SP-8 page load."
  },
  {
    enabled: false,
    key: "export",
    label: "Export",
    note: "Read-only placeholder. No monitoring export action runs during SP-8 page load."
  }
] as const;

const MONITORING_EVENT_COLUMNS =
  "id, workspace_id, store_id, user_id, event_type, event_status, entity_type, created_at";

const MONITORING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportMonitoringEventsGroupKey;
  registryKey: string;
  title: string;
}> = [
  {
    groupKey: "platform-monitoring-events",
    registryKey: "sp-monitoring-events",
    title: "Platform Monitoring Events"
  }
] as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSafeControls() {
  return SUPPORT_MONITORING_EVENT_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function deriveSeverity(eventType: string, eventStatus: string): SupportMonitoringEventSeverity {
  const normalizedType = eventType.toLowerCase();
  const normalizedStatus = eventStatus.toLowerCase();

  if (
    normalizedStatus === "failed" ||
    normalizedType.includes("error") ||
    normalizedType.includes("failed")
  ) {
    return "critical";
  }

  if (normalizedStatus === "warning" || normalizedType.includes("warning")) {
    return "warning";
  }

  if (normalizedStatus === "pending") {
    return "low";
  }

  return "info";
}

function deriveSource(eventType: string, entityType: string) {
  const normalizedType = eventType.toLowerCase();
  const normalizedEntity = entityType.toLowerCase();

  if (normalizedEntity.includes("support_ticket") || normalizedType.includes("support_ticket")) {
    return "Support Platform";
  }

  if (normalizedEntity.includes("store") || normalizedType.includes("store")) {
    return "Store Operations";
  }

  if (normalizedEntity.includes("security") || normalizedType.includes("security")) {
    return "Security Monitoring";
  }

  if (normalizedEntity.includes("operations") || normalizedType.includes("operations")) {
    return "Operations Signals";
  }

  return "Platform Monitoring";
}

function buildMonitoringEventRuntimeItem(
  row: AnyRecord,
  input: {
    relatedTicket: RelatedTicketLookup | null;
    tableDetected: boolean;
  }
): SupportMonitoringEventRuntimeItem {
  const eventId = text(row.id);
  const eventType = text(row.event_type) || "unknown";
  const eventStatus = text(row.event_status) || "recorded";
  const entityType = text(row.entity_type) || "unknown";
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at);
  const severity = deriveSeverity(eventType, eventStatus);
  const source = deriveSource(eventType, entityType);

  return {
    createdAt,
    entityType,
    eventId,
    eventKey: `support-monitoring-event-${eventId}`,
    eventStatus,
    eventType,
    groupKey: "platform-monitoring-events",
    lastUpdatedAt: createdAt,
    relatedStoreId: storeId,
    relatedTicketId: input.relatedTicket?.ticketId ?? null,
    relatedTicketNumber: input.relatedTicket?.ticketNumber ?? null,
    relatedTicketState: input.relatedTicket ? "available" : "not_linked",
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    registryKey: "sp-monitoring-events",
    safeSummary: [
      `event ${eventType}`,
      `severity ${severity}`,
      `source ${source}`,
      `status ${eventStatus}`,
      `entity ${entityType}`,
      input.relatedTicket ? `ticket ${input.relatedTicket.ticketNumber}` : "ticket n/a",
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a"
    ].join("; "),
    severity,
    source,
    status: eventStatus,
    tableDetected: input.tableDetected
  };
}

export function resolveSupportMonitoringEventsAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportMonitoringEventsAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewEvents: true,
      reason: "Super Admin may view platform monitoring events through read-only runtime queries.",
      roleLabel: "super_admin"
    };
  }

  if (
    input.internalRole === "support_agent" ||
    input.internalRole === "admin" ||
    input.internalRole === "super_admin"
  ) {
    return {
      canViewEvents: true,
      reason: "Authorized internal support role may view monitoring events read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canViewEvents: false,
    reason: "Current internal team role is not authorized for Support monitoring events.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportMonitoringEventsRuntimeGroups(
  items: SupportMonitoringEventRuntimeItem[]
): SupportMonitoringEventsRuntimeGroup[] {
  return MONITORING_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0 || group.groupKey === "platform-monitoring-events");
}

export function getSupportMonitoringEventsRuntimeSummary(
  items: SupportMonitoringEventRuntimeItem[],
  input: {
    authorization: SupportMonitoringEventsAuthorization;
    loadError: string | null;
    loadingState: SupportMonitoringEventsLoadingState;
    tableDetected: boolean;
  }
): SupportMonitoringEventsRuntimeSummary {
  const failedEvents = items.filter((item) => item.severity === "critical").length;
  const warningEvents = items.filter((item) => item.severity === "warning").length;
  const criticalEvents = failedEvents;
  const status = input.loadError
    ? ("load_error" as const)
    : !input.authorization.canViewEvents
      ? ("unauthorized" as const)
      : !input.tableDetected
        ? ("needs_attention" as const)
        : ("monitoring_events_runtime_ready" as const);

  return {
    criticalEvents,
    failedEvents,
    groupCount: buildSupportMonitoringEventsRuntimeGroups(items).length,
    loadError: input.loadError,
    loadingState: input.loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    source: SUPPORT_MONITORING_EVENTS_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : !input.authorization.canViewEvents
        ? `status unauthorized; ${input.authorization.reason}`
        : [
            `status ${status}`,
            `${items.length} events`,
            `${failedEvents} critical`,
            `${warningEvents} warning`,
            input.tableDetected ? "monitoring_events table detected" : "monitoring_events table not detected"
          ].join("; "),
    tableDetected: input.tableDetected,
    totalEvents: items.length,
    warningEvents
  };
}

export function supportMonitoringEventSeverityBadgeTone(severity: SupportMonitoringEventSeverity) {
  switch (severity) {
    case "critical":
      return "red" as const;
    case "warning":
      return "amber" as const;
    case "low":
      return "blue" as const;
    case "info":
      return "green" as const;
  }
}

export function supportMonitoringEventSeverityLabel(severity: SupportMonitoringEventSeverity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "low":
      return "Low";
    case "info":
      return "Info";
  }
}

async function loadRelatedTicketsByEventIds(
  supabase: SupabaseClient<Database>,
  eventIds: string[]
) {
  if (!eventIds.length) {
    return new Map<string, RelatedTicketLookup>();
  }

  const { data, error } = await supabase
    .from("support_tickets" as never)
    .select("id, event_id, ticket_number")
    .in("event_id", eventIds)
    .limit(200);

  if (error || !Array.isArray(data)) {
    return new Map<string, RelatedTicketLookup>();
  }

  const lookup = new Map<string, RelatedTicketLookup>();

  for (const row of data as AnyRecord[]) {
    const eventId = text(row.event_id);

    if (!eventId) {
      continue;
    }

    lookup.set(eventId, {
      ticketId: text(row.id),
      ticketNumber: text(row.ticket_number) || text(row.id)
    });
  }

  return lookup;
}

export async function loadSupportMonitoringEventsRuntimeReadOnlySafe(params: {
  authorization: SupportMonitoringEventsAuthorization;
  loadError?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  if (!params.authorization.canViewEvents) {
    return {
      groups: buildSupportMonitoringEventsRuntimeGroups([]),
      monitoringEvents: [] as SupportMonitoringEventRuntimeItem[],
      monitoringEventsRuntime: getSupportMonitoringEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: null,
        loadingState: "unauthorized",
        tableDetected: false
      }),
      safeControls: buildSafeControls()
    };
  }

  if (!params.supabase || params.loadError) {
    return {
      groups: buildSupportMonitoringEventsRuntimeGroups([]),
      monitoringEvents: [] as SupportMonitoringEventRuntimeItem[],
      monitoringEventsRuntime: getSupportMonitoringEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: params.loadError ?? "Admin client unavailable",
        loadingState: "error",
        tableDetected: false
      }),
      safeControls: buildSafeControls()
    };
  }

  const eventsLoad = await params.supabase
    .from("monitoring_events" as never)
    .select(MONITORING_EVENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const tableDetected = !eventsLoad.error;
  const rows = Array.isArray(eventsLoad.data) ? (eventsLoad.data as AnyRecord[]) : [];

  if (eventsLoad.error) {
    return {
      groups: buildSupportMonitoringEventsRuntimeGroups([]),
      monitoringEvents: [],
      monitoringEventsRuntime: getSupportMonitoringEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: eventsLoad.error.message,
        loadingState: "error",
        tableDetected: false
      }),
      safeControls: buildSafeControls()
    };
  }

  const eventIds = rows.map((row) => text(row.id)).filter(Boolean);
  const relatedTickets = await loadRelatedTicketsByEventIds(params.supabase, eventIds);
  const monitoringEvents = rows
    .map((row) =>
      buildMonitoringEventRuntimeItem(row, {
        relatedTicket: relatedTickets.get(text(row.id)) ?? null,
        tableDetected
      })
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const groups = buildSupportMonitoringEventsRuntimeGroups(monitoringEvents);

  return {
    groups,
    monitoringEvents,
    monitoringEventsRuntime: getSupportMonitoringEventsRuntimeSummary(monitoringEvents, {
      authorization: params.authorization,
      loadError: null,
      loadingState: "loaded",
      tableDetected
    }),
    safeControls: buildSafeControls()
  };
}

export function mapSupportMonitoringEventsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportMonitoringEventsRuntimeReadOnlySafe>>
) {
  return {
    monitoringEvents: input.monitoringEvents,
    monitoringEventsRuntime: input.monitoringEventsRuntime,
    monitoringEventsRuntimeGroups: input.groups,
    monitoringEventsSafeControls: input.safeControls
  };
}

export function mapSupportMonitoringRuntimeItemsToLegacyMonitoringEvents(
  items: SupportMonitoringEventRuntimeItem[]
) {
  return items.map((item) => ({
    created_at: item.createdAt,
    entity_type: item.entityType,
    event_status: item.eventStatus,
    event_type: item.eventType,
    id: item.eventId,
    store_id: item.relatedStoreId,
    user_id: item.relatedUserId,
    workspace_id: item.relatedWorkspaceId
  }));
}

export function mapSupportMonitoringRuntimeItemsToDashboardMonitoringEvents(
  items: SupportMonitoringEventRuntimeItem[]
) {
  return items.map((item) => ({
    created_at: item.createdAt,
    entity_type: item.entityType,
    event_status: item.eventStatus,
    event_type: item.eventType,
    id: item.eventId,
    store_id: item.relatedStoreId,
    user_id: item.relatedUserId,
    workspace_id: item.relatedWorkspaceId
  }));
}
