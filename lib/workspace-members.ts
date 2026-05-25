import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { sendWorkspaceInviteEmailSafe } from "@/lib/notifications/email-provider";
import { getPublicUrl } from "@/lib/deployment/config";
import { hasPermission, requirePermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceMember = {
  created_at: string;
  id: string;
  invited_by: string | null;
  role: WorkspaceRole;
  user_id: string;
  workspace_id: string;
};

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

function normalizeEmail(value: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

function normalizeRole(value: FormDataEntryValue | string | null): Exclude<WorkspaceRole, "owner"> {
  return manageableRoles.has(value as WorkspaceRole)
    ? (value as Exclude<WorkspaceRole, "owner">)
    : "editor";
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

async function ensureOwnerMembership(
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
  await ensureOwnerMembership(supabase, workspaceId, userId);

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
  await ensureOwnerMembership(supabase, workspaceId, userId);

  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] =
    await Promise.all([
      supabase
        .from("workspace_members" as never)
        .select("id, workspace_id, user_id, role, invited_by, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_invitations" as never)
        .select("id, workspace_id, email, role, invited_by, status, expires_at, accepted_at, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    ]);

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
    members: (members ?? []) as WorkspaceMember[],
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

  if (limit !== null && seatsUsed >= limit) {
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
  teamRedirect("invite-created");
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

  try {
    await requirePermission({
      permission: "manage_team",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    teamRedirect("error", "Only workspace owners and admins can remove team members.");
  }

  const admin = createAdminClient();
  const client = admin ?? supabase;

  if (memberId) {
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
      teamRedirect("error", "Member could not be removed.");
    }

    console.info("[workspace-member] member removed", { memberId, userId: user.id, workspaceId });
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
      teamRedirect("error", "Invite could not be revoked.");
    }

    console.info("[workspace-invite] invite revoked", { inviteId, userId: user.id, workspaceId });
  }

  revalidatePath("/dashboard/team");
  teamRedirect("removed");
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
  teamRedirect("invite-resent");
}

export async function acceptInviteToken(token: string, userId: string, userEmail?: string | null) {
  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[invite-auth-failed] invite acceptance service client unavailable");
    return { ok: false as const, message: "Invite acceptance is not configured." };
  }

  const { data, error } = await admin
    .from("workspace_invitations" as never)
    .select("id, workspace_id, email, role, status, expires_at, invited_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    console.warn("[invite-auth-failed] invite lookup failed", {
      message: error?.message ?? "Invite not found"
    });
    return { ok: false as const, message: "Invitation is invalid or expired." };
  }

  const invite = data as {
    email: string;
    expires_at: string;
    id: string;
    invited_by: string;
    role: Exclude<WorkspaceRole, "owner">;
    status: string;
    workspace_id: string;
  };

  if (invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
    await admin
      .from("workspace_invitations" as never)
      .update({ status: "expired" } as never)
      .eq("id", invite.id)
      .eq("status", "pending");
    console.warn("[invite-auth-failed] invite expired or not pending", {
      inviteId: invite.id,
      status: invite.status,
      userId,
      workspaceId: invite.workspace_id
    });
    return { ok: false as const, message: "Invitation is invalid or expired." };
  }

  if (userEmail?.toLowerCase() !== invite.email.toLowerCase()) {
    console.warn("[invite-auth-mismatch] invite email mismatch", {
      inviteEmail: invite.email,
      userEmail: userEmail ?? null,
      userId
    });
    return {
      ok: false as const,
      message: "Sign in with the email address that received this invitation."
    };
  }

  const access = await getUserSubscriptionAccessForClient(admin, invite.workspace_id);
  const seatsUsed = await workspaceSeatCount(admin, invite.workspace_id);

  if (access.usage.teamMemberLimit !== null && seatsUsed > access.usage.teamMemberLimit) {
    console.warn("[invite-auth-failed] invite team member limit reached", {
      limit: access.usage.teamMemberLimit,
      seatsUsed,
      userId,
      workspaceId: invite.workspace_id
    });
    return {
      ok: false as const,
      message: "This workspace has reached its team member limit."
    };
  }

  const { error: memberError } = await admin.from("workspace_members" as never).upsert(
    {
      invited_by: invite.invited_by,
      role: invite.role,
      user_id: userId,
      workspace_id: invite.workspace_id
    } as never,
    { onConflict: "workspace_id,user_id" }
  );

  if (memberError) {
    console.warn("[invite-auth-failed] invite member upsert failed", {
      message: memberError.message,
      userId,
      workspaceId: invite.workspace_id
    });
    return { ok: false as const, message: "Invitation could not be accepted." };
  }

  const { error: acceptError } = await admin
    .from("workspace_invitations" as never)
    .update({ accepted_at: new Date().toISOString(), status: "accepted" } as never)
    .eq("id", invite.id);

  if (acceptError) {
    console.warn("[invite-auth-failed] invite status update failed", {
      inviteId: invite.id,
      message: acceptError.message,
      userId,
      workspaceId: invite.workspace_id
    });
    return { ok: false as const, message: "Invitation could not be accepted." };
  }

  console.info("[invite-auth-success] invite accepted", {
    userId,
    workspaceId: invite.workspace_id
  });

  return { ok: true as const, message: "Invitation accepted." };
}

export async function getInviteTokenPreview(token: string) {
  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[invite-auth-failed] invite preview service client unavailable");
    return { ok: false as const, email: null, message: "Invite acceptance is not configured." };
  }

  const { data, error } = await admin
    .from("workspace_invitations" as never)
    .select("id, email, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    console.warn("[invite-auth-failed] invite preview lookup failed", {
      message: error?.message ?? "Invite not found"
    });
    return { ok: false as const, email: null, message: "Invitation is invalid or expired." };
  }

  const invite = data as {
    email: string;
    expires_at: string;
    id: string;
    status: string;
  };

  if (invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
    console.warn("[invite-auth-failed] invite preview expired or not pending", {
      inviteId: invite.id,
      status: invite.status
    });
    return { ok: false as const, email: null, message: "Invitation is invalid or expired." };
  }

  console.info("[invite-auth-redirect] invite preview ready", {
    email: invite.email,
    inviteId: invite.id
  });

  return { ok: true as const, email: invite.email, message: "Sign in or create an account to accept this invitation." };
}
