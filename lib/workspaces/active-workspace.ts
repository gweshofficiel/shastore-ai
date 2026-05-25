import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceRole } from "@/lib/permissions/rbac";

const ACTIVE_WORKSPACE_COOKIE = "shastore_active_workspace_id";

export type UserWorkspaceMembership = {
  createdAt: string | null;
  invitedBy: string | null;
  isPersonal: boolean;
  role: WorkspaceRole;
  workspaceId: string;
};

type StaffIdentity = {
  isStaffLocked: boolean;
  managerEmail: string | null;
  managerUserId: string | null;
  staffId: string | null;
};

function isWorkspaceRole(value: string | null | undefined): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "editor" || value === "support";
}

async function getActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

export async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();

  try {
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    console.log("[active-workspace] cookie set", { workspaceId });
  } catch (error) {
    console.log("[active-workspace] cookie set skipped", {
      message: error instanceof Error ? error.message : "unknown error",
      workspaceId
    });
  }
}

export async function getUserWorkspaceMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<UserWorkspaceMembership[]> {
  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("workspace_id, role, invited_by, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[workspace-selection] memberships lookup failed", {
      message: error.message,
      userId
    });
  }

  const memberships = ((data ?? []) as Array<{
    created_at?: string | null;
    invited_by?: string | null;
    role?: string | null;
    workspace_id?: string | null;
  }>)
    .filter((membership) => membership.workspace_id && isWorkspaceRole(membership.role))
    .map((membership) => ({
      createdAt: membership.created_at ?? null,
      invitedBy: membership.invited_by ?? null,
      isPersonal: membership.workspace_id === userId,
      role: membership.role as WorkspaceRole,
      workspaceId: membership.workspace_id as string
    }));

  if (memberships.length === 0) {
    memberships.push({
      createdAt: null,
      invitedBy: null,
      isPersonal: true,
      role: "owner",
      workspaceId: userId
    });
  }

  console.log("[workspace-selection] memberships loaded", {
    count: memberships.length,
    userId
  });

  return memberships;
}

function staffIdForRole(role: WorkspaceRole | null | undefined) {
  if (role === "admin") {
    return "SHA-T.AD";
  }

  if (role === "editor") {
    return "SHA-T.E";
  }

  if (role === "support") {
    return "SHA-T.S";
  }

  return null;
}

async function resolveInviteCreatedStaffIdentity(
  userId: string,
  memberships: UserWorkspaceMembership[],
  selected?: UserWorkspaceMembership | null
): Promise<StaffIdentity> {
  const hasInvitedNonOwnerMembership = memberships.some(
    (membership) => !membership.isPersonal && membership.role !== "owner" && membership.invitedBy
  );
  const hasNonPersonalOwnerMembership = memberships.some(
    (membership) => !membership.isPersonal && membership.role === "owner"
  );
  const admin = createAdminClient();
  let metadataInviteSignup = false;
  let invitedEmailAccepted = false;
  let managerEmail: string | null = null;
  const managerUserId = selected?.invitedBy ?? null;

  if (admin) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email ?? null;
    const metadata = authUser.user?.user_metadata as Record<string, unknown> | null;
    metadataInviteSignup = metadata?.shastore_signup_source === "workspace_invite";

    if (email) {
      const { count } = await admin
        .from("workspace_invitations" as never)
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted")
        .eq("email", email.toLowerCase());
      invitedEmailAccepted = Boolean(count);
    }

    if (managerUserId) {
      const { data: manager } = await admin.auth.admin.getUserById(managerUserId);
      managerEmail = manager.user?.email ?? null;
    }
  }

  const isStaffLocked =
    !hasNonPersonalOwnerMembership &&
    (metadataInviteSignup || hasInvitedNonOwnerMembership || invitedEmailAccepted);

  return {
    isStaffLocked,
    managerEmail,
    managerUserId,
    staffId: isStaffLocked ? staffIdForRole(selected?.role) : null
  };
}

