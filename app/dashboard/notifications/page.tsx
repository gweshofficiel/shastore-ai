import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type NotificationRow = {
  created_at: string;
  id: string;
  message: string;
  read_at: string | null;
  status?: string | null;
  store_id?: string | null;
  title: string;
  type: string;
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function notificationTone(type: string, status: string | null | undefined, readAt: string | null) {
  if (status === "read" || readAt) {
    return "border-slate-200 bg-white";
  }

  if (type.includes("failed") || type.includes("restricted") || type.includes("cancelled") || type.includes("canceled")) {
    return "border-red-200 bg-red-50";
  }

  if (type.includes("grace") || type.includes("low_stock")) {
    return "border-amber-200 bg-amber-50";
  }

  return "border-emerald-200 bg-emerald-50";
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6">
        <PageHeader
          description="Sign in to review SHASTORE AI billing and account notifications."
          title="Notifications"
        />
        <Card>
          <p className="text-sm font-bold text-muted">Please sign in to view notifications.</p>
        </Card>
      </div>
    );
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const notificationScope = `user_id.eq.${user.id},workspace_id.eq.${selection.activeWorkspaceId}`;
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notifications" as never)
      .select("id, type, title, message, status, store_id, read_at, created_at")
      .or(notificationScope)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications" as never)
      .select("id", { count: "exact", head: true })
      .or(notificationScope)
      .eq("status" as never, "unread" as never)
  ]);

  if (error) {
    console.warn("[notification-count] notifications list failed", {
      message: error.message,
      userId: user.id
    });
  }

  if (countError) {
    console.warn("[notification-count] page unread count failed", {
      message: countError.message,
      userId: user.id
    });
  } else {
    console.info("[notification-count] page unread count loaded", {
      unreadCount: count ?? 0,
      userId: user.id
    });
  }

  const notifications = (data ?? []) as NotificationRow[];
  const unreadCount =
    count ??
    notifications.filter(
      (notification) => (notification.status ?? (notification.read_at ? "read" : "unread")) === "unread"
    ).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        description="In-app notifications for store orders, reviews, inventory, coupons, billing, and system events."
        title="Notifications"
      />
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-ink">{unreadCount} unread</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            This center is internal for now. Email, WhatsApp, and customer notifications can attach to the same event foundation later.
          </p>
        </div>
        {unreadCount ? (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </Card>
      <div className="grid gap-4">
        {notifications.length ? (
          notifications.map((notification) => (
            <Card
              className={`p-5 ${notificationTone(notification.type, notification.status, notification.read_at)}`}
              key={notification.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    {notification.type.replace(/_/g, " ")}
                  </p>
                  <h2 className="mt-2 text-lg font-black tracking-[-0.02em] text-ink">
                    {notification.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    {notification.message}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {formatNotificationDate(notification.created_at)}
                  </p>
                </div>
                {(notification.status ?? (notification.read_at ? "read" : "unread")) === "unread" ? (
                  <form action={markNotificationRead}>
                    <input name="notificationId" type="hidden" value={notification.id} />
                    <Button type="submit" variant="secondary">
                      Mark read
                    </Button>
                  </form>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-muted">
                    Read
                  </span>
                )}
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-bold text-muted">
              No notifications yet. Store orders, reviews, inventory alerts, coupons, and billing events will appear here.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
