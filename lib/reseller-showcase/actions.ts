"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resellerInventoryPlanLimits, type ResellerInventoryPlan } from "@/lib/reseller-showcase/data";
import { resellerShowcaseThemes } from "@/lib/reseller-showcase/themes";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function normalizeSlug(value: FormDataEntryValue | null, fallback = "showcase") {
  const source = typeof value === "string" ? value : fallback;
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

  return slug || fallback;
}

function normalizeThemeId(value: FormDataEntryValue | null) {
  const themeId = typeof value === "string" ? value : "minimal";
  return resellerShowcaseThemes.some((theme) => theme.id === themeId) ? themeId : "minimal";
}

function parseList(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function getProfileForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("reseller_profiles" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data as { id: string; slug: string } | null;
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo = "/reseller/dashboard"): never {
  redirect(withStatus(returnTo, "error", message));
}

function resellerPlanFromConfig(): ResellerInventoryPlan {
  const configuredPlan = process.env.RESELLER_SUBSCRIPTION_PLAN ?? process.env.DEFAULT_RESELLER_PLAN;
  const normalized = configuredPlan?.trim().toLowerCase();

  if (normalized === "enterprise") {
    return "Enterprise";
  }

  if (normalized === "agency") {
    return "Agency";
  }

  if (normalized === "pro") {
    return "Pro";
  }

  return "Starter";
}

async function assertInventoryAvailable({
  profileId,
  returnTo,
  supabase,
  userId
}: {
  profileId: string;
  returnTo: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const currentPlan = resellerPlanFromConfig();
  const allowedStoreListings = resellerInventoryPlanLimits[currentPlan];
  const { count, error } = await supabase
    .from("reseller_showcase_items" as never)
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("user_id", userId);

  if (error) {
    redirectWithError("Inventory usage could not be checked. Try again before changing listings.", returnTo);
  }

  const usedStoreListings = count ?? 0;

  if (usedStoreListings >= allowedStoreListings) {
    redirectWithError(
      `Inventory limit reached for the ${currentPlan} plan. Upgrade your reseller subscription to create or publish more listings.`,
      returnTo
    );
  }
}

export async function saveResellerProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const displayName = cleanText(formData.get("displayName"), 120);

  if (!displayName) {
    redirectWithError("Showcase name is required.", returnTo);
  }

  const profile = await getProfileForUser(supabase, user.id);
  const slug = normalizeSlug(formData.get("slug"), displayName);
  const { error } = await supabase.from("reseller_profiles" as never).upsert(
    {
      accent_color: cleanText(formData.get("accentColor"), 32) ?? "#2563eb",
      banner_url: cleanText(formData.get("bannerUrl"), 500),
      bio: cleanText(formData.get("bio"), 1000),
      display_name: displayName,
      id: profile?.id,
      instagram_url: cleanText(formData.get("instagramUrl"), 500),
      is_published: formBoolean(formData, "isPublished"),
      logo_url: cleanText(formData.get("logoUrl"), 500),
      primary_color: cleanText(formData.get("primaryColor"), 32) ?? "#0f172a",
      slug,
      theme_id: normalizeThemeId(formData.get("themeId")),
      tiktok_url: cleanText(formData.get("tiktokUrl"), 500),
      user_id: user.id,
      website_url: cleanText(formData.get("websiteUrl"), 500)
    } as never,
    { onConflict: "user_id" }
  );

  if (error) {
    redirectWithError(
      "Reseller profile could not be saved. Check that the slug is unique.",
      returnTo
    );
  }

  const savedProfile = await getProfileForUser(supabase, user.id);

  if (savedProfile) {
    await supabase.from("showcase_theme_settings" as never).upsert(
      {
        profile_id: savedProfile.id,
        settings: {
          accentColor: cleanText(formData.get("accentColor"), 32) ?? "#2563eb",
          bannerUrl: cleanText(formData.get("bannerUrl"), 500),
          logoUrl: cleanText(formData.get("logoUrl"), 500),
          primaryColor: cleanText(formData.get("primaryColor"), 32) ?? "#0f172a"
        },
        theme_id: normalizeThemeId(formData.get("themeId")),
        user_id: user.id
      } as never,
      { onConflict: "profile_id" }
    );
  }

  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/showcase");
  revalidatePath("/reseller/dashboard/settings");
  revalidatePath(`/reseller/${slug}`);
  revalidatePath(`/resellers/${slug}`);
  redirect(withStatus(returnTo, "saved", "profile"));
}

export async function saveResellerShowcaseItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const profile = await getProfileForUser(supabase, user.id);
  const title = cleanText(formData.get("title"), 160);

  if (!profile) {
    redirectWithError("Create your reseller profile before adding showcase items.", returnTo);
  }

  if (!title) {
    redirectWithError("Showcase item title is required.", returnTo);
  }

  const itemId = cleanText(formData.get("itemId"), 80);
  const slug = normalizeSlug(formData.get("itemSlug"), title);
  const sourceStoreId = cleanText(formData.get("sourceStoreId"), 80);
  const publishNow = formBoolean(formData, "publishNow");

  if (!itemId || publishNow) {
    await assertInventoryAvailable({
      profileId: profile.id,
      returnTo,
      supabase,
      userId: user.id
    });
  }

  const { error } = await supabase.from("reseller_showcase_items" as never).upsert(
    {
      category: cleanText(formData.get("category"), 120),
      demo_url: cleanText(formData.get("demoUrl"), 500),
      description: cleanText(formData.get("description"), 1200),
      features: parseList(formData.get("features")),
      id: itemId ?? undefined,
      preview_images: parseList(formData.get("previewImages")),
      price_label: cleanText(formData.get("priceLabel"), 80),
      profile_id: profile.id,
      slug,
      sort_order: Number(cleanText(formData.get("sortOrder"), 20) ?? 0) || 0,
      source_store_id: sourceStoreId || null,
      status: publishNow ? "published" : "draft",
      thumbnail_url: cleanText(formData.get("thumbnailUrl"), 500),
      title,
      user_id: user.id
    } as never,
    { onConflict: "profile_id,slug" }
  );

  if (error) {
    redirectWithError(
      "Showcase item could not be saved. Check for duplicate listing slugs.",
      returnTo
    );
  }

  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/listings");
  revalidatePath("/reseller/dashboard/stores");
  revalidatePath(`/reseller/${profile.slug}`);
  revalidatePath(`/resellers/${profile.slug}`);
  redirect(withStatus(returnTo, "saved", "item"));
}

export async function publishResellerShowcaseItem(formData: FormData) {
  await setResellerShowcaseItemStatus(formData, "published");
}

export async function unpublishResellerShowcaseItem(formData: FormData) {
  await setResellerShowcaseItemStatus(formData, "unpublished");
}

async function setResellerShowcaseItemStatus(
  formData: FormData,
  status: "published" | "unpublished"
) {
  const { supabase, user } = await requireUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const itemId = cleanText(formData.get("itemId"), 80);
  const profile = await getProfileForUser(supabase, user.id);

  if (!itemId || !profile) {
    redirectWithError("Showcase item could not be found.", returnTo);
  }

  if (status === "published") {
    await assertInventoryAvailable({
      profileId: profile.id,
      returnTo,
      supabase,
      userId: user.id
    });
  }

  const { error } = await supabase
    .from("reseller_showcase_items" as never)
    .update({ status } as never)
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithError("Showcase item status could not be updated.", returnTo);
  }

  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/listings");
  revalidatePath("/reseller/dashboard/stores");
  revalidatePath(`/reseller/${profile.slug}`);
  revalidatePath(`/resellers/${profile.slug}`);
  redirect(withStatus(returnTo, "saved", status));
}
