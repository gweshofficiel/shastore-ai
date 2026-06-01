import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function numericStock(value: unknown) {
  const stock = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

async function productIsSoldOut({
  admin,
  productId,
  storeId
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  productId: string;
  storeId: string;
}) {
  const { data: product } = await admin
    .from("store_products" as never)
    .select("id, inventory_status, stock_quantity, track_inventory, status")
    .eq("id" as never, productId as never)
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  const productRow = product as {
    inventory_status?: string | null;
    stock_quantity?: number | string | null;
    track_inventory?: boolean | null;
  } | null;

  if (!productRow) {
    return { found: false, soldOut: false };
  }

  if (productRow.inventory_status === "out_of_stock") {
    return { found: true, soldOut: true };
  }

  const { data: variants } = await admin
    .from("product_variants" as never)
    .select("stock_quantity, status")
    .eq("store_id" as never, storeId as never)
    .eq("product_id" as never, productId as never)
    .eq("status" as never, "active" as never);
  const variantRows = (variants ?? []) as unknown as Array<{
    stock_quantity?: number | string | null;
  }>;

  if (variantRows.length) {
    return {
      found: true,
      soldOut: variantRows.every((variant) => numericStock(variant.stock_quantity) <= 0)
    };
  }

  return {
    found: true,
    soldOut: productRow.track_inventory === true && numericStock(productRow.stock_quantity) <= 0
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = cleanEmail(body?.email);
  const productId = cleanText(body?.productId, 80);
  const slug = cleanText(body?.slug, 120).toLowerCase();
  const storeId = cleanText(body?.storeId, 80);

  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!productId || !storeId || !slug) {
    return NextResponse.json({ error: "Product or store is missing." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ error: "Back-in-stock signup is not configured." }, { status: 503 });
  }

  const { data: store } = await admin
    .from("stores" as never)
    .select("id, workspace_id, slug, status")
    .eq("id" as never, storeId as never)
    .eq("slug" as never, slug as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();
  const storeRow = store as { id: string; workspace_id?: string | null } | null;

  if (!storeRow) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  const stockState = await productIsSoldOut({ admin, productId, storeId: storeRow.id });

  if (!stockState.found) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  if (!stockState.soldOut) {
    return NextResponse.json({ error: "This product is currently available." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("store_back_in_stock_requests" as never).upsert(
    {
      cancelled_at: null,
      customer_email: email,
      notification_status: "pending",
      notified_at: null,
      product_id: productId,
      store_id: storeRow.id,
      updated_at: now,
      workspace_id: storeRow.workspace_id ?? null
    } as never,
    { onConflict: "store_id,product_id,customer_email" } as never
  );

  if (error) {
    return NextResponse.json({ error: "Request could not be saved." }, { status: 500 });
  }

  return NextResponse.json({
    message: "You're on the notification list.",
    ok: true
  });
}
