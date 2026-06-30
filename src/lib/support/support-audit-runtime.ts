import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";
import type { SupportTicketRuntimeItem } from "@/src/lib/support/support-tickets-runtime";
import {
  resolveSupportVisibilityAuthorization,
  type SupportRecordVisibilityState,
  type SupportVisibilityAuthorization
} from "@/src/lib/support/support-visibility-runtime";

export type SupportAuditRuntimeSource = "support_audit_runtime";

export type SupportAuditActionType =
  | "error_event_link"
  | "monitoring_event_link"
  | "safe_action_attempt"
  | "ticket_assignment_change"
  | "ticket_conversation_message_create"
  | "ticket_status_change"
  | "ticket_unassignment_change"
  | "ticket_visibility_change";

export type SupportAuditGroupKey = "support-action-audit" | "support-governance-audit";

export type SupportAuditLoadingState = "empty" | "error" | "loaded" | "restricted" | "unauthorized";

export type SupportAuditSafeControlKey = "export" | "inspect";

export type SupportAuditSafeControl = {
  enabled: false;
  key: SupportAuditSafeControlKey;
  label: string;
  note: string;
};

export type SupportAuditRuntimeItem = {
  actionType: SupportAuditActionType;
  actionTypeLabel: string;
  actorReference: string;
  actorRole: string;
  auditId: string;
  auditItemKey: string;
  createdAt: string;
  groupKey: SupportAuditGroupKey;
  metadataSummary: string;
  registryKey: "sp-audit";
  relatedTicketId: string | null;
  relatedTicketNumber: string | null;
  resultStatus: string;
  safeSummary: string;
  targetRecordId: string;
  targetRecordType: string;
  visibilityState: SupportRecordVisibilityState;
};

export type SupportAuditRuntimeGroup = {
  groupKey: SupportAuditGroupKey;
  itemCount: number;
  items: SupportAuditRuntimeItem[];
  title: string;
};

export type SupportAuditRuntimeSummary = {
  actionTypeCounts: Array<{ actionType: SupportAuditActionType; count: number; label: string }>;
  emptyMessage: string | null;
  groupCount: number;
  hiddenRecordCount: number;
  loadError: string | null;
  loadingState: SupportAuditLoadingState;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  restrictedMessage: string | null;
  restrictedRecordCount: number;
  source: SupportAuditRuntimeSource;
  status: "audit_empty" | "audit_runtime_ready" | "load_error" | "needs_attention" | "unauthorized";
  summary: string;
  tableDetected: boolean;
  totalRecords: number;
  unauthorizedMessage: string | null;
  visibleRecordCount: number;
};

export type SupportAuditAuthorization = {
  canViewAudit: boolean;
  reason: string;
  roleLabel: string;
};

type AnyRecord = Record<string, unknown>;

type TicketLookup = Map<string, { ticketId: string; ticketNumber: string }>;

export const SUPPORT_AUDIT_RUNTIME_SOURCE = "support_audit_runtime" as const;

export const SUPPORT_AUDIT_SAFE_CONTROLS: readonly SupportAuditSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No audit inspect action runs during SP-16 page load."
  },
  {
    enabled: false,
    key: "export",
    label: "Export",
    note: "Read-only placeholder. No audit export action runs during SP-16 page load."
  }
] as const;

const AUDIT_COLUMNS =
  "id, workspace_id, store_id, user_id, entity_id, entity_type, event_type, event_status, metadata, created_at";

const TICKET_LOOKUP_COLUMNS = "id, ticket_number";

const SUPPORT_AUDIT_EVENT_TYPES = [
  "support_ticket_status_changed",
  "support_ticket_assigned",
  "support_ticket_unassigned",
  "support_ticket_message_created",
  "support_safe_action_attempt",
  "support_ticket_created"
] as const;

const AUDIT_GROUP_DEFINITIONS: ReadonlyArray<{ groupKey: SupportAuditGroupKey; title: string }> = [
  { groupKey: "support-action-audit", title: "Support Action Audit" },
  { groupKey: "support-governance-audit", title: "Support Governance Audit" }
] as const;

const SECRET_KEY_PATTERN =
  /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|service[_-]?role|snapshot|stack|payload|email|smtp|webhook)/i;

