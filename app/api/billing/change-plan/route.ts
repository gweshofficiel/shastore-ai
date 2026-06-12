import { NextResponse } from "next/server";
import { getUserSubscriptionAccessForClient, planRank } from "@/lib/billing/access";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  createPlatformCheckoutSession,
  isPaidSubscriptionPlan,
  isPlanAllowedForPlatformBillingRole,
  missingPlatformPriceMessage,
  resolvePlatformPriceIdAsync
} from "@/lib/billing/platform-checkout";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { getPlatformBillingStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function safeBillingMessage(message: string) {
  return message.trim().slice(0, 240);
}

function wantsJsonResponse(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";

  return accept.includes("application/json") || contentType.includes("application/json");
}

function billingRedirect(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${search.toString()}`), 303);
}

function billingErrorRedirect(code: string, message: string) {
  return billingRedirect({
    billing: "error",
    message: safeBillingMessage(message),
    reason: code
  });
}

function billingInfoRedirect(code: string, message: string) {
  return billingRedirect({
    billing: "plan_change_pending",
    message: safeBillingMessage(message),
    reason: code
  });
}

function billingErrorResponse(
  request: Request,
  code: string,
  message: string,
  status = 400
) {
  const safeMessage = safeBillingMessage(message);

  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: false, code, error: safeMessage }, { status });
  }

  return billingErrorRedirect(code, safeMessage);
}

function billingInfoResponse(request: Request, code: string, message: string) {
  const safeMessage = safeBillingMessage(message);

  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: true, code, message: safeMessage }, { status: 200 });
  }

  return billingInfoRedirect(code, safeMessage);
}

function ownerPlatformBillingMetadata(
  workspaceId: string,
  userId: string,
  requestedPlan?: string
): Record<string, string> {
  return {
    ...(workspaceId ? { account_id: workspaceId } : {}),
    account_role: "owner",
    billing_scope: "platform_subscription",
    ...(requestedPlan ? { requested_plan: requestedPlan } : {}),
    role: "owner",
    scope: "owner",
    user_id: userId,
    userId
  };
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
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("[plan-change] unauthenticated request");

      if (wantsJsonResponse(request)) {
        return NextResponse.json({ ok: false, code: "unauthenticated", error: "Authentication required." }, { status: 401 });
      }

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
      return billingErrorResponse(
        request,
        "permission_denied",
        "You do not have permission to manage billing.",
        403
      );
    }

    const requestedPlan = normalizePlan(await readRequestedPlan(request));

    if (!requestedPlan) {
      console.warn("[plan-change] invalid requested plan", { userId: user.id });
      return billingErrorResponse(request, "invalid_plan", "Choose Free, Starter, Pro, or Agency.");
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
      return billingInfoResponse(request, "current_plan", "Current plan selected. No billing change was made.");
    }

    if (isPaidSubscriptionPlan(requestedPlan) && !isPlanAllowedForPlatformBillingRole(requestedPlan, "owner")) {
      return billingErrorResponse(
        request,
        "plan_scope_mismatch",
        "This plan is not available for owner subscriptions."
      );
    }

    if (isPaidSubscriptionPlan(requestedPlan) && currentPlan === "free") {
      const checkout = await createPlatformCheckoutSession({
        accountId: workspaceId,
        accountRole: "owner",
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
        return billingErrorResponse(request, checkout.code, checkout.message);
      }

      console.info("[plan-change] checkout session created", {
        currentPlan,
        requestedPlan,
        userId: user.id
      });

      if (wantsJsonResponse(request)) {
        return NextResponse.json({ ok: true, code: "checkout_ready", url: checkout.url }, { status: 200 });
      }

      return NextResponse.redirect(checkout.url, 303);
    }

    if (!access.stripeSubscriptionId) {
      console.warn("[plan-change] no active billing account found", {
        currentPlan,
        requestedPlan,
        userId: user.id
      });
      return billingErrorResponse(
        request,
        "no_active_billing_account",
        "No active billing account found."
      );
    }

    try {
      const stripe = getPlatformBillingStripe();

      if (requestedPlan === "free") {
        await stripe.subscriptions.update(access.stripeSubscriptionId, {
          cancel_at_period_end: true,
          metadata: ownerPlatformBillingMetadata(workspaceId, user.id, "free")
        });

        console.info("[plan-change] free downgrade scheduled", {
          currentPlan,
          requestedPlan,
          stripeSubscriptionId: access.stripeSubscriptionId,
          userId: user.id
        });

        return billingInfoResponse(
          request,
          "free_downgrade_scheduled",
          "Downgrade to Free scheduled. Your current paid access remains until the end of the billing period."
        );
      }

      if (!isPaidSubscriptionPlan(requestedPlan)) {
        return billingErrorResponse(request, "invalid_plan", "Choose Free, Starter, Pro, or Agency.");
      }

      const priceResolution = await resolvePlatformPriceIdAsync(requestedPlan);

      if (!priceResolution.priceId) {
        console.error("[plan-change-error] missing Stripe price id", {
          checkedEnvKeys: priceResolution.checkedEnvKeys,
          envKey: priceResolution.envKey,
          requestedPlan,
          userId: user.id
        });
        return billingErrorResponse(
          request,
          "missing_price",
          missingPlatformPriceMessage(requestedPlan, priceResolution)
        );
      }

      const { priceId } = priceResolution;

      const subscription = await stripe.subscriptions.retrieve(access.stripeSubscriptionId);
      const subscriptionItem = subscription.items.data[0];

      if (!subscriptionItem) {
        console.error("[plan-change-error] subscription item missing", {
          requestedPlan,
          stripeSubscriptionId: access.stripeSubscriptionId,
          userId: user.id
        });
        return billingErrorResponse(
          request,
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
        metadata: ownerPlatformBillingMetadata(workspaceId, user.id, requestedPlan),
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

      return billingInfoResponse(
        request,
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
      return billingErrorResponse(
        request,
        "plan_change_failed",
        "Could not change your plan. Please try again or use Manage subscription.",
        500
      );
    }
  } catch (error) {
    console.error("[plan-change-error] unhandled request failure", {
      message: error instanceof Error ? error.message : String(error)
    });

    return billingErrorResponse(
      request,
      "plan_change_failed",
      "Could not change your plan. Please try again.",
      500
    );
  }
}
