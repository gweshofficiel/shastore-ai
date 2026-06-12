import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { getBillingPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAID_PLANS = ["starter", "pro", "agency"] as const;
const GENERIC_PLATFORM_PRICE_ENV = "PLATFORM_BILLING_STRIPE_PRICE_ID";

export type PaidSubscriptionPlanId = (typeof PAID_PLANS)[number];
export type PlatformBillingAccountRole = "owner" | "reseller";

const PLAN_SCOPES: Record<PlatformBillingAccountRole, readonly PaidSubscriptionPlanId[]> = {
  owner: PAID_PLANS,
  reseller: PAID_PLANS
};

export type PlatformPriceResolution = {
  checkedEnvKeys: string[];
  envKey: string;
  priceId: string | null;
  source: "database" | "env" | null;
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

function readTrimmedEnv(key: string) {
  const value = process.env[key]?.trim();
  return value || null;
}

function isValidStripePriceId(value: string | null | undefined) {
  return typeof value === "string" && /^price_/.test(value);
}

function platformPriceEnvKeys(plan: PaidSubscriptionPlanId) {
  const billingPlan = getBillingPlan(plan);
  const keys = [billingPlan.stripePriceEnv, GENERIC_PLATFORM_PRICE_ENV].filter(
    (key): key is string => Boolean(key)
  );

  return [...new Set(keys)];
}

function isMissingSubscriptionPlansTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  return (
    record.code === "PGRST205" ||
    record.message?.toLowerCase().includes("subscription_plans") ||
    false
  );
}

export function missingPlatformPriceMessage(
  plan: PaidSubscriptionPlanId,
  resolution: PlatformPriceResolution
) {
  const billingPlan = getBillingPlan(plan);
  const envHint = resolution.checkedEnvKeys.join(", ");

  return `${billingPlan.name} plan is missing a valid Stripe price ID. Set ${envHint} or subscription_plans.stripe_price_id for plan "${plan}".`;
}

function checkoutFailedMessage(
  plan: PaidSubscriptionPlanId,
  resolution: PlatformPriceResolution,
  stripeMessage: string
) {
  const billingPlan = getBillingPlan(plan);

  if (/no such price/i.test(stripeMessage)) {
    return `${billingPlan.name} plan Stripe price ID was rejected by Stripe. Verify ${resolution.envKey} in your platform billing Stripe account.`;
  }

  return `Could not start Stripe checkout for the ${billingPlan.name} plan. Verify platform billing Stripe price IDs (${resolution.envKey}) and try again.`;
}

export function resolvePlatformPriceId(plan: PaidSubscriptionPlanId): PlatformPriceResolution {
  const checkedEnvKeys = platformPriceEnvKeys(plan);

  for (const envKey of checkedEnvKeys) {
    const candidate = readTrimmedEnv(envKey);

    if (isValidStripePriceId(candidate)) {
      return {
        checkedEnvKeys,
        envKey,
        priceId: candidate,
        source: "env"
      };
    }

    if (candidate) {
      console.warn("[platform-checkout] ignored invalid Stripe price env value", {
        envKey,
        plan
      });
    }
  }

  return {
    checkedEnvKeys,
    envKey: checkedEnvKeys[0] ?? `PLATFORM_BILLING_STRIPE_PRICE_ID_${plan.toUpperCase()}`,
    priceId: null,
    source: null
  };
}

async function resolvePlatformPriceIdFromDatabase(
  plan: PaidSubscriptionPlanId,
  resolution: PlatformPriceResolution
): Promise<PlatformPriceResolution> {
  const supabase = await createClient();
  const planIds = plan === "agency" ? ["agency", "business"] : [plan];

  for (const planId of planIds) {
    const { data, error } = await supabase
      .from("subscription_plans" as never)
      .select("stripe_price_id")
      .eq("id", planId as never)
      .maybeSingle();

    if (error) {
      if (isMissingSubscriptionPlansTable(error)) {
        break;
      }

      console.warn("[platform-checkout] subscription_plans lookup failed", {
        message: error.message,
        plan,
        planId
      });
      continue;
    }

    const row = data as { stripe_price_id?: string | null } | null;
    const priceId = row?.stripe_price_id?.trim() || null;

    if (isValidStripePriceId(priceId)) {
      return {
        ...resolution,
        priceId,
        source: "database"
      };
    }
  }

  return resolution;
}

export async function resolvePlatformPriceIdAsync(
  plan: PaidSubscriptionPlanId
): Promise<PlatformPriceResolution> {
  const envResolution = resolvePlatformPriceId(plan);

  if (envResolution.priceId) {
    return envResolution;
  }

  return resolvePlatformPriceIdFromDatabase(plan, envResolution);
}

export function resolvePlatformPlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) {
    return null;
  }

  return PAID_PLANS.find((plan) => resolvePlatformPriceId(plan).priceId === priceId) ?? null;
}

async function resolvePlatformPlanByPriceIdFromDatabase(
  priceId: string
): Promise<PaidSubscriptionPlanId | null> {
  const supabase = createAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("subscription_plans" as never)
    .select("id, stripe_price_id")
    .eq("stripe_price_id" as never, priceId as never)
    .maybeSingle();

  if (error) {
    if (isMissingSubscriptionPlansTable(error)) {
      return null;
    }

    console.warn("[platform-checkout] subscription_plans price lookup failed", {
      message: error.message,
      priceId
    });
    return null;
  }

  const row = data as { id?: string | null; stripe_price_id?: string | null } | null;
  const planId = row?.id?.trim() || null;

  if (planId === "business") {
    return "agency";
  }

  return planId && isPaidSubscriptionPlan(planId) ? planId : null;
}

export async function resolvePlatformPlanByPriceIdAsync(
  priceId: string | null | undefined
): Promise<PaidSubscriptionPlanId | null> {
  if (!priceId) {
    return null;
  }

  const fromEnv = resolvePlatformPlanByPriceId(priceId);

  if (fromEnv) {
    return fromEnv;
  }

  return resolvePlatformPlanByPriceIdFromDatabase(priceId);
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
    billing_scope: "platform",
    ...(input.customerEmail ? { email: input.customerEmail.trim().toLowerCase() } : {}),
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

  const priceResolution = await resolvePlatformPriceIdAsync(input.plan);

  if (!priceResolution.priceId) {
    return {
      ok: false,
      code: "missing_price",
      message: missingPlatformPriceMessage(input.plan, priceResolution)
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
      line_items: [{ price: priceResolution.priceId, quantity: 1 }],
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
    const stripeMessage = error instanceof Error ? error.message : String(error);

    console.error("[platform-checkout] checkout session create failed", {
      accountRole: input.accountRole,
      message: stripeMessage,
      plan: input.plan,
      priceSource: priceResolution.source,
      userId: input.userId
    });

    return {
      ok: false,
      code: "checkout_failed",
      message: checkoutFailedMessage(input.plan, priceResolution, stripeMessage)
    };
  }
}
