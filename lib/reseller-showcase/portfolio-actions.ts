"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerPortfolioStatus } from "@/lib/reseller-showcase/data";

type PortfolioPlaceholderAction =
  | "reseller_portfolio_archive_placeholder"
  | "reseller_portfolio_create_placeholder"
  | "reseller_portfolio_edit_placeholder"
  | "reseller_portfolio_hide_placeholder"
  | "reseller_portfolio_open_preview_placeholder"
  | "reseller_portfolio_publish_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 260) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/portfolio";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function statusForAction(action: PortfolioPlaceholderAction): ResellerPortfolioStatus {
  if (action === "reseller_portfolio_archive_placeholder") {
    return "archived";
  }

  if (action === "reseller_portfolio_hide_placeholder") {
    return "hidden";
  }

  if (action === "reseller_portfolio_publish_placeholder") {
    return "published";
  }

  return "draft";
}

async function recordPortfolioAction(formData: FormData, action: PortfolioPlaceholderAction) {
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
  const portfolioReference = cleanText(formData.get("portfolioReference")) || `portfolio-${Date.now()}`;
  const title = cleanText(formData.get("title")) || "Portfolio item placeholder";
  const portfolioType = cleanText(formData.get("portfolioType")) || "completed_store_design";
  const categoryNiche = cleanText(formData.get("categoryNiche")) || "Niche placeholder";
  const description =
    cleanText(formData.get("description"), 800) ||
    "Showcase-only portfolio placeholder. No private client or buyer data is exposed.";
  const toolsServicesUsed =
    cleanText(formData.get("toolsServicesUsed"), 500) || "Store design, Template setup, Brand polish";
  const previewUrl = cleanText(formData.get("previewUrl"), 500) || "#";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_portfolio",
      event_status: "info",
      event_type: action,
      metadata: {
        before_after_placeholder: "Before/after gallery placeholder. No private client assets are exposed.",
        category_niche: categoryNiche,
        description,
        portfolio_reference: portfolioReference,
        portfolio_status: statusForAction(action),
        portfolio_type: portfolioType,
        preview_image_placeholder: "Portfolio preview image placeholder",
        preview_url: previewUrl,
        privacy: "Portfolio showcase content only. Private client data, unpublished stores, buyer data, real orders, payments, charges, ownership transfers, wallets, payouts, withdrawals, commissions, and fake sales are not exposed or created.",
        source: "reseller_dashboard_portfolio",
        title,
        tools_services_used: toolsServicesUsed
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/portfolio");
  if (profile?.slug) {
    revalidatePath(`/resellers/${profile.slug}`);
  }
  redirect(withStatus(returnTo, "saved", action));
}

export async function createPortfolioItemPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_create_placeholder");
}

export async function editPortfolioItemPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_edit_placeholder");
}

export async function publishPortfolioItemPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_publish_placeholder");
}

export async function hidePortfolioItemPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_hide_placeholder");
}

export async function archivePortfolioItemPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_archive_placeholder");
}

export async function openPortfolioPreviewPlaceholder(formData: FormData) {
  await recordPortfolioAction(formData, "reseller_portfolio_open_preview_placeholder");
}
