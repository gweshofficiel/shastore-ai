import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getSupportRegistryEntry,
  SUPPORT_REGISTRY_SOURCE
} from "@/src/lib/support/support-registry-runtime";

export type SupportTicketAssignmentRuntimeSource = "support_ticket_assignment_runtime";

export type SupportTicketAssignmentState = "assigned" | "unassigned";

export type SupportTicketAssignmentFoundation = "available" | "read_only";

export type SupportTicketAssignmentResultCode =
  | "error"
  | "invalid"
  | "not_found"
  | "success"
  | "unauthorized"
  | "unchanged";

export type SupportAssignmentAgent = {
  agentKey: string;
  displayName: string;
  email: string;
  role: string;
  roleKey: string;
  status: "active";
  userId: string;
};

export type SupportAgentDirectory = Record<
  string,
  {
    displayName: string;
    email: string;
    label: string;
    role: string;
    roleKey: string;
  }
>;

export type SupportTicketAssignmentRuntimeItem = {
  assignedAgentId: string | null;
  assignedAgentLabel: string;
  assignmentFoundation: SupportTicketAssignmentFoundation;
  assignmentState: SupportTicketAssignmentState;
  canMutateAssignment: boolean;
  registryKey: "sp-ticket-assignment";
  ticketId: string;
  transitionNote: string;
};

export type SupportTicketAssignmentRuntimeSummary = {
  assignmentColumnDetected: boolean;
  eligibleAgentCount: number;
  loadError: string | null;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  source: SupportTicketAssignmentRuntimeSource;
  status: "assignment_runtime_ready" | "load_error" | "needs_attention";
  summary: string;
  transitionFoundation: SupportTicketAssignmentFoundation;
};

export type SupportTicketAssignmentAuthorization = {
  canMutateAssignment: boolean;
  reason: string;
  roleLabel: string;
};

export const SUPPORT_TICKET_ASSIGNMENT_RUNTIME_SOURCE = "support_ticket_assignment_runtime" as const;

export const ELIGIBLE_SUPPORT_ASSIGNMENT_ROLE_KEYS = ["admin", "support_agent"] as const;

type AnyRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolveSupportTicketAssignmentAuthorization(input: {
  role: "internal_team" | "super_admin";
}): SupportTicketAssignmentAuthorization {
  if (input.role === "super_admin") {
    return {
      canMutateAssignment: true,
      reason: "Super Admin may execute explicit ticket assignment and unassignment actions.",
      roleLabel: "super_admin"
    };
  }

  return {
    canMutateAssignment: false,
    reason: "Ticket assignment changes are restricted to Super Admin in SP-6.",
    roleLabel: input.role
  };
}

export function buildSupportAgentDirectory(agents: SupportAssignmentAgent[]): SupportAgentDirectory {
  return Object.fromEntries(
    agents.map((agent) => [
      agent.userId,
      {
        displayName: agent.displayName,
        email: agent.email,
        label: agent.displayName,
        role: agent.role,
        roleKey: agent.roleKey
      }
    ])
  );
}

export function resolveAssignedAgentLabel(
  assignedUserId: string | null,
  directory: SupportAgentDirectory
) {
  if (!assignedUserId) {
    return {
      assignedAgentId: null,
      assignedAgentLabel: "Not assigned",
      assignmentState: "unassigned" as const
    };
  }

  const agent = directory[assignedUserId];

  return {
    assignedAgentId: assignedUserId,
    assignedAgentLabel: agent?.label ?? `Assigned agent ${assignedUserId}`,
    assignmentState: "assigned" as const
  };
}

function buildEligibleAgent(row: AnyRecord): SupportAssignmentAgent | null {
  const userId = text(row.user_id);
  const email = text(row.email).toLowerCase();
  const roleKey = text(row.role);
  const status = text(row.status);

  if (!userId || !email || status !== "active") {
    return null;
  }

  if (!ELIGIBLE_SUPPORT_ASSIGNMENT_ROLE_KEYS.includes(roleKey as (typeof ELIGIBLE_SUPPORT_ASSIGNMENT_ROLE_KEYS)[number])) {
    return null;
  }

  const displayName = text(row.display_name) || email;

  return {
    agentKey: `support-agent-${userId}`,
    displayName,
    email,
    role: roleKey === "support_agent" ? "Support Agent" : "Admin",
    roleKey,
    status: "active",
    userId
  };
}

