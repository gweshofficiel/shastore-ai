"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-access";
import { getBillingPlan } from "@/lib/billing/plans";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function updateUserSubscriptionStatus(userId: string, status: "active" | "incomplete") {
  await getAdminAccess();

  if (!userId) {
    throw new Error("Missing user ID.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for user status changes.");
  }

  const { data } = await admin
    .from("user_subscriptions" as never)
    .select("plan_id, limits_snapshot")
    .eq("user_id" as never, userId as never)
    .maybeSingle();
  const existing = data as { limits_snapshot: Record<string, unknown> | null; plan_id: string | null } | null;
  const planId = existing?.plan_id ?? "free";
  const plan = getBillingPlan(planId);
  const currentMetadata = isRecord(existing?.limits_snapshot) ? existing.limits_snapshot : {};
  const adminGovernance =
    status === "incomplete"
      ? {
          source: "super_admin_user_management",
          status: "suspended",
          suspendedAt: new Date().toISOString()
        }
      : {
          restoredAt: new Date().toISOString(),
          source: "super_admin_user_management",
          status: "active"
        };

  await admin.from("user_subscriptions" as never).upsert(
    {
      limits_snapshot: {
        ...currentMetadata,
        adminGovernance
      },
      plan_id: plan.id,
      status,
      user_id: userId
    } as never,
    { onConflict: "user_id" }
  );

  await admin.from("billing_events" as never).insert({
    event_type: status === "active" ? "admin_user_restored" : "admin_user_suspended",
    provider: "admin",
    user_id: userId,
    payload: { governanceStatus: adminGovernance.status, status } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/subscriptions");
}

export async function suspendAdminUser(formData: FormData) {
  await updateUserSubscriptionStatus(String(formData.get("userId") ?? ""), "incomplete");
}

export async function restoreAdminUser(formData: FormData) {
  await updateUserSubscriptionStatus(String(formData.get("userId") ?? ""), "active");
}

export const activateAdminUser = restoreAdminUser;
