import { NextResponse } from "next/server";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { getPlatformBillingStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const portalEligibleStatuses = new Set(["active", "past_due", "trialing", "unpaid"]);

function billingPortalRedirect(code: string, message: string) {
  const params = new URLSearchParams({
    billing: "error",
    message,
    reason: code
  });

  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${params.toString()}`), 303);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("[customer-portal] unauthenticated request");
    return NextResponse.redirect(absoluteUrl("/login?next=/dashboard/billing"), 303);
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);

  try {
    await requirePermission({
      permission: "manage_billing",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    return billingPortalRedirect("permission_denied", "You do not have permission to manage billing.");
  }

  console.info("[customer-portal] portal session requested", { userId: user.id });

  const { data, error } = await supabase
    .from("user_subscriptions" as never)
    .select("plan_id, status, stripe_customer_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[customer-portal-error] subscription lookup failed", {
      message: error.message,
      userId: user.id
    });
    return billingPortalRedirect(
      "subscription_lookup_failed",
      "Could not load your billing account. Please try again."
    );
  }

  const subscription = data as
    | {
        plan_id?: string | null;
        status?: string | null;
        stripe_customer_id?: string | null;
      }
    | null;

  if (!subscription?.stripe_customer_id || !portalEligibleStatuses.has(subscription.status ?? "")) {
    console.warn("[customer-portal] no active billing account found", {
      hasStripeCustomerId: Boolean(subscription?.stripe_customer_id),
      status: subscription?.status ?? null,
      userId: user.id
    });
    return billingPortalRedirect("no_active_billing_account", "No active billing account found.");
  }

  try {
    const stripe = getPlatformBillingStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: absoluteUrl("/dashboard/billing")
    });

    console.info("[customer-portal] portal session created", {
      customerId: subscription.stripe_customer_id,
      userId: user.id
    });

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("[customer-portal-error] portal session failed", {
      message: error instanceof Error ? error.message : String(error),
      userId: user.id
    });
    return billingPortalRedirect(
      "portal_session_failed",
      "Could not open the Stripe customer portal. Please try again."
    );
  }
}
