import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { updateDeliveryNotificationStatusAction } from "@/lib/delivery/communication-actions";
import { getDeliveryNotifications } from "@/lib/delivery/communication-data";
import { requireDeliveryAccess } from "@/lib/delivery/access";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function categoryLabel(value: string) {
  return value.replaceAll("_", " ");
}

function statusMessage(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  const messages: Record<string, string> = {
    "notification-archived": "Notification archived.",
    "notification-failed": "Notification status could not be updated.",
    "notification-invalid": "Choose a valid notification action.",
    "notification-read": "Notification marked read."
  };

  return status ? messages[status] ?? null : null;
}

export default async function DeliveryNotificationsPage({
  searchParams
}: {
  searchParams?: Promise<{ delivery?: string | string[] }>;
}) {
  const query = await searchParams;
  const { agent } = await requireDeliveryAccess();
  const notifications = agent
    ? await getDeliveryNotifications({
        agentId: agent.agentId,
        storeId: agent.storeId,
        workspaceId: agent.workspaceId
      })
    : [];
  const message = statusMessage(query?.delivery);
  const unreadCount = notifications.filter((notification) => notification.status === "unread").length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery notifications
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Notifications Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Assignment, return, COD, performance, and system notices for this delivery account.
                </p>
              </div>
              <span className="rounded-full bg-emerald-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                {unreadCount} unread
              </span>
            </div>
          </section>

          {message ? (
            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
              {message}
            </section>
          ) : null}

          <section className="grid gap-4">
            {notifications.length ? notifications.map((notification) => (
              <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={notification.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
                      {categoryLabel(notification.category)}
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">
                      {notification.title}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                    notification.status === "unread" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {notification.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {notification.status === "unread" ? (
                    <form action={updateDeliveryNotificationStatusAction}>
                      <input name="notificationId" type="hidden" value={notification.id} />
                      <button className="rounded-full bg-emerald-950 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white" name="status" type="submit" value="read">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                  <form action={updateDeliveryNotificationStatusAction}>
                    <input name="notificationId" type="hidden" value={notification.id} />
                    <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700" name="status" type="submit" value="archived">
                      Archive
                    </button>
                  </form>
                </div>
              </article>
            )) : (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">No notifications yet</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
                  New assignments, returns, COD settlement, and performance notices will appear here.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
