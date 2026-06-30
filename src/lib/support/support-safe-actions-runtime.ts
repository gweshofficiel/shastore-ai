import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportErrorEventRuntimeItem } from "@/src/lib/support/support-error-events-runtime";
import type { SupportMonitoringEventRuntimeItem } from "@/src/lib/support/support-monitoring-events-runtime";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketConversationRuntimeSummary } from "@/src/lib/support/support-ticket-conversation-runtime";
import type { SupportTicketDetailRuntimeItem } from "@/src/lib/support/support-ticket-details-runtime";
import type {
  SupportTicketAssignmentRuntimeItem,
  SupportTicketAssignmentRuntimeSummary
} from "@/src/lib/support/support-ticket-assignment-runtime";
import {
  isAllowedSupportTicketTransition,
  isValidSupportTicketCanonicalStatus,
  normalizeStorageStatusToCanonical,
  type SupportTicketCanonicalStatus,
  type SupportTicketStatusRuntimeItem
} from "@/src/lib/support/support-ticket-status-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import {
  resolveSupportVisibilityAuthorization,
  type SupportRecordVisibilityState,
  type SupportVisibilityRuntimeSummary
} from "@/src/lib/support/support-visibility-runtime";

export type SupportSafeActionsRuntimeSource = "support_safe_actions_runtime";

export type SupportSafeActionKey =
  | "add_conversation_message"
  | "assign_ticket"
  | "link_error_event"
  | "link_monitoring_event"
  | "unassign_ticket"
  | "update_ticket_status";

export type SupportSafeActionAvailability =
  | "disabled"
  | "enabled"
  | "restricted"
  | "unauthorized"
  | "validation_blocked";

export type SupportSafeActionResultCode =
  | "error"
  | "invalid"
  | "not_found"
  | "restricted"
  | "success"
  | "unauthorized"
  | "unchanged"
  | "validation";

export type SupportSafeActionBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type SupportSafeActionsRuntimeState = "needs_attention" | "ready" | "unavailable";

export type SupportSafeActionEntry = {
  actionKey: SupportSafeActionKey;
  availability: SupportSafeActionAvailability;
  badgeTone: SupportSafeActionBadgeTone;
  confirmationPrompt: string | null;
  description: string;
  readOnly: true;
  requiresConfirmation: boolean;
  resultQueryParam: "assignmentResult" | "conversationResult" | "safeActionResult" | "statusResult";
  serverActionImplemented: boolean;
  superAdminOnly: true;
  title: string;
};

export type SupportSafeActionsRuntimeSummary = {
  actionsByKey: Record<SupportSafeActionKey, SupportSafeActionEntry>;
  countsByAvailability: Record<SupportSafeActionAvailability, number>;
  emptyMessage: string | null;
  enabledActionCount: number;
  entries: SupportSafeActionEntry[];
  loadError: string | null;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  selectedTicketId: string | null;
  source: SupportSafeActionsRuntimeSource;
  status: SupportSafeActionsRuntimeState;
  summary: string;
  superAdminOnly: true;
  totalActionCount: number;
  unauthorizedMessage: string | null;
};

export const SUPPORT_SAFE_ACTIONS_RUNTIME_SOURCE = "support_safe_actions_runtime" as const;

export const SUPPORT_SAFE_ACTION_KEYS: readonly SupportSafeActionKey[] = [
  "update_ticket_status",
  "assign_ticket",
  "unassign_ticket",
  "add_conversation_message",
  "link_monitoring_event",
  "link_error_event"
] as const;

