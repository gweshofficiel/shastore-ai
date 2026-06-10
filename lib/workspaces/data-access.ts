import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAccountRoleForUser } from "@/lib/account-roles";
import {
  getActiveWorkspaceForUser,
  type UserWorkspaceMembership
} from "@/lib/workspaces/active-workspace";
import {
  getDashboardPermissionForPath,
  getDashboardPermissionsForPath,
  hasPermission,
  type PermissionOverrides,
  type WorkspacePermission,
  type WorkspaceRole
} from "@/lib/permissions/rbac";
import { isCurrentUserDeliveryAccount } from "@/lib/delivery/access";
import { recordDeniedAccess } from "@/lib/security/audit";

type WorkspaceDataContextOptions = {
  permission?: WorkspacePermission;
  redirectTo?: string;
};

export type WorkspaceDataContext = {
  role: UserWorkspaceMembership["role"] | null;
  status: "active" | "pending" | "suspended" | "banned" | "removed";
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
  if (value === "pending" || value === "suspended" || value === "banned" || value === "removed") {
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
    return { overrides: {} as PermissionOverrides, role: "owner" as WorkspaceRole, status: "active" as const };
  }

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
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

  const membership = data as {
    permission_overrides?: PermissionOverrides | null;
    role?: string | null;
    status?: string | null;
  } | null;
  const role = (membership?.role ?? null) as WorkspaceRole | null;

  return {
    overrides: membership?.permission_overrides ?? {},
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

  if (await isCurrentUserDeliveryAccount(supabase, user)) {
    redirect("/delivery/dashboard");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);

  if (accountRole && accountRole.role !== "owner") {
    await recordDeniedAccess({
      action: "dashboard.role.denied",
      metadata: { accountRole: accountRole.role, status: accountRole.status },
      reason: "This account is not allowed here.",
      route: options.redirectTo ?? "/dashboard",
      userId: user.id
    });
    redirect("/login?error=role");
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { overrides, role, status } = await getWorkspaceMembershipAccess(
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
    await recordDeniedAccess({
      action: "workspace.access.denied",
      reason: "Workspace access required",
      route: options.redirectTo ?? "/dashboard",
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    redirect("/dashboard?workspace=inactive");
  }

  if (options.permission && !hasPermission(role, options.permission, overrides)) {
    console.warn("[workspace-access-denied] permission denied for workspace data", {
      permission: options.permission,
      role,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    await recordDeniedAccess({
      action: "workspace.permission.denied",
      metadata: { permission: options.permission, role },
      reason: "Access denied",
      route: options.redirectTo ?? "/dashboard",
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
  const requiredPermissions = permission ? [permission] : getDashboardPermissionsForPath(pathname);
  const requiredPermission = requiredPermissions[0] ?? getDashboardPermissionForPath(pathname);
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

  if (await isCurrentUserDeliveryAccount(supabase, user)) {
    await recordDeniedAccess({
      action: "dashboard.delivery_account.denied",
      metadata: { deliveryIsolation: true },
      reason: "Delivery accounts use the isolated delivery dashboard",
      route: pathname,
      userId: user.id
    });

    return {
      allowed: false,
      permission: requiredPermission,
      reason: "permission_denied",
      role: null,
      status: "active",
      supabase,
      user,
      workspaceId: null
    };
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);

  if (accountRole && accountRole.role !== "owner") {
    await recordDeniedAccess({
      action: "dashboard.role.denied",
      metadata: { accountRole: accountRole.role, status: accountRole.status },
      reason: "This account is not allowed here.",
      route: pathname,
      userId: user.id
    });

    return {
      allowed: false,
      permission: requiredPermission,
      reason: "permission_denied",
      role: null,
      status: "active",
      supabase,
      user,
      workspaceId: null
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const { overrides, role, status } = await getWorkspaceMembershipAccess(
    supabase,
    selection.activeWorkspaceId,
    user.id
  );
  const allowed =
    status === "active" &&
    requiredPermissions.some((candidate) => hasPermission(role, candidate, overrides));

  if (!allowed) {
    console.warn("[workspace-access-denied] dashboard route blocked", {
      permission: requiredPermission,
      pathname,
      role,
      status,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    await recordDeniedAccess({
      action: "dashboard.access.denied",
      metadata: { permission: requiredPermission, role, status },
      reason: status !== "active" ? "Workspace access required" : "Access denied",
      route: pathname,
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
    await recordDeniedAccess({
      action: "api.auth.required",
      reason: "Access denied",
      route: "/api"
    });
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
    await recordDeniedAccess({
      action: "api.workspace.denied",
      metadata: { requestedWorkspaceId: workspaceId },
      reason: "Workspace access required",
      route: "/api",
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

  const { overrides, role, status } = await getWorkspaceMembershipAccess(
    supabase,
    selection.activeWorkspaceId,
    user.id
  );
  if (status !== "active" || !hasPermission(role, permission, overrides)) {
    console.warn("[workspace-access-denied] api permission blocked", {
      permission,
      role,
      status,
      userId: user.id,
      workspaceId: selection.activeWorkspaceId
    });
    await recordDeniedAccess({
      action: "api.permission.denied",
      metadata: { permission, role, status },
      reason: "Access denied",
      route: "/api",
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
    await recordDeniedAccess({
      action: "store.workspace.denied",
      reason: "Store not found",
      route: "/dashboard/stores",
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

export async function assertStoreAccessInWorkspace({
  permission = "can_view_stores",
  storeId,
  supabase,
  userId,
  workspaceId
}: {
  permission?: WorkspacePermission;
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const { overrides, role, status } = await getWorkspaceMembershipAccess(supabase, workspaceId, userId);

  if (status !== "active" || !hasPermission(role, permission, overrides)) {
    console.warn("[workspace-store-access-denied] store permission blocked", {
      permission,
      role,
      status,
      storeId,
      userId,
      workspaceId
    });
    await recordDeniedAccess({
      action: "store.permission.denied",
      metadata: { permission, role, status },
      reason: "Access denied",
      route: "/dashboard/stores",
      storeId,
      userId,
      workspaceId
    });

    return {
      allowed: false,
      reason: "You do not have permission to access this store.",
      store: null
    };
  }

  const { data, error } = await supabase
    .from("stores")
    .select("id, workspace_id, owner_user_id, name, store_name, slug, status, created_at, updated_at")
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    console.warn("[workspace-security-block] store workspace mismatch blocked", {
      message: error?.message ?? "Store not found in active workspace",
      permission,
      storeId,
      userId,
      workspaceId
    });
    await recordDeniedAccess({
      action: "store.workspace.denied",
      metadata: { permission },
      reason: "Store not found",
      route: "/dashboard/stores",
      storeId,
      userId,
      workspaceId
    });

    return {
      allowed: false,
      reason: "You do not have permission to access this store.",
      store: null
    };
  }

  console.log("[workspace-store-access] store permission granted", {
    permission,
    role,
    status,
    storeId,
    userId,
    workspaceId
  });

  return {
    allowed: true,
    reason: null,
    store: data
  };
}
