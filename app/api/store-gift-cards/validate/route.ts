import { NextResponse } from "next/server";
import { validateStoreGiftCard } from "@/lib/store-gift-cards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Gift cards are not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const currency = typeof body?.currency === "string" ? body.currency : "";
  const orderTotal = Number(body?.orderTotal ?? 0);
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";

  if (!storeId || !slug) {
    return NextResponse.json({ error: "Store not found." }, { status: 400 });
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

  const result = await validateStoreGiftCard(admin, {
    code,
    currency,
    orderTotal,
    storeId: storeRow.id,
    workspaceId: storeRow.workspace_id
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    appliedAmount: result.appliedAmount,
    currency: result.giftCard.currency,
    maskedCode: result.maskedCode,
    ok: true
  });
}
