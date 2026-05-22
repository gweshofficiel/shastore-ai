"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
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
  return status === "published" ? "published" : "draft";
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

function cleanInventory(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(cleanText(value, 20), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
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

async function getClaimedStore(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    (data as ClaimedStoreRow[]).find(
      (store) =>
        store.id === storeId &&
        (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
    ) ?? null
  );
}

async function requireClaimedStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect(`${productListPath}?products=missing-store`);
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(productListPath)}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    redirect(`${productListPath}?products=not-authorized`);
  }

  return { storeId, supabase };
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
    inventory_quantity: cleanInventory(formData.get("inventoryQuantity")),
    name: title,
    price,
    price_label: price.toFixed(2),
    short_description: cleanOptionalText(formData.get("shortDescription"), 500),
    sku: cleanOptionalText(formData.get("sku"), 80),
    slug: `${slugify(title)}-${slugSuffix}`,
    status: cleanStatus(formData.get("status")),
    title
  };
}

export async function createStoreOwnerProduct(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const payload = productPayload(formData);

  if (!payload) {
    productsRedirect(storeId, "missing-title");
  }

  const { error } = await supabase.from("store_instance_products" as never).insert({
    ...payload,
    store_instance_id: storeId
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
  productsRedirect(storeId, "created");
}

export async function updateStoreOwnerProduct(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const payload = productPayload(formData, productId);

  if (!productId || !payload) {
    productsRedirect(storeId, "update-failed");
  }

  const { error } = await supabase
    .from("store_instance_products" as never)
    .update(payload as never)
    .eq("id", productId)
    .eq("store_instance_id", storeId);

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
  productsRedirect(storeId, "updated");
}

export async function deleteStoreOwnerProduct(formData: FormData) {
  const { storeId, supabase } = await requireClaimedStore(formData);
  const productId = cleanText(formData.get("productId"), 80);

  if (!productId) {
    productsRedirect(storeId, "delete-failed");
  }

  const { error } = await supabase
    .from("store_instance_products" as never)
    .delete()
    .eq("id", productId)
    .eq("store_instance_id", storeId);

  if (error) {
    console.error("[products-foundation] delete product failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "delete-failed");
  }

  revalidatePath(productListPath);
  productsRedirect(storeId, "deleted");
}
