import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export function slugifyStoreName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "store";
}

export function buildStoreSlug(name: string, suffix: string) {
  return `${slugifyStoreName(name)}-${suffix}`;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

async function isSlugTaken(
  client: SupabaseClient,
  slug: string,
  storeId: string
) {
  const normalized = normalizeSlug(slug);

  const { data: storeMatch } = await client
    .from("stores")
    .select("id")
    .eq("slug", normalized)
    .neq("id", storeId)
    .maybeSingle();

  if (storeMatch) {
    return true;
  }

  const { data: publicationMatch } = await client
    .from("published_stores")
    .select("id")
    .eq("slug", normalized)
    .neq("store_id", storeId)
    .maybeSingle();

  return Boolean(publicationMatch);
}

/**
 * Build a unique kebab-case slug for public.stores.slug (and published_stores).
 */
export async function resolveUniqueStoreSlug(
  supabase: SupabaseClient,
  name: string,
  storeId: string,
  preferredSlug?: string | null
) {
  const lookupClient = createAdminClient() ?? supabase;
  const trimmedPreferred = preferredSlug?.trim();

  if (trimmedPreferred) {
    const preferred = normalizeSlug(trimmedPreferred);
    const taken = await isSlugTaken(lookupClient, preferred, storeId);

    if (!taken) {
      return preferred;
    }
  }

  const base = buildStoreSlug(name, storeId.slice(0, 8));
  let candidate = base;
  let attempt = 0;

  while (attempt < 8) {
    const taken = await isSlugTaken(lookupClient, candidate, storeId);

    if (!taken) {
      return candidate;
    }

    candidate = buildStoreSlug(name, crypto.randomUUID().slice(0, 8));
    attempt += 1;
  }

  return buildStoreSlug(name, crypto.randomUUID().slice(0, 8));
}
