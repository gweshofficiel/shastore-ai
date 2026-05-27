"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import type { Json } from "@/types/database";

export type PublicStoreOrderState = {
  error: string | null;
  message: string | null;
  ok: boolean;
  orderId: string | null;
};

type CartSubmitItem = {
  id: string;
  quantity: number;
};

const dashboardOrdersPath = "/dashboard/orders";
const storeOrderStatuses = new Set([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "canceled"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parsePrice(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCartItems(value: FormDataEntryValue | null): CartSubmitItem[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is CartSubmitItem => {
        return (
          item &&
          typeof item === "object" &&
          (typeof item.id === "string" || typeof item.productId === "string") &&
          typeof item.quantity === "number"
        );
      })
      .map((item) => {
        const rawItem = item as unknown as { id?: unknown; productId?: unknown; quantity: number };

        return {
          id: typeof rawItem.id === "string" ? rawItem.id : String(rawItem.productId ?? ""),
          quantity: Math.max(1, Math.floor(rawItem.quantity))
        };
      });
  } catch {
    return [];
  }
}

function orderStatusRedirect(status: string, orderId?: string) {
  const params = new URLSearchParams({ orders: status });

  if (orderId) {
    params.set("orderId", orderId);
  }

  redirect(`${dashboardOrdersPath}?${params.toString()}`);
}

export async function createPublicStoreOrderAction(
  _prev: PublicStoreOrderState | null,
  formData: FormData
): Promise<PublicStoreOrderState> {
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const customerName = cleanText(formData.get("customerName"), 160);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const customerEmail = cleanText(formData.get("customerEmail"), 180);
  const customerAddress = cleanText(formData.get("customerAddress"), 500);
  const requestedItems = parseCartItems(formData.get("items"));

  if (!slug) {
    return { error: "Store not found.", message: null, ok: false, orderId: null };
  }

  if (!customerName || !customerPhone) {
    return {
      error: "Customer name and phone are required.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  if (!requestedItems.length) {
    return { error: "Your cart is empty.", message: null, ok: false, orderId: null };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      error: "Order capture is not configured. Add SUPABASE_SERVICE_ROLE_KEY.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const { data: rawStore, error: storeError } = await admin
    .from("stores")
    .select("id, user_id, owner_user_id, workspace_id, slug, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    status: string;
    user_id: string;
    workspace_id: string | null;
  } | null;

  if (storeError || !store) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const productsById = new Map(preview.products.map((product) => [product.id, product]));
  const items = requestedItems
    .map((item) => {
      const product = productsById.get(item.id);

      if (!product) {
        return null;
      }

      const unitPrice = parsePrice(product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        categoryName: product.categoryName,
        id: product.id,
        imageUrl: product.imageUrl,
        price: unitPrice,
        priceLabel: product.priceLabel,
        quantity: item.quantity,
        title: product.title,
        total: lineTotal
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!items.length) {
    return {
      error: "Cart products are no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const total = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const { data: order, error: orderError } = await admin
    .from("store_orders")
    .insert({
      store_id: store.id,
      user_id: store.user_id,
      owner_user_id: store.owner_user_id ?? store.user_id,
      workspace_id: store.workspace_id ?? store.owner_user_id ?? store.user_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      items: items as Json,
      subtotal: total,
      total,
      payment_method: "whatsapp",
      payment_status: "pending",
      order_status: "pending"
    } as never)
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[store-orders] create public order failed", {
      code: orderError?.code,
      message: orderError?.message,
      slug
    });
    return {
      error: "Order could not be submitted. Please try again.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  return {
    error: null,
    message: "Order submitted. The store owner can now see it in their dashboard.",
    ok: true,
    orderId: order.id
  };
}

export async function createPublicStoreOrderDraftAction(
  _prev: PublicStoreOrderState | null,
  formData: FormData
): Promise<PublicStoreOrderState> {
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const customerName = cleanText(formData.get("customerName"), 160);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const customerEmail = cleanText(formData.get("customerEmail"), 180);
  const customerAddress = cleanText(formData.get("customerAddress"), 500);
  const customerNotes = cleanText(formData.get("customerNotes"), 1000);
  const requestedItems = parseCartItems(formData.get("items"));

  if (!slug) {
    return { error: "Store not found.", message: null, ok: false, orderId: null };
  }

  if (!customerName || !customerPhone) {
    return {
      error: "Customer full name and phone are required.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  if (!requestedItems.length) {
    return { error: "Your cart is empty.", message: null, ok: false, orderId: null };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      error: "Order draft storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const { data: rawStore, error: storeError } = await admin
    .from("stores")
    .select("id, user_id, owner_user_id, workspace_id, slug, status, currency")
    .eq("id", preview.store.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    currency: string | null;
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    status: string;
    user_id: string;
    workspace_id: string | null;
  } | null;

  if (storeError || !store) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const productsById = new Map(preview.products.map((product) => [product.id, product]));
  const items = requestedItems
    .map((item) => {
      const product = productsById.get(item.id);

      if (!product || product.status !== "active") {
        return null;
      }

      const unitPrice = parsePrice(product.price);
      const quantity = Math.max(1, item.quantity);
      const subtotal = Number((unitPrice * quantity).toFixed(2));

      return {
        currency: product.currency || store.currency || preview.store.currency || "USD",
        product_id: product.id,
        product_image: product.imageUrl,
        product_title: product.title,
        quantity,
        price: unitPrice,
        subtotal
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!items.length) {
    return {
      error: "Cart products are no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const currency = items[0]?.currency || store.currency || preview.store.currency || "USD";
  const subtotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const { data: order, error: orderError } = await admin
    .from("orders" as never)
    .insert({
      store_id: store.id,
      store_instance_id: store.id,
      user_id: store.user_id,
      owner_user_id: store.owner_user_id ?? store.user_id,
      workspace_id: store.workspace_id ?? store.owner_user_id ?? store.user_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      notes: customerNotes || null,
      subtotal,
      total: subtotal,
      currency,
      order_status: "draft",
      payment_method: "manual",
      payment_status: "pending",
      fulfillment_status: "pending",
      source: "public_storefront"
    } as never)
    .select("id")
    .single();
  const orderRow = order as { id: string } | null;

  if (orderError || !orderRow) {
    console.error("[store-orders] create public draft failed", {
      code: orderError?.code,
      message: orderError?.message,
      slug
    });
    return {
      error: "Order draft could not be prepared. Please try again.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const orderItems = items.map((item) => ({
    order_id: orderRow.id,
    store_id: store.id,
    workspace_id: store.workspace_id ?? store.owner_user_id ?? store.user_id,
    product_id: item.product_id,
    product_title: item.product_title,
    product_image: item.product_image,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.subtotal,
    currency: item.currency
  }));
  const { error: itemsError } = await admin
    .from("order_items" as never)
    .insert(orderItems as never);

  if (itemsError) {
    await admin.from("orders" as never).delete().eq("id" as never, orderRow.id as never);
    console.error("[store-orders] create public draft items failed", {
      code: itemsError.code,
      message: itemsError.message,
      orderId: orderRow.id,
      slug
    });
    return {
      error: "Order draft items could not be saved. Please try again.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  return {
    error: null,
    message: `Order draft prepared. Reference: ${orderRow.id.slice(0, 8).toUpperCase()}.`,
    ok: true,
    orderId: orderRow.id
  };
}

export async function updateStoreOrderStatusAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const status = cleanText(formData.get("status"), 40);

  if (!orderId) {
    orderStatusRedirect("missing-order");
  }

  if (!storeOrderStatuses.has(status)) {
    orderStatusRedirect("invalid-status", orderId);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?next=${encodeURIComponent(dashboardOrdersPath)}`);
  }

  try {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    await requirePermission({
      permission: "manage_orders",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    orderStatusRedirect("not-authorized", orderId);
  }

  const { data, error } = await supabase
    .from("store_orders")
    .update({
      order_status: status,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .eq("workspace_id" as never, (await getUserPrimaryWorkspaceId(supabase, user.id)) as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[store-orders] status update failed", {
      code: error.code,
      message: error.message,
      orderId,
      status
    });
    orderStatusRedirect("status-failed", orderId);
  }

  if (!data) {
    orderStatusRedirect("not-authorized", orderId);
  }

  revalidatePath(dashboardOrdersPath);
  revalidatePath("/dashboard");
  orderStatusRedirect("status-updated", orderId);
}
