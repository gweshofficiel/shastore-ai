import { absoluteUrl } from "@/lib/utils";
import { getPlatformBillingStripe } from "@/lib/stripe";
import type { BillingPlan } from "@/lib/billing/plans";

export type BillingCheckoutRequest = {
  accountId?: string | null;
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
    process.env.PLATFORM_BILLING_STRIPE_PRICE_ID ||
    null
  );
}

export async function createBillingCheckout(
  request: BillingCheckoutRequest
): Promise<BillingCheckoutResult> {
  const priceId = getPlanPriceId(request.plan);

  if (!process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY || !priceId) {
    const reason = !process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY
      ? "platform_billing_stripe_key_missing"
      : "platform_billing_stripe_price_missing";

    return {
      mode: "placeholder",
      reason,
      url: absoluteUrl(`/dashboard/billing?checkout=placeholder&plan=${request.plan.id}`)
    };
  }

  const stripe = getPlatformBillingStripe();
  const session = await stripe.checkout.sessions.create({
    client_reference_id: request.userId,
    customer_email: request.customerEmail ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      ...(request.accountId ? { account_id: request.accountId, accountId: request.accountId } : {}),
      account_role: "owner",
      billing_scope: "platform_subscription",
      planId: request.plan.id,
      plan_id: request.plan.id,
      role: "owner",
      scope: "owner",
      userId: request.userId,
      user_id: request.userId
    },
    mode: "subscription",
    subscription_data: {
      metadata: {
        ...(request.accountId ? { account_id: request.accountId, accountId: request.accountId } : {}),
        account_role: "owner",
        billing_scope: "platform_subscription",
        planId: request.plan.id,
        plan_id: request.plan.id,
        role: "owner",
        scope: "owner",
        userId: request.userId,
        user_id: request.userId
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