const SAFE_METADATA_KEYS = new Set([
  "action",
  "actorRole",
  "assignedUserId",
  "canonicalStatus",
  "messageLength",
  "nextStatus",
  "outcome",
  "previousCanonicalStatus",
  "resultCode",
  "route",
  "source",
  "sourceEventId",
  "storageStatus",
  "ticketNumber",
  "visibility"
]);

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function maskReference(value: unknown, prefix: string) {
  const raw = text(value, 80);

  if (!raw) {
    return `${prefix}:unknown`;
  }

  if (raw.length <= 8) {
    return `${prefix}:${raw.slice(0, 2)}***`;
  }

  return `${prefix}:${raw.slice(0, 8)}...`;
}

function buildSafeControls() {
  return SUPPORT_AUDIT_SAFE_CONTROLS.map((control) => ({ ...control }));
}

export function resolveSupportAuditAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportAuditAuthorization {
  if (input.role === "super_admin") {
    return {
      canViewAudit: true,
      reason: "Super Admin may view Support audit records through read-only runtime queries.",
      roleLabel: "super_admin"
    };
  }

  return {
    canViewAudit: false,
    reason: "Support audit is restricted to Super Admin in SP-16.",
    roleLabel: input.role
  };
}

export function supportAuditActionTypeLabel(actionType: SupportAuditActionType): string {
  switch (actionType) {
    case "ticket_status_change":
      return "Ticket status change";
    case "ticket_assignment_change":
      return "Ticket assignment change";
    case "ticket_unassignment_change":
      return "Ticket unassignment change";
    case "ticket_conversation_message_create":
      return "Conversation message created";
    case "safe_action_attempt":
      return "Safe action attempt";
    case "monitoring_event_link":
      return "Monitoring event link";
    case "error_event_link":
      return "Error event link";
    case "ticket_visibility_change":
      return "Ticket visibility change";
  }
}

function classifyAuditActionType(eventType: string, metadata: AnyRecord): SupportAuditActionType | null {
  switch (eventType) {
    case "support_ticket_status_changed":
      return "ticket_status_change";
    case "support_ticket_assigned":
      return "ticket_assignment_change";
    case "support_ticket_unassigned":
      return "ticket_unassignment_change";
    case "support_ticket_message_created":
      return "ticket_conversation_message_create";
    case "support_safe_action_attempt":
      return "safe_action_attempt";
    case "support_ticket_created": {
      const action = text(metadata.action, 120);
      const sourceEventId = text(metadata.sourceEventId, 80);
      const source = text(metadata.source, 80).toLowerCase();

      if (sourceEventId && (action.includes("create") || source.includes("monitoring"))) {
        if (source.includes("error") || action.includes("error")) {
          return "error_event_link";
        }

        return "monitoring_event_link";
      }

      return null;
    }
    default:
      if (eventType.includes("visibility")) {
        return "ticket_visibility_change";
      }

      return null;
  }
}

function resolveAuditGroupKey(actionType: SupportAuditActionType): SupportAuditGroupKey {
  if (
    actionType === "safe_action_attempt" ||
    actionType === "ticket_visibility_change" ||
    actionType === "monitoring_event_link" ||
    actionType === "error_event_link"
  ) {
    return "support-governance-audit";
  }

  return "support-action-audit";
}

export function sanitizeSupportAuditMetadataSummary(metadata: unknown): string {
  if (!isRecord(metadata)) {
    return "No safe metadata recorded.";
  }

  const safeEntries: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || SECRET_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      if (SECRET_KEY_PATTERN.test(value)) {
        continue;
      }

      safeEntries.push(`${key}=${text(value, 80)}`);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      safeEntries.push(`${key}=${String(value)}`);
    }
  }

  return safeEntries.length ? safeEntries.join(" · ") : "No safe metadata recorded.";
}

function resolveActorRole(metadata: AnyRecord, eventType: string) {
  const actorRole = text(metadata.actorRole, 40);

  if (actorRole) {
    return actorRole;
  }

  if (eventType === "support_safe_action_attempt") {
    return "super_admin";
  }

  return "unknown";
}

