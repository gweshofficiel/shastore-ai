"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { internalTeamRoleCanMutate } from "@/lib/admin/internal-team-runtime";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canonicalStatusToStorage,
  isAllowedSupportTicketTransition,
  isValidSupportTicketCanonicalStatus,
  normalizeStorageStatusToCanonical,
  type SupportTicketCanonicalStatus
} from "@/src/lib/support/support-ticket-status-runtime";
import { isEligibleSupportAssignmentAgent } from "@/src/lib/support/support-ticket-assignment-runtime";

const supportAdminPath = "/admin/support";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: FormDataEntryValue | null, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectWithStatusResult(ticketId: string, result: string) {
  const params = new URLSearchParams();
  params.set("ticket", ticketId);
  params.set("statusResult", result);
  redirect(`${supportAdminPath}?${params.toString()}`);
}

async function assertSupportTicketStatusMutationAccess() {
  const access = await getAdminAccess();

  if (access.role === "super_admin") {
    return access;
  }

  if (access.role === "internal_team" && internalTeamRoleCanMutate(access.internalRole)) {
    return access;
  }

  redirect(`${supportAdminPath}?statusResult=unauthorized`);
}

export async function updatePlatformSupportTicketStatusAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const nextStatus = cleanText(formData.get("status"), 40);

  if (!ticketId || !uuidPattern.test(ticketId) || !isValidSupportTicketCanonicalStatus(nextStatus)) {
    redirect(`${supportAdminPath}?statusResult=invalid`);
  }

  const access = await assertSupportTicketStatusMutationAccess();
  const admin = createAdminClient();

  if (!admin) {
    redirectWithStatusResult(ticketId, "error");
    throw new Error("Admin client unavailable");
  }

  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets" as never)
    .select("id, workspace_id, store_id, user_id, ticket_number, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    redirectWithStatusResult(ticketId, "error");
  }

  if (!ticket) {
    redirect(`${supportAdminPath}?statusResult=not_found`);
  }

  const ticketRow = ticket as Record<string, unknown>;
  const currentCanonical = normalizeStorageStatusToCanonical(String(ticketRow.status ?? ""));
  const targetCanonical = nextStatus as Exclude<SupportTicketCanonicalStatus, "unknown">;

  if (!isAllowedSupportTicketTransition(currentCanonical, targetCanonical)) {
    redirectWithStatusResult(ticketId, "invalid");
  }

  const storageStatus = canonicalStatusToStorage(targetCanonical);

  if (String(ticketRow.status ?? "").toLowerCase() === storageStatus) {
    redirectWithStatusResult(ticketId, "unchanged");
  }

  const { error: updateError } = await admin
    .from("support_tickets" as never)
    .update({ status: storageStatus } as never)
    .eq("id", ticketId);

  if (updateError) {
    redirectWithStatusResult(ticketId, "error");
  }

  await recordMonitoringEventSafe({
    entityId: ticketId,
    entityType: "support_ticket",
    eventStatus: "success",
    eventType: "support_ticket_status_changed",
    metadata: {
      action: "support.ticket.status.update",
      actorRole: access.role === "super_admin" ? "super_admin" : access.internalRole,
      canonicalStatus: targetCanonical,
      previousCanonicalStatus: currentCanonical,
      previousStorageStatus: String(ticketRow.status ?? ""),
      route: supportAdminPath,
      source: "support_ticket_status_runtime",
      storageStatus,
      ticketNumber: String(ticketRow.ticket_number ?? ticketId)
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithStatusResult(ticketId, "success");
}

function redirectWithAssignmentResult(ticketId: string, result: string) {
  const params = new URLSearchParams();
  params.set("ticket", ticketId);
  params.set("assignmentResult", result);
  redirect(`${supportAdminPath}?${params.toString()}`);
}

async function assertSuperAdminAssignmentAccess() {
  const access = await getAdminAccess();

  if (access.role === "super_admin") {
    return access;
  }

  redirect(`${supportAdminPath}?assignmentResult=unauthorized`);
}

async function loadEligibleAssignmentAgents(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data, error } = await admin
    .from("internal_team_members" as never)
    .select("user_id, email, display_name, role, status")
    .in("role", ["support_agent", "admin"] as never)
    .eq("status", "active" as never)
    .limit(200);

  if (error) {
    return { agents: [], error: error.message };
  }

  const agents = (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const userId = cleanText(record.user_id as string | null, 80);
      const email = cleanText(record.email as string | null, 120).toLowerCase();
      const role = cleanText(record.role as string | null, 40);
      const status = cleanText(record.status as string | null, 40);

      if (!userId || !email || status !== "active") {
        return null;
      }

      if (role !== "support_agent" && role !== "admin") {
        return null;
      }

      return {
        displayName: cleanText(record.display_name as string | null, 120) || email,
        email,
        role,
        userId
      };
    })
    .filter((agent): agent is { displayName: string; email: string; role: string; userId: string } => agent !== null);

  return { agents, error: null as string | null };
}

export async function updatePlatformSupportTicketAssignmentAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const assignedUserId = cleanText(formData.get("assignedUserId"), 80);
  const unassign = cleanText(formData.get("unassign"), 10) === "true";

  if (!ticketId || !uuidPattern.test(ticketId)) {
    redirect(`${supportAdminPath}?assignmentResult=invalid`);
  }

  if (!unassign && assignedUserId && !uuidPattern.test(assignedUserId)) {
    redirectWithAssignmentResult(ticketId, "invalid");
  }

  const access = await assertSuperAdminAssignmentAccess();
  const admin = createAdminClient();

  if (!admin) {
    redirectWithAssignmentResult(ticketId, "error");
    throw new Error("Admin client unavailable");
  }

  const agentLoad = await loadEligibleAssignmentAgents(admin);

  if (agentLoad.error) {
    redirectWithAssignmentResult(ticketId, "error");
  }

  const nextAssignedUserId = unassign ? null : assignedUserId || null;

  if (nextAssignedUserId && !isEligibleSupportAssignmentAgent(agentLoad.agents, nextAssignedUserId)) {
    redirectWithAssignmentResult(ticketId, "invalid");
  }

  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets" as never)
    .select("id, workspace_id, store_id, user_id, ticket_number, assigned_user_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    redirectWithAssignmentResult(ticketId, "error");
  }

  if (!ticket) {
    redirect(`${supportAdminPath}?assignmentResult=not_found`);
  }

  const ticketRow = ticket as Record<string, unknown>;
  const previousAssignedUserId = ticketRow.assigned_user_id ? String(ticketRow.assigned_user_id) : null;

  if (previousAssignedUserId === nextAssignedUserId) {
    redirectWithAssignmentResult(ticketId, "unchanged");
  }

  const { error: updateError } = await admin
    .from("support_tickets" as never)
    .update({ assigned_user_id: nextAssignedUserId } as never)
    .eq("id", ticketId);

  if (updateError) {
    redirectWithAssignmentResult(ticketId, "error");
  }

  const assignedAgent = nextAssignedUserId
    ? agentLoad.agents.find((agent) => agent.userId === nextAssignedUserId)
    : null;

  await recordMonitoringEventSafe({
    entityId: ticketId,
    entityType: "support_ticket",
    eventStatus: "success",
    eventType: nextAssignedUserId ? "support_ticket_assigned" : "support_ticket_unassigned",
    metadata: {
      action: nextAssignedUserId ? "support.ticket.assign" : "support.ticket.unassign",
      actorRole: "super_admin",
      assignedAgentEmail: assignedAgent?.email ?? null,
      assignedAgentRole: assignedAgent?.role ?? null,
      assignedUserId: nextAssignedUserId,
      previousAssignedUserId,
      route: supportAdminPath,
      source: "support_ticket_assignment_runtime",
      ticketNumber: String(ticketRow.ticket_number ?? ticketId)
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithAssignmentResult(ticketId, "success");
}

function redirectWithConversationResult(ticketId: string, result: string) {
  const params = new URLSearchParams();
  params.set("ticket", ticketId);
  params.set("conversationResult", result);
  redirect(`${supportAdminPath}?${params.toString()}`);
}

async function assertSuperAdminConversationAccess() {
  const access = await getAdminAccess();

  if (access.role === "super_admin") {
    return access;
  }

  redirect(`${supportAdminPath}?conversationResult=unauthorized`);
}

function cleanMessageBody(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}

const conversationVisibilitySet = new Set(["internal", "super_admin"]);

export async function createPlatformSupportTicketConversationMessageAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const messageBody = cleanMessageBody(formData.get("messageBody"));
  const visibility = cleanText(formData.get("visibility"), 40) || "internal";

  if (!ticketId || !uuidPattern.test(ticketId) || !messageBody || !conversationVisibilitySet.has(visibility)) {
    redirect(`${supportAdminPath}?conversationResult=invalid`);
  }

  const access = await assertSuperAdminConversationAccess();
  const admin = createAdminClient();

  if (!admin) {
    redirectWithConversationResult(ticketId, "error");
    throw new Error("Admin client unavailable");
  }

  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets" as never)
    .select("id, workspace_id, store_id, ticket_number")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    redirectWithConversationResult(ticketId, "error");
  }

  if (!ticket) {
    redirect(`${supportAdminPath}?conversationResult=not_found`);
  }

  const ticketRow = ticket as Record<string, unknown>;
  const authorLabel = cleanText(access.user.email ?? null, 120) || "Super Admin";

  const { error: insertError } = await admin.from("support_ticket_messages" as never).insert({
    author_label: authorLabel,
    author_role: "super_admin",
    author_user_id: access.user.id,
    has_attachments: false,
    message_body: messageBody,
    store_id: ticketRow.store_id ?? null,
    ticket_id: ticketId,
    visibility,
    workspace_id: ticketRow.workspace_id ?? null
  } as never);

  if (insertError) {
    redirectWithConversationResult(ticketId, "error");
  }

  await admin
    .from("support_tickets" as never)
    .update({ updated_at: new Date().toISOString() } as never)
    .eq("id", ticketId);

  await recordMonitoringEventSafe({
    entityId: ticketId,
    entityType: "support_ticket",
    eventStatus: "success",
    eventType: "support_ticket_message_created",
    metadata: {
      action: "support.ticket.conversation.create",
      actorRole: "super_admin",
      messageLength: messageBody.length,
      route: supportAdminPath,
      source: "support_ticket_conversation_runtime",
      ticketNumber: String(ticketRow.ticket_number ?? ticketId),
      visibility
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithConversationResult(ticketId, "success");
}
