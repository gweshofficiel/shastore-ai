"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStoreNotificationSafe } from "@/lib/notifications/store-notifications";
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

function safeReviewReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/store";
  }

  const path = value.trim();
  return path.startsWith("/store/") ? path : "/store";
}

function redirectBackToReviewSurface(returnTo: string, status: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}review=${encodeURIComponent(status)}`);
}

function parseRating(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(cleanText(value, 10), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reviewStatus(value: FormDataEntryValue | null) {
  const status = cleanText(value, 20);
  return status === "approved" || status === "rejected" ? status : "pending";
}

function storeOrderIncludesProduct(value: unknown, productId: string) {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const record = item as Record<string, unknown>;
    return record.id === productId || record.product_id === productId;
  });
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

  const { data: reviewRow, error } = await admin.from("product_reviews" as never).insert({
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
  } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[product-reviews] submit failed", {
      code: error.code,
      message: error.message,
      productId,
      storeId
    });
    reviewRedirect(slug, productId, "failed");
  }

  await createStoreNotificationSafe({
    message: `${purchase.customerName || "A customer"} submitted a review for product ${productId.slice(0, 8)} waiting for approval.`,
    metadata: {
      orderId: purchase.orderId,
      productId,
      rating,
      reviewId: (reviewRow as { id?: string } | null)?.id ?? null
    },
    storeId,
    title: "New review submitted",
    type: "review_submitted",
    workspaceId
  });

  revalidatePath(`/store/${slug}/product/${productId}`);
  revalidatePath(reviewsPath);
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

export async function submitPurchasedProductReview(formData: FormData) {
  const returnTo = safeReviewReturnPath(formData.get("returnTo"));
  const orderId = cleanText(formData.get("orderId"), 80);
  const productId = cleanText(formData.get("productId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const submittedWorkspaceId = cleanText(formData.get("workspaceId"), 80);
  const customerName = cleanText(formData.get("customerName"), 160);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const title = cleanText(formData.get("title"), 140);
  const comment = cleanText(formData.get("comment"), 2000);
  const rating = parseRating(formData.get("rating"));

  if (!orderId || !productId || !storeId || rating < 1 || rating > 5 || !comment) {
    redirectBackToReviewSurface(returnTo, "invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirectBackToReviewSurface(returnTo, "not-configured");
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
    redirectBackToReviewSurface(returnTo, "failed");
  }

  const { data: storeOrder } = await admin
    .from("store_orders")
    .select("items")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  let orderContainsProduct = storeOrderIncludesProduct(
    (storeOrder as { items?: unknown } | null)?.items,
    productId
  );

  if (!orderContainsProduct) {
    const { data: orderRow } = await admin
      .from("orders" as never)
      .select("id, store_id, store_instance_id")
      .eq("id" as never, orderId as never)
      .maybeSingle();
    const orderStore = orderRow as {
      store_id?: string | null;
      store_instance_id?: string | null;
    } | null;

    if (orderStore?.store_id === storeId || orderStore?.store_instance_id === storeId) {
      const { data: orderItems } = await admin
        .from("order_items" as never)
        .select("product_id")
        .eq("order_id" as never, orderId as never);
      orderContainsProduct = ((orderItems ?? []) as unknown as Array<{ product_id: string | null }>).some(
        (item) => item.product_id === productId
      );
    }
  }

  if (!orderContainsProduct) {
    redirectBackToReviewSurface(returnTo, "invalid-product");
  }

  const { data: existingReview } = await admin
    .from("product_reviews" as never)
    .select("id")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();

  if (existingReview) {
    redirectBackToReviewSurface(returnTo, "already-submitted");
  }

  const { data: reviewRow, error } = await admin.from("product_reviews" as never).insert({
    comment,
    customer_name: customerName || "Customer",
    customer_phone: customerPhone || null,
    order_id: orderId,
    product_id: productId,
    rating,
    status: "pending",
    store_id: storeId,
    title: title || null,
    workspace_id: workspaceId
  } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[product-reviews] purchased submit failed", {
      code: error.code,
      message: error.message,
      orderId,
      productId,
      storeId
    });
    redirectBackToReviewSurface(returnTo, "failed");
  }

  await createStoreNotificationSafe({
    message: `${customerName || "A customer"} submitted a review for product ${productId.slice(0, 8)} waiting for approval.`,
    metadata: {
      orderId,
      productId,
      rating,
      reviewId: (reviewRow as { id?: string } | null)?.id ?? null
    },
    storeId,
    title: "New review submitted",
    type: "review_submitted",
    workspaceId
  });

  revalidatePath(returnTo.split("?")[0] ?? returnTo);
  revalidatePath(reviewsPath);
  redirectBackToReviewSurface(returnTo, "submitted");
}
