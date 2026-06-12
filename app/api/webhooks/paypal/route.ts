import { NextResponse } from "next/server";
import {
  syncPayPalPlatformWebhook,
  verifyPayPalWebhookSignature
} from "@/lib/billing/paypal-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  console.info("[paypal_webhook_received]", {
    bodyLength: rawBody.length,
    hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
  });

  try {
    const verified = await verifyPayPalWebhookSignature(rawBody, request);

    if (!verified) {
      console.error("[paypal_webhook_verification_failed]", {
        hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
      });
      return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as Parameters<typeof syncPayPalPlatformWebhook>[0];

    console.info("[paypal_webhook_verified]", {
      eventId: event.id ?? null,
      eventType: event.event_type ?? null
    });

    const result = await syncPayPalPlatformWebhook(event);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[paypal_webhook_processing_failed]", {
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "PayPal webhook processing failed" }, { status: 500 });
  }
}
