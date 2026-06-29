import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE,
  type SupportRegistryVisibility
} from "@/src/lib/support/support-registry-runtime";
import {
  resolveAssignedAgentLabel,
  type SupportAgentDirectory
} from "@/src/lib/support/support-ticket-assignment-runtime";
import {
  isInReviewCanonicalStatus,
  isOpenCanonicalStatus,
  normalizeStorageStatusToCanonical,
  type SupportTicketCanonicalStatus
} from "@/src/lib/support/support-ticket-status-runtime";

export type SupportTicketsRuntimeSource = "support_tickets_runtime";

export type SupportTicketsGroupKey = "platform-tickets";

export type SupportTicketRuntimeStatus =
  | "closed"
  | "in_review"
  | "open"
  | "resolved"
  | "unknown";

export type SupportTicketReviewStatus = "clear" | "not_applicable" | "review_required";

export type SupportTicketSafeControlKey = "assign" | "close" | "inspect" | "reopen" | "update_status";

export type SupportTicketSafeControl = {
  enabled: false;
  key: SupportTicketSafeControlKey;
  label: string;
  note: string;
};

export type SupportTicketRuntimeItem = {
  assignedAgentId: string | null;
  assignedAgentLabel: string;
  canonicalStatus: SupportTicketCanonicalStatus;
  category: string;
  createdAt: string;
  eventId: string | null;
  groupKey: SupportTicketsGroupKey;
  lastUpdatedAt: string;
  priority: string;
  registryKey: string;
  relatedStoreId: string | null;
  relatedUserId: string | null;
  relatedWorkspaceId: string | null;
  reviewStatus: SupportTicketReviewStatus;
  runtimeStatus: SupportTicketRuntimeStatus;
  safeControls: SupportTicketSafeControl[];
  safeSummary: string;
  status: string;
  subject: string;
  tableDetected: boolean;
  ticketId: string;
  ticketKey: string;
  ticketNumber: string;
  visibility: SupportRegistryVisibility;
};

export type SupportTicketsRuntimeGroup = {
  groupKey: SupportTicketsGroupKey;
  itemCount: number;
  items: SupportTicketRuntimeItem[];
  title: string;
};

export type SupportTicketsRuntimeSummary = {
  closedTickets: number;
  groupCount: number;
  inReviewTickets: number;
  loadError: string | null;
  openTickets: number;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  resolvedTickets: number;
  source: SupportTicketsRuntimeSource;
  status: "load_error" | "needs_attention" | "tickets_runtime_ready";
  summary: string;
  tableDetected: boolean;
  totalTickets: number;
  urgentTickets: number;
};

type AnyRecord = Record<string, unknown>;

export const SUPPORT_TICKETS_RUNTIME_SOURCE = "support_tickets_runtime" as const;

export const SUPPORT_TICKET_SAFE_CONTROLS: readonly SupportTicketSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No ticket inspection mutation runs during SP-3 page load."
  },
  {
    enabled: false,
    key: "assign",
    label: "Assign",
    note: "Read-only placeholder. No ticket assignment runs during SP-3 page load."
  },
  {
    enabled: false,
    key: "update_status",
    label: "Update Status",
    note: "Read-only placeholder. No ticket status mutation runs during SP-3 page load."
  },
  {
    enabled: false,
    key: "close",
    label: "Close",
    note: "Read-only placeholder. No ticket close action runs during SP-3 page load."
  },
  {
    enabled: false,
    key: "reopen",
    label: "Reopen",
    note: "Read-only placeholder. No ticket reopen action runs during SP-3 page load."
  }
] as const;

