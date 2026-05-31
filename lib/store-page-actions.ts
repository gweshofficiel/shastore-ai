"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { pageContentFromForm } from "@/lib/store-pages/content";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const pagesPath = "/dashboard/pages";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
  workspace_id?: string | null;
};

type StorePageStatus = "archived" | "draft" | "published";
type StorePageType = "about" | "contact" | "custom" | "faq" | "privacy" | "returns" | "shipping" | "terms";

const pageTypes = new Set<StorePageType>([
  "about",
  "contact",
  "custom",
  "faq",
  "privacy",
  "returns",
  "shipping",
  "terms"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "page";
}

function pageStatus(value: FormDataEntryValue | null): StorePageStatus {
  const status = cleanText(value, 20);
  return status === "published" || status === "archived" ? status : "draft";
}

function pageType(value: FormDataEntryValue | null): StorePageType {
  const type = cleanText(value, 30) as StorePageType;
  return pageTypes.has(type) ? type : "custom";
}

function pagesRedirect(storeId: string, status: string, extra?: Record<string, string | null | undefined>): never {
  const params = new URLSearchParams({ pages: status, storeId });

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`${pagesPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${pagesPath}?pages=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: pagesPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${pagesPath}?pages=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function pagePayload(formData: FormData) {
  const title = cleanText(formData.get("title"), 180);
  const slug = cleanText(formData.get("slug"), 100);

  if (!title) {
    return null;
  }

  return {
    content: pageContentFromForm(formData.get("content")),
    canonical_url: cleanOptionalText(formData.get("canonicalUrl"), 500),
    noindex: formData.get("noindex") === "on",
    og_description: cleanOptionalText(formData.get("ogDescription"), 320),
    og_image_url: cleanOptionalText(formData.get("ogImageUrl"), 1000),
    og_title: cleanOptionalText(formData.get("ogTitle"), 180),
    page_type: pageType(formData.get("pageType")),
    seo_description: cleanOptionalText(formData.get("seoDescription"), 300),
    seo_keywords: cleanOptionalText(formData.get("seoKeywords"), 500),
    seo_title: cleanOptionalText(formData.get("seoTitle"), 180),
    slug: slugify(slug || title),
    status: pageStatus(formData.get("status")),
    title
  };
}

async function recordPageActivity({
  action,
  pageId,
  storeId,
  supabase,
  workspaceId
}: {
  action: string;
  pageId: string | null;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const { error } = await supabase.from("page_activity_logs" as never).insert({
    action,
    page_id: pageId,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[store-pages] activity log failed", {
      action,
      code: error.code,
      message: error.message,
      pageId,
      storeId
    });
  }
}

async function recordPageFailure({
  action,
  error,
  pageId,
  storeId,
  supabase,
  userId,
  workspaceId
}: {
  action: string;
  error: { code?: string | null; details?: string | null; hint?: string | null; message?: string | null };
  pageId?: string | null;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  userId?: string | null;
  workspaceId: string;
}) {
  await recordMonitoringEventSafe({
    entityId: pageId,
    entityType: "store_page",
    eventStatus: "failed",
    eventType: "store_page_action_failed",
    metadata: {
      action,
      error_code: error.code,
      error_details: error.details,
      error_hint: error.hint,
      error_message: error.message,
      reason: "Store page action failed",
      route: pagesPath
    },
    storeId,
    supabase,
    userId,
    workspaceId
  });
}

function revalidatePagePaths(store: WorkspaceStoreRow, storeId: string, slug?: string | null) {
  revalidatePath(pagesPath);
  revalidatePath(`/dashboard/stores/${storeId}`);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
    if (slug) {
      revalidatePath(`/store/${store.slug}/pages/${slug}`);
      revalidatePath(`/s/${store.slug}/pages/${slug}`);
    }
  }
}

export async function createStoreOwnerPage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = pagePayload(formData);

  if (!payload) {
    pagesRedirect(storeId, "missing-title");
  }

  const { data, error } = await supabase
    .from("store_pages" as never)
    .insert({
      ...payload,
      created_by: user.id,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id, slug")
    .single();

  if (error) {
    console.error("[store-pages] create failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    await recordPageFailure({ action: "page_created", error, storeId, supabase, userId: user.id, workspaceId });
    pagesRedirect(storeId, error.code === "23505" ? "slug-exists" : "create-failed");
  }

  const page = data as unknown as { id: string; slug?: string | null };
  await recordPageActivity({ action: "page_created", pageId: page.id, storeId, supabase, workspaceId });
  revalidatePagePaths(store, storeId, page.slug);
  pagesRedirect(storeId, "created");
}

export async function updateStoreOwnerPage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const pageId = cleanText(formData.get("pageId"), 80);
  const payload = pagePayload(formData);

  if (!pageId || !payload) {
    pagesRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", pageId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-pages] update failed", {
      code: error.code,
      message: error.message,
      pageId,
      storeId
    });
    await recordPageFailure({ action: "page_saved", error, pageId, storeId, supabase, userId: user.id, workspaceId });
    pagesRedirect(storeId, error.code === "23505" ? "slug-exists" : "update-failed");
  }

  await recordPageActivity({ action: "page_saved", pageId, storeId, supabase, workspaceId });
  revalidatePagePaths(store, storeId, payload.slug);
  pagesRedirect(storeId, "updated");
}

export async function setStoreOwnerPageStatus(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const pageId = cleanText(formData.get("pageId"), 80);
  const status = pageStatus(formData.get("status"));
  const slug = cleanText(formData.get("slug"), 100);

  if (!pageId) {
    pagesRedirect(storeId, "status-failed");
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", pageId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-pages] status update failed", {
      code: error.code,
      message: error.message,
      pageId,
      storeId
    });
    await recordPageFailure({ action: status === "published" ? "page_published" : "page_status_updated", error, pageId, storeId, supabase, userId: user.id, workspaceId });
    pagesRedirect(storeId, "status-failed");
  }

  await recordPageActivity({
    action: status === "published" ? "page_published" : status === "draft" ? "page_unpublished" : "page_archived",
    pageId,
    storeId,
    supabase,
    workspaceId
  });
  revalidatePagePaths(store, storeId, slug);
  pagesRedirect(storeId, status === "published" ? "published" : status === "archived" ? "archived" : "unpublished");
}

export async function deleteStoreOwnerPage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const pageId = cleanText(formData.get("pageId"), 80);
  const slug = cleanText(formData.get("slug"), 100);

  if (!pageId) {
    pagesRedirect(storeId, "delete-failed");
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .delete()
    .eq("id", pageId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-pages] delete failed", {
      code: error.code,
      message: error.message,
      pageId,
      storeId
    });
    await recordPageFailure({ action: "page_deleted", error, pageId, storeId, supabase, userId: user.id, workspaceId });
    pagesRedirect(storeId, "delete-failed");
  }

  await recordPageActivity({ action: "page_deleted", pageId: null, storeId, supabase, workspaceId });
  revalidatePagePaths(store, storeId, slug);
  pagesRedirect(storeId, "deleted");
}
