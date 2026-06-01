import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isSafeSessionId(value: string) {
  return /^[a-zA-Z0-9_-]{16,120}$/.test(value);
}

function uniqueProductIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 80))
        .filter(Boolean)
    )
  ).slice(0, 200);
}

async function resolvePublishedStore({
  slug,
  storeId
}: {
  slug: string;
  storeId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return { admin: null, store: null };
  }

  const { data } = await admin
    .from("stores")
    .select("id, workspace_id, slug, status")
    .eq("id", storeId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return {
    admin,
    store: data as { id: string; workspace_id?: string | null } | null
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = cleanText(url.searchParams.get("storeId"), 80);
  const slug = cleanText(url.searchParams.get("slug"), 120).toLowerCase();
  const sessionId = cleanText(url.searchParams.get("sessionId"), 140);

  if (!storeId || !slug || !isSafeSessionId(sessionId)) {
    return NextResponse.json({ productIds: [] }, { status: 400 });
  }

  const { admin, store } = await resolvePublishedStore({ slug, storeId });

  if (!admin) {
    return NextResponse.json({ productIds: [] }, { status: 503 });
  }

  if (!store) {
    return NextResponse.json({ productIds: [] }, { status: 404 });
  }

  const { data } = await admin
    .from("store_wishlist_items" as never)
    .select("product_id")
    .eq("store_id" as never, store.id as never)
    .eq("session_id" as never, sessionId as never)
    .order("created_at" as never, { ascending: false } as never);

  return NextResponse.json({
    productIds: ((data ?? []) as unknown as Array<{ product_id: string }>).map((item) => item.product_id)
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const storeId = cleanText(body?.storeId, 80);
  const slug = cleanText(body?.slug, 120).toLowerCase();
  const sessionId = cleanText(body?.sessionId, 140);
  const requestedProductIds = uniqueProductIds(body?.productIds);

  if (!storeId || !slug || !isSafeSessionId(sessionId)) {
    return NextResponse.json({ error: "Wishlist session is invalid." }, { status: 400 });
  }

  const { admin, store } = await resolvePublishedStore({ slug, storeId });

  if (!admin) {
    return NextResponse.json({ error: "Wishlist persistence is not configured." }, { status: 503 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  const { data: products } = requestedProductIds.length
    ? await admin
        .from("store_products" as never)
        .select("id")
        .eq("store_id" as never, store.id as never)
        .eq("status" as never, "active" as never)
        .in("id" as never, requestedProductIds as never)
    : { data: [] };
  const productIds = ((products ?? []) as unknown as Array<{ id: string }>).map((product) => product.id);

  await admin
    .from("store_wishlist_items" as never)
    .delete()
    .eq("store_id" as never, store.id as never)
    .eq("session_id" as never, sessionId as never);

  if (productIds.length) {
    const now = new Date().toISOString();
    const { error } = await admin.from("store_wishlist_items" as never).insert(
      productIds.map((productId) => ({
        created_at: now,
        product_id: productId,
        session_id: sessionId,
        store_id: store.id,
        updated_at: now,
        workspace_id: store.workspace_id ?? null
      })) as never
    );

    if (error) {
      return NextResponse.json({ error: "Wishlist could not be saved." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, productIds });
}
