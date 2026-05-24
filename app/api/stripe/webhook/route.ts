import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncStripeSubscriptionEvent } from "@/lib/billing/sync";
import { getPlatformBillingStripe } from "@/lib/stripe";

const handledEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    console.error("[stripe-webhook] missing stripe-signature header");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
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
    return NextResponse.json({ received: true, skipped: true });
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

  return NextResponse.json({ received: true });
}
