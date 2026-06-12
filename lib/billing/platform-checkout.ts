import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/deployment/config";

const PAID_PLANS = ["starter", "pro", "agency"] as const;

export type PaidSubscriptionPlanId = (typeof PAID_PLANS)[number];
export type PlatformBillingAccountRole = "owner" | "reseller";

const PLAN_SCOPES: Record<PlatformBillingAccountRole, readonly PaidSubscriptionPlanId[]> = {
  owner: PAID_PLANS,
  reseller: PAID_PLANS
};

const PLAN_PRICE_ENV: Record<PaidSubscriptionPlanId, string> = {
  starter: "PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER",
  pro: "PLATFORM_BILLING_STRIPE_PRICE_ID_PRO",
  agency: "PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY"
};

export function isPaidSubscriptionPlan(plan: string): plan is PaidSubscriptionPlanId {
  return PAID_PLANS.includes(plan as PaidSubscriptionPlanId);
}

export function isPlanAllowedForPlatformBillingRole(
  plan: PaidSubscriptionPlanId,
  role: PlatformBillingAccountRole
) {
  return PLAN_SCOPES[role].includes(plan);
}

export function getPlatformStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY ?? process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY ?? null;
}

export function resolvePlatformPriceId(plan: PaidSubscriptionPlanId) {
  const envKey = PLAN_PRICE_ENV[plan];
  const priceId = process.env[envKey]?.trim() || null;

  return { envKey, priceId };
}

export function resolvePlatformPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) {
    return null;
  }

  return PAID_PLANS.find((plan) => resolvePlatformPriceId(plan).priceId === priceId) ?? null;
}

export type CreatePlatformCheckoutInput = {
  accountId?: string | null;
  accountRole: PlatformBillingAccountRole;
  customerEmail?: string | null;
  plan: PaidSubscriptionPlanId;
  userId: string;
};

export type CreatePlatformCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code:
        | "checkout_failed"
        | "checkout_url_unavailable"
        | "missing_price"
        | "missing_stripe_key";
      message: string;
    };

function platformCheckoutUrls(accountRole: PlatformBillingAccountRole) {
  const baseUrl = getAppBaseUrl();
  const billingPath = accountRole === "reseller" ? "/reseller/dashboard/subscription" : "/dashboard/billing";

  return {
    cancelUrl: `${baseUrl}${billingPath}?billing=cancelled`,
    successUrl: `${baseUrl}${billingPath}?billing=success`
  };
}

function checkoutMetadata(input: CreatePlatformCheckoutInput) {
  return {
    ...(input.accountId ? { account_id: input.accountId, accountId: input.accountId } : {}),
    account_role: input.accountRole,
    billing_scope: "platform_subscription",
    plan: input.plan,
    plan_id: input.plan,
    planId: input.plan,
    role: input.accountRole,
    scope: input.accountRole,
    user_id: input.userId,
    userId: input.userId
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
  const { cancelUrl, successUrl } = platformCheckoutUrls(input.accountRole);
  const metadata = checkoutMetadata(input);

  try {
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
  } catch (error) {
    console.error("[platform-checkout] checkout session create failed", {
      accountRole: input.accountRole,
      message: error instanceof Error ? error.message : String(error),
      plan: input.plan,
      userId: input.userId
    });

    return {
      ok: false,
      code: "checkout_failed",
      message: "Could not start Stripe checkout. Verify platform billing Stripe price IDs and try again."
    };
  }
}
