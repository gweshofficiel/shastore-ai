import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmSubmitButton } from "@/components/dashboard/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import {
  forceLogoutAllSessionsAction,
  saveStoreSecuritySettingsAction,
  touchCurrentSecuritySessionAction
} from "@/lib/store-security-actions";
import {
  isSecurityActivityAction,
  isTeamSecurityActivityAction,
  maskUserId,
  normalizeStoreSecuritySettings,
  securityAuditActions,
  securitySessionTimeoutOptions
} from "@/lib/store-security";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getWorkspaceMembers } from "@/lib/workspace-members";

export const dynamic = "force-dynamic";

type SecurityPageProps = {
  searchParams: Promise<{
    security?: string;
    storeId?: string;
  }>;
};

type SecurityStoreRow = {
  id: string;
  name: string;
  security_settings?: unknown;
  slug: string | null;
};

type SecuritySessionRow = {
  actor_email: string | null;
  browser_label: string | null;
  created_at: string;
  device_label: string | null;
  id: string;
  ip_address: string | null;
  is_active: boolean;
  last_seen_at: string;
  store_id: string | null;
  user_agent: string | null;
  user_id: string;
};

type SecurityAuditRow = {
  action: string;
  created_at: string;
  id: string;
  ip_address: string | null;
  reason: string;
  route: string | null;
  store_id: string | null;
  user_agent: string | null;
  user_id: string | null;
};

type WorkspaceActivityRow = {
  action: string;
  actor_email: string | null;
  actor_user_id: string | null;
  created_at: string;
  entity_type: string;
  id: string;
  metadata: Record<string, unknown> | null;
  store_id: string | null;
};

type WorkspaceInviteRow = {
  created_at: string;
  email: string;
  id: string;
  role: string;
  status: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatLabel(value: string | null | undefined) {
  return (value || "unknown").replace(/[._-]/g, " ");
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "logout-all": "All tracked workspace sessions were signed out.",
    "logout-failed": "Sessions could not be revoked. Check the security center migration.",
    "missing-store": "Choose a store before saving security settings.",
    "not-authorized": "You do not have permission to manage security for that store.",
    saved: "Security settings saved.",
    "save-failed": "Security settings could not be saved."
  };

  return status ? messages[status] ?? null : null;
}

function sessionScopeLabel(session: SecuritySessionRow, activeStoreId: string) {
  if (!session.store_id) {
    return "Workspace-wide";
  }

  return session.store_id === activeStoreId ? "This store" : "Other store";
}

async function getSecurityCenterData(selectedStoreId?: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const emptySecurityData = {
    activeStore: null as UserStoreRow | null,
    activityEvents: [] as Array<{ action: string; created_at: string; id: string; source: string }>,
    auditEvents: [] as SecurityAuditRow[],
    error: null as string | null,
    failedLogins: [] as SecurityAuditRow[],
    invitedMembers: [] as WorkspaceInviteRow[],
    passwordResets: [] as SecurityAuditRow[],
    recentLogins: [] as SecurityAuditRow[],
    securityStore: null as SecurityStoreRow | null,
    sessions: [] as SecuritySessionRow[],
    stores: [] as UserStoreRow[],
    suspendedMembers: [] as Array<{ id: string; role: string; status: string; user_id: string }>,
    teamAuditEvents: [] as WorkspaceActivityRow[],
    teamLoginEvents: [] as Array<{ action: string; created_at: string; id: string }>
  };

  if (!user) {
    return { ...emptySecurityData, error: "Sign in to review store security." };
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
    return { ...emptySecurityData, error: "You do not have permission to manage security." };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { ...emptySecurityData, error: "You do not have permission to manage security." };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      ...emptySecurityData,
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      stores
    };
  }

  await touchCurrentSecuritySessionAction(activeStore.id);

  const { data: storeData, error: storeError } = await supabase
    .from("stores" as never)
    .select("id, name, slug, security_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (storeError) {
    return {
      ...emptySecurityData,
      activeStore,
      error: "Security settings could not be loaded. Apply the security center migration.",
      stores
    };
  }

  const scopeFilter = `store_id.eq.${activeStore.id},and(store_id.is.null,workspace_id.eq.${workspaceId})`;

  const [
    sessionsResult,
    auditResult,
    activityResult,
    roster
  ] = await Promise.all([
    supabase
      .from("store_security_sessions" as never)
      .select(
        "id, user_id, actor_email, store_id, ip_address, user_agent, device_label, browser_label, is_active, last_seen_at, created_at"
      )
      .eq("workspace_id" as never, workspaceId as never)
      .or(scopeFilter as never)
      .order("last_seen_at", { ascending: false })
      .limit(40),
    supabase
      .from("security_audit_logs" as never)
      .select("id, user_id, action, reason, route, ip_address, user_agent, store_id, created_at")
      .or(scopeFilter as never)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("workspace_activity_logs" as never)
      .select("id, store_id, actor_user_id, actor_email, action, entity_type, metadata, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .or(`store_id.eq.${activeStore.id},store_id.is.null` as never)
      .order("created_at", { ascending: false })
      .limit(80),
    getWorkspaceMembers(supabase, workspaceId, user.id)
  ]);

  const sessions = (sessionsResult.data ?? []) as unknown as SecuritySessionRow[];
  const auditEvents = ((auditResult.data ?? []) as unknown as SecurityAuditRow[]).filter((event) =>
    isSecurityActivityAction(event.action)
  );
  const workspaceActivity = (activityResult.data ?? []) as unknown as WorkspaceActivityRow[];
  const recentLogins = auditEvents.filter(
    (event) =>
      event.action === securityAuditActions.loginSuccess
      || event.action === securityAuditActions.loginFailed
      || event.action === securityAuditActions.suspiciousLogin
  );
  const failedLogins = auditEvents.filter((event) => event.action === securityAuditActions.loginFailed);
  const passwordResets = auditEvents.filter(
    (event) => event.action === securityAuditActions.passwordResetRequested
  );
  const teamLoginEvents = [
    ...auditEvents.filter((event) => event.action.includes("login")),
    ...workspaceActivity.filter((event) => event.action.toLowerCase().includes("login"))
  ].slice(0, 20);
  const teamAuditEvents = workspaceActivity.filter((event) => isTeamSecurityActivityAction(event.action));
  const invitedMembers = ((roster.invites ?? []) as WorkspaceInviteRow[]).filter(
    (invite) => invite.status === "pending"
  );
  const suspendedMembers = (roster.members ?? []).filter((member) =>
    ["suspended", "banned", "removed", "pending"].includes(member.status)
  );

  const activityEvents = [
    ...auditEvents.map((event) => ({ ...event, source: "security" })),
    ...workspaceActivity
      .filter((event) => isSecurityActivityAction(event.action) || isTeamSecurityActivityAction(event.action))
      .map((event) => ({ ...event, source: "workspace" }))
  ]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 30);

  return {
    activeStore,
    activityEvents,
    auditEvents,
    error: null,
    failedLogins,
    invitedMembers,
    passwordResets,
    recentLogins,
    securityStore: storeData as unknown as SecurityStoreRow | null,
    sessions: sessions.filter((session) => session.is_active),
    stores,
    suspendedMembers,
    teamAuditEvents: teamAuditEvents.slice(0, 15),
    teamLoginEvents
  };
}

