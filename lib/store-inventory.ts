import type { createAdminClient } from "@/lib/supabase/admin";

export const INVENTORY_CHECKOUT_ERROR =
  "This product is out of stock or quantity is not available.";

export type CheckoutCartItem = {
  id: string;
  quantity: number;
};

type InventoryProductRow = {
  id: string;
  inventory_status: string | null;
  status: string | null;
  stock_quantity: unknown;
  store_id: string;
  track_inventory: boolean | null;
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

export function aggregateCheckoutCartItems(items: CheckoutCartItem[]) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    if (!item.id) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(item.quantity));
    quantities.set(item.id, (quantities.get(item.id) ?? 0) + quantity);
  }

  return [...quantities.entries()].map(([id, quantity]) => ({ id, quantity }));
}

export async function validateCheckoutInventory({
  admin,
  storeId,
  requestedItems
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  storeId: string;
  requestedItems: CheckoutCartItem[];
}) {
  const items = aggregateCheckoutCartItems(requestedItems);

  if (!items.length) {
    return { ok: true as const };
  }

  const productIds = items.map((item) => item.id);
  const { data, error } = await admin
    .from("store_products" as never)
    .select("id, store_id, status, track_inventory, stock_quantity, inventory_status")
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

  for (const item of items) {
    const product = productsById.get(item.id);

    if (!product || product.store_id !== storeId) {
      return { ok: false as const, error: INVENTORY_CHECKOUT_ERROR };
    }

    if (product.track_inventory !== true) {
      continue;
    }

    const availableStock = parseStockQuantity(product.stock_quantity);
    const requestedQuantity = Math.max(1, Math.floor(item.quantity));

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
