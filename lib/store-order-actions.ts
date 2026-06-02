"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import {
  calculatePublicCheckoutFinancialsForStore,
  type CheckoutFinancialBreakdown
} from "@/lib/public-tax";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { assertUsageWithinLimits, billingEnforcementMessage } from "@/lib/billing/enforcement";
import { recordSubscriptionEnforcementLog } from "@/lib/billing/enforcement-log";
import { createClient } from "@/lib/supabase/server";
import {
  getPublicShippingMethodForStore,
  matchPublicShippingRate,
  type PublicShippingMethod
} from "@/lib/public-shipping-methods";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import {
  getEnabledPublicStorePaymentMethods,
  type PublicStorePaymentMethodKey,
  type StorePaymentMethod
} from "@/lib/store-payment-methods";
import {
  incrementCouponUsage,
  validateStoreCoupon,
  type StoreCouponRow
} from "@/lib/store-coupons";
import { validateCheckoutInventory } from "@/lib/store-inventory";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { markAbandonedCartRecoveredSafe } from "@/lib/abandoned-cart-recovery";
import { createPayPalCheckoutOrder, getStorePaymentsStripe } from "@/lib/store-payment-provider-runtime";
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
  "pending",
  "processing",
  "preparing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded"
]);
type FulfillmentStatus =
  | "pending"
  | "processing"
  | "preparing"
  | "ready_for_pickup"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";
type StoreOrderStatusSource = "orders" | "store_orders";

const fulfillmentTimestampColumns: Partial<Record<FulfillmentStatus, string[]>> = {
  delivered: ["delivered_at", "fulfilled_at"],
  out_for_delivery: ["out_for_delivery_at"],
  preparing: ["preparing_at"],
  processing: ["preparing_at"],
  ready_for_pickup: ["ready_for_pickup_at"],
  shipped: ["shipped_at"]
};

const nextFulfillmentStatus: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  out_for_delivery: "delivered",
  pending: "processing",
  preparing: "ready_for_pickup",
  processing: "preparing",
  ready_for_pickup: "shipped",
  shipped: "out_for_delivery"
};

function normalizeFulfillmentStatus(status: string | null | undefined): FulfillmentStatus {
  const normalized = status?.trim() || "pending";

  if (normalized === "unfulfilled") {
    return "pending";
  }

  if (normalized === "fulfilled") {
    return "delivered";
  }

  return fulfillmentStatuses.has(normalized) ? (normalized as FulfillmentStatus) : "pending";
}

function isExceptionalFulfillmentTransition(current: FulfillmentStatus, next: FulfillmentStatus) {
  if (next === "cancelled") {
    return current !== "cancelled" && current !== "returned" && current !== "refunded" && current !== "delivered";
  }

  if (next === "returned") {
    return current === "delivered";
  }

  if (next === "refunded") {
    return current === "cancelled" || current === "delivered" || current === "returned";
  }

  return false;
}

function isFulfillmentTransitionAllowed(current: FulfillmentStatus, next: FulfillmentStatus) {
  return current === next || nextFulfillmentStatus[current] === next || isExceptionalFulfillmentTransition(current, next);
}

function canEditShippingTracking(status: string | null | undefined) {
  const fulfillmentStatus = normalizeFulfillmentStatus(status);

  return fulfillmentStatus === "shipped" || fulfillmentStatus === "out_for_delivery" || fulfillmentStatus === "delivered";
}

