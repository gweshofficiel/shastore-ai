"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-access";

type AdminUserAction =
  | "admin_user_clear_risk"
  | "admin_user_export_placeholder"
  | "admin_user_mark_high_risk"
  | "admin_user_mark_reviewed"
  | "admin_user_suspend_shortcut";

async function recordAdminUserAction(formData: FormData, action: AdminUserAction) {
  const access = await getAdminAccess();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    throw new Error("Missing user ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for user monitoring actions.");
  }

  const { error } = await admin.from("monitoring_events" as never).insert({
    entity_id: userId,
    entity_type: "admin_user",
    event_status: "info",
    event_type: action,
    metadata: {
      actor_user_id: access.user.id,
      note:
        action === "admin_user_suspend_shortcut"
          ? "Suspend shortcut placeholder only. No auth user, subscription, store, or workspace record was modified."
          : "Super Admin user monitoring action recorded. No secrets or destructive account changes were executed.",
      source: "super_admin_users_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  if (error) {
    console.warn("[admin-users] monitoring action insert failed", {
      action,
      code: error.code,
      message: error.message,
      userId
    });
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function markAdminUserReviewed(formData: FormData) {
  await recordAdminUserAction(formData, "admin_user_mark_reviewed");
}

export async function markAdminUserHighRisk(formData: FormData) {
  await recordAdminUserAction(formData, "admin_user_mark_high_risk");
}

export async function clearAdminUserRisk(formData: FormData) {
  await recordAdminUserAction(formData, "admin_user_clear_risk");
}

export async function suspendAdminUserShortcut(formData: FormData) {
  await recordAdminUserAction(formData, "admin_user_suspend_shortcut");
}

export async function exportAdminUserPlaceholder(formData: FormData) {
  await recordAdminUserAction(formData, "admin_user_export_placeholder");
}

export const activateAdminUser = markAdminUserReviewed;
export const restoreAdminUser = clearAdminUserRisk;
export const suspendAdminUser = suspendAdminUserShortcut;
