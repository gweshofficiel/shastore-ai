import { getUserPrimaryWorkspaceId } from "@/lib/permissions/rbac";
import { securityAuditActions } from "@/lib/store-security";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { createAdminClient } from "@/lib/supabase/admin";

type LoginAttemptInput = {
  email: string;
  route?: string;
  storeId?: string | null;
  success: boolean;
  userId?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().slice(0, 254);
}

async function resolveWorkspaceId(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  try {
    return await getUserPrimaryWorkspaceId(admin, userId);
  } catch {
    return null;
  }
}

async function upsertSecuritySession({
  actorEmail,
  ipAddress,
  storeId,
  userAgent,
  userId,
  workspaceId
}: {
  actorEmail: string;
  ipAddress: string | null;
  storeId?: string | null;
  userAgent: string | null;
  userId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { browserLabel, deviceLabel } = summarizeUserAgent(userAgent);
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("store_security_sessions" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("user_id" as never, userId as never)
    .eq("is_active" as never, true as never)
    .eq("ip_address" as never, ipAddress ?? "" as never)
    .eq("user_agent" as never, userAgent ?? "" as never)
    .is("revoked_at" as never, null as never)
    .order("last_seen_at" as never, { ascending: false } as never)
    .limit(1)
    .maybeSingle();

  const existingRow = existing as { id?: string } | null;

  if (existingRow?.id) {
    await admin
      .from("store_security_sessions" as never)
      .update({
        actor_email: actorEmail,
        browser_label: browserLabel,
        device_label: deviceLabel,
        last_seen_at: now,
        store_id: storeId ?? null
      } as never)
      .eq("id" as never, existingRow.id as never);
    return;
  }

  await admin.from("store_security_sessions" as never).insert({
    actor_email: actorEmail,
    browser_label: browserLabel,
    device_label: deviceLabel,
    ip_address: ipAddress,
    is_active: true,
    last_seen_at: now,
    store_id: storeId ?? null,
    user_agent: userAgent,
    user_id: userId,
    workspace_id: workspaceId
  } as never);
}

export async function recordAuthLoginAttempt({
  email,
  route = "/login",
  storeId = null,
  success,
  userId = null
}: LoginAttemptInput) {
  const normalizedEmail = normalizeEmail(email);
  const request = await getRequestAuditFields();
  const workspaceId = await resolveWorkspaceId(userId);
  const action = success ? securityAuditActions.loginSuccess : securityAuditActions.loginFailed;
  const reason = success
    ? `Successful login for ${normalizedEmail}.`
    : `Failed login attempt for ${normalizedEmail}.`;

  await recordSecurityAuditLog({
    action,
    ipAddress: request.ipAddress,
    metadata: {
      emailDomain: normalizedEmail.includes("@") ? normalizedEmail.split("@")[1] : null,
      loginOutcome: success ? "success" : "failed"
    },
    reason,
    route,
    storeId,
    userAgent: request.userAgent,
    userId,
    workspaceId
  });

  if (success && userId && workspaceId) {
    await upsertSecuritySession({
      actorEmail: normalizedEmail,
      ipAddress: request.ipAddress,
      storeId,
      userAgent: request.userAgent,
      userId,
      workspaceId
    });
  }
}

export async function recordPasswordResetRequest({
  email,
  route = "/auth/reset-password",
  storeId = null,
  workspaceId = null
}: {
  email: string;
  route?: string;
  storeId?: string | null;
  workspaceId?: string | null;
}) {
  const normalizedEmail = normalizeEmail(email);
  const request = await getRequestAuditFields();

  await recordSecurityAuditLog({
    action: securityAuditActions.passwordResetRequested,
    ipAddress: request.ipAddress,
    metadata: {
      emailDomain: normalizedEmail.includes("@") ? normalizedEmail.split("@")[1] : null
    },
    reason: `Password reset requested for ${normalizedEmail}.`,
    route,
    storeId,
    userAgent: request.userAgent,
    workspaceId
  });
}
