import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  assertFeatureAccess,
  assertUsageWithinLimits,
  billingEnforcementMessage
} from "@/lib/billing/enforcement";
import { recordSubscriptionEnforcementLog } from "@/lib/billing/enforcement-log";
import { sendWorkspaceInviteEmailSafe } from "@/lib/notifications/email-provider";
import { getPublicUrl } from "@/lib/deployment/config";
import { hasPermission, requirePermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceForUser,
  setActiveWorkspaceCookie
} from "@/lib/workspaces/active-workspace";

export type WorkspaceMember = {
  created_at: string;
  id: string;
  invited_by: string | null;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  user_id: string;
  workspace_id: string;
};

export type WorkspaceMemberStatus = "active" | "pending" | "suspended" | "banned";

export type WorkspaceInvite = {
  accepted_at?: string | null;
  created_at: string;
  email: string;
  expires_at?: string | null;
  id: string;
  invited_by: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted" | "revoked" | "expired";
  workspace_id: string;
};

const manageableRoles = new Set<WorkspaceRole>(["admin", "editor", "support"]);
const manageableStatuses = new Set<WorkspaceMemberStatus>([
  "active",
  "pending",
  "suspended",
  "banned"
]);

function normalizeEmail(value: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

function normalizeRole(value: FormDataEntryValue | string | null): Exclude<WorkspaceRole, "owner"> {
  return manageableRoles.has(value as WorkspaceRole)
    ? (value as Exclude<WorkspaceRole, "owner">)
    : "editor";
}

function normalizeMemberStatus(value: FormDataEntryValue | string | null) {
  return manageableStatuses.has(value as WorkspaceMemberStatus)
    ? (value as WorkspaceMemberStatus)
    : "active";
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashInviteToken(token)
  };
}

function teamRedirect(status: string, message?: string): never {
  const params = new URLSearchParams({ team: status });

  if (message) {
    params.set("message", message.slice(0, 500));
  }

  redirect(`/dashboard/team?${params.toString()}`);
}

function teamWorkspaceRedirect(status: string, workspaceId: string, message?: string): never {
  const params = new URLSearchParams({ team: status, workspace: workspaceId });

  if (message) {
    params.set("message", message.slice(0, 500));
  }

  redirect(`/dashboard/team?${params.toString()}`);
}

