import { NextResponse } from "next/server";
import {
  createPlatformCheckoutSession,
  isPaidSubscriptionPlan
} from "@/lib/billing/platform-checkout";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

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
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const plan = await readPlan(request);

  if (!plan || !isPaidSubscriptionPlan(plan)) {
    return billingErrorRedirect(
      "invalid_plan",
      "Invalid plan. Choose starter, pro, or agency."
    );
  }

  const checkout = await createPlatformCheckoutSession({
    customerEmail: user.email,
    plan,
    userId: user.id
  });

  if (!checkout.ok) {
    return billingErrorRedirect(checkout.code, checkout.message);
  }

  return NextResponse.redirect(checkout.url, 303);
}
