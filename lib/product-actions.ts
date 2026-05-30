"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { assertUsageWithinLimits, billingEnforcementMessage } from "@/lib/billing/enforcement";
import { recordSubscriptionEnforcementLog } from "@/lib/billing/enforcement-log";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createAdminClient } from "@/lib/supabase/admin";
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

type ProductImagePayload = {
  content_type: string;
  file_name: string;
  file_size: number;
  image_role: ProductImageRole;
  image_type: ProductImageRole;
  owner_user_id: string;
  product_id: string;
  public_url: string;
  sort_order: number;
  storage_bucket: string;
  storage_path: string;
  store_id: string;
  user_id: string;
  workspace_id: string;
};

type ProductDatabaseError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
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

function cleanInteger(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);
  if (!text) {
    return 0;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function cleanOptionalInteger(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);
  if (!text) {
    return null;
  }

  return cleanInteger(text);
}

function cleanCurrency(value: FormDataEntryValue | null) {
  const currency = cleanText(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function cleanImageRole(value: FormDataEntryValue | null): ProductImageRole {
  return cleanText(value, 20) === "main" ? "main" : "gallery";
}

function cleanVisibilityStatus(value: FormDataEntryValue | null) {
  return cleanText(value, 20) === "active" ? "active" : "draft";
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

function productsRedirect(storeId: string, status?: string, detail?: string): never {
  const params = new URLSearchParams({ storeId });

  if (status) {
    params.set("products", status);
  }

  if (detail) {
    params.set("productError", detail.slice(0, 280));
  }

  redirect(`${productListPath}?${params.toString()}`);
}

function rawText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidMoneyInput(value: FormDataEntryValue | null, optional = false) {
  const text = rawText(value, 40);
  if (!text && optional) {
    return true;
  }

  if (!text && !optional) {
    return true;
  }

  const parsed = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0;
}

function isValidIntegerInput(value: FormDataEntryValue | null, optional = false) {
  const text = rawText(value, 20);
  if (!text && optional) {
    return true;
  }

  if (!text && !optional) {
    return true;
  }

  const parsed = Number.parseInt(text, 10);
  return String(parsed) === text && parsed >= 0;
}

function validateProductForm(formData: FormData) {
  const title = rawText(formData.get("title"), 180);
  const status = rawText(formData.get("status"), 20);
  const currency = rawText(formData.get("currency"), 8).toUpperCase();

  if (!title) {
    return { code: "missing-title", message: "Product title is required." };
  }

  if (status && status !== "draft" && status !== "active" && status !== "archived") {
    return { code: "invalid-status", message: "Invalid status. Choose draft, active, or archived." };
  }

  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { code: "invalid-currency", message: "Invalid currency. Use a 3-letter code like USD." };
  }

  if (!isValidMoneyInput(formData.get("price"))) {
    return { code: "invalid-price", message: "Product price must be a valid non-negative number." };
  }

  if (!isValidMoneyInput(formData.get("compareAtPrice"), true)) {
    return { code: "invalid-compare-price", message: "Compare at price must be a valid non-negative number." };
  }

  if (!isValidIntegerInput(formData.get("stockQuantity"))) {
    return { code: "invalid-inventory", message: "Inventory value invalid. Stock quantity must be a non-negative whole number." };
  }

  if (!isValidIntegerInput(formData.get("lowStockThreshold"), true)) {
    return { code: "invalid-inventory", message: "Inventory value invalid. Low stock threshold must be a non-negative whole number." };
  }

  return null;
}

function safeProductDatabaseErrorMessage(error?: ProductDatabaseError | null) {
  switch (error?.code) {
    case "23503":
      return "Related category, store, or workspace record was not found.";
    case "23505":
      return "Duplicate product conflict.";
    case "23502":
      return "Required database field is missing.";
    case "42501":
      return "Permission denied by RLS.";
    case "22P02":
      return "Invalid ID format.";
    case "PGRST116":
      return "Store or category not found.";
    default:
      return "Unexpected database error. Check monitoring details.";
  }
}

function productDatabaseErrorMetadata(error?: ProductDatabaseError | null) {
  return {
    code: error?.code ?? "unknown",
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    message: error?.message ?? null,
    safeMessage: safeProductDatabaseErrorMessage(error)
  };
}

async function recordProductCreateFailure({
  detail,
  error,
  reason,
  status,
  storeId,
  supabase,
  userId,
  workspaceId
}: {
  detail?: string | null;
  error?: { code?: string | null; details?: string | null; hint?: string | null; message?: string | null } | null;
  reason: string;
  status: string;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  userId: string;
  workspaceId: string;
}) {
  await recordMonitoringEventSafe({
    entityType: "product",
    eventStatus: "failed",
    eventType: "product_create_failed",
    metadata: {
      ...productDatabaseErrorMetadata(error),
      code: error?.code ?? status,
      detail,
      reason,
      status
    },
    storeId,
    supabase,
    userId,
    workspaceId
  });
}

async function assertProductCreationAllowed({
  storeId,
  supabase,
  userId,
  workspaceId
}: {
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  userId: string;
  workspaceId: string;
}) {
  const access = await getUserSubscriptionAccessForClient(supabase, userId);

  try {
    assertUsageWithinLimits(access, "products");
  } catch (error) {
    const message = billingEnforcementMessage(error) ?? "Your current plan cannot create another product.";
    await recordSubscriptionEnforcementLog({
      access,
      action: "product.create",
      error,
      storeId,
      supabase,
      workspaceId
    });
    await recordMonitoringEventSafe({
      entityType: "product",
      eventStatus: "failed",
      eventType: "product_create_failed",
      metadata: {
        code: "billing-blocked",
        message,
        reason: "Billing limit blocked product creation"
      },
      storeId,
      supabase,
      userId,
      workspaceId
    });
    productsRedirect(
      storeId,
      `billing-blocked:${message}`
    );
  }
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

async function categoryBelongsToStore({
  categoryId,
  storeId,
  supabase,
  workspaceId
}: {
  categoryId: string | null;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  if (!categoryId) {
    return { belongs: true, error: null };
  }

  const { data, error } = await supabase
    .from("store_categories" as never)
    .select("id")
    .eq("id", categoryId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  return { belongs: Boolean(data), error };
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

async function insertProductImageMetadata({
  payload,
  supabase
}: {
  payload: ProductImagePayload;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
}) {
  const insertSelect = "id, public_url, image_role, storage_bucket, storage_path";
  const userInsert = (await supabase
    .from("product_images" as never)
    .insert(payload as never)
    .select(insertSelect)
    .single()) as {
    data: unknown;
    error: { code?: string; message?: string } | null;
  };

  if (!userInsert.error && userInsert.data) {
    return {
      error: null,
      image: userInsert.data as unknown as ProductImageRecord,
      usedAdminFallback: false
    };
  }

  logProductImageError("metadata insert failed with user client", {
    code: userInsert.error?.code,
    message: userInsert.error?.message,
    productId: payload.product_id,
    storagePath: payload.storage_path,
    storeId: payload.store_id,
    userId: payload.user_id
  });

  const admin = createAdminClient();

  if (!admin) {
    return {
      error: userInsert.error ?? new Error("Admin client unavailable"),
      image: null,
      usedAdminFallback: false
    };
  }

  const adminInsert = (await admin
    .from("product_images" as never)
    .insert(payload as never)
    .select(insertSelect)
    .single()) as {
    data: unknown;
    error: { code?: string; message?: string } | null;
  };

  if (adminInsert.error || !adminInsert.data) {
    logProductImageError("metadata insert failed with admin client", {
      code: adminInsert.error?.code,
      message: adminInsert.error?.message,
      productId: payload.product_id,
      storagePath: payload.storage_path,
      storeId: payload.store_id,
      userId: payload.user_id
    });

    return {
      error: adminInsert.error ?? userInsert.error ?? new Error("Metadata insert failed"),
      image: null,
      usedAdminFallback: true
    };
  }

  return {
    error: null,
    image: adminInsert.data as unknown as ProductImageRecord,
    usedAdminFallback: true
  };
}

async function deleteProductImageMetadata({
  image,
  productId,
  storeId,
  supabase,
  workspaceId
}: {
  image: ProductImageRecord;
  productId: string;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const userDelete = await supabase
    .from("product_images" as never)
    .delete()
    .eq("id", image.id)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (!userDelete.error) {
    return null;
  }

  const admin = createAdminClient();

  if (!admin) {
    return userDelete.error;
  }

  const adminDelete = await admin
    .from("product_images" as never)
    .delete()
    .eq("id", image.id)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  return adminDelete.error ?? null;
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
  const categoryId = cleanText(formData.get("categoryId"), 80);

  if (!title) {
    return null;
  }

  return {
    category_id: categoryId || null,
    compare_at_price: cleanOptionalMoney(formData.get("compareAtPrice")),
    currency: cleanCurrency(formData.get("currency")),
    description: cleanOptionalText(formData.get("description"), 1000),
    inventory_status: formData.get("trackInventory") === "on" && cleanInteger(formData.get("stockQuantity")) <= 0
      ? "out_of_stock"
      : "in_stock",
    low_stock_threshold: cleanOptionalInteger(formData.get("lowStockThreshold")),
    name: title,
    price: price.toFixed(2),
    price_label: price.toFixed(2),
    short_description: cleanOptionalText(formData.get("shortDescription"), 500),
    sku: cleanOptionalText(formData.get("sku"), 80),
    slug: `${slugify(title)}-${slugSuffix}`,
    status: cleanStatus(formData.get("status")),
    stock_quantity: cleanInteger(formData.get("stockQuantity")),
    title,
    track_inventory: formData.get("trackInventory") === "on"
  };
}

function variantStatus(value: FormDataEntryValue | null) {
  return cleanText(value, 20) === "inactive" ? "inactive" : "active";
}

function variantPayload(formData: FormData) {
  const name = cleanText(formData.get("variantName"), 140);

  if (!name) {
    return null;
  }

  return {
    name,
    option_color: cleanOptionalText(formData.get("variantColor"), 80),
    option_custom_name: cleanOptionalText(formData.get("variantCustomName"), 80),
    option_custom_value: cleanOptionalText(formData.get("variantCustomValue"), 120),
    option_material: cleanOptionalText(formData.get("variantMaterial"), 120),
    option_size: cleanOptionalText(formData.get("variantSize"), 80),
    price_override: cleanOptionalMoney(formData.get("variantPrice")),
    sku: cleanOptionalText(formData.get("variantSku"), 80),
    status: variantStatus(formData.get("variantStatus")),
    stock_quantity: cleanInteger(formData.get("variantStockQuantity"))
  };
}

export async function createStoreOwnerProduct(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const validationError = validateProductForm(formData);

  if (validationError) {
    await recordProductCreateFailure({
      detail: validationError.message,
      reason: validationError.message,
      status: validationError.code,
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
    productsRedirect(storeId, validationError.code, validationError.message);
  }

  const payload = productPayload(formData);

  if (!payload) {
    await recordProductCreateFailure({
      detail: "Product title is required.",
      reason: "Product title is required.",
      status: "missing-title",
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
    productsRedirect(storeId, "missing-title");
  }

  const categoryAccess = await categoryBelongsToStore({ categoryId: payload.category_id, storeId, supabase, workspaceId });

  if (categoryAccess.error) {
    const safeMessage = safeProductDatabaseErrorMessage(categoryAccess.error);
    console.error("[products-foundation] category lookup failed during product create", {
      categoryId: payload.category_id,
      code: categoryAccess.error.code,
      details: categoryAccess.error.details,
      hint: categoryAccess.error.hint,
      message: categoryAccess.error.message,
      storeId
    });
    await recordProductCreateFailure({
      detail: safeMessage,
      error: categoryAccess.error,
      reason: "Category lookup failed",
      status: "create-failed",
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
    productsRedirect(storeId, "create-failed", safeMessage);
  }

  if (!categoryAccess.belongs) {
    await recordProductCreateFailure({
      detail: "Selected category was not found for this store.",
      reason: "Category not found",
      status: "category-not-found",
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
    productsRedirect(storeId, "category-not-found");
  }

  await assertProductCreationAllowed({
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  const { data: createdProduct, error } = await supabase
    .from("store_products" as never)
    .insert({
      ...payload,
      owner_user_id: user.id,
      store_id: storeId,
      user_id: user.id,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !createdProduct) {
    const productInsertError = error ?? {
      code: "no_data",
      details: null,
      hint: null,
      message: "Product insert did not return a created product."
    };
    const safeMessage = safeProductDatabaseErrorMessage(productInsertError);
    console.error("[products-foundation] create product failed", {
      code: productInsertError.code,
      details: productInsertError.details,
      hint: productInsertError.hint,
      message: productInsertError.message,
      storeId
    });
    await recordProductCreateFailure({
      detail: safeMessage,
      error: productInsertError,
      reason: safeMessage,
      status: "create-failed",
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
    productsRedirect(storeId, "create-failed", safeMessage);
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
  }
  await recordMonitoringEventSafe({
    entityId: (createdProduct as { id?: string | null } | null)?.id,
    entityType: "product",
    eventType: "product.created",
    metadata: { status: payload.status },
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });
  productsRedirect(storeId, "created");
}

export async function updateStoreOwnerProduct(formData: FormData) {
  const { store, storeId, supabase, user, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const payload = productPayload(formData, productId);

  if (!productId || !payload) {
    productsRedirect(storeId, "update-failed");
  }

  const categoryAccess = await categoryBelongsToStore({ categoryId: payload.category_id, storeId, supabase, workspaceId });

  if (categoryAccess.error) {
    console.error("[products-foundation] category lookup failed during product update", {
      categoryId: payload.category_id,
      code: categoryAccess.error.code,
      details: categoryAccess.error.details,
      hint: categoryAccess.error.hint,
      message: categoryAccess.error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "update-failed");
  }

  if (!categoryAccess.belongs) {
    productsRedirect(storeId, "category-not-found");
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
  await recordMonitoringEventSafe({
    entityId: productId,
    entityType: "product",
    eventType: "product.updated",
    metadata: { status: payload.status },
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });
  productsRedirect(storeId, "updated");
}

export async function createStoreOwnerProductVariant(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const payload = variantPayload(formData);

  if (!productId || !payload) {
    productsRedirect(storeId, "variant-failed");
  }

  const product = await loadProtectedProduct({ productId, storeId, supabase, workspaceId });

  if (!product) {
    productsRedirect(storeId, "variant-failed");
  }

  const { error } = await supabase.from("product_variants" as never).insert({
    ...payload,
    product_id: productId,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[product-variants] create failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    productsRedirect(storeId, "variant-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/store/${store.slug}/product/${productId}`);
  }

  productsRedirect(storeId, "variant-created");
}

export async function updateStoreOwnerProductVariant(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const variantId = cleanText(formData.get("variantId"), 80);
  const payload = variantPayload(formData);

  if (!productId || !variantId || !payload) {
    productsRedirect(storeId, "variant-failed");
  }

  const { error } = await supabase
    .from("product_variants" as never)
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[product-variants] update failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId,
      variantId
    });
    productsRedirect(storeId, "variant-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/store/${store.slug}/product/${productId}`);
  }

  productsRedirect(storeId, "variant-updated");
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

export async function setStoreOwnerProductVisibility(formData: FormData) {
  const { store, storeId, supabase, workspaceId } = await requireWorkspaceStore(formData);
  const productId = cleanText(formData.get("productId"), 80);
  const status = cleanVisibilityStatus(formData.get("visibilityStatus"));

  if (!productId) {
    productsRedirect(storeId, "visibility-failed");
  }

  const { error } = await supabase
    .from("store_products" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[products-visibility] update failed", {
      code: error.code,
      message: error.message,
      productId,
      status,
      storeId,
      workspaceId
    });
    productsRedirect(storeId, "visibility-failed");
  }

  revalidatePath(productListPath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  if (store.slug) {
    revalidatePath(`/store/${store.slug}`);
    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/store/${store.slug}/product/${productId}`);
  }

  productsRedirect(storeId, status === "active" ? "published" : "unpublished");
}

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

  const metadataPayload: ProductImagePayload = {
    content_type: file.type,
    file_name: file.name.slice(0, 180),
    file_size: file.size,
    image_role: role,
    image_type: role,
    owner_user_id: user.id,
    product_id: productId,
    public_url: publicUrl,
    sort_order: sortOrder,
    storage_bucket: imageBucket,
    storage_path: storagePath,
    store_id: storeId,
    user_id: user.id,
    workspace_id: workspaceId
  };
  const metadataResult = await insertProductImageMetadata({
    payload: metadataPayload,
    supabase
  });

  if (metadataResult.error || !metadataResult.image) {
    await supabase.storage.from(imageBucket).remove([storagePath]);
    const rollback =
      role === "main"
        ? await supabase
            .from("store_products" as never)
            .update({
              image_url: protectedProduct.image_url ?? null,
              updated_at: new Date().toISOString()
            } as never)
            .eq("id", productId)
            .eq("store_id", storeId)
            .eq("workspace_id" as never, workspaceId as never)
        : await supabase
            .from("store_products" as never)
            .update({
              gallery: normalizeGallery(protectedProduct.gallery),
              updated_at: new Date().toISOString()
            } as never)
            .eq("id", productId)
            .eq("store_id", storeId)
            .eq("workspace_id" as never, workspaceId as never);

    if (rollback.error) {
      logProductImageError("product image rollback failed after metadata error", {
        code: rollback.error.code,
        message: rollback.error.message,
        productId,
        storagePath,
        storeId,
        userId: user.id
      });
    }

    logProductImageError("metadata insert failed after product update", {
      code: "metadata-insert-failed",
      message: metadataResult.error instanceof Error ? metadataResult.error.message : "Unknown metadata error",
      productId,
      storagePath,
      storeId,
      userId: user.id
    });
    await revalidateProductImagePaths(store, storeId, productId);
    productsRedirect(storeId, "image-save-failed");
  }

  const normalizedImage = metadataResult.image as ProductImageRecord;

  if (role === "main" && previousMain) {
    const previousDeleteError = await deleteProductImageMetadata({
      image: previousMain,
      productId,
      storeId,
      supabase,
      workspaceId
    });

    if (previousDeleteError) {
      logProductImageError("previous main metadata delete failed", {
        code: previousDeleteError.code,
        message: previousDeleteError.message,
        productId,
        storagePath: previousMain.storage_path,
        storeId,
        userId: user.id
      });
    } else {
      await supabase.storage.from(previousMain.storage_bucket).remove([previousMain.storage_path]);
    }
  }

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
