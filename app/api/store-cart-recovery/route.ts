import { NextResponse } from "next/server";
import { sanitizeCartItems } from "@/lib/abandoned-cart-recovery";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 180).toLowerCase();
  return email.includes("@") ? email : null;
}

function isSafeSessionId(value: string) {
  return /^[a-zA-Z0-9_-]{16,160}$/.test(value);
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const storeId = cleanText(body?.storeId, 80);
  const slug = cleanText(body?.slug, 120).toLowerCase();
  const sessionId = cleanText(body?.sessionId, 180);

  if (!storeId || !slug || !isSafeSessionId(sessionId)) {
    return NextResponse.json({ error: "Cart session is invalid." }, { status: 400 });
  }

  const { admin, store } = await resolvePublishedStore({ slug, storeId });

  if (!admin) {
    return NextResponse.json({ error: "Cart recovery is not configured." }, { status: 503 });
  }

  if (!store?.workspace_id) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  const items = sanitizeCartItems(body?.items);

  if (!items.length) {
    await admin
      .from("store_abandoned_carts" as never)
      .update({ recovery_status: "expired", updated_at: new Date().toISOString() } as never)
      .eq("store_id" as never, store.id as never)
      .eq("session_id" as never, sessionId as never)
      .in("recovery_status" as never, ["pending", "email_sent"] as never);

    return NextResponse.json({ ok: true, tracked: false });
  }

  const now = new Date().toISOString();
  const estimatedTotal = Number(
    Math.max(
      0,
      numericValue(body?.estimatedTotal) ||
        items.reduce((sum, item) => sum + numericValue(item.price) * item.quantity, 0)
    ).toFixed(2)
  );
  const { data: existingCart } = await admin
    .from("store_abandoned_carts" as never)
    .select("id, recovery_status")
    .eq("store_id" as never, store.id as never)
    .eq("session_id" as never, sessionId as never)
    .maybeSingle();
  const existing = existingCart as { recovery_status?: unknown } | null;
  const existingStatus =
    typeof existing?.recovery_status === "string" ? existing.recovery_status : null;
  const canResetRecovery = existingStatus === "recovered" || existingStatus === "expired" || !existingStatus;
  const cartPayload: Record<string, unknown> = {
    currency: cleanText(body?.currency, 12).toUpperCase() || "USD",
    customer_email: cleanEmail(body?.customerEmail),
    customer_phone: cleanText(body?.customerPhone, 80) || null,
    estimated_total: estimatedTotal,
    items,
    items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    last_activity_at: now,
    metadata: {
      source: "public_storefront_cart",
      updated_from: "cart_snapshot"
    },
    session_id: sessionId,
    store_id: store.id,
    workspace_id: store.workspace_id
  };

  if (canResetRecovery) {
    Object.assign(cartPayload, {
      abandoned_at: null,
      recovered_at: null,
      recovered_order_id: null,
      recovery_email_sent_at: null,
      recovery_status: "pending"
    });
  } else if (existingStatus) {
    cartPayload.recovery_status = existingStatus;
  }

  const { error } = await admin
    .from("store_abandoned_carts" as never)
    .upsert(cartPayload as never, { onConflict: "store_id,session_id" } as never);

  if (error) {
    return NextResponse.json({ error: "Cart recovery snapshot could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tracked: true });
}
