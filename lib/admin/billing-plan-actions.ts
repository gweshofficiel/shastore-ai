"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { billingPlans, type SubscriptionPlanId } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

const EDITABLE_PLAN_IDS = ["starter", "pro", "agency"] as const satisfies readonly SubscriptionPlanId[];

function requireSuperAdminAccess(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can update subscription pricing.");
  }
}

function parseCurrencyAmount(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid amount for ${key}.`);
  }

  return Math.round(parsed * 100) / 100;
}

function limitsForPlan(planId: SubscriptionPlanId) {
  const plan = billingPlans.find((candidate) => candidate.id === planId);

  return {
    analytics: plan?.analytics ?? "basic",
    domainLimit: plan?.domainLimit ?? null,
    landingLimit: plan?.landingLimit ?? null,
    storeLimit: plan?.storeLimit ?? null,
    templateAccess: plan?.templateAccess ?? "limited"
  };
}

export async function saveSubscriptionPlanPricing(formData: FormData) {
  const access = await getAdminAccess();
  requireSuperAdminAccess(access);

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for subscription plan settings.");
  }

  const activePlanIds = new Set(formData.getAll("activePlanId").map((value) => String(value)));
  const now = new Date().toISOString();
  const rows = EDITABLE_PLAN_IDS.map((planId, index) => {
    const plan = billingPlans.find((candidate) => candidate.id === planId);
    const monthlyPrice = parseCurrencyAmount(formData, `${planId}_monthly_price`);
    const yearlyPrice = parseCurrencyAmount(formData, `${planId}_yearly_price`);

    return {
      active: activePlanIds.has(planId),
      id: planId,
      is_active: activePlanIds.has(planId),
      limits: limitsForPlan(planId) as never,
      monthly_price: monthlyPrice,
      name: plan?.name ?? planId,
      plan_id: planId,
      plan_name: plan?.name ?? planId,
      price_cents: Math.round(monthlyPrice * 100),
      sort_order: (index + 1) * 10,
      updated_at: now,
      yearly_price: yearlyPrice
    };
  });

  const { error } = await admin
    .from("subscription_plans" as never)
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    throw new Error(`Could not save subscription plan pricing: ${error.message}`);
  }

  const { error: eventError } = await admin.from("billing_events" as never).insert({
    event_type: "admin_subscription_plan_pricing_updated",
    provider: "admin",
    user_id: access.user.id,
    payload: {
      planIds: EDITABLE_PLAN_IDS,
      source: "super_admin_billing_settings"
    } as never,
    processed_at: now
  } as never);

  if (eventError) {
    console.warn("[admin-billing-settings] pricing audit event failed", {
      message: eventError.message
    });
  }

  revalidatePath("/admin/billing/settings");
  revalidatePath("/dashboard/billing");
}
