import type { SupabaseClient } from "@supabase/supabase-js";

export type UserStoreRow = {
  created_at: string;
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};

const storeSelect = "id, name, status, slug, created_at";

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
 * Load stores owned by the authenticated user via user_id OR owner_user_id.
 * Uses two explicit queries so results are reliable across PostgREST versions and RLS.
 */
export async function fetchStoresForAuthUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error: string | null; stores: UserStoreRow[] }> {
  const merged = new Map<string, UserStoreRow>();

  const byUserId = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (byUserId.error) {
    return { stores: [], error: byUserId.error.message };
  }

  mergeStoreRows(byUserId.data as UserStoreRow[] | null, merged);

  const byOwner = await supabase
    .from("stores")
    .select(storeSelect)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (!byOwner.error) {
    mergeStoreRows(byOwner.data as UserStoreRow[] | null, merged);
  } else if (!isMissingOwnerUserColumn(byOwner.error) && merged.size === 0) {
    return { stores: [], error: byOwner.error.message };
  }

  const stores = Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );

  return { stores, error: null };
}

export async function countStoresForAuthUser(supabase: SupabaseClient, userId: string) {
  const { stores, error } = await fetchStoresForAuthUser(supabase, userId);
  return { count: stores.length, error };
}