async function loadEligibleSupportAgents(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("internal_team_members" as never)
    .select("user_id, email, display_name, role, status")
    .in("role", [...ELIGIBLE_SUPPORT_ASSIGNMENT_ROLE_KEYS] as never)
    .eq("status", "active" as never)
    .limit(200);

  if (error) {
    return {
      agents: [] as SupportAssignmentAgent[],
      error: error.message
    };
  }

  const agents = (Array.isArray(data) ? data : [])
    .map((row) => buildEligibleAgent(row as AnyRecord))
    .filter((agent): agent is SupportAssignmentAgent => agent !== null)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    agents,
    error: null as string | null
  };
}

export function buildSupportTicketAssignmentRuntimeItem(input: {
  assignedUserId: string | null;
  authorization: SupportTicketAssignmentAuthorization;
  directory: SupportAgentDirectory;
  ticketId: string;
}): SupportTicketAssignmentRuntimeItem {
  const registryEntry = getSupportRegistryEntry("sp-ticket-assignment");
  const assignment = resolveAssignedAgentLabel(input.assignedUserId, input.directory);
  const canMutateAssignment =
    input.authorization.canMutateAssignment && registryEntry?.productionReady !== false;
  const assignmentFoundation: SupportTicketAssignmentFoundation = canMutateAssignment
    ? "available"
    : "read_only";

  return {
    assignedAgentId: assignment.assignedAgentId,
    assignedAgentLabel: assignment.assignedAgentLabel,
    assignmentFoundation,
    assignmentState: assignment.assignmentState,
    canMutateAssignment,
    registryKey: "sp-ticket-assignment",
    ticketId: input.ticketId,
    transitionNote: canMutateAssignment
      ? "Explicit form submission only. No assignment mutation runs during page load."
      : input.authorization.reason
  };
}

export function getSupportTicketAssignmentRuntimeSummary(input: {
  assignmentColumnDetected: boolean;
  authorization: SupportTicketAssignmentAuthorization;
  eligibleAgentCount: number;
  loadError?: string | null;
}): SupportTicketAssignmentRuntimeSummary {
  const transitionFoundation: SupportTicketAssignmentFoundation = input.authorization.canMutateAssignment
    ? "available"
    : "read_only";
  const status = input.loadError
    ? ("load_error" as const)
    : !input.assignmentColumnDetected || input.eligibleAgentCount === 0
      ? ("needs_attention" as const)
      : ("assignment_runtime_ready" as const);

  return {
    assignmentColumnDetected: input.assignmentColumnDetected,
    eligibleAgentCount: input.eligibleAgentCount,
    loadError: input.loadError ?? null,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    source: SUPPORT_TICKET_ASSIGNMENT_RUNTIME_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          `${input.eligibleAgentCount} eligible support agents`,
          input.assignmentColumnDetected
            ? "support_tickets.assigned_user_id detected"
            : "support_tickets.assigned_user_id not detected",
          `transition foundation ${transitionFoundation}`,
          input.authorization.canMutateAssignment ? "assignment mutation authorized" : "assignment read-only"
        ].join("; "),
    transitionFoundation
  };
}