async function requireActiveWorkspaceManagement(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  action: "remove" | "role-change" | "status-change"
) {
  const selection = await getActiveWorkspaceForUser({ supabase, userId });

  if (selection.activeWorkspaceId !== workspaceId) {
    console.warn("[team-member-permission-denied] attempted member management outside active workspace", {
      action,
      activeWorkspaceId: selection.activeWorkspaceId,
      userId,
      workspaceId
    });
    teamWorkspaceRedirect("error", selection.activeWorkspaceId, "Switch to that workspace before managing members.");
  }

  try {
    const permission = await requirePermission({
      permission: "manage_team",
      supabase,
      userId,
      workspaceId
    });

    return permission;
  } catch {
    console.warn("[team-member-permission-denied] manage_team permission denied", {
      action,
      userId,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Only workspace owners and admins can manage team members.");
  }
}

export async function ensurePersonalWorkspaceOwnerMembership(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  if (workspaceId !== userId) {
    return;
  }

  const admin = createAdminClient();
  const client = admin ?? supabase;

  const { error } = await client.from("workspace_members" as never).upsert(
    {
      invited_by: userId,
      role: "owner",
      user_id: userId,
      workspace_id: workspaceId
    } as never,
    { onConflict: "workspace_id,user_id" }
  );

  if (error) {
    console.warn("[workspace-member] owner membership ensure failed", {
      message: error.message,
      userId,
      workspaceId
    });
  }
}

export async function canManageWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  await ensurePersonalWorkspaceOwnerMembership(supabase, workspaceId, userId);

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (data as { role?: WorkspaceRole | null } | null)?.role ?? null;
  const allowed = hasPermission(role, "manage_team");

  console.info("[workspace-access] manage workspace checked", {
    allowed,
    role,
    userId,
    workspaceId
  });

  if (error) {
    console.warn("[workspace-access] manage lookup failed", {
      message: error.message,
      userId,
      workspaceId
    });
  }

  return { allowed, role };
}

export async function getWorkspaceMembers(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  await ensurePersonalWorkspaceOwnerMembership(supabase, workspaceId, userId);

  console.log("[workspace-members-query] loading roster for active workspace", {
    filter: "workspace_id",
    userId,
    workspaceId
  });

  let membersResult = await supabase
    .from("workspace_members" as never)
    .select("id, workspace_id, user_id, role, status, invited_by, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (membersResult.error?.message?.toLowerCase().includes("status")) {
    console.warn("[workspace-member-status] status column unavailable; treating members as active", {
      message: membersResult.error.message,
      workspaceId
    });
    membersResult = await supabase
      .from("workspace_members" as never)
      .select("id, workspace_id, user_id, role, invited_by, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
  }

  const { data: invites, error: invitesError } = await supabase
    .from("workspace_invitations" as never)
    .select("id, workspace_id, email, role, invited_by, status, expires_at, accepted_at, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const members = (membersResult.data ?? []) as Array<WorkspaceMember & { status?: WorkspaceMemberStatus | null }>;
  const membersError = membersResult.error;
  let visibleMembers = members.map((member) => ({
    ...member,
    status: normalizeMemberStatus(member.status ?? "active")
  }));
  const admin = createAdminClient();

  if (admin) {
    const { count: dbCount, error: dbCountError } = await admin
      .from("workspace_members" as never)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    console.log("[workspace-members-rls] comparing visible roster with database", {
      dbCount: dbCount ?? 0,
      dbCountError: dbCountError?.message ?? null,
      rlsCount: visibleMembers.length,
      userId,
      workspaceId
    });

    if (dbCount !== null && (membersError || visibleMembers.length < dbCount)) {
      const { data: accessRow } = await admin
        .from("workspace_members" as never)
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (accessRow) {
        console.log("[workspace-members-rls] current user membership verified for roster fallback", {
          role: (accessRow as { role?: string | null }).role ?? null,
          userId,
          workspaceId
        });

        const { data: roster, error: rosterError } = await admin
          .from("workspace_members" as never)
          .select("id, workspace_id, user_id, role, status, invited_by, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true });

        if (!rosterError && roster) {
          visibleMembers = (roster as Array<WorkspaceMember & { status?: WorkspaceMemberStatus | null }>).map(
            (member) => ({
              ...member,
              status: normalizeMemberStatus(member.status ?? "active")
            })
          );
          console.log("[workspace-members-visible] trusted roster fallback applied", {
            dbCount,
            roles: visibleMembers.map((member) => member.role),
            rlsCount: (members ?? []).length,
            userId,
            userIds: visibleMembers.map((member) => member.user_id),
            workspaceId
          });
        }
      } else {
        console.warn("[workspace-members-rls] roster fallback denied; user is not a workspace member", {
          userId,
          workspaceId
        });
      }
    }
  } else {
    console.log("[workspace-members-rls] service role unavailable for roster comparison", {
      rlsCount: visibleMembers.length,
      userId,
      workspaceId
    });
  }

  console.log("[workspace-members-visible] roster returned to app", {
    roles: visibleMembers.map((member) => member.role),
    userId,
    userIds: visibleMembers.map((member) => member.user_id),
    visibleCount: visibleMembers.length,
    workspaceId
  });

  if (membersError) {
    console.warn("[workspace-member] members lookup failed", {
      message: membersError.message,
      workspaceId
    });
  }

  if (invitesError) {
    console.warn("[workspace-invite] invites lookup failed", {
      message: invitesError.message,
      workspaceId
    });
  }

  return {
    invites: (invites ?? []) as WorkspaceInvite[],
    invitesError: invitesError?.message ?? null,
    members: visibleMembers,
    membersError: membersError?.message ?? null
  };
}

async function workspaceSeatCount(supabase: SupabaseClient, workspaceId: string) {
  const [{ count: membersCount }, { count: pendingInvitesCount }] = await Promise.all([
    supabase
      .from("workspace_members" as never)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("workspace_invitations" as never)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
  ]);

  return (membersCount ?? 0) + (pendingInvitesCount ?? 0);
}

export async function inviteMember(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const workspaceId = String(formData.get("workspaceId") ?? user.id);
  const email = normalizeEmail(formData.get("email"));
  const role = normalizeRole(formData.get("role"));

  if (!email || !email.includes("@")) {
    teamRedirect("error", "Enter a valid email address.");
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);
  const limit = access.usage.teamMemberLimit;
  const seatsUsed = await workspaceSeatCount(supabase, workspaceId);

  try {
    assertFeatureAccess(access, "team_members");
    assertUsageWithinLimits(access, "teamMembers");
  } catch (error) {
    await recordSubscriptionEnforcementLog({
      access,
      action: "team.invite",
      error,
      supabase,
      workspaceId
    });
    teamRedirect(
      "error",
      billingEnforcementMessage(error) ??
        "Your current plan does not allow additional team members. Upgrade at /dashboard/billing."
    );
  }

  if (limit !== null && seatsUsed >= limit) {
    const limitError = new Error(
      "Your current plan has reached its team member limit. Upgrade at /dashboard/billing."
    );
    await recordSubscriptionEnforcementLog({
      access,
      action: "team.invite",
      error: limitError,
      supabase,
      workspaceId
    });
    console.warn("[workspace-invite] team member limit reached", {
      limit,
      seatsUsed,
      userId: user.id,
      workspaceId
    });
    teamRedirect(
      "error",
      "Your current plan has reached its team member limit. Upgrade at /dashboard/billing."
    );
  }

  const management = await canManageWorkspace(supabase, workspaceId, user.id);

  if (!management.allowed) {
    console.warn("[permission-denied] team invite denied", {
      permission: "manage_team",
      role: management.role,
      userId: user.id,
      workspaceId
    });
    teamRedirect("error", "Only workspace owners and admins can invite team members.");
  }

  const admin = createAdminClient();
  const client = admin ?? supabase;
  const { token, tokenHash } = createInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const acceptUrl = getPublicUrl(`/invite/${token}`);

  console.info("[team-invite] creating invite", {
    email,
    role,
    userId: user.id,
    workspaceId
  });

  const { error: inviteError } = await client.from("workspace_invitations" as never).upsert(
    {
      email,
      expires_at: expiresAt,
      invited_by: user.id,
      role,
      status: "pending",
      token_hash: tokenHash,
      workspace_id: workspaceId
    } as never,
    { onConflict: "workspace_id,email" }
  );

  if (inviteError) {
    console.warn("[team-invite] invite upsert failed", {
      email,
      message: inviteError.message,
      workspaceId
    });
    teamRedirect("error", "Invite could not be created. Please try again.");
  }

  await sendWorkspaceInviteEmailSafe({ acceptUrl, email, role });

  revalidatePath("/dashboard/team");
  teamWorkspaceRedirect("invite-created", workspaceId);
}

export async function removeMember(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const workspaceId = String(formData.get("workspaceId") ?? user.id);
  const memberId = String(formData.get("memberId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");

  await requireActiveWorkspaceManagement(supabase, workspaceId, user.id, "remove");

  const admin = createAdminClient();
  const client = admin ?? supabase;

  if (memberId) {
    const { data: targetMember, error: targetError } = await client
      .from("workspace_members" as never)
      .select("id, workspace_id, user_id, role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (targetError || !targetMember) {
      console.warn("[team-member-remove] target lookup failed", {
        memberId,
        message: targetError?.message ?? "Member not found",
        userId: user.id,
        workspaceId
      });
      teamWorkspaceRedirect("error", workspaceId, "Member could not be found.");
    }

    const target = targetMember as {
      id: string;
      role: WorkspaceRole;
      user_id: string;
      workspace_id: string;
    };

    if (target.user_id === user.id) {
      console.warn("[team-member-remove] self-removal denied", {
        memberId,
        userId: user.id,
        workspaceId
      });
      teamWorkspaceRedirect("error", workspaceId, "You cannot remove yourself from the workspace.");
    }

    if (target.role === "owner") {
      console.warn("[team-member-remove] owner removal denied", {
        memberId,
        targetUserId: target.user_id,
        userId: user.id,
        workspaceId
      });
      teamWorkspaceRedirect("error", workspaceId, "Workspace owners cannot be removed from Team.");
    }

    const { error } = await client
      .from("workspace_members" as never)
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .neq("role", "owner");

    if (error) {
      console.warn("[workspace-member] remove failed", {
        memberId,
        message: error.message,
        workspaceId
      });
      teamWorkspaceRedirect("error", workspaceId, "Member could not be removed.");
    }

    console.info("[team-member-remove] member removed", {
      memberId,
      targetRole: target.role,
      targetUserId: target.user_id,
      userId: user.id,
      workspaceId
    });
  }

  if (inviteId) {
    const { error } = await client
      .from("workspace_invitations" as never)
      .update({ status: "revoked" } as never)
      .eq("id", inviteId)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.warn("[workspace-invite] revoke failed", {
        inviteId,
        message: error.message,
        workspaceId
      });
      teamWorkspaceRedirect("error", workspaceId, "Invite could not be revoked.");
    }

    console.info("[workspace-invite] invite revoked", { inviteId, userId: user.id, workspaceId });
  }

  revalidatePath("/dashboard/team");
  teamWorkspaceRedirect("removed", workspaceId);
}

export async function changeMemberRole(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const workspaceId = String(formData.get("workspaceId") ?? user.id);
  const memberId = String(formData.get("memberId") ?? "");
  const nextRole = normalizeRole(formData.get("role"));

  await requireActiveWorkspaceManagement(supabase, workspaceId, user.id, "role-change");

  const admin = createAdminClient();
  const client = admin ?? supabase;
  const { data: targetMember, error: targetError } = await client
    .from("workspace_members" as never)
    .select("id, workspace_id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (targetError || !targetMember) {
    console.warn("[team-member-role-change] target lookup failed", {
      memberId,
      message: targetError?.message ?? "Member not found",
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Member could not be found.");
  }

  const target = targetMember as {
    id: string;
    role: WorkspaceRole;
    user_id: string;
    workspace_id: string;
  };

  if (target.role === "owner") {
    console.warn("[team-member-role-change] owner role change denied", {
      memberId,
      targetUserId: target.user_id,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Workspace owner roles cannot be changed from Team.");
  }

  if (target.role === nextRole) {
    console.info("[team-member-role-change] role unchanged", {
      memberId,
      role: nextRole,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("member-role-updated", workspaceId);
  }

  const { error } = await client
    .from("workspace_members" as never)
    .update({ role: nextRole } as never)
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .neq("role", "owner");

  if (error) {
    console.warn("[team-member-role-change] update failed", {
      memberId,
      message: error.message,
      nextRole,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Member role could not be changed.");
  }

  console.info("[team-member-role-change] role updated", {
    memberId,
    nextRole,
    previousRole: target.role,
    targetUserId: target.user_id,
    userId: user.id,
    workspaceId
  });

  revalidatePath("/dashboard/team");
  teamWorkspaceRedirect("member-role-updated", workspaceId);
}

export async function changeMemberStatus(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const workspaceId = String(formData.get("workspaceId") ?? user.id);
  const memberId = String(formData.get("memberId") ?? "");
  const nextStatus = normalizeMemberStatus(formData.get("status"));

  if (nextStatus === "pending") {
    teamWorkspaceRedirect("error", workspaceId, "Pending status is reserved for invitations.");
  }

  await requireActiveWorkspaceManagement(supabase, workspaceId, user.id, "status-change");

  const admin = createAdminClient();
  const client = admin ?? supabase;
  const { data: targetMember, error: targetError } = await client
    .from("workspace_members" as never)
    .select("id, workspace_id, user_id, role, status")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (targetError || !targetMember) {
    console.warn("[team-member-status-change] target lookup failed", {
      memberId,
      message: targetError?.message ?? "Member not found",
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Member could not be found.");
  }

  const target = targetMember as {
    id: string;
    role: WorkspaceRole;
    status?: WorkspaceMemberStatus | null;
    user_id: string;
    workspace_id: string;
  };

  if (target.role === "owner") {
    console.warn("[team-member-status-change] owner status change denied", {
      memberId,
      nextStatus,
      targetUserId: target.user_id,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Workspace owner status cannot be changed from Team.");
  }

  if (target.user_id === user.id && nextStatus !== "active") {
    console.warn("[team-member-status-change] self-suspension denied", {
      memberId,
      nextStatus,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "You cannot suspend yourself.");
  }

  const { error } = await client
    .from("workspace_members" as never)
    .update({ status: nextStatus } as never)
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .neq("role", "owner");

  if (error) {
    console.warn("[team-member-status-change] update failed", {
      memberId,
      message: error.message,
      nextStatus,
      userId: user.id,
      workspaceId
    });
    teamWorkspaceRedirect("error", workspaceId, "Member status could not be changed.");
  }

  console.info("[team-member-status-change] status updated", {
    memberId,
    nextStatus,
    previousStatus: normalizeMemberStatus(target.status ?? "active"),
    targetUserId: target.user_id,
    userId: user.id,
    workspaceId
  });

  revalidatePath("/dashboard/team");
  teamWorkspaceRedirect("member-status-updated", workspaceId);
}

export async function resendInvite(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/team");
  }

  const workspaceId = String(formData.get("workspaceId") ?? user.id);
  const inviteId = String(formData.get("inviteId") ?? "");

  try {
    await requirePermission({
      permission: "manage_team",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    teamRedirect("error", "Only workspace owners and admins can resend invites.");
  }

  const { token, tokenHash } = createInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const client = admin ?? supabase;
  const { data, error } = await client
    .from("workspace_invitations" as never)
    .update({
      expires_at: expiresAt,
      status: "pending",
      token_hash: tokenHash
    } as never)
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .select("email, role")
    .maybeSingle();

  if (error || !data) {
    console.warn("[team-invite] resend failed", {
      inviteId,
      message: error?.message ?? "Invite not found",
      workspaceId
    });
    teamRedirect("error", "Invite could not be resent.");
  }

  const invite = data as { email: string; role: string };
  await sendWorkspaceInviteEmailSafe({
    acceptUrl: getPublicUrl(`/invite/${token}`),
    email: invite.email,
    role: invite.role
  });

  console.info("[team-invite] invite resent", {
    email: invite.email,
    inviteId,
    workspaceId
  });

  revalidatePath("/dashboard/team");
  teamWorkspaceRedirect("invite-resent", workspaceId);
}

async function markInvitationAccepted(
  client: SupabaseClient,
  inviteId: string,
  workspaceId: string,
  userId: string
) {
  const { error } = await client
    .from("workspace_invitations" as never)
    .update({ accepted_at: new Date().toISOString(), status: "accepted" } as never)
    .eq("id", inviteId);

  if (error) {
    console.log("[invite-accept] invitation status update failed", {
      inviteId,
      message: error.message,
      userId,
      workspaceId
    });
    return { ok: false as const, message: "Invitation could not be accepted." };
  }

  console.log("[invite-accept] invitation marked accepted", { inviteId, userId, workspaceId });
  return { ok: true as const };
}

async function upsertWorkspaceMemberForInvite(
  admin: ReturnType<typeof createAdminClient>,
  userSupabase: SupabaseClient,
  invite: {
    invited_by: string;
    role: Exclude<WorkspaceRole, "owner">;
    workspace_id: string;
  },
  userId: string
) {
  const memberRow = {
    invited_by: invite.invited_by,
    role: invite.role,
    user_id: userId,
    workspace_id: invite.workspace_id
  };

  if (admin) {
    console.log("[invite-accept] upserting workspace_members via service role", {
      userId,
      workspaceId: invite.workspace_id
    });

    const { data, error } = await admin
      .from("workspace_members" as never)
      .upsert(memberRow as never, { onConflict: "workspace_id,user_id" })
      .select("id")
      .maybeSingle();

    if (!error && data) {
      console.log("[invite-accept] workspace_members row confirmed (service role)", {
        memberId: (data as { id: string }).id,
        role: invite.role,
        userId,
        workspaceId: invite.workspace_id
      });
      console.log("[invite-accepted-role-assigned] invited role assigned", {
        role: invite.role,
        userId,
        workspaceId: invite.workspace_id
      });
      return { ok: true as const };
    }

    console.log("[invite-accept] service role member upsert failed, trying authenticated client", {
      message: error?.message ?? "no row returned",
      userId,
      workspaceId: invite.workspace_id
    });
  } else {
    console.log("[invite-accept] service role unavailable; using authenticated client for member insert", {
      userId,
      workspaceId: invite.workspace_id
    });
  }

  const { data, error } = await userSupabase
    .from("workspace_members" as never)
    .upsert(memberRow as never, { onConflict: "workspace_id,user_id" })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.log("[invite-accept] authenticated member upsert failed", {
      message: error?.message ?? "no row returned",
      userId,
      workspaceId: invite.workspace_id
    });
    return { ok: false as const, message: "Invitation could not be accepted." };
  }

  console.log("[invite-accept] workspace_members row confirmed (authenticated)", {
    memberId: (data as { id: string }).id,
    role: invite.role,
    userId,
    workspaceId: invite.workspace_id
  });
  console.log("[invite-accepted-role-assigned] invited role assigned", {
    role: invite.role,
    userId,
    workspaceId: invite.workspace_id
  });

  return { ok: true as const };
}

export async function acceptInviteToken(token: string, userId: string, userEmail?: string | null) {
  console.log("[invite-accept] start", { hasEmail: Boolean(userEmail), userId });

  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();
  const userSupabase = await createClient();

  if (!admin) {
    console.log("[invite-accept] service role client unavailable; token lookup requires configuration");
    return { ok: false as const, message: "Invite acceptance is not configured." };
  }

  console.log("[invite-accept] looking up invitation by token hash");

  const { data, error } = await admin
    .from("workspace_invitations" as never)
    .select("id, workspace_id, email, role, status, expires_at, invited_by, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    console.log("[invite-accept] invitation lookup failed", {
      message: error?.message ?? "Invite not found"
    });
    return { ok: false as const, message: "Invitation is invalid or expired." };
  }

  const invite = data as {
    accepted_at: string | null;
    email: string;
    expires_at: string;
    id: string;
    invited_by: string;
    role: Exclude<WorkspaceRole, "owner">;
    status: string;
    workspace_id: string;
  };

  console.log("[invite-accept] invitation loaded", {
    inviteId: invite.id,
    status: invite.status,
    workspaceId: invite.workspace_id
  });

  if (invite.status === "revoked") {
    console.log("[invite-accept] invitation revoked", { inviteId: invite.id, userId });
    return { ok: false as const, message: "This invitation was revoked." };
  }

  const isExpired = new Date(invite.expires_at).getTime() < Date.now();

  if (isExpired) {
    if (invite.status === "pending") {
      await admin
        .from("workspace_invitations" as never)
        .update({ status: "expired" } as never)
        .eq("id", invite.id)
        .eq("status", "pending");
    }

    console.log("[invite-accept] invitation expired", {
      inviteId: invite.id,
      status: invite.status,
      userId
    });
    return { ok: false as const, message: "Invitation is invalid or expired." };
  }

  if (userEmail?.toLowerCase() !== invite.email.toLowerCase()) {
    console.log("[invite-accept] email mismatch", {
      inviteEmail: invite.email,
      userEmail: userEmail ?? null,
      userId
    });
    return {
      ok: false as const,
      message: "Sign in with the email address that received this invitation."
    };
  }

  console.log("[invite-accept] email matches invitation", { inviteId: invite.id, userId });

  const { data: existingMember } = await admin
    .from("workspace_members" as never)
    .select("id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    console.log("[invite-accept] user already a workspace member", {
      memberId: (existingMember as { id: string }).id,
      userId,
      workspaceId: invite.workspace_id
    });

    if (invite.status === "accepted") {
      console.log("[invite-accept] invitation already accepted; idempotent success", {
        inviteId: invite.id,
        userId
      });
      return {
        ok: true as const,
        message: "Invitation accepted.",
        workspaceId: invite.workspace_id
      };
    }

    if (invite.status !== "pending") {
      console.log("[invite-accept] invitation not pending but membership exists", {
        inviteId: invite.id,
        status: invite.status,
        userId
      });
      return { ok: false as const, message: "Invitation is invalid or expired." };
    }

    const accepted = await markInvitationAccepted(admin, invite.id, invite.workspace_id, userId);
    return accepted.ok
      ? {
          ok: true as const,
          message: "Invitation accepted.",
          workspaceId: invite.workspace_id
        }
      : { ok: false as const, message: accepted.message };
  }

  if (invite.status === "accepted") {
    console.log("[invite-accept] invitation accepted but membership missing; creating membership", {
      inviteId: invite.id,
      userId
    });
  } else if (invite.status !== "pending") {
    console.log("[invite-accept] invitation not acceptable", {
      inviteId: invite.id,
      status: invite.status,
      userId
    });
    return { ok: false as const, message: "Invitation is invalid or expired." };
  }

  console.log("[invite-accept] inserting workspace_members (seat reserved at invite time)");

  const memberResult = await upsertWorkspaceMemberForInvite(admin, userSupabase, invite, userId);

  if (!memberResult.ok) {
    return { ok: false as const, message: memberResult.message };
  }

  const accepted = await markInvitationAccepted(admin, invite.id, invite.workspace_id, userId);

  if (!accepted.ok) {
    return { ok: false as const, message: accepted.message };
  }

  revalidatePath("/dashboard/team");

  console.log("[invite-accept] success", { inviteId: invite.id, userId, workspaceId: invite.workspace_id });

  return {
    ok: true as const,
    message: "Invitation accepted.",
    workspaceId: invite.workspace_id
  };
}

export async function acceptWorkspaceInvitation(token: string) {
  "use server";

  console.log("[invite-accept-action] server action invoked");

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[invite-accept-action] no authenticated user; redirecting to login");
    redirect(`/auth/login?invite=${encodeURIComponent(token)}`);
  }

  console.log("[invite-accept-action] authenticated user", {
    userEmail: user.email ?? null,
    userId: user.id
  });

  const result = await acceptInviteToken(token, user.id, user.email);

  if (result.ok) {
    await setActiveWorkspaceCookie(result.workspaceId);
    console.log("[invite-active-workspace-set] accepted invitation workspace selected", {
      userId: user.id,
      workspaceId: result.workspaceId
    });
    console.log("[invite-accept-action] redirecting to team dashboard", {
      userId: user.id,
      workspaceId: result.workspaceId
    });
    redirect(`/dashboard/team?team=invite-accepted&workspace=${encodeURIComponent(result.workspaceId)}`);
  }

  console.log("[invite-accept-action] acceptance failed", {
    message: result.message,
    userId: user.id
  });

  return result;
}

export async function getInviteTokenPreview(token: string) {
  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[invite-auth-failed] invite preview service client unavailable");
    return { ok: false as const, email: null, role: null, message: "Invite acceptance is not configured." };
  }

  const { data, error } = await admin
    .from("workspace_invitations" as never)
    .select("id, email, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    console.warn("[invite-auth-failed] invite preview lookup failed", {
      message: error?.message ?? "Invite not found"
    });
    return { ok: false as const, email: null, role: null, message: "Invitation is invalid or expired." };
  }

  const invite = data as {
    email: string;
    expires_at: string;
    id: string;
    role: Exclude<WorkspaceRole, "owner">;
    status: string;
  };

  if (invite.status === "revoked") {
    console.log("[invite-preview] invitation revoked", { inviteId: invite.id });
    return { ok: false as const, email: null, role: null, message: "This invitation was revoked." };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    console.log("[invite-preview] invitation expired", { inviteId: invite.id, status: invite.status });
    return { ok: false as const, email: null, role: null, message: "Invitation is invalid or expired." };
  }

  if (invite.status !== "pending" && invite.status !== "accepted") {
    console.log("[invite-preview] invitation not usable", {
      inviteId: invite.id,
      status: invite.status
    });
    return { ok: false as const, email: null, role: null, message: "Invitation is invalid or expired." };
  }

  console.log("[invite-preview] invitation ready for acceptance", {
    email: invite.email,
    inviteId: invite.id,
    role: invite.role,
    status: invite.status
  });

  return {
    ok: true as const,
    email: invite.email,
    role: invite.role,
    message: "Sign in or create an account to accept this invitation."
  };
}
