import type { createAdminClient } from "@/lib/supabase/admin";
import type { CheckoutCartItem } from "@/lib/store-inventory";

export const INVENTORY_RESERVATION_TTL_MINUTES = 30;

export type InventoryReservationOrderLink = {
  orderId: string;
  orderSource: "orders" | "store_orders";
};

export function normalizeCartSessionId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

function reservationItemsPayload(items: CheckoutCartItem[]) {
  return items
    .map((item) => ({
      id: item.id,
      product_id: item.id,
      quantity: Math.max(1, Math.floor(item.quantity)),
      variant_id:
        typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null
    }))
    .filter((item) => item.product_id);
}

export async function reserveCheckoutInventory({
  admin,
  customerId = null,
  orderLink = null,
  requestedItems,
  sessionId,
  storeId,
  workspaceId
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  customerId?: string | null;
  orderLink?: InventoryReservationOrderLink | null;
  requestedItems: CheckoutCartItem[];
  sessionId: string;
  storeId: string;
  workspaceId: string | null;
}) {
  const normalizedSessionId = normalizeCartSessionId(sessionId);
  const items = reservationItemsPayload(requestedItems);

  if (!normalizedSessionId || !items.length) {
    return { ok: true as const };
  }

  const { data, error } = await admin.rpc("reserve_inventory_items" as never, {
    candidate_customer_id: customerId,
    candidate_expires_in_minutes: INVENTORY_RESERVATION_TTL_MINUTES,
    candidate_items: items,
    candidate_order_id: orderLink?.orderId ?? null,
    candidate_order_source: orderLink?.orderSource ?? null,
    candidate_session_id: normalizedSessionId,
    candidate_store_id: storeId,
    candidate_workspace_id: workspaceId
  } as never);

  if (error) {
    console.error("[inventory-reservations] reserve checkout inventory failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return { ok: false as const };
  }

  return data === true ? { ok: true as const } : { ok: false as const };
}
