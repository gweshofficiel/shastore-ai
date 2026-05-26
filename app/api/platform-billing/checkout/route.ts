import { NextResponse } from "next/server";
import { createBillingCheckout } from "@/lib/billing/provider";
import { getBillingPlan } from "@/lib/billing/plans";
import { absoluteUrl } from "@/lib/utils";
import { requireProtectedApiAccess } from "@/lib/workspaces/data-access";

export async function POST(request: Request) {
  const access = await requireProtectedApiAccess({ permission: "can_manage_billing" });
  if (access.response || !access.context) {
    return access.response;
  }

  const { user } = access.context;
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
