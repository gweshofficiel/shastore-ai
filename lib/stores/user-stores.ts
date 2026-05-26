import type { SupabaseClient } from "@supabase/supabase-js";

export type UserStoreRow = {
  created_at: string;
  id: string;
  name: string;
  owner_user_id?: string | null;
  slug: string | null;
  status: string | null;
  store_name?: string | null;
  subscription_plan?: string | null;
  template_id?: string | null;
  theme_color?: string | null;
  workspace_id?: string | null;
};

const storeSelect =
  "id, name, store_name, owner_user_id, workspace_id, subscription_plan, status, slug, template_id, theme_color, created_at";

function isMissingOwnerUserColumn(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "PGRST204" && message.includes("owner_user_id");
}

function mergeStoreRows(rows: UserStoreRow[] | null, merged: Map<string, UserStoreRow>) {
  for (const row of rows ?? []) {
    merged.set(row.id, row);
  }
}

/**
 * Load stores owned by the authenticated user. owner_user_id is canonical; user_id remains
 * as a compatibility fallback for older Store Mode rows until all migrations are applied.
 */
export async function fetchStoresForAuthUser(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string | null
): Promise<{ error: string | null; stores: UserStoreRow[] }> {
  const merged = new Map<string, UserStoreRow>();

  if (workspaceId) {
    const byActiveWorkspace = await supabase
      .from("stores")
      .select(storeSelect)
      .eq("workspace_id" as never, workspaceId as never)
      .order("created_at", { ascending: false });

    if (byActiveWorkspace.error) {
      console.warn("[workspace-data-access] active workspace stores lookup failed", {
        message: byActiveWorkspace.error.message,
        userId,
        workspaceId
      });
      return { stores: [], error: byActiveWorkspace.error.message };
    }

    const stores = (byActiveWorkspace.data ?? []) as UserStoreRow[];

    console.log("[workspace-data-access] active workspace stores loaded", {
      count: stores.length,
      userId,
      workspaceId
    });

    return { stores, error: null };
  }

  const byOwner = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (!byOwner.error) {
    mergeStoreRows(byOwner.data as UserStoreRow[] | null, merged);
  } else if (!isMissingOwnerUserColumn(byOwner.error)) {
    return { stores: [], error: byOwner.error.message };
  }

  const byUserId = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!byUserId.error) {
    mergeStoreRows(byUserId.data as UserStoreRow[] | null, merged);
  } else if (merged.size === 0) {
    return { stores: [], error: byUserId.error.message };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members" as never)
    .select("workspace_id")
    .eq("user_id", userId);

  const workspaceIds = ((memberships ?? []) as Array<{ workspace_id?: string | null }>)
    .map((membership) => membership.workspace_id)
    .filter((workspaceId): workspaceId is string => Boolean(workspaceId));

  if (!membershipsError && workspaceIds.length) {
    const byWorkspace = await supabase
      .from("stores")
      .select(storeSelect)
      .in("workspace_id", workspaceIds)
      .order("created_at", { ascending: false });

    if (!byWorkspace.error) {
      mergeStoreRows(byWorkspace.data as UserStoreRow[] | null, merged);
    }
  }

  const stores = Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );

  return { stores, error: null };
}

export const getUserStores = fetchStoresForAuthUser;

export async function countStoresForAuthUser(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string | null
) {
  const { stores, error } = await fetchStoresForAuthUser(supabase, userId, workspaceId);
  return { count: stores.length, error };
}
