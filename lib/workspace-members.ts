import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "admin" | "editor" | "support";

export type WorkspaceMember = {
  created_at: string;
  id: string;
  invited_by: string | null;
  role: WorkspaceRole;
  user_id: string;
  workspace_id: string;
};

export type WorkspaceInvite = {
  created_at: string;
  email: string;
  id: string;
  invited_by: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted" | "revoked";
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

function teamRedirect(status: string, message?: string): never {
  const params = new URLSearchParams({ team: status });

  if (message) {
    params.set("message", message.slice(0, 500));
  }

  redirect(`/dashboard/team?${params.toString()}`);
}

async function resolveAuthUserIdByEmail(email: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[workspace-invite] auth email lookup failed", {
      email,
      message: error.message
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

async function ensureOwnerMembership(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
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
  const allowed = role === "owner" || role === "admin";

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
        .from("workspace_invites" as never)
        .select("id, workspace_id, email, role, invited_by, status, created_at")
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
      .from("workspace_invites" as never)
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
    teamRedirect("error", "Only workspace owners and admins can invite team members.");
  }

  const invitedUserId = await resolveAuthUserIdByEmail(email);
  const admin = createAdminClient();
  const client = admin ?? supabase;

  console.info("[workspace-invite] creating invite", {
    email,
    invitedUserFound: Boolean(invitedUserId),
    role,
    userId: user.id,
    workspaceId
  });

  const { error: inviteError } = await client.from("workspace_invites" as never).upsert(
    {
      email,
      invited_by: user.id,
      role,
      status: invitedUserId ? "accepted" : "pending",
      workspace_id: workspaceId
    } as never,
    { onConflict: "workspace_id,email" }
  );

  if (inviteError) {
    console.warn("[workspace-invite] invite upsert failed", {
      email,
      message: inviteError.message,
      workspaceId
    });
    teamRedirect("error", "Invite could not be created. Please try again.");
  }

  if (invitedUserId) {
    const { error: memberError } = await client.from("workspace_members" as never).upsert(
      {
        invited_by: user.id,
        role,
        user_id: invitedUserId,
        workspace_id: workspaceId
      } as never,
      { onConflict: "workspace_id,user_id" }
    );

    if (memberError) {
      console.warn("[workspace-member] member upsert failed", {
        email,
        message: memberError.message,
        workspaceId
      });
      teamRedirect("error", "Member could not be added. Please try again.");
    }
  }

  revalidatePath("/dashboard/team");
  teamRedirect(invitedUserId ? "member-added" : "invite-created");
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
  const management = await canManageWorkspace(supabase, workspaceId, user.id);

  if (!management.allowed) {
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
      .from("workspace_invites" as never)
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
