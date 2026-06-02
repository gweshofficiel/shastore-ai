import { NextRequest, NextResponse } from "next/server";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { capturePayPalCheckoutOrder } from "@/lib/store-payment-provider-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignLicenseKeysForOrder } from "@/lib/digital-license-keys";
import { redeemStoreGiftCard, type StoreGiftCardRow } from "@/lib/store-gift-cards";

type OrderSource = "orders" | "store_orders";

function orderSource(value: string | null): OrderSource {
  return value === "orders" ? "orders" : "store_orders";
}

function checkoutRedirect(request: NextRequest, slug: string, orderId: string, source: OrderSource, status: string) {
  return NextResponse.redirect(
    new URL(
      `/store/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}?source=${source}&payment=${encodeURIComponent(status)}`,
      request.url
    )
  );
}

function cartRedirect(request: NextRequest, slug: string, status: string) {
  return NextResponse.redirect(
    new URL(`/store/${encodeURIComponent(slug)}/cart?checkout=${encodeURIComponent(status)}`, request.url)
  );
}

function captureOrderId(capture: Awaited<ReturnType<typeof capturePayPalCheckoutOrder>>) {
  const purchaseUnit = capture.purchase_units?.[0];

  return purchaseUnit?.custom_id || purchaseUnit?.reference_id || "";
}

function captureId(capture: Awaited<ReturnType<typeof capturePayPalCheckoutOrder>>) {
  return capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}

function captureStatus(capture: Awaited<ReturnType<typeof capturePayPalCheckoutOrder>>) {
  return capture.purchase_units?.[0]?.payments?.captures?.[0]?.status || capture.status || "UNKNOWN";
}

export async function GET(request: NextRequest) {
  const paypalOrderId = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const requestedOrderId = request.nextUrl.searchParams.get("orderId")?.trim() ?? "";
  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
  const source = orderSource(request.nextUrl.searchParams.get("source"));

  if (!paypalOrderId || !requestedOrderId || !slug) {
    return cartRedirect(request, slug || "", "paypal-invalid-return");
  }

  const admin = createAdminClient();

  if (!admin) {
    return cartRedirect(request, slug, "paypal-not-configured");
  }

  try {
    const capture = await capturePayPalCheckoutOrder(paypalOrderId);
    const capturedOrderId = captureOrderId(capture);

    if (capturedOrderId && capturedOrderId !== requestedOrderId) {
      throw new Error("PayPal order reference did not match the storefront order.");
    }

    const paid = captureStatus(capture) === "COMPLETED";
    const orderUpdate = admin
      .from(source as never)
      .update({
        order_status: paid ? "confirmed" : "pending",
        payment_status: paid ? "paid" : "pending_confirmation",
        updated_at: new Date().toISOString()
      } as never)
      .eq("id" as never, requestedOrderId as never);
    const { data: orderRow, error: orderError } = source === "store_orders"
      ? await orderUpdate.select("id, store_id, workspace_id, user_id, owner_user_id, customer_email, gift_card_id, gift_card_amount, items, total").single()
      : await orderUpdate.select("id, store_id, workspace_id, user_id, owner_user_id, customer_email, gift_card_id, gift_card_amount, total").single();

    if (orderError || !orderRow) {
      throw new Error(orderError?.message ?? "PayPal paid order could not be updated.");
    }

    const order = orderRow as {
      id: string;
      customer_email?: string | null;
      items?: unknown;
      gift_card_amount?: number | string | null;
      gift_card_id?: string | null;
      owner_user_id?: string | null;
      store_id?: string | null;
      total?: number | null;
      user_id?: string | null;
      workspace_id?: string | null;
    };

    if (paid && order.store_id) {
      const giftCardAmount = Number(order.gift_card_amount ?? 0);

      if (order.gift_card_id && giftCardAmount > 0) {
        const { data: giftCardRow } = await admin
          .from("store_gift_cards" as never)
          .select("id, workspace_id, store_id, code, initial_balance, remaining_balance, currency, status, expires_at")
          .eq("id" as never, order.gift_card_id as never)
          .eq("store_id" as never, order.store_id as never)
          .maybeSingle();
        const giftCard = giftCardRow as StoreGiftCardRow | null;

        if (
          giftCard &&
          !(await redeemStoreGiftCard(admin, {
            amount: giftCardAmount,
            giftCard,
            orderId: requestedOrderId,
            orderSource: source
          }))
        ) {
          throw new Error("PayPal paid order gift card could not be redeemed.");
        }
      }

      const orderItems =
        source === "orders"
          ? await admin
              .from("order_items" as never)
              .select("product_id")
              .eq("order_id" as never, requestedOrderId as never)
          : { data: Array.isArray(order.items) ? order.items : [] };

      await assignLicenseKeysForOrder({
        customerEmail: order.customer_email ?? null,
        items: (orderItems.data ?? []) as Array<{ product_id?: string | null; productId?: string | null }>,
        orderId: requestedOrderId,
        orderSource: source,
        storeId: order.store_id,
        supabase: admin,
        workspaceId: order.workspace_id ?? order.owner_user_id ?? order.user_id ?? null
      });
    }

    await recordMonitoringEventSafe({
      entityId: requestedOrderId,
      entityType: "order",
      eventType: paid ? "paypal_payment_captured" : "paypal_payment_pending",
      metadata: {
        capture_id: captureId(capture),
        orderSource: source,
        paymentMethod: "paypal",
        paymentStatus: paid ? "paid" : "pending_confirmation",
        paypal_order_id: paypalOrderId,
        paypal_status: captureStatus(capture),
        totalAmount: order.total ?? null
      },
      storeId: order.store_id ?? null,
      supabase: admin,
      workspaceId: order.workspace_id ?? order.owner_user_id ?? order.user_id ?? null
    });

    return checkoutRedirect(request, slug, requestedOrderId, source, paid ? "paypal-paid" : "paypal-pending");
  } catch (error) {
    console.error("[store-payments][paypal] checkout return failed", {
      message: error instanceof Error ? error.message : String(error),
      orderId: requestedOrderId,
      paypalOrderId
    });
    await recordMonitoringEventSafe({
      entityId: requestedOrderId,
      entityType: "order",
      eventStatus: "failed",
      eventType: "paypal_checkout_return_failed",
      metadata: {
        error_message: error instanceof Error ? error.message : String(error),
        paypal_order_id: paypalOrderId
      },
      supabase: admin
    });
    return cartRedirect(request, slug, "paypal-checkout-failed");
  }
}
