import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { getStorePaymentsStripe } from "@/lib/store-payment-provider-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignLicenseKeysForOrder } from "@/lib/digital-license-keys";
import { maskGiftCardCode, redeemStoreGiftCard, type StoreGiftCardRow } from "@/lib/store-gift-cards";
import { normalizeReferralCode, recordReferralForOrder } from "@/lib/customer-referrals";
import { normalizeAffiliateCode, recordAffiliateOrderForCheckout } from "@/lib/store-affiliates";
import type { Json } from "@/types/database";

function dashboardErrorUrl(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/dashboard/payments?payments=${status}`, request.url));
}

function cleanMetadata(metadata: Stripe.Metadata | null | undefined, key: string) {
  return metadata?.[key]?.trim() ?? "";
}

function moneyFromCents(value: number | null | undefined) {
  return Number(((value ?? 0) / 100).toFixed(2));
}

function numberMetadata(metadata: Stripe.Metadata | null | undefined, key: string) {
  const value = Number(cleanMetadata(metadata, key));

  return Number.isFinite(value) ? value : 0;
}

function productFromLineItem(item: Stripe.LineItem) {
  const price = item.price;
  const product = price?.product && typeof price.product === "object"
    ? price.product as Stripe.Product
    : null;
  const metadata = product?.metadata ?? {};

  if (metadata.kind && metadata.kind !== "product") {
    return null;
  }

  const quantity = item.quantity ?? 1;
  const subtotal = moneyFromCents(item.amount_subtotal);

  return {
    id: metadata.product_id || item.id,
    imageUrl: product?.images?.[0] ?? null,
    price: quantity > 0 ? Number((subtotal / quantity).toFixed(2)) : subtotal,
    quantity,
    title: item.description ?? product?.name ?? "Product",
    total: subtotal,
    variant_id: metadata.variant_id || null
  };
}

async function digitalProductsById(admin: NonNullable<ReturnType<typeof createAdminClient>>, storeId: string, productIds: string[]) {
  if (!productIds.length) {
    return new Map<string, { digital_file_name?: string | null; id: string; product_type?: string | null }>();
  }

  const { data } = await admin
    .from("store_products" as never)
    .select("id, product_type, digital_file_name")
    .eq("store_id" as never, storeId as never)
    .in("id" as never, Array.from(new Set(productIds)) as never);

  return new Map(
    ((data ?? []) as unknown as Array<{ digital_file_name?: string | null; id: string; product_type?: string | null }>)
      .map((product) => [product.id, product])
  );
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim() ?? "";
  const stripeAccountId = request.nextUrl.searchParams.get("account")?.trim() ?? "";

  if (!sessionId || !stripeAccountId) {
    return dashboardErrorUrl(request, "stripe-checkout-invalid-return");
  }

  const admin = createAdminClient();

  if (!admin) {
    return dashboardErrorUrl(request, "stripe-checkout-not-configured");
  }

  try {
    const stripe = getStorePaymentsStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {}, {
      stripeAccount: stripeAccountId
    });
    const metadata = session.metadata ?? {};
    const slug = cleanMetadata(metadata, "slug");
    const storeId = cleanMetadata(metadata, "store_id");
    const orderReference = session.client_reference_id || cleanMetadata(metadata, "order_reference");

    if (!slug || !storeId || !orderReference) {
      throw new Error("Stripe checkout session metadata is incomplete.");
    }

    const existing = await admin
      .from("store_orders" as never)
      .select("id")
      .eq("id" as never, orderReference as never)
      .maybeSingle();

    if (existing.data) {
      return NextResponse.redirect(new URL(`/store/${encodeURIComponent(slug)}/order/${orderReference}?source=store_orders`, request.url));
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      expand: ["data.price.product"],
      limit: 100
    }, {
      stripeAccount: stripeAccountId
    });
    const items = lineItems.data
      .map(productFromLineItem)
      .filter((item): item is NonNullable<ReturnType<typeof productFromLineItem>> => Boolean(item));

    if (!items.length) {
      throw new Error("Stripe checkout session did not include product line items.");
    }

    const productsById = await digitalProductsById(admin, storeId, items.map((item) => item.id));
    const enrichedItems = items.map((item) => {
      const product = productsById.get(item.id);
      const isDigital = product?.product_type === "digital";

      return {
        ...item,
        digitalDeliveryStatus: isDigital ? "pending" : "none",
        digitalFileName: isDigital ? product?.digital_file_name ?? null : null,
        productType: isDigital ? "digital" : "physical",
        requiresShipping: !isDigital
      };
    });
    const digitalItemCount = enrichedItems.filter((item) => item.productType === "digital").length;
    const physicalItemCount = enrichedItems.length - digitalItemCount;
    const deliveryType = digitalItemCount && physicalItemCount ? "mixed" : digitalItemCount ? "digital" : "physical";
    const total = moneyFromCents(session.amount_total);
    const subtotalAmount = numberMetadata(metadata, "subtotal_amount") || moneyFromCents(session.amount_subtotal);
    const shippingAmount = numberMetadata(metadata, "delivery_fee");
    const taxAmount = numberMetadata(metadata, "tax_amount");
    const giftCardAmount = numberMetadata(metadata, "gift_card_amount");
    const giftCardId = cleanMetadata(metadata, "gift_card_id");
    const affiliateCode = normalizeAffiliateCode(cleanMetadata(metadata, "affiliate_code"));
    const referralCode = normalizeReferralCode(cleanMetadata(metadata, "referral_code"));
    const nowStatus = session.payment_status === "paid" ? "paid" : "pending_confirmation";
    const { data: giftCardRow } = giftCardId
      ? await admin
          .from("store_gift_cards" as never)
          .select("id, workspace_id, store_id, code, initial_balance, remaining_balance, currency, status, expires_at")
          .eq("id" as never, giftCardId as never)
          .eq("store_id" as never, storeId as never)
          .maybeSingle()
      : { data: null };
    const giftCard = giftCardRow as StoreGiftCardRow | null;
    const { data: inserted, error } = await admin
      .from("store_orders" as never)
      .insert({
        coupon_code: cleanMetadata(metadata, "coupon_code") || null,
        customer_address: cleanMetadata(metadata, "customer_address") || null,
        customer_email: session.customer_details?.email ?? (cleanMetadata(metadata, "customer_email") || null),
        customer_name: session.customer_details?.name ?? (cleanMetadata(metadata, "customer_name") || "Card customer"),
        customer_phone: session.customer_details?.phone ?? (cleanMetadata(metadata, "customer_phone") || "card-payment"),
        delivery_fee: shippingAmount,
        delivery_method: cleanMetadata(metadata, "delivery_method") || "none",
        discount_amount: Math.max(0, subtotalAmount + shippingAmount + taxAmount - total),
        delivery_type: deliveryType,
        digital_delivery_metadata: {
          digitalItemCount,
          source: "stripe_checkout"
        },
        digital_delivery_status: digitalItemCount ? "pending" : "none",
        fulfillment_status: "unfulfilled",
        gift_card_amount: giftCardAmount,
        gift_card_code: giftCard ? maskGiftCardCode(giftCard.code) : null,
        gift_card_id: giftCard ? giftCard.id : null,
        has_digital_items: digitalItemCount > 0,
        id: orderReference,
        items: enrichedItems as Json,
        order_status: nowStatus === "paid" ? "confirmed" : "pending",
        owner_user_id: cleanMetadata(metadata, "owner_user_id") || null,
        payment_method: "card",
        payment_status: nowStatus,
        affiliate_code: affiliateCode || null,
        referral_code: referralCode || null,
        shipping_amount: shippingAmount,
        shipping_method_id: cleanMetadata(metadata, "shipping_method_id") || null,
        shipping_method_name: cleanMetadata(metadata, "shipping_method_name") || null,
        shipping_method_type: cleanMetadata(metadata, "shipping_method_type") || null,
        store_id: storeId,
        subtotal: subtotalAmount,
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total,
        total_amount: total,
        user_id: cleanMetadata(metadata, "user_id") || null,
        workspace_id: cleanMetadata(metadata, "workspace_id") || null
      } as never)
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(error?.message ?? "Stripe paid order could not be saved.");
    }

    if (
      nowStatus === "paid" &&
      giftCard &&
      giftCardAmount > 0 &&
      !(await redeemStoreGiftCard(admin, {
        amount: giftCardAmount,
        giftCard,
        orderId: orderReference,
        orderSource: "store_orders"
      }))
    ) {
      throw new Error("Stripe paid order gift card could not be redeemed.");
    }

    const referralId = await recordReferralForOrder(admin, {
      customerEmail: session.customer_details?.email ?? (cleanMetadata(metadata, "customer_email") || null),
      customerName: session.customer_details?.name ?? (cleanMetadata(metadata, "customer_name") || "Card customer"),
      customerPhone: session.customer_details?.phone ?? (cleanMetadata(metadata, "customer_phone") || "card-payment"),
      orderId: orderReference,
      orderSource: "store_orders",
      referralCode,
      storeId,
      workspaceId: cleanMetadata(metadata, "workspace_id") || null
    });

    if (referralId) {
      await admin
        .from("store_orders" as never)
        .update({ referral_id: referralId, referral_code: referralCode } as never)
        .eq("id" as never, orderReference as never);
    }

    const affiliateOrder = await recordAffiliateOrderForCheckout(admin, {
      affiliateCode,
      orderId: orderReference,
      orderSource: "store_orders",
      orderTotal: total,
      storeId,
      workspaceId: cleanMetadata(metadata, "workspace_id") || null
    });

    if (affiliateOrder) {
      await admin
        .from("store_orders" as never)
        .update({ affiliate_id: affiliateOrder.affiliateId, affiliate_code: affiliateCode } as never)
        .eq("id" as never, orderReference as never);
    }

    await assignLicenseKeysForOrder({
      customerEmail: session.customer_details?.email ?? (cleanMetadata(metadata, "customer_email") || null),
      items: enrichedItems.map((item) => ({ product_id: item.id })),
      orderId: orderReference,
      orderSource: "store_orders",
      storeId,
      supabase: admin,
      workspaceId: cleanMetadata(metadata, "workspace_id") || null
    });

    await recordMonitoringEventSafe({
      entityId: orderReference,
      entityType: "order",
      eventType: "order.created",
      metadata: {
        orderSource: "store_orders",
        paymentMethod: "card",
        paymentStatus: nowStatus,
        stripeAccountId,
        stripeSessionId: sessionId,
        totalAmount: total
      },
      storeId,
      supabase: admin,
      workspaceId: cleanMetadata(metadata, "workspace_id") || null
    });

    return NextResponse.redirect(new URL(`/store/${encodeURIComponent(slug)}/order/${orderReference}?source=store_orders`, request.url));
  } catch (error) {
    console.error("[store-payments][stripe] checkout success failed", {
      message: error instanceof Error ? error.message : String(error),
      sessionId,
      stripeAccountId
    });
    await recordMonitoringEventSafe({
      entityId: sessionId,
      entityType: "store_payment_provider",
      eventStatus: "failed",
      eventType: "stripe_checkout_success_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error),
        stripe_account_id: stripeAccountId
      },
      supabase: admin
    });
    return dashboardErrorUrl(request, "stripe-checkout-success-failed");
  }
}
