import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/deployment/config";

const PAID_PLANS = ["starter", "pro", "agency"] as const;

export type PaidSubscriptionPlanId = (typeof PAID_PLANS)[number];

const PLAN_PRICE_ENV: Record<PaidSubscriptionPlanId, string> = {
  starter: "PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER",
  pro: "PLATFORM_BILLING_STRIPE_PRICE_ID_PRO",
  agency: "PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY"
};

export function isPaidSubscriptionPlan(plan: string): plan is PaidSubscriptionPlanId {
  return PAID_PLANS.includes(plan as PaidSubscriptionPlanId);
}

export function getPlatformStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY ?? process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY ?? null;
}

export function resolvePlatformPriceId(plan: PaidSubscriptionPlanId) {
  const envKey = PLAN_PRICE_ENV[plan];
  const priceId = process.env[envKey]?.trim() || null;

  return { envKey, priceId };
}

export type CreatePlatformCheckoutInput = {
  customerEmail?: string | null;
  plan: PaidSubscriptionPlanId;
  userId: string;
};

export type CreatePlatformCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code: "missing_stripe_key" | "missing_price" | "checkout_url_unavailable";
      message: string;
    };

function platformCheckoutUrls() {
  const baseUrl = getAppBaseUrl();

  return {
    cancelUrl: `${baseUrl}/dashboard/billing?billing=cancelled`,
    successUrl: `${baseUrl}/dashboard/billing?billing=success`
  };
}

function checkoutMetadata(userId: string, plan: PaidSubscriptionPlanId) {
  return {
    plan,
    plan_id: plan,
    planId: plan,
    user_id: userId,
    userId
  };
}

export async function createPlatformCheckoutSession(
  input: CreatePlatformCheckoutInput
): Promise<CreatePlatformCheckoutResult> {
  const stripeKey = getPlatformStripeSecretKey();

  if (!stripeKey) {
    return {
      ok: false,
      code: "missing_stripe_key",
      message:
        "Platform billing Stripe is not configured. Set STRIPE_SECRET_KEY (SaaS subscriptions only, not store payments)."
    };
  }

  const { envKey, priceId } = resolvePlatformPriceId(input.plan);

  if (!priceId) {
    return {
      ok: false,
      code: "missing_price",
      message: `Missing ${envKey}. Add the Stripe price ID for the ${input.plan} plan.`
    };
  }

  const stripe = new Stripe(stripeKey, { typescript: true });
  const { cancelUrl, successUrl } = platformCheckoutUrls();
  const metadata = checkoutMetadata(input.userId, input.plan);

  const session = await stripe.checkout.sessions.create({
    cancel_url: cancelUrl,
    client_reference_id: input.userId,
    customer_email: input.customerEmail ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    mode: "subscription",
    subscription_data: {
      metadata
    },
    success_url: successUrl
  });

  if (!session.url) {
    return {
      ok: false,
      code: "checkout_url_unavailable",
      message: "Stripe checkout session was created without a redirect URL."
    };
  }

  return { ok: true, url: session.url };
}
