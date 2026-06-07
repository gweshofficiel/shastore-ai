"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type InternalTeamAction =
  | "admin_internal_team_activity_viewed"
  | "admin_internal_team_change_role_placeholder"
  | "admin_internal_team_invite_placeholder"
  | "admin_internal_team_restore_placeholder"
  | "admin_internal_team_suspend_placeholder";

const allowedRoleKeys = new Set([
  "admin",
  "developer_operator",
  "finance_manager",
  "moderator",
  "read_only_auditor",
  "security_analyst",
  "super_admin",
  "support_agent"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: FormDataEntryValue | null) {
  return cleanText(value, 254).toLowerCase();
}

function configuredSuperAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function recordInternalTeamAction(formData: FormData, action: InternalTeamAction) {
  const access = await getAdminAccess();
  const staffEmail = cleanEmail(formData.get("staffEmail"));
  const staffName = cleanText(formData.get("staffName"));
  const currentRoleKey = cleanText(formData.get("currentRoleKey")) || "read_only_auditor";
  const requestedRoleKey = cleanText(formData.get("roleKey")) || currentRoleKey;
  const roleKey = allowedRoleKeys.has(requestedRoleKey) ? requestedRoleKey : "read_only_auditor";

  if (!staffEmail) {
    throw new Error("Missing internal staff email.");
  }

  const superAdminEmails = configuredSuperAdminEmails();
  const isKnownSuperAdmin = currentRoleKey === "super_admin" || superAdminEmails.includes(staffEmail);

  if (action === "admin_internal_team_suspend_placeholder" && isKnownSuperAdmin) {
    throw new Error("Final Super Admin protection blocks Super Admin suspension placeholders.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for internal team controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_internal_team_center",
    event_status: "info",
    event_type: action,
    metadata: {
      current_role_key: currentRoleKey,
      note: "Placeholder internal staff governance action only. No auth rewrite, user deletion, session revocation, permission mutation, or Store Owner workspace team change was performed.",
      role_key: roleKey,
      source: "super_admin_internal_team_center",
      staff_email: staffEmail,
      staff_name: staffName || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/team");
}

export async function inviteInternalStaffPlaceholder(formData: FormData) {
  await recordInternalTeamAction(formData, "admin_internal_team_invite_placeholder");
}

export async function changeInternalStaffRolePlaceholder(formData: FormData) {
  await recordInternalTeamAction(formData, "admin_internal_team_change_role_placeholder");
}

export async function suspendInternalStaffPlaceholder(formData: FormData) {
  await recordInternalTeamAction(formData, "admin_internal_team_suspend_placeholder");
}

export async function restoreInternalStaffPlaceholder(formData: FormData) {
  await recordInternalTeamAction(formData, "admin_internal_team_restore_placeholder");
}

export async function viewInternalStaffActivity(formData: FormData) {
  await recordInternalTeamAction(formData, "admin_internal_team_activity_viewed");
}