function resolveTargetRecord(row: AnyRecord) {
  const entityType = text(row.entity_type, 80) || "unknown";
  const entityId = text(row.entity_id, 80) || text(row.id, 80) || "unknown";

  return {
    targetRecordId: entityId,
    targetRecordType: entityType
  };
}

function resolveRelatedTicket(
  row: AnyRecord,
  ticketLookup: TicketLookup
): { relatedTicketId: string | null; relatedTicketNumber: string | null } {
  const entityType = text(row.entity_type, 80).toLowerCase();
  const entityId = text(row.entity_id, 80);

  if (entityType === "support_ticket" && entityId) {
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

function buildAuditRuntimeItem(
  row: AnyRecord,
  input: { ticketLookup: TicketLookup }
): SupportAuditRuntimeItem | null {
  const eventType = text(row.event_type, 120);
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const actionType = classifyAuditActionType(eventType, metadata);

  if (!actionType) {
    return null;
  }

  const auditId = text(row.id, 80);

  if (!auditId) {
    return null;
  }

  const { targetRecordId, targetRecordType } = resolveTargetRecord(row);
  const relatedTicket = resolveRelatedTicket(row, input.ticketLookup);
  const actorReference = maskReference(row.user_id, "user");
  const actorRole = resolveActorRole(metadata, eventType);
  const resultStatus = text(row.event_status, 40) || "recorded";
  const createdAt = text(row.created_at, 80);
  const metadataSummary = sanitizeSupportAuditMetadataSummary(metadata);
  const actionTypeLabel = supportAuditActionTypeLabel(actionType);
  const groupKey = resolveAuditGroupKey(actionType);

  return {
    actionType,
    actionTypeLabel,
    actorReference,
    actorRole,
    auditId,
    auditItemKey: `support-audit-${auditId}`,
    createdAt,
    groupKey,
    metadataSummary,
    registryKey: "sp-audit",
    relatedTicketId: relatedTicket.relatedTicketId,
    relatedTicketNumber: relatedTicket.relatedTicketNumber,
    resultStatus,
    safeSummary: [
      actionTypeLabel,
      `result ${resultStatus}`,
      `target ${targetRecordType}`,
      relatedTicket.relatedTicketNumber ? `ticket ${relatedTicket.relatedTicketNumber}` : "ticket n/a",
      `actor ${actorRole}`,
      metadataSummary
    ].join("; "),
    targetRecordId,
    targetRecordType,
    visibilityState: "visible"
  };
}

function buildTicketLookup(rows: AnyRecord[]): TicketLookup {
  const lookup: TicketLookup = new Map();

  for (const row of rows) {
    const ticketId = text(row.id, 80);

    if (!ticketId) {
      continue;
    }

    lookup.set(ticketId, {
      ticketId,
      ticketNumber: text(row.ticket_number, 80) || ticketId
    });
  }

  return lookup;
}

export function buildSupportAuditRuntimeGroups(items: SupportAuditRuntimeItem[]): SupportAuditRuntimeGroup[] {
  return AUDIT_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  });
}

