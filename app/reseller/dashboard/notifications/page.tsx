import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  archiveNotificationPlaceholder,
  markAllNotificationsReadPlaceholder,
  markNotificationReadPlaceholder,
  viewNotificationRelatedItemPlaceholder
} from "@/lib/reseller-showcase/notification-actions";
import {
  getResellerNotificationsData,
  type ResellerNotification,
  type ResellerNotificationPriority,
  type ResellerNotificationStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerNotificationStatus) {
  if (status === "unread") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "read") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-slate-200 text-slate-700";
}

function priorityClass(priority: ResellerNotificationPriority) {
  if (priority === "high") {
    return "bg-red-100 text-red-700";
  }

  if (priority === "low") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-blue-100 text-blue-700";
}

function NotificationHiddenFields({ notification }: { notification: ResellerNotification | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/notifications" />
      <input name="notificationReference" type="hidden" value={notification?.id ?? "notification-placeholder"} />
      <input name="relatedItem" type="hidden" value={notification?.relatedItem ?? "Related item placeholder"} />
      <input name="category" type="hidden" value={notification?.category ?? "listing_updates"} />
    </>
  );
}

function NotificationActions({ notification }: { notification: ResellerNotification | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markNotificationReadPlaceholder}>
        <NotificationHiddenFields notification={notification} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Mark read
        </button>
      </form>
      <form action={archiveNotificationPlaceholder}>
        <NotificationHiddenFields notification={notification} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Archive
        </button>
      </form>
      <form action={viewNotificationRelatedItemPlaceholder}>
        <NotificationHiddenFields notification={notification} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View related
        </button>
      </form>
    </div>
  );
}

export default async function ResellerNotificationsPage({ searchParams }: NotificationsPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerNotificationsData()]);

  return (
    <>
      <PageHeader
        description="Private reseller-scoped notifications for listings, templates, leads, messages, reviews, verification, subscriptions, and future delivery events."
        title="Notifications Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Notification placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Unread</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.unread}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">High priority</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.highPriority}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Archived</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.archived}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">This week</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.thisWeek}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Notification categories</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {data.categories.map((category) => (
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={category.value}>
                  {category.label}
                </span>
              ))}
            </div>
          </div>
          <form action={markAllNotificationsReadPlaceholder}>
            <input name="returnTo" type="hidden" value="/reseller/dashboard/notifications" />
            <button className="h-10 rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
              Mark all as read
            </button>
          </form>
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Notifications</p>
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
          {data.notifications.length ? (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Related item</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.notifications.map((notification) => (
                  <tr key={notification.id}>
                    <td className="px-4 py-4 font-black text-ink">{notification.title}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{notification.category}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(notification.status)}`}>
                        {notification.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${priorityClass(notification.priority)}`}>
                        {notification.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-muted">{notification.relatedItem}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{notification.createdAt ?? "Not tracked"}</td>
                    <td className="px-4 py-4">
                      <NotificationActions notification={notification} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">{data.emptyState}</p>
          )}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and scope</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Notifications are reseller-scoped and private. Buyer private email/phone, admin internal alerts,
          Store Owner notifications, external email/SMS/WhatsApp sends, wallets, payouts, withdrawals,
          commissions, ownership transfers, and fake sales are not exposed or created.
        </p>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
