import { NextResponse } from "next/server";
import { reserveCheckoutInventory } from "@/lib/inventory-reservations";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVENTORY_CHECKOUT_ERROR, validateCheckoutInventory, type CheckoutCartItem } from "@/lib/store-inventory";

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cartItemsPayload(value: unknown): CheckoutCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: CheckoutCartItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const productId = cleanText(record.productId ?? record.id, 80);
    const quantity = Math.max(1, Math.floor(Number(record.quantity ?? 1)));
    const variantId = cleanText(record.variantId, 80) || null;

    if (productId) {
      items.push({ id: productId, quantity, variantId });
    }
  }

  return items;
}

export async function POST(request: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Inventory reservations are not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid reservation request." }, { status: 400 });
  }

  const slug = cleanText(body.slug, 160);
  const storeId = cleanText(body.storeId, 80);
  const sessionId = cleanText(body.sessionId, 160);
  const requestedItems = cartItemsPayload(body.items);

  if (!slug || !storeId || !sessionId || !requestedItems.length) {
    return NextResponse.json({ error: "Missing reservation details." }, { status: 400 });
  }

  const { data: store } = await admin
    .from("stores")
    .select("id, workspace_id, slug, status")
    .eq("id", storeId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  const storeRow = store as { id: string; workspace_id: string | null } | null;

  if (!storeRow) {
    return NextResponse.json({ error: "Store not found or unpublished." }, { status: 404 });
  }

  const inventoryCheck = await validateCheckoutInventory({
    admin,
    excludedReservationSessionId: sessionId,
    requestedItems,
    storeId: storeRow.id
  });

  if (!inventoryCheck.ok) {
    return NextResponse.json({ error: inventoryCheck.error }, { status: 409 });
  }

  const reservation = await reserveCheckoutInventory({
    admin,
    requestedItems,
    sessionId,
    storeId: storeRow.id,
    workspaceId: storeRow.workspace_id
  });

  if (!reservation.ok) {
    return NextResponse.json({ error: INVENTORY_CHECKOUT_ERROR }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
