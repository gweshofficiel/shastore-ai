import { NextResponse } from "next/server";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { canCheckoutUpgrade } from "@/lib/billing/upgrade";
import {
  createYouCanPayPlatformCheckout,
  normalizeYouCanPayBillingMethod
} from "@/lib/billing/youcan-pay-platform";
import { absoluteUrl } from "@/lib/utils";
import { requireProtectedApiAccess } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type YouCanPayCheckoutRequestBody = {
  method?: unknown;
  plan_id?: unknown;
  provider?: unknown;
};

function wantsJsonResponse(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";

  return accept.includes("application/json") || contentType.includes("application/json");
}

function errorResponse(request: Request, code: string, message: string, status = 400) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: false, code, error: message }, { status });
  }

  const search = new URLSearchParams({
    billing: "error",
    message,
    provider: "youcan_pay",
    reason: code
  });

  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${search.toString()}`), 303);
}

async function readBody(request: Request) {
  const body = (await request.json().catch(() => null)) as YouCanPayCheckoutRequestBody | null;

  return {
    method: typeof body?.method === "string" ? body.method : null,
    planId: typeof body?.plan_id === "string" ? body.plan_id : null,
    provider: typeof body?.provider === "string" ? body.provider : null
  };
}

export async function POST(request: Request) {
  const accessContext = await requireProtectedApiAccess({ permission: "can_manage_billing" });

  if (accessContext.response || !accessContext.context) {
    return accessContext.response;
  }

  const { supabase, user, workspaceId } = accessContext.context;
  const body = await readBody(request);
  const method = normalizeYouCanPayBillingMethod(body.method);

  console.info("youcan checkout started", {
    method: body.method,
    planId: body.planId,
    provider: body.provider,
    userId: user.id,
    workspaceId
  });

  if (body.provider !== "youcan_pay") {
    return errorResponse(request, "invalid_provider", "Invalid YouCan Pay provider.");
  }

  if (!method) {
    return errorResponse(request, "invalid_method", "Choose Credit Card (Morocco) or Cash Plus.");
  }

  if (!body.planId) {
    return errorResponse(request, "invalid_plan", "Choose Starter, Pro, or Agency.");
  }

  const access = await getUserSubscriptionAccessForClient(supabase, user.id);
  const upgrade = canCheckoutUpgrade(access.plan.id, body.planId);

  if (!upgrade.allowed || !upgrade.planId) {
    return errorResponse(request, upgrade.code, upgrade.message);
  }

  const checkout = await createYouCanPayPlatformCheckout({
    method,
    planId: upgrade.planId,
    userId: user.id,
    workspaceId
  });

  if (!checkout.ok) {
    return errorResponse(request, checkout.code, checkout.message, 500);
  }

  if (wantsJsonResponse(request)) {
    return NextResponse.json({ ok: true, url: checkout.url }, { status: 200 });
  }

  return NextResponse.redirect(checkout.url, 303);
}
