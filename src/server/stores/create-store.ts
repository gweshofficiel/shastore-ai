import { createClient } from "@supabase/supabase-js";

type CreateStoreInput = {
  ownerUserId: string;
  name: string;
  slug: string;
  description?: string;
};

export async function createStore(input: CreateStoreInput) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const normalizedSlug = input.slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");

  const { data: existingStore } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (existingStore) {
    throw new Error("Store slug already exists");
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      owner_user_id: input.ownerUserId,
      name: input.name,
      slug: normalizedSlug,
      description: input.description ?? null,
      status: "draft",
      provisioning_state: "pending",
      subscription_plan: "free",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}