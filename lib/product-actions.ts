"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

type WorkspaceStoreRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  workspace_id?: string | null;
};

const productListPath = "/dashboard/products";

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

function cleanStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 20);
  return status === "active" || status === "archived" ? status : "draft";
}

function cleanMoney(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40).replace(",", ".");
  const parsed = Number.parseFloat(text);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100) / 100;
}

function cleanOptionalMoney(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);

  if (!text) {
    return null;
  }

  return cleanMoney(text);
}

function cleanCurrency(value: FormDataEntryValue | null) {
  const currency = cleanText(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function cleanUrl(value: FormDataEntryValue | null) {
  const text = cleanText(value, 700);

  if (!text) {
    return null;
  }

  return text.startsWith("http://") || text.startsWith("https://") ? text : null;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || "product";
}

function productsRedirect(storeId: string, status?: string) {
  const params = new URLSearchParams({ storeId });

  if (status) {
    params.set("products", status);
  }

  redirect(`${productListPath}?${params.toString()}`);
}

async function requireWorkspaceStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${productListPath}?products=missing-store`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "manage_products",
    redirectTo: productListPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    redirect(`${productListPath}?products=not-authorized`);
  }

  return {
    store: access.store as WorkspaceStoreRow,
    storeId,
    supabase,
    user,
    workspaceId
  };
}

function productPayload(formData: FormData, productId?: string) {
  const title = cleanText(formData.get("title"), 180);
  const price = cleanMoney(formData.get("price"));
  const slugSuffix = productId ? productId.slice(0, 8) : randomUUID().slice(0, 8);

  if (!title) {
    return null;
  }

  return {
    compare_at_price: cleanOptionalMoney(formData.get("compareAtPrice")),
    currency: cleanCurrency(formData.get("currency")),
    description: cleanOptionalText(formData.get("description"), 1000),
    gallery: [] as unknown[],
    image_url: cleanUrl(formData.get("imageUrl")),
    name: title,
    price: price.toFixed(2),
    price_label: price.toFixed(2),
    short_description: cleanOptionalText(formData.get("shortDescription"), 500),
    sku: cleanOptionalText(formData.get("sku"), 80),
    slug: `${slugify(title)}-${slugSuffix}`,
    status: cleanStatus(formData.get("status")),
    title
  };
}

export async function createStoreOwnerProduct(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const payload = productPayload(formData);

  if (!payload) {
    productsRedirect(storeId, "missing-title");
  }

  const { error } = await supabase.from("store_products" as never).insert({
    ...payload,
    owner_user_id: user.id,
    store_id: storeId,
    user_id: user.id,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[products-foundation] create product failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    productsRedirect(storeId, "create-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
  productsRedirect(storeId, "created");
}

export async function updateStoreOwnerProduct(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const payload = productPayload(formData, productId);

  if (!productId || !payload) {
    productsRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_products" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[products-foundation] update product failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "update-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
  productsRedirect(storeId, "updated");
}

export async function archiveStoreOwnerProduct(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);

  if (!productId) {
    productsRedirect(storeId, "archive-failed");
  }

  const { error } = await supabase
    .from("store_products" as never)
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[products-foundation] delete product failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "archive-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
  productsRedirect(storeId, "archived");
}

export const deleteStoreOwnerProduct = archiveStoreOwnerProduct;
