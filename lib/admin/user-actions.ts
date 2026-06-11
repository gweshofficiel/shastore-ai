"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminUserAction =
  | "admin_user_clear_risk"
  | "admin_user_mark_high_risk"
  | "admin_user_mark_reviewed"
  | "admin_user_suspended";

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
      note: "Super Admin user monitoring action recorded. No secrets or destructive account changes were executed.",
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

  const note = "Super Admin user monitoring action recorded. No secrets or destructive account changes were executed.";
  const requestAudit = await getRequestAuditFields();

  await recordSecurityAuditLog({
    ...requestAudit,
    action,
    client: admin,
    metadata: {
      actor_user_id: access.user.id,
      source: "super_admin_users_runtime"
    },
    reason: note,
    route: "/admin/users",
    userId
  });

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
  const access = await getAdminAccess();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("Missing user ID.");
  }

  if (userId === access.user.id) {
    throw new Error("Super Admins cannot suspend their own active admin session.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for user suspension.");
  }

  const { data: targetRole, error: roleLookupError } = await admin
    .from("account_roles" as never)
    .select("role, status")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  if (roleLookupError) {
    throw new Error("Unable to verify the selected user's account role before suspension.");
  }

  const role = (targetRole as { role?: string; status?: string } | null)?.role ?? "unknown";

  if (role === "super_admin") {
    throw new Error("Super Admin accounts cannot be suspended from the Users Runtime.");
  }

  if (targetRole) {
    const { error: roleUpdateError } = await admin
      .from("account_roles" as never)
      .update({ status: "suspended" } as never)
      .eq("user_id" as never, userId as never);

    if (roleUpdateError) {
      throw new Error("Unable to suspend the selected user's account role.");
    }
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h"
  });

  if (banError) {
    throw new Error("Unable to block future login for the selected user.");
  }

  const { error: signOutError } = await admin.auth.admin.signOut(userId, "global");

  if (signOutError) {
    console.warn("[admin-users] global sign out failed during suspension", {
      message: signOutError.message,
      userId
    });
  }

  const requestAudit = await getRequestAuditFields();
  const note =
    "Super Admin suspended the selected user. Auth login was banned, active sessions were revoked when supported, and stores, orders, subscriptions, and history were preserved.";

  const { error: monitoringError } = await admin.from("monitoring_events" as never).insert({
    entity_id: userId,
    entity_type: "admin_user",
    event_status: "warning",
    event_type: "admin_user_suspended",
    metadata: {
      actor_user_id: access.user.id,
      preserved_data: ["stores", "orders", "subscriptions", "history"],
      revoked_sessions: !signOutError,
      role,
      source: "super_admin_users_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  if (monitoringError) {
    console.warn("[admin-users] suspension monitoring insert failed", {
      code: monitoringError.code,
      message: monitoringError.message,
      userId
    });
  }

  await recordSecurityAuditLog({
    ...requestAudit,
    action: "admin_user_suspended",
    client: admin,
    metadata: {
      actor_user_id: access.user.id,
      preserved_data: ["stores", "orders", "subscriptions", "history"],
      revoked_sessions: !signOutError,
      role,
      source: "super_admin_users_runtime"
    },
    reason: note,
    route: "/admin/users",
    userId
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export const activateAdminUser = markAdminUserReviewed;
export const restoreAdminUser = clearAdminUserRisk;
export const suspendAdminUser = suspendAdminUserShortcut;
