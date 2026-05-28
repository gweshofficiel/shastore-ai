"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import {
  calculatePublicCheckoutFinancialsForStore,
  type CheckoutFinancialBreakdown
} from "@/lib/public-tax";
import { createClient } from "@/lib/supabase/server";
import { getPublicShippingMethodForStore, type PublicShippingMethod } from "@/lib/public-shipping-methods";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import {
  incrementCouponUsage,
  validateStoreCoupon,
  type StoreCouponRow
} from "@/lib/store-coupons";
import { validateCheckoutInventory } from "@/lib/store-inventory";
import {
  createLowStockNotificationsForOrderSafe,
  createOrderNotificationSafe,
  createStoreNotificationSafe
} from "@/lib/notifications/store-notifications";
import { createCustomerLifecycleEventsForConfirmedOrderSafe } from "@/lib/customer-lifecycle-emails";
import { queueStoreEmailEventSafe } from "@/lib/store-email-queue";
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
  variantId?: string | null;
};

type DeliveryMethod = "delivery" | "pickup" | "none";

const dashboardOrdersPath = "/dashboard/orders";
const storeOrderStatuses = new Set([
  "draft",
  "pending",
  "confirmed",
  "cancelled"
]);
const fulfillmentStatuses = new Set([
  "unfulfilled",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "fulfilled"
]);
type FulfillmentStatus =
  | "unfulfilled"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "fulfilled";
type StoreOrderStatusSource = "orders" | "store_orders";

const fulfillmentTimestampColumns: Partial<Record<FulfillmentStatus, string>> = {
  fulfilled: "fulfilled_at",
  out_for_delivery: "out_for_delivery_at",
  preparing: "preparing_at",
  ready_for_pickup: "ready_for_pickup_at"
};

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
        const rawItem = item as unknown as {
          id?: unknown;
          productId?: unknown;
          quantity: number;
          variantId?: unknown;
          variant_id?: unknown;
        };

        const variantId =
          typeof rawItem.variantId === "string"
            ? rawItem.variantId
            : typeof rawItem.variant_id === "string"
              ? rawItem.variant_id
              : null;

        return {
          id: typeof rawItem.id === "string" ? rawItem.id : String(rawItem.productId ?? ""),
          quantity: Math.max(1, Math.floor(rawItem.quantity)),
          variantId
        };
      });
  } catch {
    return [];
  }
}

function parseDeliveryMethod(value: FormDataEntryValue | null): DeliveryMethod {
  return value === "delivery" || value === "pickup" ? value : "none";
}

