"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  resellerInventoryPlanLimits,
  resellerTemplateInventoryPlanLimits,
  type ResellerInventoryPlan
} from "@/lib/reseller-showcase/data";
import type { ResellerShowcaseItemStatus } from "@/lib/reseller-showcase/types";
import { createClient } from "@/lib/supabase/server";

type VisibilityAction =
  | "boosted_placeholder"
  | "featured_ready"
  | "hidden"
  | "private"
  | "public";

type ShowcaseItemRecord = {
  id: string;
  preview_images?: unknown;
  status: ResellerShowcaseItemStatus;
};

const publicMarketplaceStatuses: ResellerShowcaseItemStatus[] = [
  "boosted_placeholder",
  "featured_ready",
  "public",
  "published"
];

function cleanText(value: FormDataEntryValue | null, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/listings";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
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

function isTemplateShowcaseRecord(row: { preview_images?: unknown }) {
  return Array.isArray(row.preview_images)
    ? row.preview_images.map((item) => String(item)).some((item) => item.startsWith("template:"))
    : false;
}

function isPublicStatus(status: ResellerShowcaseItemStatus) {
  return publicMarketplaceStatuses.includes(status);
}

function isMissingTemplateDraftsTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("template_drafts") ||
    message.includes("could not find the table")
  );
}

async function assertStoreInventoryAvailable({
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
  const { data, error } = await supabase
    .from("reseller_showcase_items" as never)
    .select("preview_images")
    .eq("profile_id", profileId)
    .eq("user_id", userId);

  if (error) {
    redirectWithError("Store listing inventory could not be checked before changing marketplace visibility.", returnTo);
  }

  const usedStoreListings = ((data ?? []) as unknown as Array<{ preview_images?: unknown }>).filter(
    (item) => !isTemplateShowcaseRecord(item)
  ).length;

  if (usedStoreListings >= allowedStoreListings) {
    redirectWithError(
      `Store listing inventory limit reached for the ${currentPlan} plan. Upgrade before publishing more marketplace listings.`,
      returnTo
    );
  }
}

async function assertTemplateInventoryAvailable({
  returnTo,
  supabase,
  userId
}: {
  returnTo: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const currentPlan = resellerPlanFromConfig();
  const allowedTemplates = resellerTemplateInventoryPlanLimits[currentPlan];
  const { count, error } = await supabase
    .from("template_drafts" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    redirectWithError(
      isMissingTemplateDraftsTable(error)
        ? "Template persistence is not ready yet. Apply the template persistence migration before publishing templates."
        : "Template inventory could not be checked before changing marketplace visibility.",
      returnTo
    );
  }

  if ((count ?? 0) >= allowedTemplates) {
    redirectWithError(
      `Template inventory limit reached for the ${currentPlan} plan. Upgrade before publishing more marketplace templates.`,
      returnTo
    );
  }
}

async function updateMarketplaceVisibility(formData: FormData, visibility: VisibilityAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const returnTo = safeReturnPath(formData.get("returnTo"));
  const itemId = cleanText(formData.get("itemId"));

  if (!itemId) {
    redirectWithError("Marketplace item could not be found.", returnTo);
  }

  const { data: profile } = await supabase
    .from("reseller_profiles" as never)
    .select("id, slug")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRef = profile as { id: string; slug: string } | null;

  if (!profileRef) {
    redirectWithError("Create your reseller profile before changing marketplace visibility.", returnTo);
  }

  const { data: itemData, error: itemError } = await supabase
    .from("reseller_showcase_items" as never)
    .select("id, preview_images, status")
    .eq("id", itemId)
    .eq("profile_id", profileRef.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError || !itemData) {
    redirectWithError("Marketplace item could not be found.", returnTo);
  }

  const item = itemData as ShowcaseItemRecord;
  const targetIsPublic = isPublicStatus(visibility);
  const currentIsPublic = isPublicStatus(item.status);

  if (targetIsPublic && !currentIsPublic) {
    if (isTemplateShowcaseRecord(item)) {
      await assertTemplateInventoryAvailable({ returnTo, supabase, userId: user.id });
    } else {
      await assertStoreInventoryAvailable({
        profileId: profileRef.id,
        returnTo,
        supabase,
        userId: user.id
      });
    }
  }

  const { error } = await supabase
    .from("reseller_showcase_items" as never)
    .update({ status: visibility } as never)
    .eq("id", item.id)
    .eq("profile_id", profileRef.id)
    .eq("user_id", user.id);

  if (error) {
    redirectWithError("Marketplace visibility could not be updated.", returnTo);
  }

  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/listings");
  revalidatePath("/reseller/dashboard/stores");
  revalidatePath("/reseller/dashboard/templates");
  revalidatePath("/reseller/dashboard/showcase");
  revalidatePath("/reseller/dashboard/subscription");
  revalidatePath(`/reseller/${profileRef.slug}`);
  revalidatePath(`/resellers/${profileRef.slug}`);

  redirect(withStatus(returnTo, "saved", `visibility-${visibility}`));
}

export async function publishToMarketplace(formData: FormData) {
  await updateMarketplaceVisibility(formData, "public");
}

export async function hideFromMarketplace(formData: FormData) {
  await updateMarketplaceVisibility(formData, "hidden");
}

export async function markMarketplacePrivate(formData: FormData) {
  await updateMarketplaceVisibility(formData, "private");
}

export async function requestFeaturedPlaceholder(formData: FormData) {
  await updateMarketplaceVisibility(formData, "featured_ready");
}

export async function requestBoostPlaceholder(formData: FormData) {
  await updateMarketplaceVisibility(formData, "boosted_placeholder");
}