export default async function SecurityCenterPage({ searchParams }: SecurityPageProps) {
  const query = await searchParams;
  const data = await getSecurityCenterData(query.storeId);
  const settings = normalizeStoreSecuritySettings(data.securityStore?.security_settings);
  const message = statusMessage(query.security);
  const activeStoreId = data.activeStore?.id ?? "";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Centralized login activity, active sessions, security alerts, and team access review for your store workspace."
        title="Security Center"
      />

      {data.error ? (
        <Card className="p-6">
          <p className="text-sm font-bold text-muted">{data.error}</p>
        </Card>
      ) : null}

      {message ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-800">{message}</p>
        </Card>
      ) : null}

      {data.stores.length > 1 ? (
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Store scope</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.stores.map((store) => (
              <a
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                  store.id === activeStoreId
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                href={`/dashboard/security?storeId=${encodeURIComponent(store.id)}`}
                key={store.id}
              >
                {store.name}
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      {data.activeStore && data.securityStore ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Recent logins</p>
              <p className="mt-2 text-3xl font-black text-ink">{data.recentLogins.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Active sessions</p>
              <p className="mt-2 text-3xl font-black text-ink">{data.sessions.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Failed logins</p>
              <p className="mt-2 text-3xl font-black text-ink">{data.failedLogins.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Suspended members</p>
              <p className="mt-2 text-3xl font-black text-ink">{data.suspendedMembers.length}</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Recent logins</h2>
              <p className="mt-2 text-sm font-semibold text-muted">
                Latest successful and failed sign-in events for this store workspace.
              </p>
              <div className="mt-5 grid gap-3">
                {data.recentLogins.length ? (
                  data.recentLogins.slice(0, 8).map((event) => (
                    <div className="rounded-2xl border border-slate-200 p-4" key={event.id}>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        {formatLabel(event.action)}
                      </p>
                      <p className="mt-2 text-sm font-bold text-ink">{event.reason}</p>
                      <p className="mt-2 text-xs font-semibold text-muted">
                        User {maskUserId(event.user_id)} • {event.ip_address ?? "IP not recorded"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        {event.user_agent ? `${event.user_agent.slice(0, 80)}…` : "Browser not recorded"}
                      </p>
                      <p className="mt-2 text-xs font-black text-slate-500">{formatDate(event.created_at)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-muted">No login events recorded yet.</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Active sessions</h2>
              <p className="mt-2 text-sm font-semibold text-muted">
                Device and browser labels are derived from user-agent data when available.
              </p>
              <div className="mt-5 grid gap-3">
                {data.sessions.length ? (
                  data.sessions.slice(0, 8).map((session) => (
                    <div className="rounded-2xl border border-slate-200 p-4" key={session.id}>
                      <p className="text-sm font-bold text-ink">
                        {session.actor_email ?? maskUserId(session.user_id)}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {session.device_label ?? "Unknown device"} • {session.browser_label ?? "Unknown browser"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        {sessionScopeLabel(session, activeStoreId)} • {session.ip_address ?? "IP not recorded"}
                      </p>
                      <p className="mt-2 text-xs font-black text-slate-500">
                        Last seen {formatDate(session.last_seen_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-muted">No active sessions tracked yet.</p>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Security settings</h2>
            <p className="mt-2 text-sm font-semibold text-muted">
              Configure alerts and session policy for {data.securityStore.name}. Session timeout is stored for
              enforcement in a later phase; credentials are never shown here.
            </p>
            <form action={saveStoreSecuritySettingsAction} className="mt-6 grid gap-5">
              <input name="storeId" type="hidden" value={activeStoreId} />
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Session timeout
                </span>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-ink"
                  defaultValue={String(settings.sessionTimeoutMinutes)}
                  name="sessionTimeoutMinutes"
                >
                  {securitySessionTimeoutOptions.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input
                  defaultChecked={settings.loginAlertsEnabled}
                  name="loginAlertsEnabled"
                  type="checkbox"
                  value="on"
                />
                <span className="text-sm font-bold text-ink">Enable login alerts</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input
                  defaultChecked={settings.suspiciousLoginAlertsEnabled}
                  name="suspiciousLoginAlertsEnabled"
                  type="checkbox"
                  value="on"
                />
                <span className="text-sm font-bold text-ink">Enable suspicious login alerts</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">Save security settings</Button>
              </div>
            </form>
            <form action={forceLogoutAllSessionsAction} className="mt-4">
              <input name="storeId" type="hidden" value={activeStoreId} />
              <ConfirmSubmitButton
                confirmMessage="Sign out all tracked workspace sessions for every team member? You will also be signed out."
                type="submit"
                variant="secondary"
              >
                Force logout all sessions
              </ConfirmSubmitButton>
            </form>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Security activity</h2>
              <div className="mt-5 grid gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Failed login attempts</p>
                  <div className="mt-3 grid gap-2">
                    {data.failedLogins.length ? (
                      data.failedLogins.slice(0, 5).map((event) => (
                        <p className="text-sm font-semibold text-muted" key={event.id}>
                          {event.reason} • {formatDate(event.created_at)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No failed login attempts recorded.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Password reset requests
                  </p>
                  <div className="mt-3 grid gap-2">
                    {data.passwordResets.length ? (
                      data.passwordResets.slice(0, 5).map((event) => (
                        <p className="text-sm font-semibold text-muted" key={event.id}>
                          {event.reason} • {formatDate(event.created_at)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No password reset requests recorded yet.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Team member login events
                  </p>
                  <div className="mt-3 grid gap-2">
                    {data.teamLoginEvents.length ? (
                      data.teamLoginEvents.slice(0, 5).map((event) => (
                        <p className="text-sm font-semibold text-muted" key={event.id}>
                          {formatLabel(event.action)} • {formatDate(event.created_at)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No team login events recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Team security</h2>
              <div className="mt-5 grid gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Invited members</p>
                  <div className="mt-3 grid gap-2">
                    {data.invitedMembers.length ? (
                      data.invitedMembers.map((invite) => (
                        <p className="text-sm font-semibold text-muted" key={invite.id}>
                          {invite.email} • {formatLabel(invite.role)} • {formatDate(invite.created_at)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No pending invitations.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suspended members</p>
                  <div className="mt-3 grid gap-2">
                    {data.suspendedMembers.length ? (
                      data.suspendedMembers.map((member) => (
                        <p className="text-sm font-semibold text-muted" key={member.id}>
                          {maskUserId(member.user_id)} • {formatLabel(member.status)} • {formatLabel(member.role)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No suspended or restricted members.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Security-related audit events
                  </p>
                  <div className="mt-3 grid gap-2">
                    {data.teamAuditEvents.length ? (
                      data.teamAuditEvents.map((event) => (
                        <p className="text-sm font-semibold text-muted" key={event.id}>
                          {formatLabel(event.action)} • {event.actor_email ?? maskUserId(event.actor_user_id)} •{" "}
                          {formatDate(event.created_at)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-muted">No team security audit events yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Recent security timeline</h2>
            <div className="mt-5 grid gap-3">
              {data.activityEvents.length ? (
                data.activityEvents.map((event) => (
                  <div className="rounded-2xl border border-slate-200 p-4" key={`${event.source}-${event.id}`}>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      {event.source === "security" ? "Security audit" : "Workspace activity"}
                    </p>
                    <p className="mt-2 text-sm font-bold text-ink">{formatLabel(event.action)}</p>
                    <p className="mt-2 text-xs font-black text-slate-500">{formatDate(event.created_at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-muted">No security timeline events yet.</p>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
