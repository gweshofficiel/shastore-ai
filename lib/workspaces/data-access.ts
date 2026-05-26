import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceForUser,
  type UserWorkspaceMembership
} from "@/lib/workspaces/active-workspace";
import {
  getDashboardPermissionForPath,
  hasPermission,
  type WorkspacePermission,
  type WorkspaceRole
} from "@/lib/permissions/rbac";

type WorkspaceDataContextOptions = {
  permission?: WorkspacePermission;
  redirectTo?: string;
};

export type WorkspaceDataContext = {
  role: UserWorkspaceMembership["role"] | null;
  status: "active" | "pending" | "suspended" | "banned";
  supabase: SupabaseClient;
  user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>;
  workspaceId: string;
};

export type WorkspaceAccessContext = WorkspaceDataContext & {
  allowed: true;
  permission: WorkspacePermission;
};

export type WorkspaceAccessDenied = {
  allowed: false;
  permission: WorkspacePermission;
  reason: "unauthenticated" | "inactive_member" | "permission_denied" | "workspace_mismatch";
  role: WorkspaceRole | null;
  status: WorkspaceDataContext["status"] | null;
  supabase: SupabaseClient;
  user: WorkspaceDataContext["user"] | null;
  workspaceId: string | null;
};

function normalizeMemberStatus(value: string | null | undefined): WorkspaceDataContext["status"] {
  if (value === "pending" || value === "suspended" || value === "banned") {
    return value;
  }

  return "active";
}

async function getWorkspaceMembershipAccess(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  if (workspaceId === userId) {
    return { role: "owner" as WorkspaceRole, status: "active" as const };
  }

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[workspace-access-denied] membership lookup failed", {
      message: error.message,
      userId,
      workspaceId
    });
  }

  const membership = data as { role?: string | null; status?: string | null } | null;
  const role = (membership?.role ?? null) as WorkspaceRole | null;

  return {
    role,
    status: membership ? normalizeMemberStatus(membership.status) : "pending"
  };
}

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
  const { role, status } = await getWorkspaceMembershipAccess(
    supabase,
    selection.activeWorkspaceId,
    user.id
  );

  if (status !== "active") {
    console.warn("[workspace-access-denied] inactive member blocked", {
      role,
      status,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    redirect("/dashboard?workspace=inactive");
  }

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
    status,
    supabase,
    user,
    workspaceId: selection.activeWorkspaceId
  };
}

export async function getDashboardPageAccess({
  pathname,
  permission
}: {
  pathname: string;
  permission?: WorkspacePermission;
}): Promise<WorkspaceAccessContext | WorkspaceAccessDenied> {
  const requiredPermission = permission ?? getDashboardPermissionForPath(pathname);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      permission: requiredPermission,
      reason: "unauthenticated",
      role: null,
      status: null,
      supabase,
      user: null,
      workspaceId: null
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { role, status } = await getWorkspaceMembershipAccess(
    supabase,
    selection.activeWorkspaceId,
    user.id
  );
  const allowed = status === "active" && hasPermission(role, requiredPermission);

  if (!allowed) {
    console.warn("[workspace-access-denied] dashboard route blocked", {
      permission: requiredPermission,
      pathname,
      role,
      status,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });

    return {
      allowed: false,
      permission: requiredPermission,
      reason: status !== "active" ? "inactive_member" : "permission_denied",
      role,
      status,
      supabase,
      user,
      workspaceId: selection.activeWorkspaceId
    };
  }

  console.log("[workspace-data-access] dashboard route allowed", {
    permission: requiredPermission,
    pathname,
    role,
    status,
    userId: user.id,
    workspaceId: selection.activeWorkspaceId
  });

  return {
    allowed: true,
    permission: requiredPermission,
    role,
    status,
    supabase,
    user,
    workspaceId: selection.activeWorkspaceId
  };
}

export async function requireProtectedApiAccess({
  permission,
  workspaceId
}: {
  permission: WorkspacePermission;
  workspaceId?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      context: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 })
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  if (workspaceId && workspaceId !== selection.activeWorkspaceId) {
    console.warn("[workspace-security-block] api workspace mismatch blocked", {
      requestedWorkspaceId: workspaceId,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });

    return {
      context: null,
      response: NextResponse.json(
        { error: "You do not have permission to access this section." },
        { status: 403 }
      )
    };
  }

  const { role, status } = await getWorkspaceMembershipAccess(
    supabase,
    selection.activeWorkspaceId,
    user.id
  );
  if (status !== "active" || !hasPermission(role, permission)) {
    console.warn("[workspace-access-denied] api permission blocked", {
      permission,
      role,
      status,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });

    return {
      context: null,
      response: NextResponse.json(
        { error: "You do not have permission to access this section." },
        { status: 403 }
      )
    };
  }

  return {
    context: {
      role,
      status,
      supabase,
      user,
      workspaceId: selection.activeWorkspaceId
    } satisfies WorkspaceDataContext,
    response: null
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
    console.warn("[workspace-store-access-denied] store outside active workspace", {
      message: error?.message ?? "Store not found",
      storeId,
      userId,
      workspaceId
    });
    console.warn("[workspace-security-block] unauthorized store access rejected", {
      storeId,
      userId,
      workspaceId
    });
    return false;
  }

  console.log("[workspace-store-access] store access scoped", {
    storeId,
    userId,
    workspaceId
  });

  return true;
}
