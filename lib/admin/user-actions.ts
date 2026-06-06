"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";

async function updateUserSubscriptionStatus(userId: string, status: "active" | "incomplete") {
  await getAdminAccess();

  if (!userId) {
    throw new Error("Missing user ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for user status changes.");
  }

  const { data: existing } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id")
    .eq("user_id" as never, userId as never)
    .maybeSingle();
  const planId =
    typeof (existing as { plan_id?: unknown } | null)?.plan_id === "string"
      ? ((existing as { plan_id: string }).plan_id)
      : "free";
  const plan = getBillingPlan(planId);

  await admin.from("user_subscriptions" as never).upsert(
    {
      plan_id: plan.id,
      status,
      user_id: userId
    } as never,
    { onConflict: "user_id" }
  );

  await admin.from("billing_events" as never).insert({
    event_type: status === "active" ? "admin_user_activated" : "admin_user_suspended",
    provider: "admin",
    user_id: userId,
    payload: { status } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/subscriptions");
}

export async function suspendAdminUser(formData: FormData) {
  await updateUserSubscriptionStatus(String(formData.get("userId") ?? ""), "incomplete");
}

export async function activateAdminUser(formData: FormData) {
  await updateUserSubscriptionStatus(String(formData.get("userId") ?? ""), "active");
}
