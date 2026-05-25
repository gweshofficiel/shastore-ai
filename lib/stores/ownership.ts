import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUniqueStoreSlug } from "@/lib/stores/slug";

export type OwnedStoreRecord = {
  created_at: string;
  id: string;
  owner_user_id: string;
  slug: string | null;
  status: string | null;
  store_name: string;
  subscription_plan: string;
  workspace_id: string;
};

type CreateStoreForUserInput = {
  description?: string | null;
  name: string;
  slug?: string | null;
  status?: string;
  subscriptionPlan?: string;
  templateId?: string;
  workspaceId?: string | null;
};

const ownerStoreSelect =
  "id, owner_user_id, workspace_id, store_name, slug, status, subscription_plan, created_at";

export async function getUserStores(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("stores")
    .select(ownerStoreSelect)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[store-ownership] user stores lookup failed", {
      message: error.message,
      userId
    });
    return { error: error.message, stores: [] as OwnedStoreRecord[] };
  }

  const stores = (data ?? []) as OwnedStoreRecord[];

  console.info("[store-ownership] user stores loaded", {
    count: stores.length,
    userId
  });

  return { error: null, stores };
}

export async function canAccessStore(
  supabase: SupabaseClient,
  userId: string,
  storeId: string,
  workspaceId?: string | null
) {
  const { data, error } = await supabase
    .from("stores")
    .select(ownerStoreSelect)
    .eq("id", storeId)
    .eq("workspace_id" as never, (workspaceId ?? userId) as never)
    .maybeSingle();

  if (error) {
    console.warn("[store-access] store access lookup failed", {
      message: error.message,
      storeId,
      userId
    });
    return { allowed: false, reason: "Store could not be loaded.", store: null };
  }

  const store = data as OwnedStoreRecord | null;
  const allowed = Boolean(store && store.workspace_id === (workspaceId ?? userId));

  console.info("[store-access] store access checked", {
    allowed,
    ownerUserId: store?.owner_user_id ?? null,
    storeId,
    userId,
    workspaceId: workspaceId ?? userId
  });

  return {
    allowed,
    reason: allowed ? null : "You do not have access to this store.",
    store
  };
}

export async function createStoreForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateStoreForUserInput
) {
  const storeName = input.name.trim();

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  const storeId = crypto.randomUUID();
  const slug = input.slug?.trim() || (await resolveUniqueStoreSlug(supabase, storeName, storeId));

  const payload = {
    description: input.description ?? null,
    id: storeId,
    name: storeName,
    owner_user_id: userId,
    slug,
    status: input.status ?? "draft",
    store_name: storeName,
    subscription_plan: input.subscriptionPlan ?? "free",
    template_id: input.templateId ?? "modern-store",
    user_id: userId,
    workspace_id: input.workspaceId ?? userId
  };

  console.info("[store-create] creating store for user", {
    slug,
    status: payload.status,
    userId,
    workspaceId: payload.workspace_id
  });

  const { data, error } = await supabase.from("stores").insert(payload as never).select().single();

  if (error) {
    console.error("[store-create] store insert failed", {
      code: error.code,
      message: error.message,
      slug,
      userId
    });
    throw error;
  }

  console.info("[store-create] store created", {
    storeId: (data as { id?: string } | null)?.id ?? storeId,
    userId
  });

  return data;
}
