import { NextResponse, type NextRequest } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";

type ProductDatabaseError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

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

function isValidMoneyInput(value: unknown, optional = false) {
  if ((value === null || value === undefined || value === "") && optional) {
    return true;
  }

  if (value === null || value === undefined || value === "") {
    return true;
  }

  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0;
}

function isValidIntegerInput(value: unknown, optional = false) {
  if ((value === null || value === undefined || value === "") && optional) {
    return true;
  }

  if (value === null || value === undefined || value === "") {
    return true;
  }

  const text = String(value).trim();
  const parsed = Number.parseInt(text, 10);
  return String(parsed) === text && parsed >= 0;
}

function validateProductBody(body: Record<string, unknown> | null) {
  if (!body) {
    return { message: "Product payload is required.", status: 400 };
  }

  const title = cleanText(body.title, 180);
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const currency = cleanText(body.currency, 8).toUpperCase();

  if (!title) {
    return { message: "Product title is required.", status: 400 };
  }

  if (status && status !== "draft" && status !== "active" && status !== "archived") {
    return { message: "Invalid status. Choose draft, active, or archived.", status: 400 };
  }

  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { message: "Invalid currency. Use a 3-letter code like USD.", status: 400 };
  }

  if (!isValidMoneyInput(body.price)) {
    return { message: "Product price must be a valid non-negative number.", status: 400 };
  }

  if (!isValidMoneyInput(body.compareAtPrice, true)) {
    return { message: "Compare at price must be a valid non-negative number.", status: 400 };
  }

  if (!isValidIntegerInput(body.stockQuantity, true)) {
    return { message: "Inventory value invalid. Stock quantity must be a non-negative whole number.", status: 400 };
  }

  if (!isValidIntegerInput(body.lowStockThreshold, true)) {
    return { message: "Inventory value invalid. Low stock threshold must be a non-negative whole number.", status: 400 };
  }

  return null;
}

function safeProductDatabaseErrorMessage(error?: ProductDatabaseError | null) {
  switch (error?.code) {
    case "23503":
      return "Related category, store, or workspace record was not found.";
    case "23505":
      return "Duplicate product conflict.";
    case "23502":
      return "Required database field is missing.";
    case "42501":
      return "Permission denied by RLS.";
    case "22P02":
      return "Invalid ID format.";
    case "PGRST116":
      return "Store or category not found.";
    default:
      return "Unexpected database error. Check monitoring details.";
  }
}

function productDatabaseErrorMetadata(error?: ProductDatabaseError | null) {
  return {
    code: error?.code ?? "unknown",
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    message: error?.message ?? null,
    safeMessage: safeProductDatabaseErrorMessage(error)
  };
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
    return { error: NextResponse.json({ error: "Workspace access denied." }, { status: 403 }) };
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

  if (!storeId) {
    return NextResponse.json({ error: "Store not found." }, { status: 400 });
  }

  const context = await getApiContext(storeId, "manage_products");

  if ("error" in context) {
    return context.error;
  }

  const validationError = validateProductBody(body);

  if (validationError) {
    await recordMonitoringEventSafe({
      entityType: "product",
      eventStatus: "failed",
      eventType: "product_create_failed",
      metadata: {
        message: validationError.message,
        reason: "API validation failed"
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return NextResponse.json({ error: validationError.message }, { status: validationError.status });
  }

  const title = cleanText(body?.title, 180);
  const categoryId = cleanText(body?.categoryId, 80);

  if (categoryId) {
    const { data: category, error: categoryError } = await context.supabase
      .from("store_categories" as never)
      .select("id")
      .eq("id", categoryId)
      .eq("store_id", storeId)
      .eq("workspace_id" as never, context.workspaceId as never)
      .maybeSingle();

    if (categoryError) {
      const safeMessage = safeProductDatabaseErrorMessage(categoryError);
      console.error("[products-api] category lookup failed during product create", {
        categoryId,
        code: categoryError.code,
        details: categoryError.details,
        hint: categoryError.hint,
        message: categoryError.message,
        storeId,
        workspaceId: context.workspaceId
      });
      await recordMonitoringEventSafe({
        entityType: "product",
        eventStatus: "failed",
        eventType: "product_create_failed",
        metadata: {
          ...productDatabaseErrorMetadata(categoryError),
          reason: "API category lookup failed"
        },
        storeId,
        supabase: context.supabase,
        userId: context.user.id,
        workspaceId: context.workspaceId
      });
      return NextResponse.json(
        { error: safeMessage },
        { status: 500 }
      );
    }

    if (!category) {
      await recordMonitoringEventSafe({
        entityType: "product",
        eventStatus: "failed",
        eventType: "product_create_failed",
        metadata: {
          message: "Category not found.",
          reason: "API category validation failed"
        },
        storeId,
        supabase: context.supabase,
        userId: context.user.id,
        workspaceId: context.workspaceId
      });
      return NextResponse.json({ error: "Category not found." }, { status: 400 });
    }
  }

  const { data, error } = await context.supabase
    .from("store_products")
    .insert({
      compare_at_price: cleanOptionalMoney(body?.compareAtPrice),
      currency: cleanCurrency(body?.currency),
      category_id: categoryId || null,
      description: cleanText(body?.description, 1000) || null,
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
    const productInsertError = error ?? {
      code: "no_data",
      details: null,
      hint: null,
      message: "Product insert did not return a created product."
    };
    const safeMessage = safeProductDatabaseErrorMessage(productInsertError);
    console.error("[products-api] create product failed", {
      code: productInsertError.code,
      details: productInsertError.details,
      hint: productInsertError.hint,
      message: productInsertError.message,
      storeId,
      workspaceId: context.workspaceId
    });
    await recordMonitoringEventSafe({
      entityType: "product",
      eventStatus: "failed",
      eventType: "product_create_failed",
      metadata: {
        ...productDatabaseErrorMetadata(productInsertError),
        reason: safeMessage
      },
      storeId,
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId
    });
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ productId: (data as { id: string }).id }, { status: 201 });
}
