import { NextResponse } from "next/server";
import { createBillingCheckout } from "@/lib/billing/provider";
import { getBillingPlan } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl("/login?next=/dashboard/billing"), 303);
  }

  const formData = await request.formData();
  const plan = getBillingPlan(String(formData.get("planId") ?? "pro"));

  if (plan.id === "free") {
    return NextResponse.redirect(absoluteUrl("/dashboard/billing?plan=free"), 303);
  }

  const checkout = await createBillingCheckout({
    customerEmail: user.email,
    plan,
    userId: user.id
  });

  return NextResponse.redirect(checkout.url, 303);
}
