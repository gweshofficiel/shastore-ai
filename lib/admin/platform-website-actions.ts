"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type PlatformWebsiteAction =
  | "admin_platform_page_archive"
  | "admin_platform_page_edit_placeholder"
  | "admin_platform_page_mark_draft"
  | "admin_platform_page_mark_published"
  | "admin_platform_page_preview";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordPlatformWebsiteAction(formData: FormData, action: PlatformWebsiteAction) {
  const access = await getAdminAccess();
  const slug = cleanText(formData.get("slug"));
  const title = cleanText(formData.get("title"));

  if (!slug) {
    throw new Error("Missing platform page slug.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform website controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_website_page",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder platform website action only. Store owner pages and storefront runtime were not changed.",
      slug,
      source: "super_admin_platform_website_management",
      title
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/platform-website");
}

export async function previewPlatformPage(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_preview");
}

export async function markPlatformPageDraft(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_draft");
}

export async function markPlatformPagePublished(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_published");
}

export async function editPlatformPagePlaceholder(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_edit_placeholder");
}

export async function archivePlatformPagePlaceholder(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_archive");
}
