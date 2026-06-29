import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isSupportErrorMonitoringEvent } from "@/src/lib/support/support-error-events-runtime";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportEventTimelineRuntimeSource = "support_event_timeline_runtime";

export type SupportEventTimelineGroupKey = "platform-event-timeline";

export type SupportEventTimelineEventType =
  | "assignment_change"
  | "conversation_activity"
  | "error_event"
  | "monitoring_event"
  | "status_change"
  | "ticket_event";

export type SupportEventTimelineSeverity = "critical" | "info" | "low" | "warning";

export type SupportEventTimelineLoadingState = "error" | "loaded" | "unauthorized";

export type SupportEventTimelineSafeControlKey = "export" | "inspect";

export type SupportEventTimelineSafeControl = {
  enabled: false;
  key: SupportEventTimelineSafeControlKey;
  label: string;
  note: string;
};

export type SupportEventTimelineItem = {
  actorLabel: string | null;
  createdAt: string;
  eventType: SupportEventTimelineEventType;
  eventTypeLabel: string;
  groupKey: SupportEventTimelineGroupKey;
  registryKey: "sp-event-timeline";
  relatedStoreId: string | null;
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  relatedTicketState: "available" | "not_linked";
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  safeSummary: string;
  severity: SupportEventTimelineSeverity | null;
  source: string;
  status: string | null;
  timelineItemId: string;
  timelineItemKey: string;
};

export type SupportEventTimelineRuntimeGroup = {
  groupKey: SupportEventTimelineGroupKey;
  itemCount: number;
  items: SupportEventTimelineItem[];
  title: string;
};

export type SupportEventTimelineRuntimeSummary = {
  assignmentChangeCount: number;
  conversationActivityCount: number;
  errorEventCount: number;
  groupCount: number;
  loadError: string | null;
  loadingState: SupportEventTimelineLoadingState;
  monitoringEventCount: number;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  source: SupportEventTimelineRuntimeSource;
  status: "event_timeline_runtime_ready" | "load_error" | "needs_attention" | "unauthorized";
  statusChangeCount: number;
  summary: string;
  tablesDetected: {
    monitoringEvents: boolean;
    supportTicketMessages: boolean;
    supportTickets: boolean;
  };
  ticketEventCount: number;
  totalItems: number;
};

export type SupportEventTimelineAuthorization = {
  canViewTimeline: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

type TicketLookup = {
  ticketId: string;
  ticketNumber: string;
};

export const SUPPORT_EVENT_TIMELINE_RUNTIME_SOURCE = "support_event_timeline_runtime" as const;

export const SUPPORT_EVENT_TIMELINE_SAFE_CONTROLS: readonly SupportEventTimelineSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No timeline inspect action runs during SP-10 page load."
  },
  {
    enabled: false,
    key: "export",
    label: "Export",
    note: "Read-only placeholder. No timeline export action runs during SP-10 page load."
  }
] as const;

const MONITORING_COLUMNS =
  "id, workspace_id, store_id, user_id, entity_id, entity_type, event_type, event_status, created_at";

const TICKET_COLUMNS =
  "id, workspace_id, store_id, user_id, ticket_number, status, subject, created_at";

const MESSAGE_COLUMNS =
  "id, ticket_id, workspace_id, store_id, author_user_id, author_role, author_label, visibility, created_at";

const TIMELINE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportEventTimelineGroupKey;
  title: string;
}> = [
  {
    groupKey: "platform-event-timeline",
    title: "Platform Event Timeline"
  }
] as const;

