"use server";

import { redirect } from "next/navigation";
import { isConfiguredSuperAdminEmail, getAccountRoleForUser } from "@/lib/account-roles";
import { getInternalTeamMemberForAuthUser } from "@/lib/admin/internal-team-runtime";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdminAccountSession() {
  const supabase = await createClient({ role: "admin" });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login?next=/admin/account");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);
  const isSuperAdmin =
    isConfiguredSuperAdminEmail(user.email) &&
    accountRole?.role === "super_admin" &&
    accountRole.status === "active";
  const internalMember = await getInternalTeamMemberForAuthUser({
    email: user.email,
    userId: user.id
  });

  if (!isSuperAdmin && internalMember?.status !== "active") {
    redirect("/admin/login?error=restricted");
  }

  return {
    internalRole: isSuperAdmin ? "super_admin" : internalMember?.role ?? "read_only_auditor",
    supabase,
    user
  };
}

function cleanText(value: FormDataEntryValue | null, maxLength = 254) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function changeInternalAccountPassword(formData: FormData) {
  const { supabase, user } = await requireAdminAccountSession();
  const password = cleanText(formData.get("password"), 256);
  const confirmPassword = cleanText(formData.get("confirmPassword"), 256);

  if (password.length < 8 || password !== confirmPassword) {
    redirect("/admin/account?account=password-invalid");
  }

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    redirect("/admin/account?account=password-failed");
  }

  const admin = createAdminClient();
  const request = await getRequestAuditFields();

  await recordSecurityAuditLog({
    ...request,
    action: "admin_internal_account_password_changed",
    client: admin,
    metadata: {
      source: "internal_team_account_settings"
    },
    reason: "Internal admin user changed their own password.",
    route: "/admin/account",
    userId: user.id
  });

  redirect("/admin/account?account=password-updated");
}

export async function requestInternalAccountEmailChange(formData: FormData) {
  const { internalRole, user } = await requireAdminAccountSession();
  const requestedEmail = cleanText(formData.get("requestedEmail")).toLowerCase();

  if (!requestedEmail || requestedEmail === user.email?.toLowerCase() || !requestedEmail.includes("@")) {
    redirect("/admin/account?account=email-invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect("/admin/account?account=email-request-failed");
  }

  const request = await getRequestAuditFields();
  const metadata = {
    current_email: user.email?.toLowerCase() ?? null,
    internal_role: internalRole,
    requested_email: requestedEmail,
    source: "internal_team_account_settings"
  };

  await admin.from("monitoring_events" as never).insert({
    entity_id: user.id,
    entity_type: "admin_internal_email_change_request",
    event_status: "pending",
    event_type: "admin_internal_email_change_requested",
    metadata,
    store_id: null,
    user_id: user.id,
    workspace_id: null
  } as never);

  await recordSecurityAuditLog({
    ...request,
    action: "admin_internal_email_change_requested",
    client: admin,
    metadata,
    reason: "Internal admin user requested an email change. Auth email was not mutated.",
    route: "/admin/account",
    userId: user.id
  });

  redirect("/admin/account?account=email-requested");
}
