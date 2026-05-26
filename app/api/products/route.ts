import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";

function cleanText(value: unknown, maxLength = 1000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function cleanMoney(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

function cleanOptionalMoney(value: unknown) {
  return value === null || value === undefined || value === "" ? null : cleanMoney(value);
}

function cleanCurrency(value: unknown) {
  const currency = cleanText(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function cleanStatus(value: unknown) {
  return value === "active" || value === "archived" ? value : "draft";
}

function cleanUrl(value: unknown) {
  const text = cleanText(value, 700);
  return text.startsWith("http://") || text.startsWith("https://") ? text : null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "product"
  );
}

async function getApiContext(storeId: string, permission: "can_view_stores" | "manage_products") {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const access = await assertStoreAccessInWorkspace({
    permission,
    storeId,
    supabase,
    userId: user.id,
    workspaceId: selection.activeWorkspaceId
  });

  if (!access.allowed) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, user, workspaceId: selection.activeWorkspaceId };
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId") ?? "";
  const context = await getApiContext(storeId, "can_view_stores");

  if ("error" in context) {
    return context.error;
  }

  const { data, error } = await context.supabase
    .from("store_products")
    .select("id, workspace_id, store_id, owner_user_id, title, slug, description, price, compare_at_price, currency, image_url, gallery, status, created_at, updated_at")
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Products could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const storeId = cleanText(body?.storeId, 80);
  const context = await getApiContext(storeId, "manage_products");

  if ("error" in context) {
    return context.error;
  }

  const title = cleanText(body?.title, 180);

  if (!title) {
    return NextResponse.json({ error: "Product title is required." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("store_products")
    .insert({
      compare_at_price: cleanOptionalMoney(body?.compareAtPrice),
      currency: cleanCurrency(body?.currency),
      description: cleanText(body?.description, 1000) || null,
      gallery: Array.isArray(body?.gallery) ? body.gallery : [],
      image_url: cleanUrl(body?.imageUrl),
      name: title,
      owner_user_id: context.user.id,
      price: cleanMoney(body?.price).toFixed(2),
      slug: `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`,
      status: cleanStatus(body?.status),
      store_id: storeId,
      title,
      user_id: context.user.id,
      workspace_id: context.workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Product could not be created." }, { status: 500 });
  }

  return NextResponse.json({ productId: (data as { id: string }).id }, { status: 201 });
}
