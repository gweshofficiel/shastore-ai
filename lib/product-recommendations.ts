import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

export type RecommendationContext = "related" | "storefront";
export type RecommendationSource =
  | "manual"
  | "same_category"
  | "same_collection"
  | "frequently_purchased"
  | "top_selling";

export type RecommendedProduct = {
  product: PublicStorefrontProduct;
  score: number;
  source: RecommendationSource;
};

type RecommendationLinkRow = {
  recommended_product_id: string;
  sort_order: number | null;
};

type StoreOrderRow = {
  id: string;
  items?: unknown;
};

type OrderItemRow = {
  order_id: string;
  product_id: string | null;
  quantity?: number | string | null;
};

function numberValue(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function activeProducts(products: PublicStorefrontProduct[]) {
  return products.filter((product) => product.status === "active");
}

function productIdsFromStoreOrderItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      return typeof record.product_id === "string"
        ? record.product_id
        : typeof record.id === "string"
          ? record.id
          : null;
    })
    .filter((productId): productId is string => Boolean(productId));
}

function addRecommendation(
  recommendations: Map<string, RecommendedProduct>,
  product: PublicStorefrontProduct | undefined,
  source: RecommendationSource,
  score: number,
  sourceProductId: string | null
) {
  if (!product || product.id === sourceProductId || product.status !== "active") {
    return;
  }

  const existing = recommendations.get(product.id);

  if (!existing || score > existing.score) {
    recommendations.set(product.id, { product, score, source });
  }
}

async function manualRecommendationIds({
  context,
  sourceProductId,
  storeId
}: {
  context: RecommendationContext;
  sourceProductId?: string | null;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  let query = admin
    .from("product_recommendation_links" as never)
    .select("recommended_product_id, sort_order")
    .eq("store_id" as never, storeId as never)
    .eq("recommendation_context" as never, context as never)
    .eq("status" as never, "active" as never);

  query = sourceProductId
    ? query.eq("source_product_id" as never, sourceProductId as never)
    : query.is("source_product_id" as never, null);

  const { data, error } = await query.order("sort_order" as never, { ascending: true } as never);

  if (error) {
    return [];
  }

  return ((data ?? []) as unknown as RecommendationLinkRow[]).map((row) => row.recommended_product_id);
}

async function frequentlyPurchasedScores({
  sourceProductId,
  storeId
}: {
  sourceProductId?: string | null;
  storeId: string;
}) {
  const admin = createAdminClient();
  const scores = new Map<string, number>();

  if (!admin || !sourceProductId) {
    return scores;
  }

  const { data: storeOrders } = await admin
    .from("store_orders" as never)
    .select("id, items")
    .eq("store_id" as never, storeId as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  for (const order of (storeOrders ?? []) as unknown as StoreOrderRow[]) {
    const ids = productIdsFromStoreOrderItems(order.items);

    if (!ids.includes(sourceProductId)) {
      continue;
    }

    for (const productId of ids) {
      if (productId !== sourceProductId) {
        scores.set(productId, (scores.get(productId) ?? 0) + 1);
      }
    }
  }

  const { data: orderItems } = await admin
    .from("order_items" as never)
    .select("order_id, product_id, quantity")
    .eq("store_id" as never, storeId as never)
    .not("product_id" as never, "is", null)
    .limit(500);
  const orderProductIds = new Map<string, Set<string>>();

  for (const item of (orderItems ?? []) as unknown as OrderItemRow[]) {
    if (!item.order_id || !item.product_id) {
      continue;
    }

    const set = orderProductIds.get(item.order_id) ?? new Set<string>();
    set.add(item.product_id);
    orderProductIds.set(item.order_id, set);
  }

  for (const ids of orderProductIds.values()) {
    if (!ids.has(sourceProductId)) {
      continue;
    }

    for (const productId of ids) {
      if (productId !== sourceProductId) {
        scores.set(productId, (scores.get(productId) ?? 0) + 1);
      }
    }
  }

  return scores;
}

export async function getProductRecommendations({
  context = "related",
  limit = 4,
  products,
  sourceProductId = null,
  storeId
}: {
  context?: RecommendationContext;
  limit?: number;
  products: PublicStorefrontProduct[];
  sourceProductId?: string | null;
  storeId: string;
}) {
  const scopedProducts = activeProducts(products);
  const productsById = new Map(scopedProducts.map((product) => [product.id, product]));
  const sourceProduct = sourceProductId ? productsById.get(sourceProductId) ?? null : null;
  const recommendations = new Map<string, RecommendedProduct>();
  const manualIds = await manualRecommendationIds({ context, sourceProductId, storeId });

  manualIds.forEach((productId, index) => {
    addRecommendation(
      recommendations,
      productsById.get(productId),
      "manual",
      10_000 - index,
      sourceProductId
    );
  });

  if (recommendations.size >= limit) {
    return [...recommendations.values()].slice(0, limit);
  }

  if (sourceProduct) {
    for (const product of scopedProducts) {
      if (product.categoryId && product.categoryId === sourceProduct.categoryId) {
        addRecommendation(recommendations, product, "same_category", 800 + numberValue(product.salesCount), sourceProductId);
      } else if (
        product.categoryName &&
        sourceProduct.categoryName &&
        product.categoryName.toLowerCase() === sourceProduct.categoryName.toLowerCase()
      ) {
        addRecommendation(recommendations, product, "same_collection", 700 + numberValue(product.salesCount), sourceProductId);
      }
    }

    const coPurchaseScores = await frequentlyPurchasedScores({ sourceProductId, storeId });
    for (const [productId, score] of coPurchaseScores.entries()) {
      addRecommendation(recommendations, productsById.get(productId), "frequently_purchased", 600 + score, sourceProductId);
    }
  }

  for (const product of [...scopedProducts].sort((left, right) => numberValue(right.salesCount) - numberValue(left.salesCount))) {
    addRecommendation(recommendations, product, "top_selling", 100 + numberValue(product.salesCount), sourceProductId);
  }

  return [...recommendations.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
