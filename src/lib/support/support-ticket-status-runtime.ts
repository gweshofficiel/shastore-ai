import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportTicketStatusRuntimeSource = "support_ticket_status_runtime";

export type SupportTicketCanonicalStatus =
  | "closed"
  | "in_progress"
  | "open"
  | "pending"
  | "resolved"
  | "unknown";

export type SupportTicketStorageStatus = "closed" | "in_review" | "open" | "resolved" | "unknown";

export type SupportTicketStatusTransitionFoundation = "available" | "read_only";

export type SupportTicketStatusTransitionResultCode =
  | "error"
  | "invalid"
  | "not_found"
  | "success"
  | "unauthorized"
  | "unchanged";

export type SupportTicketStatusRuntimeItem = {
  allowedTransitions: SupportTicketCanonicalStatus[];
  canMutateStatus: boolean;
  canonicalStatus: SupportTicketCanonicalStatus;
  registryKey: "sp-ticket-status";
  storageStatus: SupportTicketStorageStatus;
  ticketId: string;
  transitionFoundation: SupportTicketStatusTransitionFoundation;
  transitionNote: string;
};

export type SupportTicketStatusRuntimeSummary = {
  allowedStatuses: SupportTicketCanonicalStatus[];
  loadError: string | null;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  source: SupportTicketStatusRuntimeSource;
  status: "load_error" | "needs_attention" | "status_runtime_ready";
  summary: string;
  transitionFoundation: SupportTicketStatusTransitionFoundation;
};

export type SupportTicketStatusAuthorization = {
  canMutateStatus: boolean;
  reason: string;
  roleLabel: string;
};

export const SUPPORT_TICKET_STATUS_RUNTIME_SOURCE = "support_ticket_status_runtime" as const;

export const SUPPORT_TICKET_CANONICAL_STATUSES = [
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed"
] as const satisfies readonly SupportTicketCanonicalStatus[];

const STORAGE_STATUS_SET = new Set(["open", "in_review", "resolved", "closed"]);

const TRANSITION_MATRIX: Record<
  Exclude<SupportTicketCanonicalStatus, "unknown">,
  readonly SupportTicketCanonicalStatus[]
> = {
  closed: ["open"],
  in_progress: ["open", "pending", "resolved", "closed"],
  open: ["in_progress", "pending", "resolved", "closed"],
  pending: ["open", "in_progress", "resolved", "closed"],
  resolved: ["open", "closed"]
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidSupportTicketCanonicalStatus(
  value: string
): value is Exclude<SupportTicketCanonicalStatus, "unknown"> {
  return (SUPPORT_TICKET_CANONICAL_STATUSES as readonly string[]).includes(value);
}

export function normalizeStorageStatusToCanonical(status: string): SupportTicketCanonicalStatus {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "open":
      return "open";
    case "in_review":
    case "in_progress":
      return "in_progress";
    case "pending":
      return "pending";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "unknown";
  }
}

export function canonicalStatusToStorage(
  status: Exclude<SupportTicketCanonicalStatus, "unknown">
): Exclude<SupportTicketStorageStatus, "unknown"> {
  switch (status) {
    case "open":
      return "open";
    case "in_progress":
    case "pending":
      return "in_review";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
  }
}

export function normalizeStorageStatus(status: string): SupportTicketStorageStatus {
  const normalized = status.toLowerCase();
  return STORAGE_STATUS_SET.has(normalized)
    ? (normalized as Exclude<SupportTicketStorageStatus, "unknown">)
    : "unknown";
}

export function isOpenCanonicalStatus(status: SupportTicketCanonicalStatus) {
  return status === "open" || status === "in_progress" || status === "pending";
}

export function isInReviewCanonicalStatus(status: SupportTicketCanonicalStatus) {
  return status === "in_progress" || status === "pending";
}

export function getAllowedSupportTicketTransitions(
  status: SupportTicketCanonicalStatus
): SupportTicketCanonicalStatus[] {
  if (status === "unknown") {
    return [...SUPPORT_TICKET_CANONICAL_STATUSES];
  }

  return [...TRANSITION_MATRIX[status]];
}

export function isAllowedSupportTicketTransition(
  fromStatus: SupportTicketCanonicalStatus,
  toStatus: Exclude<SupportTicketCanonicalStatus, "unknown">
) {
  if (fromStatus === "unknown") {
    return isValidSupportTicketCanonicalStatus(toStatus);
  }

  return getAllowedSupportTicketTransitions(fromStatus).includes(toStatus);
}

export function supportTicketCanonicalStatusLabel(status: SupportTicketCanonicalStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "pending":
      return "Pending";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "unknown":
      return "Unknown";
  }
}

export function supportTicketCanonicalStatusBadgeTone(status: SupportTicketCanonicalStatus) {
  switch (status) {
    case "open":
      return "blue" as const;
    case "in_progress":
      return "amber" as const;
    case "pending":
      return "amber" as const;
    case "resolved":
    case "closed":
      return "green" as const;
    case "unknown":
      return "slate" as const;
  }
}

