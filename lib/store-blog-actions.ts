"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";

const blogPath = "/dashboard/blog";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

type ArticleStatus = "draft" | "published";

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 4000) {
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

  return slug || "article";
}

function articleStatus(value: FormDataEntryValue | null): ArticleStatus {
  return cleanText(value, 20) === "published" ? "published" : "draft";
}

function blogRedirect(storeId: string, status: string, extra?: Record<string, string | null | undefined>): never {
  const params = new URLSearchParams({ blog: status, storeId });

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`${blogPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${blogPath}?blog=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: blogPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${blogPath}?blog=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function articlePayload(formData: FormData) {
  const title = cleanText(formData.get("title"), 180);
  const content = cleanText(formData.get("content"), 12000);
  const slug = cleanText(formData.get("slug"), 100);
  const status = articleStatus(formData.get("status"));

  if (!title || !content) {
    return null;
  }

  return {
    content,
    cover_image_url: cleanOptionalText(formData.get("coverImageUrl"), 1000),
    excerpt: cleanOptionalText(formData.get("excerpt"), 500),
    published_at: status === "published" ? new Date().toISOString() : null,
    slug: slugify(slug || title),
    status,
    title
  };
}

function revalidateBlogPaths(store: WorkspaceStoreRow, slug?: string | null) {
  revalidatePath(blogPath);

  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/store/${store.slug}/blog`);

    if (slug) {
      revalidatePath(`/store/${store.slug}/blog/${slug}`);
    }
  }
}

export async function createStoreBlogArticle(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = articlePayload(formData);

  if (!payload) {
    blogRedirect(storeId, "missing-fields");
  }

  const { data, error } = await supabase
    .from("store_blog_articles" as never)
    .insert({
      ...payload,
      created_by: user.id,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id, slug")
    .single();

  if (error) {
    blogRedirect(storeId, error.code === "23505" ? "slug-exists" : "create-failed");
  }

  const article = data as unknown as { id: string; slug?: string | null };
  revalidateBlogPaths(store, article.slug);
  await recordWorkspaceActivitySafe({
    action: "blog_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: article.id,
    entityType: "blog_article",
    metadata: { status: payload.status, title: payload.title },
    storeId,
    supabase,
    workspaceId
  });
  blogRedirect(storeId, "created", { edit: article.id });
}

export async function updateStoreBlogArticle(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const articleId = cleanText(formData.get("articleId"), 80);
  const previousSlug = cleanText(formData.get("previousSlug"), 100);
  const payload = articlePayload(formData);

  if (!articleId || !payload) {
    blogRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_blog_articles" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, articleId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    blogRedirect(storeId, error.code === "23505" ? "slug-exists" : "update-failed");
  }

  revalidateBlogPaths(store, previousSlug);
  revalidateBlogPaths(store, payload.slug);
  await recordWorkspaceActivitySafe({
    action: "blog_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: articleId,
    entityType: "blog_article",
    metadata: { status: payload.status, title: payload.title },
    storeId,
    supabase,
    workspaceId
  });
  blogRedirect(storeId, "updated", { edit: articleId });
}

export async function setStoreBlogArticleStatus(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const articleId = cleanText(formData.get("articleId"), 80);
  const slug = cleanText(formData.get("slug"), 100);
  const status = articleStatus(formData.get("status"));

  if (!articleId) {
    blogRedirect(storeId, "status-failed");
  }

  const { error } = await supabase
    .from("store_blog_articles" as never)
    .update({
      published_at: status === "published" ? new Date().toISOString() : null,
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, articleId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    blogRedirect(storeId, "status-failed");
  }

  revalidateBlogPaths(store, slug);
  await recordWorkspaceActivitySafe({
    action: "blog_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: articleId,
    entityType: "blog_article",
    metadata: { status },
    storeId,
    supabase,
    workspaceId
  });
  blogRedirect(storeId, status === "published" ? "published" : "unpublished");
}

export async function deleteStoreBlogArticle(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const articleId = cleanText(formData.get("articleId"), 80);
  const slug = cleanText(formData.get("slug"), 100);

  if (!articleId) {
    blogRedirect(storeId, "delete-failed");
  }

  const { error } = await supabase
    .from("store_blog_articles" as never)
    .delete()
    .eq("id" as never, articleId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    blogRedirect(storeId, "delete-failed");
  }

  revalidateBlogPaths(store, slug);
  await recordWorkspaceActivitySafe({
    action: "blog_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: articleId,
    entityType: "blog_article",
    metadata: { deleted: true },
    storeId,
    supabase,
    workspaceId
  });
  blogRedirect(storeId, "deleted");
}
