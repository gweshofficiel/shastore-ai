"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archivePlatformBlogPost,
  createPlatformBlogDraft,
  publishPlatformBlogPost,
  revertPlatformBlogPostToDraft,
  updatePlatformBlogPostTaxonomy,
  updatePlatformBlogDraft,
  type PlatformBlogPostRecord
} from "@/src/lib/platform-website/blog/platform-blog-service";
import {
  archiveCategory,
  createCategory,
  updateCategory,
  type PlatformBlogCategoryRecord
} from "@/src/lib/platform-website/blog/categories-service";
import {
  archiveTag,
  createTag,
  updateTag,
  type PlatformBlogTagRecord
} from "@/src/lib/platform-website/blog/tags-service";
import {
  createPageBlock,
  deleteDraftPageBlock,
  duplicatePageBlock,
  hidePageBlock,
  publishPageBlock,
  reorderPageBlocks,
  showPageBlock,
  updatePageBlock,
  type PlatformPageBlockType
} from "@/src/lib/platform-website/platform-blocks-runtime";
import {
  archivePlatformPage,
  publishPlatformPage,
  revertPlatformPageToDraft
} from "@/src/lib/platform-website/platform-publishing-workflow";
import { updatePlatformPageContent, validatePlatformPageEditorDraft } from "@/src/lib/platform-website/platform-content-storage";
import {
  applySeoDraft,
  generateSeoDraft,
  validateSeoDraft,
  type PlatformSeoDraft
} from "@/src/lib/platform-website/platform-seo-generator";
import { updatePlatformPageTranslation } from "@/src/lib/platform-website/platform-translation-management";

type PlatformWebsiteAction =
  | "admin_platform_blog_archive"
  | "admin_platform_blog_category_archive"
  | "admin_platform_blog_category_create"
  | "admin_platform_blog_category_update"
  | "admin_platform_blog_create_draft"
  | "admin_platform_blog_publish"
  | "admin_platform_blog_revert_draft"
  | "admin_platform_blog_save_editor"
  | "admin_platform_blog_tag_archive"
  | "admin_platform_blog_tag_create"
  | "admin_platform_blog_tag_update"
  | "admin_platform_blog_update_draft"
  | "admin_platform_page_block_create"
  | "admin_platform_page_block_delete_draft"
  | "admin_platform_page_block_duplicate"
  | "admin_platform_page_block_hide"
  | "admin_platform_page_block_publish"
  | "admin_platform_page_block_reorder"
  | "admin_platform_page_block_show"
  | "admin_platform_page_block_update"
  | "admin_platform_page_archive"
  | "admin_platform_page_edit_placeholder"
  | "admin_platform_page_mark_draft"
  | "admin_platform_page_mark_published"
  | "admin_platform_page_preview"
  | "admin_platform_page_save_draft"
  | "admin_platform_seo_draft_applied"
  | "admin_platform_seo_draft_discarded"
  | "admin_platform_seo_draft_generated"
  | "admin_platform_translation_mark_needs_review"
  | "admin_platform_translation_mark_ready"
  | "admin_platform_translation_save_draft";

export type PlatformPageEditorActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

export type PlatformSeoGeneratorActionState = {
  draft: PlatformSeoDraft | null;
  message: string;
  status: "error" | "idle" | "success";
};

