import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type StoreNotificationType =
  | "coupon_used"
  | "low_stock"
  | "new_order"
  | "order_cancelled"
  | "order_confirmed"
  | "review_submitted";

type NotificationMetadata = Record<string, unknown>;

type StoreNotificationInput = {
  message: string;
  metadata?: NotificationMetadata;
  storeId: string;
  title: string;
  type: StoreNotificationType;
  workspaceId?: string | null;
};

type OrderNotificationInput = {
  customerName?: string | null;
  orderId: string;
  orderSource: "orders" | "store_orders";
  storeId: string;
  totalAmount?: number | null;
  type: Extract<StoreNotificationType, "new_order" | "order_cancelled" | "order_confirmed">;
  workspaceId?: string | null;
};

const LOW_STOCK_THRESHOLD = 5;
const sensitiveKeyPattern = /email|password|secret|token|key|credential|phone/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 240);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as NotificationMetadata);
  }

  return String(value).slice(0, 120);
}

function sanitizeMetadata(metadata: NotificationMetadata = {}) {
  const safe: NotificationMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    safe[key.slice(0, 80)] = sanitizeValue(value);
  }

  return safe;
}

async function resolveStoreNotificationTarget(
  supabase: SupabaseClient,
  storeId: string,
  workspaceId?: string | null
) {
  const { data, error } = await supabase
    .from("stores" as never)
    .select("id, name, title, user_id, owner_user_id, workspace_id")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (error) {
    console.warn("[store-notifications] store lookup failed", {
      message: error.message,
      storeId
    });
    return null;
  }

  const store = data as {
    id: string;
    name?: string | null;
    owner_user_id?: string | null;
    title?: string | null;
    user_id?: string | null;
    workspace_id?: string | null;
  } | null;
  const userId = store?.owner_user_id ?? store?.user_id ?? null;

  if (!store || !userId) {
    console.warn("[store-notifications] skipped without store owner", { storeId });
    return null;
  }

  return {
    storeName: store.title ?? store.name ?? "Store",
    userId,
    workspaceId: workspaceId ?? store.workspace_id ?? userId
  };
}

async function notificationAlreadyExists({
  metadata,
  storeId,
  supabase,
  type,
  userId,
  workspaceId
}: {
  metadata: NotificationMetadata;
  storeId: string;
  supabase: SupabaseClient;
  type: StoreNotificationType;
  userId: string;
  workspaceId: string;
}) {
  const dedupeMetadata = Object.fromEntries(
    ["orderId", "productId", "reviewId", "couponId", "variantId"]
      .map((key) => [key, metadata[key]])
      .filter(([, value]) => Boolean(value))
  );

  if (!Object.keys(dedupeMetadata).length) {
    return false;
  }

  const { data, error } = await supabase
    .from("notifications" as never)
    .select("id")
    .eq("user_id" as never, userId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("type" as never, type as never)
    .contains("metadata" as never, dedupeMetadata as never)
    .limit(1);

  if (error) {
    console.warn("[store-notifications] duplicate lookup skipped", {
      message: error.message,
      storeId,
      type,
      workspaceId
    });
    return false;
  }

  return Boolean((data ?? []).length);
}

export async function createStoreNotificationSafe(input: StoreNotificationInput) {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[store-notifications] skipped without service client", { type: input.type });
    return false;
  }

  const target = await resolveStoreNotificationTarget(admin, input.storeId, input.workspaceId);

  if (!target) {
    return false;
  }

  const metadata = sanitizeMetadata(input.metadata ?? {});

  if (
    await notificationAlreadyExists({
      metadata,
      storeId: input.storeId,
      supabase: admin,
      type: input.type,
      userId: target.userId,
      workspaceId: target.workspaceId
    })
  ) {
    return false;
  }

  const { error } = await admin.from("notifications" as never).insert({
    message: input.message,
    metadata: metadata as Json,
    status: "unread",
    store_id: input.storeId,
    title: input.title,
    type: input.type,
    user_id: target.userId,
    workspace_id: target.workspaceId
  } as never);

  if (error) {
    console.warn("[store-notifications] insert failed", {
      code: error.code,
      message: error.message,
      storeId: input.storeId,
      type: input.type,
      workspaceId: target.workspaceId
    });
    return false;
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
  return true;
}

function orderNotificationCopy(input: OrderNotificationInput) {
  const customer = input.customerName?.trim() || "Customer";

  if (input.type === "order_confirmed") {
    return {
      message: `Order ${input.orderId.slice(0, 8)} has been confirmed.`,
      title: "Order confirmed"
    };
  }

  if (input.type === "order_cancelled") {
    return {
      message: `Order ${input.orderId.slice(0, 8)} has been cancelled.`,
      title: "Order cancelled"
    };
  }

  return {
    message: `${customer} created order ${input.orderId.slice(0, 8)}${input.totalAmount ? ` with total ${input.totalAmount.toFixed(2)}` : ""}.`,
    title: "New order received"
  };
}

export async function createOrderNotificationSafe(input: OrderNotificationInput) {
  const copy = orderNotificationCopy(input);

  return createStoreNotificationSafe({
    message: copy.message,
    metadata: {
      orderId: input.orderId,
      orderSource: input.orderSource,
      totalAmount: input.totalAmount ?? null
    },
    storeId: input.storeId,
    title: copy.title,
    type: input.type,
    workspaceId: input.workspaceId
  });
}

type OrderLine = {
  productId: string;
  quantity: number;
  variantId: string | null;
};

function orderLinesFromStoreOrderItems(value: unknown): OrderLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const productId =
        typeof record.product_id === "string"
          ? record.product_id
          : typeof record.id === "string"
            ? record.id
            : "";

      if (!productId) {
        return null;
      }

      return {
        productId,
        quantity: typeof record.quantity === "number" ? record.quantity : 1,
        variantId: typeof record.variant_id === "string" ? record.variant_id : null
      };
    })
    .filter((item): item is OrderLine => Boolean(item));
}

