import { NextResponse } from "next/server";
import { validateStoreCoupon } from "@/lib/store-coupons";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Coupon validation is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const subtotal = Number(body?.subtotal ?? 0);

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

  const result = await validateStoreCoupon(admin, {
    code,
    storeId: storeRow.id,
    subtotal,
    workspaceId: storeRow.workspace_id
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    code: result.coupon.code,
    discountAmount: result.discountAmount,
    discountType: result.coupon.discount_type,
    discountValue: Number(result.coupon.discount_value),
    ok: true
  });
}
