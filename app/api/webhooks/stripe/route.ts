import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncStripeSubscriptionEvent } from "@/lib/billing/sync";
import { recordWebhookEvent } from "@/lib/integrations/webhook-monitoring";
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

  await recordWebhookEvent({
    eventType: "unknown",
    httpStatus: null,
    providerKey: "stripe",
    safePayloadSummary: {
      bodyLength: body.length,
      hasSignature: Boolean(signature)
    },
    status: "received",
    webhookType: "stripe_platform_webhook"
  });

  if (!signature) {
    console.error("[stripe-webhook] missing stripe-signature header");
    await recordWebhookEvent({
      errorCode: "missing_signature",
      errorMessage: "Missing Stripe signature.",
      eventType: "unknown",
      httpStatus: 400,
      providerKey: "stripe",
      safePayloadSummary: {
        bodyLength: body.length,
        hasSignature: false
      },
      status: "failed",
      webhookType: "stripe_platform_webhook"
    });
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[stripe-webhook] Stripe webhook secret is not configured", {
      acceptedEnv: ["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]
    });
    await recordWebhookEvent({
      errorCode: "missing_config",
      errorMessage: "Stripe webhook secret is not configured.",
      eventType: "unknown",
      httpStatus: 500,
      providerKey: "stripe",
      safePayloadSummary: {
        bodyLength: body.length,
        hasSignature: true
      },
      status: "failed",
      webhookType: "stripe_platform_webhook"
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
    await recordWebhookEvent({
      errorCode: "invalid_signature",
      errorMessage: "Invalid Stripe signature.",
      eventType: "unknown",
      httpStatus: 400,
      providerKey: "stripe",
      safePayloadSummary: {
        bodyLength: body.length,
        hasSignature: true
      },
      status: "failed",
      webhookType: "stripe_platform_webhook"
    });
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (!handledEvents.has(event.type)) {
    console.log("[stripe-debug] event skipped (unhandled type)", { eventType: event.type });
    await recordWebhookEvent({
      eventType: event.type,
      httpStatus: 200,
      providerKey: "stripe",
      relatedEntityId: event.id,
      relatedEntityType: "stripe_event",
      safePayloadSummary: {
        eventId: event.id,
        eventType: event.type,
        handled: false
      },
      status: "ignored",
      webhookType: "stripe_platform_webhook"
    });
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  console.log("[stripe-debug] verified event", {
    eventId: event.id,
    eventType: event.type,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  });

  try {
    await syncStripeSubscriptionEvent(event);
  } catch (error) {
    console.error("[stripe-webhook] event processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : String(error)
    });
    await recordWebhookEvent({
      errorCode: "processing_failed",
      errorMessage: "Stripe webhook processing failed.",
      eventType: event.type,
      httpStatus: 500,
      providerKey: "stripe",
      relatedEntityId: event.id,
      relatedEntityType: "stripe_event",
      safePayloadSummary: {
        eventId: event.id,
        eventType: event.type,
        handled: true
      },
      status: "failed",
      webhookType: "stripe_platform_webhook"
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  await recordWebhookEvent({
    eventType: event.type,
    httpStatus: 200,
    providerKey: "stripe",
    relatedEntityId: event.id,
    relatedEntityType: "stripe_event",
    safePayloadSummary: {
      eventId: event.id,
      eventType: event.type,
      handled: true
    },
    status: "processed",
    webhookType: "stripe_platform_webhook"
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