export async function getActiveWorkspaceForUser({
  requestedWorkspaceId,
  supabase,
  userId
}: {
  requestedWorkspaceId?: string | null;
  supabase: SupabaseClient;
  userId: string;
}) {
  const [memberships, cookieWorkspaceId] = await Promise.all([
    getUserWorkspaceMemberships(supabase, userId),
    getActiveWorkspaceCookie()
  ]);
  const hasInvitedNonOwnerMembership = memberships.some(
    (membership) => !membership.isPersonal && membership.role !== "owner" && membership.invitedBy
  );
  const hasNonPersonalOwnerMembership = memberships.some(
    (membership) => !membership.isPersonal && membership.role === "owner"
  );
  const preliminaryStaffLocked = hasInvitedNonOwnerMembership && !hasNonPersonalOwnerMembership;
  const allowedMemberships = preliminaryStaffLocked
    ? memberships.filter((membership) => !membership.isPersonal)
    : memberships;

  const byWorkspaceId = new Map(
    allowedMemberships.map((membership) => [membership.workspaceId, membership])
  );
  const requested = requestedWorkspaceId ? byWorkspaceId.get(requestedWorkspaceId) : null;
  const cookieSelected = cookieWorkspaceId ? byWorkspaceId.get(cookieWorkspaceId) : null;
  const selected = requested ?? cookieSelected ?? allowedMemberships[0] ?? memberships[0];
  let staffIdentity = await resolveInviteCreatedStaffIdentity(userId, memberships, selected);
  const visibleWorkspaces = staffIdentity.isStaffLocked
    ? memberships.filter((membership) => !membership.isPersonal)
    : memberships;
  const selectedIsAllowed = visibleWorkspaces.some(
    (membership) => membership.workspaceId === selected.workspaceId
  );
  const finalSelected = selectedIsAllowed ? selected : visibleWorkspaces[0] ?? selected;
  if (staffIdentity.isStaffLocked && staffIdentity.managerUserId !== (finalSelected.invitedBy ?? null)) {
    staffIdentity = await resolveInviteCreatedStaffIdentity(userId, memberships, finalSelected);
  }
  const source = requested ? "query" : cookieSelected ? "cookie" : "fallback";

  if (staffIdentity.isStaffLocked && selected.isPersonal) {
    console.warn("[workspace-security-block] staff personal workspace selection blocked", {
      requestedWorkspaceId,
      userId,
      workspaceId: selected.workspaceId
    });
  }

  if (requested && selectedIsAllowed) {
    await setActiveWorkspaceCookie(finalSelected.workspaceId);
  } else if (staffIdentity.isStaffLocked && cookieWorkspaceId !== finalSelected.workspaceId) {
    await setActiveWorkspaceCookie(finalSelected.workspaceId);
  }

  console.log("[active-workspace] resolved", {
    isStaffLocked: staffIdentity.isStaffLocked,
    source,
    userId,
    workspaceId: finalSelected.workspaceId,
    workspaceRole: finalSelected.role
  });

  return {
    activeWorkspaceId: finalSelected.workspaceId,
    activeWorkspaceRole: finalSelected.role,
    isStaffLocked: staffIdentity.isStaffLocked,
    managerEmail: staffIdentity.managerEmail,
    managerUserId: staffIdentity.managerUserId,
    source,
    staffId: staffIdentity.isStaffLocked ? staffIdForRole(finalSelected.role) : null,
    workspaces: visibleWorkspaces
  };
}

export async function switchActiveWorkspace(formData: FormData) {
  "use server";

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const next = String(formData.get("next") ?? "/dashboard/team");
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const memberships = selection.workspaces;
  const allowed = memberships.some((membership) => membership.workspaceId === workspaceId);

  if (!allowed) {
    console.warn("[workspace-switch] denied", {
      isStaffLocked: selection.isStaffLocked,
      userId: user.id,
      workspaceId
    });
    console.warn("[workspace-security-block] workspace switch rejected", {
      isStaffLocked: selection.isStaffLocked,
      userId: user.id,
      workspaceId
    });
    redirect("/dashboard/team?team=error&message=Workspace%20access%20denied.");
  }

  console.log("[workspace-switch] selected", { userId: user.id, workspaceId });
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");

  redirect(`${next.split("?")[0]}?workspace=${encodeURIComponent(workspaceId)}`);
}
