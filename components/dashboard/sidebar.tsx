import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { DashboardNavLink } from "@/components/dashboard/nav-link";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceForUser,
  switchActiveWorkspace
} from "@/lib/workspaces/active-workspace";
import { dashboardRoutePermissions, hasPermission } from "@/lib/permissions/rbac";

async function getUnreadNotificationCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { count, error } = await supabase
    .from("notifications" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    console.warn("[notification-count] unread count failed", {
      message: error.message,
      userId
    });
    return 0;
  }

  const unreadCount = count ?? 0;

  console.info("[notification-count] unread count loaded", {
    unreadCount,
    userId
  });

  return unreadCount;
}

export async function Sidebar() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [unreadNotifications, selection] = user
    ? await Promise.all([
        getUnreadNotificationCount(supabase, user.id),
        getActiveWorkspaceForUser({ supabase, userId: user.id })
      ])
    : [0, null];

  return (
    <aside className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link className="text-lg font-black tracking-[-0.03em] text-ink" href="/">
            SHASTORE AI
          </Link>
          <p className="hidden text-xs font-semibold text-muted lg:mt-1 lg:block">
            AI landing page studio
          </p>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400 lg:hidden">
            Dashboard
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pb-1">
          {dashboardRoutePermissions
            .filter(
              (item) =>
                (!("showInSidebar" in item) || item.showInSidebar !== false) &&
                hasPermission(selection?.activeWorkspaceRole, item.permission)
            )
            .map((item) => {
            return (
              <DashboardNavLink
                href={item.href}
                icon={item.icon as never}
                key={item.href}
                label={item.label}
                badge={item.href === "/dashboard/notifications" ? unreadNotifications : undefined}
              />
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:block">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>
          {selection ? (
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl bg-white p-3">
                {selection.isStaffLocked ? (
                  <>
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-ink">
                      {selection.activeWorkspaceRole}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                      Assigned mission: workspace tasks and support queue.
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-black text-ink">
                    {selection.activeWorkspaceId === user?.id
                      ? "Your workspace"
                      : `Assigned workspace ${selection.activeWorkspaceId.slice(0, 8)}`}
                  </p>
                )}
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  {selection.staffId ?? selection.activeWorkspaceRole}
                </p>
                {selection.managerEmail ? (
                  <p className="mt-1 text-xs font-semibold text-muted">
                    Manager: {selection.managerEmail}
                  </p>
                ) : null}
              </div>
              {!selection.isStaffLocked && selection.workspaces.length > 1 ? (
                <form action={switchActiveWorkspace} className="grid gap-3">
                  <input name="next" type="hidden" value="/dashboard" />
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                    defaultValue={selection.activeWorkspaceId}
                    name="workspaceId"
                  >
                    {selection.workspaces.map((workspace) => (
                      <option key={workspace.workspaceId} value={workspace.workspaceId}>
                        {workspace.isPersonal
                          ? "Your workspace"
                          : `Assigned workspace ${workspace.workspaceId.slice(0, 8)}`}{" "}
                        - {workspace.role}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary">
                    Switch workspace
                  </Button>
                </form>
              ) : selection.isStaffLocked ? (
                <p className="text-xs font-semibold leading-5 text-muted">
                  Staff accounts are locked to assigned workspaces.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Generate copy, publish pages, and manage domains from one place.
            </p>
          )}
        </div>
        <form action={logout} className="hidden pt-4 lg:block">
          <Button className="w-full" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
