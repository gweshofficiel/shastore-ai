"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archivePlatformPage,
  markPlatformPageDraft as markPlatformPageDraftStatus,
  publishPlatformPage
} from "@/src/lib/platform-website/platform-page-status";

type PlatformWebsiteAction =
  | "admin_platform_page_archive"
  | "admin_platform_page_edit_placeholder"
  | "admin_platform_page_mark_draft"
  | "admin_platform_page_mark_published"
  | "admin_platform_page_preview";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordPlatformWebsiteAction(
  formData: FormData,
  action: PlatformWebsiteAction,
  statusChange?: {
    nextStatus: string;
    previousStatus: string;
  }
) {
  const access = await getAdminAccess();
  const pageId = cleanText(formData.get("pageId"));
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
      pageId,
      slug,
      source: "super_admin_platform_website_management",
      statusChange: statusChange ?? null,
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
  const result = await markPlatformPageDraftStatus(cleanText(formData.get("pageId")));
  await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_draft", result);
}

export async function markPlatformPagePublished(formData: FormData) {
  const result = await publishPlatformPage(cleanText(formData.get("pageId")));
  await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_published", result);
}

export async function editPlatformPagePlaceholder(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_edit_placeholder");
}

export async function archivePlatformPagePlaceholder(formData: FormData) {
  const result = await archivePlatformPage(cleanText(formData.get("pageId")));
  await recordPlatformWebsiteAction(formData, "admin_platform_page_archive", result);
}
