import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";
import { recordDeniedAccess } from "@/lib/security/audit";

export type AuthenticatedUser = User;

type AccessInput = {
  route?: string | null;
  storeId?: string | null;
  supabase?: SupabaseClient;
  userId: string;
  workspaceId?: string | null;
};

export async function requireAuthenticatedUser(route?: string | null) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    await recordDeniedAccess({
      action: "auth.required",
      reason: "Access denied",
      route
    });
    return { error: "Access denied" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function canAccessWorkspace({
  route,
  supabase,
  userId,
  workspaceId
}: AccessInput) {
  if (!workspaceId) {
    await recordDeniedAccess({
      action: "workspace.access.denied",
      reason: "Workspace access required",
      route,
      userId
    });
    return false;
  }

  if (workspaceId === userId) {
    return true;
  }

  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("workspace_members" as never)
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const allowed = Boolean(data && !error);

  if (!allowed) {
    await recordDeniedAccess({
      action: "workspace.access.denied",
      reason: "Workspace access required",
      route,
      userId,
      workspaceId
    });
  }

  return allowed;
}

export async function canAccessStore({
  route,
  storeId,
  supabase,
  userId,
  workspaceId
}: AccessInput & { storeId: string }) {
  const client = supabase ?? (await createClient());
  const resolvedWorkspaceId =
    workspaceId ?? (await getActiveWorkspaceForUser({ supabase: client, userId })).activeWorkspaceId;
  const access = await assertStoreAccessInWorkspace({
    permission: "can_view_stores",
    storeId,
    supabase: client,
    userId,
    workspaceId: resolvedWorkspaceId
  });

  if (!access.allowed) {
    await recordDeniedAccess({
      action: "store.access.denied",
      reason: "Store not found",
      route,
      storeId,
      userId,
      workspaceId: resolvedWorkspaceId
    });
  }

  return access.allowed;
}

export async function canManageStore({
  route,
  storeId,
  supabase,
  userId,
  workspaceId
}: AccessInput & { storeId: string }) {
  const client = supabase ?? (await createClient());
  const resolvedWorkspaceId =
    workspaceId ?? (await getActiveWorkspaceForUser({ supabase: client, userId })).activeWorkspaceId;
  const access = await assertStoreAccessInWorkspace({
    permission: "edit_store",
    storeId,
    supabase: client,
    userId,
    workspaceId: resolvedWorkspaceId
  });

  if (!access.allowed) {
    await recordDeniedAccess({
      action: "store.manage.denied",
      reason: "Access denied",
      route,
      storeId,
      userId,
      workspaceId: resolvedWorkspaceId
    });
  }

  return access.allowed;
}

export async function requireWorkspaceAccess(input: AccessInput) {
  if (!(await canAccessWorkspace(input))) {
    throw new Error("Workspace access required");
  }
}

export async function requireStoreAccess(input: AccessInput & { storeId: string }) {
  if (!(await canAccessStore(input))) {
    throw new Error("Store not found");
  }
}
