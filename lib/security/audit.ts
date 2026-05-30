import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityAuditInput = {
  action: string;
  client?: SupabaseClient | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  reason: string;
  route?: string | null;
  storeId?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
};

function trimText(value: string | null | undefined, maxLength = 500) {
  return value?.trim().slice(0, maxLength) || null;
}

export async function getRequestAuditFields() {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

    return {
      ipAddress:
        forwardedFor ||
        headerStore.get("x-real-ip") ||
        headerStore.get("cf-connecting-ip") ||
        null,
      userAgent: headerStore.get("user-agent")
    };
  } catch {
    return {
      ipAddress: null,
      userAgent: null
    };
  }
}

export async function recordSecurityAuditLog({
  action,
  client,
  ipAddress,
  metadata = {},
  reason,
  route,
  storeId,
  userAgent,
  userId,
  workspaceId
}: SecurityAuditInput) {
  const auditClient = client ?? createAdminClient();

  if (!auditClient) {
    console.warn("[security-audit] log skipped; admin client unavailable", {
      action,
      reason,
      route,
      storeId,
      userId,
      workspaceId
    });
    return;
  }

  const { error } = await auditClient.from("security_audit_logs" as never).insert({
    action: action.slice(0, 160),
    ip_address: trimText(ipAddress, 120),
    metadata,
    reason: reason.slice(0, 500),
    route: trimText(route, 240),
    store_id: trimText(storeId, 80),
    user_agent: trimText(userAgent, 500),
    user_id: trimText(userId, 80),
    workspace_id: trimText(workspaceId, 80)
  } as never);

  if (error) {
    console.warn("[security-audit] log insert failed", {
      action,
      code: error.code,
      message: error.message,
      reason,
      route
    });
  }
}

export async function recordDeniedAccess(input: Omit<SecurityAuditInput, "action"> & { action?: string }) {
  const request = await getRequestAuditFields();
  await recordSecurityAuditLog({
    ...request,
    ...input,
    action: input.action ?? "access.denied"
  });
}
