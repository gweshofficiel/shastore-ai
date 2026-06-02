import { NextResponse } from "next/server";
import {
  findActiveDiscountCampaignForCart,
  type DiscountCampaignCartItem
} from "@/lib/discount-campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function cartItemsPayload(value: unknown): DiscountCampaignCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: DiscountCampaignCartItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const productId = typeof record.productId === "string" ? record.productId : "";
    const categoryId = typeof record.categoryId === "string" ? record.categoryId : null;
    const quantity = typeof record.quantity === "number" ? Math.max(1, Math.floor(record.quantity)) : 1;
    const subtotal = money(record.subtotal);

    if (productId && subtotal > 0) {
      items.push({ categoryId, productId, quantity, subtotal });
    }
  }

  return items;
}

export async function POST(request: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Discount campaigns are not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail : "";
  const shippingAmount = money(body?.shippingAmount);
  const items = cartItemsPayload(body?.items);

  if (!storeId || !slug || !items.length) {
    return NextResponse.json({ campaign: null, ok: true });
  }

  const { data: store } = await admin
    .from("stores")
    .select("id, workspace_id, slug, status")
    .eq("id", storeId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  const storeRow = store as { id: string; workspace_id?: string | null } | null;

  if (!storeRow) {
    return NextResponse.json({ error: "Store not found or unpublished." }, { status: 404 });
  }

  const applied = await findActiveDiscountCampaignForCart(admin, {
    customerEmail,
    items,
    shippingAmount,
    storeId: storeRow.id,
    workspaceId: storeRow.workspace_id
  });

  if (!applied) {
    return NextResponse.json({ campaign: null, ok: true });
  }

  return NextResponse.json({
    campaign: {
      discountAmount: applied.discountAmount,
      discountLabel: applied.discountLabel,
      freeShipping: applied.freeShipping,
      id: applied.campaign.id,
      name: applied.campaign.name
    },
    ok: true
  });
}
