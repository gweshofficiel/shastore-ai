"use server";

import { redirect } from "next/navigation";
import { getAccountRoleForUser, isConfiguredSuperAdminEmail } from "@/lib/account-roles";
import { getInternalTeamMemberForAuthUser } from "@/lib/admin/internal-team-runtime";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdminAccountSession() {
  const supabase = await createClient({ role: "admin" });
  const internalSupabase = await createClient({ role: "internal_team" });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const accountRole = await getAccountRoleForUser(supabase, user.id);
    const isSuperAdmin =
      isConfiguredSuperAdminEmail(user.email) &&
      accountRole?.role === "super_admin" &&
      accountRole.status === "active";

    if (isSuperAdmin) {
      return {
        internalRole: "super_admin",
        supabase,
        user
      };
    }
  }

  const {
    data: { user: internalUser }
  } = await internalSupabase.auth.getUser();

  if (!internalUser) {
    redirect("/admin/login?next=/admin/internal-team/settings");
  }

  const internalMember = await getInternalTeamMemberForAuthUser({
    email: internalUser.email,
    userId: internalUser.id
  });

  if (internalMember?.status !== "active") {
    await internalSupabase.auth.signOut();
    redirect("/admin/login?error=restricted");
  }

  return {
    internalRole: internalMember.role,
    supabase: internalSupabase,
    user: internalUser
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
    redirect("/admin/internal-team/settings?account=password-invalid");
  }

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    redirect("/admin/internal-team/settings?account=password-failed");
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

  redirect("/admin/internal-team/settings?account=password-updated");
}

export async function requestInternalAccountEmailChange(formData: FormData) {
  const { internalRole, user } = await requireAdminAccountSession();
  const requestedEmail = cleanText(formData.get("requestedEmail")).toLowerCase();

  if (!requestedEmail || requestedEmail === user.email?.toLowerCase() || !requestedEmail.includes("@")) {
    redirect("/admin/internal-team/settings?account=email-invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect("/admin/internal-team/settings?account=email-request-failed");
  }

  await admin
    .from("internal_team_members" as never)
    .update({
      email_change_requested: true,
      requested_new_email: requestedEmail
    } as never)
    .eq("user_id" as never, user.id as never);

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

  redirect("/admin/internal-team/settings?account=email-requested");
}
