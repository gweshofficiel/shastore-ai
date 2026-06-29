import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportErrorEventsRuntimeSource = "support_error_events_runtime";

export type SupportErrorEventsGroupKey = "platform-error-events";

export type SupportErrorEventSeverity = "critical" | "info" | "low" | "warning";

export type SupportErrorEventsLoadingState = "error" | "loaded" | "unauthorized";

export type SupportErrorEventSafeControlKey = "acknowledge" | "export" | "inspect" | "resolve";

export type SupportErrorEventSafeControl = {
  enabled: false;
  key: SupportErrorEventSafeControlKey;
  label: string;
  note: string;
};

export type SupportErrorEventRuntimeItem = {
  createdAt: string;
  entityType: string;
  errorId: string;
  errorKey: string;
  errorMessageSummary: string;
  errorStatus: string;
  errorType: string;
  groupKey: SupportErrorEventsGroupKey;
  lastUpdatedAt: string;
  relatedStoreId: string | null;
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  relatedTicketState: "available" | "not_linked";
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  registryKey: "sp-error-events";
  safeSummary: string;
  severity: SupportErrorEventSeverity;
  source: string;
  status: string;
  tableDetected: boolean;
};

export type SupportErrorEventsRuntimeGroup = {
  groupKey: SupportErrorEventsGroupKey;
  itemCount: number;
  items: SupportErrorEventRuntimeItem[];
  title: string;
};

export type SupportErrorEventsRuntimeSummary = {
  criticalEvents: number;
  failedEvents: number;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportErrorEventsLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  source: SupportErrorEventsRuntimeSource;
  status: "error_events_runtime_ready" | "load_error" | "needs_attention" | "unauthorized";
  summary: string;
  tableDetected: boolean;
  totalEvents: number;
  warningEvents: number;
};

export type SupportErrorEventsAuthorization = {
  canViewEvents: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

type RelatedTicketLookup = {
  ticketId: string;
  ticketNumber: string;
};

export const SUPPORT_ERROR_EVENTS_RUNTIME_SOURCE = "support_error_events_runtime" as const;

export const SUPPORT_ERROR_EVENT_SAFE_CONTROLS: readonly SupportErrorEventSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No error inspect action runs during SP-9 page load."
  },
  {
    enabled: false,
    key: "acknowledge",
    label: "Acknowledge",
    note: "Read-only placeholder. No error acknowledge action runs during SP-9 page load."
  },
  {
    enabled: false,
    key: "resolve",
    label: "Resolve",
    note: "Read-only placeholder. No error resolve action runs during SP-9 page load."
  },
  {
    enabled: false,
    key: "export",
    label: "Export",
    note: "Read-only placeholder. No error export action runs during SP-9 page load."
  }
] as const;

const ERROR_EVENT_COLUMNS =
  "id, workspace_id, store_id, user_id, event_type, event_status, entity_type, created_at";

const ERROR_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportErrorEventsGroupKey;
  registryKey: string;
  title: string;
}> = [
  {
    groupKey: "platform-error-events",
    registryKey: "sp-error-events",
    title: "Platform Error Events"
  }
] as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSafeControls() {
  return SUPPORT_ERROR_EVENT_SAFE_CONTROLS.map((control) => ({ ...control }));
}

export function isSupportErrorMonitoringEvent(eventType: string, eventStatus: string) {
  const normalizedType = eventType.toLowerCase();
  const normalizedStatus = eventStatus.toLowerCase();

  return (
    normalizedStatus === "failed" ||
    normalizedType.includes("error") ||
    normalizedType.includes("failed")
  );
}

function deriveSeverity(eventType: string, eventStatus: string): SupportErrorEventSeverity {
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

function humanizeToken(value: string) {
  return value.replace(/[_-]+/g, " ").trim() || "unknown";
}

function buildErrorMessageSummary(eventType: string, eventStatus: string, entityType: string) {
  const typeLabel = humanizeToken(eventType);
  const entityLabel = humanizeToken(entityType);
  const statusLabel = humanizeToken(eventStatus);

  return `${typeLabel} reported as ${statusLabel} in ${entityLabel} scope`;
}

function buildErrorEventRuntimeItem(
  row: AnyRecord,
  input: {
    relatedTicket: RelatedTicketLookup | null;
    tableDetected: boolean;
  }
): SupportErrorEventRuntimeItem {
  const errorId = text(row.id);
  const errorType = text(row.event_type) || "unknown";
  const errorStatus = text(row.event_status) || "recorded";
  const entityType = text(row.entity_type) || "unknown";
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at);
  const severity = deriveSeverity(errorType, errorStatus);
  const source = deriveSource(errorType, entityType);
  const errorMessageSummary = buildErrorMessageSummary(errorType, errorStatus, entityType);

  return {
    createdAt,
    entityType,
    errorId,
    errorKey: `support-error-event-${errorId}`,
    errorMessageSummary,
    errorStatus,
    errorType,
    groupKey: "platform-error-events",
    lastUpdatedAt: createdAt,
    relatedStoreId: storeId,
    relatedTicketId: input.relatedTicket?.ticketId ?? null,
    relatedTicketNumber: input.relatedTicket?.ticketNumber ?? null,
    relatedTicketState: input.relatedTicket ? "available" : "not_linked",
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    registryKey: "sp-error-events",
    safeSummary: [
      `error ${errorType}`,
      `severity ${severity}`,
      `source ${source}`,
      `status ${errorStatus}`,
      `entity ${entityType}`,
      `summary ${errorMessageSummary}`,
      input.relatedTicket ? `ticket ${input.relatedTicket.ticketNumber}` : "ticket n/a",
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a"
    ].join("; "),
    severity,
    source,
    status: errorStatus,
    tableDetected: input.tableDetected
  };
}

export function resolveSupportErrorEventsAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportErrorEventsAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewEvents: true,
      reason: "Super Admin may view platform error events through read-only runtime queries.",
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
      reason: "Authorized internal support role may view error events read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canViewEvents: false,
    reason: "Current internal team role is not authorized for Support error events.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportErrorEventsRuntimeGroups(
  items: SupportErrorEventRuntimeItem[]
): SupportErrorEventsRuntimeGroup[] {
  return ERROR_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0 || group.groupKey === "platform-error-events");
}

export function getSupportErrorEventsRuntimeSummary(
  items: SupportErrorEventRuntimeItem[],
  input: {
    authorization: SupportErrorEventsAuthorization;
    loadError: string | null;
    loadingState: SupportErrorEventsLoadingState;
    tableDetected: boolean;
  }
): SupportErrorEventsRuntimeSummary {
  const failedEvents = items.filter((item) => item.severity === "critical").length;
  const warningEvents = items.filter((item) => item.severity === "warning").length;
  const criticalEvents = failedEvents;
  const status = input.loadError
    ? ("load_error" as const)
    : !input.authorization.canViewEvents
      ? ("unauthorized" as const)
      : !input.tableDetected
        ? ("needs_attention" as const)
        : ("error_events_runtime_ready" as const);

  return {
    criticalEvents,
    failedEvents,
    groupCount: buildSupportErrorEventsRuntimeGroups(items).length,
    loadError: input.loadError,
    loadingState: input.loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    source: SUPPORT_ERROR_EVENTS_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : !input.authorization.canViewEvents
        ? `status unauthorized; ${input.authorization.reason}`
        : [
            `status ${status}`,
            `${items.length} errors`,
            `${failedEvents} critical`,
            `${warningEvents} warning`,
            input.tableDetected ? "monitoring_events table detected" : "monitoring_events table not detected"
          ].join("; "),
    tableDetected: input.tableDetected,
    totalEvents: items.length,
    warningEvents
  };
}

export function supportErrorEventSeverityBadgeTone(severity: SupportErrorEventSeverity) {
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

export function supportErrorEventSeverityLabel(severity: SupportErrorEventSeverity) {
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

export async function loadSupportErrorEventsRuntimeReadOnlySafe(params: {
  authorization: SupportErrorEventsAuthorization;
  loadError?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  if (!params.authorization.canViewEvents) {
    return {
      errorEvents: [] as SupportErrorEventRuntimeItem[],
      errorEventsRuntime: getSupportErrorEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: null,
        loadingState: "unauthorized",
        tableDetected: false
      }),
      groups: buildSupportErrorEventsRuntimeGroups([]),
      safeControls: buildSafeControls()
    };
  }

  if (!params.supabase || params.loadError) {
    return {
      errorEvents: [] as SupportErrorEventRuntimeItem[],
      errorEventsRuntime: getSupportErrorEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: params.loadError ?? "Admin client unavailable",
        loadingState: "error",
        tableDetected: false
      }),
      groups: buildSupportErrorEventsRuntimeGroups([]),
      safeControls: buildSafeControls()
    };
  }

  const eventsLoad = await params.supabase
    .from("monitoring_events" as never)
    .select(ERROR_EVENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const tableDetected = !eventsLoad.error;
  const rows = Array.isArray(eventsLoad.data) ? (eventsLoad.data as AnyRecord[]) : [];

  if (eventsLoad.error) {
    return {
      errorEvents: [],
      errorEventsRuntime: getSupportErrorEventsRuntimeSummary([], {
        authorization: params.authorization,
        loadError: eventsLoad.error.message,
        loadingState: "error",
        tableDetected: false
      }),
      groups: buildSupportErrorEventsRuntimeGroups([]),
      safeControls: buildSafeControls()
    };
  }

  const errorRows = rows.filter((row) =>
    isSupportErrorMonitoringEvent(text(row.event_type) || "unknown", text(row.event_status) || "recorded")
  );
  const eventIds = errorRows.map((row) => text(row.id)).filter(Boolean);
  const relatedTickets = await loadRelatedTicketsByEventIds(params.supabase, eventIds);
  const errorEvents = errorRows
    .map((row) =>
      buildErrorEventRuntimeItem(row, {
        relatedTicket: relatedTickets.get(text(row.id)) ?? null,
        tableDetected
      })
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const groups = buildSupportErrorEventsRuntimeGroups(errorEvents);

  return {
    errorEvents,
    errorEventsRuntime: getSupportErrorEventsRuntimeSummary(errorEvents, {
      authorization: params.authorization,
      loadError: null,
      loadingState: "loaded",
      tableDetected
    }),
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapSupportErrorEventsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportErrorEventsRuntimeReadOnlySafe>>
) {
  return {
    errorEventsRuntime: input.errorEventsRuntime,
    errorEventsRuntimeGroups: input.groups,
    errorEventsRuntimeItems: input.errorEvents,
    errorEventsSafeControls: input.safeControls
  };
}

export function mapSupportErrorRuntimeItemsToDashboardErrorEvents(
  items: SupportErrorEventRuntimeItem[]
) {
  return items.map((item) => ({
    created_at: item.createdAt,
    entity_type: item.entityType,
    event_status: item.errorStatus,
    event_type: item.errorType,
    id: item.errorId,
    store_id: item.relatedStoreId,
    user_id: item.relatedUserId,
    workspace_id: item.relatedWorkspaceId
  }));
}
