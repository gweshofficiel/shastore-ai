import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type PublicProductReview = {
  comment: string;
  createdAt: string;
  customerName: string;
  featured: boolean;
  id: string;
  images: string[];
  rating: number;
  sellerRepliedAt: string | null;
  sellerReply: string | null;
  title: string | null;
  verifiedPurchase: boolean;
};

export type ProductReviewSummary = {
  averageRating: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  reviewCount: number;
  verifiedCount: number;
};

type ProductReviewRow = {
  comment: string;
  created_at: string;
  customer_name: string;
  featured?: boolean | null;
  id: string;
  order_id?: string | null;
  rating: number;
  review_images?: Json | null;
  seller_replied_at?: string | null;
  seller_reply?: string | null;
  title?: string | null;
  verified_purchase?: boolean | null;
};

export type ProductReviewFilter = "newest" | "highest" | "lowest" | "verified";

function numberValue(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function imageUrls(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.startsWith("http://") || item.startsWith("https://"))
    .slice(0, 6);
}

function normalizeFilter(value: string | null | undefined): ProductReviewFilter {
  return value === "highest" || value === "lowest" || value === "verified" ? value : "newest";
}

function emptyReviewSummary(): ProductReviewSummary {
  return {
    averageRating: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    reviewCount: 0,
    verifiedCount: 0
  };
}

function summarizeReviewRows(rows: ProductReviewRow[]): ProductReviewSummary {
  const ratings = rows.map((review) => ({
    rating: Math.min(5, Math.max(1, Math.round(numberValue(review.rating)))),
    verifiedPurchase: review.verified_purchase === true || Boolean(review.order_id)
  }));
  const ratingBreakdown = ratings.reduce<Record<1 | 2 | 3 | 4 | 5, number>>(
    (counts, review) => {
      counts[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
      return counts;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  );
  const reviewCount = ratings.length;

  return {
    averageRating: reviewCount
      ? Number((ratings.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
      : 0,
    ratingBreakdown,
    reviewCount,
    verifiedCount: ratings.filter((review) => review.verifiedPurchase).length
  };
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
  filter = "newest",
  productId,
  storeId
}: {
  filter?: ProductReviewFilter | string;
  productId: string;
  storeId: string;
}) {
  const admin = createAdminClient();
  const normalizedFilter = normalizeFilter(filter);

  if (!admin) {
    return { filter: normalizedFilter, reviews: [], summary: emptyReviewSummary() };
  }

  let query = admin
    .from("product_reviews" as never)
    .select("id, customer_name, rating, title, comment, created_at, order_id, verified_purchase, seller_reply, seller_replied_at, featured, review_images")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("status" as never, "approved" as never);

  if (normalizedFilter === "verified") {
    query = query.eq("verified_purchase" as never, true as never);
  }

  if (normalizedFilter === "highest") {
    query = query.order("rating" as never, { ascending: false } as never);
  } else if (normalizedFilter === "lowest") {
    query = query.order("rating" as never, { ascending: true } as never);
  }

  const { data } = await query.order("created_at", { ascending: false });
  const reviewRows = (data ?? []) as unknown as ProductReviewRow[];
  const reviews = reviewRows.map((review) => ({
    comment: review.comment,
    createdAt: review.created_at,
    customerName: review.customer_name,
    featured: review.featured === true,
    id: review.id,
    images: imageUrls(review.review_images),
    rating: Math.min(5, Math.max(1, Math.round(numberValue(review.rating)))),
    sellerRepliedAt: review.seller_replied_at ?? null,
    sellerReply: review.seller_reply ?? null,
    title: review.title ?? null,
    verifiedPurchase: review.verified_purchase === true || Boolean(review.order_id)
  }));

  return {
    filter: normalizedFilter,
    reviews,
    summary: summarizeReviewRows(reviewRows)
  };
}

export async function getProductReviewSummary({
  productId,
  storeId
}: {
  productId: string;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return emptyReviewSummary();
  }

  const { data } = await admin
    .from("product_reviews" as never)
    .select("rating, order_id, verified_purchase")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("status" as never, "approved" as never);

  return summarizeReviewRows((data ?? []) as unknown as ProductReviewRow[]);
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

export async function getProductReviewStatusByOrder({
  orderId,
  storeId
}: {
  orderId: string;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return new Map<string, string>();
  }

  const { data } = await admin
    .from("product_reviews" as never)
    .select("product_id, status")
    .eq("store_id" as never, storeId as never)
    .eq("order_id" as never, orderId as never);

  return new Map(
    ((data ?? []) as unknown as Array<{ product_id: string; status: string }>).map((review) => [
      review.product_id,
      review.status
    ])
  );
}
