import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncStripeSubscriptionEvent } from "@/lib/billing/sync";
import { getPlatformBillingStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature || !process.env.PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getPlatformBillingStripe();
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.finalized":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      await syncStripeSubscriptionEvent(event);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
