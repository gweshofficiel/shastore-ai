"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resellerCategorySlug, type ResellerCategoryVisibility } from "@/lib/reseller-showcase/data";

type CategoryPlaceholderAction =
  | "reseller_category_edit_description_placeholder"
  | "reseller_category_enable"
  | "reseller_category_hide"
  | "reseller_category_reorder_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 300) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/categories";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function visibilityForAction(action: CategoryPlaceholderAction): ResellerCategoryVisibility {
  if (action === "reseller_category_hide") {
    return "hidden";
  }

  return "public";
}

async function recordCategoryAction(formData: FormData, action: CategoryPlaceholderAction) {
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
  const categoryName = cleanText(formData.get("categoryName")) || "General Store";
  const categorySlug = resellerCategorySlug(cleanText(formData.get("categorySlug")) || categoryName);
  const description = cleanText(formData.get("description"), 600) || "Category description placeholder";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_categories",
      event_status: "info",
      event_type: action,
      metadata: {
        category_name: categoryName,
        category_slug: categorySlug,
        description,
        privacy: "Reseller category organization metadata only. No order, payment, buyer charge, ownership transfer, wallet, payout, withdrawal, commission, or fake sale was created.",
        source: "reseller_dashboard_categories",
        visibility: visibilityForAction(action)
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/categories");
  revalidatePath("/reseller/dashboard/listings");
  revalidatePath("/reseller/dashboard/templates");
  revalidatePath("/reseller/dashboard/portfolio");
  if (profile?.slug) {
    revalidatePath(`/resellers/${profile.slug}`);
  }
  redirect(withStatus(returnTo, "saved", action));
}

export async function enableResellerCategoryPlaceholder(formData: FormData) {
  await recordCategoryAction(formData, "reseller_category_enable");
}

export async function hideResellerCategoryPlaceholder(formData: FormData) {
  await recordCategoryAction(formData, "reseller_category_hide");
}

export async function reorderResellerCategoriesPlaceholder(formData: FormData) {
  await recordCategoryAction(formData, "reseller_category_reorder_placeholder");
}

export async function editResellerCategoryDescriptionPlaceholder(formData: FormData) {
  await recordCategoryAction(formData, "reseller_category_edit_description_placeholder");
}
