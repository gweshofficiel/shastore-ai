import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { AdminNotificationControl } from "@/lib/admin/data";
import { loadPlatformNotificationControlSafe } from "@/lib/admin/notification-loader";
import {
  disableNotificationTemplatePlaceholder,
  markNotificationFailureReviewed,
  retryNotificationPlaceholder,
  viewNotificationDetails
} from "@/lib/admin/notification-actions";
import { getNotificationStatusBadgeTone } from "@/src/lib/notifications/notification-status-runtime";
import {
  getNotificationChannelBadgeTone,
  listNotificationChannelCatalog
} from "@/src/lib/notifications/notification-channel-runtime";

function NotificationRuntimeRecoveryNotice({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Notification registry recovery</p>
      <p className="mt-2 text-sm font-semibold text-amber-900">
        Notification registry data could not be loaded from runtime storage. The admin shell is still available with
        fallback registry rows.
      </p>
      <p className="mt-2 text-xs font-semibold text-amber-800">{message}</p>
    </div>
  );
}

function toneForChannelStatus(status: string) {
  if (["configured", "healthy", "read", "sent"].includes(status)) {
    return "green" as const;
  }

  if (["failed", "missing", "missing_config"].includes(status)) {
    return "red" as const;
  }

  if (["partial", "queued", "retry", "retry_pending", "unread", "warning"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function NotificationHiddenFields({
  log
}: {
  log: AdminNotificationControl["logs"][number];
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
  const { control, ok, warning } = await loadPlatformNotificationControlSafe();
  const recoveryMessage = warning ?? control.runtimeWarning ?? null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level notification governance across in-app, email, SMS, WhatsApp, system alerts, and future push notifications. This does not send Store Owner campaigns or modify user notification systems."
        title="Notification Center"
      />

      {!ok && recoveryMessage ? (
        <NotificationRuntimeRecoveryNotice message={recoveryMessage.slice(0, 500)} />
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Total notifications", value: control.overview.totalNotifications },
          { label: "Draft", value: control.overview.draft },
          { label: "Queued", value: control.overview.queued },
          { label: "Sent/delivered/read", value: control.overview.sent },
          { label: "Failed", value: control.overview.failed },
          { label: "Retry", value: control.overview.retry },
          { label: "Cancelled", value: control.overview.cancelled },
          { label: "Archived", value: control.overview.archived },
          { label: "Reviewed failures", value: control.overview.reviewedFailures },
          { label: "Registry configured", value: control.notificationRegistryStatusStats.configuredItems },
          { label: "Registry placeholders", value: control.notificationRegistryStatusStats.placeholderItems },
          { label: "In-app logs", value: control.notificationChannelStats.inAppItems },
          { label: "Email logs", value: control.notificationChannelStats.emailItems },
          { label: "System alert logs", value: control.notificationChannelStats.systemAlertItems },
          { label: "SMS placeholder", value: control.notificationChannelStats.smsItems },
          { label: "WhatsApp placeholder", value: control.notificationChannelStats.whatsappItems },
          { label: "Push placeholder", value: control.notificationChannelStats.pushItems }
        ]}
      />

      <AdminTable headers={["Channel", "Runtime", "Placeholder", "Logs", "Description"]}>
        {listNotificationChannelCatalog().map((entry) => {
          const channelView = control.channels.find((channel) => channel.channel === entry.channel);
          const logCount =
            entry.channel === "in_app"
              ? control.notificationChannelStats.inAppItems
              : entry.channel === "email"
                ? control.notificationChannelStats.emailItems
                : entry.channel === "system_alert"
                  ? control.notificationChannelStats.systemAlertItems
                  : entry.channel === "sms"
                    ? control.notificationChannelStats.smsItems
                    : entry.channel === "whatsapp"
                      ? control.notificationChannelStats.whatsappItems
                      : control.notificationChannelStats.pushItems;

          return (
            <tr key={entry.channel}>
              <td className="px-5 py-4">
                <AdminBadge tone={getNotificationChannelBadgeTone(entry.channel)}>{entry.label}</AdminBadge>
                <p className="mt-1 text-xs font-semibold text-slate-500">{entry.channel}</p>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForChannelStatus(channelView?.runtimeState ?? "placeholder")}>
                  {channelView?.runtimeState ?? "placeholder"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={entry.placeholderOnly ? "amber" : "green"}>
                  {entry.placeholderOnly ? "placeholder only" : "active foundation"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{logCount}</td>
              <td className="px-5 py-4 text-slate-600">{entry.description}</td>
            </tr>
          );
        })}
      </AdminTable>

      <AdminTable headers={["Delivery status", "Count", "Description"]}>
        {[
          { count: control.notificationDeliveryStatusStats.draftItems, status: "draft" as const },
          { count: control.notificationDeliveryStatusStats.queuedItems, status: "queued" as const },
          { count: control.notificationDeliveryStatusStats.sentItems, status: "sent" as const },
          { count: control.notificationDeliveryStatusStats.deliveredItems, status: "delivered" as const },
          { count: control.notificationDeliveryStatusStats.readItems, status: "read" as const },
          { count: control.notificationDeliveryStatusStats.failedItems, status: "failed" as const },
          { count: control.notificationDeliveryStatusStats.retryItems, status: "retry" as const },
          { count: control.notificationDeliveryStatusStats.cancelledItems, status: "cancelled" as const },
          { count: control.notificationDeliveryStatusStats.archivedItems, status: "archived" as const }
        ].map((entry) => (
          <tr key={entry.status}>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationStatusBadgeTone(entry.status)}>{entry.status}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{entry.count}</td>
            <td className="px-5 py-4 text-slate-600">Read-only delivery status summary. No queue execution connected.</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Channel", "Configured", "Health", "Secrets", "Runtime"]}>
        {control.channels.map((channel) => (
          <tr key={channel.channel}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{channel.channelLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{channel.channel}</p>
              {channel.placeholderOnly ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">Placeholder only</p>
              ) : null}
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForChannelStatus(channel.configuredStatus)}>{channel.configuredStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForChannelStatus(channel.healthStatus)}>{channel.healthStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={channel.secretStatus === "missing" ? "red" : "slate"}>{channel.secretStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForChannelStatus(channel.runtimeState)}>{channel.runtimeState}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Notification type", "Logs", "Description"]}>
        {control.types.map((type) => (
          <tr key={type.key}>
            <td className="px-5 py-4">
              <AdminBadge tone={type.badgeTone}>{type.label}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{type.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{type.count}</td>
            <td className="px-5 py-4 text-slate-600">{type.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.logs.length ? "No notification logs found." : null}
        headers={["Channel", "Type", "Recipient", "Store/user", "Status", "Created", "Error summary", "Safe actions"]}
      >
        {control.logs.map((log) => (
          <tr key={`${log.channel}:${log.id}`}>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(log.channel)}>{log.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.channel}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={log.typeBadgeTone}>{log.typeLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.type}</p>
            </td>
            <td className="px-5 py-4 font-bold text-slate-950">{log.recipientMasked}</td>
            <td className="px-5 py-4 text-slate-600">{log.storeOrUser}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationStatusBadgeTone(log.status)}>{log.statusLabel}</AdminBadge>
            </td>
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
            <td className="px-5 py-4"><AdminBadge tone={toneForChannelStatus(provider.configuredStatus)}>{provider.configuredStatus}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForChannelStatus(provider.healthStatus)}>{provider.healthStatus}</AdminBadge></td>
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