const SENSITIVE_ACTION_KEYS = new Set<SupportSafeActionKey>([
  "update_ticket_status",
  "assign_ticket",
  "unassign_ticket"
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyAvailabilityCounts(): Record<SupportSafeActionAvailability, number> {
  return {
    disabled: 0,
    enabled: 0,
    restricted: 0,
    unauthorized: 0,
    validation_blocked: 0
  };
}

export function resolveSupportSafeActionsAuthorization(input: {
  role: "internal_team" | "super_admin";
}) {
  if (input.role === "super_admin") {
    return {
      canExecuteSafeActions: true,
      reason: "Super Admin may execute explicit Support safe actions through form submission only.",
      roleLabel: "super_admin" as const
    };
  }

  return {
    canExecuteSafeActions: false,
    reason: "Support safe actions require Super Admin authorization in SP-15.",
    roleLabel: input.role
  };
}

function classifyTicketRecordVisibility(ticket: SupportTicketRuntimeItem | null | undefined): SupportRecordVisibilityState {
  if (!ticket?.ticketId || !ticket.tableDetected) {
    return ticket ? "restricted" : "hidden";
  }

  return "visible";
}

function classifyTicketDetailVisibility(
  ticketDetail: SupportTicketDetailRuntimeItem | null | undefined
): SupportRecordVisibilityState {
  if (!ticketDetail) {
    return "hidden";
  }

  if (!ticketDetail.tableDetected) {
    return "restricted";
  }

  return "visible";
}

function classifyMonitoringEventVisibility(
  event: SupportMonitoringEventRuntimeItem | null | undefined
): SupportRecordVisibilityState {
  if (!event?.eventId || !event.tableDetected) {
    return event ? "restricted" : "hidden";
  }

  return "visible";
}

function classifyErrorEventVisibility(
  event: SupportErrorEventRuntimeItem | null | undefined
): SupportRecordVisibilityState {
  if (!event?.errorId || !event.tableDetected) {
    return event ? "restricted" : "hidden";
  }

  return "visible";
}

function supportSafeActionBadgeTone(availability: SupportSafeActionAvailability): SupportSafeActionBadgeTone {
  switch (availability) {
    case "enabled":
      return "green";
    case "disabled":
      return "slate";
    case "restricted":
      return "amber";
    case "unauthorized":
      return "red";
    case "validation_blocked":
      return "amber";
  }
}

function supportSafeActionDescription(
  actionKey: SupportSafeActionKey,
  availability: SupportSafeActionAvailability
): string {
  const base: Record<SupportSafeActionKey, string> = {
    add_conversation_message:
      "Add a Super Admin conversation message through explicit form submission. No message is sent on page load.",
    assign_ticket:
      "Assign the selected ticket to an eligible support agent. Requires explicit Super Admin confirmation.",
    link_error_event:
      "Link a ticket to an error event. Reserved until an explicit link action is certified in a later phase.",
    link_monitoring_event:
      "Link a ticket to a monitoring event. Reserved until an explicit link action is certified in a later phase.",
    unassign_ticket:
      "Remove the current ticket assignment. Requires explicit Super Admin confirmation.",
    update_ticket_status:
      "Transition ticket status through validated canonical states. Requires explicit Super Admin confirmation."
  };

  switch (availability) {
    case "enabled":
      return `${base[actionKey]} Available for explicit click only.`;
    case "disabled":
      return `${base[actionKey]} Currently disabled by runtime guards.`;
    case "restricted":
      return `${base[actionKey]} Target record is restricted under SP-14 visibility rules.`;
    case "unauthorized":
      return `${base[actionKey]} Super Admin authorization is required.`;
    case "validation_blocked":
      return `${base[actionKey]} Payload or transition validation blocked this action.`;
  }
}

function supportSafeActionTitle(actionKey: SupportSafeActionKey): string {
  switch (actionKey) {
    case "update_ticket_status":
      return "Update ticket status";
    case "assign_ticket":
      return "Assign ticket";
    case "unassign_ticket":
      return "Unassign ticket";
    case "add_conversation_message":
      return "Add conversation message";
    case "link_monitoring_event":
      return "Link monitoring event";
    case "link_error_event":
      return "Link error event";
  }
}

function supportSafeActionResultParam(
  actionKey: SupportSafeActionKey
): SupportSafeActionEntry["resultQueryParam"] {
  switch (actionKey) {
    case "update_ticket_status":
      return "statusResult";
    case "assign_ticket":
    case "unassign_ticket":
      return "assignmentResult";
    case "add_conversation_message":
      return "conversationResult";
    case "link_monitoring_event":
    case "link_error_event":
      return "safeActionResult";
  }
}

function resolveUpdateTicketStatusAvailability(input: {
  authorization: ReturnType<typeof resolveSupportSafeActionsAuthorization>;
  selectedTicketId: string | null;
  selectedTicketStatus: SupportTicketStatusRuntimeItem | null;
  ticketDetailVisibility: SupportRecordVisibilityState;
  ticketVisibility: SupportRecordVisibilityState;
}): SupportSafeActionAvailability {
  if (!input.authorization.canExecuteSafeActions) {
    return "unauthorized";
  }

  if (!input.selectedTicketId) {
    return "disabled";
  }

  if (input.ticketVisibility === "restricted" || input.ticketDetailVisibility === "restricted") {
    return "restricted";
  }

  if (input.ticketVisibility === "hidden" || input.ticketDetailVisibility === "hidden") {
    return "restricted";
  }

  if (!input.selectedTicketStatus?.canMutateStatus) {
    return "validation_blocked";
  }

  if (!input.selectedTicketStatus.allowedTransitions.length) {
    return "disabled";
  }

  return "enabled";
}

function resolveAssignTicketAvailability(input: {
  assignmentRuntime: SupportTicketAssignmentRuntimeSummary;
  authorization: ReturnType<typeof resolveSupportSafeActionsAuthorization>;
  eligibleAgentCount: number;
  selectedTicketAssignment: SupportTicketAssignmentRuntimeItem | null;
  selectedTicketId: string | null;
  ticketDetailVisibility: SupportRecordVisibilityState;
  ticketVisibility: SupportRecordVisibilityState;
}): SupportSafeActionAvailability {
  if (!input.authorization.canExecuteSafeActions) {
    return "unauthorized";
  }

  if (!input.selectedTicketId) {
    return "disabled";
  }

  if (input.ticketVisibility === "restricted" || input.ticketDetailVisibility === "restricted") {
    return "restricted";
  }

  if (input.ticketVisibility === "hidden" || input.ticketDetailVisibility === "hidden") {
    return "restricted";
  }

  if (!input.selectedTicketAssignment?.canMutateAssignment) {
    return "validation_blocked";
  }

  if (!input.eligibleAgentCount || input.assignmentRuntime.transitionFoundation !== "available") {
    return "disabled";
  }

  return "enabled";
}

function resolveUnassignTicketAvailability(input: {
  authorization: ReturnType<typeof resolveSupportSafeActionsAuthorization>;
  selectedTicketAssignment: SupportTicketAssignmentRuntimeItem | null;
  selectedTicketId: string | null;
  ticketDetailVisibility: SupportRecordVisibilityState;
  ticketVisibility: SupportRecordVisibilityState;
}): SupportSafeActionAvailability {
  const assignAvailability = resolveAssignTicketAvailability({
    assignmentRuntime: { transitionFoundation: "available" } as SupportTicketAssignmentRuntimeSummary,
    authorization: input.authorization,
    eligibleAgentCount: 1,
    selectedTicketAssignment: input.selectedTicketAssignment,
    selectedTicketId: input.selectedTicketId,
    ticketDetailVisibility: input.ticketDetailVisibility,
    ticketVisibility: input.ticketVisibility
  });

  if (assignAvailability !== "enabled") {
    return assignAvailability;
  }

  if (!input.selectedTicketAssignment?.assignedAgentId) {
    return "disabled";
  }

  return "enabled";
}

function resolveConversationAvailability(input: {
  authorization: ReturnType<typeof resolveSupportSafeActionsAuthorization>;
  conversationRuntime: SupportTicketConversationRuntimeSummary;
  selectedTicketId: string | null;
  ticketDetailVisibility: SupportRecordVisibilityState;
  ticketVisibility: SupportRecordVisibilityState;
}): SupportSafeActionAvailability {
  if (!input.authorization.canExecuteSafeActions) {
    return "unauthorized";
  }

  if (!input.selectedTicketId) {
    return "disabled";
  }

  if (input.ticketVisibility === "restricted" || input.ticketDetailVisibility === "restricted") {
    return "restricted";
  }

  if (input.ticketVisibility === "hidden" || input.ticketDetailVisibility === "hidden") {
    return "restricted";
  }

  if (!input.conversationRuntime.canCreateMessage) {
    return "validation_blocked";
  }

  return "enabled";
}

function resolveLinkActionAvailability(input: {
  authorization: ReturnType<typeof resolveSupportSafeActionsAuthorization>;
}): SupportSafeActionAvailability {
  if (!input.authorization.canExecuteSafeActions) {
    return "unauthorized";
  }

  return "disabled";
}

function buildSafeActionEntry(
  actionKey: SupportSafeActionKey,
  availability: SupportSafeActionAvailability,
  requiresConfirmationOverride?: boolean
): SupportSafeActionEntry {
  const requiresConfirmation =
    requiresConfirmationOverride ?? (SENSITIVE_ACTION_KEYS.has(actionKey) && availability === "enabled");
  const serverActionImplemented =
    actionKey !== "link_monitoring_event" && actionKey !== "link_error_event";

  return {
    actionKey,
    availability,
    badgeTone: supportSafeActionBadgeTone(availability),
    confirmationPrompt: requiresConfirmation
      ? `Confirm ${supportSafeActionTitle(actionKey).toLowerCase()} for this ticket.`
      : null,
    description: supportSafeActionDescription(actionKey, availability),
    readOnly: true,
    requiresConfirmation,
    resultQueryParam: supportSafeActionResultParam(actionKey),
    serverActionImplemented,
    superAdminOnly: true,
    title: supportSafeActionTitle(actionKey)
  };
}

export function buildSupportSafeActionsRuntime(input: {
  assignmentRuntime: SupportTicketAssignmentRuntimeSummary;
  conversationRuntime: SupportTicketConversationRuntimeSummary;
  eligibleAgentCount: number;
  loadError?: string | null;
  role: "internal_team" | "super_admin";
  selectedTicketAssignment: SupportTicketAssignmentRuntimeItem | null;
  selectedTicketId: string | null;
  selectedTicketStatus: SupportTicketStatusRuntimeItem | null;
  ticketDetail: SupportTicketDetailRuntimeItem | null;
  ticketsTableDetected: boolean;
  visibleTicketDetail: SupportTicketDetailRuntimeItem | null;
  visibleTickets: SupportTicketRuntimeItem[];
  visibilityRuntime: Pick<SupportVisibilityRuntimeSummary, "status">;
}): SupportSafeActionsRuntimeSummary {
  const authorization = resolveSupportSafeActionsAuthorization({ role: input.role });
  const registryEntry = getSupportRegistryEntry("sp-safe-actions");
  const selectedTicket =
    input.visibleTickets.find((ticket) => ticket.ticketId === input.selectedTicketId) ?? null;
  const ticketVisibility = input.ticketsTableDetected
    ? classifyTicketRecordVisibility(selectedTicket)
    : ("restricted" as const);
  const ticketDetailVisibility = classifyTicketDetailVisibility(input.visibleTicketDetail);

  const availabilityByKey: Record<SupportSafeActionKey, SupportSafeActionAvailability> = {
    add_conversation_message: resolveConversationAvailability({
      authorization,
      conversationRuntime: input.conversationRuntime,
      selectedTicketId: input.selectedTicketId,
      ticketDetailVisibility,
      ticketVisibility
    }),
    assign_ticket: resolveAssignTicketAvailability({
      assignmentRuntime: input.assignmentRuntime,
      authorization,
      eligibleAgentCount: input.eligibleAgentCount,
      selectedTicketAssignment: input.selectedTicketAssignment,
      selectedTicketId: input.selectedTicketId,
      ticketDetailVisibility,
      ticketVisibility
    }),
    link_error_event: resolveLinkActionAvailability({ authorization }),
    link_monitoring_event: resolveLinkActionAvailability({ authorization }),
    unassign_ticket: resolveUnassignTicketAvailability({
      authorization,
      selectedTicketAssignment: input.selectedTicketAssignment,
      selectedTicketId: input.selectedTicketId,
      ticketDetailVisibility,
      ticketVisibility
    }),
    update_ticket_status: resolveUpdateTicketStatusAvailability({
      authorization,
      selectedTicketId: input.selectedTicketId,
      selectedTicketStatus: input.selectedTicketStatus,
      ticketDetailVisibility,
      ticketVisibility
    })
  };

  if (!registryEntry?.productionReady) {
    for (const actionKey of SUPPORT_SAFE_ACTION_KEYS) {
      if (availabilityByKey[actionKey] === "enabled") {
        availabilityByKey[actionKey] = "disabled";
      }
    }
  }

  if (input.visibilityRuntime.status === "unauthorized") {
    for (const actionKey of SUPPORT_SAFE_ACTION_KEYS) {
      availabilityByKey[actionKey] = "unauthorized";
    }
  }

  const entries = SUPPORT_SAFE_ACTION_KEYS.map((actionKey) =>
    buildSafeActionEntry(actionKey, availabilityByKey[actionKey])
  );
  const countsByAvailability = emptyAvailabilityCounts();

  for (const entry of entries) {
    countsByAvailability[entry.availability] += 1;
  }

  const enabledActionCount = countsByAvailability.enabled;
  const loadError = input.loadError ?? null;
  const status: SupportSafeActionsRuntimeState = loadError
    ? "needs_attention"
    : authorization.canExecuteSafeActions
      ? enabledActionCount > 0
        ? "ready"
        : "needs_attention"
      : "unavailable";

  return {
    actionsByKey: Object.fromEntries(entries.map((entry) => [entry.actionKey, entry])) as Record<
      SupportSafeActionKey,
      SupportSafeActionEntry
    >,
    countsByAvailability,
    emptyMessage:
      authorization.canExecuteSafeActions && enabledActionCount === 0
        ? "No Support safe actions are enabled for the current ticket and visibility context."
        : null,
    enabledActionCount,
    entries,
    loadError,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    selectedTicketId: input.selectedTicketId,
    source: SUPPORT_SAFE_ACTIONS_RUNTIME_SOURCE,
    status,
    summary: loadError
      ? `status needs_attention; ${loadError}`
      : [
          `status ${status}`,
          `${enabledActionCount}/${SUPPORT_SAFE_ACTION_KEYS.length} enabled`,
          authorization.canExecuteSafeActions ? "super_admin authorized" : authorization.reason
        ].join("; "),
    superAdminOnly: true,
    totalActionCount: SUPPORT_SAFE_ACTION_KEYS.length,
    unauthorizedMessage: authorization.canExecuteSafeActions
      ? null
      : "Support safe actions are Super Admin only. No action executes during page load."
  };
}

export function mapSupportSafeActionsRuntimeToAdminFields(
  input: ReturnType<typeof buildSupportSafeActionsRuntime>
) {
  return {
    supportSafeActionsRuntime: input
  };
}

export function supportSafeActionsRuntimeStatusBadgeTone(
  status: SupportSafeActionsRuntimeState
): SupportSafeActionBadgeTone {
  switch (status) {
    case "ready":
      return "green";
    case "needs_attention":
      return "amber";
    case "unavailable":
      return "red";
  }
}

export function supportSafeActionAvailabilityLabel(availability: SupportSafeActionAvailability): string {
  return availability.replace(/_/g, " ");
}

export function supportSafeActionResultMessage(code: SupportSafeActionResultCode): string {
  switch (code) {
    case "success":
      return "Support safe action completed successfully.";
    case "unchanged":
      return "Support safe action completed without changes because the target was already in the requested state.";
    case "invalid":
      return "The Support safe action payload or transition was invalid.";
    case "validation":
      return "Support safe action confirmation or payload validation failed.";
    case "not_found":
      return "The requested Support record was not found.";
    case "restricted":
      return "The requested Support record is restricted under SP-14 visibility rules.";
    case "unauthorized":
      return "Only Super Admin accounts may execute Support safe actions in SP-15.";
    case "error":
      return "The Support safe action could not be completed safely.";
  }
}

export function supportSafeActionResultBadgeTone(code: SupportSafeActionResultCode): SupportSafeActionBadgeTone {
  switch (code) {
    case "success":
    case "unchanged":
      return "green";
    case "invalid":
    case "validation":
      return "amber";
    case "unauthorized":
    case "restricted":
    case "not_found":
    case "error":
      return "red";
  }
}

export function isSensitiveSupportSafeAction(actionKey: SupportSafeActionKey): boolean {
  return SENSITIVE_ACTION_KEYS.has(actionKey);
}

export function requiresSupportSafeActionConfirmation(input: {
  actionKey: SupportSafeActionKey;
  nextStatus?: string | null;
}): boolean {
  return SENSITIVE_ACTION_KEYS.has(input.actionKey);
}

export function isSupportSafeActionConfirmed(formData: FormData): boolean {
  return cleanSafeActionText(formData.get("confirmAction"), 10) === "true";
}

export function cleanSafeActionText(value: FormDataEntryValue | null, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isValidSupportSafeActionUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

export type SupportSafeActionValidationContext = {
  actionKey: SupportSafeActionKey;
  assignedUserId?: string | null;
  eventId?: string | null;
  messageBody?: string | null;
  nextStatus?: string | null;
  ticketId: string | null;
  unassign?: boolean;
  visibility?: string | null;
};

export type SupportSafeActionValidationResult =
  | { access: Awaited<ReturnType<typeof getAdminAccess>>; ok: true }
  | { access: Awaited<ReturnType<typeof getAdminAccess>>; code: SupportSafeActionResultCode; ok: false };

export async function validateSupportSafeActionRequest(
  context: SupportSafeActionValidationContext
): Promise<SupportSafeActionValidationResult> {
  const access = await getAdminAccess();

  if (access.role !== "super_admin") {
    return { access, code: "unauthorized", ok: false };
  }

  if (!isValidSupportSafeActionUuid(context.ticketId)) {
    return { access, code: "invalid", ok: false };
  }

  const visibilityAuthorization = resolveSupportVisibilityAuthorization({ role: access.role });

  if (!visibilityAuthorization.canViewSupportData) {
    return { access, code: "restricted", ok: false };
  }

  return { access, ok: true };
}

export async function validateSupportTicketExistsForSafeAction(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  ticketId: string
): Promise<
  | { ok: false; code: SupportSafeActionResultCode }
  | { ok: true; ticket: Record<string, unknown> }
> {
  const { data: ticket, error } = await admin
    .from("support_tickets" as never)
    .select("id, workspace_id, store_id, user_id, ticket_number, status, assigned_user_id, event_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    return { code: "error", ok: false };
  }

  if (!ticket) {
    return { code: "not_found", ok: false };
  }

  const ticketRow = ticket as Record<string, unknown>;

  if (!ticketRow.id || !ticketRow.workspace_id) {
    return { code: "restricted", ok: false };
  }

  return { ok: true, ticket: ticketRow };
}

export function validateSupportStatusSafeActionPayload(input: {
  nextStatus: string;
  ticketStatus: string;
}): SupportSafeActionResultCode | null {
  if (!isValidSupportTicketCanonicalStatus(input.nextStatus)) {
    return "invalid";
  }

  const currentCanonical = normalizeStorageStatusToCanonical(input.ticketStatus);
  const targetCanonical = input.nextStatus as Exclude<SupportTicketCanonicalStatus, "unknown">;

  if (!isAllowedSupportTicketTransition(currentCanonical, targetCanonical)) {
    return "invalid";
  }

  return null;
}

export function validateSupportConversationSafeActionPayload(input: {
  messageBody: string;
  visibility: string;
}): SupportSafeActionResultCode | null {
  if (!input.messageBody.trim()) {
    return "validation";
  }

  if (!new Set(["internal", "super_admin"]).has(input.visibility)) {
    return "invalid";
  }

  return null;
}

export async function recordSupportSafeActionAttempt(input: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  actionKey: SupportSafeActionKey;
  entityId: string;
  eventStatus: "failed" | "success";
  metadata?: Record<string, unknown>;
  resultCode: SupportSafeActionResultCode;
  storeId?: string | null;
  workspaceId?: string | null;
}) {
  await recordMonitoringEventSafe({
    entityId: input.entityId,
    entityType: "support_ticket",
    eventStatus: input.eventStatus,
    eventType: "support_safe_action_attempt",
    metadata: {
      action: `support.safe_action.${input.actionKey}`,
      actorRole: "super_admin",
      resultCode: input.resultCode,
      route: "/admin/support",
      source: SUPPORT_SAFE_ACTIONS_RUNTIME_SOURCE,
      ...sanitizeSafeActionAuditMetadata(input.metadata ?? {})
    },
    storeId: input.storeId ?? null,
    userId: input.access.user.id,
    workspaceId: input.workspaceId ?? null
  });
}

function sanitizeSafeActionAuditMetadata(metadata: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (/secret|token|password|credential|metadata|payload|snapshot/i.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      safe[key] = value.slice(0, 240);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }

  return safe;
}

export function mapLegacyResultToSupportSafeActionResult(
  actionKey: SupportSafeActionKey,
  legacyCode: string
): SupportSafeActionResultCode {
  if (legacyCode === "success" || legacyCode === "unchanged") {
    return legacyCode;
  }

  if (legacyCode === "invalid" || legacyCode === "not_found" || legacyCode === "unauthorized" || legacyCode === "error") {
    return legacyCode;
  }

  return "error";
}

export function getSupportSafeActionEntry(
  runtime: Pick<SupportSafeActionsRuntimeSummary, "actionsByKey">,
  actionKey: SupportSafeActionKey
): SupportSafeActionEntry {
  return (
    runtime.actionsByKey[actionKey] ??
    buildSafeActionEntry(actionKey, "disabled")
  );
}

export function isMonitoringEventVisibleForSafeAction(
  event: SupportMonitoringEventRuntimeItem | null | undefined
): boolean {
  return classifyMonitoringEventVisibility(event) === "visible";
}

export function isErrorEventVisibleForSafeAction(
  event: SupportErrorEventRuntimeItem | null | undefined
): boolean {
  return classifyErrorEventVisibility(event) === "visible";
}