function cleanOptionalUrl(value: FormDataEntryValue | null) {
  const url = cleanText(value, 500);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

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

function parsePublicStorePaymentMethod(value: FormDataEntryValue | null): PublicStorePaymentMethodKey | null {
  return value === "card" || value === "cod" || value === "whatsapp" || value === "paypal" || value === "youcan_pay"
    ? value
    : null;
}

function internalStorePaymentMethod(method: PublicStorePaymentMethodKey): StorePaymentMethod {
  return method === "card" ? "stripe" : method;
}

function stripeAmount(value: number) {
  return Math.max(0, Math.round(value * 100));
}

function stripeMetadataValue(value: string | number | null | undefined, maxLength = 500) {
  return String(value ?? "").slice(0, maxLength);
}

function stripeSuccessMetadata(input: {
  couponCode: string;
  customerAddress: string;
  customerEmail: string;
  customerName: string;
  customerNotes: string;
  customerPhone: string;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  orderReference: string;
  shippingMethod: PublicShippingMethod | null;
  slug: string;
  store: {
    id: string;
    owner_user_id: string | null;
    user_id: string;
    workspace_id: string | null;
  };
}) {
  return {
    coupon_code: stripeMetadataValue(input.couponCode, 80),
    customer_address: stripeMetadataValue(input.customerAddress),
    customer_email: stripeMetadataValue(input.customerEmail, 180),
    customer_name: stripeMetadataValue(input.customerName, 160),
    customer_notes: stripeMetadataValue(input.customerNotes),
    customer_phone: stripeMetadataValue(input.customerPhone, 80),
    delivery_fee: stripeMetadataValue(input.deliveryFee),
    delivery_method: stripeMetadataValue(input.deliveryMethod, 40),
    order_reference: input.orderReference,
    owner_user_id: stripeMetadataValue(input.store.owner_user_id ?? input.store.user_id, 80),
    shipping_method_id: stripeMetadataValue(input.shippingMethod?.id, 80),
    shipping_method_name: stripeMetadataValue(input.shippingMethod?.name, 160),
    shipping_method_type: stripeMetadataValue(input.shippingMethod?.type, 80),
    slug: stripeMetadataValue(input.slug, 120),
    store_id: input.store.id,
    user_id: input.store.user_id,
    workspace_id: stripeMetadataValue(input.store.workspace_id ?? input.store.owner_user_id ?? input.store.user_id, 80)
  };
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

async function validateOrderMonthlyLimitSafe({
  admin,
  ownerUserId,
  storeId,
  workspaceId
}: {
  admin: ReturnType<typeof createAdminClient>;
  ownerUserId: string;
  storeId: string;
  workspaceId: string;
}) {
  if (!admin) {
    return null;
  }

  const access = await getUserSubscriptionAccessForClient(admin, ownerUserId);

  try {
    assertUsageWithinLimits(access, "ordersMonth");
    return null;
  } catch (error) {
    await recordSubscriptionEnforcementLog({
      access,
      action: "order.create",
      error,
      storeId,
      supabase: admin,
      workspaceId
    });
    return billingEnforcementMessage(error) ?? "This store cannot accept more orders on the current plan.";
  }
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
    | "shipping_tracking_updated"
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
): Promise<string | null> {
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
    const normalizedSlug = store.slug.trim().toLowerCase();
    const slugCandidates = Array.from(new Set([store.slug.trim(), normalizedSlug].filter(Boolean)));

    for (const slug of slugCandidates) {
      const { data: instanceBySlug, error: instanceBySlugError } = await admin
        .from("store_instances" as never)
        .select("id")
        .eq("internal_slug", slug)
        .maybeSingle();
      const instanceBySlugRow = instanceBySlug as { id: string } | null;

      if (!instanceBySlugError && instanceBySlugRow?.id) {
        return instanceBySlugRow.id;
      }
    }
  }

  return null;
}

type DraftLineItem = {
  currency: string;
  digital_delivery_enabled?: boolean;
  digital_file_name?: string | null;
  product_id: string;
  product_image: string | null;
  product_title: string;
  product_type?: "physical" | "digital";
  quantity: number;
  price: number;
  requires_shipping?: boolean;
  subtotal: number;
  variant_id?: string | null;
  variant_name?: string | null;
  variant_options?: Json;
  variant_sku?: string | null;
};

type ReceiptEmailLineItem = {
  product_title?: string;
  quantity: number;
  title?: string;
};

function digitalDeliveryStatusForItem(item: DraftLineItem) {
  return item.product_type === "digital" && item.digital_delivery_enabled ? "pending" : "none";
}

function digitalOrderSummary(items: DraftLineItem[]) {
  const digitalItems = items.filter((item) => item.product_type === "digital");
  const physicalItems = items.filter((item) => item.product_type !== "digital" && item.requires_shipping !== false);

  return {
    deliveryType: digitalItems.length && physicalItems.length ? "mixed" : digitalItems.length ? "digital" : "physical",
    digitalCount: digitalItems.length,
    hasDigitalItems: digitalItems.length > 0,
    hasPhysicalShippingItems: physicalItems.length > 0,
    status: digitalItems.length > 0 ? "pending" : "none"
  };
}

function productSummaryForReceiptEmail(items: ReceiptEmailLineItem[]) {
  if (!items.length) {
    return "Products snapshot unavailable";
  }

  return items
    .slice(0, 8)
    .map((item) => `${item.product_title ?? item.title ?? "Product"} x${item.quantity}`)
    .join(", ");
}

function receiptUrl({
  orderId,
  orderSource,
  phone,
  slug
}: {
  orderId: string;
  orderSource: "orders" | "store_orders";
  phone: string;
  slug: string;
}) {
  const baseUrl = getAppBaseUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    phone,
    source: orderSource
  });

  return `${baseUrl}/store/${slug}/receipt/${orderId}?${params.toString()}`;
}

function orderConfirmationEmailMetadata({
  currency,
  customerName,
  customerPhone,
  discountAmount,
  fulfillmentStatus = "pending",
  items,
  orderId,
  orderSource,
  paymentMethod,
  shippingAmount,
  slug,
  subtotalAmount,
  totalAmount
}: {
  currency: string;
  customerName: string;
  customerPhone: string;
  discountAmount: number;
  fulfillmentStatus?: string;
  items: ReceiptEmailLineItem[];
  orderId: string;
  orderSource: "orders" | "store_orders";
  paymentMethod: string;
  shippingAmount: number;
  slug: string;
  subtotalAmount: number;
  totalAmount: number;
}) {
  const url = receiptUrl({
    orderId,
    orderSource,
    phone: customerPhone,
    slug
  });

  return {
    currency,
    customerName,
    discountAmount,
    fulfillmentStatus,
    orderDate: new Date().toISOString().slice(0, 10),
    orderId,
    orderReference: orderId.slice(0, 8).toUpperCase(),
    orderSource,
    orderUrl: url,
    paymentMethod,
    productsSummary: productSummaryForReceiptEmail(items),
    receiptUrl: url,
    shippingAmount,
    subtotalAmount,
    totalAmount
  };
}