export async function loadSupportTicketAssignmentRuntimeReadOnlySafe(params: {
  authorization: SupportTicketAssignmentAuthorization;
  loadError?: string | null;
  selectedTicketId?: string | null;
  supabase: SupabaseClient<Database> | null;
}) {
  if (!params.supabase || params.loadError) {
    return {
      agentDirectory: {} as SupportAgentDirectory,
      eligibleAgents: [] as SupportAssignmentAgent[],
      selectedTicketAssignment: null as SupportTicketAssignmentRuntimeItem | null,
      ticketAssignmentRuntime: getSupportTicketAssignmentRuntimeSummary({
        assignmentColumnDetected: false,
        authorization: params.authorization,
        eligibleAgentCount: 0,
        loadError: params.loadError ?? "Admin client unavailable"
      })
    };
  }

  const agentLoad = await loadEligibleSupportAgents(params.supabase);
  const eligibleAgents = agentLoad.agents;
  const agentDirectory = buildSupportAgentDirectory(eligibleAgents);
  const selectedTicketId = params.selectedTicketId?.trim() || null;

  if (!selectedTicketId || !isUuid(selectedTicketId)) {
    return {
      agentDirectory,
      eligibleAgents,
      selectedTicketAssignment: null,
      ticketAssignmentRuntime: getSupportTicketAssignmentRuntimeSummary({
        assignmentColumnDetected: true,
        authorization: params.authorization,
        eligibleAgentCount: eligibleAgents.length,
        loadError: agentLoad.error
      })
    };
  }

  const ticketLoad = await params.supabase
    .from("support_tickets" as never)
    .select("id, assigned_user_id")
    .eq("id", selectedTicketId)
    .maybeSingle();

  const assignmentColumnDetected = !ticketLoad.error?.message?.includes("assigned_user_id");

  if (ticketLoad.error) {
    return {
      agentDirectory,
      eligibleAgents,
      selectedTicketAssignment: null,
      ticketAssignmentRuntime: getSupportTicketAssignmentRuntimeSummary({
        assignmentColumnDetected,
        authorization: params.authorization,
        eligibleAgentCount: eligibleAgents.length,
        loadError: ticketLoad.error.message
      })
    };
  }

  if (!ticketLoad.data) {
    return {
      agentDirectory,
      eligibleAgents,
      selectedTicketAssignment: null,
      ticketAssignmentRuntime: getSupportTicketAssignmentRuntimeSummary({
        assignmentColumnDetected,
        authorization: params.authorization,
        eligibleAgentCount: eligibleAgents.length,
        loadError: agentLoad.error
      })
    };
  }

  const row = ticketLoad.data as AnyRecord;
  const assignedUserId = row.assigned_user_id ? text(row.assigned_user_id) : null;

  return {
    agentDirectory,
    eligibleAgents,
    selectedTicketAssignment: buildSupportTicketAssignmentRuntimeItem({
      assignedUserId,
      authorization: params.authorization,
      directory: agentDirectory,
      ticketId: text(row.id)
    }),
    ticketAssignmentRuntime: getSupportTicketAssignmentRuntimeSummary({
      assignmentColumnDetected,
      authorization: params.authorization,
      eligibleAgentCount: eligibleAgents.length,
      loadError: agentLoad.error
    })
  };
}

export function mapSupportTicketAssignmentRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadSupportTicketAssignmentRuntimeReadOnlySafe>>
) {
  return {
    agentDirectory: input.agentDirectory,
    eligibleAgents: input.eligibleAgents,
    selectedTicketAssignment: input.selectedTicketAssignment,
    ticketAssignmentRuntime: input.ticketAssignmentRuntime
  };
}

export function isEligibleSupportAssignmentAgent(
  agents: ReadonlyArray<{ userId: string }>,
  assignedUserId: string | null
) {
  if (!assignedUserId) {
    return true;
  }

  return agents.some((agent) => agent.userId === assignedUserId);
}

export function supportTicketAssignmentResultMessage(code: SupportTicketAssignmentResultCode) {
  switch (code) {
    case "success":
      return "Ticket assignment updated successfully.";
    case "unchanged":
      return "Ticket assignment was already set to the requested agent.";
    case "invalid":
      return "The requested ticket assignment is not valid.";
    case "not_found":
      return "The requested support ticket was not found.";
    case "unauthorized":
      return "Only Super Admin accounts may change support ticket assignment in SP-6.";
    case "error":
      return "Ticket assignment could not be updated safely.";
  }
}
