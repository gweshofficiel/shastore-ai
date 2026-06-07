import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminNotificationControl } from "@/lib/admin/data";
import {
  disableNotificationTemplatePlaceholder,
  markNotificationFailureReviewed,
  retryNotificationPlaceholder,
  viewNotificationDetails
} from "@/lib/admin/notification-actions";

function toneForStatus(status: string) {
  if (["configured", "healthy", "read", "sent"].includes(status)) {
    return "green" as const;
  }

  if (["failed", "missing", "missing_config"].includes(status)) {
    return "red" as const;
  }

  if (["partial", "queued", "retry_pending", "unread", "warning"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function NotificationHiddenFields({
  log
}: {
  log: Awaited<ReturnType<typeof getAdminNotificationControl>>["logs"][number];
}) {
  return (
    <>
      <input name="notificationId" type="hidden" value={log.id} />
      <input name="notificationType" type="hidden" value={log.type} />
      <input name="channel" type="hidden" value={log.channel} />
    </>
  );
}

export default async function AdminNotificationsPage() {
  const control = await getAdminNotificationControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level notification governance across in-app, email, SMS, WhatsApp, system alerts, and future push notifications. This does not send Store Owner campaigns or modify user notification systems."
        title="Notification Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Total notifications", value: control.overview.totalNotifications },
          { label: "Sent/read", value: control.overview.sent },
          { label: "Failed", value: control.overview.failed },
          { label: "Queued/retry", value: control.overview.queued },
          { label: "Unread", value: control.overview.unread },
          { label: "Reviewed failures", value: control.overview.reviewedFailures },
          { label: "SMS sends", value: 0 },
          { label: "WhatsApp sends", value: 0 }
        ]}
      />

      <AdminTable headers={["Channel", "Configured", "Health", "Secrets"]}>
        {control.channels.map((channel) => (
          <tr key={channel.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{channel.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{channel.key}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(channel.configuredStatus)}>{channel.configuredStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(channel.healthStatus)}>{channel.healthStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={channel.secretStatus === "missing" ? "red" : "slate"}>{channel.secretStatus}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Notification type", "Logs"]}>
        {control.types.map((type) => (
          <tr key={type.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{type.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{type.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{type.count}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.logs.length ? "No notification logs found." : null}
        headers={["Channel", "Type", "Recipient", "Store/user", "Status", "Created", "Error summary", "Safe actions"]}
      >
        {control.logs.map((log) => (
          <tr key={`${log.channel}:${log.id}`}>
            <td className="px-5 py-4"><AdminBadge tone="blue">{log.channel}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{log.type}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{log.recipientMasked}</td>
            <td className="px-5 py-4 text-slate-600">{log.storeOrUser}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(log.status)}>{log.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(log.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{log.errorSummary ?? "No safe error summary."}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markNotificationFailureReviewed}>
                  <NotificationHiddenFields log={log} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Mark reviewed
                  </button>
                </form>
                <form action={retryNotificationPlaceholder}>
                  <NotificationHiddenFields log={log} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Retry placeholder
                  </button>
                </form>
                <form action={disableNotificationTemplatePlaceholder}>
                  <NotificationHiddenFields log={log} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Disable template
                  </button>
                </form>
                <form action={viewNotificationDetails}>
                  <NotificationHiddenFields log={log} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    View details
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Provider", "Configured", "Health", "Secrets"]}>
        {control.providerStatus.map((provider) => (
          <tr key={provider.provider}>
            <td className="px-5 py-4 font-bold text-slate-950">{provider.provider}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(provider.configuredStatus)}>{provider.configuredStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(provider.healthStatus)}>{provider.healthStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={provider.secretStatus === "missing" ? "red" : "slate"}>{provider.secretStatus}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