type StoreStripeConnectionRow = {
  charges_enabled?: boolean | null;
  connection_status?: string | null;
  stripe_account_id?: string | null;
};

type StorePayPalConnectionRow = {
  connection_status?: string | null;
  paypal_merchant_id?: string | null;
  paypal_status?: string | null;
};

async function persistStorefrontOrderDraft({
  admin,
  cartSessionId,
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
  paymentMethod,
  coupon,
  discountAmount,
  subtotal,
  slug
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  cartSessionId?: string | null;
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
  paymentMethod: StorePaymentMethod;
  coupon: StoreCouponRow | null;
  discountAmount: number;
  subtotal: number;
  slug: string;
}) {
  const workspaceId = store.workspace_id;
  const resolvedStoreInstanceId = await resolveStoreInstanceId(admin, store);
  const orderStoreInstanceId = resolvedStoreInstanceId ?? store.id;
  const combinedNotes = [customerAddress, customerNotes].filter(Boolean).join("\n\n") || null;
  const orderNumber = generateDraftOrderNumber();
  const safeDiscountAmount = Math.min(subtotal, Math.max(0, Number(discountAmount.toFixed(2))));
  const discountedSubtotal = Number(Math.max(0, subtotal - safeDiscountAmount).toFixed(2));
  const total = financialBreakdown.totalAmount;
  const digitalSummary = digitalOrderSummary(items);
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
    store_instance_id: orderStoreInstanceId,
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
    payment_method: paymentMethod,
    payment_status: "pending",
    fulfillment_status: "pending",
    delivery_type: digitalSummary.deliveryType,
    has_digital_items: digitalSummary.hasDigitalItems,
    digital_delivery_status: digitalSummary.status,
    digital_delivery_metadata: {
      digitalItemCount: digitalSummary.digitalCount,
      source: "public_storefront"
    }
  };

  const extendedOrderPayload: Record<string, unknown> = {
    ...legacyOrderPayload,
    ...couponPayload,
    store_id: store.id,
    user_id: store.user_id,
    owner_user_id: store.owner_user_id ?? store.user_id,
    workspace_id: workspaceId,
    customer_address: customerAddress || null,
    payment_method: paymentMethod,
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
            "delivery_type",
            "digital_delivery_metadata",
            "digital_delivery_status",
            "fulfillment_status",
            "has_digital_items",
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
            "delivery_type",
            "digital_delivery_metadata",
            "digital_delivery_status",
            "fulfillment_status",
            "has_digital_items",
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
      ...(resolvedStoreInstanceId ? { store_instance_id: resolvedStoreInstanceId } : {}),
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
      product_type: item.product_type ?? "physical",
      digital_delivery_status: digitalDeliveryStatusForItem(item),
      digital_file_name: item.product_type === "digital" ? item.digital_file_name ?? null : null,
      product_title: item.product_title,
      product_image: item.product_image,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      currency: item.currency,
      unit_price: item.price,
      total_price: item.subtotal,
      ...(resolvedStoreInstanceId ? { store_instance_id: resolvedStoreInstanceId } : {})
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
          paymentMethod,
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
      await recordMonitoringEventSafe({
        entityId: orderRow.id,
        entityType: "order",
        eventType: "order.created",
        metadata: {
          itemCount: items.length,
          orderSource: "orders",
          paymentMethod,
          status: "draft",
          totalAmount: total
        },
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
        metadata: orderConfirmationEmailMetadata({
          currency,
          customerName,
          customerPhone,
          discountAmount: safeDiscountAmount,
          items,
          orderId: orderRow.id,
          orderSource: "orders",
          paymentMethod,
          shippingAmount: financialBreakdown.shippingAmount,
          slug,
          subtotalAmount: financialBreakdown.subtotalAmount,
          totalAmount: total
        }),
        recipient: customerEmail,
        storeId: store.id,
        templateKey: "order_confirmation",
        workspaceId
      });
      await markAbandonedCartRecoveredSafe({
        orderId: orderRow.id,
        sessionId: cartSessionId,
        storeId: store.id,
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
    digitalDeliveryStatus: digitalDeliveryStatusForItem(item),
    digitalFileName: item.product_type === "digital" ? item.digital_file_name ?? null : null,
    id: item.product_id,
    imageUrl: item.product_image,
    price: item.price,
    priceLabel: null,
    productType: item.product_type ?? "physical",
    requiresShipping: item.requires_shipping !== false,
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
    fulfillment_status: "pending",
    delivery_type: digitalSummary.deliveryType,
    has_digital_items: digitalSummary.hasDigitalItems,
    digital_delivery_status: digitalSummary.status,
    digital_delivery_metadata: {
      digitalItemCount: digitalSummary.digitalCount,
      source: "public_storefront"
    },
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
            "delivery_type",
            "digital_delivery_metadata",
            "digital_delivery_status",
            "fulfillment_status",
            "has_digital_items",
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
  await recordMonitoringEventSafe({
    entityId: storeOrderRow.id,
    entityType: "order",
    eventType: "order.created",
    metadata: {
      itemCount: items.length,
      orderSource: "store_orders",
      status: "draft",
      totalAmount: total
    },
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
    metadata: orderConfirmationEmailMetadata({
      currency,
      customerName,
      customerPhone,
      discountAmount: safeDiscountAmount,
      items,
      orderId: storeOrderRow.id,
      orderSource: "store_orders",
      paymentMethod: "manual",
      shippingAmount: financialBreakdown.shippingAmount,
      slug,
      subtotalAmount: financialBreakdown.subtotalAmount,
      totalAmount: total
    }),
    recipient: customerEmail,
    storeId: store.id,
    templateKey: "order_confirmation",
    workspaceId: workspaceId ?? store.owner_user_id ?? store.user_id
  });
  await markAbandonedCartRecoveredSafe({
    orderId: storeOrderRow.id,
    sessionId: cartSessionId,
    storeId: store.id,
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

async function redirectToStoreCardCheckout({
  admin,
  couponCode,
  customerAddress,
  customerEmail,
  customerName,
  customerNotes,
  customerPhone,
  currency,
  deliveryFee,
  deliveryMethod,
  financialBreakdown,
  items,
  shippingMethod,
  slug,
  store
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  couponCode: string;
  customerAddress: string;
  customerEmail: string;
  customerName: string;
  customerNotes: string;
  customerPhone: string;
  currency: string;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  financialBreakdown: CheckoutFinancialBreakdown;
  items: DraftLineItem[];
  shippingMethod: PublicShippingMethod | null;
  slug: string;
  store: {
    currency: string | null;
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    status: string;
    user_id: string;
    workspace_id: string | null;
  };
}) {
  const { data, error } = await admin
    .from("store_payment_provider_connections" as never)
    .select("stripe_account_id, connection_status, charges_enabled")
    .eq("store_id" as never, store.id as never)
    .eq("provider" as never, "stripe" as never)
    .maybeSingle();
  const connection = data as StoreStripeConnectionRow | null;
  const stripeAccountId = connection?.stripe_account_id?.trim();

  if (error || !stripeAccountId) {
    return "Card payment is not configured for this store yet.";
  }

  if (connection?.connection_status === "restricted" || connection?.charges_enabled === false) {
    return "This store's card payment account is restricted. The store owner must complete card payment onboarding.";
  }

  if (financialBreakdown.totalAmount <= 0) {
    return "Card payment requires a positive order total.";
  }

  let sessionUrl: string | null = null;

  try {
    const stripe = getStorePaymentsStripe();
    const orderReference = crypto.randomUUID();
    const appUrl = getAppBaseUrl();
    const lineItems = items.map((item) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          images: item.product_image ? [item.product_image] : undefined,
          metadata: {
            kind: "product",
            product_id: item.product_id,
            variant_id: item.variant_id ?? ""
          },
          name: item.product_title
        },
        unit_amount: stripeAmount(item.price)
      },
      quantity: item.quantity
    }));

    if (financialBreakdown.shippingAmount > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            images: undefined,
            metadata: { kind: "shipping", product_id: "", variant_id: "" },
            name: "Shipping"
          },
          unit_amount: stripeAmount(financialBreakdown.shippingAmount)
        },
        quantity: 1
      });
    }

    if (!financialBreakdown.pricesIncludeTax && financialBreakdown.taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            images: undefined,
            metadata: { kind: "tax", product_id: "", variant_id: "" },
            name: financialBreakdown.taxName ?? "Tax"
          },
          unit_amount: stripeAmount(financialBreakdown.taxAmount)
        },
        quantity: 1
      });
    }

    const discounts = financialBreakdown.discountAmount > 0
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                amount_off: stripeAmount(financialBreakdown.discountAmount),
                currency: currency.toLowerCase(),
                duration: "once",
                name: couponCode || "Store discount"
              }, { stripeAccount: stripeAccountId })
            ).id
          }
        ]
      : undefined;
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${appUrl}/store/${encodeURIComponent(slug)}/cart?checkout=card-cancelled`,
      customer_email: customerEmail || undefined,
      discounts,
      line_items: lineItems,
      metadata: {
        ...stripeSuccessMetadata({
          couponCode,
          customerAddress,
          customerEmail,
          customerName,
          customerNotes,
          customerPhone,
          deliveryFee,
          deliveryMethod,
          orderReference,
          shippingMethod,
          slug,
          store
        }),
        payment_method: "card",
        subtotal_amount: stripeMetadataValue(financialBreakdown.subtotalAmount),
        tax_amount: stripeMetadataValue(financialBreakdown.taxAmount),
        total_amount: stripeMetadataValue(financialBreakdown.totalAmount)
      },
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${appUrl}/api/store-payments/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}&account=${encodeURIComponent(stripeAccountId)}`,
      client_reference_id: orderReference
    }, { stripeAccount: stripeAccountId });

    if (!session.url) {
      return "Stripe checkout session failed. Please try again.";
    }

    sessionUrl = session.url;
  } catch (error) {
    console.error("[store-payments][stripe] checkout session failed", {
      message: error instanceof Error ? error.message : String(error),
      storeId: store.id
    });
    await recordMonitoringEventSafe({
      entityId: store.id,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_checkout_session_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error)
      },
      storeId: store.id,
      supabase: admin,
      workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
    });
    return "Stripe checkout session failed. Please try again.";
  }

  redirect(sessionUrl);
}

