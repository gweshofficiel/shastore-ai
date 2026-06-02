import type { createAdminClient } from "@/lib/supabase/admin";

export const INVENTORY_CHECKOUT_ERROR =
  "This product is out of stock or quantity is not available.";

export type CheckoutCartItem = {
  id: string;
  quantity: number;
  variantId?: string | null;
};

type InventoryProductRow = {
  id: string;
  inventory_status: string | null;
  status: string | null;
  stock_quantity: unknown;
  store_id: string;
  track_inventory: boolean | null;
};

type InventoryVariantRow = {
  id: string;
  product_id: string;
  status: string | null;
  stock_quantity: unknown;
  store_id: string;
};

export function parseStockQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function tracksInventory(value: unknown) {
  return value === true || value === "t" || value === 1 || value === "1";
}

export function aggregateCheckoutCartItems(items: CheckoutCartItem[]) {
  const quantities = new Map<string, CheckoutCartItem>();

  for (const item of items) {
    const productId = item.id?.trim();
    if (!productId) {
      continue;
    }

    const variantId =
      typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null;
    const quantity = Math.max(1, Math.floor(item.quantity));
    const key = `${productId}::${variantId ?? ""}`;
    const existing = quantities.get(key);

    quantities.set(key, {
      id: productId,
      quantity: (existing?.quantity ?? 0) + quantity,
      variantId
    });
  }

  return [...quantities.values()];
}

export async function validateCheckoutInventory({
  admin,
  excludedReservationSessionId = null,
  storeId,
  requestedItems
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  excludedReservationSessionId?: string | null;
  storeId: string;
  requestedItems: CheckoutCartItem[];
}) {
  const items = aggregateCheckoutCartItems(requestedItems);

  if (!items.length) {
    return { ok: true as const };
  }

  const productIds = [...new Set(items.map((item) => item.id))];
  const variantIds = [
    ...new Set(
      items
        .map((item) => item.variantId)
        .filter((variantId): variantId is string => Boolean(variantId))
    )
  ];
  const { data, error } = await admin
    .from("store_products" as never)
    .select("id, store_id, workspace_id, status, track_inventory, stock_quantity, inventory_status")
    .eq("store_id", storeId)
    .in("id", productIds);

  if (error) {
    console.error("[store-inventory] checkout validation query failed", {
      code: error.code,
      message: error.message,
      productIds,
      storeId
    });
    return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
  }

  const productsById = new Map(
    ((data ?? []) as InventoryProductRow[]).map((product) => [product.id, product])
  );
  const { data: productVariants, error: productVariantsError } = await admin
    .from("product_variants" as never)
    .select("id, product_id, store_id, status, stock_quantity")
    .eq("store_id", storeId)
    .in("product_id", productIds);

  if (productVariantsError) {
    console.error("[store-inventory] checkout product variants lookup failed", {
      code: productVariantsError.code,
      message: productVariantsError.message,
      productIds,
      storeId
    });
    return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
  }

  const activeVariantCountByProduct = new Map<string, number>();
  for (const variant of (productVariants ?? []) as InventoryVariantRow[]) {
    if (variant.status !== "active") {
      continue;
    }

    activeVariantCountByProduct.set(
      variant.product_id,
      (activeVariantCountByProduct.get(variant.product_id) ?? 0) + 1
    );
  }

  const { data: selectedVariants, error: variantsError } = variantIds.length
    ? await admin
        .from("product_variants" as never)
        .select("id, product_id, store_id, status, stock_quantity")
        .eq("store_id", storeId)
        .in("id", variantIds as never)
    : { data: [], error: null };

  if (variantsError) {
    console.error("[store-inventory] checkout variant validation query failed", {
      code: variantsError.code,
      message: variantsError.message,
      storeId,
      variantIds
    });
    return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
  }

  const variantsById = new Map(
    ((selectedVariants ?? []) as InventoryVariantRow[]).map((variant) => [variant.id, variant])
  );
  const { data: activeReservations, error: reservationsError } = await admin
    .from("inventory_reservations" as never)
    .select("product_id, variant_id, session_id, quantity")
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "active" as never)
    .gt("expires_at" as never, new Date().toISOString() as never)
    .in("product_id" as never, productIds as never);

  if (reservationsError) {
    console.error("[store-inventory] checkout reservations lookup failed", {
      code: reservationsError.code,
      message: reservationsError.message,
      productIds,
      storeId
    });
    return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
  }

  const reservedByStockKey = new Map<string, number>();
  for (const reservation of (activeReservations ?? []) as Array<{
    product_id: string | null;
    quantity: number | string | null;
    session_id: string | null;
    variant_id: string | null;
  }>) {
    if (!reservation.product_id || reservation.session_id === excludedReservationSessionId) {
      continue;
    }

    const key = `${reservation.product_id}::${reservation.variant_id ?? ""}`;
    reservedByStockKey.set(
      key,
      (reservedByStockKey.get(key) ?? 0) + parseStockQuantity(reservation.quantity)
    );
  }

  const reservedQuantity = (productId: string, variantId?: string | null) =>
    reservedByStockKey.get(`${productId}::${variantId ?? ""}`) ?? 0;

  for (const item of items) {
    const product = productsById.get(item.id);

    if (!product || product.store_id !== storeId) {
      return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
    }

    const requestedQuantity = Math.max(1, Math.floor(item.quantity));
    const requiresVariantSelection = (activeVariantCountByProduct.get(item.id) ?? 0) > 0;

    if (item.variantId) {
      const variant = variantsById.get(item.variantId);
      const availableStock =
        parseStockQuantity(variant?.stock_quantity) - reservedQuantity(item.id, item.variantId);

      if (
        !variant ||
        variant.store_id !== storeId ||
        variant.product_id !== item.id ||
        variant.status !== "active" ||
        availableStock <= 0 ||
        availableStock < requestedQuantity
      ) {
        return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
      }

      continue;
    }

    if (requiresVariantSelection) {
      return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
    }

    if (!tracksInventory(product.track_inventory)) {
      continue;
    }

    const availableStock = parseStockQuantity(product.stock_quantity) - reservedQuantity(item.id, null);

    if (
      product.inventory_status === "out_of_stock" ||
      availableStock <= 0 ||
      availableStock < requestedQuantity
    ) {
      return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
    }
  }

  return { ok: true as const };
}