async function loadOrderLines({
  orderId,
  orderSource,
  supabase
}: {
  orderId: string;
  orderSource: "orders" | "store_orders";
  supabase: SupabaseClient;
}) {
  if (orderSource === "store_orders") {
    const { data } = await supabase
      .from("store_orders" as never)
      .select("items")
      .eq("id" as never, orderId as never)
      .maybeSingle();

    return orderLinesFromStoreOrderItems((data as { items?: unknown } | null)?.items);
  }

  const { data } = await supabase
    .from("order_items" as never)
    .select("product_id, variant_id, quantity")
    .eq("order_id" as never, orderId as never);

  return ((data ?? []) as unknown as Array<{
    product_id?: string | null;
    quantity?: number | null;
    variant_id?: string | null;
  }>)
    .filter((item) => item.product_id)
    .map((item) => ({
      productId: item.product_id as string,
      quantity: item.quantity ?? 1,
      variantId: item.variant_id ?? null
    }));
}

export async function createLowStockNotificationsForOrderSafe({
  orderId,
  orderSource,
  storeId,
  workspaceId
}: {
  orderId: string;
  orderSource: "orders" | "store_orders";
  storeId: string;
  workspaceId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  const lines = await loadOrderLines({ orderId, orderSource, supabase: admin });
  const productIds = Array.from(new Set(lines.map((line) => line.productId)));
  const variantIds = Array.from(new Set(lines.map((line) => line.variantId).filter(Boolean))) as string[];

  if (!productIds.length) {
    return false;
  }

  const [productsResult, variantsResult] = await Promise.all([
    admin
      .from("store_products" as never)
      .select("id, title, name, track_inventory, stock_quantity")
      .eq("store_id" as never, storeId as never)
      .in("id" as never, productIds as never),
    variantIds.length
      ? admin
          .from("product_variants" as never)
          .select("id, product_id, name, stock_quantity")
          .eq("store_id" as never, storeId as never)
          .in("id" as never, variantIds as never)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (productsResult.error || variantsResult.error) {
    console.warn("[store-notifications] low stock lookup failed", {
      orderId,
      productsError: productsResult.error?.message,
      variantsError: variantsResult.error?.message,
      storeId
    });
    return false;
  }

  const products = (productsResult.data ?? []) as unknown as Array<{
    id: string;
    name?: string | null;
    stock_quantity?: number | null;
    title?: string | null;
    track_inventory?: boolean | null;
  }>;
  const variants = (variantsResult.data ?? []) as unknown as Array<{
    id: string;
    name?: string | null;
    product_id?: string | null;
    stock_quantity?: number | null;
  }>;
  const productNameById = new Map(
    products.map((product) => [product.id, product.title ?? product.name ?? "Product"])
  );

  await Promise.all([
    ...products
      .filter(
        (product) =>
          product.track_inventory === true &&
          typeof product.stock_quantity === "number" &&
          product.stock_quantity <= LOW_STOCK_THRESHOLD
      )
      .map((product) =>
        createStoreNotificationSafe({
          message: `${product.title ?? product.name ?? "Product"} has ${product.stock_quantity ?? 0} units left.`,
          metadata: {
            orderId,
            orderSource,
            productId: product.id,
            stockQuantity: product.stock_quantity ?? 0,
            threshold: LOW_STOCK_THRESHOLD
          },
          storeId,
          title: "Low stock alert",
          type: "low_stock",
          workspaceId
        })
      ),
    ...variants
      .filter(
        (variant) =>
          typeof variant.stock_quantity === "number" &&
          variant.stock_quantity <= LOW_STOCK_THRESHOLD
      )
      .map((variant) =>
        createStoreNotificationSafe({
          message: `${productNameById.get(variant.product_id ?? "") ?? "Product"} / ${variant.name ?? "Variant"} has ${variant.stock_quantity ?? 0} units left.`,
          metadata: {
            orderId,
            orderSource,
            productId: variant.product_id ?? null,
            stockQuantity: variant.stock_quantity ?? 0,
            threshold: LOW_STOCK_THRESHOLD,
            variantId: variant.id
          },
          storeId,
          title: "Low stock alert",
          type: "low_stock",
          workspaceId
        })
      )
  ]);

  return true;
}
