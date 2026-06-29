import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { Database } from "@/types/database";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE,
  type SupportRegistryVisibility
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketRuntimeStatus } from "@/src/lib/support/support-tickets-runtime";
import {
  normalizeStorageStatusToCanonical,
  type SupportTicketCanonicalStatus
} from "@/src/lib/support/support-ticket-status-runtime";

export type SupportTicketDetailsRuntimeSource = "support_ticket_details_runtime";

export type SupportTicketDetailState = "available" | "error" | "not_found" | "unselected";

export type SupportTicketDetailsLoadingState = "error" | "loaded" | "unselected";

export type SupportTicketRelatedMonitoringEvent = {
  createdAt: string;
  entityType: string;
  eventId: string;
  eventStatus: string;
  eventType: string;
  isErrorEvent: boolean;
  relatedStoreId: string | null;
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  safeSummary: string;
};

export type SupportTicketDetailRuntimeItem = {
  assignedAgentId: string | null;
  assignedAgentLabel: string;
  canonicalStatus: SupportTicketCanonicalStatus;
  category: string;
  createdAt: string;
  description: string;
  descriptionState: "available" | "empty";
  eventId: string | null;
  lastUpdatedAt: string;
  priority: string;
  registryKey: string;
  relatedMonitoringEvent: SupportTicketRelatedMonitoringEvent | null;
  relatedMonitoringEventState: "available" | "not_found" | "not_linked";
  relatedStoreId: string | null;
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  runtimeStatus: SupportTicketRuntimeStatus;
  safeSummary: string;
  status: string;
  subject: string;
  tableDetected: boolean;
  ticketId: string;
  ticketKey: string;
  ticketNumber: string;
  visibility: SupportRegistryVisibility;
};

export type SupportTicketDetailsRuntimeSummary = {
  detailState: SupportTicketDetailState;
  loadError: string | null;
  loadingState: SupportTicketDetailsLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  selectedTicketId: string | null;
  source: SupportTicketDetailsRuntimeSource;
  status: "load_error" | "needs_attention" | "ticket_details_ready" | "unselected";
  summary: string;
  tableDetected: boolean;
};

type AnyRecord = Record<string, unknown>;

export const SUPPORT_TICKET_DETAILS_RUNTIME_SOURCE = "support_ticket_details_runtime" as const;

const TICKET_DETAIL_COLUMNS =
  "id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, message, created_at, updated_at";

