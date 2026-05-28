"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const categoriesPath = "/dashboard/categories";

type WorkspaceStoreRow = {
  id: string;
  slug?: string | null;
  workspace_id?: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function cleanInteger(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);
  if (!text) {
    return 0;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function categoryStatus(value: FormDataEntryValue | null) {
  return cleanText(value, 20) === "inactive" ? "inactive" : "active";
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || "category";
}

function categoriesRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ categories: status, storeId });
  redirect(`${categoriesPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${categoriesPath}?categories=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "manage_products",
    redirectTo: categoriesPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${categoriesPath}?categories=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function revalidateCategoryPaths(store: WorkspaceStoreRow, storeId: string) {
  revalidatePath(categoriesPath);
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
}

function categoryPayload(formData: FormData) {
  const name = cleanText(formData.get("name"), 140);
  const slug = cleanText(formData.get("slug"), 90);

  if (!name) {
    return null;
  }

  return {
    description: cleanOptionalText(formData.get("description"), 1000),
    image_url: cleanOptionalText(formData.get("imageUrl"), 1000),
    name,
    slug: slugify(slug || name),
    sort_order: cleanInteger(formData.get("sortOrder")),
    status: categoryStatus(formData.get("status"))
  };
}

export async function createStoreOwnerCategory(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = categoryPayload(formData);

  if (!payload) {
    categoriesRedirect(storeId, "missing-name");
  }

  const { error } = await supabase.from("store_categories" as never).insert({
    ...payload,
    store_id: storeId,
    user_id: user.id,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[store-categories] create failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    categoriesRedirect(storeId, error.code === "23505" ? "slug-exists" : "create-failed");
  }

  revalidateCategoryPaths(store, storeId);
  categoriesRedirect(storeId, "created");
}

export async function updateStoreOwnerCategory(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const categoryId = cleanText(formData.get("categoryId"), 80);
  const payload = categoryPayload(formData);

  if (!categoryId || !payload) {
    categoriesRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_categories" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", categoryId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[store-categories] update failed", {
      categoryId,
      code: error.code,
      message: error.message,
      storeId
    });
    categoriesRedirect(storeId, error.code === "23505" ? "slug-exists" : "update-failed");
  }

  revalidateCategoryPaths(store, storeId);
  categoriesRedirect(storeId, "updated");
}
