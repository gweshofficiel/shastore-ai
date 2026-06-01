import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 40);
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

async function resolveCustomer({
  createIfMissing,
  phone,
  storeId,
  workspaceId
}: {
  createIfMissing: boolean;
  phone: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  const normalizedPhone = normalizePhone(phone);

  if (!admin || !normalizedPhone) {
    return null;
  }

  const { data: existingCustomer } = await admin
    .from("store_customers" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("normalized_phone" as never, normalizedPhone as never)
    .maybeSingle();
  const existing = existingCustomer as { id: string } | null;

  if (existing?.id || !createIfMissing) {
    return existing;
  }

  const { data: insertedCustomer, error } = await admin
    .from("store_customers" as never)
    .insert({
      metadata: {
        source: "storefront_address_book"
      },
      name: "Customer",
      phone: normalizedPhone,
      status: "active",
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    const { data: retryCustomer } = await admin
      .from("store_customers" as never)
      .select("id")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("normalized_phone" as never, normalizedPhone as never)
      .maybeSingle();

    return retryCustomer as { id: string } | null;
  }

  return insertedCustomer as { id: string } | null;
}

function addressPayload(body: Record<string, unknown>) {
  return {
    address_line1: cleanText(body.addressLine1, 240),
    address_line2: cleanText(body.addressLine2, 240) || null,
    city: cleanText(body.city, 120),
    country: cleanText(body.country, 120),
    full_name: cleanText(body.fullName, 160),
    notes: cleanText(body.notes, 500) || null,
    phone: normalizePhone(cleanText(body.phone, 80)),
    postal_code: cleanText(body.postalCode, 40) || null
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = cleanText(url.searchParams.get("storeId"), 80);
  const slug = cleanText(url.searchParams.get("slug"), 120).toLowerCase();
  const phone = cleanText(url.searchParams.get("phone"), 80);

  if (!storeId || !slug || !normalizePhone(phone)) {
    return NextResponse.json({ addresses: [] }, { status: 400 });
  }

  const { admin, store } = await resolvePublishedStore({ slug, storeId });

  if (!admin) {
    return NextResponse.json({ addresses: [] }, { status: 503 });
  }

  if (!store?.workspace_id) {
    return NextResponse.json({ addresses: [] }, { status: 404 });
  }

  const customer = await resolveCustomer({
    createIfMissing: false,
    phone,
    storeId: store.id,
    workspaceId: store.workspace_id
  });

  if (!customer?.id) {
    return NextResponse.json({ addresses: [] });
  }

  const { data } = await admin
    .from("customer_addresses" as never)
    .select("id, full_name, phone, country, city, address_line1, address_line2, postal_code, notes, is_default, created_at, updated_at")
    .eq("workspace_id" as never, store.workspace_id as never)
    .eq("store_id" as never, store.id as never)
    .eq("customer_id" as never, customer.id as never)
    .order("is_default" as never, { ascending: false } as never)
    .order("updated_at" as never, { ascending: false } as never);

  return NextResponse.json({ addresses: data ?? [] });
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? rawBody as Record<string, unknown> : {};
  const action = cleanText(body.action, 30);
  const addressId = cleanText(body.addressId, 80);
  const storeId = cleanText(body.storeId, 80);
  const slug = cleanText(body.slug, 120).toLowerCase();
  const customerPhone = cleanText(body.customerPhone, 80);

  if (!storeId || !slug || !normalizePhone(customerPhone)) {
    return NextResponse.json({ error: "Address session is invalid." }, { status: 400 });
  }

  const { admin, store } = await resolvePublishedStore({ slug, storeId });

  if (!admin) {
    return NextResponse.json({ error: "Address book is not configured." }, { status: 503 });
  }

  if (!store?.workspace_id) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  const customer = await resolveCustomer({
    createIfMissing: action === "save",
    phone: customerPhone,
    storeId: store.id,
    workspaceId: store.workspace_id
  });

  if (!customer?.id) {
    return NextResponse.json({ error: "Customer account was not found." }, { status: 404 });
  }

  if (action === "delete") {
    await admin
      .from("customer_addresses" as never)
      .delete()
      .eq("id" as never, addressId as never)
      .eq("workspace_id" as never, store.workspace_id as never)
      .eq("store_id" as never, store.id as never)
      .eq("customer_id" as never, customer.id as never);

    return NextResponse.json({ ok: true });
  }

  if (action === "default") {
    await admin
      .from("customer_addresses" as never)
      .update({ is_default: false, updated_at: new Date().toISOString() } as never)
      .eq("workspace_id" as never, store.workspace_id as never)
      .eq("store_id" as never, store.id as never)
      .eq("customer_id" as never, customer.id as never);
    const { error } = await admin
      .from("customer_addresses" as never)
      .update({ is_default: true, updated_at: new Date().toISOString() } as never)
      .eq("id" as never, addressId as never)
      .eq("workspace_id" as never, store.workspace_id as never)
      .eq("store_id" as never, store.id as never)
      .eq("customer_id" as never, customer.id as never);

    return error
      ? NextResponse.json({ error: "Default address could not be saved." }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  if (action !== "save") {
    return NextResponse.json({ error: "Address action is invalid." }, { status: 400 });
  }

  const payload = addressPayload(body);

  if (!payload.full_name || !payload.phone || !payload.country || !payload.city || !payload.address_line1) {
    return NextResponse.json({ error: "Required address fields are missing." }, { status: 400 });
  }

  const isDefault = body.isDefault === true || body.isDefault === "true";
  const now = new Date().toISOString();

  if (isDefault) {
    await admin
      .from("customer_addresses" as never)
      .update({ is_default: false, updated_at: now } as never)
      .eq("workspace_id" as never, store.workspace_id as never)
      .eq("store_id" as never, store.id as never)
      .eq("customer_id" as never, customer.id as never);
  }

  const updatePayload = {
    ...payload,
    customer_id: customer.id,
    is_default: isDefault,
    metadata: {
      source: "storefront_account"
    },
    store_id: store.id,
    updated_at: now,
    workspace_id: store.workspace_id
  };
  const result = addressId
    ? await admin
        .from("customer_addresses" as never)
        .update(updatePayload as never)
        .eq("id" as never, addressId as never)
        .eq("workspace_id" as never, store.workspace_id as never)
        .eq("store_id" as never, store.id as never)
        .eq("customer_id" as never, customer.id as never)
    : await admin
        .from("customer_addresses" as never)
        .insert({ ...updatePayload, created_at: now } as never);

  if (result.error) {
    return NextResponse.json({ error: "Address could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