export type PlatformTranslationActionState = PlatformPageEditorActionState;
export type PlatformPageBlockActionState = PlatformPageEditorActionState;
export type PlatformBlogEditorActionState = PlatformPageEditorActionState;

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function platformWebsiteRedirect(status: "error" | "success", message: string) {
  const params = new URLSearchParams({
    message,
    status
  });

  redirect(`/admin/platform-website?${params.toString()}`);
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
      note: "Super Admin platform website action only. Store owner pages, storefront runtime, and public rendering were not changed.",
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

async function recordPlatformBlogAction(action: PlatformWebsiteAction, post: PlatformBlogPostRecord | null) {
  const access = await getAdminAccess();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform blog controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_blog_post",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Super Admin platform blog foundation action only. Customer store blogs and public blog routes were not changed.",
      postId: post?.id ?? null,
      slug: post?.slug ?? null,
      source: "super_admin_platform_blog_foundation",
      status: post?.status ?? null,
      title: post?.title ?? null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/platform-website");
}

async function recordPlatformBlogTaxonomyAction(
  action: PlatformWebsiteAction,
  item: PlatformBlogCategoryRecord | PlatformBlogTagRecord | null,
  entityType: "admin_platform_blog_category" | "admin_platform_blog_tag"
) {
  const access = await getAdminAccess();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform blog taxonomy controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: entityType,
    event_status: "info",
    event_type: action,
    metadata: {
      id: item?.id ?? null,
      name: item?.name ?? null,
      note: "Super Admin platform blog taxonomy action only. Customer store blogs and public customer routes were not changed.",
      slug: item?.slug ?? null,
      source: "super_admin_platform_blog_taxonomy",
      status: item?.status ?? null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/platform-website");
  revalidatePath("/blog");
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

function parseSeoDraft(value: FormDataEntryValue | null) {
  const source = cleanText(value);

  if (!source) {
    throw new Error("SEO draft is required before applying.");
  }

  try {
    return validateSeoDraft(JSON.parse(source) as unknown);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("SEO draft must be valid JSON.");
  }
}

function blogInputFromFormData(formData: FormData) {
  return {
    authorName: cleanText(formData.get("authorName")),
    content: parseJsonObject(formData.get("content"), "Blog content"),
    coverImageUrl: cleanText(formData.get("coverImageUrl")),
    excerpt: cleanText(formData.get("excerpt")),
    seoDescription: cleanText(formData.get("seoDescription")),
    seoTitle: cleanText(formData.get("seoTitle")),
    slug: cleanText(formData.get("postSlug")),
    title: cleanText(formData.get("postTitle")),
    translations: parseJsonObject(formData.get("translations"), "Blog translations")
  };
}

function categoryInputFromFormData(formData: FormData) {
  return {
    description: cleanText(formData.get("categoryDescription")),
    name: cleanText(formData.get("categoryName")),
    seoDescription: cleanText(formData.get("categorySeoDescription")),
    seoTitle: cleanText(formData.get("categorySeoTitle")),
    slug: cleanText(formData.get("categorySlug")),
    translations: parseJsonObject(formData.get("categoryTranslations"), "Category translations")
  };
}

function tagInputFromFormData(formData: FormData) {
  return {
    name: cleanText(formData.get("tagName")),
    slug: cleanText(formData.get("tagSlug")),
    translations: parseJsonObject(formData.get("tagTranslations"), "Tag translations")
  };
}

function taxonomyIds(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => cleanText(value)).filter(Boolean);
}

function parseOptionalJsonObject(value: FormDataEntryValue | null, fieldName: string) {
  const source = cleanText(value);

  return source ? parseJsonObject(value, fieldName) : null;
}

function parseJsonArray(value: FormDataEntryValue | null, fieldName: string) {
  const source = cleanText(value);

  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array.`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === `${fieldName} must be a JSON array.`) {
      throw error;
    }

    throw new Error(`${fieldName} must be valid JSON.`);
  }
}

function parseNumber(value: FormDataEntryValue | null) {
  const cleaned = cleanText(value);
  const parsed = Number.parseInt(cleaned, 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

function blockInputFromFormData(formData: FormData) {
  const baseSettings = parseOptionalJsonObject(formData.get("settings"), "Block settings") ?? {};
  const blockType = cleanText(formData.get("blockType")) as PlatformPageBlockType;
  const blockSettings = {
    ...baseSettings,
    button_label: cleanText(formData.get("buttonLabel")) || undefined,
    button_url: cleanText(formData.get("buttonUrl")) || undefined,
    items: parseJsonArray(formData.get("items"), "Feature items"),
    links: parseJsonArray(formData.get("links"), "Footer links"),
    metrics: parseJsonArray(formData.get("metrics"), "Stats metrics"),
    plan_refs: parseJsonArray(formData.get("planRefs"), "Pricing plan refs"),
    primary_cta_label: cleanText(formData.get("primaryCtaLabel")) || undefined,
    primary_cta_url: cleanText(formData.get("primaryCtaUrl")) || undefined,
    questions: parseJsonArray(formData.get("questions"), "FAQ questions"),
    quotes: parseJsonArray(formData.get("quotes"), "Testimonial quotes"),
    secondary_cta_label: cleanText(formData.get("secondaryCtaLabel")) || undefined,
    secondary_cta_url: cleanText(formData.get("secondaryCtaUrl")) || undefined,
    static_items: parseJsonArray(formData.get("staticItems"), "Pricing static items")
  };

  return {
    blockType,
    content: parseJsonObject(formData.get("content"), "Block content"),
    pageId: cleanText(formData.get("pageId")),
    settings: Object.fromEntries(Object.entries(blockSettings).filter(([, value]) => value !== undefined)),
    sortOrder: parseNumber(formData.get("sortOrder")),
    status: cleanText(formData.get("blockStatus")) === "published" || cleanText(formData.get("blockStatus")) === "hidden"
      ? cleanText(formData.get("blockStatus")) as "hidden" | "published"
      : "draft" as const,
    subtitle: cleanText(formData.get("blockSubtitle")),
    title: cleanText(formData.get("blockTitle"))
  };
}

async function recordBlockAction(formData: FormData, action: PlatformWebsiteAction) {
  await recordPlatformWebsiteAction(formData, action);
  revalidatePath(`/admin/platform-website/pages/${cleanText(formData.get("pageId"))}`);
  revalidatePath(`/admin/platform-website/builder/${cleanText(formData.get("pageId"))}`);
}

function translationInputFromFormData(formData: FormData, status: "needs_review" | "partial" | "ready") {
  return {
    body: parseJsonObject(formData.get("body"), "Body"),
    headline: cleanText(formData.get("headline")),
    openGraph: {
      description: cleanText(formData.get("openGraphDescription")),
      title: cleanText(formData.get("openGraphTitle"))
    },
    seoDescription: cleanText(formData.get("seoDescription")),
    seoTitle: cleanText(formData.get("seoTitle")),
    status,
    subtitle: cleanText(formData.get("subtitle")),
    title: cleanText(formData.get("title"))
  };
}

async function savePlatformTranslationWithStatus(
  formData: FormData,
  status: "needs_review" | "partial" | "ready"
): Promise<PlatformTranslationActionState> {
  try {
    const locale = cleanText(formData.get("locale"));
    const pageId = cleanText(formData.get("pageId"));

    await updatePlatformPageTranslation(pageId, locale, translationInputFromFormData(formData, status));
    await recordPlatformWebsiteAction(
      formData,
      status === "ready"
        ? "admin_platform_translation_mark_ready"
        : status === "needs_review"
          ? "admin_platform_translation_mark_needs_review"
          : "admin_platform_translation_save_draft"
    );
    revalidatePath(`/admin/platform-website/translations/${pageId}/${locale}`);

    return {
      message: status === "ready"
        ? "Translation marked ready."
        : status === "needs_review"
          ? "Translation marked needs review."
          : "Translation draft saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Platform translation could not be saved.",
      status: "error"
    };
  }
}

export async function previewPlatformPage(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_preview");
}

export async function markPlatformPageDraft(formData: FormData) {
  let message = "Reverted to draft";
  let status: "error" | "success" = "success";

  try {
    const result = await revertPlatformPageToDraft(cleanText(formData.get("pageId")));
    await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_draft", result);
    message = result.message;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not revert platform page to draft.";
  }

  platformWebsiteRedirect(status, message);
}

export async function markPlatformPagePublished(formData: FormData) {
  let message = "Published";
  let status: "error" | "success" = "success";

  try {
    const result = await publishPlatformPage(cleanText(formData.get("pageId")));
    await recordPlatformWebsiteAction(formData, "admin_platform_page_mark_published", result);
    message = result.message;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not publish platform page.";
  }

  platformWebsiteRedirect(status, message);
}

export async function editPlatformPagePlaceholder(formData: FormData) {
  await recordPlatformWebsiteAction(formData, "admin_platform_page_edit_placeholder");
}

export async function archivePlatformPagePlaceholder(formData: FormData) {
  let message = "Archived";
  let status: "error" | "success" = "success";

  try {
    const result = await archivePlatformPage(cleanText(formData.get("pageId")));
    await recordPlatformWebsiteAction(formData, "admin_platform_page_archive", result);
    message = result.message;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not archive platform page.";
  }

  platformWebsiteRedirect(status, message);
}

export async function createPlatformBlogDraftAction(formData: FormData) {
  let message = "Blog draft created";
  let status: "error" | "success" = "success";

  try {
    const post = await createPlatformBlogDraft(blogInputFromFormData(formData));
    await recordPlatformBlogAction("admin_platform_blog_create_draft", post);
    message = `Blog draft created: ${post?.title ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not create platform blog draft.";
  }

  platformWebsiteRedirect(status, message);
}

export async function updatePlatformBlogDraftAction(formData: FormData) {
  let message = "Blog draft updated";
  let status: "error" | "success" = "success";

  try {
    const post = await updatePlatformBlogDraft(cleanText(formData.get("postId")), blogInputFromFormData(formData));
    await recordPlatformBlogAction("admin_platform_blog_update_draft", post);
    message = `Blog draft updated: ${post?.title ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not update platform blog draft.";
  }

  platformWebsiteRedirect(status, message);
}

export async function archivePlatformBlogPostAction(formData: FormData) {
  let message = "Blog post archived";
  let status: "error" | "success" = "success";

  try {
    const post = await archivePlatformBlogPost(cleanText(formData.get("postId")));
    await recordPlatformBlogAction("admin_platform_blog_archive", post);
    message = `Blog post archived: ${post?.title ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not archive platform blog post.";
  }

  platformWebsiteRedirect(status, message);
}

export async function createPlatformBlogCategoryAction(formData: FormData) {
  let message = "Blog category created";
  let status: "error" | "success" = "success";

  try {
    const category = await createCategory(categoryInputFromFormData(formData));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_category_create", category, "admin_platform_blog_category");
    message = `Blog category created: ${category?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not create platform blog category.";
  }

  platformWebsiteRedirect(status, message);
}

export async function updatePlatformBlogCategoryAction(formData: FormData) {
  let message = "Blog category updated";
  let status: "error" | "success" = "success";

  try {
    const category = await updateCategory(cleanText(formData.get("categoryId")), categoryInputFromFormData(formData));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_category_update", category, "admin_platform_blog_category");
    message = `Blog category updated: ${category?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not update platform blog category.";
  }

  platformWebsiteRedirect(status, message);
}

export async function archivePlatformBlogCategoryAction(formData: FormData) {
  let message = "Blog category archived";
  let status: "error" | "success" = "success";

  try {
    const category = await archiveCategory(cleanText(formData.get("categoryId")));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_category_archive", category, "admin_platform_blog_category");
    message = `Blog category archived: ${category?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not archive platform blog category.";
  }

  platformWebsiteRedirect(status, message);
}

export async function createPlatformBlogTagAction(formData: FormData) {
  let message = "Blog tag created";
  let status: "error" | "success" = "success";

  try {
    const tag = await createTag(tagInputFromFormData(formData));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_tag_create", tag, "admin_platform_blog_tag");
    message = `Blog tag created: ${tag?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not create platform blog tag.";
  }

  platformWebsiteRedirect(status, message);
}

export async function updatePlatformBlogTagAction(formData: FormData) {
  let message = "Blog tag updated";
  let status: "error" | "success" = "success";

  try {
    const tag = await updateTag(cleanText(formData.get("tagId")), tagInputFromFormData(formData));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_tag_update", tag, "admin_platform_blog_tag");
    message = `Blog tag updated: ${tag?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not update platform blog tag.";
  }

  platformWebsiteRedirect(status, message);
}

export async function archivePlatformBlogTagAction(formData: FormData) {
  let message = "Blog tag archived";
  let status: "error" | "success" = "success";

  try {
    const tag = await archiveTag(cleanText(formData.get("tagId")));
    await recordPlatformBlogTaxonomyAction("admin_platform_blog_tag_archive", tag, "admin_platform_blog_tag");
    message = `Blog tag archived: ${tag?.name ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not archive platform blog tag.";
  }

  platformWebsiteRedirect(status, message);
}

export async function publishPlatformBlogPostAction(formData: FormData) {
  let message = "Blog post published";
  let status: "error" | "success" = "success";

  try {
    const post = await publishPlatformBlogPost(cleanText(formData.get("postId")));
    await recordPlatformBlogAction("admin_platform_blog_publish", post);
    message = `Blog post published: ${post?.title ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not publish platform blog post.";
  }

  platformWebsiteRedirect(status, message);
}

export async function revertPlatformBlogPostDraftAction(formData: FormData) {
  let message = "Blog post reverted to draft";
  let status: "error" | "success" = "success";

  try {
    const post = await revertPlatformBlogPostToDraft(cleanText(formData.get("postId")));
    await recordPlatformBlogAction("admin_platform_blog_revert_draft", post);
    message = `Blog post reverted to draft: ${post?.title ?? "Untitled"}`;
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Could not revert platform blog post to draft.";
  }

  platformWebsiteRedirect(status, message);
}

export async function savePlatformBlogEditorDraft(
  previousState: PlatformBlogEditorActionState,
  formData: FormData
): Promise<PlatformBlogEditorActionState> {
  void previousState;

  try {
    const postId = cleanText(formData.get("postId"));
    const post = await updatePlatformBlogDraft(postId, blogInputFromFormData(formData));
    await updatePlatformBlogPostTaxonomy(postId, {
      categoryIds: taxonomyIds(formData, "categoryIds"),
      tagIds: taxonomyIds(formData, "tagIds")
    });
    await recordPlatformBlogAction("admin_platform_blog_save_editor", post);
    revalidatePath(`/admin/platform-website/blog/${postId}`);

    return {
      message: "Blog post saved. Publish status and public route visibility were not changed.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Platform blog post could not be saved.",
      status: "error"
    };
  }
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

export async function managePlatformSeoDraft(
  previousState: PlatformSeoGeneratorActionState,
  formData: FormData
): Promise<PlatformSeoGeneratorActionState> {
  const intent = cleanText(formData.get("seoIntent"));
  const pageId = cleanText(formData.get("pageId"));

  try {
    if (intent === "discard") {
      await recordPlatformWebsiteAction(formData, "admin_platform_seo_draft_discarded");

      return {
        draft: null,
        message: "SEO draft discarded. No platform page content was changed.",
        status: "idle"
      };
    }

    if (intent === "apply") {
      const draft = parseSeoDraft(formData.get("seoDraft"));

      await applySeoDraft(pageId, draft);
      await recordPlatformWebsiteAction(formData, "admin_platform_seo_draft_applied");
      revalidatePath(`/admin/platform-website/pages/${pageId}`);

      return {
        draft: null,
        message: "SEO draft applied. Page publish status and public route behavior were not changed.",
        status: "success"
      };
    }

    const draft = await generateSeoDraft(pageId);

    await recordPlatformWebsiteAction(formData, "admin_platform_seo_draft_generated");

    return {
      draft,
      message: previousState.draft ? "SEO draft regenerated for review." : "SEO draft generated for review.",
      status: "success"
    };
  } catch (error) {
    return {
      draft: previousState.draft,
      message: error instanceof Error ? error.message : "SEO draft action could not be completed.",
      status: "error"
    };
  }
}

export async function createPlatformPageBlock(formData: FormData) {
  await createPageBlock(blockInputFromFormData(formData));
  await recordBlockAction(formData, "admin_platform_page_block_create");
}

export async function updatePlatformPageBlock(formData: FormData) {
  await updatePageBlock(cleanText(formData.get("blockId")), blockInputFromFormData(formData));
  await recordBlockAction(formData, "admin_platform_page_block_update");
}

export async function hidePlatformPageBlock(formData: FormData) {
  await hidePageBlock(cleanText(formData.get("blockId")));
  await recordBlockAction(formData, "admin_platform_page_block_hide");
}

export async function showPlatformPageBlock(formData: FormData) {
  await showPageBlock(cleanText(formData.get("blockId")));
  await recordBlockAction(formData, "admin_platform_page_block_show");
}

export async function publishPlatformPageBlock(formData: FormData) {
  await publishPageBlock(cleanText(formData.get("blockId")));
  await recordBlockAction(formData, "admin_platform_page_block_publish");
}

export async function duplicatePlatformPageBlock(formData: FormData) {
  await duplicatePageBlock(cleanText(formData.get("blockId")));
  await recordBlockAction(formData, "admin_platform_page_block_duplicate");
}

export async function deleteDraftPlatformPageBlock(formData: FormData) {
  await deleteDraftPageBlock(cleanText(formData.get("blockId")));
  await recordBlockAction(formData, "admin_platform_page_block_delete_draft");
}

export async function reorderPlatformPageBlocks(formData: FormData) {
  const pageId = cleanText(formData.get("pageId"));
  const order = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("blockOrder:"))
    .map(([key, value]) => ({
      blockId: key.replace("blockOrder:", ""),
      sortOrder: parseNumber(value)
    }));

  await reorderPageBlocks(pageId, order);
  await recordBlockAction(formData, "admin_platform_page_block_reorder");
}

export async function savePlatformTranslationDraft(
  previousState: PlatformTranslationActionState,
  formData: FormData
): Promise<PlatformTranslationActionState> {
  void previousState;

  return savePlatformTranslationWithStatus(formData, "partial");
}

export async function markPlatformTranslationReady(
  previousState: PlatformTranslationActionState,
  formData: FormData
): Promise<PlatformTranslationActionState> {
  void previousState;

  return savePlatformTranslationWithStatus(formData, "ready");
}

export async function markPlatformTranslationNeedsReview(
  previousState: PlatformTranslationActionState,
  formData: FormData
): Promise<PlatformTranslationActionState> {
  void previousState;

  return savePlatformTranslationWithStatus(formData, "needs_review");
}
