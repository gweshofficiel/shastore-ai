"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archivePlatformPage,
  markPlatformPageDraft as markPlatformPageDraftStatus,
  publishPlatformPage
} from "@/src/lib/platform-website/platform-page-status";
import { updatePlatformPageContent, validatePlatformPageEditorDraft } from "@/src/lib/platform-website/platform-content-storage";

type PlatformWebsiteAction =
  | "admin_platform_page_archive"
  | "admin_platform_page_edit_placeholder"
  | "admin_platform_page_mark_draft"
  | "admin_platform_page_mark_published"
  | "admin_platform_page_preview"
  | "admin_platform_page_save_draft";

export type PlatformPageEditorActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

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

function parseJsonObject(value: FormDataEntryValue | null, fieldName: string) {
  const source = cleanText(value);

  if (!source) {
    return {};
  }

  try {
    const parsed = JSON.parse(source) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON object.`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === `${fieldName} must be a JSON object.`) {
      throw error;
    }

    throw new Error(`${fieldName} must be valid JSON.`);
  }
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

export async function savePlatformPageEditorDraft(
  previousState: PlatformPageEditorActionState,
  formData: FormData
): Promise<PlatformPageEditorActionState> {
  void previousState;

  try {
    const pageId = cleanText(formData.get("pageId"));
    const openGraph = {
      description: cleanText(formData.get("openGraphDescription")),
      image_url: cleanText(formData.get("openGraphImageUrl")),
      title: cleanText(formData.get("openGraphTitle"))
    };
    const translations = {
      ar: {
        content: cleanText(formData.get("translationAr")),
        status: cleanText(formData.get("translationAr")) ? "draft_ready" : "placeholder"
      },
      en: {
        content: cleanText(formData.get("translationEn")),
        status: cleanText(formData.get("translationEn")) ? "draft_ready" : "placeholder"
      },
      fr: {
        content: cleanText(formData.get("translationFr")),
        status: cleanText(formData.get("translationFr")) ? "draft_ready" : "placeholder"
      }
    };
    const input = validatePlatformPageEditorDraft({
      body: parseJsonObject(formData.get("body"), "Body"),
      canonicalPath: cleanText(formData.get("canonicalPath")),
      contentStatus: "draft_ready",
      headline: cleanText(formData.get("headline")),
      openGraph,
      seoDescription: cleanText(formData.get("seoDescription")),
      seoTitle: cleanText(formData.get("seoTitle")),
      subtitle: cleanText(formData.get("subtitle")),
      title: cleanText(formData.get("title")),
      translations
    });

    await updatePlatformPageContent(pageId, input);
    await recordPlatformWebsiteAction(formData, "admin_platform_page_save_draft");
    revalidatePath(`/admin/platform-website/pages/${pageId}`);

    return {
      message: "Draft saved. Page status and public routes were not changed.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Platform page draft could not be saved.",
      status: "error"
    };
  }
}
