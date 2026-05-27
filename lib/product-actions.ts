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
const imageBucket = "product-images";
const maxImageSize = 5 * 1024 * 1024;
const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductImageRole = "gallery" | "main";

type ProductImageRecord = {
  id: string;
  image_role: ProductImageRole;
  public_url: string;
  storage_bucket: string;
  storage_path: string;
};

type ProtectedProductRecord = {
  gallery?: unknown;
  id: string;
  image_url?: string | null;
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

function cleanImageRole(value: FormDataEntryValue | null): ProductImageRole {
  return cleanText(value, 20) === "main" ? "main" : "gallery";
}

function imageExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function validateImageFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "missing-image" as const, file: null };
  }

  const extension = imageExtension(file);

  if (!allowedImageExtensions.has(extension) || !allowedImageTypes.has(file.type)) {
    return { error: "invalid-image" as const, file: null };
  }

  if (file.size > maxImageSize) {
    return { error: "image-too-large" as const, file: null };
  }

  return { error: null, file };
}

function logProductImageError(
  event: string,
  details: Record<string, string | number | null | undefined>
) {
  console.error(`[product-images] ${event}`, {
    ...details,
    bucket: imageBucket
  });
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

async function loadProtectedProduct({
  productId,
  storeId,
  supabase,
  workspaceId
}: {
  productId: string;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const { data } = await supabase
    .from("store_products" as never)
    .select("id, image_url, gallery")
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  return (data ?? null) as ProtectedProductRecord | null;
}

function normalizeGallery(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : [];
}

function galleryItem({
  imageId,
  publicUrl,
  storagePath
}: {
  imageId: string | null;
  publicUrl: string;
  storagePath: string;
}) {
  return {
    ...(imageId ? { id: imageId } : {}),
    publicUrl,
    role: "gallery",
    storagePath,
    url: publicUrl
  };
}

async function revalidateProductImagePaths(store: WorkspaceStoreRow, storeId: string, productId: string) {
  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/store/${store.slug}/product/${productId}`);
  }
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

export async function uploadStoreOwnerProductImage(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const role = cleanImageRole(formData.get("imageRole"));
  const validation = validateImageFile(formData.get("productImage"));

  if (!productId) {
    productsRedirect(storeId, "image-failed");
  }

  if (validation.error || !validation.file) {
    productsRedirect(storeId, validation.error ?? "image-failed");
  }

  const product = await loadProtectedProduct({ productId, storeId, supabase, workspaceId });

  if (!product) {
    productsRedirect(storeId, "image-failed");
  }

  const protectedProduct = product as ProtectedProductRecord;
  const file = validation.file as File;
  const extension = imageExtension(file);
  const storagePath = `${user.id}/${storeId}/${productId}/${role}-${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(imageBucket).upload(storagePath, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    logProductImageError("upload failed", {
      code: uploadError.name,
      message: uploadError.message,
      productId,
      storagePath,
      storeId,
      userId: user.id
    });
    productsRedirect(storeId, "image-failed");
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(imageBucket).getPublicUrl(storagePath);
  const sortOrder =
    role === "main"
      ? 0
      : normalizeGallery(protectedProduct.gallery).length + 1;
  const { data: existingMain } =
    role === "main"
      ? await supabase
          .from("product_images" as never)
          .select("id, storage_bucket, storage_path")
          .eq("product_id", productId)
          .eq("store_id", storeId)
          .eq("workspace_id" as never, workspaceId as never)
          .eq("image_role" as never, "main" as never)
          .maybeSingle()
      : { data: null };
  const previousMain = existingMain as unknown as ProductImageRecord | null;

  const productUpdate =
    role === "main"
      ? await supabase
          .from("store_products" as never)
          .update({
            image_url: publicUrl,
            updated_at: new Date().toISOString()
          } as never)
          .eq("id", productId)
          .eq("store_id", storeId)
          .eq("workspace_id" as never, workspaceId as never)
      : await supabase
          .from("store_products" as never)
          .update({
            gallery: [
              ...normalizeGallery(protectedProduct.gallery),
              galleryItem({ imageId: null, publicUrl, storagePath })
            ],
            updated_at: new Date().toISOString()
          } as never)
          .eq("id", productId)
          .eq("store_id", storeId)
          .eq("workspace_id" as never, workspaceId as never);

  if (productUpdate.error) {
    await supabase.storage.from(imageBucket).remove([storagePath]);
    logProductImageError("product update failed after upload", {
      code: productUpdate.error.code,
      message: productUpdate.error.message,
      productId,
      storagePath,
      storeId,
      userId: user.id
    });
    productsRedirect(storeId, "image-save-failed");
  }

  if (role === "main" && previousMain) {
    await supabase.storage.from(previousMain.storage_bucket).remove([previousMain.storage_path]);
    const { error: previousDeleteError } = await supabase
      .from("product_images" as never)
      .delete()
      .eq("id", previousMain.id)
      .eq("product_id", productId)
      .eq("store_id", storeId)
      .eq("workspace_id" as never, workspaceId as never);

    if (previousDeleteError) {
      logProductImageError("previous main metadata delete failed", {
        code: previousDeleteError.code,
        message: previousDeleteError.message,
        productId,
        storagePath: previousMain.storage_path,
        storeId,
        userId: user.id
      });
    }
  }

  const { data: imageRow, error: imageError } = await supabase
    .from("product_images" as never)
    .insert(
      {
        content_type: file.type,
        file_name: file.name.slice(0, 180),
        file_size: file.size,
        image_role: role,
        owner_user_id: user.id,
        product_id: productId,
        public_url: publicUrl,
        sort_order: sortOrder,
        storage_bucket: imageBucket,
        storage_path: storagePath,
        store_id: storeId,
        workspace_id: workspaceId
      } as never
    )
    .select("id, public_url, image_role, storage_bucket, storage_path")
    .single();

  if (imageError || !imageRow) {
    logProductImageError("metadata insert failed after product update", {
      code: imageError?.code,
      message: imageError?.message,
      productId,
      storagePath,
      storeId,
      userId: user.id
    });
    await revalidateProductImagePaths(store, storeId, productId);
    productsRedirect(storeId, "image-uploaded-metadata-warning");
  }

  const normalizedImage = imageRow as unknown as ProductImageRecord;

  if (role === "gallery") {
    const gallery = [
      ...normalizeGallery(protectedProduct.gallery),
      galleryItem({ imageId: normalizedImage.id, publicUrl, storagePath })
    ];

    const { error: gallerySyncError } = await supabase
      .from("store_products" as never)
      .update({
        gallery,
        updated_at: new Date().toISOString()
      } as never)
      .eq("id", productId)
      .eq("store_id", storeId)
      .eq("workspace_id" as never, workspaceId as never);

    if (gallerySyncError) {
      logProductImageError("gallery metadata id sync failed", {
        code: gallerySyncError.code,
        message: gallerySyncError.message,
        productId,
        storagePath,
        storeId,
        userId: user.id
      });
    }
  }

  await revalidateProductImagePaths(store, storeId, productId);
  productsRedirect(storeId, "image-uploaded");
}

export async function removeStoreOwnerProductImage(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const imageId = cleanText(formData.get("imageId"), 80);

  if (!productId || !imageId) {
    productsRedirect(storeId, "image-remove-failed");
  }

  const product = await loadProtectedProduct({ productId, storeId, supabase, workspaceId });

  if (!product) {
    productsRedirect(storeId, "image-remove-failed");
  }

  const protectedProduct = product as {
    gallery?: unknown;
    id: string;
    image_url?: string | null;
  };
  const { data: image, error: imageError } = await supabase
    .from("product_images" as never)
    .select("id, image_role, public_url, storage_bucket, storage_path")
    .eq("id", imageId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (imageError || !image) {
    productsRedirect(storeId, "image-remove-failed");
  }

  const imageRecord = image as unknown as ProductImageRecord;

  await supabase.storage.from(imageRecord.storage_bucket).remove([imageRecord.storage_path]);
  const { error: deleteError } = await supabase
    .from("product_images" as never)
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (deleteError) {
    productsRedirect(storeId, "image-remove-failed");
  }

  if (imageRecord.image_role === "main" && protectedProduct.image_url === imageRecord.public_url) {
    await supabase
      .from("store_products" as never)
      .update({
        image_url: null,
        updated_at: new Date().toISOString()
      } as never)
      .eq("id", productId)
      .eq("store_id", storeId)
      .eq("workspace_id" as never, workspaceId as never);
  }

  if (imageRecord.image_role === "gallery") {
    const gallery = normalizeGallery(protectedProduct.gallery).filter((item) => {
      const record = item as Record<string, unknown>;
      return record.id !== imageRecord.id && record.url !== imageRecord.public_url;
    });

    await supabase
      .from("store_products" as never)
      .update({
        gallery,
        updated_at: new Date().toISOString()
      } as never)
      .eq("id", productId)
      .eq("store_id", storeId)
      .eq("workspace_id" as never, workspaceId as never);
  }

  await revalidateProductImagePaths(store, storeId, productId);
  productsRedirect(storeId, "image-removed");
}
