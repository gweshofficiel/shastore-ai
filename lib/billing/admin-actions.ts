"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { getBillingPlan } from "@/lib/billing/plans";
import type { Database } from "@/types/database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function getWritableBillingClient() {
  await getAdminAccess();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    return createServiceClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return createClient();
}

async function getExistingSubscription(
  supabase: Awaited<ReturnType<typeof getWritableBillingClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("user_subscriptions" as never)
    .select("plan_id, status, limits_snapshot")
    .eq("user_id" as never, userId as never)
    .maybeSingle();

  return data as {
    limits_snapshot: Record<string, unknown> | null;
    plan_id: string | null;
    status: string | null;
  } | null;
}

async function recordBillingAudit({
  eventType,
  payload,
  supabase,
  userId
}: {
  eventType: string;
  payload: Record<string, unknown>;
  supabase: Awaited<ReturnType<typeof getWritableBillingClient>>;
  userId: string;
}) {
  await supabase.from("billing_events" as never).insert({
    event_type: eventType,
    provider: "admin",
    user_id: userId,
    payload: {
      ...payload,
      source: "super_admin_billing_control_center"
    } as never,
    processed_at: new Date().toISOString()
  } as never);

  await supabase.from("monitoring_events" as never).insert({
    entity_id: userId,
    entity_type: "admin_subscription",
    event_status: "info",
    event_type: eventType,
    metadata: {
      ...payload,
      source: "super_admin_billing_control_center"
    } as never,
    store_id: null,
    user_id: userId,
    workspace_id: null
  } as never);
}

async function revalidateBillingControl(userId: string) {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function overrideUserPlan(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const planId = String(formData.get("planId") ?? "free").trim();
  const plan = getBillingPlan(planId);

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  const existing = await getExistingSubscription(supabase, userId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentAdminBilling = isRecord(currentMetadata.adminBilling) ? currentMetadata.adminBilling : {};
  const previousPlanId =
    typeof currentAdminBilling.previousPlanId === "string"
      ? currentAdminBilling.previousPlanId
      : existing?.plan_id ?? "free";

  await supabase.from("user_subscriptions" as never).upsert({
    limits_snapshot: {
      ...currentMetadata,
      adminBilling: {
        ...currentAdminBilling,
        manualOverrideActive: true,
        overriddenAt: new Date().toISOString(),
        overriddenPlanId: plan.id,
        previousPlanId,
        reviewStatus: currentAdminBilling.reviewStatus ?? null
      }
    },
    plan_id: plan.id,
    status: "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await recordBillingAudit({
    eventType: "admin_billing_manual_plan_override",
    payload: {
      nextPlanId: plan.id,
      previousPlanId
    },
    supabase,
    userId
  });

  await revalidateBillingControl(userId);
}

export async function restorePreviousPlan(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  const existing = await getExistingSubscription(supabase, userId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentAdminBilling = isRecord(currentMetadata.adminBilling) ? currentMetadata.adminBilling : {};
  const previousPlanId =
    typeof currentAdminBilling.previousPlanId === "string"
      ? currentAdminBilling.previousPlanId
      : "free";
  const previousPlan = getBillingPlan(previousPlanId);

  await supabase.from("user_subscriptions" as never).upsert({
    limits_snapshot: {
      ...currentMetadata,
      adminBilling: {
        ...currentAdminBilling,
        manualOverrideActive: false,
        restoredAt: new Date().toISOString(),
        restoredPlanId: previousPlan.id
      }
    },
    plan_id: previousPlan.id,
    status: "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await recordBillingAudit({
    eventType: "admin_billing_restore_previous_plan",
    payload: {
      currentPlanId: existing?.plan_id ?? "free",
      restoredPlanId: previousPlan.id
    },
    supabase,
    userId
  });

  await revalidateBillingControl(userId);
}

export async function markBillingReview(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  const existing = await getExistingSubscription(supabase, userId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentAdminBilling = isRecord(currentMetadata.adminBilling) ? currentMetadata.adminBilling : {};
  const plan = getBillingPlan(existing?.plan_id ?? "free");

  await supabase.from("user_subscriptions" as never).upsert({
    limits_snapshot: {
      ...currentMetadata,
      adminBilling: {
        ...currentAdminBilling,
        reviewMarkedAt: new Date().toISOString(),
        reviewStatus: "review"
      }
    },
    plan_id: plan.id,
    status: existing?.status ?? "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await recordBillingAudit({
    eventType: "admin_billing_mark_review",
    payload: { planId: plan.id },
    supabase,
    userId
  });

  await revalidateBillingControl(userId);
}

export async function clearBillingReview(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  const existing = await getExistingSubscription(supabase, userId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentAdminBilling = isRecord(currentMetadata.adminBilling) ? currentMetadata.adminBilling : {};
  const plan = getBillingPlan(existing?.plan_id ?? "free");

  await supabase.from("user_subscriptions" as never).upsert({
    limits_snapshot: {
      ...currentMetadata,
      adminBilling: {
        ...currentAdminBilling,
        reviewClearedAt: new Date().toISOString(),
        reviewStatus: "clear"
      }
    },
    plan_id: plan.id,
    status: existing?.status ?? "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await recordBillingAudit({
    eventType: "admin_billing_clear_review",
    payload: { planId: plan.id },
    supabase,
    userId
  });

  await revalidateBillingControl(userId);
}

export async function markBillingReviewed(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  const existing = await getExistingSubscription(supabase, userId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const currentAdminBilling = isRecord(currentMetadata.adminBilling) ? currentMetadata.adminBilling : {};
  const plan = getBillingPlan(existing?.plan_id ?? "free");

  await supabase.from("user_subscriptions" as never).upsert({
    limits_snapshot: {
      ...currentMetadata,
      adminBilling: {
        ...currentAdminBilling,
        reviewedAt: new Date().toISOString(),
        reviewStatus: "reviewed"
      }
    },
    plan_id: plan.id,
    status: existing?.status ?? "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await recordBillingAudit({
    eventType: "admin_billing_mark_reviewed",
    payload: { planId: plan.id },
    supabase,
    userId
  });

  await revalidateBillingControl(userId);
}
