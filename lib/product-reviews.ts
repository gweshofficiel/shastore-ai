import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type PublicProductReview = {
  comment: string;
  createdAt: string;
  customerName: string;
  id: string;
  rating: number;
  title: string | null;
};

export type ProductReviewSummary = {
  averageRating: number;
  reviewCount: number;
};

type ProductReviewRow = {
  comment: string;
  created_at: string;
  customer_name: string;
  id: string;
  rating: number;
  title?: string | null;
};

function numberValue(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function parseStoreOrderItems(value: Json): Array<{ productId: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, Json | undefined> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      productId:
        typeof item.id === "string"
          ? item.id
          : typeof item.product_id === "string"
            ? item.product_id
            : null
    }));
}

export async function getApprovedProductReviews({
  productId,
  storeId
}: {
  productId: string;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return { reviews: [], summary: { averageRating: 0, reviewCount: 0 } };
  }

  const { data } = await admin
    .from("product_reviews" as never)
    .select("id, customer_name, rating, title, comment, created_at")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("status" as never, "approved" as never)
    .order("created_at", { ascending: false });
  const reviews = ((data ?? []) as unknown as ProductReviewRow[]).map((review) => ({
    comment: review.comment,
    createdAt: review.created_at,
    customerName: review.customer_name,
    id: review.id,
    rating: Math.min(5, Math.max(1, Math.round(numberValue(review.rating)))),
    title: review.title ?? null
  }));
  const reviewCount = reviews.length;
  const averageRating = reviewCount
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
    : 0;

  return {
    reviews,
    summary: {
      averageRating,
      reviewCount
    }
  };
}

export async function verifyPurchasedProductForReview({
  orderReference,
  phone,
  productId,
  storeId
}: {
  orderReference: string;
  phone: string;
  productId: string;
  storeId: string;
}) {
  const admin = createAdminClient();
  const normalizedPhone = phone.replace(/\D/g, "");
  const normalizedReference = orderReference.trim().toLowerCase();

  if (!admin || !normalizedPhone || !normalizedReference) {
    return null;
  }

  const { data: storeOrders } = await admin
    .from("store_orders")
    .select("id, customer_name, customer_phone, items")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  const matchingStoreOrder = ((storeOrders ?? []) as unknown as Array<{
    customer_name: string;
    customer_phone: string;
    id: string;
    items: Json;
  }>).find((order) => {
    return (
      order.id.toLowerCase().startsWith(normalizedReference) &&
      order.customer_phone.replace(/\D/g, "") === normalizedPhone &&
      parseStoreOrderItems(order.items).some((item) => item.productId === productId)
    );
  });

  if (matchingStoreOrder) {
    return {
      customerName: matchingStoreOrder.customer_name,
      orderId: matchingStoreOrder.id
    };
  }

  const { data: orders } = await admin
    .from("orders" as never)
    .select("id, customer_name, customer_phone, store_id, store_instance_id")
    .or(`store_id.eq.${storeId},store_instance_id.eq.${storeId}` as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(50);
  const orderRows = (orders ?? []) as unknown as Array<{
    customer_name: string;
    customer_phone: string;
    id: string;
  }>;

  for (const order of orderRows) {
    if (
      !order.id.toLowerCase().startsWith(normalizedReference) ||
      order.customer_phone.replace(/\D/g, "") !== normalizedPhone
    ) {
      continue;
    }

    const { data: rawItems } = await admin
      .from("order_items" as never)
      .select("product_id")
      .eq("order_id" as never, order.id as never);
    const hasProduct = ((rawItems ?? []) as unknown as Array<{ product_id: string | null }>).some(
      (item) => item.product_id === productId
    );

    if (hasProduct) {
      return {
        customerName: order.customer_name,
        orderId: order.id
      };
    }
  }

  return null;
}
