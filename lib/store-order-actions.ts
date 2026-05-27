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

type DeliveryMethod = "delivery" | "pickup" | "none";

const dashboardOrdersPath = "/dashboard/orders";
const storeOrderStatuses = new Set([
  "draft",
  "pending",
  "confirmed",
  "cancelled"
]);
type StoreOrderStatusSource = "orders" | "store_orders";

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

function parseDeliveryMethod(value: FormDataEntryValue | null): DeliveryMethod {
  return value === "delivery" || value === "pickup" ? value : "none";
}

function resolveDeliverySelection({
  requestedMethod,
  storeDeliveryEnabled,
  storeDeliveryFee,
  storePickupEnabled
}: {
  requestedMethod: DeliveryMethod;
  storeDeliveryEnabled: boolean;
  storeDeliveryFee: number | null;
  storePickupEnabled: boolean;
}) {
  if (requestedMethod === "delivery") {
    if (!storeDeliveryEnabled) {
      return { error: "Delivery is not available for this store right now." as const };
    }

    return {
      deliveryFee: Number((storeDeliveryFee ?? 0).toFixed(2)),
      deliveryMethod: "delivery" as const,
      error: null
    };
  }

  if (requestedMethod === "pickup") {
    if (!storePickupEnabled) {
      return { error: "Pickup is not available for this store right now." as const };
    }

    return { deliveryFee: 0, deliveryMethod: "pickup" as const, error: null };
  }

  if (storeDeliveryEnabled || storePickupEnabled) {
    return { error: "Choose a delivery method before preparing your order." as const };
  }

  return { deliveryFee: 0, deliveryMethod: "none" as const, error: null };
}

function safeOrderReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return dashboardOrdersPath;
  }

  const trimmed = value.trim();
  return trimmed.startsWith("/dashboard/orders") ? trimmed : dashboardOrdersPath;
}

function orderStatusReturnRedirect(returnTo: string, status: string, orderId?: string): never {
  const params = new URLSearchParams({ orders: status });

  if (orderId) {
    params.set("orderId", orderId);
  }

  redirect(`${returnTo}?${params.toString()}`);
}

function generateDraftOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DR-${stamp}-${suffix}`;
}

function isActivePublicProduct(status: string | null) {
  return !status || status === "active";
}

function logOrderDraftFailure(
  stage: string,
  context: Record<string, unknown>,
  error: { code?: string; details?: string; hint?: string; message?: string } | null
) {
  console.error("[store-orders] order draft persistence failed", {
    stage,
    ...context,
    supabase: error
      ? {
          code: error.code,
          details: error.details,
          hint: error.hint,
          message: error.message
        }
      : null
  });
}

async function resolveStoreInstanceId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  store: { id: string; slug: string | null }
) {
  const { data: instanceById, error: instanceByIdError } = await admin
    .from("store_instances" as never)
    .select("id")
    .eq("id", store.id)
    .maybeSingle();
  const instanceByIdRow = instanceById as { id: string } | null;

  if (!instanceByIdError && instanceByIdRow?.id) {
    return instanceByIdRow.id;
  }

  if (store.slug) {
    const { data: instanceBySlug, error: instanceBySlugError } = await admin
      .from("store_instances" as never)
      .select("id")
      .eq("internal_slug", store.slug)
      .maybeSingle();
    const instanceBySlugRow = instanceBySlug as { id: string } | null;

    if (!instanceBySlugError && instanceBySlugRow?.id) {
      return instanceBySlugRow.id;
    }
  }

  return store.id;
}

type DraftLineItem = {
  currency: string;
  product_id: string;
  product_image: string | null;
  product_title: string;
  quantity: number;
  price: number;
  subtotal: number;
};

async function persistStorefrontOrderDraft({
  admin,
  store,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  customerNotes,
  items,
  currency,
  deliveryFee,
  deliveryMethod,
  subtotal,
  slug
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  store: {
    currency: string | null;
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    user_id: string;
    workspace_id: string | null;
  };
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerNotes: string;
  items: DraftLineItem[];
  currency: string;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  slug: string;
}) {
  const workspaceId = store.workspace_id;
  const storeInstanceId = await resolveStoreInstanceId(admin, store);
  const combinedNotes = [customerAddress, customerNotes].filter(Boolean).join("\n\n") || null;
  const orderNumber = generateDraftOrderNumber();
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const legacyOrderPayload: Record<string, unknown> = {
    store_instance_id: storeInstanceId,
    order_number: orderNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || null,
    notes: combinedNotes,
    delivery_fee: deliveryFee,
    delivery_method: deliveryMethod,
    subtotal,
    total,
    currency,
    order_status: "draft",
    payment_status: "pending",
    fulfillment_status: "pending"
  };

  const extendedOrderPayload: Record<string, unknown> = {
    ...legacyOrderPayload,
    store_id: store.id,
    user_id: store.user_id,
    owner_user_id: store.owner_user_id ?? store.user_id,
    workspace_id: workspaceId,
    customer_address: customerAddress || null,
    payment_method: "manual",
    source: "public_storefront"
  };

  let orderRow: { id: string } | null = null;
  let lastOrderError: { code?: string; details?: string; hint?: string; message?: string } | null =
    null;

  const orderPayloadCandidates = [
    legacyOrderPayload,
    extendedOrderPayload,
    Object.fromEntries(
      Object.entries(legacyOrderPayload).filter(([key]) => key !== "delivery_fee" && key !== "delivery_method")
    ),
    Object.fromEntries(
      Object.entries(extendedOrderPayload).filter(([key]) => key !== "delivery_fee" && key !== "delivery_method")
    ),
    { ...legacyOrderPayload, order_status: "pending" },
    { ...extendedOrderPayload, order_status: "pending" }
  ];

  for (const orderPayload of orderPayloadCandidates) {
    const { data: order, error: orderError } = await admin
      .from("orders" as never)
      .insert(orderPayload as never)
      .select("id")
      .single();

    if (!orderError && order) {
      orderRow = order as { id: string };
      break;
    }

    lastOrderError = orderError;
    const message = (orderError?.message ?? "").toLowerCase();
    const missingColumn =
      orderError?.code === "PGRST204" ||
      message.includes("column") ||
      message.includes("schema cache");
    const invalidStatus =
      message.includes("order_status") || message.includes("check constraint");

    if (!missingColumn && !invalidStatus) {
      break;
    }
  }

  if (orderRow) {
    const legacyItemRows = items.map((item) => ({
      order_id: orderRow.id,
      store_instance_id: storeInstanceId,
      product_title: item.product_title,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.subtotal
    }));

    const extendedItemRows = items.map((item) => ({
      order_id: orderRow.id,
      store_id: store.id,
      workspace_id: workspaceId,
      product_id: item.product_id,
      product_title: item.product_title,
      product_image: item.product_image,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      currency: item.currency,
      unit_price: item.price,
      total_price: item.subtotal,
      store_instance_id: storeInstanceId
    }));

    let itemsInserted = false;

    for (const orderItems of [legacyItemRows, extendedItemRows]) {
      const { error: itemsError } = await admin
        .from("order_items" as never)
        .insert(orderItems as never);

      if (!itemsError) {
        itemsInserted = true;
        break;
      }

      lastOrderError = itemsError;
      const message = (itemsError.message ?? "").toLowerCase();
      const missingColumn =
        itemsError.code === "PGRST204" ||
        message.includes("column") ||
        message.includes("schema cache");

      if (!missingColumn) {
        break;
      }
    }

    if (itemsInserted) {
      return { orderId: orderRow.id, table: "orders" as const };
    }

    await admin.from("orders" as never).delete().eq("id" as never, orderRow.id as never);
    logOrderDraftFailure(
      "order_items_insert",
      { extendedItemRows, legacyItemRows, orderId: orderRow.id, slug, storeId: store.id },
      lastOrderError
    );
  } else {
    logOrderDraftFailure(
      "orders_insert",
      { extendedOrderPayload, legacyOrderPayload, slug, storeId: store.id },
      lastOrderError
    );
  }

  const legacyItems = items.map((item) => ({
    categoryName: null,
    id: item.product_id,
    imageUrl: item.product_image,
    price: item.price,
    priceLabel: null,
    quantity: item.quantity,
    title: item.product_title,
    total: item.subtotal
  }));

  const storeOrderPayload: Record<string, unknown> = {
    store_id: store.id,
    user_id: store.user_id,
    owner_user_id: store.owner_user_id ?? store.user_id,
    workspace_id: workspaceId ?? store.owner_user_id ?? store.user_id,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || null,
    customer_address: customerAddress || null,
    delivery_fee: deliveryFee,
    delivery_method: deliveryMethod,
    items: legacyItems as Json,
    subtotal,
    total,
    payment_method: "manual",
    payment_status: "pending",
    order_status: "draft"
  };
  let storeOrderRow: { id: string } | null = null;
  let storeOrderError: { code?: string; details?: string; hint?: string; message?: string } | null =
    null;

  for (const payload of [
    storeOrderPayload,
    Object.fromEntries(
      Object.entries(storeOrderPayload).filter(([key]) => key !== "delivery_fee" && key !== "delivery_method")
    )
  ]) {
    const { data: storeOrder, error } = await admin
      .from("store_orders")
      .insert(payload as never)
      .select("id")
      .single();

    if (!error && storeOrder) {
      storeOrderRow = storeOrder as { id: string };
      break;
    }

    storeOrderError = error;
  }

  if (!storeOrderRow) {
    logOrderDraftFailure(
      "store_orders_fallback_insert",
      { legacyItems, slug, storeId: store.id, storeOrderPayload, subtotal },
      storeOrderError
    );
    return null;
  }

  return { orderId: storeOrderRow.id, table: "store_orders" as const };
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
  const requestedDeliveryMethod = parseDeliveryMethod(formData.get("deliveryMethod"));
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

      if (!product || !isActivePublicProduct(product.status)) {
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
  const deliverySelection = resolveDeliverySelection({
    requestedMethod: requestedDeliveryMethod,
    storeDeliveryEnabled: preview.store.deliveryEnabled,
    storeDeliveryFee: preview.store.deliveryFee,
    storePickupEnabled: preview.store.pickupEnabled
  });

  if (deliverySelection.error) {
    return {
      error: deliverySelection.error,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const persisted = await persistStorefrontOrderDraft({
    admin,
    store,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerNotes,
    items,
    currency,
    deliveryFee: deliverySelection.deliveryFee,
    deliveryMethod: deliverySelection.deliveryMethod,
    subtotal,
    slug
  });

  if (!persisted) {
    return {
      error: "Order draft could not be prepared. Please try again.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  redirect(`/store/${slug}/order/${persisted.orderId}?source=${persisted.table}`);
}

export async function updateStoreOrderStatusAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const status = cleanText(formData.get("status"), 40);
  const source = cleanText(formData.get("source"), 40) as StoreOrderStatusSource;
  const internalNote = cleanText(formData.get("internalNote"), 1000);
  const returnTo = safeOrderReturnPath(formData.get("returnTo"));

  if (!orderId) {
    orderStatusReturnRedirect(returnTo, "missing-order");
  }

  if (!storeOrderStatuses.has(status) || (source !== "orders" && source !== "store_orders")) {
    orderStatusReturnRedirect(returnTo, "invalid-status", orderId);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  let workspaceId: string | null = null;

  try {
    workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    await requirePermission({
      permission: "manage_orders",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  const tableName = source === "orders" ? "orders" : "store_orders";
  const { data: currentOrder, error: currentError } = await supabase
    .from(tableName as never)
    .select("id, order_status")
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const currentOrderRow = currentOrder as { id: string; order_status: string | null } | null;

  if (currentError) {
    console.error("[store-orders] status lookup failed", {
      code: currentError.code,
      message: currentError.message,
      orderId,
      source,
      status
    });
    orderStatusReturnRedirect(returnTo, "status-failed", orderId);
  }

  if (!currentOrderRow) {
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  if (
    (currentOrderRow.order_status === "cancelled" || currentOrderRow.order_status === "canceled") &&
    status !== "cancelled"
  ) {
    orderStatusReturnRedirect(returnTo, "invalid-transition", orderId);
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, string | null> = {
    order_status: status,
    payment_method: "manual",
    payment_status: "pending",
    updated_at: now
  };

  if (internalNote) {
    updatePayload.internal_note = internalNote;
  }

  if (status === "confirmed") {
    updatePayload.confirmed_at = now;
    updatePayload.cancelled_at = null;
  }

  if (status === "pending" || status === "draft") {
    updatePayload.confirmed_at = null;
    updatePayload.cancelled_at = null;
  }

  if (status === "cancelled") {
    updatePayload.cancelled_at = now;
  }

  let { data, error } = await supabase
    .from(tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .select("id")
    .maybeSingle();

  if (error && source === "store_orders" && status === "cancelled") {
    const fallbackPayload = { ...updatePayload, order_status: "canceled" };
    const fallback = await supabase
      .from("store_orders" as never)
      .update(fallbackPayload as never)
      .eq("id" as never, orderId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .select("id")
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error && error.code === "PGRST204") {
    const minimalPayload = {
      order_status: status,
      updated_at: now
    };
    const fallback = await supabase
      .from(tableName as never)
      .update(minimalPayload as never)
      .eq("id" as never, orderId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .select("id")
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[store-orders] status update failed", {
      code: error.code,
      message: error.message,
      orderId,
      source,
      status
    });
    orderStatusReturnRedirect(returnTo, "status-failed", orderId);
  }

  if (!data) {
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  revalidatePath(dashboardOrdersPath);
  revalidatePath(returnTo);
  revalidatePath("/dashboard");
  orderStatusReturnRedirect(returnTo, "status-updated", orderId);
}
