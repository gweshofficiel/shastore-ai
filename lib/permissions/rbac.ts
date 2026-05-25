import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export type WorkspaceRole = "owner" | "admin" | "editor" | "support";

export type WorkspacePermission =
  | "manage_billing"
  | "manage_team"
  | "create_store"
  | "edit_store"
  | "publish_store"
  | "manage_domains"
  | "manage_products"
  | "view_orders"
  | "manage_orders"
  | "view_analytics"
  | "export_data";

export const rolePermissions: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
    "manage_billing",
    "manage_team",
    "create_store",
    "edit_store",
    "publish_store",
    "manage_domains",
    "manage_products",
    "view_orders",
    "manage_orders",
    "view_analytics",
    "export_data"
  ],
  admin: [
    "manage_team",
    "create_store",
    "edit_store",
    "publish_store",
    "manage_domains",
    "manage_products",
    "view_orders",
    "manage_orders",
    "view_analytics",
    "export_data"
  ],
  editor: [
    "create_store",
    "edit_store",
    "publish_store",
    "manage_products",
    "view_orders",
    "view_analytics",
    "export_data"
  ],
  support: ["view_orders", "view_analytics"]
};

export class PermissionDeniedError extends Error {
  permission: WorkspacePermission;
  role: WorkspaceRole | null;
  userId: string;
  workspaceId: string;

  constructor({
    permission,
    role,
    userId,
    workspaceId
  }: {
    permission: WorkspacePermission;
    role: WorkspaceRole | null;
    userId: string;
    workspaceId: string;
  }) {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
    this.permission = permission;
    this.role = role;
    this.userId = userId;
    this.workspaceId = workspaceId;
  }
}

function isWorkspaceRole(value: string | null | undefined): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "editor" || value === "support";
}

export function hasPermission(
  role: WorkspaceRole | null | undefined,
  permission: WorkspacePermission
) {
  return Boolean(role && rolePermissions[role]?.includes(permission));
}

export async function getUserWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  if (workspaceId === userId) {
    console.info("[rbac] owner fallback role resolved", { userId, workspaceId });
    return "owner";
  }

  const { data, error } = await supabase
    .from("workspace_members" as never)
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[rbac] role lookup failed", {
      message: error.message,
      userId,
      workspaceId
    });
    return null;
  }

  const role = (data as { role?: string | null } | null)?.role ?? null;
  const resolvedRole = isWorkspaceRole(role) ? role : null;

  console.info("[rbac] workspace role resolved", {
    role: resolvedRole,
    userId,
    workspaceId
  });

  return resolvedRole;
}

export async function requirePermission({
  permission,
  supabase,
  userId,
  workspaceId
}: {
  permission: WorkspacePermission;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const role = await getUserWorkspaceRole(supabase, workspaceId, userId);
  const allowed = hasPermission(role, permission);

  if (!allowed) {
    console.warn("[permission-denied] workspace permission denied", {
      permission,
      role,
      userId,
      workspaceId
    });
    throw new PermissionDeniedError({ permission, role, userId, workspaceId });
  }

  console.info("[permission-granted] workspace permission granted", {
    permission,
    role,
    userId,
    workspaceId
  });

  return { role };
}

export async function getUserPrimaryWorkspaceId(supabase: SupabaseClient, userId: string) {
  const selection = await getActiveWorkspaceForUser({ supabase, userId });

  console.info("[workspace-selection] primary workspace resolved", {
    source: selection.source,
    userId,
    workspaceId: selection.activeWorkspaceId
  });

  return selection.activeWorkspaceId;
}
