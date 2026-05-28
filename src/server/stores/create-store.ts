import type { SupabaseClient } from "@supabase/supabase-js";
import { createStoreForUser } from "@/lib/stores/ownership";

type CreateStoreInput = {
  ownerUserId: string;
  name: string;
  slug: string;
  description?: string;
  supabase: SupabaseClient;
  workspaceId: string;
};

export async function createStore(input: CreateStoreInput) {
  const normalizedSlug = input.slug.toLowerCase().trim().replace(/\s+/g, "-");

  const { data: existingStore } = await input.supabase
    .from("stores")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (existingStore) {
    throw new Error("Store slug already exists");
  }

  return createStoreForUser(input.supabase, input.ownerUserId, {
    description: input.description ?? null,
    name: input.name,
    slug: normalizedSlug,
    status: "draft",
    subscriptionPlan: "free",
    workspaceId: input.workspaceId
  });
}
