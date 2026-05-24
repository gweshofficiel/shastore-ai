import { NextResponse } from "next/server";
import { isPaidSubscriptionPlan } from "@/lib/billing/platform-checkout";
import { getPlatformBillingStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function billingPortalRedirect(code: string, message: string) {
  const params = new URLSearchParams({
    billing: "error",
    message,
    reason: code
  });

  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${params.toString()}`), 303);
}

function subscriptionCanUsePortal(subscription: {
  current_period_end?: string | null;
  plan_id?: string | null;
  status?: string | null;
}) {
  if (!subscription.plan_id || !isPaidSubscriptionPlan(subscription.plan_id)) {
    return false;
  }

  return (
    subscription.status === "active" ||
    subscription.status === "past_due" ||
    subscription.status === "trialing"
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl("/login?next=/dashboard/billing"), 303);
  }

  console.info("[stripe-portal] portal session requested", { userId: user.id });

  const { data, error } = await supabase
    .from("user_subscriptions" as never)
    .select("plan_id, status, stripe_customer_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[stripe-portal] subscription lookup failed", {
      message: error.message,
      userId: user.id
    });
    return billingPortalRedirect(
      "subscription_lookup_failed",
      "Could not load your platform subscription. Please try again."
    );
  }

  const subscription = data as
    | {
        current_period_end?: string | null;
        plan_id?: string | null;
        status?: string | null;
        stripe_customer_id?: string | null;
      }
    | null;

  if (!subscription || !subscriptionCanUsePortal(subscription)) {
    return billingPortalRedirect(
      "no_active_subscription",
      "No active platform subscription was found for this account."
    );
  }

  if (!subscription.stripe_customer_id) {
    console.warn("[stripe-portal] missing Stripe customer id", { userId: user.id });
    return billingPortalRedirect(
      "missing_stripe_customer",
      "Your subscription is missing a Stripe customer ID. Please contact support."
    );
  }

  let session;

  try {
    const stripe = getPlatformBillingStripe();
    session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: absoluteUrl("/dashboard/billing")
    });
    console.info("[stripe-portal] portal session created", {
      customerId: subscription.stripe_customer_id,
      userId: user.id
    });
  } catch (error) {
    console.error("[stripe-portal] portal redirect failed", {
      message: error instanceof Error ? error.message : String(error),
      userId: user.id
    });
    return billingPortalRedirect(
      "portal_session_failed",
      "Could not open the Stripe customer portal. Please try again."
    );
  }

  return NextResponse.redirect(session.url, 303);
}