const MONITORING_EVENT_COLUMNS =
  "id, workspace_id, store_id, user_id, event_type, event_status, entity_type, created_at";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTicketStatus(status: string): SupportTicketRuntimeStatus {
  switch (status.toLowerCase()) {
    case "open":
      return "open";
    case "in_review":
      return "in_review";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "unknown";
  }
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

function buildSafeDescription(message: string) {
  const trimmed = message.trim();

  if (!trimmed) {
    return {
      description: "No description provided.",
      descriptionState: "empty" as const
    };
  }

  return {
    description: maskSensitiveText(trimmed),
    descriptionState: "available" as const
  };
}

function isErrorMonitoringEvent(eventType: string, eventStatus: string) {
  const normalizedType = eventType.toLowerCase();
  const normalizedStatus = eventStatus.toLowerCase();

  return (
    normalizedStatus === "failed" ||
    normalizedType.includes("error") ||
    normalizedType.includes("failed")
  );
}

function buildRelatedMonitoringEvent(row: AnyRecord): SupportTicketRelatedMonitoringEvent {
  const eventId = text(row.id);
  const eventType = text(row.event_type) || "unknown";
  const eventStatus = text(row.event_status) || "recorded";
  const entityType = text(row.entity_type) || "unknown";
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const isErrorEvent = isErrorMonitoringEvent(eventType, eventStatus);

  return {
    createdAt: text(row.created_at),
    entityType,
    eventId,
    eventStatus,
    eventType,
    isErrorEvent,
    relatedStoreId: storeId,
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    safeSummary: [
      `event ${eventType}`,
      `status ${eventStatus}`,
      `entity ${entityType}`,
      isErrorEvent ? "classification error" : "classification monitoring",
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a"
    ].join("; ")
  };
}

function buildTicketDetailItem(
  row: AnyRecord,
  input: {
    relatedMonitoringEvent: SupportTicketRelatedMonitoringEvent | null;
    relatedMonitoringEventState: SupportTicketDetailRuntimeItem["relatedMonitoringEventState"];
    tableDetected: boolean;
  }
): SupportTicketDetailRuntimeItem {
  const registryEntry = getSupportRegistryEntry("sp-ticket-details");
  const ticketId = text(row.id);
  const ticketNumber = text(row.ticket_number) || ticketId;
  const status = text(row.status) || "open";
  const priority = text(row.priority) || "normal";
  const canonicalStatus = normalizeStorageStatusToCanonical(status);
  const runtimeStatus = normalizeTicketStatus(status);
  const category = deriveTicketCategory(row);
  const workspaceId = row.workspace_id ? text(row.workspace_id) : null;
  const storeId = row.store_id ? text(row.store_id) : null;
  const userId = row.user_id ? text(row.user_id) : null;
  const eventId = row.event_id ? text(row.event_id) : null;
  const { description, descriptionState } = buildSafeDescription(text(row.message));

  return {
    assignedAgentId: null,
    assignedAgentLabel: "Not assigned",
    canonicalStatus,
    category,
    createdAt: text(row.created_at),
    description,
    descriptionState,
    eventId,
    lastUpdatedAt: text(row.updated_at),
    priority,
    registryKey: "sp-ticket-details",
    relatedMonitoringEvent: input.relatedMonitoringEvent,
    relatedMonitoringEventState: input.relatedMonitoringEventState,
    relatedStoreId: storeId,
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    runtimeStatus,
    safeSummary: [
      `ticket ${ticketNumber}`,
      `status ${canonicalStatus}`,
      `priority ${priority}`,
      `category ${category}`,
      descriptionState === "available" ? "description available" : "description empty",
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a",
      eventId ? `event ${eventId}` : "event n/a"
    ].join("; "),
    status: canonicalStatus,
    subject: text(row.subject) || "Support ticket",
    tableDetected: input.tableDetected,
    ticketId,
    ticketKey: `support-ticket-detail-${ticketId}`,
    ticketNumber,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildUnselectedSummary(): SupportTicketDetailsRuntimeSummary {
  return {
    detailState: "unselected",
    loadError: null,
    loadingState: "unselected",
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    selectedTicketId: null,
    source: SUPPORT_TICKET_DETAILS_RUNTIME_SOURCE,
    status: "unselected",
    summary: "status unselected; select a ticket from Tickets runtime to view read-only details",
    tableDetected: false
  };
}

function buildDetailSummary(input: {
  detail: SupportTicketDetailRuntimeItem | null;
  detailState: SupportTicketDetailState;
  loadError: string | null;
  selectedTicketId: string | null;
  tableDetected: boolean;
}): SupportTicketDetailsRuntimeSummary {
  const loadingState: SupportTicketDetailsLoadingState =
    input.detailState === "error" ? "error" : input.detailState === "unselected" ? "unselected" : "loaded";

  const status =
    input.loadError || input.detailState === "error"
      ? ("load_error" as const)
      : input.detailState === "unselected"
        ? ("unselected" as const)
        : input.detailState === "not_found"
          ? ("needs_attention" as const)
          : input.detail?.runtimeStatus === "unknown"
            ? ("needs_attention" as const)
            : ("ticket_details_ready" as const);

  return {
    detailState: input.detailState,
    loadError: input.loadError,
    loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    selectedTicketId: input.selectedTicketId,
    source: SUPPORT_TICKET_DETAILS_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : input.detailState === "unselected"
        ? "status unselected; no ticket selected"
        : input.detailState === "not_found"
          ? `status not_found; ticket ${input.selectedTicketId ?? "unknown"} was not found`
          : input.detailState === "error"
            ? "status error; ticket details could not be loaded safely"
            : [
                `status ${status}`,
                `ticket ${input.detail?.ticketNumber ?? input.selectedTicketId ?? "unknown"}`,
                input.detail?.descriptionState === "available" ? "description available" : "description empty",
                input.detail?.relatedMonitoringEventState === "available"
                  ? "related monitoring event available"
                  : input.detail?.relatedMonitoringEventState === "not_found"
                    ? "related monitoring event not found"
                    : "no related monitoring event",
                input.tableDetected ? "support_tickets table detected" : "support_tickets table not detected"
              ].join("; "),
    tableDetected: input.tableDetected
  };
}

export function buildSupportTicketDetailHref(ticketId: string) {
  const params = new URLSearchParams();
  params.set("ticket", ticketId);
  return `/admin/support?${params.toString()}`;
}

export async function loadSupportTicketDetailsRuntimeReadOnlySafe(params: {
  loadError?: string | null;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  const selectedTicketId = params.selectedTicketId?.trim() || null;

  if (!selectedTicketId) {
    return {
      detail: null as SupportTicketDetailRuntimeItem | null,
      ticketDetailsRuntime: buildUnselectedSummary()
    };
  }

  if (!isUuid(selectedTicketId)) {
    return {
      detail: null,
      ticketDetailsRuntime: buildDetailSummary({
        detail: null,
        detailState: "not_found",
        loadError: null,
        selectedTicketId,
        tableDetected: false
      })
    };
  }

  if (!params.supabase || params.loadError) {
    return {
      detail: null,
      ticketDetailsRuntime: buildDetailSummary({
        detail: null,
        detailState: "error",
        loadError: params.loadError ?? "Admin client unavailable",
        selectedTicketId,
        tableDetected: false
      })
    };
  }

  const ticketLoad = await params.supabase
    .from("support_tickets" as never)
    .select(TICKET_DETAIL_COLUMNS)
    .eq("id", selectedTicketId)
    .maybeSingle();

  if (ticketLoad.error) {
    return {
      detail: null,
      ticketDetailsRuntime: buildDetailSummary({
        detail: null,
        detailState: "error",
        loadError: ticketLoad.error.message,
        selectedTicketId,
        tableDetected: false
      })
    };
  }

  if (!ticketLoad.data) {
    return {
      detail: null,
      ticketDetailsRuntime: buildDetailSummary({
        detail: null,
        detailState: "not_found",
        loadError: null,
        selectedTicketId,
        tableDetected: true
      })
    };
  }

  const row = ticketLoad.data as AnyRecord;
  const eventId = row.event_id ? text(row.event_id) : null;
  let relatedMonitoringEvent: SupportTicketRelatedMonitoringEvent | null = null;
  let relatedMonitoringEventState: SupportTicketDetailRuntimeItem["relatedMonitoringEventState"] = "not_linked";

  if (eventId) {
    const eventLoad = await params.supabase
      .from("monitoring_events" as never)
      .select(MONITORING_EVENT_COLUMNS)
      .eq("id", eventId)
      .maybeSingle();

    if (eventLoad.error) {
      return {
        detail: null,
        ticketDetailsRuntime: buildDetailSummary({
          detail: null,
          detailState: "error",
          loadError: eventLoad.error.message,
          selectedTicketId,
          tableDetected: true
        })
      };
    }

    if (eventLoad.data) {
      relatedMonitoringEvent = buildRelatedMonitoringEvent(eventLoad.data as AnyRecord);
      relatedMonitoringEventState = "available";
    } else {
      relatedMonitoringEventState = "not_found";
    }
  }

  const detail = buildTicketDetailItem(row, {
    relatedMonitoringEvent,
    relatedMonitoringEventState,
    tableDetected: true
  });

  return {
    detail,
    ticketDetailsRuntime: buildDetailSummary({
      detail,
      detailState: "available",
      loadError: null,
      selectedTicketId,
      tableDetected: true
    })
  };
}

export function mapSupportTicketDetailsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportTicketDetailsRuntimeReadOnlySafe>>
) {
  return {
    ticketDetail: input.detail,
    ticketDetailsRuntime: input.ticketDetailsRuntime
  };
}
