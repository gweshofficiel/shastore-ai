import { NextRequest, NextResponse } from "next/server";
import { completePayPalPlatformCheckoutFromReturn } from "@/lib/billing/paypal-platform";
import { absoluteUrl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function billingRedirect(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return NextResponse.redirect(absoluteUrl(`/dashboard/billing?${search.toString()}`), 303);
}

export async function GET(request: NextRequest) {
  const paypalOrderId = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  console.info("[paypal_activation_started]", {
    hasPayPalOrderId: Boolean(paypalOrderId),
    source: "checkout_return"
  });

  if (!paypalOrderId) {
    return billingRedirect({
      billing: "error",
      message: "PayPal checkout return is missing the order token.",
      provider: "paypal",
      reason: "missing_order_token"
    });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl("/login?next=/dashboard/billing"), 303);
  }

  try {
    const result = await completePayPalPlatformCheckoutFromReturn({
      paypalOrderId,
      userId: user.id
    });

    return billingRedirect({
      billing: "success",
      provider: "paypal",
      reason: result.activated ? "activated" : "pending"
    });
  } catch (error) {
    console.error("[paypal_activation_failed]", {
      message: error instanceof Error ? error.message : String(error),
      paypalOrderId,
      source: "checkout_return",
      userId: user.id
    });

    return billingRedirect({
      billing: "error",
      message: "PayPal payment was approved but platform subscription activation failed.",
      provider: "paypal",
      reason: "activation_failed"
    });
  }
}
