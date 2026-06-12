import { NextResponse } from "next/server";
import {
  syncPayPalPlatformWebhook,
  verifyPayPalWebhookSignature
} from "@/lib/billing/paypal-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  console.info("[paypal_activation_webhook_received]", {
    bodyLength: rawBody.length,
    hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id"))
  });

  try {
    const verified = await verifyPayPalWebhookSignature(rawBody, request);

    if (!verified) {
      return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as Parameters<typeof syncPayPalPlatformWebhook>[0];

    console.info("[paypal_activation_event_type]", {
      eventId: event.id ?? null,
      eventType: event.event_type ?? null
    });

    const result = await syncPayPalPlatformWebhook(event);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[paypal_activation_failed]", {
      message: error instanceof Error ? error.message : String(error),
      source: "webhook"
    });
    return NextResponse.json({ error: "PayPal webhook processing failed" }, { status: 500 });
  }
}