function buildActionTypeCounts(items: SupportAuditRuntimeItem[]) {
  const counts = new Map<SupportAuditActionType, number>();

  for (const item of items) {
    counts.set(item.actionType, (counts.get(item.actionType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([actionType, count]) => ({
      actionType,
      count,
      label: supportAuditActionTypeLabel(actionType)
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function classifySupportAuditRecordVisibility(input: {
  authorization: SupportVisibilityAuthorization;
  item: SupportAuditRuntimeItem;
  visibleTicketIds: Set<string>;
}): SupportRecordVisibilityState {
  if (!input.authorization.canViewSupportData) {
    return "hidden";
  }

  if (!input.item.auditId || !input.item.actionType) {
    return "restricted";
  }

  if (input.item.relatedTicketId && !input.visibleTicketIds.has(input.item.relatedTicketId)) {
    return "restricted";
  }

  return "visible";
}

export function applySupportAuditVisibility(input: {
  auditItems: SupportAuditRuntimeItem[];
  authorization: SupportVisibilityAuthorization;
  visibleTickets: SupportTicketRuntimeItem[];
}): {
  hiddenRecordCount: number;
  restrictedRecordCount: number;
  visibleAuditItems: SupportAuditRuntimeItem[];
} {
  const visibleTicketIds = new Set(
    input.visibleTickets.map((ticket) => ticket.ticketId).filter(Boolean)
  );
  const visibleAuditItems: SupportAuditRuntimeItem[] = [];
  let hiddenRecordCount = 0;
  let restrictedRecordCount = 0;

  for (const item of input.auditItems) {
    const visibilityState = classifySupportAuditRecordVisibility({
      authorization: input.authorization,
      item,
      visibleTicketIds
    });
    const nextItem = { ...item, visibilityState };

    if (visibilityState === "visible") {
      visibleAuditItems.push(nextItem);
      continue;
    }

    if (visibilityState === "restricted") {
      restrictedRecordCount += 1;
      continue;
    }

    hiddenRecordCount += 1;
  }

  return {
    hiddenRecordCount,
    restrictedRecordCount,
    visibleAuditItems
  };
}

export function getSupportAuditRuntimeSummary(
  items: SupportAuditRuntimeItem[],
  input: {
    authorization: SupportAuditAuthorization;
    hiddenRecordCount: number;
    loadError: string | null;
    loadingState: SupportAuditLoadingState;
    restrictedRecordCount: number;
    tableDetected: boolean;
    visibilityAuthorization: SupportVisibilityAuthorization;
  }
): SupportAuditRuntimeSummary {
  const registryEntry = getSupportRegistryEntry("sp-audit");
  const visibleRecordCount = items.length;
  const status = input.loadError
    ? ("load_error" as const)
    : !input.authorization.canViewAudit || !input.visibilityAuthorization.canViewSupportData
      ? ("unauthorized" as const)
      : !input.tableDetected
        ? ("needs_attention" as const)
        : visibleRecordCount === 0
          ? ("audit_empty" as const)
          : ("audit_runtime_ready" as const);

  return {
    actionTypeCounts: buildActionTypeCounts(items),
    emptyMessage:
      status === "audit_empty"
        ? "No Support audit records match the current visibility scope. Audit entries appear after explicit authorized actions."
        : null,
    groupCount: buildSupportAuditRuntimeGroups(items).length,
    hiddenRecordCount: input.hiddenRecordCount,
    loadError: input.loadError,
    loadingState: input.loadingState,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    restrictedMessage:
      input.restrictedRecordCount > 0
        ? `${input.restrictedRecordCount} audit record(s) are restricted under SP-14 visibility rules.`
        : null,
    restrictedRecordCount: input.restrictedRecordCount,
    source: SUPPORT_AUDIT_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : !input.authorization.canViewAudit
        ? `status unauthorized; ${input.authorization.reason}`
        : [
            `status ${status}`,
            `${visibleRecordCount} visible audit records`,
            `${input.restrictedRecordCount} restricted`,
            registryEntry?.productionReady ? "registry production_ready" : "registry pending"
          ].join("; "),
    tableDetected: input.tableDetected,
    totalRecords: visibleRecordCount + input.restrictedRecordCount + input.hiddenRecordCount,
    unauthorizedMessage:
      status === "unauthorized"
        ? "Support audit is Super Admin only. Records are not shown for the current account."
        : null,
    visibleRecordCount
  };
}

export function supportAuditRuntimeStatusBadgeTone(
  status: SupportAuditRuntimeSummary["status"]
): "amber" | "green" | "red" | "slate" {
  switch (status) {
    case "audit_runtime_ready":
      return "green";
    case "audit_empty":
      return "slate";
    case "needs_attention":
      return "amber";
    case "unauthorized":
      return "red";
    case "load_error":
      return "amber";
  }
}

export function supportAuditResultStatusBadgeTone(resultStatus: string): "amber" | "green" | "red" | "slate" {
  const normalized = resultStatus.toLowerCase();

  if (normalized === "success" || normalized === "unchanged") {
    return "green";
  }

  if (normalized === "failed" || normalized === "error" || normalized === "unauthorized") {
    return "red";
  }

  if (normalized === "restricted" || normalized === "validation" || normalized === "invalid") {
    return "amber";
  }

  return "slate";
}

export async function loadSupportAuditRuntimeReadOnlySafe(params: {
  authorization: SupportAuditAuthorization;
  loadError?: string | null;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
  visibilityAuthorization: SupportVisibilityAuthorization;
  visibleTickets: SupportTicketRuntimeItem[];
}) {
  const emptySummary = getSupportAuditRuntimeSummary([], {
    authorization: params.authorization,
    hiddenRecordCount: 0,
    loadError: null,
    loadingState: "unauthorized",
    restrictedRecordCount: 0,
    tableDetected: false,
    visibilityAuthorization: params.visibilityAuthorization
  });

  if (!params.authorization.canViewAudit || !params.visibilityAuthorization.canViewSupportData) {
    return {
      supportAuditRuntime: emptySummary,
      supportAuditRuntimeGroups: buildSupportAuditRuntimeGroups([]),
      supportAuditRuntimeItems: [] as SupportAuditRuntimeItem[],
      supportAuditSafeControls: buildSafeControls(),
      visibleSupportAuditRuntimeItems: [] as SupportAuditRuntimeItem[]
    };
  }

  if (!params.supabase || params.loadError) {
    const errorSummary = getSupportAuditRuntimeSummary([], {
      authorization: params.authorization,
      hiddenRecordCount: 0,
      loadError: params.loadError ?? "Admin client unavailable",
      loadingState: "error",
      restrictedRecordCount: 0,
      tableDetected: false,
      visibilityAuthorization: params.visibilityAuthorization
    });

    return {
      supportAuditRuntime: errorSummary,
      supportAuditRuntimeGroups: buildSupportAuditRuntimeGroups([]),
      supportAuditRuntimeItems: [] as SupportAuditRuntimeItem[],
      supportAuditSafeControls: buildSafeControls(),
      visibleSupportAuditRuntimeItems: [] as SupportAuditRuntimeItem[]
    };
  }

  const ticketsLoad = await params.supabase
    .from("support_tickets" as never)
    .select(TICKET_LOOKUP_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);

  let monitoringQuery = params.supabase
    .from("monitoring_events" as never)
    .select(AUDIT_COLUMNS)
    .in("event_type", SUPPORT_AUDIT_EVENT_TYPES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(300);

  const selectedTicketId = params.selectedTicketId?.trim() || null;

  if (selectedTicketId) {
    monitoringQuery = monitoringQuery.eq("entity_id" as never, selectedTicketId as never);
  }

  const monitoringLoad = await monitoringQuery;
  const tableDetected = !monitoringLoad.error;
  const ticketLookup = buildTicketLookup(Array.isArray(ticketsLoad.data) ? ticketsLoad.data : []);
  const auditItems = (Array.isArray(monitoringLoad.data) ? monitoringLoad.data : [])
    .map((row) => buildAuditRuntimeItem(row as AnyRecord, { ticketLookup }))
    .filter((item): item is SupportAuditRuntimeItem => item !== null)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const visibilityGate = applySupportAuditVisibility({
    auditItems,
    authorization: params.visibilityAuthorization,
    visibleTickets: params.visibleTickets
  });

  const loadError = monitoringLoad.error?.message ?? ticketsLoad.error?.message ?? null;
  const loadingState: SupportAuditLoadingState = loadError
    ? "error"
    : visibilityGate.visibleAuditItems.length === 0
      ? visibilityGate.restrictedRecordCount > 0
        ? "restricted"
        : "empty"
      : "loaded";

  const supportAuditRuntime = getSupportAuditRuntimeSummary(visibilityGate.visibleAuditItems, {
    authorization: params.authorization,
    hiddenRecordCount: visibilityGate.hiddenRecordCount,
    loadError,
    loadingState,
    restrictedRecordCount: visibilityGate.restrictedRecordCount,
    tableDetected,
    visibilityAuthorization: params.visibilityAuthorization
  });

  return {
    supportAuditRuntime,
    supportAuditRuntimeGroups: buildSupportAuditRuntimeGroups(visibilityGate.visibleAuditItems),
    supportAuditRuntimeItems: auditItems,
    supportAuditSafeControls: buildSafeControls(),
    visibleSupportAuditRuntimeItems: visibilityGate.visibleAuditItems
  };
}

export function mapSupportAuditRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportAuditRuntimeReadOnlySafe>>
) {
  return input;
}