const TICKETS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: SupportTicketsGroupKey;
  registryKey: string;
  tableName: string;
  title: string;
}> = [
  {
    groupKey: "platform-tickets",
    registryKey: "sp-tickets",
    tableName: "support_tickets",
    title: "Platform Tickets"
  }
] as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSafeControls() {
  return SUPPORT_TICKET_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function normalizeTicketStatus(status: string): SupportTicketRuntimeStatus {
  const canonical = normalizeStorageStatusToCanonical(status);

  switch (canonical) {
    case "open":
      return "open";
    case "in_progress":
    case "pending":
      return "in_review";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "unknown";
  }
}

function isOpenTicketStatus(status: SupportTicketRuntimeStatus, canonicalStatus: SupportTicketCanonicalStatus) {
  return isOpenCanonicalStatus(canonicalStatus) || status === "open" || status === "in_review";
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

function deriveReviewStatus(
  runtimeStatus: SupportTicketRuntimeStatus,
  canonicalStatus: SupportTicketCanonicalStatus,
  priority: string
): SupportTicketReviewStatus {
  if (runtimeStatus === "unknown" || canonicalStatus === "unknown") {
    return "review_required";
  }

  if (priority === "urgent" || priority === "high") {
    return isOpenTicketStatus(runtimeStatus, canonicalStatus) ? "review_required" : "clear";
  }

  return "clear";
}

async function safeTicketTableSelect(
  supabase: SupabaseClient<Database>,
  tableName: string,
  columns: string,
  limit: number
) {
  const { data, error } = await supabase
    .from(tableName as never)
    .select(columns)
    .limit(limit);

  return {
    error: error?.message ?? null,
    rows: Array.isArray(data) ? (data as AnyRecord[]) : [],
    tableDetected: !error
  };
}

function buildTicketRuntimeItem(
  row: AnyRecord,
  tableDetected: boolean,
  agentDirectory: SupportAgentDirectory = {}
): SupportTicketRuntimeItem {
  const registryEntry = getSupportRegistryEntry("sp-tickets");
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
  const assignedUserId = row.assigned_user_id ? text(row.assigned_user_id) : null;
  const assignment = resolveAssignedAgentLabel(assignedUserId, agentDirectory);

  return {
    assignedAgentId: assignment.assignedAgentId,
    assignedAgentLabel: assignment.assignedAgentLabel,
    canonicalStatus,
    category,
    createdAt: text(row.created_at),
    eventId,
    groupKey: "platform-tickets",
    lastUpdatedAt: text(row.updated_at),
    priority,
    registryKey: "sp-tickets",
    relatedStoreId: storeId,
    relatedUserId: userId,
    relatedWorkspaceId: workspaceId,
    reviewStatus: deriveReviewStatus(runtimeStatus, canonicalStatus, priority),
    runtimeStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `ticket ${ticketNumber}`,
      `status ${canonicalStatus}`,
      `priority ${priority}`,
      `category ${category}`,
      workspaceId ? `workspace ${workspaceId}` : "workspace n/a",
      storeId ? `store ${storeId}` : "store n/a",
      assignment.assignedAgentId ? `agent ${assignment.assignedAgentId}` : "agent n/a"
    ].join("; "),
    status: canonicalStatus,
    subject: text(row.subject) || "Support ticket",
    tableDetected,
    ticketId,
    ticketKey: `support-ticket-${ticketId}`,
    ticketNumber,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

export function supportTicketRuntimeStatusLabel(status: SupportTicketRuntimeStatus) {
  switch (status) {
    case "closed":
      return "Closed";
    case "in_review":
      return "In Review";
    case "open":
      return "Open";
    case "resolved":
      return "Resolved";
    case "unknown":
      return "Unknown";
  }
}

export function supportTicketRuntimeStatusBadgeTone(status: SupportTicketRuntimeStatus) {
  switch (status) {
    case "open":
      return "blue" as const;
    case "in_review":
      return "amber" as const;
    case "resolved":
    case "closed":
      return "green" as const;
    case "unknown":
      return "slate" as const;
  }
}

export function buildSupportTicketsRuntimeGroups(items: SupportTicketRuntimeItem[]): SupportTicketsRuntimeGroup[] {
  return TICKETS_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0 || group.groupKey === "platform-tickets");
}

export function getSupportTicketsRuntimeSummary(
  items: SupportTicketRuntimeItem[],
  input: { loadError: string | null; tableDetected: boolean }
): SupportTicketsRuntimeSummary {
  const openTickets = items.filter((item) => isOpenTicketStatus(item.runtimeStatus, item.canonicalStatus)).length;
  const inReviewTickets = items.filter((item) => isInReviewCanonicalStatus(item.canonicalStatus)).length;
  const resolvedTickets = items.filter((item) => item.runtimeStatus === "resolved").length;
  const closedTickets = items.filter((item) => item.runtimeStatus === "closed").length;
  const urgentTickets = items.filter(
    (item) =>
      (item.priority === "urgent" || item.priority === "high") &&
      isOpenTicketStatus(item.runtimeStatus, item.canonicalStatus)
  ).length;
  const status = input.loadError
    ? ("load_error" as const)
    : !input.tableDetected || items.some((item) => item.reviewStatus === "review_required")
      ? ("needs_attention" as const)
      : ("tickets_runtime_ready" as const);

  return {
    closedTickets,
    groupCount: buildSupportTicketsRuntimeGroups(items).length,
    inReviewTickets,
    loadError: input.loadError,
    openTickets,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    resolvedTickets,
    source: SUPPORT_TICKETS_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${items.length} tickets`,
          `${openTickets} open`,
          `${inReviewTickets} in review`,
          `${urgentTickets} urgent or high priority open`,
          input.tableDetected ? "support_tickets table detected" : "support_tickets table not detected"
        ].join("; "),
    tableDetected: input.tableDetected,
    totalTickets: items.length,
    urgentTickets
  };
}

export async function loadSupportTicketsRuntimeReadOnlySafe(params: {
  agentDirectory?: SupportAgentDirectory;
  loadError?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  const agentDirectory = params.agentDirectory ?? {};
  if (!params.supabase || params.loadError) {
    return {
      groups: buildSupportTicketsRuntimeGroups([]),
      safeControls: buildSafeControls(),
      tickets: [] as SupportTicketRuntimeItem[],
      ticketsRuntime: getSupportTicketsRuntimeSummary([], {
        loadError: params.loadError ?? "Admin client unavailable",
        tableDetected: false
      })
    };
  }

  const baseColumns =
    "id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, created_at, updated_at";
  let ticketLoad = await safeTicketTableSelect(
    params.supabase,
    "support_tickets",
    `${baseColumns}, assigned_user_id`,
    200
  );

  if (ticketLoad.error?.includes("assigned_user_id")) {
    ticketLoad = await safeTicketTableSelect(params.supabase, "support_tickets", baseColumns, 200);
  }

  const tickets = ticketLoad.rows
    .map((row) => buildTicketRuntimeItem(row, ticketLoad.tableDetected, agentDirectory))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const groups = buildSupportTicketsRuntimeGroups(tickets);
  const summary = getSupportTicketsRuntimeSummary(tickets, {
    loadError: ticketLoad.error,
    tableDetected: ticketLoad.tableDetected
  });

  return {
    groups,
    safeControls: buildSafeControls(),
    tickets,
    ticketsRuntime: summary
  };
}

export function mapSupportTicketsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportTicketsRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    tickets: input.tickets,
    ticketsRuntime: input.ticketsRuntime
  };
}

export function mapSupportTicketRuntimeItemsToDashboardTickets(items: SupportTicketRuntimeItem[]) {
  return items.map((item) => ({
    created_at: item.createdAt,
    id: item.ticketId,
    priority: item.priority,
    status: item.status,
    subject: item.subject,
    ticket_number: item.ticketNumber,
    updated_at: item.lastUpdatedAt
  }));
}

export function mapSupportTicketRuntimeItemsToLegacyTickets(items: SupportTicketRuntimeItem[]) {
  return items.map((item) => ({
    created_at: item.createdAt,
    event_id: item.eventId,
    id: item.ticketId,
    message: null,
    priority: item.priority,
    status: item.status,
    store_id: item.relatedStoreId,
    subject: item.subject,
    ticket_number: item.ticketNumber,
    updated_at: item.lastUpdatedAt,
    user_id: item.relatedUserId,
    workspace_id: item.relatedWorkspaceId
  }));
}
