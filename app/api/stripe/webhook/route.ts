import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncStripeSubscriptionEvent } from "@/lib/billing/sync";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscriptionEvent(event);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
