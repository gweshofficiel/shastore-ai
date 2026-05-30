import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingEnforcementError } from "@/lib/billing/enforcement";
import type { UserSubscriptionAccess } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recordSubscriptionEnforcementLog({
  access,
  action,
  error,
  storeId,
  supabase,
  workspaceId
}: {
  access: UserSubscriptionAccess;
  action: string;
  error: unknown;
  storeId?: string | null;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const enforcementError = error as Partial<BillingEnforcementError>;
  const reason =
    typeof enforcementError.userMessage === "string"
      ? enforcementError.userMessage
      : error instanceof Error
        ? error.message
        : "Subscription enforcement blocked this action.";

  try {
    const client = createAdminClient() ?? supabase;
    const { error: insertError } = await client
      .from("subscription_enforcement_logs" as never)
      .insert({
        action,
        plan_key: access.plan.id,
        reason: reason.slice(0, 500),
        status: access.status,
        store_id: storeId ?? null,
        user_id: access.userId,
        workspace_id: workspaceId
      } as never);

    if (insertError) {
      console.warn("[subscription-enforcement] audit log insert failed", {
        action,
        code: insertError.code,
        message: insertError.message,
        workspaceId
      });
    }
  } catch (logError) {
    console.warn("[subscription-enforcement] audit log failed safely", {
      action,
      message: logError instanceof Error ? logError.message : String(logError),
      workspaceId
    });
  }
}
