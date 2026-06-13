import { NextResponse } from "next/server";
import {
  syncNowPaymentsPlatformPayment,
  verifyNowPaymentsIpnSignature
} from "@/lib/billing/nowpayments";
import { recordWebhookEvent } from "@/lib/integrations/webhook-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  console.info("[nowpayments_ipn_received]", {
    bodyLength: rawBody.length,
    hasSignature: Boolean(signature)
  });
  await recordWebhookEvent({
    eventType: "nowpayments.ipn",
    httpStatus: null,
    providerKey: "nowpayments",
    safePayloadSummary: {
      bodyLength: rawBody.length,
      hasSignature: Boolean(signature)
    },
    status: "received",
    webhookType: "nowpayments_ipn"
  });

  if (!verifyNowPaymentsIpnSignature(rawBody, signature)) {
    console.error("[nowpayments-platform] invalid IPN signature", {
      hasSignature: Boolean(signature)
    });
    await recordWebhookEvent({
      errorCode: "invalid_signature",
      errorMessage: "Invalid NOWPayments signature.",
      eventType: "nowpayments.ipn",
      httpStatus: 400,
      providerKey: "nowpayments",
      safePayloadSummary: {
        bodyLength: rawBody.length,
        hasSignature: Boolean(signature)
      },
      status: "failed",
      webhookType: "nowpayments_ipn"
    });
    return NextResponse.json({ error: "Invalid NOWPayments signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as Parameters<typeof syncNowPaymentsPlatformPayment>[0];

    console.info("[nowpayments_ipn_verified]", {
      orderId: payload.order_id ?? null,
      paymentId: payload.payment_id ?? null,
      paymentStatus: payload.payment_status ?? null
    });

    const result = await syncNowPaymentsPlatformPayment(payload);
    await recordWebhookEvent({
      eventType: `nowpayments.payment.${payload.payment_status ?? "unknown"}`,
      httpStatus: 200,
      providerKey: "nowpayments",
      relatedEntityId: String(payload.payment_id ?? payload.invoice_id ?? payload.order_id ?? ""),
      relatedEntityType: "nowpayments_payment",
      safePayloadSummary: {
        activated: result.activated,
        invoiceId: payload.invoice_id ?? null,
        orderId: payload.order_id ?? null,
        paymentId: payload.payment_id ?? null,
        paymentStatus: payload.payment_status ?? null,
        reason: result.reason
      },
      status: result.activated ? "processed" : "ignored",
      webhookType: "nowpayments_ipn"
    });
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[nowpayments_plan_activation_failed]", {
      message: error instanceof Error ? error.message : String(error)
    });
    await recordWebhookEvent({
      errorCode: error instanceof SyntaxError ? "invalid_json" : "processing_failed",
      errorMessage: error instanceof SyntaxError
        ? "Invalid NOWPayments IPN JSON."
        : "NOWPayments IPN processing failed.",
      eventType: "nowpayments.ipn",
      httpStatus: 500,
      providerKey: "nowpayments",
      safePayloadSummary: {
        bodyLength: rawBody.length,
        hasSignature: Boolean(signature)
      },
      status: "failed",
      webhookType: "nowpayments_ipn"
    });
    return NextResponse.json({ error: "NOWPayments IPN processing failed" }, { status: 500 });
  }
}
