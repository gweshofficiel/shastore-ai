import { NextResponse } from "next/server";
import {
  syncPayPalPlatformWebhook,
  verifyPayPalWebhookSignature
} from "@/lib/billing/paypal-platform";
import { recordWebhookEvent } from "@/lib/integrations/webhook-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  console.info("[paypal_activation_webhook_received]", {
    bodyLength: rawBody.length,
    hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
  });
  await recordWebhookEvent({
    eventType: "paypal.webhook",
    httpStatus: null,
    providerKey: "paypal_platform",
    safePayloadSummary: {
      bodyLength: rawBody.length,
      hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
    },
    status: "received",
    webhookType: "paypal_platform_webhook"
  });

  try {
    const verified = await verifyPayPalWebhookSignature(rawBody, request);

    if (!verified) {
      await recordWebhookEvent({
        errorCode: "invalid_signature",
        errorMessage: "Invalid PayPal webhook signature.",
        eventType: "paypal.webhook",
        httpStatus: 400,
        providerKey: "paypal_platform",
        safePayloadSummary: {
          bodyLength: rawBody.length,
          hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
        },
        status: "failed",
        webhookType: "paypal_platform_webhook"
      });
      return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as Parameters<typeof syncPayPalPlatformWebhook>[0];

    console.info("[paypal_activation_event_type]", {
      eventId: event.id ?? null,
      eventType: event.event_type ?? null
    });

    const result = await syncPayPalPlatformWebhook(event);
    await recordWebhookEvent({
      eventType: event.event_type ?? "paypal.event.unknown",
      httpStatus: 200,
      providerKey: "paypal_platform",
      relatedEntityId: event.id ?? null,
      relatedEntityType: "paypal_webhook_event",
      safePayloadSummary: {
        activated: result.activated,
        eventId: event.id ?? null,
        eventType: event.event_type ?? null,
        reason: result.reason
      },
      status: result.activated ? "processed" : "ignored",
      webhookType: "paypal_platform_webhook"
    });
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[paypal_activation_failed]", {
      message: error instanceof Error ? error.message : String(error),
      source: "webhook"
    });
    await recordWebhookEvent({
      errorCode: error instanceof SyntaxError ? "invalid_json" : "processing_failed",
      errorMessage: error instanceof SyntaxError
        ? "Invalid PayPal webhook JSON."
        : "PayPal webhook processing failed.",
      eventType: "paypal.webhook",
      httpStatus: 500,
      providerKey: "paypal_platform",
      safePayloadSummary: {
        bodyLength: rawBody.length,
        hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
      },
      status: "failed",
      webhookType: "paypal_platform_webhook"
    });
    return NextResponse.json({ error: "PayPal webhook processing failed" }, { status: 500 });
  }
}
