import { NextResponse } from "next/server";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { createNowPaymentsPlatformCheckout } from "@/lib/billing/nowpayments";
import {
  isPaidSubscriptionPlan,
  isPlanAllowedForPlatformBillingRole
} from "@/lib/billing/platform-checkout";
import { canCheckoutUpgrade } from "@/lib/billing/upgrade";
import { absoluteUrl } from "@/lib/utils";
import { requireProtectedApiAccess } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

function wantsJsonResponse(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";

  return accept.includes("application/json") || contentType.includes("application/json");
}

function billingErrorRedirect(code: string, message: string) {
  const params = new URLSearchParams({
    billing: "error",
    message,
    provider: "nowpayments",
    reason: code
  });

  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${params.toString()}`), 303);
}

function billingErrorResponse(
  request: Request,
  code: string,
  message: string,
  status = 400
) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: false, code, error: message }, { status });
  }

  return billingErrorRedirect(code, message);
}

async function readPlan(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
    return typeof body?.plan === "string" ? body.plan : null;
  }

  const formData = await request.formData();
  const plan = formData.get("plan");

  return typeof plan === "string" ? plan : null;
}

export async function POST(request: Request) {
  const accessContext = await requireProtectedApiAccess({ permission: "can_manage_billing" });

  if (accessContext.response || !accessContext.context) {
    return accessContext.response;
  }

  const { supabase, user } = accessContext.context;
  const requestedPlan = await readPlan(request);

  if (!requestedPlan || !isPaidSubscriptionPlan(requestedPlan)) {
    return billingErrorResponse(request, "invalid_plan", "Choose Starter, Pro, or Agency.");
  }

  if (!isPlanAllowedForPlatformBillingRole(requestedPlan, "owner")) {
    return billingErrorResponse(
      request,
      "plan_scope_mismatch",
      "This plan is not available for owner subscriptions."
    );
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);
  const upgrade = canCheckoutUpgrade(access.plan.id, requestedPlan);

  if (!upgrade.allowed || !upgrade.planId) {
    return billingErrorResponse(request, upgrade.code, upgrade.message);
  }

  console.info("[nowpayments_checkout_request_started]", {
    planId: upgrade.planId,
    userId: user.id
  });

  const checkout = await createNowPaymentsPlatformCheckout({
    accountId: accessContext.context.workspaceId,
    accountRole: "owner",
    customerEmail: user.email,
    plan: upgrade.planId,
    userId: user.id
  });

  if (!checkout.ok) {
    console.error("[nowpayments_checkout_failed]", {
      code: checkout.code,
      message: checkout.message,
      planId: upgrade.planId,
      userId: user.id
    });
    return billingErrorResponse(request, checkout.code, checkout.message, 500);
  }

  console.info("[nowpayments_checkout_redirect_ready]", {
    planId: upgrade.planId,
    url: checkout.url,
    userId: user.id
  });

  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: true, url: checkout.url }, { status: 200 });
  }

  return NextResponse.redirect(checkout.url, 303);
}
