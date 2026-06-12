import { NextResponse } from "next/server";
import { createNowPaymentsPlatformCheckout } from "@/lib/billing/nowpayments";
import {
  isPaidSubscriptionPlan,
  isPlanAllowedForPlatformBillingRole
} from "@/lib/billing/platform-checkout";
import { requireResellerDashboardAccess } from "@/lib/reseller-showcase/access";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function resellerBillingRedirect(params: Record<string, string>) {
  const search = new URLSearchParams({
    ...params,
    provider: "nowpayments"
  });
  return NextResponse.redirect(absoluteUrl(`/reseller/dashboard/subscription?${search.toString()}`), 303);
}

function resellerBillingErrorRedirect(code: string, message: string) {
  return resellerBillingRedirect({
    billing: "error",
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

async function getResellerAccountId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reseller_profiles" as never)
    .select("id")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  const row = data as { id?: unknown } | null;
  return typeof row?.id === "string" ? row.id : null;
}

export async function POST(request: Request) {
  const { user } = await requireResellerDashboardAccess();
  const requestedPlan = await readRequestedPlan(request);

  if (!requestedPlan || !isPaidSubscriptionPlan(requestedPlan)) {
    return resellerBillingErrorRedirect("invalid_plan", "Choose Starter, Pro, or Agency.");
  }

  if (!isPlanAllowedForPlatformBillingRole(requestedPlan, "reseller")) {
    return resellerBillingErrorRedirect("plan_scope_mismatch", "This plan is not available for reseller subscriptions.");
  }

  const checkout = await createNowPaymentsPlatformCheckout({
    accountId: await getResellerAccountId(user.id),
    accountRole: "reseller",
    customerEmail: user.email,
    plan: requestedPlan,
    userId: user.id
  });

  if (!checkout.ok) {
    return resellerBillingErrorRedirect(checkout.code, checkout.message);
  }

  return NextResponse.redirect(checkout.url, 303);
}
