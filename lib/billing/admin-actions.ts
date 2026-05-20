"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { getBillingPlan } from "@/lib/billing/plans";
import type { Database } from "@/types/database";

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

export async function overrideUserPlan(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const planId = String(formData.get("planId") ?? "free");
  const plan = getBillingPlan(planId);

  if (!userId) {
    throw new Error("Missing user ID");
  }

  const supabase = await getWritableBillingClient();
  await supabase.from("user_subscriptions" as never).upsert({
    plan_id: plan.id,
    status: "active",
    user_id: userId
  } as never, { onConflict: "user_id" });

  await supabase.from("billing_events" as never).insert({
    event_type: "manual_plan_override",
    provider: "admin",
    user_id: userId,
    payload: { planId: plan.id } as never,
    processed_at: new Date().toISOString()
  } as never);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");
}
