import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncStripeSubscriptionEvent } from "@/lib/billing/sync";
import { getPlatformBillingStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const handledEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.finalized",
  "invoice.payment_succeeded",
  "invoice.payment_failed"
]);

function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? process.env.PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  console.log("[stripe-webhook] received");

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!signature) {
    console.error("[stripe-webhook] missing stripe-signature header");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[stripe-webhook] Stripe webhook secret is not configured", {
      acceptedEnv: ["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]
    });
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  let event;

  try {
    const stripe = getPlatformBillingStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (!handledEvents.has(event.type)) {
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  try {
    await syncStripeSubscriptionEvent(event);
  } catch (error) {
    console.error("[stripe-webhook] event processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
