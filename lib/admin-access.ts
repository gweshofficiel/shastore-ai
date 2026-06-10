import { redirect } from "next/navigation";
import {
  getAccountRoleForUser,
  isOfficialSuperAdminEmail,
  upsertAccountRoleForUser
} from "@/lib/account-roles";
import { isCurrentUserDeliveryAccount } from "@/lib/delivery/access";
import { createClient } from "@/lib/supabase/server";

function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(
  email: string | null | undefined,
  options: { allowUnconfigured?: boolean } = {}
) {
  const configuredAdminEmails = getConfiguredAdminEmails();
  const normalizedEmail = email?.toLowerCase() ?? "";
  const isConfigured = configuredAdminEmails.length > 0;
  const allowUnconfigured = options.allowUnconfigured ?? true;

  return {
    isAdmin: isConfigured ? configuredAdminEmails.includes(normalizedEmail) : allowUnconfigured,
    isConfigured
  };
}

export async function getAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (await isCurrentUserDeliveryAccount(supabase, user)) {
    redirect("/delivery/dashboard");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);
  const officialSuperAdmin = isOfficialSuperAdminEmail(user.email);
  const { isConfigured } = isPlatformAdminEmail(user.email);

  if (!accountRole && officialSuperAdmin) {
    await upsertAccountRoleForUser({ role: "super_admin", status: "active", userId: user.id });
  } else if (accountRole?.role !== "super_admin" || accountRole.status !== "active") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=role");
  }

  return {
    isConfigured,
    role: "super_admin" as const,
    user
  };
}
