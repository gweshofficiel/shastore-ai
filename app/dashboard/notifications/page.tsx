import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NotificationRow = {
  created_at: string;
  id: string;
  message: string;
  read_at: string | null;
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

function notificationTone(type: string, readAt: string | null) {
  if (readAt) {
    return "border-slate-200 bg-white";
  }

  if (type.includes("failed") || type.includes("restricted") || type.includes("canceled")) {
    return "border-red-200 bg-red-50";
  }

  if (type.includes("grace")) {
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

  const { data } = await supabase
    .from("notifications" as never)
    .select("id, type, title, message, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const notifications = (data ?? []) as NotificationRow[];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Billing and system notifications for your SHASTORE AI workspace."
        title="Notifications"
      />
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-ink">{unreadCount} unread</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Payment and subscription notifications appear here first. Email delivery can attach to this foundation later.
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
              className={`p-5 ${notificationTone(notification.type, notification.read_at)}`}
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
                {!notification.read_at ? (
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
              No notifications yet. Billing recovery events will appear here.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