const STATUS_CHANGE_EVENT_TYPES = new Set(["support_ticket_status_changed"]);
const ASSIGNMENT_CHANGE_EVENT_TYPES = new Set(["support_ticket_assigned", "support_ticket_unassigned"]);
const CONVERSATION_AUDIT_EVENT_TYPES = new Set(["support_ticket_message_created"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSafeControls() {
  return SUPPORT_EVENT_TIMELINE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function deriveMonitoringSeverity(eventType: string, eventStatus: string): SupportEventTimelineSeverity {
  if (isSupportErrorMonitoringEvent(eventType, eventStatus)) {
    return "critical";
  }

  const normalizedStatus = eventStatus.toLowerCase();
  const normalizedType = eventType.toLowerCase();

  if (normalizedStatus === "warning" || normalizedType.includes("warning")) {
    return "warning";
  }

  if (normalizedStatus === "pending") {
    return "low";
  }

  return "info";
}

function deriveMonitoringSource(eventType: string, entityType: string) {
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

function classifyMonitoringTimelineEventType(
  eventType: string,
  eventStatus: string
): SupportEventTimelineEventType {
  if (STATUS_CHANGE_EVENT_TYPES.has(eventType)) {
    return "status_change";
  }

  if (ASSIGNMENT_CHANGE_EVENT_TYPES.has(eventType)) {
    return "assignment_change";
  }

  if (CONVERSATION_AUDIT_EVENT_TYPES.has(eventType)) {
    return "conversation_activity";
  }

  if (isSupportErrorMonitoringEvent(eventType, eventStatus)) {
    return "error_event";
  }

  return "monitoring_event";
}

export function supportEventTimelineEventTypeLabel(eventType: SupportEventTimelineEventType) {
  switch (eventType) {
    case "ticket_event":
      return "Ticket event";
    case "monitoring_event":
      return "Monitoring event";
    case "error_event":
      return "Error event";
    case "status_change":
      return "Status change";
    case "assignment_change":
      return "Assignment change";
    case "conversation_activity":
      return "Conversation activity";
  }
}

function buildActorLabelFromUserId(userId: string | null) {
  return userId ? `User ${userId}` : null;
}

function resolveRelatedTicket(
  input: {
    entityId: string | null;
    entityType: string;
    ticketLookup: Map<string, TicketLookup>;
  }
) {
  if (input.entityType.toLowerCase() === "support_ticket" && input.entityId) {
    const ticket = input.ticketLookup.get(input.entityId);

    if (ticket) {
      return {
        relatedTicketId: ticket.ticketId,
        relatedTicketNumber: ticket.ticketNumber,
        relatedTicketState: "available" as const
      };
    }

    return {
      relatedTicketId: input.entityId,
      relatedTicketNumber: input.entityId,
      relatedTicketState: "available" as const
    };
  }

  return {
    relatedTicketId: null,
    relatedTicketNumber: null,
    relatedTicketState: "not_linked" as const
  };
}

function buildTicketTimelineItem(
  row: AnyRecord,
  input: { tableDetected: boolean }
): SupportEventTimelineItem {
  const ticketId = text(row.id);
  const ticketNumber = text(row.ticket_number) || ticketId;
  const status = text(row.status) || "open";
  const subject = text(row.subject) || `Ticket ${ticketNumber}`;
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at);

  return {
    actorLabel: buildActorLabelFromUserId(userId),
    createdAt,
    eventType: "ticket_event",
    eventTypeLabel: supportEventTimelineEventTypeLabel("ticket_event"),
    groupKey: "platform-event-timeline",
    registryKey: "sp-event-timeline",
    relatedStoreId: storeId,
    relatedTicketId: ticketId,
    relatedTicketNumber: ticketNumber,
    relatedTicketState: "available",
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    safeSummary: [
      "ticket created",
      `ticket ${ticketNumber}`,
      `status ${status}`,
      `subject ${subject}`,
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a"
    ].join("; "),
    severity: "info",
    source: "Support Platform",
    status,
    timelineItemId: ticketId,
    timelineItemKey: `timeline-ticket-${ticketId}`
  };
}

function buildMonitoringTimelineItem(
  row: AnyRecord,
  input: {
    tableDetected: boolean;
    ticketLookup: Map<string, TicketLookup>;
  }
): SupportEventTimelineItem | null {
  const eventTypeRaw = text(row.event_type) || "unknown";
  const eventStatus = text(row.event_status) || "recorded";
  const entityType = text(row.entity_type) || "unknown";
  const entityId = row.entity_id ? text(row.entity_id) : null;
  const eventId = text(row.id);
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at);
  const timelineEventType = classifyMonitoringTimelineEventType(eventTypeRaw, eventStatus);

  if (CONVERSATION_AUDIT_EVENT_TYPES.has(eventTypeRaw)) {
    return null;
  }

  const relatedTicket = resolveRelatedTicket({
    entityId,
    entityType,
    ticketLookup: input.ticketLookup
  });
  const source = deriveMonitoringSource(eventTypeRaw, entityType);
  const severity =
    timelineEventType === "status_change" || timelineEventType === "assignment_change"
      ? "info"
      : deriveMonitoringSeverity(eventTypeRaw, eventStatus);

  return {
    actorLabel: buildActorLabelFromUserId(userId),
    createdAt,
    eventType: timelineEventType,
    eventTypeLabel: supportEventTimelineEventTypeLabel(timelineEventType),
    groupKey: "platform-event-timeline",
    registryKey: "sp-event-timeline",
    relatedStoreId: storeId,
    relatedTicketId: relatedTicket.relatedTicketId,
    relatedTicketNumber: relatedTicket.relatedTicketNumber,
    relatedTicketState: relatedTicket.relatedTicketState,
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    safeSummary: [
      `event ${eventTypeRaw}`,
      `classification ${timelineEventType}`,
      `status ${eventStatus}`,
      `entity ${entityType}`,
      relatedTicket.relatedTicketNumber
        ? `ticket ${relatedTicket.relatedTicketNumber}`
        : "ticket n/a",
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a"
    ].join("; "),
    severity,
    source,
    status: eventStatus,
    timelineItemId: eventId,
    timelineItemKey: `timeline-monitoring-${eventId}`
  };
}

function buildConversationTimelineItem(
  row: AnyRecord,
  input: {
    tableDetected: boolean;
    ticketLookup: Map<string, TicketLookup>;
  }
): SupportEventTimelineItem {
  const messageId = text(row.id);
  const ticketId = text(row.ticket_id);
  const ticket = input.ticketLookup.get(ticketId);
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const authorUserId = row.author_user_id ? text(row.author_user_id) : null;
  const authorRole = text(row.author_role) || "unknown";
  const authorLabel = text(row.author_label) || buildActorLabelFromUserId(authorUserId) || "Support participant";
  const visibility = text(row.visibility) || "internal";
  const createdAt = text(row.created_at);

  return {
    actorLabel: authorLabel,
    createdAt,
    eventType: "conversation_activity",
    eventTypeLabel: supportEventTimelineEventTypeLabel("conversation_activity"),
    groupKey: "platform-event-timeline",
    registryKey: "sp-event-timeline",
    relatedStoreId: storeId,
    relatedTicketId: ticketId || null,
    relatedTicketNumber: ticket?.ticketNumber ?? ticketId ?? null,
    relatedTicketState: ticketId ? "available" : "not_linked",
    relatedUserId: authorUserId,
    relatedWorkspaceId: workspaceId,
    safeSummary: [
      "conversation message",
      `author ${authorLabel}`,
      `role ${authorRole}`,
      `visibility ${visibility}`,
      ticket ? `ticket ${ticket.ticketNumber}` : "ticket n/a"
    ].join("; "),
    severity: null,
    source: "Support Platform",
    status: visibility,
    timelineItemId: messageId,
    timelineItemKey: `timeline-conversation-${messageId}`
  };
}

function buildOpeningConversationTimelineItem(
  row: AnyRecord,
  input: {
    tableDetected: boolean;
    ticketLookup: Map<string, TicketLookup>;
  }
): SupportEventTimelineItem | null {
  const message = text(row.message);

  if (!message) {
    return null;
  }

  const ticketId = text(row.id);
  const ticket = input.ticketLookup.get(ticketId);
  const ticketNumber = ticket?.ticketNumber ?? text(row.ticket_number) ?? ticketId;
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at);

  return {
    actorLabel: userId ? `Reporter ${userId}` : "Ticket reporter",
    createdAt,
    eventType: "conversation_activity",
    eventTypeLabel: supportEventTimelineEventTypeLabel("conversation_activity"),
    groupKey: "platform-event-timeline",
    registryKey: "sp-event-timeline",
    relatedStoreId: storeId,
    relatedTicketId: ticketId,
    relatedTicketNumber: ticketNumber,
    relatedTicketState: "available",
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    safeSummary: [
      "conversation opening message",
      "source opening_message",
      "author customer",
      `ticket ${ticketNumber}`
    ].join("; "),
    severity: null,
    source: "Support Platform",
    status: "customer",
    timelineItemId: `opening-${ticketId}`,
    timelineItemKey: `timeline-opening-${ticketId}`
  };
}

function buildTicketLookup(rows: AnyRecord[]) {
  const lookup = new Map<string, TicketLookup>();

  for (const row of rows) {
    const ticketId = text(row.id);

    if (!ticketId) {
      continue;
    }

    lookup.set(ticketId, {
      ticketId,
      ticketNumber: text(row.ticket_number) || ticketId
    });
  }

  return lookup;
}

export function resolveSupportEventTimelineAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportEventTimelineAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewTimeline: true,
      reason: "Super Admin may view the platform support event timeline through read-only runtime queries.",
      roleLabel: "super_admin"
    };
  }

  if (
    input.internalRole === "support_agent" ||
    input.internalRole === "admin" ||
    input.internalRole === "super_admin"
  ) {
    return {
      canViewTimeline: true,
      reason: "Authorized internal support role may view the event timeline read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canViewTimeline: false,
    reason: "Current internal team role is not authorized for Support event timeline.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportEventTimelineRuntimeGroups(
  items: SupportEventTimelineItem[]
): SupportEventTimelineRuntimeGroup[] {
  return TIMELINE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0 || group.groupKey === "platform-event-timeline");
}

