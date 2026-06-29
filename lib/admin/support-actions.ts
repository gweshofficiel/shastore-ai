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
