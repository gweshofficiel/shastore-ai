import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { Database } from "@/types/database";
import { isSupportErrorMonitoringEvent } from "@/src/lib/support/support-error-events-runtime";
import {
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportSearchRuntimeSource = "support_search_runtime";

export type SupportSearchResultCategory =
  | "conversation"
  | "error_event"
  | "monitoring_event"
  | "ticket"
  | "ticket_detail"
  | "timeline_event";

export type SupportSearchLoadingState = "error" | "inactive" | "loaded" | "unauthorized";

export type SupportSearchQuery = {
  q: string | null;
};

export type SupportSearchResultItem = {
  category: SupportSearchResultCategory;
  categoryLabel: string;
  createdAt: string | null;
  matchedFields: string[];
  recordId: string;
  recordKey: string;
  registryKey: "sp-search";
  relatedStoreId: string | null;
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  resultTitle: string;
  safeSummary: string;
  searchIndex: string;
  severity: string | null;
  source: string | null;
  status: string | null;
};

export type SupportSearchResultPublicItem = Omit<SupportSearchResultItem, "searchIndex">;

export type SupportSearchRuntimeSummary = {
  emptyMessage: string | null;
  loadError: string | null;
  loadingState: SupportSearchLoadingState;
  matchedResultCount: number;
  query: SupportSearchQuery;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  resetHref: string;
  searchableFields: string[];
  source: SupportSearchRuntimeSource;
  status: "load_error" | "needs_attention" | "search_empty" | "search_inactive" | "search_runtime_ready" | "unauthorized";
  summary: string;
  tablesDetected: {
    monitoringEvents: boolean;
    supportTicketMessages: boolean;
    supportTickets: boolean;
  };
  totalCandidateCount: number;
};

export type SupportSearchAuthorization = {
  canSearch: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

type TicketLookup = {
  ticketId: string;
  ticketNumber: string;
};

export const SUPPORT_SEARCH_RUNTIME_SOURCE = "support_search_runtime" as const;

export const SUPPORT_SEARCHABLE_FIELD_LABELS = [
  "Ticket ID",
  "Subject",
  "Description",
  "Status",
  "Priority",
  "Category",
  "Event type",
  "Severity",
  "Source",
  "Error message summary",
  "Related workspace",
  "Related store",
  "Related user",
  "Conversation author",
  "Timeline event type",
  "Safe summary"
] as const;

const TICKET_COLUMNS =
  "id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, message, created_at, updated_at";

const MESSAGE_COLUMNS =
  "id, ticket_id, workspace_id, store_id, author_user_id, author_role, author_label, visibility, message_body, created_at";

const MONITORING_COLUMNS =
  "id, workspace_id, store_id, user_id, entity_id, entity_type, event_type, event_status, created_at";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sanitizeSupportSearchKeyword(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!normalized) {
    return null;
  }

  const safe = normalized.replace(/[^a-z0-9 _\-@.:/]/g, "").slice(0, 64);
  return safe || null;
}

export function parseSupportSearchQuery(input: Record<string, string | undefined>): SupportSearchQuery {
  return {
    q: sanitizeSupportSearchKeyword(input.q)
  };
}

export function emptySupportSearchQuery(): SupportSearchQuery {
  return { q: null };
}

export function buildSupportSearchResetHref(input: { ticketId?: string | null }) {
  return buildSupportAdminHref({
    ticketId: input.ticketId ?? null
  });
}

export function buildSupportAdminHref(input: {
  q?: string | null;
  ticketId?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.ticketId) {
    params.set("ticket", input.ticketId);
  }

  if (input.q) {
    params.set("q", input.q);
  }

  const query = params.toString();
  return query ? `/admin/support?${query}` : "/admin/support";
}

function deriveTicketCategory(row: AnyRecord) {
  if (row.event_id) {
    return "Monitoring Escalation";
  }

  if (row.store_id) {
    return "Store Related";
  }

  return "Platform Support";
}

function deriveMonitoringSeverity(eventType: string, eventStatus: string) {
  if (isSupportErrorMonitoringEvent(eventType, eventStatus)) {
    return "critical";
  }

  const normalizedStatus = eventStatus.toLowerCase();
  const normalizedType = eventType.toLowerCase();

  if (normalizedStatus === "warning" || normalizedType.includes("warning")) {
    return "warning";
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

  return "Platform Monitoring";
}

function buildErrorMessageSummary(eventType: string, eventStatus: string, entityType: string) {
  const typeLabel = eventType.replace(/[_-]+/g, " ").trim() || "unknown";
  const entityLabel = entityType.replace(/[_-]+/g, " ").trim() || "unknown";
  const statusLabel = eventStatus.replace(/[_-]+/g, " ").trim() || "unknown";

  return `${typeLabel} reported as ${statusLabel} in ${entityLabel} scope`;
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

function resolveRelatedTicket(
  ticketLookup: Map<string, TicketLookup>,
  ticketId: string | null,
  entityType?: string,
  entityId?: string | null
) {
  if (ticketId) {
    const ticket = ticketLookup.get(ticketId);

    return {
      relatedTicketId: ticketId,
      relatedTicketNumber: ticket?.ticketNumber ?? ticketId
    };
  }

  if (entityType?.toLowerCase() === "support_ticket" && entityId) {
    const ticket = ticketLookup.get(entityId);

    return {
      relatedTicketId: entityId,
      relatedTicketNumber: ticket?.ticketNumber ?? entityId
    };
  }

  return {
    relatedTicketId: null,
    relatedTicketNumber: null
  };
}

function matchKeyword(haystack: string, keyword: string) {
  return normalizeComparable(haystack).includes(keyword);
}

function collectMatchedFields(
  keyword: string,
  fields: Array<{ key: string; value: string | null | undefined }>
) {
  return fields
    .filter((field) => field.value && matchKeyword(field.value, keyword))
    .map((field) => field.key);
}

export function supportSearchResultCategoryLabel(category: SupportSearchResultCategory) {
  switch (category) {
    case "ticket":
      return "Ticket";
    case "ticket_detail":
      return "Ticket detail";
    case "conversation":
      return "Conversation";
    case "monitoring_event":
      return "Monitoring event";
    case "error_event":
      return "Error event";
    case "timeline_event":
      return "Timeline event";
  }
}

function buildTicketSearchCandidates(row: AnyRecord): SupportSearchResultItem[] {
  const ticketId = text(row.id);
  const ticketNumber = text(row.ticket_number) || ticketId;
  const subject = text(row.subject) || `Ticket ${ticketNumber}`;
  const status = text(row.status) || "open";
  const priority = text(row.priority) || "normal";
  const category = deriveTicketCategory(row);
  const description = maskSensitiveText(text(row.message));
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at) || null;

  const ticketSearchIndex = [
    ticketId,
    ticketNumber,
    subject,
    status,
    priority,
    category,
    workspaceId,
    storeId,
    userId
  ]
    .filter(Boolean)
    .join(" ");

  const results: SupportSearchResultItem[] = [
    {
      category: "ticket",
      categoryLabel: supportSearchResultCategoryLabel("ticket"),
      createdAt,
      matchedFields: [],
      recordId: ticketId,
      recordKey: `search-ticket-${ticketId}`,
      registryKey: "sp-search",
      relatedStoreId: storeId,
      relatedTicketId: ticketId,
      relatedTicketNumber: ticketNumber,
      relatedUserId: userId,
      relatedWorkspaceId: workspaceId,
      resultTitle: subject,
      safeSummary: [
        `ticket ${ticketNumber}`,
        `status ${status}`,
        `priority ${priority}`,
        `category ${category}`
      ].join("; "),
      searchIndex: ticketSearchIndex,
      severity: null,
      source: "Support Platform",
      status
    }
  ];

  if (description) {
    results.push({
      category: "ticket_detail",
      categoryLabel: supportSearchResultCategoryLabel("ticket_detail"),
      createdAt,
      matchedFields: [],
      recordId: ticketId,
      recordKey: `search-ticket-detail-${ticketId}`,
      registryKey: "sp-search",
      relatedStoreId: storeId,
      relatedTicketId: ticketId,
      relatedTicketNumber: ticketNumber,
      relatedUserId: userId,
      relatedWorkspaceId: workspaceId,
      resultTitle: `${ticketNumber} description`,
      safeSummary: [
        `ticket ${ticketNumber}`,
        "description available",
        `status ${status}`,
        `category ${category}`
      ].join("; "),
      searchIndex: [ticketSearchIndex, description].join(" "),
      severity: null,
      source: "Support Platform",
      status
    });
  }

  return results;
}

function buildConversationSearchCandidate(
  row: AnyRecord,
  ticketLookup: Map<string, TicketLookup>
): SupportSearchResultItem {
  const messageId = text(row.id);
  const ticketId = text(row.ticket_id);
  const ticket = ticketLookup.get(ticketId);
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const authorUserId = row.author_user_id ? text(row.author_user_id) : null;
  const authorRole = text(row.author_role) || "unknown";
  const authorLabel = text(row.author_label) || "Support participant";
  const visibility = text(row.visibility) || "internal";
  const safeBody = maskSensitiveText(text(row.message_body));
  const createdAt = text(row.created_at) || null;

  return {
    category: "conversation",
    categoryLabel: supportSearchResultCategoryLabel("conversation"),
    createdAt,
    matchedFields: [],
    recordId: messageId,
    recordKey: `search-conversation-${messageId}`,
    registryKey: "sp-search",
    relatedStoreId: storeId,
    relatedTicketId: ticketId || null,
    relatedTicketNumber: ticket?.ticketNumber ?? ticketId ?? null,
    relatedUserId: authorUserId,
    relatedWorkspaceId: workspaceId,
    resultTitle: `Conversation on ${ticket?.ticketNumber ?? ticketId ?? "ticket"}`,
    safeSummary: [
      "conversation message",
      `author ${authorLabel}`,
      `role ${authorRole}`,
      `visibility ${visibility}`,
      safeBody ? "body available" : "body empty"
    ].join("; "),
    searchIndex: [
      messageId,
      ticketId,
      ticket?.ticketNumber,
      authorLabel,
      authorRole,
      visibility,
      safeBody,
      workspaceId,
      storeId,
      authorUserId
    ]
      .filter(Boolean)
      .join(" "),
    severity: null,
    source: "Support Platform",
    status: visibility
  };
}

function buildMonitoringSearchCandidate(
  row: AnyRecord,
  ticketLookup: Map<string, TicketLookup>,
  category: "error_event" | "monitoring_event"
): SupportSearchResultItem {
  const eventId = text(row.id);
  const eventType = text(row.event_type) || "unknown";
  const eventStatus = text(row.event_status) || "recorded";
  const entityType = text(row.entity_type) || "unknown";
  const entityId = row.entity_id ? text(row.entity_id) : null;
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const createdAt = text(row.created_at) || null;
  const severity = deriveMonitoringSeverity(eventType, eventStatus);
  const source = deriveMonitoringSource(eventType, entityType);
  const errorMessageSummary =
    category === "error_event" ? buildErrorMessageSummary(eventType, eventStatus, entityType) : null;
  const relatedTicket = resolveRelatedTicket(ticketLookup, null, entityType, entityId);

  return {
    category,
    categoryLabel: supportSearchResultCategoryLabel(category),
    createdAt,
    matchedFields: [],
    recordId: eventId,
    recordKey: `search-${category}-${eventId}`,
    registryKey: "sp-search",
    relatedStoreId: storeId,
    relatedTicketId: relatedTicket.relatedTicketId,
    relatedTicketNumber: relatedTicket.relatedTicketNumber,
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    resultTitle: eventType,
    safeSummary: [
      `event ${eventType}`,
      `status ${eventStatus}`,
      `entity ${entityType}`,
      `severity ${severity}`,
      `source ${source}`,
      errorMessageSummary ? `summary ${errorMessageSummary}` : "summary n/a"
    ].join("; "),
    searchIndex: [
      eventId,
      eventType,
      eventStatus,
      entityType,
      severity,
      source,
      errorMessageSummary,
      relatedTicket.relatedTicketId,
      relatedTicket.relatedTicketNumber,
      workspaceId,
      storeId,
      userId
    ]
      .filter(Boolean)
      .join(" "),
    severity,
    source,
    status: eventStatus
  };
}

function buildTimelineSearchCandidate(input: {
  actorLabel: string | null;
  createdAt: string;
  eventTypeLabel: string;
  recordId: string;
  relatedStoreId: string | null;
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  safeSummary: string;
  severity: string | null;
  source: string;
  status: string | null;
}): SupportSearchResultItem {
  return {
    category: "timeline_event",
    categoryLabel: supportSearchResultCategoryLabel("timeline_event"),
    createdAt: input.createdAt,
    matchedFields: [],
    recordId: input.recordId,
    recordKey: `search-timeline-${input.recordId}`,
    registryKey: "sp-search",
    relatedStoreId: input.relatedStoreId,
    relatedTicketId: input.relatedTicketId,
    relatedTicketNumber: input.relatedTicketNumber,
    relatedUserId: input.relatedUserId,
    relatedWorkspaceId: input.relatedWorkspaceId,
    resultTitle: input.eventTypeLabel,
    safeSummary: input.safeSummary,
    searchIndex: [
      input.recordId,
      input.eventTypeLabel,
      input.safeSummary,
      input.severity,
      input.source,
      input.status,
      input.actorLabel,
      input.relatedTicketId,
      input.relatedTicketNumber,
      input.relatedWorkspaceId,
      input.relatedStoreId,
      input.relatedUserId
    ]
      .filter(Boolean)
      .join(" "),
    severity: input.severity,
    source: input.source,
    status: input.status
  };
}

function filterSearchCandidates(candidates: SupportSearchResultItem[], keyword: string) {
  return candidates
    .map((candidate) => {
      if (!matchKeyword(candidate.searchIndex, keyword)) {
        return null;
      }

      const fieldMatches = collectMatchedFields(keyword, [
        { key: "Ticket ID", value: candidate.relatedTicketId },
        { key: "Ticket ID", value: candidate.relatedTicketNumber },
        { key: "Subject", value: candidate.resultTitle },
        { key: "Description", value: candidate.category === "ticket_detail" ? candidate.searchIndex : null },
        { key: "Status", value: candidate.status },
        { key: "Priority", value: candidate.searchIndex },
        { key: "Category", value: candidate.searchIndex },
        { key: "Event type", value: candidate.resultTitle },
        { key: "Severity", value: candidate.severity },
        { key: "Source", value: candidate.source },
        { key: "Error message summary", value: candidate.safeSummary },
        { key: "Related workspace", value: candidate.relatedWorkspaceId },
        { key: "Related store", value: candidate.relatedStoreId },
        { key: "Related user", value: candidate.relatedUserId },
        { key: "Conversation author", value: candidate.searchIndex },
        { key: "Timeline event type", value: candidate.resultTitle },
        { key: "Safe summary", value: candidate.safeSummary }
      ]);

      return {
        ...candidate,
        matchedFields: fieldMatches.length > 0 ? fieldMatches : ["Safe summary"]
      };
    })
    .filter((candidate): candidate is SupportSearchResultItem => candidate !== null)
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, 100);
}

function stripSearchIndex(items: SupportSearchResultItem[]): SupportSearchResultPublicItem[] {
  return items.map(({ searchIndex: _searchIndex, ...item }) => item);
}

export function resolveSupportSearchAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportSearchAuthorization {
  if (input.role === "super_admin") {
    return {
      canSearch: true,
      reason: "Super Admin may search Support records through read-only runtime queries.",
      roleLabel: "super_admin"
    };
  }

  if (
    input.internalRole === "support_agent" ||
    input.internalRole === "admin" ||
    input.internalRole === "super_admin"
  ) {
    return {
      canSearch: true,
      reason: "Authorized internal support role may search Support records read-only.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canSearch: false,
    reason: "Current internal team role is not authorized for Support search.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function getSupportSearchRuntimeSummary(input: {
  authorization: SupportSearchAuthorization;
  keyword: string | null;
  loadError: string | null;
  loadingState: SupportSearchLoadingState;
  matchedResults: SupportSearchResultPublicItem[];
  resetHref: string;
  tablesDetected: SupportSearchRuntimeSummary["tablesDetected"];
  totalCandidates: number;
}): SupportSearchRuntimeSummary {
  const allTablesDetected =
    input.tablesDetected.supportTickets &&
    input.tablesDetected.monitoringEvents &&
    input.tablesDetected.supportTicketMessages;

  const status = input.loadError
    ? ("load_error" as const)
    : !input.authorization.canSearch
      ? ("unauthorized" as const)
      : !input.keyword
        ? ("search_inactive" as const)
        : !allTablesDetected
          ? ("needs_attention" as const)
          : input.matchedResults.length === 0
            ? ("search_empty" as const)
            : ("search_runtime_ready" as const);

  return {
    emptyMessage:
      input.keyword && input.matchedResults.length === 0
        ? "No Support records match the active search keyword. Reset search to clear the query."
        : null,
    loadError: input.loadError,
    loadingState: input.loadingState,
    matchedResultCount: input.matchedResults.length,
    query: { q: input.keyword },
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    resetHref: input.resetHref,
    searchableFields: [...SUPPORT_SEARCHABLE_FIELD_LABELS],
    source: SUPPORT_SEARCH_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : !input.authorization.canSearch
        ? `status unauthorized; ${input.authorization.reason}`
        : !input.keyword
          ? "status search_inactive; submit a keyword to search Support records"
          : [
              `status ${status}`,
              `${input.matchedResults.length}/${input.totalCandidates} matched`,
              `keyword "${input.keyword}"`
            ].join("; "),
    tablesDetected: input.tablesDetected,
    totalCandidateCount: input.totalCandidates
  };
}

export async function loadSupportSearchRuntimeReadOnlySafe(params: {
  authorization: SupportSearchAuthorization;
  loadError?: string | null;
  resetHref: string;
  searchQuery?: string | null;
  supabase: SupabaseClient<Database> | null;
  ticketId?: string | null;
}) {
  const keyword = sanitizeSupportSearchKeyword(params.searchQuery ?? null);
  const emptyTables = {
    monitoringEvents: false,
    supportTicketMessages: false,
    supportTickets: false
  };

  if (!params.authorization.canSearch) {
    return {
      searchResults: [] as SupportSearchResultPublicItem[],
      supportSearchRuntime: getSupportSearchRuntimeSummary({
        authorization: params.authorization,
        keyword,
        loadError: null,
        loadingState: "unauthorized",
        matchedResults: [],
        resetHref: params.resetHref,
        tablesDetected: emptyTables,
        totalCandidates: 0
      })
    };
  }

  if (!keyword) {
    return {
      searchResults: [] as SupportSearchResultPublicItem[],
      supportSearchRuntime: getSupportSearchRuntimeSummary({
        authorization: params.authorization,
        keyword,
        loadError: null,
        loadingState: "inactive",
        matchedResults: [],
        resetHref: params.resetHref,
        tablesDetected: emptyTables,
        totalCandidates: 0
      })
    };
  }

  if (!params.supabase || params.loadError) {
    return {
      searchResults: [] as SupportSearchResultPublicItem[],
      supportSearchRuntime: getSupportSearchRuntimeSummary({
        authorization: params.authorization,
        keyword,
        loadError: params.loadError ?? "Admin client unavailable",
        loadingState: "error",
        matchedResults: [],
        resetHref: params.resetHref,
        tablesDetected: emptyTables,
        totalCandidates: 0
      })
    };
  }

  const ticketsLoad = await params.supabase
    .from("support_tickets" as never)
    .select(TICKET_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const messagesLoad = await params.supabase
    .from("support_ticket_messages" as never)
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const monitoringLoad = await params.supabase
    .from("monitoring_events" as never)
    .select(MONITORING_COLUMNS)
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
      searchResults: [] as SupportSearchResultPublicItem[],
      supportSearchRuntime: getSupportSearchRuntimeSummary({
        authorization: params.authorization,
        keyword,
        loadError,
        loadingState: "error",
        matchedResults: [],
        resetHref: params.resetHref,
        tablesDetected,
        totalCandidates: 0
      })
    };
  }

  const ticketRows = Array.isArray(ticketsLoad.data) ? (ticketsLoad.data as AnyRecord[]) : [];
  const messageRows = Array.isArray(messagesLoad.data) ? (messagesLoad.data as AnyRecord[]) : [];
  const monitoringRows = Array.isArray(monitoringLoad.data) ? (monitoringLoad.data as AnyRecord[]) : [];
  const ticketLookup = buildTicketLookup(ticketRows);

  const candidates: SupportSearchResultItem[] = [
    ...ticketRows.flatMap((row) => buildTicketSearchCandidates(row)),
    ...messageRows.map((row) => buildConversationSearchCandidate(row, ticketLookup)),
    ...monitoringRows.map((row) => {
      const eventType = text(row.event_type) || "unknown";
      const eventStatus = text(row.event_status) || "recorded";

      return buildMonitoringSearchCandidate(
        row,
        ticketLookup,
        isSupportErrorMonitoringEvent(eventType, eventStatus) ? "error_event" : "monitoring_event"
      );
    }),
    ...ticketRows.map((row) => {
      const ticketId = text(row.id);
      const ticketNumber = text(row.ticket_number) || ticketId;
      const status = text(row.status) || "open";
      const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
      const storeId = row.store_id ? text(row.store_id) : null;
      const userId = row.user_id ? text(row.user_id) : null;

      return buildTimelineSearchCandidate({
        actorLabel: userId ? `User ${userId}` : null,
        createdAt: text(row.created_at),
        eventTypeLabel: "Ticket event",
        recordId: ticketId,
        relatedStoreId: storeId,
        relatedTicketId: ticketId,
        relatedTicketNumber: ticketNumber,
        relatedUserId: userId,
        relatedWorkspaceId: workspaceId,
        safeSummary: `ticket created; ticket ${ticketNumber}; status ${status}`,
        severity: "info",
        source: "Support Platform",
        status
      });
    }),
    ...monitoringRows.map((row) => {
      const eventType = text(row.event_type) || "unknown";
      const eventStatus = text(row.event_status) || "recorded";
      const entityType = text(row.entity_type) || "unknown";
      const entityId = row.entity_id ? text(row.entity_id) : null;
      const relatedTicket = resolveRelatedTicket(ticketLookup, null, entityType, entityId);
      const isError = isSupportErrorMonitoringEvent(eventType, eventStatus);
      let eventTypeLabel = "Monitoring event";

      if (eventType === "support_ticket_status_changed") {
        eventTypeLabel = "Status change";
      } else if (eventType === "support_ticket_assigned" || eventType === "support_ticket_unassigned") {
        eventTypeLabel = "Assignment change";
      } else if (isError) {
        eventTypeLabel = "Error event";
      }

      return buildTimelineSearchCandidate({
        actorLabel: row.user_id ? `User ${text(row.user_id)}` : null,
        createdAt: text(row.created_at),
        eventTypeLabel,
        recordId: text(row.id),
        relatedStoreId: row.store_id ? text(row.store_id) : null,
        relatedTicketId: relatedTicket.relatedTicketId,
        relatedTicketNumber: relatedTicket.relatedTicketNumber,
        relatedUserId: row.user_id ? text(row.user_id) : null,
        relatedWorkspaceId: row.workspace_id ? text(row.workspace_id) : null,
        safeSummary: `event ${eventType}; status ${eventStatus}; entity ${entityType}`,
        severity: deriveMonitoringSeverity(eventType, eventStatus),
        source: deriveMonitoringSource(eventType, entityType),
        status: eventStatus
      });
    }),
    ...messageRows.map((row) => {
      const messageId = text(row.id);
      const ticketId = text(row.ticket_id);
      const ticket = ticketLookup.get(ticketId);

      return buildTimelineSearchCandidate({
        actorLabel: text(row.author_label) || "Support participant",
        createdAt: text(row.created_at),
        eventTypeLabel: "Conversation activity",
        recordId: messageId,
        relatedStoreId: row.store_id ? text(row.store_id) : null,
        relatedTicketId: ticketId || null,
        relatedTicketNumber: ticket?.ticketNumber ?? ticketId ?? null,
        relatedUserId: row.author_user_id ? text(row.author_user_id) : null,
        relatedWorkspaceId: row.workspace_id ? text(row.workspace_id) : null,
        safeSummary: `conversation message; author ${text(row.author_label) || "participant"}`,
        severity: null,
        source: "Support Platform",
        status: text(row.visibility) || "internal"
      });
    })
  ];

  const searchResults = stripSearchIndex(filterSearchCandidates(candidates, keyword));

  return {
    searchResults,
    supportSearchRuntime: getSupportSearchRuntimeSummary({
      authorization: params.authorization,
      keyword,
      loadError: null,
      loadingState: "loaded",
      matchedResults: searchResults,
      resetHref: params.resetHref,
      tablesDetected,
      totalCandidates: candidates.length
    })
  };
}

export function mapSupportSearchRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportSearchRuntimeReadOnlySafe>>
) {
  return {
    searchResults: input.searchResults,
    supportSearchRuntime: input.supportSearchRuntime
  };
}

export function supportSearchRuntimeStatusBadgeTone(
  status: SupportSearchRuntimeSummary["status"]
) {
  switch (status) {
    case "search_runtime_ready":
      return "green" as const;
    case "search_inactive":
      return "blue" as const;
    case "search_empty":
      return "slate" as const;
    case "unauthorized":
      return "red" as const;
    case "needs_attention":
    case "load_error":
      return "amber" as const;
  }
}
