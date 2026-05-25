import { createClient } from "@supabase/supabase-js";
import { createStoreForUser } from "@/lib/stores/ownership";

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

  const normalizedSlug = input.slug.toLowerCase().trim().replace(/\s+/g, "-");

  const { data: existingStore } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (existingStore) {
    throw new Error("Store slug already exists");
  }

  return createStoreForUser(supabase, input.ownerUserId, {
    description: input.description ?? null,
    name: input.name,
    slug: normalizedSlug,
    status: "draft",
    subscriptionPlan: "free",
    workspaceId: input.ownerUserId
  });
}