import { absoluteUrl } from "@/lib/utils";
import { getStripe } from "@/lib/stripe";
import type { BillingPlan } from "@/lib/billing/plans";

export type BillingCheckoutRequest = {
  customerEmail?: string | null;
  plan: BillingPlan;
  userId: string;
};

export type BillingCheckoutResult =
  | {
      mode: "stripe";
      url: string;
    }
  | {
      mode: "placeholder";
      url: string;
      reason: string;
    };

function getPlanPriceId(plan: BillingPlan) {
  return (
    (plan.stripePriceEnv ? process.env[plan.stripePriceEnv] : null) ||
    (plan.id === "agency" ? process.env.STRIPE_PRICE_ID_BUSINESS : null) ||
    process.env.STRIPE_PRICE_ID ||
    null
  );
}

export async function createBillingCheckout(
  request: BillingCheckoutRequest
): Promise<BillingCheckoutResult> {
  const priceId = getPlanPriceId(request.plan);

  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    const reason = !process.env.STRIPE_SECRET_KEY
      ? "stripe_key_missing"
      : "stripe_price_missing";

    return {
      mode: "placeholder",
      reason,
      url: absoluteUrl(`/dashboard/billing?checkout=placeholder&plan=${request.plan.id}`)
    };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    client_reference_id: request.userId,
    customer_email: request.customerEmail ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      planId: request.plan.id,
      userId: request.userId
    },
    mode: "subscription",
    subscription_data: {
      metadata: {
        planId: request.plan.id,
        userId: request.userId
      }
    },
    success_url: absoluteUrl("/dashboard/billing?success=true"),
    cancel_url: absoluteUrl("/dashboard/billing?canceled=true")
  });

  if (!session.url) {
    return {
      mode: "placeholder",
      reason: "stripe_session_url_missing",
      url: absoluteUrl(`/dashboard/billing?checkout=placeholder&plan=${request.plan.id}`)
    };
  }

  return {
    mode: "stripe",
    url: session.url
  };
}