export function resolveSupportTicketStatusAuthorization(input: {
  internalRole?: string | null;
  role: "internal_team" | "super_admin";
}): SupportTicketStatusAuthorization {
  if (input.role === "super_admin") {
    return {
      canMutateStatus: true,
      reason: "Super Admin may execute explicit ticket status transitions.",
      roleLabel: "super_admin"
    };
  }

  if (input.internalRole === "read_only_auditor") {
    return {
      canMutateStatus: false,
      reason: "Read-only auditor accounts cannot mutate ticket status.",
      roleLabel: input.internalRole
    };
  }

  if (input.internalRole === "support_agent" || input.internalRole === "admin" || input.internalRole === "super_admin") {
    return {
      canMutateStatus: true,
      reason: "Authorized internal support role may execute explicit ticket status transitions.",
      roleLabel: input.internalRole ?? "internal_team"
    };
  }

  return {
    canMutateStatus: false,
    reason: "Current internal team role is read-only for ticket status transitions.",
    roleLabel: input.internalRole ?? "internal_team"
  };
}

export function buildSupportTicketStatusRuntimeItem(input: {
  authorization: SupportTicketStatusAuthorization;
  storageStatus: string;
  ticketId: string;
}): SupportTicketStatusRuntimeItem {
  const registryEntry = getSupportRegistryEntry("sp-ticket-status");
  const canonicalStatus = normalizeStorageStatusToCanonical(input.storageStatus);
  const storageStatus = normalizeStorageStatus(input.storageStatus);
  const canMutateStatus = input.authorization.canMutateStatus && registryEntry?.productionReady !== false;
  const transitionFoundation: SupportTicketStatusTransitionFoundation = canMutateStatus ? "available" : "read_only";

  return {
    allowedTransitions: getAllowedSupportTicketTransitions(canonicalStatus).filter(
      (status) => status !== canonicalStatus
    ),
    canMutateStatus,
    canonicalStatus,
    registryKey: "sp-ticket-status",
    storageStatus,
    ticketId: input.ticketId,
    transitionFoundation,
    transitionNote: canMutateStatus
      ? "Explicit form submission only. No automatic status mutation runs during page load."
      : input.authorization.reason
  };
}

export function getSupportTicketStatusRuntimeSummary(input: {
  authorization: SupportTicketStatusAuthorization;
  loadError?: string | null;
}): SupportTicketStatusRuntimeSummary {
  const transitionFoundation: SupportTicketStatusTransitionFoundation = input.authorization.canMutateStatus
    ? "available"
    : "read_only";
  const status = input.loadError
    ? ("load_error" as const)
    : transitionFoundation === "read_only"
      ? ("needs_attention" as const)
      : ("status_runtime_ready" as const);

  return {
    allowedStatuses: [...SUPPORT_TICKET_CANONICAL_STATUSES],
    loadError: input.loadError ?? null,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    source: SUPPORT_TICKET_STATUS_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${SUPPORT_TICKET_CANONICAL_STATUSES.length} canonical statuses`,
          `transition foundation ${transitionFoundation}`,
          input.authorization.canMutateStatus ? "status mutation authorized" : "status mutation read-only"
        ].join("; "),
    transitionFoundation
  };
}

export async function loadSupportTicketStatusRuntimeReadOnlySafe(params: {
  authorization: SupportTicketStatusAuthorization;
  loadError?: string | null;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  const summary = getSupportTicketStatusRuntimeSummary({
    authorization: params.authorization,
    loadError: params.loadError
  });

  const selectedTicketId = params.selectedTicketId?.trim() || null;

  if (!selectedTicketId || !params.supabase || params.loadError) {
    return {
      selectedTicketStatus: null as SupportTicketStatusRuntimeItem | null,
      ticketStatusRuntime: summary
    };
  }

  const { data, error } = await params.supabase
    .from("support_tickets" as never)
    .select("id, status")
    .eq("id", selectedTicketId)
    .maybeSingle();

  if (error) {
    return {
      selectedTicketStatus: null,
      ticketStatusRuntime: getSupportTicketStatusRuntimeSummary({
        authorization: params.authorization,
        loadError: error.message
      })
    };
  }

  if (!data) {
    return {
      selectedTicketStatus: null,
      ticketStatusRuntime: summary
    };
  }

  const row = data as Record<string, unknown>;

  return {
    selectedTicketStatus: buildSupportTicketStatusRuntimeItem({
      authorization: params.authorization,
      storageStatus: text(row.status),
      ticketId: text(row.id)
    }),
    ticketStatusRuntime: summary
  };
}

export function mapSupportTicketStatusRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportTicketStatusRuntimeReadOnlySafe>>
) {
  return {
    selectedTicketStatus: input.selectedTicketStatus,
    ticketStatusRuntime: input.ticketStatusRuntime
  };
}

export function supportTicketStatusTransitionMessage(code: SupportTicketStatusTransitionResultCode) {
  switch (code) {
    case "success":
      return "Ticket status updated successfully.";
    case "unchanged":
      return "Ticket status was already set to the requested value.";
    case "invalid":
      return "The requested ticket status transition is not valid.";
    case "not_found":
      return "The requested support ticket was not found.";
    case "unauthorized":
      return "You are not authorized to update support ticket status.";
    case "error":
      return "Ticket status could not be updated safely.";
  }
}
