"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SearchOptimizationPlaceholderAction =
  | "reseller_search_edit_seo_placeholder"
  | "reseller_search_improve_metadata_placeholder"
  | "reseller_search_mark_optimized_placeholder"
  | "reseller_search_preview_snippet_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/search-optimization";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

async function recordSearchOptimizationAction(
  formData: FormData,
  action: SearchOptimizationPlaceholderAction
) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("slug")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as { slug?: string } | null;
  const itemReference = cleanText(formData.get("itemReference")) || "search-item-placeholder";
  const itemType = cleanText(formData.get("itemType")) || "profile";
  const marketplaceTitle = cleanText(formData.get("marketplaceTitle")) || "Marketplace title placeholder";
  const keywordsTags = cleanText(formData.get("keywordsTags"), 500) || "keyword placeholder";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_search_optimization",
      event_status: "info",
      event_type: action,
      metadata: {
        item_reference: itemReference,
        item_type: itemType,
        keywords_tags: keywordsTags,
        marketplace_title: marketplaceTitle,
        privacy: "Search optimization metadata placeholder only. No paid boost, fake traffic, fake sales, wallet, payout, withdrawal, commission, order, buyer charge, or ownership transfer was created.",
        source: "reseller_dashboard_search_optimization"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/search-optimization");
  if (profile?.slug) {
    revalidatePath(`/resellers/${profile.slug}`);
  }
  redirect(withStatus(returnTo, "saved", action));
}

export async function editSearchSeoPlaceholder(formData: FormData) {
  await recordSearchOptimizationAction(formData, "reseller_search_edit_seo_placeholder");
}

export async function improveSearchMetadataPlaceholder(formData: FormData) {
  await recordSearchOptimizationAction(formData, "reseller_search_improve_metadata_placeholder");
}

export async function previewMarketplaceSnippetPlaceholder(formData: FormData) {
  await recordSearchOptimizationAction(formData, "reseller_search_preview_snippet_placeholder");
}

export async function markSearchOptimizedPlaceholder(formData: FormData) {
  await recordSearchOptimizationAction(formData, "reseller_search_mark_optimized_placeholder");
}