export function getSupportEventTimelineRuntimeSummary(
  items: SupportEventTimelineItem[],
  input: {
    authorization: SupportEventTimelineAuthorization;
    loadError: string | null;
    loadingState: SupportEventTimelineLoadingState;
    tablesDetected: SupportEventTimelineRuntimeSummary["tablesDetected"];
  }
): SupportEventTimelineRuntimeSummary {
  const ticketEventCount = items.filter((item) => item.eventType === "ticket_event").length;
  const monitoringEventCount = items.filter((item) => item.eventType === "monitoring_event").length;
  const errorEventCount = items.filter((item) => item.eventType === "error_event").length;
  const statusChangeCount = items.filter((item) => item.eventType === "status_change").length;
  const assignmentChangeCount = items.filter((item) => item.eventType === "assignment_change").length;
  const conversationActivityCount = items.filter((item) => item.eventType === "conversation_activity").length;
  const allTablesDetected =
    input.tablesDetected.supportTickets &&
    input.tablesDetected.monitoringEvents &&
    input.tablesDetected.supportTicketMessages;
  const status = input.loadError
    ? ("load_error" as const)
    : !input.authorization.canViewTimeline
      ? ("unauthorized" as const)
      : !allTablesDetected
        ? ("needs_attention" as const)
        : ("event_timeline_runtime_ready" as const);

  return {
    assignmentChangeCount,
    conversationActivityCount,
    errorEventCount,
    groupCount: buildSupportEventTimelineRuntimeGroups(items).length,
    loadError: input.loadError,
    loadingState: input.loadingState,
    monitoringEventCount,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    source: SUPPORT_EVENT_TIMELINE_RUNTIME_SOURCE,
    status,
    statusChangeCount,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : !input.authorization.canViewTimeline
        ? `status unauthorized; ${input.authorization.reason}`
        : [
            `status ${status}`,
            `${items.length} timeline items`,
            `${ticketEventCount} ticket`,
            `${monitoringEventCount} monitoring`,
            `${errorEventCount} error`,
            `${statusChangeCount} status`,
            `${assignmentChangeCount} assignment`,
            `${conversationActivityCount} conversation`
          ].join("; "),
    tablesDetected: input.tablesDetected,
    ticketEventCount,
    totalItems: items.length
  };
}

