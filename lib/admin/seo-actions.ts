"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type SEOAdminAction =
  | "admin_seo_generate_sitemap_placeholder"
  | "admin_seo_mark_reviewed"
  | "admin_seo_preview"
  | "admin_seo_validate_robots_placeholder"
  | "admin_seo_validate_structured_data_placeholder";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordSEOAdminAction(formData: FormData, action: SEOAdminAction) {
  const access = await getAdminAccess();
  const slug = cleanText(formData.get("slug"));
  const pageTitle = cleanText(formData.get("pageTitle"));

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for SEO controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_seo",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder platform SEO action only. No Store Owner SEO, Platform Website content, sitemap route, robots route, or structured data runtime was modified.",
      page_title: pageTitle || null,
      slug: slug || null,
      source: "super_admin_seo_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/seo");
}

export async function previewSEO(formData: FormData) {
  await recordSEOAdminAction(formData, "admin_seo_preview");
}

export async function markSEOReviewed(formData: FormData) {
  await recordSEOAdminAction(formData, "admin_seo_mark_reviewed");
}

export async function generateSitemapPlaceholder(formData: FormData) {
  await recordSEOAdminAction(formData, "admin_seo_generate_sitemap_placeholder");
}

export async function validateRobotsPlaceholder(formData: FormData) {
  await recordSEOAdminAction(formData, "admin_seo_validate_robots_placeholder");
}

export async function validateStructuredDataPlaceholder(formData: FormData) {
  await recordSEOAdminAction(formData, "admin_seo_validate_structured_data_placeholder");
}
