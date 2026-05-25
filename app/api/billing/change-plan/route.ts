import { NextResponse } from "next/server";
import { getUserSubscriptionAccessForClient, planRank } from "@/lib/billing/access";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  createPlatformCheckoutSession,
  isPaidSubscriptionPlan,
  resolvePlatformPriceId
} from "@/lib/billing/platform-checkout";
import { getPlatformBillingStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function billingRedirect(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${search.toString()}`), 303);
}

function billingErrorRedirect(code: string, message: string) {
  return billingRedirect({
    billing: "error",
    message,
    reason: code
  });
}

function billingInfoRedirect(code: string, message: string) {
  return billingRedirect({
    billing: "plan_change_pending",
    message,
    reason: code
  });
}

async function readRequestedPlan(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
    return typeof body?.plan === "string" ? body.plan : null;
  }

  const formData = await request.formData();
  const plan = formData.get("plan");

  return typeof plan === "string" ? plan : null;
}

function normalizePlan(plan: string | null): SubscriptionPlanId | null {
  const normalized = getBillingPlan(plan).id;

  if (normalized === plan || (plan === "business" && normalized === "agency")) {
    return normalized;
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("[plan-change] unauthenticated request");
    return NextResponse.redirect(absoluteUrl("/login?next=/dashboard/billing"), 303);
  }

  const requestedPlan = normalizePlan(await readRequestedPlan(request));

  if (!requestedPlan) {
    console.warn("[plan-change] invalid requested plan", { userId: user.id });
    return billingErrorRedirect("invalid_plan", "Choose Free, Starter, Pro, or Agency.");
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);
  const currentPlan = access.plan.id;

  console.info("[plan-change] request received", {
    currentPlan,
    hasStripeCustomerId: Boolean(access.stripeCustomerId),
    hasStripeSubscriptionId: Boolean(access.stripeSubscriptionId),
    requestedPlan,
    userId: user.id
  });

  if (requestedPlan === currentPlan) {
    return billingInfoRedirect("current_plan", "Current plan selected. No billing change was made.");
  }

  if (isPaidSubscriptionPlan(requestedPlan) && currentPlan === "free") {
    const checkout = await createPlatformCheckoutSession({
      customerEmail: user.email,
      plan: requestedPlan,
      userId: user.id
    });

    if (!checkout.ok) {
      console.error("[plan-change-error] checkout session failed", {
        code: checkout.code,
        currentPlan,
        requestedPlan,
        userId: user.id
      });
      return billingErrorRedirect(checkout.code, checkout.message);
    }

    console.info("[plan-change] checkout session created", {
      currentPlan,
      requestedPlan,
      userId: user.id
    });
    return NextResponse.redirect(checkout.url, 303);
  }

  if (!access.stripeSubscriptionId) {
    console.warn("[plan-change] no active billing account found", {
      currentPlan,
      requestedPlan,
      userId: user.id
    });
    return billingErrorRedirect("no_active_billing_account", "No active billing account found.");
  }

  try {
    const stripe = getPlatformBillingStripe();

    if (requestedPlan === "free") {
      await stripe.subscriptions.update(access.stripeSubscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          requested_plan: "free",
          user_id: user.id,
          userId: user.id
        }
      });

      console.info("[plan-change] free downgrade scheduled", {
        currentPlan,
        requestedPlan,
        stripeSubscriptionId: access.stripeSubscriptionId,
        userId: user.id
      });

      return billingInfoRedirect(
        "free_downgrade_scheduled",
        "Downgrade to Free scheduled. Your current paid access remains until the end of the billing period."
      );
    }

    if (!isPaidSubscriptionPlan(requestedPlan)) {
      return billingErrorRedirect("invalid_plan", "Choose Free, Starter, Pro, or Agency.");
    }

    const { envKey, priceId } = resolvePlatformPriceId(requestedPlan);

    if (!priceId) {
      console.error("[plan-change-error] missing Stripe price id", {
        envKey,
        requestedPlan,
        userId: user.id
      });
      return billingErrorRedirect(
        "missing_price",
        `Missing ${envKey}. Add the Stripe price ID for the ${requestedPlan} plan.`
      );
    }

    const subscription = await stripe.subscriptions.retrieve(access.stripeSubscriptionId);
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      console.error("[plan-change-error] subscription item missing", {
        requestedPlan,
        stripeSubscriptionId: access.stripeSubscriptionId,
        userId: user.id
      });
      return billingErrorRedirect(
        "subscription_item_missing",
        "Could not update your Stripe subscription item. Please try the customer portal."
      );
    }

    await stripe.subscriptions.update(access.stripeSubscriptionId, {
      cancel_at_period_end: false,
      items: [
        {
          id: subscriptionItem.id,
          price: priceId
        }
      ],
      metadata: {
        requested_plan: requestedPlan,
        user_id: user.id,
        userId: user.id
      },
      proration_behavior: "create_prorations"
    });

    const direction = planRank(requestedPlan) > planRank(currentPlan) ? "upgrade" : "downgrade";

    console.info("[plan-change] paid subscription update submitted", {
      currentPlan,
      direction,
      requestedPlan,
      stripeSubscriptionId: access.stripeSubscriptionId,
      userId: user.id
    });

    return billingInfoRedirect(
      "paid_plan_change_submitted",
      `${direction === "upgrade" ? "Upgrade" : "Downgrade"} submitted. Your plan will update after Stripe confirms the subscription change.`
    );
  } catch (error) {
    console.error("[plan-change-error] plan change failed", {
      currentPlan,
      message: error instanceof Error ? error.message : String(error),
      requestedPlan,
      userId: user.id
    });
    return billingErrorRedirect(
      "plan_change_failed",
      "Could not change your plan. Please try again or use Manage subscription."
    );
  }
}
