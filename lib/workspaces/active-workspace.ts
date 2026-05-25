import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/permissions/rbac";

const ACTIVE_WORKSPACE_COOKIE = "shastore_active_workspace_id";

export type UserWorkspaceMembership = {
  createdAt: string | null;
  isPersonal: boolean;
  role: WorkspaceRole;
  workspaceId: string;
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
    .select("workspace_id, role, created_at")
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
    role?: string | null;
    workspace_id?: string | null;
  }>)
    .filter((membership) => membership.workspace_id && isWorkspaceRole(membership.role))
    .map((membership) => ({
      createdAt: membership.created_at ?? null,
      isPersonal: membership.workspace_id === userId,
      role: membership.role as WorkspaceRole,
      workspaceId: membership.workspace_id as string
    }));

  if (!memberships.some((membership) => membership.workspaceId === userId)) {
    memberships.push({
      createdAt: null,
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

  const byWorkspaceId = new Map(
    memberships.map((membership) => [membership.workspaceId, membership])
  );
  const requested = requestedWorkspaceId ? byWorkspaceId.get(requestedWorkspaceId) : null;
  const cookieSelected = cookieWorkspaceId ? byWorkspaceId.get(cookieWorkspaceId) : null;
  const selected = requested ?? cookieSelected ?? memberships[0];
  const source = requested ? "query" : cookieSelected ? "cookie" : "fallback";

  if (requested) {
    await setActiveWorkspaceCookie(requested.workspaceId);
  }

  console.log("[active-workspace] resolved", {
    source,
    userId,
    workspaceId: selected.workspaceId,
    workspaceRole: selected.role
  });

  return {
    activeWorkspaceId: selected.workspaceId,
    activeWorkspaceRole: selected.role,
    source,
    workspaces: memberships
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

  const memberships = await getUserWorkspaceMemberships(supabase, user.id);
  const allowed = memberships.some((membership) => membership.workspaceId === workspaceId);

  if (!allowed) {
    console.warn("[workspace-switch] denied", { userId: user.id, workspaceId });
    redirect("/dashboard/team?team=error&message=Workspace%20access%20denied.");
  }

  console.log("[workspace-switch] selected", { userId: user.id, workspaceId });
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");

  redirect(`${next.split("?")[0]}?workspace=${encodeURIComponent(workspaceId)}`);
}
