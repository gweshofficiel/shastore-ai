"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pageContentFromForm } from "@/lib/store-pages/content";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const legalPagesPath = "/dashboard/legal-pages";

type LegalPageType = "privacy" | "returns" | "shipping" | "terms";
type LegalPageStatus = "draft" | "published";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
};

const legalPageTypes = new Set<LegalPageType>(["privacy", "returns", "shipping", "terms"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "legal-page";
}

function legalPageType(value: FormDataEntryValue | null): LegalPageType | null {
  const type = cleanText(value, 30) as LegalPageType;
  return legalPageTypes.has(type) ? type : null;
}

function legalPageStatus(value: FormDataEntryValue | null): LegalPageStatus {
  return cleanText(value, 20) === "published" ? "published" : "draft";
}

function dashboardRedirect(storeId: string, status: string, extra?: Record<string, string | null | undefined>): never {
  const params = new URLSearchParams({ legal: status, storeId });

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`${legalPagesPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${legalPagesPath}?legal=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: legalPagesPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    dashboardRedirect(storeId, "not-authorized");
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function legalPagePayload(formData: FormData) {
  const pageType = legalPageType(formData.get("legalType"));
  const title = cleanText(formData.get("title"), 180);
  const slug = cleanText(formData.get("slug"), 100);

  if (!pageType || !title) {
    return null;
  }

  return {
    content: pageContentFromForm(formData.get("content")),
    noindex: true,
    page_type: pageType,
    slug: slugify(slug || title),
    status: legalPageStatus(formData.get("status")),
    title
  };
}

function legacyLegalPath(storeSlug: string, pageType: LegalPageType) {
  if (pageType === "privacy") {
    return `/store/${storeSlug}/privacy`;
  }

  if (pageType === "terms") {
    return `/store/${storeSlug}/terms`;
  }

  if (pageType === "returns") {
    return `/store/${storeSlug}/refund`;
  }

  return `/store/${storeSlug}/shipping`;
}

function revalidateLegalPaths(store: WorkspaceStoreRow, slug?: string | null, pageType?: LegalPageType | null) {
  revalidatePath(legalPagesPath);

  if (!store.slug) {
    return;
  }

  revalidatePath(`/store/${store.slug}`);

  if (slug) {
    revalidatePath(`/store/${store.slug}/pages/${slug}`);
  }

  if (pageType) {
    revalidatePath(legacyLegalPath(store.slug, pageType));
  }
}

export async function createStoreLegalPage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = legalPagePayload(formData);

  if (!payload) {
    dashboardRedirect(storeId, "missing-fields");
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
    dashboardRedirect(storeId, error.code === "23505" ? "slug-exists" : "create-failed");
  }

  const page = data as unknown as { id: string; slug?: string | null };
  revalidateLegalPaths(store, page.slug, payload.page_type);
  dashboardRedirect(storeId, "created", { edit: page.id });
}

export async function updateStoreLegalPage(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const pageId = cleanText(formData.get("pageId"), 80);
  const previousSlug = cleanText(formData.get("previousSlug"), 100);
  const payload = legalPagePayload(formData);

  if (!pageId || !payload) {
    dashboardRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, pageId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    dashboardRedirect(storeId, error.code === "23505" ? "slug-exists" : "update-failed");
  }

  revalidateLegalPaths(store, previousSlug, payload.page_type);
  revalidateLegalPaths(store, payload.slug, payload.page_type);
  dashboardRedirect(storeId, "updated", { edit: pageId });
}

export async function setStoreLegalPageStatus(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const pageId = cleanText(formData.get("pageId"), 80);
  const pageType = legalPageType(formData.get("legalType"));
  const slug = cleanText(formData.get("slug"), 100);
  const status = legalPageStatus(formData.get("status"));

  if (!pageId || !pageType) {
    dashboardRedirect(storeId, "status-failed");
  }

  const { error } = await supabase
    .from("store_pages" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, pageId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("page_type" as never, pageType as never);

  if (error) {
    dashboardRedirect(storeId, "status-failed");
  }

  revalidateLegalPaths(store, slug, pageType);
  dashboardRedirect(storeId, status === "published" ? "published" : "unpublished");
}
