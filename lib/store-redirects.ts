import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreRedirectRow = {
  destination_url: string;
  id: string;
  redirect_type: 301 | 302;
  source_path: string;
  store_id: string;
};

function stripUrlOrigin(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

export function normalizeRedirectSource(value: string | null | undefined) {
  const raw = stripUrlOrigin(value?.trim() ?? "")
    .replace(/#.*$/, "")
    .replace(/\?.*$/, "")
    .replace(/\/{2,}/g, "/");
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const normalized = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;

  return normalized.toLowerCase().slice(0, 500);
}

export function normalizeRedirectDestination(value: string | null | undefined) {
  const text = value?.trim().slice(0, 1000) ?? "";

  if (!text) {
    return "";
  }

  if (text.startsWith("https://") || text.startsWith("http://")) {
    return text;
  }

  return text.startsWith("/") ? text : `/${text}`;
}

export function redirectDestinationPath(value: string) {
  return normalizeRedirectSource(stripUrlOrigin(value));
}

export function isRedirectLoop(sourcePath: string, destinationUrl: string) {
  return normalizeRedirectSource(sourcePath) === redirectDestinationPath(destinationUrl);
}

export async function resolveStoreRedirect({
  sourcePath,
  storeId,
  supabase
}: {
  sourcePath: string;
  storeId: string;
  supabase: SupabaseClient;
}) {
  const normalizedSource = normalizeRedirectSource(sourcePath);

  if (!normalizedSource || normalizedSource === "/") {
    return null;
  }

  const { data } = await supabase
    .from("store_redirects" as never)
    .select("id, store_id, source_path, destination_url, redirect_type")
    .eq("store_id" as never, storeId as never)
    .eq("source_path" as never, normalizedSource as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  return data as StoreRedirectRow | null;
}

export async function recordStoreRedirectHit({
  redirectId,
  supabase
}: {
  redirectId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.rpc("record_store_redirect_hit" as never, {
    p_redirect_id: redirectId
  } as never);

  if (error) {
    console.warn("[store-redirects] hit count skipped", {
      message: error.message,
      redirectId
    });
  }
}
