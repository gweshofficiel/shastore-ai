"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
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
import {
  cleanSafeActionText,
  isSupportSafeActionConfirmed,
  isValidSupportSafeActionUuid,
  recordSupportSafeActionAttempt,
  requiresSupportSafeActionConfirmation,
  type SupportSafeActionKey,
  type SupportSafeActionResultCode,
  validateSupportConversationSafeActionPayload,
  validateSupportSafeActionRequest,
  validateSupportStatusSafeActionPayload,
  validateSupportTicketExistsForSafeAction
} from "@/src/lib/support/support-safe-actions-runtime";

const supportAdminPath = "/admin/support";

function redirectWithSafeActionResult(
  actionKey: SupportSafeActionKey,
  ticketId: string | null,
  result: SupportSafeActionResultCode,
  legacyParam: "assignmentResult" | "conversationResult" | "statusResult"
): never {
  const params = new URLSearchParams();

  if (ticketId) {
    params.set("ticket", ticketId);
  }

  params.set("safeAction", actionKey);
  params.set("safeActionResult", result);
  params.set(legacyParam, result === "validation" ? "invalid" : result);
  redirect(`${supportAdminPath}?${params.toString()}`);
  throw new Error("Support safe action redirect");
}

async function guardSupportSafeAction(
  actionKey: SupportSafeActionKey,
  formData: FormData,
  ticketId: string | null,
  legacyParam: "assignmentResult" | "conversationResult" | "statusResult",
  options?: { nextStatus?: string | null; requireConfirmation?: boolean }
): Promise<Awaited<ReturnType<typeof getAdminAccess>>> {
  const validation = await validateSupportSafeActionRequest({
    actionKey,
    nextStatus: options?.nextStatus ?? null,
    ticketId
  });

  if (!validation.ok) {
    await recordSupportSafeActionAttempt({
      access: validation.access,
      actionKey,
      entityId: ticketId ?? "unknown",
      eventStatus: "failed",
      resultCode: validation.code
    }).catch(() => undefined);
    redirectWithSafeActionResult(actionKey, ticketId, validation.code, legacyParam);
  }

  if (
    options?.requireConfirmation &&
    requiresSupportSafeActionConfirmation({ actionKey, nextStatus: options.nextStatus }) &&
    !isSupportSafeActionConfirmed(formData)
  ) {
    await recordSupportSafeActionAttempt({
      access: validation.access,
      actionKey,
      entityId: ticketId ?? "unknown",
      eventStatus: "failed",
      metadata: { reason: "confirmation_required" },
      resultCode: "validation"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "validation", legacyParam);
  }

  return validation.access;
}

export async function updatePlatformSupportTicketStatusAction(formData: FormData) {
  const actionKey = "update_ticket_status" as const;
  const ticketId = cleanSafeActionText(formData.get("ticketId"), 80);
  const nextStatus = cleanSafeActionText(formData.get("status"), 40);

  if (!ticketId || !isValidSupportSafeActionUuid(ticketId) || !isValidSupportTicketCanonicalStatus(nextStatus)) {
    redirectWithSafeActionResult(actionKey, ticketId || null, "invalid", "statusResult");
  }

  const access = await guardSupportSafeAction(actionKey, formData, ticketId, "statusResult", {
    nextStatus,
    requireConfirmation: true
  });
  const adminClient = createAdminClient();

  if (!adminClient) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "statusResult");
  }

  const ticketLoad = await validateSupportTicketExistsForSafeAction(adminClient, ticketId);

  if (!ticketLoad.ok) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: ticketLoad.code
    });
    redirectWithSafeActionResult(actionKey, ticketId, ticketLoad.code, "statusResult");
  }

  const ticketRow = ticketLoad.ticket;
  const payloadError = validateSupportStatusSafeActionPayload({
    nextStatus,
    ticketStatus: String(ticketRow.status ?? "")
  });

  if (payloadError) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      metadata: { nextStatus },
      resultCode: payloadError
    });
    redirectWithSafeActionResult(actionKey, ticketId, payloadError, "statusResult");
  }

  const currentCanonical = normalizeStorageStatusToCanonical(String(ticketRow.status ?? ""));
  const targetCanonical = nextStatus as Exclude<SupportTicketCanonicalStatus, "unknown">;
  const storageStatus = canonicalStatusToStorage(targetCanonical);

  if (String(ticketRow.status ?? "").toLowerCase() === storageStatus) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "success",
      metadata: { nextStatus: targetCanonical, outcome: "unchanged" },
      resultCode: "unchanged",
      storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
      workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
    });
    redirectWithSafeActionResult(actionKey, ticketId, "unchanged", "statusResult");
  }

  const { error: updateError } = await adminClient
    .from("support_tickets" as never)
    .update({ status: storageStatus } as never)
    .eq("id", ticketId);

  if (updateError) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      metadata: { nextStatus: targetCanonical },
      resultCode: "error",
      storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
      workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "statusResult");
  }

  await recordMonitoringEventSafe({
    entityId: ticketId,
    entityType: "support_ticket",
    eventStatus: "success",
    eventType: "support_ticket_status_changed",
    metadata: {
      action: "support.ticket.status.update",
      actorRole: "super_admin",
      canonicalStatus: targetCanonical,
      previousCanonicalStatus: currentCanonical,
      previousStorageStatus: String(ticketRow.status ?? ""),
      route: supportAdminPath,
      source: "support_safe_actions_runtime",
      storageStatus,
      ticketNumber: String(ticketRow.ticket_number ?? ticketId)
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  await recordSupportSafeActionAttempt({
    access,
    actionKey,
    entityId: ticketId,
    eventStatus: "success",
    metadata: { nextStatus: targetCanonical },
    resultCode: "success",
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithSafeActionResult(actionKey, ticketId, "success", "statusResult");
}

export async function updatePlatformSupportTicketAssignmentAction(formData: FormData) {
  const unassign = cleanSafeActionText(formData.get("unassign"), 10) === "true";
  const actionKey: SupportSafeActionKey = unassign ? "unassign_ticket" : "assign_ticket";
  const ticketId = cleanSafeActionText(formData.get("ticketId"), 80);
  const assignedUserId = cleanSafeActionText(formData.get("assignedUserId"), 80);

  if (!ticketId || !isValidSupportSafeActionUuid(ticketId)) {
    redirectWithSafeActionResult(actionKey, ticketId || null, "invalid", "assignmentResult");
  }

  if (!unassign && assignedUserId && !isValidSupportSafeActionUuid(assignedUserId)) {
    redirectWithSafeActionResult(actionKey, ticketId, "invalid", "assignmentResult");
  }

  const access = await guardSupportSafeAction(actionKey, formData, ticketId, "assignmentResult", {
    requireConfirmation: true
  });
  const adminClient = createAdminClient();

  if (!adminClient) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "assignmentResult");
  }

  const agentLoad = await loadEligibleAssignmentAgents(adminClient);

  if (agentLoad.error) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "assignmentResult");
  }

  const nextAssignedUserId = unassign ? null : assignedUserId || null;

  if (nextAssignedUserId && !isEligibleSupportAssignmentAgent(agentLoad.agents, nextAssignedUserId)) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      metadata: { assignedUserId: nextAssignedUserId },
      resultCode: "invalid"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "invalid", "assignmentResult");
  }

  const ticketLoad = await validateSupportTicketExistsForSafeAction(adminClient, ticketId);

  if (!ticketLoad.ok) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: ticketLoad.code
    });
    redirectWithSafeActionResult(actionKey, ticketId, ticketLoad.code, "assignmentResult");
  }

  const ticketRow = ticketLoad.ticket;
  const previousAssignedUserId = ticketRow.assigned_user_id ? String(ticketRow.assigned_user_id) : null;

  if (previousAssignedUserId === nextAssignedUserId) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "success",
      metadata: { outcome: "unchanged" },
      resultCode: "unchanged",
      storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
      workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
    });
    redirectWithSafeActionResult(actionKey, ticketId, "unchanged", "assignmentResult");
  }

  const { error: updateError } = await adminClient
    .from("support_tickets" as never)
    .update({ assigned_user_id: nextAssignedUserId } as never)
    .eq("id", ticketId);

  if (updateError) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error",
      storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
      workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "assignmentResult");
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
      source: "support_safe_actions_runtime",
      ticketNumber: String(ticketRow.ticket_number ?? ticketId)
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  await recordSupportSafeActionAttempt({
    access,
    actionKey,
    entityId: ticketId,
    eventStatus: "success",
    metadata: { assignedUserId: nextAssignedUserId },
    resultCode: "success",
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithSafeActionResult(actionKey, ticketId, "success", "assignmentResult");
}

export async function createPlatformSupportTicketConversationMessageAction(formData: FormData) {
  const actionKey = "add_conversation_message" as const;
  const ticketId = cleanSafeActionText(formData.get("ticketId"), 80);
  const messageBody = cleanSafeActionText(formData.get("messageBody"), 4000);
  const visibility = cleanSafeActionText(formData.get("visibility"), 40) || "internal";

  if (!ticketId || !isValidSupportSafeActionUuid(ticketId)) {
    redirectWithSafeActionResult(actionKey, ticketId || null, "invalid", "conversationResult");
  }

  const payloadError = validateSupportConversationSafeActionPayload({ messageBody, visibility });

  if (payloadError) {
    redirectWithSafeActionResult(actionKey, ticketId, payloadError, "conversationResult");
  }

  const access = await guardSupportSafeAction(actionKey, formData, ticketId, "conversationResult");
  const adminClient = createAdminClient();

  if (!adminClient) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error"
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "conversationResult");
  }

  const ticketLoad = await validateSupportTicketExistsForSafeAction(adminClient, ticketId);

  if (!ticketLoad.ok) {
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: ticketLoad.code
    });
    redirectWithSafeActionResult(actionKey, ticketId, ticketLoad.code, "conversationResult");
  }

  const ticketRow = ticketLoad.ticket;
  const authorLabel = cleanSafeActionText(access.user.email ?? null, 120) || "Super Admin";

  const { error: insertError } = await adminClient.from("support_ticket_messages" as never).insert({
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
    await recordSupportSafeActionAttempt({
      access,
      actionKey,
      entityId: ticketId,
      eventStatus: "failed",
      resultCode: "error",
      storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
      workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
    });
    redirectWithSafeActionResult(actionKey, ticketId, "error", "conversationResult");
  }

  await adminClient
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
      source: "support_safe_actions_runtime",
      ticketNumber: String(ticketRow.ticket_number ?? ticketId),
      visibility
    },
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    userId: access.user.id,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  await recordSupportSafeActionAttempt({
    access,
    actionKey,
    entityId: ticketId,
    eventStatus: "success",
    metadata: { messageLength: messageBody.length, visibility },
    resultCode: "success",
    storeId: ticketRow.store_id ? String(ticketRow.store_id) : null,
    workspaceId: ticketRow.workspace_id ? String(ticketRow.workspace_id) : null
  });

  revalidatePath(supportAdminPath);
  redirectWithSafeActionResult(actionKey, ticketId, "success", "conversationResult");
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
      const userId = cleanSafeActionText(record.user_id as string | null, 80);
      const email = cleanSafeActionText(record.email as string | null, 120).toLowerCase();
      const role = cleanSafeActionText(record.role as string | null, 40);
      const status = cleanSafeActionText(record.status as string | null, 40);

      if (!userId || !email || status !== "active") {
        return null;
      }

      if (role !== "support_agent" && role !== "admin") {
        return null;
      }

      return {
        displayName: cleanSafeActionText(record.display_name as string | null, 120) || email,
        email,
        role,
        userId
      };
    })
    .filter((agent): agent is { displayName: string; email: string; role: string; userId: string } => agent !== null);

  return { agents, error: null as string | null };
}
