import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getAccountRoleForUser,
  isConfiguredSuperAdminEmail
} from "@/lib/account-roles";
import {
  canInternalTeamRoleAccessPath,
  getInternalTeamMemberForAuthUser,
  internalTeamDefaultPathForRole,
  internalTeamRoleCanMutate
} from "@/lib/admin/internal-team-runtime";
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
  const supabase = await createClient({ role: "admin" });
  const internalSupabase = await createClient({ role: "internal_team" });
  const headerStore = await headers();
  const pathname = headerStore.get("x-shastore-path") ?? "/admin";
  const isMutationRequest = Boolean(headerStore.get("next-action")) || headerStore.get("content-type")?.includes("multipart/form-data");
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    if (await isCurrentUserDeliveryAccount(supabase, user)) {
      redirect("/delivery/dashboard");
    }

    const accountRole = await getAccountRoleForUser(supabase, user.id);
    const officialSuperAdmin = isConfiguredSuperAdminEmail(user.email);
    const { isConfigured } = isPlatformAdminEmail(user.email);

    if (officialSuperAdmin && accountRole?.role === "super_admin" && accountRole.status === "active") {
      return {
        internalRole: "super_admin" as const,
        isConfigured,
        role: "super_admin" as const,
        user
      };
    }
  }

  const {
    data: { user: internalUser }
  } = await internalSupabase.auth.getUser();

  if (!internalUser) {
    redirect("/login?next=/admin");
  }

  const { isConfigured } = isPlatformAdminEmail(internalUser.email);
  const internalMember = await getInternalTeamMemberForAuthUser({
    email: internalUser.email,
    userId: internalUser.id
  });

  if (!internalMember || internalMember.status !== "active") {
    await internalSupabase.auth.signOut();
    redirect("/admin/internal-team/accept/restricted?invite=restricted");
  }

  if (!canInternalTeamRoleAccessPath(internalMember.role, pathname)) {
    redirect(`${internalTeamDefaultPathForRole(internalMember.role)}?error=permission-denied`);
  }

  if (isMutationRequest && !internalTeamRoleCanMutate(internalMember.role)) {
    redirect(`${internalTeamDefaultPathForRole(internalMember.role)}?error=read-only`);
  }

  return {
    internalRole: internalMember.role,
    isConfigured,
    role: "internal_team" as const,
    user: internalUser
  };
}
