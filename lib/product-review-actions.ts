"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPurchasedProductForReview } from "@/lib/product-reviews";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

const reviewsPath = "/dashboard/reviews";

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function reviewRedirect(slug: string, productId: string, status: string): never {
  const params = new URLSearchParams({ review: status });
  redirect(`/store/${slug}/product/${encodeURIComponent(productId)}?${params.toString()}`);
}

function dashboardRedirect(storeId: string, status: string): never {
  const params = new URLSearchParams({ reviews: status, storeId });
  redirect(`${reviewsPath}?${params.toString()}`);
}

function parseRating(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(cleanText(value, 10), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reviewStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 20);
  return status === "approved" || status === "rejected" ? status : "pending";
}

export async function submitProductReview(formData: FormData) {
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const productId = cleanText(formData.get("productId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const submittedWorkspaceId = cleanText(formData.get("workspaceId"), 80);
  const orderReference = cleanText(formData.get("orderReference"), 80);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const title = cleanText(formData.get("title"), 140);
  const comment = cleanText(formData.get("comment"), 2000);
  const rating = parseRating(formData.get("rating"));

  if (!slug || !productId || !storeId) {
    redirect("/store");
  }

  if (rating < 1 || rating > 5 || !comment) {
    reviewRedirect(slug, productId, "invalid");
  }

  const purchase = await verifyPurchasedProductForReview({
    orderReference,
    phone: customerPhone,
    productId,
    storeId
  });

  if (!purchase) {
    reviewRedirect(slug, productId, "purchase-required");
  }

  const admin = createAdminClient();

  if (!admin) {
    reviewRedirect(slug, productId, "not-configured");
  }

  const { data: storeRow } = await admin
    .from("stores")
    .select("workspace_id")
    .eq("id", storeId)
    .eq("status", "published")
    .maybeSingle();
  const workspaceId =
    submittedWorkspaceId ||
    ((storeRow as { workspace_id?: string | null } | null)?.workspace_id ?? "");

  if (!workspaceId) {
    reviewRedirect(slug, productId, "failed");
  }

  const { error } = await admin.from("product_reviews" as never).insert({
    comment,
    customer_name: purchase.customerName,
    customer_phone: customerPhone,
    order_id: purchase.orderId,
    product_id: productId,
    rating,
    status: "pending",
    store_id: storeId,
    title: title || null,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[product-reviews] submit failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    reviewRedirect(slug, productId, "failed");
  }

  revalidatePath(`/store/${slug}/product/${productId}`);
  reviewRedirect(slug, productId, "submitted");
}

export async function moderateProductReview(formData: FormData) {
  const reviewId = cleanText(formData.get("reviewId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = reviewStatus(formData.get("status"));
  const moderationNote = cleanText(formData.get("moderationNote"), 1000);

  if (!reviewId || !storeId) {
    redirect(`${reviewsPath}?reviews=missing-review`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "manage_products",
    redirectTo: reviewsPath
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    dashboardRedirect(storeId, "not-authorized");
  }

  const { error } = await supabase
    .from("product_reviews" as never)
    .update({
      moderation_note: moderationNote || null,
      moderated_at: new Date().toISOString(),
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, reviewId as never)
    .eq("store_id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.error("[product-reviews] moderation failed", {
      code: error.code,
      message: error.message,
      reviewId,
      storeId
    });
    dashboardRedirect(storeId, "moderation-failed");
  }

  revalidatePath(reviewsPath);
  dashboardRedirect(storeId, status);
}