export function supportEventTimelineSeverityBadgeTone(severity: SupportEventTimelineSeverity | null) {
  switch (severity) {
    case "critical":
      return "red" as const;
    case "warning":
      return "amber" as const;
    case "low":
      return "blue" as const;
    case "info":
      return "green" as const;
    default:
      return "slate" as const;
  }
}

export function supportEventTimelineSeverityLabel(severity: SupportEventTimelineSeverity | null) {
  if (!severity) {
    return "n/a";
  }

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

export async function loadSupportEventTimelineRuntimeReadOnlySafe(params: {
  authorization: SupportEventTimelineAuthorization;
  loadError?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  const emptyTables = {
    monitoringEvents: false,
    supportTicketMessages: false,
    supportTickets: false
  };

  if (!params.authorization.canViewTimeline) {
    return {
      eventTimelineRuntime: getSupportEventTimelineRuntimeSummary([], {
        authorization: params.authorization,
        loadError: null,
        loadingState: "unauthorized",
        tablesDetected: emptyTables
      }),
      eventTimelineRuntimeGroups: buildSupportEventTimelineRuntimeGroups([]),
      eventTimelineRuntimeItems: [] as SupportEventTimelineItem[],
      eventTimelineSafeControls: buildSafeControls()
    };
  }

  if (!params.supabase || params.loadError) {
    return {
      eventTimelineRuntime: getSupportEventTimelineRuntimeSummary([], {
        authorization: params.authorization,
        loadError: params.loadError ?? "Admin client unavailable",
        loadingState: "error",
        tablesDetected: emptyTables
      }),
      eventTimelineRuntimeGroups: buildSupportEventTimelineRuntimeGroups([]),
      eventTimelineRuntimeItems: [] as SupportEventTimelineItem[],
      eventTimelineSafeControls: buildSafeControls()
    };
  }

  const ticketsLoad = await params.supabase
    .from("support_tickets" as never)
    .select(`${TICKET_COLUMNS}, message`)
    .order("created_at", { ascending: false })
    .limit(200);

  const monitoringLoad = await params.supabase
    .from("monitoring_events" as never)
    .select(MONITORING_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const messagesLoad = await params.supabase
    .from("support_ticket_messages" as never)
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const tablesDetected = {
    monitoringEvents: !monitoringLoad.error,
    supportTicketMessages: !messagesLoad.error?.message?.includes("support_ticket_messages"),
    supportTickets: !ticketsLoad.error
  };

  const loadError =
    ticketsLoad.error?.message ??
    monitoringLoad.error?.message ??
    (messagesLoad.error && !tablesDetected.supportTicketMessages ? messagesLoad.error.message : null);

  if (loadError && !tablesDetected.supportTickets && !tablesDetected.monitoringEvents) {
    return {
      eventTimelineRuntime: getSupportEventTimelineRuntimeSummary([], {
        authorization: params.authorization,
        loadError,
        loadingState: "error",
        tablesDetected
      }),
      eventTimelineRuntimeGroups: buildSupportEventTimelineRuntimeGroups([]),
      eventTimelineRuntimeItems: [] as SupportEventTimelineItem[],
      eventTimelineSafeControls: buildSafeControls()
    };
  }

  const ticketRows = Array.isArray(ticketsLoad.data) ? (ticketsLoad.data as AnyRecord[]) : [];
  const monitoringRows = Array.isArray(monitoringLoad.data) ? (monitoringLoad.data as AnyRecord[]) : [];
  const messageRows = Array.isArray(messagesLoad.data) ? (messagesLoad.data as AnyRecord[]) : [];
  const ticketLookup = buildTicketLookup(ticketRows);

  const timelineItems: SupportEventTimelineItem[] = [
    ...ticketRows.map((row) => buildTicketTimelineItem(row, { tableDetected: tablesDetected.supportTickets })),
    ...monitoringRows
      .map((row) =>
        buildMonitoringTimelineItem(row, {
          tableDetected: tablesDetected.monitoringEvents,
          ticketLookup
        })
      )
      .filter((item): item is SupportEventTimelineItem => item !== null),
    ...messageRows.map((row) =>
      buildConversationTimelineItem(row, {
        tableDetected: tablesDetected.supportTicketMessages,
        ticketLookup
      })
    ),
    ...ticketRows
      .map((row) =>
        buildOpeningConversationTimelineItem(row, {
          tableDetected: tablesDetected.supportTickets,
          ticketLookup
        })
      )
      .filter((item): item is SupportEventTimelineItem => item !== null)
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 300);

  return {
    eventTimelineRuntime: getSupportEventTimelineRuntimeSummary(timelineItems, {
      authorization: params.authorization,
      loadError: null,
      loadingState: "loaded",
      tablesDetected
    }),
    eventTimelineRuntimeGroups: buildSupportEventTimelineRuntimeGroups(timelineItems),
    eventTimelineRuntimeItems: timelineItems,
    eventTimelineSafeControls: buildSafeControls()
  };
}

export function mapSupportEventTimelineRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportEventTimelineRuntimeReadOnlySafe>>
) {
  return {
    eventTimelineRuntime: input.eventTimelineRuntime,
    eventTimelineRuntimeGroups: input.eventTimelineRuntimeGroups,
    eventTimelineRuntimeItems: input.eventTimelineRuntimeItems,
    eventTimelineSafeControls: input.eventTimelineSafeControls
  };
}