function variantOptionsPayload(
  variant:
    | {
        optionColor: string | null;
        optionCustomName: string | null;
        optionCustomValue: string | null;
        optionMaterial: string | null;
        optionSize: string | null;
      }
    | null
) {
  if (!variant) {
    return {};
  }

  return Object.fromEntries(
    [
      ["Size", variant.optionSize],
      ["Color", variant.optionColor],
      ["Material", variant.optionMaterial],
      [variant.optionCustomName || "", variant.optionCustomValue]
    ].filter(([label, value]) => label && value)
  );
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

function deliveryMethodForShippingMethod(method: PublicShippingMethod): DeliveryMethod {
  return method.type === "local_pickup" ? "pickup" : "delivery";
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

function logSupabaseDiagnostic(
  stage: string,
  context: Record<string, unknown>,
  error?: { code?: string; details?: string; hint?: string; message?: string } | null
) {
  const payload = {
    stage,
    ...context,
    supabase: error
      ? {
          code: error.code,
          details: error.details,
          error,
          hint: error.hint,
          message: error.message
        }
      : null
  };

  if (error) {
    console.error("[store-orders][diagnostic]", payload);
    return;
  }

  console.info("[store-orders][diagnostic]", payload);
}

async function recordOrderEventSafe({
  actorUserId,
  eventType,
  message,
  metadata,
  newValue,
  orderId,
  orderSource,
  previousValue,
  storeId,
  supabase,
  workspaceId
}: {
  actorUserId?: string | null;
  eventType:
    | "order_created"
    | "status_changed"
    | "fulfillment_changed"
    | "payment_status_changed"
    | "seller_note_updated";
  message: string;
  metadata?: Record<string, unknown>;
  newValue?: string | null;
  orderId: string;
  orderSource: StoreOrderStatusSource;
  previousValue?: string | null;
  storeId: string;
  supabase: NonNullable<ReturnType<typeof createAdminClient>> | Awaited<ReturnType<typeof createClient>>;
  workspaceId?: string | null;
}) {
  logSupabaseDiagnostic("order_events.insert.before", {
    eventType,
    hasActorUserId: Boolean(actorUserId),
    orderId,
    orderSource,
    storeId,
    workspaceId
  });

  const { error } = await supabase.from("order_events" as never).insert({
    actor_user_id: actorUserId ?? null,
    event_type: eventType,
    message,
    metadata: (metadata ?? {}) as Json,
    new_value: newValue ?? null,
    order_id: orderId,
    order_source: orderSource,
    previous_value: previousValue ?? null,
    store_id: storeId,
    workspace_id: workspaceId ?? null
  } as never);

  if (error) {
    logSupabaseDiagnostic(
      "order_events.insert.failed",
      {
        eventType,
        orderId,
        orderSource,
        storeId,
        workspaceId
      },
      error
    );
    console.warn("[store-orders] order event insert skipped", {
      code: error.code,
      details: error.details,
      eventType,
      hint: error.hint,
      message: error.message,
      orderId,
      orderSource
    });
  } else {
    logSupabaseDiagnostic("order_events.insert.succeeded", {
      eventType,
      orderId,
      orderSource,
      storeId,
      workspaceId
    });
  }
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
  variant_id?: string | null;
  variant_name?: string | null;
  variant_options?: Json;
  variant_sku?: string | null;
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
  shippingMethod,
  financialBreakdown,
  coupon,
  discountAmount,
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
  shippingMethod: PublicShippingMethod | null;
  financialBreakdown: CheckoutFinancialBreakdown;
  coupon: StoreCouponRow | null;
  discountAmount: number;
  subtotal: number;
  slug: string;
}) {
  const workspaceId = store.workspace_id;
  const storeInstanceId = await resolveStoreInstanceId(admin, store);
  const combinedNotes = [customerAddress, customerNotes].filter(Boolean).join("\n\n") || null;
  const orderNumber = generateDraftOrderNumber();
  const safeDiscountAmount = Math.min(subtotal, Math.max(0, Number(discountAmount.toFixed(2))));
  const discountedSubtotal = Number(Math.max(0, subtotal - safeDiscountAmount).toFixed(2));
  const total = financialBreakdown.totalAmount;
  const couponPayload = coupon
    ? {
        coupon_code: coupon.code,
        coupon_id: coupon.id,
        discount_amount: safeDiscountAmount,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
        order_subtotal_before_discount: subtotal
      }
    : {
        discount_amount: 0,
        order_subtotal_before_discount: subtotal
      };

  const legacyOrderPayload: Record<string, unknown> = {
    store_instance_id: storeInstanceId,
    order_number: orderNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || null,
    notes: combinedNotes,
    delivery_fee: deliveryFee,
    delivery_method: deliveryMethod,
    shipping_method_id: shippingMethod?.id ?? null,
    shipping_method_name: shippingMethod?.name ?? null,
    shipping_method_type: shippingMethod?.type ?? null,
    subtotal_amount: financialBreakdown.subtotalAmount,
    shipping_amount: financialBreakdown.shippingAmount,
    taxable_amount: financialBreakdown.taxableAmount,
    tax_amount: financialBreakdown.taxAmount,
    tax_applies_to_shipping: financialBreakdown.taxAppliesToShipping,
    tax_name: financialBreakdown.taxName,
    tax_rate: financialBreakdown.taxRate,
    prices_include_tax: financialBreakdown.pricesIncludeTax,
    total_amount: financialBreakdown.totalAmount,
    subtotal: discountedSubtotal,
    total,
    currency,
    order_status: "draft",
    payment_status: "pending",
    fulfillment_status: "unfulfilled"
  };

  const extendedOrderPayload: Record<string, unknown> = {
    ...legacyOrderPayload,
    ...couponPayload,
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
    extendedOrderPayload,
    legacyOrderPayload,
    Object.fromEntries(
      Object.entries(legacyOrderPayload).filter(
        ([key]) =>
          ![
            "delivery_fee",
            "delivery_method",
            "fulfillment_status",
            "shipping_method_id",
            "shipping_method_name",
            "shipping_method_type",
            "subtotal_amount",
            "shipping_amount",
            "taxable_amount",
            "total_amount",
            "tax_amount",
            "tax_applies_to_shipping",
            "tax_name",
            "tax_rate",
            "prices_include_tax"
          ].includes(key)
      )
    ),
    Object.fromEntries(
      Object.entries(extendedOrderPayload).filter(
        ([key]) =>
          ![
            "delivery_fee",
            "delivery_method",
            "fulfillment_status",
            "shipping_method_id",
            "shipping_method_name",
            "shipping_method_type",
            "subtotal_amount",
            "shipping_amount",
            "taxable_amount",
            "total_amount",
            "tax_amount",
            "tax_applies_to_shipping",
            "tax_name",
            "tax_rate",
            "prices_include_tax"
          ].includes(key)
      )
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
      variant_id: item.variant_id ?? null,
      variant_name: item.variant_name ?? null,
      variant_sku: item.variant_sku ?? null,
      variant_options: item.variant_options ?? {},
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

    for (const orderItems of [extendedItemRows, legacyItemRows]) {
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
      if (coupon && !(await incrementCouponUsage(admin, coupon))) {
        await admin.from("orders" as never).delete().eq("id" as never, orderRow.id as never);
        return null;
      }

      await recordOrderEventSafe({
        eventType: "order_created",
        message: `Order draft created from public storefront for ${customerName}.`,
        metadata: {
          currency,
          deliveryFee,
          deliveryMethod,
          itemCount: items.length,
          subtotal,
          total
        },
        newValue: "draft",
        orderId: orderRow.id,
        orderSource: "orders",
        storeId: store.id,
        supabase: admin,
        workspaceId
      });
      await createOrderNotificationSafe({
        customerName,
        orderId: orderRow.id,
        orderSource: "orders",
        storeId: store.id,
        totalAmount: total,
        type: "new_order",
        workspaceId
      });
      await queueStoreEmailEventSafe({
        metadata: {
          customerName,
          orderReference: orderRow.id.slice(0, 8),
          orderSource: "orders",
          storeName: slug,
          totalAmount: total
        },
        recipient: customerEmail,
        storeId: store.id,
        templateKey: "order_confirmation",
        workspaceId
      });
      if (coupon) {
        await createStoreNotificationSafe({
          message: `Coupon ${coupon.code} was used on order ${orderRow.id.slice(0, 8)}.`,
          metadata: {
            couponCode: coupon.code,
            couponId: coupon.id,
            discountAmount: safeDiscountAmount,
            orderId: orderRow.id,
            orderSource: "orders"
          },
          storeId: store.id,
          title: "Coupon used",
          type: "coupon_used",
          workspaceId
        });
      }
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
    shipping_method_id: shippingMethod?.id ?? null,
    shipping_method_name: shippingMethod?.name ?? null,
    shipping_method_type: shippingMethod?.type ?? null,
    subtotal_amount: financialBreakdown.subtotalAmount,
    shipping_amount: financialBreakdown.shippingAmount,
    taxable_amount: financialBreakdown.taxableAmount,
    tax_amount: financialBreakdown.taxAmount,
    tax_applies_to_shipping: financialBreakdown.taxAppliesToShipping,
    tax_name: financialBreakdown.taxName,
    tax_rate: financialBreakdown.taxRate,
    prices_include_tax: financialBreakdown.pricesIncludeTax,
    total_amount: financialBreakdown.totalAmount,
    fulfillment_status: "unfulfilled",
    items: legacyItems as Json,
    subtotal: discountedSubtotal,
    total,
    ...couponPayload,
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
      Object.entries(storeOrderPayload).filter(
        ([key]) =>
          ![
            "delivery_fee",
            "delivery_method",
            "fulfillment_status",
            "shipping_method_id",
            "shipping_method_name",
            "shipping_method_type",
            "subtotal_amount",
            "shipping_amount",
            "taxable_amount",
            "total_amount",
            "tax_amount",
            "tax_applies_to_shipping",
            "tax_name",
            "tax_rate",
            "prices_include_tax"
          ].includes(key)
      )
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

  if (coupon && !(await incrementCouponUsage(admin, coupon))) {
    await admin.from("store_orders" as never).delete().eq("id" as never, storeOrderRow.id as never);
    return null;
  }

  await recordOrderEventSafe({
    eventType: "order_created",
    message: `Order draft created from public storefront for ${customerName}.`,
    metadata: {
      currency,
      deliveryFee,
      deliveryMethod,
      itemCount: items.length,
      subtotal,
      total
    },
    newValue: "draft",
    orderId: storeOrderRow.id,
    orderSource: "store_orders",
    storeId: store.id,
    supabase: admin,
    workspaceId: workspaceId ?? store.owner_user_id ?? store.user_id
  });
  await createOrderNotificationSafe({
    customerName,
    orderId: storeOrderRow.id,
    orderSource: "store_orders",
    storeId: store.id,
    totalAmount: total,
    type: "new_order",
    workspaceId: workspaceId ?? store.owner_user_id ?? store.user_id
  });
  await queueStoreEmailEventSafe({
    metadata: {
      customerName,
      orderReference: storeOrderRow.id.slice(0, 8),
      orderSource: "store_orders",
      storeName: slug,
      totalAmount: total
    },
    recipient: customerEmail,
    storeId: store.id,
    templateKey: "order_confirmation",
    workspaceId: workspaceId ?? store.owner_user_id ?? store.user_id
  });
  if (coupon) {
    await createStoreNotificationSafe({
      message: `Coupon ${coupon.code} was used on order ${storeOrderRow.id.slice(0, 8)}.`,
      metadata: {
        couponCode: coupon.code,
        couponId: coupon.id,
        discountAmount: safeDiscountAmount,
        orderId: storeOrderRow.id,
        orderSource: "store_orders"
      },
      storeId: store.id,
      title: "Coupon used",
      type: "coupon_used",
      workspaceId: workspaceId ?? store.owner_user_id ?? store.user_id
    });
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
  const couponCode = cleanText(formData.get("couponCode"), 80);
  const requestedShippingMethodId = cleanText(formData.get("shippingMethodId"), 80);
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

  const inventoryCheck = await validateCheckoutInventory({
    admin,
    storeId: store.id,
    requestedItems
  });

  if (!inventoryCheck.ok) {
    return {
      error: inventoryCheck.error,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const productsById = new Map(preview.products.map((product) => [product.id, product]));
  const items = requestedItems
    .map((item) => {
      const product = productsById.get(item.id);

      if (!product) {
        return null;
      }

      const variant = item.variantId
        ? product.variants.find((candidate) => candidate.id === item.variantId) ?? null
        : null;
      const unitPrice = parsePrice(variant?.priceOverride ?? product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        categoryName: product.categoryName,
        id: product.id,
        imageUrl: product.imageUrl,
        price: unitPrice,
        priceLabel: product.priceLabel,
        quantity: item.quantity,
        title: product.title,
        total: lineTotal,
        variant_id: variant?.id ?? null,
        variant_name: variant?.name ?? null,
        variant_options: variantOptionsPayload(variant) as Json,
        variant_sku: variant?.sku ?? null
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

  const subtotal = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const couponResult = couponCode
    ? await validateStoreCoupon(admin, {
        code: couponCode,
        storeId: store.id,
        subtotal,
        workspaceId: store.workspace_id
      })
    : null;

  if (couponResult && !couponResult.ok) {
    return {
      error: couponResult.error,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const discountAmount = couponResult?.ok ? couponResult.discountAmount : 0;
  const shippingMethod = requestedShippingMethodId
    ? await getPublicShippingMethodForStore({
        methodId: requestedShippingMethodId,
        storeId: store.id
      })
    : null;

  if (requestedShippingMethodId && !shippingMethod) {
    return {
      error: "Selected shipping method is no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const deliveryFee = shippingMethod
    ? shippingMethod.freeShippingThreshold != null && subtotal >= shippingMethod.freeShippingThreshold
      ? 0
      : shippingMethod.fee
    : 0;
  const deliveryMethod = shippingMethod ? deliveryMethodForShippingMethod(shippingMethod) : "none";
  const financialBreakdown = await calculatePublicCheckoutFinancialsForStore({
    discountAmount,
    shippingAmount: deliveryFee,
    storeId: store.id,
    subtotalAmount: subtotal
  });
  const total = financialBreakdown.totalAmount;
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
      delivery_fee: deliveryFee,
      delivery_method: deliveryMethod,
      shipping_method_id: shippingMethod?.id ?? null,
      shipping_method_name: shippingMethod?.name ?? null,
      shipping_method_type: shippingMethod?.type ?? null,
      subtotal_amount: financialBreakdown.subtotalAmount,
      shipping_amount: financialBreakdown.shippingAmount,
      taxable_amount: financialBreakdown.taxableAmount,
      tax_amount: financialBreakdown.taxAmount,
      tax_applies_to_shipping: financialBreakdown.taxAppliesToShipping,
      tax_name: financialBreakdown.taxName,
      tax_rate: financialBreakdown.taxRate,
      prices_include_tax: financialBreakdown.pricesIncludeTax,
      total_amount: financialBreakdown.totalAmount,
      items: items as Json,
      subtotal: financialBreakdown.discountedSubtotalAmount,
      total,
      coupon_id: couponResult?.ok ? couponResult.coupon.id : null,
      coupon_code: couponResult?.ok ? couponResult.coupon.code : null,
      discount_type: couponResult?.ok ? couponResult.coupon.discount_type : null,
      discount_value: couponResult?.ok ? Number(couponResult.coupon.discount_value) : null,
      discount_amount: discountAmount,
      order_subtotal_before_discount: subtotal,
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

  if (couponResult?.ok && !(await incrementCouponUsage(admin, couponResult.coupon))) {
    await admin.from("store_orders" as never).delete().eq("id" as never, (order as { id: string }).id as never);
    return {
      error: "Coupon usage limit has been reached.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  await createOrderNotificationSafe({
    customerName,
    orderId: (order as { id: string }).id,
    orderSource: "store_orders",
    storeId: store.id,
    totalAmount: total,
    type: "new_order",
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });
  await queueStoreEmailEventSafe({
    metadata: {
      customerName,
      orderReference: (order as { id: string }).id.slice(0, 8),
      orderSource: "store_orders",
      storeName: slug,
      totalAmount: total
    },
    recipient: customerEmail,
    storeId: store.id,
    templateKey: "order_confirmation",
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });
  if (couponResult?.ok) {
    await createStoreNotificationSafe({
      message: `Coupon ${couponResult.coupon.code} was used on order ${(order as { id: string }).id.slice(0, 8)}.`,
      metadata: {
        couponCode: couponResult.coupon.code,
        couponId: couponResult.coupon.id,
        discountAmount,
        orderId: (order as { id: string }).id,
        orderSource: "store_orders"
      },
      storeId: store.id,
      title: "Coupon used",
      type: "coupon_used",
      workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
    });
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
  const couponCode = cleanText(formData.get("couponCode"), 80);
  const requestedDeliveryMethod = parseDeliveryMethod(formData.get("deliveryMethod"));
  const requestedShippingMethodId = cleanText(formData.get("shippingMethodId"), 80);
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

  const inventoryCheck = await validateCheckoutInventory({
    admin,
    storeId: store.id,
    requestedItems
  });

  if (!inventoryCheck.ok) {
    return {
      error: inventoryCheck.error,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const productsById = new Map(preview.products.map((product) => [product.id, product]));
  const items = requestedItems
    .map((item) => {
      const product = productsById.get(item.id);

      if (!product || !isActivePublicProduct(product.status)) {
        return null;
      }

      const variant = item.variantId
        ? product.variants.find((candidate) => candidate.id === item.variantId) ?? null
        : null;
      const unitPrice = parsePrice(variant?.priceOverride ?? product.price);
      const quantity = Math.max(1, item.quantity);
      const subtotal = Number((unitPrice * quantity).toFixed(2));

      return {
        currency: product.currency || store.currency || preview.store.currency || "USD",
        product_id: product.id,
        product_image: product.imageUrl,
        product_title: product.title,
        quantity,
        price: unitPrice,
        subtotal,
        variant_id: variant?.id ?? null,
        variant_name: variant?.name ?? null,
        variant_options: variantOptionsPayload(variant) as Json,
        variant_sku: variant?.sku ?? null
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
  const shippingMethod = requestedShippingMethodId
    ? await getPublicShippingMethodForStore({
        methodId: requestedShippingMethodId,
        storeId: store.id
      })
    : null;

  if (requestedShippingMethodId && !shippingMethod) {
    return {
      error: "Selected shipping method is no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const deliverySelection = shippingMethod
    ? {
        deliveryFee:
          shippingMethod.freeShippingThreshold != null && subtotal >= shippingMethod.freeShippingThreshold
            ? 0
            : shippingMethod.fee,
        deliveryMethod: deliveryMethodForShippingMethod(shippingMethod),
        error: null
      }
    : resolveDeliverySelection({
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

  const couponResult = couponCode
    ? await validateStoreCoupon(admin, {
        code: couponCode,
        storeId: store.id,
        subtotal,
        workspaceId: store.workspace_id
      })
    : null;

  if (couponResult && !couponResult.ok) {
    return {
      error: couponResult.error,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const financialBreakdown = await calculatePublicCheckoutFinancialsForStore({
    discountAmount: couponResult?.ok ? couponResult.discountAmount : 0,
    shippingAmount: deliverySelection.deliveryFee,
    storeId: store.id,
    subtotalAmount: subtotal
  });

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
    shippingMethod,
    financialBreakdown,
    coupon: couponResult?.ok ? couponResult.coupon : null,
    discountAmount: couponResult?.ok ? couponResult.discountAmount : 0,
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
  logSupabaseDiagnostic("order_status.lookup.before", {
    orderId,
    select: "id, store_id, store_instance_id, workspace_id, customer_name, customer_email, total_amount, total, order_status, payment_status, internal_note",
    source,
    status,
    tableName,
    workspaceId
  });
  const { data: currentOrder, error: currentError } = await supabase
    .from(tableName as never)
    .select("id, store_id, store_instance_id, workspace_id, customer_name, customer_email, total_amount, total, order_status, payment_status, internal_note")
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const currentOrderRow = currentOrder as {
    id: string;
    customer_email?: string | null;
    customer_name?: string | null;
    internal_note?: string | null;
    order_status: string | null;
    payment_status?: string | null;
    store_id?: string | null;
    store_instance_id?: string | null;
    total?: number | string | null;
    total_amount?: number | string | null;
    workspace_id?: string | null;
  } | null;

  if (currentError) {
    logSupabaseDiagnostic(
      "order_status.lookup.failed",
      {
        orderId,
        select: "id, store_id, store_instance_id, workspace_id, customer_name, customer_email, total_amount, total, order_status, payment_status, internal_note",
        source,
        status,
        tableName,
        workspaceId
      },
      currentError
    );
    console.error("[store-orders] status lookup failed", {
      code: currentError.code,
      details: currentError.details,
      hint: currentError.hint,
      message: currentError.message,
      orderId,
      source,
      status
    });
    orderStatusReturnRedirect(returnTo, "status-failed", orderId);
  }

  if (!currentOrderRow) {
    logSupabaseDiagnostic("order_status.lookup.no_row", {
      orderId,
      source,
      status,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  logSupabaseDiagnostic("order_status.lookup.succeeded", {
    currentOrderStatus: currentOrderRow.order_status,
    hasInternalNote: Boolean(currentOrderRow.internal_note),
    orderId,
    source,
    status,
    tableName,
    workspaceId: currentOrderRow.workspace_id ?? workspaceId
  });

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

  logSupabaseDiagnostic("order_status.update.before", {
    orderId,
    source,
    status,
    tableName,
    updateColumns: Object.keys(updatePayload),
    workspaceId
  });

  let { data, error } = await supabase
    .from(tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .select("id")
    .maybeSingle();

  if (error) {
    logSupabaseDiagnostic(
      "order_status.update.initial_failed",
      {
        orderId,
        source,
        status,
        tableName,
        updateColumns: Object.keys(updatePayload),
        workspaceId
      },
      error
    );
  } else {
    logSupabaseDiagnostic("order_status.update.initial_completed", {
      hasUpdatedRow: Boolean(data),
      orderId,
      source,
      status,
      tableName,
      workspaceId
    });
  }

  if (error && source === "store_orders" && status === "cancelled") {
    const fallbackPayload = { ...updatePayload, order_status: "canceled" };
    logSupabaseDiagnostic("order_status.update.cancelled_fallback.before", {
      orderId,
      source,
      status,
      tableName: "store_orders",
      updateColumns: Object.keys(fallbackPayload),
      workspaceId
    });
    const fallback = await supabase
      .from("store_orders" as never)
      .update(fallbackPayload as never)
      .eq("id" as never, orderId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .select("id")
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (fallback.error) {
      logSupabaseDiagnostic(
        "order_status.update.cancelled_fallback.failed",
        {
          orderId,
          source,
          status,
          tableName: "store_orders",
          updateColumns: Object.keys(fallbackPayload),
          workspaceId
        },
        fallback.error
      );
    } else {
      logSupabaseDiagnostic("order_status.update.cancelled_fallback.completed", {
        hasUpdatedRow: Boolean(fallback.data),
        orderId,
        source,
        status,
        tableName: "store_orders",
        workspaceId
      });
    }
  }

  if (error && error.code === "PGRST204") {
    const minimalPayload = {
      order_status: status,
      updated_at: now
    };
    logSupabaseDiagnostic("order_status.update.minimal_fallback.before", {
      orderId,
      source,
      status,
      tableName,
      updateColumns: Object.keys(minimalPayload),
      workspaceId
    });
    const fallback = await supabase
      .from(tableName as never)
      .update(minimalPayload as never)
      .eq("id" as never, orderId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .select("id")
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (fallback.error) {
      logSupabaseDiagnostic(
        "order_status.update.minimal_fallback.failed",
        {
          orderId,
          source,
          status,
          tableName,
          updateColumns: Object.keys(minimalPayload),
          workspaceId
        },
        fallback.error
      );
    } else {
      logSupabaseDiagnostic("order_status.update.minimal_fallback.completed", {
        hasUpdatedRow: Boolean(fallback.data),
        orderId,
        source,
        status,
        tableName,
        workspaceId
      });
    }
  }

  if (error) {
    if (String(error.message ?? "").toLowerCase().includes("insufficient inventory")) {
      orderStatusReturnRedirect(returnTo, "inventory-insufficient", orderId);
    }

    logSupabaseDiagnostic(
      "order_status.update.failed",
      {
        orderId,
        source,
        status,
        tableName,
        updateColumns: Object.keys(updatePayload),
        workspaceId
      },
      error
    );
    console.error("[store-orders] status update failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      orderId,
      source,
      status
    });
    orderStatusReturnRedirect(returnTo, "status-failed", orderId);
  }

  if (!data) {
    logSupabaseDiagnostic("order_status.update.no_row", {
      orderId,
      source,
      status,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  logSupabaseDiagnostic("order_status.update.succeeded", {
    orderId,
    source,
    status,
    tableName,
    workspaceId
  });

  const eventStoreId = currentOrderRow.store_id ?? currentOrderRow.store_instance_id;

  if (eventStoreId && currentOrderRow.order_status !== status) {
    await recordOrderEventSafe({
      actorUserId: user.id,
      eventType: "status_changed",
      message: `Order status changed from ${currentOrderRow.order_status ?? "unknown"} to ${status}.`,
      newValue: status,
      orderId,
      orderSource: source,
      previousValue: currentOrderRow.order_status,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
  }

  if (eventStoreId && currentOrderRow.payment_status && currentOrderRow.payment_status !== "pending") {
    await recordOrderEventSafe({
      actorUserId: user.id,
      eventType: "payment_status_changed",
      message: `Payment status changed from ${currentOrderRow.payment_status} to pending.`,
      newValue: "pending",
      orderId,
      orderSource: source,
      previousValue: currentOrderRow.payment_status,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
  }

  if (eventStoreId && internalNote && internalNote !== (currentOrderRow.internal_note ?? "")) {
    await recordOrderEventSafe({
      actorUserId: user.id,
      eventType: "seller_note_updated",
      message: "Internal seller note updated.",
      newValue: internalNote,
      orderId,
      orderSource: source,
      previousValue: currentOrderRow.internal_note ?? null,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
  }

  if (
    eventStoreId &&
    currentOrderRow.order_status !== status &&
    (status === "confirmed" || status === "cancelled")
  ) {
    await createOrderNotificationSafe({
      customerName: currentOrderRow.customer_name ?? null,
      orderId,
      orderSource: source,
      storeId: eventStoreId,
      totalAmount: parsePrice(currentOrderRow.total_amount ?? currentOrderRow.total ?? null),
      type: status === "confirmed" ? "order_confirmed" : "order_cancelled",
      workspaceId
    });
    await queueStoreEmailEventSafe({
      metadata: {
        customerName: currentOrderRow.customer_name ?? "Customer",
        orderReference: orderId.slice(0, 8),
        orderSource: source,
        orderStatus: status,
        totalAmount: parsePrice(currentOrderRow.total_amount ?? currentOrderRow.total ?? null)
      },
      recipient: currentOrderRow.customer_email ?? null,
      storeId: eventStoreId,
      templateKey: "order_status_update",
      workspaceId
    });

    if (status === "confirmed") {
      await createCustomerLifecycleEventsForConfirmedOrderSafe({
        customerEmail: currentOrderRow.customer_email ?? null,
        customerName: currentOrderRow.customer_name ?? null,
        orderId,
        orderSource: source,
        storeId: eventStoreId,
        totalAmount: parsePrice(currentOrderRow.total_amount ?? currentOrderRow.total ?? null),
        workspaceId
      });
      await queueStoreEmailEventSafe({
        metadata: {
          customerName: currentOrderRow.customer_name ?? "Customer",
          orderReference: orderId.slice(0, 8),
          orderSource: source,
          totalAmount: parsePrice(currentOrderRow.total_amount ?? currentOrderRow.total ?? null)
        },
        recipient: currentOrderRow.customer_email ?? null,
        storeId: eventStoreId,
        templateKey: "review_request",
        workspaceId
      });
      await createLowStockNotificationsForOrderSafe({
        orderId,
        orderSource: source,
        storeId: eventStoreId,
        workspaceId
      });
    }
  }

  revalidatePath(dashboardOrdersPath);
  revalidatePath(returnTo);
  revalidatePath("/dashboard");
  orderStatusReturnRedirect(returnTo, "status-updated", orderId);
}

export async function updateStoreOrderFulfillmentStatusAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const fulfillmentStatus = cleanText(formData.get("fulfillmentStatus"), 60) as FulfillmentStatus;
  const fulfillmentNotes = cleanText(formData.get("fulfillmentNotes"), 1000);
  const source = cleanText(formData.get("source"), 40) as StoreOrderStatusSource;
  const returnTo = safeOrderReturnPath(formData.get("returnTo"));

  if (!orderId) {
    orderStatusReturnRedirect(returnTo, "missing-order");
  }

  if (
    !fulfillmentStatuses.has(fulfillmentStatus) ||
    (source !== "orders" && source !== "store_orders")
  ) {
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
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
  logSupabaseDiagnostic("order_fulfillment.lookup.before", {
    fulfillmentStatus,
    orderId,
    select: "id, store_id, store_instance_id, workspace_id, order_status, delivery_method, fulfillment_status, fulfillment_notes",
    source,
    tableName,
    workspaceId
  });
  const { data: currentOrder, error: currentError } = await supabase
    .from(tableName as never)
    .select(
      source === "store_orders"
        ? "id, store_id, store_instance_id, workspace_id, order_status, delivery_method, fulfillment_status, fulfillment_notes"
        : "id, store_id, store_instance_id, workspace_id, order_status, delivery_method, fulfillment_status"
    )
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const currentOrderRow = currentOrder as {
    delivery_method: string | null;
    fulfillment_notes?: string | null;
    fulfillment_status: string | null;
    id: string;
    order_status?: string | null;
    store_id?: string | null;
    store_instance_id?: string | null;
    workspace_id?: string | null;
  } | null;

  if (currentError) {
    logSupabaseDiagnostic(
      "order_fulfillment.lookup.failed",
      {
        fulfillmentStatus,
        orderId,
        source,
        tableName,
        workspaceId
      },
      currentError
    );
    console.error("[store-orders] fulfillment lookup failed", {
      code: currentError.code,
      details: currentError.details,
      fulfillmentStatus,
      hint: currentError.hint,
      message: currentError.message,
      orderId,
      source
    });
    orderStatusReturnRedirect(returnTo, "fulfillment-failed", orderId);
  }

  if (!currentOrderRow) {
    logSupabaseDiagnostic("order_fulfillment.lookup.no_row", {
      fulfillmentStatus,
      orderId,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  const deliveryMethod = currentOrderRow.delivery_method;
  const currentFulfillmentStatus =
    currentOrderRow.fulfillment_status && currentOrderRow.fulfillment_status !== "pending"
      ? currentOrderRow.fulfillment_status
      : "unfulfilled";

  logSupabaseDiagnostic("order_fulfillment.lookup.succeeded", {
    currentFulfillmentStatus,
    deliveryMethod,
    fulfillmentStatus,
    hasFulfillmentNotes: Boolean(currentOrderRow.fulfillment_notes),
    orderId,
    orderStatus: currentOrderRow.order_status,
    source,
    tableName,
    workspaceId: currentOrderRow.workspace_id ?? workspaceId
  });

  if (currentOrderRow.order_status === "cancelled" || currentOrderRow.order_status === "canceled") {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_cancelled", {
      fulfillmentStatus,
      orderId,
      orderStatus: currentOrderRow.order_status,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
  }

  if (currentFulfillmentStatus === "fulfilled") {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_locked_fulfilled", {
      fulfillmentStatus,
      orderId,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
  }

  if (currentOrderRow.order_status === "draft" && fulfillmentStatus === "fulfilled") {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_draft_fulfilled", {
      fulfillmentStatus,
      orderId,
      orderStatus: currentOrderRow.order_status,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
  }

  if (fulfillmentStatus === "ready_for_pickup" && deliveryMethod !== "pickup") {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_pickup_method", {
      deliveryMethod,
      fulfillmentStatus,
      orderId,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
  }

  if (fulfillmentStatus === "out_for_delivery" && deliveryMethod !== "delivery") {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_delivery_method", {
      deliveryMethod,
      fulfillmentStatus,
      orderId,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "invalid-fulfillment", orderId);
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, string | null> = {
    fulfillment_status: fulfillmentStatus,
    updated_at: now
  };
  const timestampColumn = fulfillmentTimestampColumns[fulfillmentStatus];

  if (source === "store_orders") {
    if (timestampColumn) {
      updatePayload[timestampColumn] = now;
    }

    if (fulfillmentNotes) {
      updatePayload.fulfillment_notes = fulfillmentNotes;
    }
  }

  logSupabaseDiagnostic("order_fulfillment.update.before", {
    fulfillmentStatus,
    orderId,
    source,
    tableName,
    updateColumns: Object.keys(updatePayload),
    workspaceId
  });

  const { data, error } = await supabase
    .from(tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .select("id")
    .maybeSingle();

  if (error) {
    logSupabaseDiagnostic(
      "order_fulfillment.update.failed",
      {
        fulfillmentStatus,
        orderId,
        source,
        tableName,
        updateColumns: Object.keys(updatePayload),
        workspaceId
      },
      error
    );
    console.error("[store-orders] fulfillment update failed", {
      code: error.code,
      details: error.details,
      fulfillmentStatus,
      hint: error.hint,
      message: error.message,
      orderId,
      source
    });
    orderStatusReturnRedirect(returnTo, "fulfillment-failed", orderId);
  }

  if (!data) {
    logSupabaseDiagnostic("order_fulfillment.update.no_row", {
      fulfillmentStatus,
      orderId,
      source,
      tableName,
      workspaceId
    });
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  logSupabaseDiagnostic("order_fulfillment.update.succeeded", {
    fulfillmentStatus,
    orderId,
    source,
    tableName,
    workspaceId
  });

  const eventStoreId = currentOrderRow.store_id ?? currentOrderRow.store_instance_id;

  if (eventStoreId && currentFulfillmentStatus !== fulfillmentStatus) {
    await recordOrderEventSafe({
      actorUserId: user.id,
      eventType: "fulfillment_changed",
      message: `Fulfillment status changed from ${currentFulfillmentStatus} to ${fulfillmentStatus}.`,
      metadata: {
        hasFulfillmentNotes: Boolean(fulfillmentNotes),
        timestampColumn: timestampColumn ?? null
      },
      newValue: fulfillmentStatus,
      orderId,
      orderSource: source,
      previousValue: currentFulfillmentStatus,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
  }

  revalidatePath(dashboardOrdersPath);
  revalidatePath(returnTo);
  revalidatePath("/dashboard");
  orderStatusReturnRedirect(returnTo, "fulfillment-updated", orderId);
}

function withFulfillmentStatus(formData: FormData, fulfillmentStatus: FulfillmentStatus) {
  formData.set("fulfillmentStatus", fulfillmentStatus);
  return formData;
}

export async function markPreparing(formData: FormData) {
  return updateStoreOrderFulfillmentStatusAction(withFulfillmentStatus(formData, "preparing"));
}

export async function markReadyForPickup(formData: FormData) {
  return updateStoreOrderFulfillmentStatusAction(withFulfillmentStatus(formData, "ready_for_pickup"));
}

export async function markOutForDelivery(formData: FormData) {
  return updateStoreOrderFulfillmentStatusAction(withFulfillmentStatus(formData, "out_for_delivery"));
}

export async function markFulfilled(formData: FormData) {
  return updateStoreOrderFulfillmentStatusAction(withFulfillmentStatus(formData, "fulfilled"));
}
