"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import {
  normalizeStoreSecuritySettings,
  securityAuditActions,
  securitySessionTimeoutOptions
} from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const securityPath = "/dashboard/security";

function securityWith(status: string, storeId?: string): never {
  const params = new URLSearchParams({ security: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${securityPath}?${params.toString()}`);
}

function cleanId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireSecurityStoreAccess(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    securityWith("not-authorized", storeId);
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { data: membership } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = membership as {
    permission_overrides?: Record<string, boolean> | null;
    role?: string | null;
    status?: string | null;
  } | null;

  if (member?.status && member.status !== "active") {
    securityWith("not-authorized", storeId);
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    securityWith("not-authorized", storeId);
  }

  const { data: store } = await supabase
    .from("stores" as never)
    .select("id, slug, workspace_id, security_settings")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();
  const storeRow = store as {
    id: string;
    security_settings?: unknown;
    slug?: string | null;
    workspace_id: string;
  } | null;

  if (!storeRow) {
    securityWith("not-authorized", storeId);
  }

  return { store: storeRow, supabase, user, workspaceId };
}

export async function saveStoreSecuritySettingsAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));

  if (!storeId) {
    securityWith("missing-store");
  }

  const { store, supabase, user, workspaceId } = await requireSecurityStoreAccess(storeId);
  const allowedMinutes = new Set<number>(securitySessionTimeoutOptions.map((option) => option.minutes));
  const sessionTimeoutMinutes = Number(formData.get("sessionTimeoutMinutes"));
  const settings = normalizeStoreSecuritySettings({
    loginAlertsEnabled: formData.get("loginAlertsEnabled") === "on",
    sessionTimeoutMinutes: allowedMinutes.has(sessionTimeoutMinutes) ? sessionTimeoutMinutes : 480,
    suspiciousLoginAlertsEnabled: formData.get("suspiciousLoginAlertsEnabled") === "on"
  });

  const { error } = await supabase
    .from("stores" as never)
    .update({ security_settings: settings } as never)
    .eq("id" as never, store.id as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    securityWith("save-failed", storeId);
  }

  await recordWorkspaceActivitySafe({
    action: "security.settings.updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: store.id,
    entityType: "store_security_settings",
    metadata: {
      loginAlertsEnabled: settings.loginAlertsEnabled,
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      suspiciousLoginAlertsEnabled: settings.suspiciousLoginAlertsEnabled
    },
    storeId: store.id,
    workspaceId
  });

  revalidatePath(securityPath);
  securityWith("saved", storeId);
}

export async function forceLogoutAllSessionsAction(formData: FormData) {
  const storeId = cleanId(formData.get("storeId"));

  if (!storeId) {
    securityWith("missing-store");
  }

  const { store, user, workspaceId } = await requireSecurityStoreAccess(storeId);
  const admin = createAdminClient();
  const request = await getRequestAuditFields();

  if (!admin) {
    securityWith("logout-failed", storeId);
  }

  const { data: sessions } = await admin
    .from("store_security_sessions" as never)
    .select("id, user_id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("is_active" as never, true as never)
    .is("revoked_at" as never, null as never);
  const activeSessions = (sessions ?? []) as Array<{ id: string; user_id: string }>;
  const uniqueUserIds = Array.from(new Set(activeSessions.map((session) => session.user_id)));

  for (const targetUserId of uniqueUserIds) {
    const { error } = await admin.auth.admin.signOut(targetUserId, "global");

    if (error) {
      console.warn("[security-center] global sign out failed", {
        message: error.message,
        targetUserId: targetUserId.slice(0, 8)
      });
    }
  }

  const revokedAt = new Date().toISOString();

  await admin
    .from("store_security_sessions" as never)
    .update({
      is_active: false,
      revoked_at: revokedAt
    } as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("is_active" as never, true as never);

  await recordSecurityAuditLog({
    action: securityAuditActions.forceLogoutAll,
    ipAddress: request.ipAddress,
    metadata: {
      revokedSessionCount: activeSessions.length,
      targetUserCount: uniqueUserIds.length
    },
    reason: `Force logout triggered for workspace sessions (${uniqueUserIds.length} users).`,
    route: securityPath,
    storeId: store.id,
    userAgent: request.userAgent,
    userId: user.id,
    workspaceId
  });

  await recordWorkspaceActivitySafe({
    action: "security.session.force_logout_all",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: store.id,
    entityType: "store_security",
    metadata: {
      revokedSessionCount: activeSessions.length,
      targetUserCount: uniqueUserIds.length
    },
    storeId: store.id,
    workspaceId
  });

  revalidatePath(securityPath);
  securityWith("logout-all", storeId);
}

export async function touchCurrentSecuritySessionAction(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return;
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const admin = createAdminClient();
  const request = await getRequestAuditFields();

  if (!admin) {
    return;
  }

  const { browserLabel, deviceLabel } = summarizeUserAgent(request.userAgent);
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("store_security_sessions" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("user_id" as never, user.id as never)
    .eq("is_active" as never, true as never)
    .is("revoked_at" as never, null as never)
    .order("last_seen_at" as never, { ascending: false } as never)
    .limit(1)
    .maybeSingle();

  const existingRow = existing as { id?: string } | null;

  if (existingRow?.id) {
    await admin
      .from("store_security_sessions" as never)
      .update({
        browser_label: browserLabel,
        device_label: deviceLabel,
        ip_address: request.ipAddress,
        last_seen_at: now,
        store_id: storeId,
        user_agent: request.userAgent
      } as never)
      .eq("id" as never, existingRow.id as never);
    return;
  }

  await admin.from("store_security_sessions" as never).insert({
    actor_email: user.email,
    browser_label: browserLabel,
    device_label: deviceLabel,
    ip_address: request.ipAddress,
    is_active: true,
    last_seen_at: now,
    store_id: storeId,
    user_agent: request.userAgent,
    user_id: user.id,
    workspace_id: workspaceId
  } as never);
}
