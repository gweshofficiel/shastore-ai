import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceForUser,
  type UserWorkspaceMembership
} from "@/lib/workspaces/active-workspace";
import { getUserWorkspaceRole, hasPermission, type WorkspacePermission } from "@/lib/permissions/rbac";

type WorkspaceDataContextOptions = {
  permission?: WorkspacePermission;
  redirectTo?: string;
};

export type WorkspaceDataContext = {
  role: UserWorkspaceMembership["role"] | null;
  supabase: SupabaseClient;
  user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>;
  workspaceId: string;
};

export async function getWorkspaceDataContext(
  options: WorkspaceDataContextOptions = {}
): Promise<WorkspaceDataContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(options.redirectTo ?? "/dashboard")}`);
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const role = await getUserWorkspaceRole(supabase, selection.activeWorkspaceId, user.id);

  if (options.permission && !hasPermission(role, options.permission)) {
    console.warn("[workspace-access-denied] permission denied for workspace data", {
      permission: options.permission,
      role,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    redirect("/dashboard?workspace=denied");
  }

  console.log("[workspace-data-access] context resolved", {
    permission: options.permission ?? null,
    role,
    userId: user.id,
    workspaceId: selection.activeWorkspaceId
  });

  return {
    role,
    supabase,
    user,
    workspaceId: selection.activeWorkspaceId
  };
}

export async function assertStoreInWorkspace(
  supabase: SupabaseClient,
  storeId: string,
  workspaceId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("stores")
    .select("id, workspace_id, owner_user_id")
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    console.warn("[workspace-access-denied] store outside active workspace", {
      message: error?.message ?? "Store not found",
      storeId,
      userId,
      workspaceId
    });
    return false;
  }

  console.log("[workspace-data-access] store access scoped", {
    storeId,
    userId,
    workspaceId
  });

  return true;
}