async function redirectToStorePayPalCheckout({
  admin,
  cartSessionId,
  coupon,
  customerAddress,
  customerEmail,
  customerName,
  customerNotes,
  customerPhone,
  currency,
  deliveryFee,
  deliveryMethod,
  discountAmount,
  financialBreakdown,
  items,
  shippingMethod,
  slug,
  store,
  subtotal
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  cartSessionId?: string | null;
  coupon: StoreCouponRow | null;
  customerAddress: string;
  customerEmail: string;
  customerName: string;
  customerNotes: string;
  customerPhone: string;
  currency: string;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  discountAmount: number;
  financialBreakdown: CheckoutFinancialBreakdown;
  items: DraftLineItem[];
  shippingMethod: PublicShippingMethod | null;
  slug: string;
  store: {
    currency: string | null;
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    status: string;
    user_id: string;
    workspace_id: string | null;
  };
  subtotal: number;
}) {
  const { data, error } = await admin
    .from("store_payment_provider_connections" as never)
    .select("paypal_merchant_id, connection_status, paypal_status")
    .eq("store_id" as never, store.id as never)
    .eq("provider" as never, "paypal" as never)
    .maybeSingle();
  const connection = data as StorePayPalConnectionRow | null;
  const merchantId = connection?.paypal_merchant_id?.trim();

  if (error || !merchantId || connection?.connection_status !== "connected") {
    return "PayPal is not connected for this store yet.";
  }

  if (connection.paypal_status === "restricted") {
    return "This store's PayPal account is restricted. The store owner must complete PayPal onboarding.";
  }

  if (financialBreakdown.totalAmount <= 0) {
    return "PayPal payment requires a positive order total.";
  }

  const persisted = await persistStorefrontOrderDraft({
    admin,
    cartSessionId,
    coupon,
    currency,
    customerAddress,
    customerEmail,
    customerName,
    customerNotes,
    customerPhone,
    deliveryFee,
    deliveryMethod,
    discountAmount,
    financialBreakdown,
    items,
    paymentMethod: "paypal",
    shippingMethod,
    slug,
    store,
    subtotal
  });

  if (!persisted) {
    return "Order draft could not be prepared before PayPal checkout. Please try again.";
  }

  let approvalUrl: string | null = null;

  try {
    const appUrl = getAppBaseUrl();
    const paypalOrder = await createPayPalCheckoutOrder({
      cancelUrl: `${appUrl}/store/${encodeURIComponent(slug)}/cart?checkout=paypal-cancelled&orderId=${encodeURIComponent(persisted.orderId)}&source=${persisted.table}`,
      currency,
      merchantId,
      orderId: persisted.orderId,
      returnUrl: `${appUrl}/api/store-payments/paypal/checkout/return?orderId=${encodeURIComponent(persisted.orderId)}&source=${persisted.table}&slug=${encodeURIComponent(slug)}`,
      total: financialBreakdown.totalAmount
    });

    approvalUrl = paypalOrder.approvalUrl;

    if (!approvalUrl) {
      return "PayPal approval link could not be created. Please try again.";
    }

    await recordMonitoringEventSafe({
      entityId: persisted.orderId,
      entityType: "order",
      eventType: "paypal_checkout_order_created",
      metadata: {
        merchant_id: merchantId,
        paypal_order_id: paypalOrder.id,
        paypal_status: paypalOrder.status,
        totalAmount: financialBreakdown.totalAmount
      },
      storeId: store.id,
      supabase: admin,
      workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
    });
  } catch (error) {
    console.error("[store-payments][paypal] checkout order failed", {
      message: error instanceof Error ? error.message : String(error),
      storeId: store.id
    });
    await recordMonitoringEventSafe({
      entityId: store.id,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "paypal_checkout_order_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error)
      },
      storeId: store.id,
      supabase: admin,
      workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
    });
    return "PayPal checkout could not be started. Please try again.";
  }

  redirect(approvalUrl);
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
  const cartSessionId = cleanText(formData.get("cartSessionId"), 180);
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

  const billingLimitError = await validateOrderMonthlyLimitSafe({
    admin,
    ownerUserId: store.owner_user_id ?? store.user_id,
    storeId: store.id,
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });

  if (billingLimitError) {
    return { error: billingLimitError, message: null, ok: false, orderId: null };
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
        digitalDeliveryEnabled: product.digitalDeliveryEnabled,
        digitalFileName: product.digitalFileName,
        id: product.id,
        imageUrl: product.imageUrl,
        price: unitPrice,
        priceLabel: product.priceLabel,
        productType: product.productType,
        requiresShipping: product.requiresShipping,
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
  const digitalSummary = digitalOrderSummary(
    items.map((item) => ({
      currency: preview.store.currency ?? "USD",
      digital_delivery_enabled: item.digitalDeliveryEnabled,
      digital_file_name: item.digitalFileName,
      product_id: item.id,
      product_image: item.imageUrl,
      product_title: item.title,
      product_type: item.productType,
      quantity: item.quantity,
      price: item.price,
      requires_shipping: item.requiresShipping,
      subtotal: item.total,
      variant_id: item.variant_id,
      variant_name: item.variant_name,
      variant_options: item.variant_options,
      variant_sku: item.variant_sku
    }))
  );
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
  const shippingMethod = requestedShippingMethodId && digitalSummary.hasPhysicalShippingItems
    ? await getPublicShippingMethodForStore({
        methodId: requestedShippingMethodId,
        storeId: store.id
      })
    : null;

  if (requestedShippingMethodId && digitalSummary.hasPhysicalShippingItems && !shippingMethod) {
    return {
      error: "Selected shipping method is no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const deliveryFee = digitalSummary.hasPhysicalShippingItems && shippingMethod
    ? matchPublicShippingRate({
      addressText: customerAddress,
      method: shippingMethod,
      subtotalAmount: Math.max(0, subtotal - discountAmount),
      totalWeight: null
    }).shippingAmount
    : 0;
  const shippingRateMatch = digitalSummary.hasPhysicalShippingItems && shippingMethod
    ? matchPublicShippingRate({
      addressText: customerAddress,
      method: shippingMethod,
      subtotalAmount: Math.max(0, subtotal - discountAmount),
      totalWeight: null
    })
    : null;

  if (shippingRateMatch?.unavailable) {
    return {
      error: shippingRateMatch.message ?? "Shipping is not available for this address.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const deliveryMethod =
    digitalSummary.hasPhysicalShippingItems && shippingMethod ? deliveryMethodForShippingMethod(shippingMethod) : "none";
  const financialBreakdown = await calculatePublicCheckoutFinancialsForStore({
    customerAddress,
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
      delivery_type: digitalSummary.deliveryType,
      has_digital_items: digitalSummary.hasDigitalItems,
      digital_delivery_status: digitalSummary.status,
      digital_delivery_metadata: {
        digitalItemCount: digitalSummary.digitalCount,
        source: "public_storefront"
      },
      shipping_method_id: shippingMethod?.id ?? null,
      shipping_method_name: shippingMethod?.name ?? null,
      shipping_method_type: shippingMethod?.type ?? null,
      shipping_rate_id: shippingRateMatch?.rate?.id ?? null,
      shipping_rate_name: shippingRateMatch?.rate?.name ?? null,
      shipping_rate_type: shippingRateMatch?.rate?.type ?? null,
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
    metadata: orderConfirmationEmailMetadata({
      currency: preview.store.currency ?? "USD",
      customerName,
      customerPhone,
      discountAmount,
      items,
      orderId: (order as { id: string }).id,
      orderSource: "store_orders",
      paymentMethod: "whatsapp",
      shippingAmount: financialBreakdown.shippingAmount,
      slug,
      subtotalAmount: financialBreakdown.subtotalAmount,
      totalAmount: total
    }),
    recipient: customerEmail,
    storeId: store.id,
    templateKey: "order_confirmation",
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });
  await markAbandonedCartRecoveredSafe({
    orderId: (order as { id: string }).id,
    sessionId: cartSessionId,
    storeId: store.id,
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });
  await recordMonitoringEventSafe({
    entityId: (order as { id: string }).id,
    entityType: "order",
    eventType: "order.created",
    metadata: {
      itemCount: items.length,
      orderSource: "store_orders",
      status: "pending",
      totalAmount: total
    },
    storeId: store.id,
    supabase: admin,
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
  const cartSessionId = cleanText(formData.get("cartSessionId"), 180);
  const couponCode = cleanText(formData.get("couponCode"), 80);
  const requestedDeliveryMethod = parseDeliveryMethod(formData.get("deliveryMethod"));
  const requestedPaymentMethod = parsePublicStorePaymentMethod(formData.get("paymentMethod"));
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

  if (!requestedPaymentMethod) {
    return { error: "Choose a payment method before submitting your order.", message: null, ok: false, orderId: null };
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

  const enabledPaymentMethods = await getEnabledPublicStorePaymentMethods(admin, store.id);

  const selectedPaymentMethod = enabledPaymentMethods.find((method) => method.method === requestedPaymentMethod);

  if (!selectedPaymentMethod) {
    return {
      error: "Selected payment method is no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const billingLimitError = await validateOrderMonthlyLimitSafe({
    admin,
    ownerUserId: store.owner_user_id ?? store.user_id,
    storeId: store.id,
    workspaceId: store.workspace_id ?? store.owner_user_id ?? store.user_id
  });

  if (billingLimitError) {
    return { error: billingLimitError, message: null, ok: false, orderId: null };
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
        digital_delivery_enabled: product.digitalDeliveryEnabled,
        digital_file_name: product.digitalFileName,
        product_id: product.id,
        product_image: product.imageUrl,
        product_title: product.title,
        product_type: product.productType,
        quantity,
        price: unitPrice,
        requires_shipping: product.requiresShipping,
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
  const digitalSummary = digitalOrderSummary(items);
  const shippingMethod = requestedShippingMethodId && digitalSummary.hasPhysicalShippingItems
    ? await getPublicShippingMethodForStore({
        methodId: requestedShippingMethodId,
        storeId: store.id
      })
    : null;

  if (requestedShippingMethodId && digitalSummary.hasPhysicalShippingItems && !shippingMethod) {
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
    : digitalSummary.hasPhysicalShippingItems
      ? resolveDeliverySelection({
        requestedMethod: requestedDeliveryMethod,
        storeDeliveryEnabled: preview.store.deliveryEnabled,
        storeDeliveryFee: preview.store.deliveryFee,
        storePickupEnabled: preview.store.pickupEnabled
      })
      : {
          deliveryFee: 0,
          deliveryMethod: "none" as const,
          error: null
        };

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
    customerAddress,
    discountAmount: couponResult?.ok ? couponResult.discountAmount : 0,
    shippingAmount: deliverySelection.deliveryFee,
    storeId: store.id,
    subtotalAmount: subtotal
  });

  if (selectedPaymentMethod.method === "card") {
    const cardCheckoutError = await redirectToStoreCardCheckout({
      admin,
      couponCode,
      customerAddress,
      customerEmail,
      customerName,
      customerNotes,
      customerPhone,
      currency,
      deliveryFee: deliverySelection.deliveryFee,
      deliveryMethod: deliverySelection.deliveryMethod,
      financialBreakdown,
      items,
      shippingMethod,
      slug,
      store
    });

    return {
      error: cardCheckoutError,
      message: null,
      ok: false,
      orderId: null
    };
  }

  if (selectedPaymentMethod.method === "paypal") {
    const paypalCheckoutError = await redirectToStorePayPalCheckout({
      admin,
    cartSessionId,
      coupon: couponResult?.ok ? couponResult.coupon : null,
      customerAddress,
      customerEmail,
      customerName,
      customerNotes,
      customerPhone,
      currency,
      deliveryFee: deliverySelection.deliveryFee,
      deliveryMethod: deliverySelection.deliveryMethod,
      discountAmount: couponResult?.ok ? couponResult.discountAmount : 0,
      financialBreakdown,
      items,
      shippingMethod,
      slug,
      store,
      subtotal
    });

    return {
      error: paypalCheckoutError,
      message: null,
      ok: false,
      orderId: null
    };
  }

  const persisted = await persistStorefrontOrderDraft({
    admin,
    cartSessionId,
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
    paymentMethod: selectedPaymentMethod.provider_internal ?? internalStorePaymentMethod(selectedPaymentMethod.method),
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
    await recordMonitoringEventSafe({
      entityId: orderId,
      entityType: "order",
      eventType: "order.updated",
      metadata: {
        newStatus: status,
        orderSource: source,
        previousStatus: currentOrderRow.order_status
      },
      storeId: eventStoreId,
      supabase,
      userId: user.id,
      workspaceId
    });
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
    await recordWorkspaceActivitySafe({
      action: "order_status_changed",
      actorEmail: user.email,
      actorUserId: user.id,
      entityId: orderId,
      entityType: "order",
      metadata: {
        newStatus: status,
        orderSource: source,
        previousStatus: currentOrderRow.order_status
      },
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

export async function updateStoreOrderShippingTrackingAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const source = cleanText(formData.get("source"), 40) as StoreOrderStatusSource;
  const returnTo = safeOrderReturnPath(formData.get("returnTo"));
  const carrierName = cleanText(formData.get("carrierName"), 120);
  const trackingNumber = cleanText(formData.get("trackingNumber"), 160);
  const rawTrackingUrl = cleanText(formData.get("trackingUrl"), 500);
  const trackingUrl = cleanOptionalUrl(formData.get("trackingUrl"));
  const deliveryNotes = cleanText(formData.get("deliveryNotes"), 1000);
  const proofOfDelivery = cleanText(formData.get("proofOfDelivery"), 1000);

  if (!orderId) {
    orderStatusReturnRedirect(returnTo, "missing-order");
  }

  if (source !== "orders" && source !== "store_orders") {
    orderStatusReturnRedirect(returnTo, "invalid-shipping", orderId);
  }

  if (rawTrackingUrl && !trackingUrl) {
    orderStatusReturnRedirect(returnTo, "invalid-shipping", orderId);
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
    .select(
      "id, store_id, store_instance_id, workspace_id, fulfillment_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at, delivery_notes, proof_of_delivery"
    )
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const currentOrderRow = currentOrder as {
    carrier_name?: string | null;
    delivered_at?: string | null;
    delivery_notes?: string | null;
    fulfillment_status?: string | null;
    id: string;
    proof_of_delivery?: string | null;
    shipped_at?: string | null;
    store_id?: string | null;
    store_instance_id?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    workspace_id?: string | null;
  } | null;

  if (currentError) {
    logSupabaseDiagnostic(
      "order_shipping_tracking.lookup.failed",
      {
        orderId,
        source,
        tableName,
        workspaceId
      },
      currentError
    );
    orderStatusReturnRedirect(returnTo, "shipping-failed", orderId);
  }

  if (!currentOrderRow) {
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  if (!canEditShippingTracking(currentOrderRow.fulfillment_status)) {
    orderStatusReturnRedirect(returnTo, "invalid-shipping", orderId);
  }

  const normalizedTracking = {
    carrier_name: carrierName || null,
    delivery_notes: deliveryNotes || null,
    proof_of_delivery: proofOfDelivery || null,
    tracking_number: trackingNumber || null,
    tracking_url: trackingUrl || null
  };
  const changedFields = Object.entries(normalizedTracking)
    .filter(([key, value]) => (currentOrderRow[key as keyof typeof currentOrderRow] ?? null) !== value)
    .map(([key]) => key);
  const now = new Date().toISOString();
  const updatePayload: Record<string, string | null> = {
    ...normalizedTracking,
    updated_at: now
  };
  const fulfillmentStatus = normalizeFulfillmentStatus(currentOrderRow.fulfillment_status);

  if ((fulfillmentStatus === "shipped" || fulfillmentStatus === "out_for_delivery" || fulfillmentStatus === "delivered") && !currentOrderRow.shipped_at) {
    updatePayload.shipped_at = now;
    changedFields.push("shipped_at");
  }

  if (fulfillmentStatus === "delivered" && !currentOrderRow.delivered_at) {
    updatePayload.delivered_at = now;
    changedFields.push("delivered_at");
  }

  const { data, error } = await supabase
    .from(tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .select("id")
    .maybeSingle();

  if (error) {
    logSupabaseDiagnostic(
      "order_shipping_tracking.update.failed",
      {
        changedFields,
        orderId,
        source,
        tableName,
        workspaceId
      },
      error
    );
    orderStatusReturnRedirect(returnTo, "shipping-failed", orderId);
  }

  if (!data) {
    orderStatusReturnRedirect(returnTo, "not-authorized", orderId);
  }

  const eventStoreId = currentOrderRow.store_id ?? currentOrderRow.store_instance_id;

  if (eventStoreId && changedFields.length) {
    await recordOrderEventSafe({
      actorUserId: user.id,
      eventType: "shipping_tracking_updated",
      message: "Shipping tracking information updated.",
      metadata: {
        changedFields,
        hasCarrierName: Boolean(carrierName),
        hasDeliveryNotes: Boolean(deliveryNotes),
        hasProofOfDelivery: Boolean(proofOfDelivery),
        hasTrackingNumber: Boolean(trackingNumber),
        hasTrackingUrl: Boolean(trackingUrl)
      },
      newValue: trackingNumber || trackingUrl || carrierName || "shipping_tracking_updated",
      orderId,
      orderSource: source,
      previousValue: currentOrderRow.tracking_number ?? currentOrderRow.tracking_url ?? currentOrderRow.carrier_name ?? null,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
  }

  revalidatePath(dashboardOrdersPath);
  revalidatePath(returnTo);
  revalidatePath("/dashboard");
  orderStatusReturnRedirect(returnTo, "shipping-updated", orderId);
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
  const currentFulfillmentStatus = normalizeFulfillmentStatus(currentOrderRow.fulfillment_status);

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

  if (
    (currentOrderRow.order_status === "cancelled" || currentOrderRow.order_status === "canceled") &&
    fulfillmentStatus !== "cancelled" &&
    fulfillmentStatus !== "returned" &&
    fulfillmentStatus !== "refunded"
  ) {
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

  if (!isFulfillmentTransitionAllowed(currentFulfillmentStatus, fulfillmentStatus)) {
    logSupabaseDiagnostic("order_fulfillment.validation.blocked_invalid_transition", {
      currentFulfillmentStatus,
      fulfillmentStatus,
      orderId,
      orderStatus: currentOrderRow.order_status,
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
  const timestampColumns = fulfillmentTimestampColumns[fulfillmentStatus] ?? [];

  for (const timestampColumn of timestampColumns) {
    if (source === "orders" && timestampColumn === "fulfilled_at") {
      continue;
    }

    updatePayload[timestampColumn] = now;
  }

  if (source === "store_orders") {
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
        timestampColumns
      },
      newValue: fulfillmentStatus,
      orderId,
      orderSource: source,
      previousValue: currentFulfillmentStatus,
      storeId: eventStoreId,
      supabase,
      workspaceId
    });
    await recordWorkspaceActivitySafe({
      action: "order_status_changed",
      actorEmail: user.email,
      actorUserId: user.id,
      entityId: orderId,
      entityType: "order",
      metadata: {
        newStatus: fulfillmentStatus,
        orderSource: source,
        previousStatus: currentFulfillmentStatus,
        statusType: "fulfillment"
      },
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
  return updateStoreOrderFulfillmentStatusAction(withFulfillmentStatus(formData, "delivered"));
}
