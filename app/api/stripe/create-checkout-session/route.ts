import { NextResponse } from "next/server";
import {
  createPlatformCheckoutSession,
  isPaidSubscriptionPlan
} from "@/lib/billing/platform-checkout";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { canCheckoutUpgrade } from "@/lib/billing/upgrade";
import { absoluteUrl } from "@/lib/utils";
import { requireProtectedApiAccess } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

function billingErrorRedirect(code: string, message: string) {
  const params = new URLSearchParams({
    billing: "error",
    message,
    reason: code
  });

  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${params.toString()}`), 303);
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
  const plan = await readPlan(request);

  if (!plan || !isPaidSubscriptionPlan(plan)) {
    return billingErrorRedirect(
      "invalid_plan",
      "Invalid plan. Choose starter, pro, or agency."
    );
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);
  const upgrade = canCheckoutUpgrade(access.plan.id, plan);

  console.info("[billing-upgrade] checkout request validated", {
    allowed: upgrade.allowed,
    currentPlanId: access.plan.id,
    reason: upgrade.code,
    requestedPlanId: plan,
    userId: user.id
  });

  if (!upgrade.allowed || !upgrade.planId) {
    return billingErrorRedirect(upgrade.code, upgrade.message);
  }

  const checkoutPlan = upgrade.planId;

  const checkout = await createPlatformCheckoutSession({
    customerEmail: user.email,
    plan: checkoutPlan,
    userId: user.id
  });

  if (!checkout.ok) {
    return billingErrorRedirect(checkout.code, checkout.message);
  }

  return NextResponse.redirect(checkout.url, 303);
}
