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

async function getProductApiContext(productId: string, storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const access = await assertStoreAccessInWorkspace({
    permission: "manage_products",
    storeId,
    supabase,
    userId: user.id,
    workspaceId: selection.activeWorkspaceId
  });

  if (!access.allowed) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const { data: product } = await supabase
    .from("store_products")
    .select("id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, selection.activeWorkspaceId as never)
    .maybeSingle();

  if (!product) {
    return { error: NextResponse.json({ error: "Product not found." }, { status: 404 }) };
  }

  return { supabase, workspaceId: selection.activeWorkspaceId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const storeId = cleanText(body?.storeId, 80);
  const context = await getProductApiContext(productId, storeId);

  if ("error" in context) {
    return context.error;
  }

  const title = cleanText(body?.title, 180);

  if (!title) {
    return NextResponse.json({ error: "Product title is required." }, { status: 400 });
  }

  const { error } = await context.supabase
    .from("store_products")
    .update({
      compare_at_price: cleanOptionalMoney(body?.compareAtPrice),
      currency: cleanCurrency(body?.currency),
      description: cleanText(body?.description, 1000) || null,
      name: title,
      price: cleanMoney(body?.price).toFixed(2),
      slug: `${slugify(title)}-${productId.slice(0, 8)}`,
      status: cleanStatus(body?.status),
      title,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    return NextResponse.json({ error: "Product could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const storeId = cleanText(body?.storeId, 80);
  const context = await getProductApiContext(productId, storeId);

  if ("error" in context) {
    return context.error;
  }

  const { error } = await context.supabase
    .from("store_products")
    .update({ status: "archived", updated_at: new Date().toISOString() } as never)
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    return NextResponse.json({ error: "Product could not be archived." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
