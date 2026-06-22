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
  markNotificationFailureReviewed,
  viewNotificationDetails
} from "@/lib/admin/notification-actions";
import { getNotificationStatusBadgeTone } from "@/src/lib/notifications/notification-status-runtime";
import {
  getNotificationChannelBadgeTone,
  listNotificationChannelCatalog
} from "@/src/lib/notifications/notification-channel-runtime";
import {
  getNotificationCategoryBadgeTone,
  listNotificationCategoryCatalog
} from "@/src/lib/notifications/notification-category-runtime";
import { listNotificationProviderCatalog } from "@/src/lib/notifications/notification-provider-runtime";
import { getNotificationAnalyticsDimensionLabel } from "@/src/lib/notifications/notification-analytics-runtime";
import { getNotificationHealthDomainLabel } from "@/src/lib/notifications/notification-health-runtime";
import {
  getNotificationRecipientTypeLabel,
  sanitizeNotificationRecipientDisplaySafe
} from "@/src/lib/notifications/notification-recipient-runtime";
import {
  getNotificationReviewStatusLabel
} from "@/src/lib/notifications/notification-review-runtime";
import {
  buildNotificationLogSafeActionsSafe,
  type NotificationSafeAction,
  type NotificationSafeActionDefinition,
  type NotificationSafeActionTone
} from "@/src/lib/notifications/notification-safe-action-runtime";
import {
  getNotificationErrorSanitizationFallback,
  sanitizeNotificationErrorDisplaySafe,
  type NotificationErrorSanitizationSource
} from "@/src/lib/notifications/notification-error-sanitization-runtime";
import {
  getNotificationProviderAbstractionStatusLabel
} from "@/src/lib/notifications/notification-provider-abstraction-runtime";
import {
  getNotificationReadOnlyProtectionSurfaceLabel
} from "@/src/lib/notifications/notification-read-only-protection-runtime";
import {
  getNotificationDataCertificationStatusLabel,
  getNotificationDataCertificationSurfaceLabel
} from "@/src/lib/notifications/notification-data-certification-runtime";
import {
  getNotificationEventTypeLabel
} from "@/src/lib/notifications/notification-event-runtime";
import {
  getNotificationSecurityProtectionStateLabel,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

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

function toneForProviderAbstractionStatus(status: string) {
  switch (status) {
    case "active_foundation":
      return "green";
    case "internal":
      return "blue";
    case "missing_config":
      return "red";
    case "placeholder":
      return "amber";
    default:
      return "slate";
  }
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

function toneForTemplateState(state: string) {
  if (["enabled", "preview_ready"].includes(state)) {
    return "green" as const;
  }

  if (["disabled", "preview_unavailable"].includes(state)) {
    return "red" as const;
  }

  if (["placeholder", "unknown"].includes(state)) {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForMonitorStatus(status: string) {
  if (status === "healthy") {
    return "green" as const;
  }

  if (["warning", "degraded"].includes(status)) {
    return "amber" as const;
  }

  if (["failed", "missing_config"].includes(status)) {
    return "red" as const;
  }

  if (status === "placeholder") {
    return "slate" as const;
  }

  return "amber" as const;
}

function toneForReviewStatus(status: string) {
  switch (status) {
    case "resolved":
      return "green";
    case "reviewed":
      return "blue";
    case "under_review":
      return "amber";
    case "ignored":
      return "slate";
    case "unreviewed":
      return "red";
    default:
      return "slate";
  }
}

function toneForLogLevel(level: string) {
  if (level === "info") {
    return "blue" as const;
  }

  if (level === "warning") {
    return "amber" as const;
  }

  if (level === "error") {
    return "red" as const;
  }

  return "slate" as const;
}

function toneForSecurityProtection(state: string) {
  if (state === "protected") {
    return "green" as const;
  }

  if (state === "needs_review") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForHealthStatus(status: string) {
  if (status === "healthy") {
    return "green" as const;
  }

  if (status === "degraded") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForAuditActor(actorType: string) {
  if (actorType === "super_admin") {
    return "blue" as const;
  }

  if (actorType === "system") {
    return "slate" as const;
  }

  if (actorType === "platform") {
    return "green" as const;
  }

  return "amber" as const;
}

function toneForFailureStatus(status: string) {
  if (["retry_pending"].includes(status)) {
    return "amber" as const;
  }

  if (["failed", "provider_error", "recipient_error", "retry_exhausted", "template_error"].includes(status)) {
    return "red" as const;
  }

  return "slate" as const;
}

function toneForRetryStatus(status: string) {
  if (["retry_pending", "retry_ready"].includes(status)) {
    return "amber" as const;
  }

  if (["failed", "retry_exhausted", "retry_blocked"].includes(status)) {
    return "red" as const;
  }

  return "slate" as const;
}

function toneForQueueStatus(status: string) {
  if (["queued", "sent"].includes(status)) {
    return "blue" as const;
  }

  if (["processing", "retry_pending"].includes(status)) {
    return "amber" as const;
  }

  if (["failed", "cancelled"].includes(status)) {
    return "red" as const;
  }

  if (status === "paused") {
    return "slate" as const;
  }

  return "amber" as const;
}

function displaySanitizedNotificationError(
  value: string | null | undefined,
  source: NotificationErrorSanitizationSource
) {
  return sanitizeNotificationErrorDisplaySafe(value, {
    fallback: getNotificationErrorSanitizationFallback(source),
    source
  });
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

const notificationSafeActionHandlers: Partial<
  Record<NotificationSafeAction, (formData: FormData) => Promise<void>>
> = {
  review_failure: markNotificationFailureReviewed,
  view_details: viewNotificationDetails
};

const notificationSafeActionButtonClass: Record<NotificationSafeActionTone, string> = {
  amber: "border border-amber-200 bg-amber-50 text-amber-700",
  blue: "border border-blue-200 bg-blue-50 text-blue-700",
  red: "border border-red-200 bg-red-50 text-red-700",
  slate: "border border-slate-200 bg-slate-100 text-slate-500",
  white: "border border-slate-200 bg-white text-slate-700"
};

function NotificationSafeActionButton({
  action,
  log
}: {
  action: NotificationSafeActionDefinition;
  log: AdminNotificationControl["logs"][number];
}) {
  const handler = notificationSafeActionHandlers[action.action];
  const buttonClass = action.ready
    ? notificationSafeActionButtonClass[action.tone]
    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400";

  if (!action.ready || !handler) {
    return (
      <button
        className={`h-9 w-full rounded-full px-3 text-xs font-black uppercase tracking-[0.14em] ${buttonClass}`}
        disabled
        title={sanitizeNotificationAdminDisplayTextSafe(action.guardMessage, 240)}
        type="button"
      >
        {action.label}
      </button>
    );
  }

  return (
    <form action={handler}>
      <NotificationHiddenFields log={log} />
      <button
        className={`h-9 w-full rounded-full px-3 text-xs font-black uppercase tracking-[0.14em] ${buttonClass}`}
        title={sanitizeNotificationAdminDisplayTextSafe(action.description, 240)}
        type="submit"
      >
        {action.label}
      </button>
    </form>
  );
}

function NotificationSafeActions({
  log
}: {
  log: AdminNotificationControl["logs"][number];
}) {
  const actions = buildNotificationLogSafeActionsSafe({
    channel: log.channel,
    id: log.id,
    status: log.status,
    type: log.type
  });

  return (
    <div className="grid min-w-52 gap-2">
      {actions.map((action) => (
        <NotificationSafeActionButton action={action} key={action.action} log={log} />
      ))}
    </div>
  );
}

function NotificationGlobalSafeActionButton({
  action
}: {
  action: AdminNotificationControl["safeActionItems"][number];
}) {
  const buttonClass = action.ready
    ? notificationSafeActionButtonClass[action.tone]
    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400";

  return (
    <button
      className={`h-9 w-full rounded-full px-3 text-xs font-black uppercase tracking-[0.14em] ${buttonClass}`}
      disabled
      title={sanitizeNotificationAdminDisplayTextSafe(action.guardMessage, 240)}
      type="button"
    >
      {action.label}
    </button>
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
        <NotificationRuntimeRecoveryNotice message={sanitizeNotificationAdminDisplayTextSafe(recoveryMessage, 500)} />
      ) : null}

      {!control.notificationSecurityCertification.securityReviewPassed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Notification security certification</p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            {sanitizeNotificationAdminDisplayTextSafe(control.notificationSecurityCertification.certificationDescription, 500)}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Notification security certification</p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            {sanitizeNotificationAdminDisplayTextSafe(control.notificationSecurityCertification.certificationDescription, 500)}
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Notification safe action policy</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationSafeActionPolicy.policyDescription, 500)}
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationSafeActionPolicy.safeSummary, 240)}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Notification error sanitization</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationErrorSanitizationSummary.policyDescription, 500)}
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationErrorSanitizationSummary.safeSummary, 240)}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Notification provider abstraction</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationProviderAbstractionSummary.policyDescription, 500)}
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationProviderAbstractionSummary.safeSummary, 240)}
        </p>
      </div>

      <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Notification read-only protection</p>
        <p className="mt-2 text-sm font-semibold text-blue-950">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationReadOnlyProtectionSummary.policyDescription, 500)}
        </p>
        <p className="mt-2 text-xs font-semibold text-blue-900">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationReadOnlyProtectionSummary.safeSummary, 240)}
        </p>
        <p className="mt-2 text-xs font-semibold text-blue-800">
          Read-only verified: {control.notificationReadOnlyProtectionVerified ? "Yes" : "Fallback"}
        </p>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Notification data certification (NT-26)</p>
        <p className="mt-2 text-sm font-semibold text-emerald-950">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationDataCertificationSummary.certificationDescription, 500)}
        </p>
        <p className="mt-2 text-xs font-semibold text-emerald-900">
          {sanitizeNotificationAdminDisplayTextSafe(control.notificationDataCertificationSummary.safeSummary, 240)}
        </p>
        <p className="mt-2 text-xs font-semibold text-emerald-800">
          Certification: {control.notificationDataCertificationSummary.certificationPassed ? "Passed" : "Needs attention"}
          {" · "}
          Checks passed: {control.notificationDataCertificationSummary.passedChecks}/
          {control.notificationDataCertificationSummary.totalChecks}
          {" · "}
          Page load: Read-only
        </p>
      </div>

      <AdminStatGrid
        stats={[
          {
            label: "Security review",
            value: control.notificationSecurityCertification.securityReviewPassed ? "Passed" : "Needs attention"
          },
          { label: "Checks passed", value: control.notificationSecurityCertification.passedChecks },
          { label: "Checks failed", value: control.notificationSecurityCertification.failedChecks },
          { label: "Total checks", value: control.notificationSecurityCertification.totalChecks },
          {
            label: "Certified at",
            value: control.notificationSecurityCertification.certifiedAt
              ? formatAdminDate(control.notificationSecurityCertification.certifiedAt)
              : "Unknown"
          },
          { label: "Page load", value: "Read-only" },
          { label: "Execution", value: "Disabled" },
          { label: "Provider secrets", value: "Masked only" }
        ]}
      />

      <AdminTable headers={["Category", "Passed", "Message"]}>
        {control.notificationSecurityCertification.securityReview.map((reviewItem) => (
          <tr key={`${reviewItem.category}:${reviewItem.message.slice(0, 40)}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{reviewItem.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={reviewItem.passed ? "green" : "amber"}>
                {reviewItem.passed ? "passed" : "needs attention"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">
              {sanitizeNotificationAdminDisplayTextSafe(reviewItem.message, 500)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.securityRecords.length ? "No notification security surface records found." : null}
        headers={["Surface", "State", "Summary", "Metadata"]}
      >
        {control.securityRecords.map((securityRecord) => (
          <tr key={securityRecord.securityId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{securityRecord.surfaceLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{securityRecord.surface}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForSecurityProtection(securityRecord.protectionState)}>
                {getNotificationSecurityProtectionStateLabel(securityRecord.protectionState)}
              </AdminBadge>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(securityRecord.safeSummary, "monitoring")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(securityRecord.metadataSummary, "monitoring")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.recipientItems.length ? "No notification recipient records found." : null}
        headers={[
          "Recipient",
          "Type",
          "Tenant",
          "Notification",
          "Channel",
          "Status",
          "Masked email",
          "Masked phone",
          "Created",
          "Updated",
          "Summary"
        ]}
      >
        {control.recipientItems.map((recipientItem) => (
          <tr key={recipientItem.recipientId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{recipientItem.recipientReference}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{recipientItem.recipientId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone="slate">{getNotificationRecipientTypeLabel(recipientItem.recipientType)}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{recipientItem.recipientType}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{recipientItem.tenantReference}</td>
            <td className="px-5 py-4 text-slate-600">{recipientItem.notificationReference}</td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{recipientItem.preferredChannelLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{recipientItem.preferredChannel}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{recipientItem.deliveryStatusSummary}</td>
            <td className="px-5 py-4 text-slate-600">{recipientItem.maskedEmail ?? "Not applicable"}</td>
            <td className="px-5 py-4 text-slate-600">{recipientItem.maskedPhone ?? "Not applicable"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(recipientItem.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(recipientItem.updatedAt)}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {sanitizeNotificationRecipientDisplaySafe(recipientItem.safeSummary, 240)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.eventItems.length ? "No notification event records found." : null}
        headers={[
          "Event",
          "Key",
          "Type",
          "Notification",
          "Recipient",
          "Channel",
          "Provider",
          "Status",
          "Occurred",
          "Created",
          "Summary",
          "Metadata"
        ]}
      >
        {control.eventItems.map((eventItem) => (
          <tr key={eventItem.eventId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{eventItem.eventId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{eventItem.eventKey}</td>
            <td className="px-5 py-4">
              <AdminBadge tone="slate">{getNotificationEventTypeLabel(eventItem.eventType)}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{eventItem.eventType}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{eventItem.notificationReference}</td>
            <td className="px-5 py-4 text-slate-600">{eventItem.recipientReference}</td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{eventItem.channelLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{eventItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{eventItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{eventItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationStatusBadgeTone(eventItem.status)}>{eventItem.statusLabel}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(eventItem.occurredAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(eventItem.createdAt)}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(eventItem.safeSummary, "audit")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(eventItem.metadataSummary, "audit")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.logItems.length ? "No notification log runtime records found." : null}
        headers={[
          "Log",
          "Level",
          "Notification",
          "Event",
          "Delivery",
          "Channel",
          "Provider",
          "Status",
          "Message",
          "Metadata",
          "Created"
        ]}
      >
        {control.logItems.map((logItem) => (
          <tr key={logItem.logId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{logItem.logId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForLogLevel(logItem.logLevel)}>{logItem.logLevelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{logItem.logLevel}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{logItem.notificationReference}</td>
            <td className="px-5 py-4 text-slate-600">{logItem.eventReference}</td>
            <td className="px-5 py-4 text-slate-600">{logItem.deliveryReference}</td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{logItem.channelLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{logItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{logItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{logItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationStatusBadgeTone(logItem.status)}>{logItem.statusLabel}</AdminBadge>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(logItem.safeMessage, "log")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(logItem.metadataSummary, "log")}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(logItem.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.reviewItems.length ? "No notification review runtime records found." : null}
        headers={[
          "Review",
          "Status",
          "Reviewed",
          "Notification",
          "Failure",
          "Reviewer",
          "Review note",
          "Summary",
          "Reviewed at",
          "Created",
          "Updated"
        ]}
      >
        {control.reviewItems.map((reviewItem) => (
          <tr key={reviewItem.reviewId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{reviewItem.reviewId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForReviewStatus(reviewItem.reviewStatus)}>
                {getNotificationReviewStatusLabel(reviewItem.reviewStatus)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{reviewItem.reviewStatus}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={reviewItem.reviewed ? "blue" : "red"}>
                {reviewItem.reviewed ? "Yes" : "No"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.notificationReference}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.failureReference}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.reviewerReference}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(reviewItem.reviewNote, "review")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(reviewItem.safeSummary, "review")}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(reviewItem.reviewedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(reviewItem.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(reviewItem.updatedAt)}</td>
          </tr>
        ))}
      </AdminTable>

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
          { label: "Push placeholder", value: control.notificationChannelStats.pushItems },
          { label: "Transactional", value: control.notificationCategoryStats.transactionalItems },
          { label: "Billing category", value: control.notificationCategoryStats.billingItems },
          { label: "System category", value: control.notificationCategoryStats.systemItems },
          { label: "Active providers", value: control.notificationProviderStats.activeProviders },
          { label: "Placeholder providers", value: control.notificationProviderStats.placeholderProviders },
          { label: "Total templates", value: control.notificationTemplateStats.totalTemplates },
          { label: "Enabled templates", value: control.notificationTemplateStats.enabledTemplates },
          { label: "Preview-ready templates", value: control.notificationTemplateStats.previewReadyTemplates },
          { label: "Placeholder templates", value: control.notificationTemplateStats.placeholderTemplates },
          { label: "Total deliveries", value: control.notificationDeliveryRuntimeStats.totalDeliveries },
          { label: "In-app deliveries", value: control.notificationDeliveryRuntimeStats.inAppDeliveries },
          { label: "Email deliveries", value: control.notificationDeliveryRuntimeStats.emailDeliveries },
          { label: "Failed deliveries", value: control.notificationDeliveryRuntimeStats.failedDeliveries },
          { label: "Queue items", value: control.notificationQueueRuntimeStats.totalQueueItems },
          { label: "Queued", value: control.notificationQueueRuntimeStats.queuedItems },
          { label: "Processing", value: control.notificationQueueRuntimeStats.processingItems },
          { label: "Retry pending", value: control.notificationQueueRuntimeStats.retryPendingItems },
          { label: "Retry records", value: control.notificationRetryRuntimeStats.totalRetryItems },
          { label: "Retry pending records", value: control.notificationRetryRuntimeStats.retryPendingItems },
          { label: "Retry exhausted", value: control.notificationRetryRuntimeStats.retryExhaustedItems },
          { label: "Failed retries", value: control.notificationRetryRuntimeStats.failedRetryItems },
          { label: "Failure records", value: control.notificationFailureRuntimeStats.totalFailures },
          { label: "Unreviewed failures", value: control.notificationFailureRuntimeStats.unreviewedFailures },
          { label: "Reviewed failures", value: control.notificationFailureRuntimeStats.reviewedFailures },
          { label: "Provider errors", value: control.notificationFailureRuntimeStats.providerErrorFailures },
          { label: "Audit records", value: control.notificationAuditRuntimeStats.totalAuditItems },
          { label: "Super Admin actions", value: control.notificationAuditRuntimeStats.superAdminActions },
          { label: "Mark reviewed audits", value: control.notificationAuditRuntimeStats.markReviewedActions },
          { label: "Retry placeholder audits", value: control.notificationAuditRuntimeStats.retryPlaceholderActions },
          { label: "Monitors", value: control.notificationMonitoringRuntimeStats.totalMonitors },
          { label: "Healthy monitors", value: control.notificationMonitoringRuntimeStats.healthyMonitors },
          { label: "Warning monitors", value: control.notificationMonitoringRuntimeStats.warningMonitors },
          { label: "Failure signals", value: control.notificationMonitoringRuntimeStats.totalFailureSignals },
          { label: "Analytics analyzed", value: control.notificationAnalyticsRuntimeStats.totalAnalyticsItems },
          { label: "Delivery success rate", value: `${control.analytics.deliverySuccessRate.toFixed(1)}%` },
          { label: "Failure rate", value: `${control.analytics.failureRate.toFixed(1)}%` },
          { label: "Retry rate", value: `${control.analytics.retryRate.toFixed(1)}%` },
          { label: "Read rate", value: `${control.analytics.readRate.toFixed(1)}%` },
          { label: "Queued volume", value: control.analytics.queuedVolume },
          { label: "Daily analytics", value: control.notificationAnalyticsRuntimeStats.dailyAnalyticsItems },
          { label: "Weekly analytics", value: control.notificationAnalyticsRuntimeStats.weeklyAnalyticsItems },
          { label: "Monthly analytics", value: control.notificationAnalyticsRuntimeStats.monthlyAnalyticsItems },
          { label: "Overall health", value: control.health.overallStatusLabel },
          { label: "Healthy health records", value: control.notificationHealthRuntimeStats.healthyHealthItems },
          { label: "Degraded health records", value: control.notificationHealthRuntimeStats.degradedHealthItems },
          { label: "Unknown health records", value: control.notificationHealthRuntimeStats.unknownHealthItems },
          { label: "Total health records", value: control.notificationHealthRuntimeStats.totalHealthItems },
          { label: "Protected surfaces", value: control.notificationSecurityRuntimeStats.protectedSurfaces },
          { label: "Surfaces needs review", value: control.notificationSecurityRuntimeStats.needsReviewSurfaces },
          { label: "Total recipients", value: control.notificationRecipientRuntimeStats.totalRecipients },
          { label: "Email recipients", value: control.notificationRecipientRuntimeStats.emailRecipients },
          { label: "User recipients", value: control.notificationRecipientRuntimeStats.userRecipients },
          { label: "Store recipients", value: control.notificationRecipientRuntimeStats.storeRecipients },
          { label: "Total events", value: control.notificationEventRuntimeStats.totalEvents },
          { label: "Sent events", value: control.notificationEventRuntimeStats.sentEvents },
          { label: "Failed events", value: control.notificationEventRuntimeStats.failedEvents },
          { label: "Queued events", value: control.notificationEventRuntimeStats.queuedEvents },
          { label: "Retry scheduled events", value: control.notificationEventRuntimeStats.retryScheduledEvents },
          { label: "Total log records", value: control.notificationLogRuntimeStats.totalLogs },
          { label: "Info logs", value: control.notificationLogRuntimeStats.infoLogs },
          { label: "Warning logs", value: control.notificationLogRuntimeStats.warningLogs },
          { label: "Error logs", value: control.notificationLogRuntimeStats.errorLogs },
          { label: "Debug hidden logs", value: control.notificationLogRuntimeStats.debugHiddenLogs },
          { label: "Total review records", value: control.notificationReviewRuntimeStats.totalReviews },
          { label: "Unreviewed reviews", value: control.notificationReviewRuntimeStats.unreviewedReviews },
          { label: "Under review", value: control.notificationReviewRuntimeStats.underReviewItems },
          { label: "Reviewed", value: control.notificationReviewRuntimeStats.reviewedReviews },
          { label: "Resolved reviews", value: control.notificationReviewRuntimeStats.resolvedReviews },
          { label: "Ignored reviews", value: control.notificationReviewRuntimeStats.ignoredReviews },
          { label: "Total safe actions", value: control.notificationSafeActionRuntimeStats.totalActions },
          { label: "Guarded actions", value: control.notificationSafeActionRuntimeStats.guardedActions },
          { label: "Disabled actions", value: control.notificationSafeActionRuntimeStats.disabledActions },
          { label: "Placeholder submit actions", value: control.notificationSafeActionRuntimeStats.placeholderSubmitActions },
          { label: "Global safe actions", value: control.notificationSafeActionRuntimeStats.globalActions },
          { label: "Log-scoped safe actions", value: control.notificationSafeActionRuntimeStats.logScopedActions },
          { label: "Sanitized surfaces", value: control.notificationErrorSanitizationRuntimeStats.totalSurfaces },
          { label: "Ready sanitization surfaces", value: control.notificationErrorSanitizationRuntimeStats.readySurfaces },
          { label: "Sanitized error fields", value: control.notificationErrorSanitizationRuntimeStats.totalSanitizedFields },
          { label: "Provider abstractions", value: control.notificationProviderAbstractionRuntimeStats.totalAbstractions },
          { label: "Placeholder providers", value: control.notificationProviderAbstractionRuntimeStats.placeholderProviders },
          { label: "Active foundation providers", value: control.notificationProviderAbstractionRuntimeStats.activeFoundationProviders },
          { label: "Missing config providers", value: control.notificationProviderAbstractionRuntimeStats.missingConfigProviders },
          { label: "Read-only surfaces", value: control.notificationReadOnlyProtectionRuntimeStats.readOnlySurfaces },
          { label: "Protected surfaces", value: control.notificationReadOnlyProtectionRuntimeStats.protectedSurfaces },
          { label: "Unavailable surfaces", value: control.notificationReadOnlyProtectionRuntimeStats.unavailableSurfaces },
          {
            label: "Read-only verified",
            value: control.notificationReadOnlyProtectionVerified ? "Yes" : "Fallback"
          },
          { label: "Data certified surfaces", value: control.notificationDataCertificationRuntimeStats.certifiedSurfaces },
          { label: "Data fallback surfaces", value: control.notificationDataCertificationRuntimeStats.fallbackSurfaces },
          {
            label: "Data needs review",
            value: control.notificationDataCertificationRuntimeStats.needsReviewSurfaces
          },
          { label: "Data certification checks", value: control.notificationDataCertificationRuntimeStats.totalChecks },
          {
            label: "Data checks passed",
            value: control.notificationDataCertificationRuntimeStats.totalChecksPassed
          },
          {
            label: "Data certification",
            value: control.notificationDataCertificationSummary.certificationPassed ? "Passed" : "Needs attention"
          }
        ]}
      />

      <AdminTable headers={["Metric", "Value", "Description"]}>
        {control.metricViews.map((metric) => (
          <tr key={metric.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{metric.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{metric.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-950">{metric.value}</td>
            <td className="px-5 py-4 text-slate-600">{metric.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Rate", "Value", "Description"]}>
        {control.analyticsRateViews.map((rateView) => (
          <tr key={rateView.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{rateView.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{rateView.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-950">{rateView.valueLabel}</td>
            <td className="px-5 py-4 text-slate-600">{rateView.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Period", "Count", "Description"]}>
        {control.analyticsPeriodViews.map((periodView) => (
          <tr key={periodView.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{periodView.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{periodView.key}</p>
            </td>
            <td className="px-5 py-4 text-slate-950">{periodView.count}</td>
            <td className="px-5 py-4 text-slate-600">{periodView.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.analyticsBreakdownItems.length ? "No notification analytics breakdown available." : null}
        headers={["Dimension", "Key", "Label", "Count", "Share", "Description"]}
      >
        {control.analyticsBreakdownItems.map((breakdownItem) => (
          <tr key={`${breakdownItem.dimension}:${breakdownItem.key}`}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{getNotificationAnalyticsDimensionLabel(breakdownItem.dimension)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{breakdownItem.dimension}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{breakdownItem.key}</td>
            <td className="px-5 py-4 text-slate-950">{breakdownItem.label}</td>
            <td className="px-5 py-4 text-slate-950">{breakdownItem.count}</td>
            <td className="px-5 py-4 text-slate-600">{breakdownItem.sharePercent.toFixed(1)}%</td>
            <td className="px-5 py-4 text-slate-600">{breakdownItem.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.healthItems.length ? "No notification health records found." : null}
        headers={[
          "Health",
          "Domain",
          "Reference",
          "Status",
          "Degraded",
          "Last success",
          "Last failure",
          "Summary",
          "Metadata",
          "Updated"
        ]}
      >
        {control.healthItems.map((healthItem) => (
          <tr key={healthItem.healthId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{healthItem.healthId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{getNotificationHealthDomainLabel(healthItem.domain)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{healthItem.domain}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{healthItem.referenceLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{healthItem.referenceKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForHealthStatus(healthItem.status)}>{healthItem.statusLabel}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={healthItem.degraded ? "amber" : "green"}>
                {healthItem.degraded ? "degraded" : "stable"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(healthItem.lastSuccessAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(healthItem.lastFailureAt)}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(healthItem.safeSummary, "health")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(healthItem.metadataSummary, "health")}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(healthItem.updatedAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Provider", "Type", "Placeholder", "Configured", "Health", "Secrets", "Summary"]}>
        {listNotificationProviderCatalog().map((entry) => {
          const providerView = control.providerStatus.find((provider) => provider.providerKey === entry.providerKey);

          return (
            <tr key={entry.providerKey}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{entry.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{entry.providerKey}</p>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={entry.placeholderOnly ? "amber" : "green"}>{entry.providerType}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={entry.placeholderOnly ? "amber" : "green"}>
                  {entry.placeholderOnly ? "placeholder only" : "foundation"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForChannelStatus(providerView?.configuredStatus ?? "placeholder")}>
                  {providerView?.configuredStatus ?? "placeholder"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForChannelStatus(providerView?.healthStatus ?? "placeholder")}>
                  {providerView?.healthStatus ?? "placeholder"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={providerView?.secretStatus === "missing" ? "red" : "slate"}>
                  {providerView?.secretStatus ?? "missing"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {displaySanitizedNotificationError(providerView?.metadataSummary ?? entry.description, "monitoring")}
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <AdminTable
        empty={!control.providerAbstractionItems.length ? "No notification provider abstraction records found." : null}
        headers={[
          "Provider",
          "Channel",
          "Status",
          "Capabilities",
          "Config summary",
          "Health reference",
          "Summary",
          "Updated",
          "Action"
        ]}
      >
        {control.providerAbstractionItems.map((abstractionItem) => (
          <tr key={abstractionItem.abstractionId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{abstractionItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{abstractionItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{abstractionItem.supportedChannelLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{abstractionItem.supportedChannel}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForProviderAbstractionStatus(abstractionItem.providerStatus)}>
                {getNotificationProviderAbstractionStatusLabel(abstractionItem.providerStatus)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{abstractionItem.providerStatus}</p>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(abstractionItem.capabilitySummary, "monitoring")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(abstractionItem.configSummary, "monitoring")}
            </td>
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(abstractionItem.healthReference, "monitoring")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(abstractionItem.safeSummary, "monitoring")}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(abstractionItem.updatedAt)}</td>
            <td className="px-5 py-4">
              <button
                className="h-9 w-full min-w-36 cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                title="Provider actions remain guarded placeholders only. No send, test, or external provider execution."
                type="button"
              >
                Provider placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.templates.length ? "No notification templates found." : null}
        headers={[
          "Template",
          "Type",
          "Channel",
          "Category",
          "Provider",
          "Subject preview",
          "Body preview",
          "State",
          "Preview",
          "Usage",
          "Updated"
        ]}
      >
        {control.templates.map((template) => (
          <tr key={template.templateKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.templateKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone="blue">{template.notificationTypeLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.notificationType}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(template.channel)}>{template.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.channel}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationCategoryBadgeTone(template.category)}>{template.categoryLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.category}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.providerKey}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.subjectPreview}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">{template.bodyPreview}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForTemplateState(template.enabledState)}>{template.enabledState}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForTemplateState(template.previewState)}>{template.previewState}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.usageCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(template.updatedAt ?? template.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Category", "Log count", "Registry count", "Description"]}>
        {listNotificationCategoryCatalog().map((entry) => {
          const logCount =
            entry.category === "transactional"
              ? control.notificationCategoryStats.transactionalItems
              : entry.category === "account"
                ? control.notificationCategoryStats.accountItems
                : entry.category === "billing"
                  ? control.notificationCategoryStats.billingItems
                  : entry.category === "security"
                    ? control.notificationCategoryStats.securityItems
                    : entry.category === "store"
                      ? control.notificationCategoryStats.storeItems
                      : entry.category === "domain"
                        ? control.notificationCategoryStats.domainItems
                        : entry.category === "email"
                          ? control.notificationCategoryStats.emailItems
                          : entry.category === "ai"
                            ? control.notificationCategoryStats.aiItems
                            : entry.category === "support"
                              ? control.notificationCategoryStats.supportItems
                              : control.notificationCategoryStats.systemItems;
          const registryCount =
            entry.category === "transactional"
              ? control.notificationRegistryCategoryStats.transactionalItems
              : entry.category === "account"
                ? control.notificationRegistryCategoryStats.accountItems
                : entry.category === "billing"
                  ? control.notificationRegistryCategoryStats.billingItems
                  : entry.category === "security"
                    ? control.notificationRegistryCategoryStats.securityItems
                    : entry.category === "store"
                      ? control.notificationRegistryCategoryStats.storeItems
                      : entry.category === "domain"
                        ? control.notificationRegistryCategoryStats.domainItems
                        : entry.category === "email"
                          ? control.notificationRegistryCategoryStats.emailItems
                          : entry.category === "ai"
                            ? control.notificationRegistryCategoryStats.aiItems
                            : entry.category === "support"
                              ? control.notificationRegistryCategoryStats.supportItems
                              : control.notificationRegistryCategoryStats.systemItems;

          return (
            <tr key={entry.category}>
              <td className="px-5 py-4">
                <AdminBadge tone={getNotificationCategoryBadgeTone(entry.category)}>{entry.label}</AdminBadge>
                <p className="mt-1 text-xs font-semibold text-slate-500">{entry.category}</p>
              </td>
              <td className="px-5 py-4 text-slate-600">{logCount}</td>
              <td className="px-5 py-4 text-slate-600">{registryCount}</td>
              <td className="px-5 py-4 text-slate-600">{entry.description}</td>
            </tr>
          );
        })}
      </AdminTable>

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

      <AdminTable
        empty={
          control.deliveries.length === 1 &&
          control.deliveries[0]?.deliveryId === "unknown_notification_delivery"
            ? "No notification delivery records found."
            : null
        }
        headers={[
          "Delivery",
          "Notification",
          "Template",
          "Channel",
          "Provider",
          "Status",
          "Recipient",
          "Attempts",
          "Delivered",
          "Read",
          "Created",
          "Error summary"
        ]}
      >
        {control.deliveries.map((delivery) => (
          <tr key={delivery.deliveryId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{delivery.deliveryId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{delivery.notificationId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{delivery.templateLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{delivery.templateKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(delivery.channel)}>{delivery.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{delivery.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{delivery.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{delivery.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationStatusBadgeTone(delivery.deliveryStatus)}>
                {delivery.deliveryStatusLabel}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 font-bold text-slate-950">{delivery.recipientMasked}</td>
            <td className="px-5 py-4 text-slate-600">{delivery.attemptCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(delivery.deliveredAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(delivery.readAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(delivery.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(delivery.errorSummary, "delivery")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.queueItems.length ? "No notification queue records found." : null}
        headers={[
          "Queue",
          "Notification",
          "Channel",
          "Provider",
          "Status",
          "Priority",
          "Attempts",
          "Scheduled",
          "Locked",
          "Processed",
          "Created",
          "Error summary"
        ]}
      >
        {control.queueItems.map((queueItem) => (
          <tr key={queueItem.queueId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{queueItem.queueId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{queueItem.notificationId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(queueItem.channel)}>{queueItem.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{queueItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{queueItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{queueItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForQueueStatus(queueItem.status)}>{queueItem.statusLabel}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={queueItem.priority === "high" ? "red" : queueItem.priority === "low" ? "slate" : "blue"}>
                {queueItem.priorityLabel}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{queueItem.attemptCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queueItem.scheduledAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queueItem.lockedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queueItem.processedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queueItem.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(queueItem.errorSummary, "queue")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.retryItems.length ? "No notification retry records found." : null}
        headers={[
          "Retry",
          "Notification",
          "Queue ref",
          "Delivery ref",
          "Channel",
          "Provider",
          "Status",
          "Attempt",
          "Max",
          "Next retry",
          "Last retry",
          "Created",
          "Failure reason"
        ]}
      >
        {control.retryItems.map((retryItem) => (
          <tr key={retryItem.retryId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{retryItem.retryId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{retryItem.notificationId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{retryItem.queueReference}</td>
            <td className="px-5 py-4 text-slate-600">{retryItem.deliveryReference}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(retryItem.channel)}>{retryItem.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{retryItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{retryItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{retryItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForRetryStatus(retryItem.retryStatus)}>{retryItem.retryStatusLabel}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{retryItem.attemptNumber}</td>
            <td className="px-5 py-4 text-slate-600">{retryItem.maxAttempts}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(retryItem.nextRetryAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(retryItem.lastRetryAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(retryItem.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(retryItem.failureReason, "retry")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.failureItems.length ? "No notification failure records found." : null}
        headers={[
          "Failure",
          "Notification",
          "Delivery ref",
          "Queue ref",
          "Retry ref",
          "Channel",
          "Provider",
          "Status",
          "Code",
          "Reviewed",
          "Reviewed at",
          "Created",
          "Failure reason"
        ]}
      >
        {control.failureItems.map((failureItem) => (
          <tr key={failureItem.failureId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{failureItem.failureId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{failureItem.notificationId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{failureItem.deliveryReference}</td>
            <td className="px-5 py-4 text-slate-600">{failureItem.queueReference}</td>
            <td className="px-5 py-4 text-slate-600">{failureItem.retryReference}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(failureItem.channel)}>{failureItem.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{failureItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{failureItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{failureItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForFailureStatus(failureItem.failureStatus)}>
                {failureItem.failureStatusLabel}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{failureItem.failureCode}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={failureItem.reviewed ? "green" : "amber"}>
                {failureItem.reviewed ? "reviewed" : "unreviewed"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(failureItem.reviewedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(failureItem.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(failureItem.failureReason, "failure")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.auditItems.length ? "No notification audit records found." : null}
        headers={[
          "Audit",
          "Notification",
          "Actor",
          "Action",
          "Target",
          "Summary",
          "Metadata",
          "IP ref",
          "User agent",
          "Created"
        ]}
      >
        {control.auditItems.map((auditItem) => (
          <tr key={auditItem.auditId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{auditItem.auditId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{auditItem.notificationId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForAuditActor(auditItem.actorType)}>{auditItem.actorType}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{auditItem.actorIdReference}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{auditItem.actionLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{auditItem.action}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{auditItem.targetType}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{auditItem.targetIdReference}</p>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(auditItem.safeSummary, "audit")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(auditItem.metadataSummary, "audit")}
            </td>
            <td className="px-5 py-4 text-slate-600">{auditItem.ipReference}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.userAgentSummary}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(auditItem.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.monitoringItems.length ? "No notification monitoring records found." : null}
        headers={[
          "Monitor",
          "Channel",
          "Provider",
          "Status",
          "Failures",
          "Checked",
          "Last success",
          "Last failure",
          "Latency",
          "Summary",
          "Metadata",
          "Updated"
        ]}
      >
        {control.monitoringItems.map((monitorItem) => (
          <tr key={monitorItem.monitorId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{monitorItem.monitorId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(monitorItem.channel)}>{monitorItem.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{monitorItem.channel}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{monitorItem.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{monitorItem.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForMonitorStatus(monitorItem.status)}>{monitorItem.statusLabel}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{monitorItem.failureCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(monitorItem.checkedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(monitorItem.lastSuccessAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(monitorItem.lastFailureAt)}</td>
            <td className="px-5 py-4 text-slate-600">
              {monitorItem.latencyMs === null ? "Not measured" : `${monitorItem.latencyMs} ms`}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(monitorItem.safeSummary, "monitoring")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(monitorItem.metadataSummary, "monitoring")}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(monitorItem.updatedAt)}</td>
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
        headers={["Channel", "Category", "Provider", "Template", "Type", "Recipient", "Store/user", "Status", "Created", "Error summary", "Safe actions"]}
      >
        {control.logs.map((log) => (
          <tr key={`${log.channel}:${log.id}`}>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationChannelBadgeTone(log.channel)}>{log.channelLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.channel}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getNotificationCategoryBadgeTone(log.category)}>{log.categoryLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.category}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{log.providerLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.providerKey}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{log.templateLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{log.templateKey}</p>
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
            <td className="px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(log.errorSummary, "log")}
            </td>
            <td className="px-5 py-4">
              <NotificationSafeActions log={log} />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={
          !control.safeActionItems.filter((item) => item.scope === "global").length
            ? "No notification safe action catalog records found."
            : null
        }
        headers={["Action", "Mode", "Ready", "Guard", "Summary", "Control"]}
      >
        {control.safeActionItems
          .filter((item) => item.scope === "global")
          .map((actionItem) => (
            <tr key={actionItem.actionId}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{actionItem.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{actionItem.action}</p>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={actionItem.executionMode === "disabled" ? "red" : "blue"}>
                  {actionItem.executionMode.replace(/_/g, " ")}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={actionItem.ready ? "green" : "red"}>{actionItem.ready ? "Yes" : "No"}</AdminBadge>
              </td>
              <td className="max-w-xs px-5 py-4 text-slate-600">
                {displaySanitizedNotificationError(actionItem.guardMessage, "safe_action")}
              </td>
              <td className="max-w-xs px-5 py-4 text-slate-600">
                {displaySanitizedNotificationError(actionItem.safeSummary, "safe_action")}
              </td>
              <td className="px-5 py-4">
                <NotificationGlobalSafeActionButton action={actionItem} />
              </td>
            </tr>
          ))}
      </AdminTable>

      <AdminTable
        empty={!control.readOnlyProtectionItems.length ? "No notification read-only protection records found." : null}
        headers={["Surface", "Ready", "Blocked mutations", "Guarantee", "Summary"]}
      >
        {control.readOnlyProtectionItems.map((protectionItem) => (
          <tr key={protectionItem.protectionId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{getNotificationReadOnlyProtectionSurfaceLabel(protectionItem.surface)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{protectionItem.surface}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={protectionItem.protectionReady ? "green" : "amber"}>
                {protectionItem.protectionReady ? "Protected" : "Fallback"}
              </AdminBadge>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">{protectionItem.blockedMutations.join(", ")}</td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(protectionItem.readOnlyGuarantee, "monitoring")}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(protectionItem.safeSummary, "monitoring")}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.errorSanitizationItems.length ? "No notification error sanitization records found." : null}
        headers={["Surface", "Fields", "Ready", "Fallback", "Summary"]}
      >
        {control.errorSanitizationItems.map((sanitizationItem) => (
          <tr key={sanitizationItem.sanitizationId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{sanitizationItem.sourceLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{sanitizationItem.source}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{sanitizationItem.sanitizedFields.join(", ")}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={sanitizationItem.sanitizationReady ? "green" : "red"}>
                {sanitizationItem.sanitizationReady ? "Yes" : "No"}
              </AdminBadge>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(sanitizationItem.fallbackMessage, sanitizationItem.source)}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(sanitizationItem.safeSummary, sanitizationItem.source)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.dataCertificationItems.length ? "No notification data certification records found." : null}
        headers={["Surface", "Status", "Sanitized", "Masked", "Read-only", "Checks", "Summary"]}
      >
        {control.dataCertificationItems.map((certificationItem) => (
          <tr key={certificationItem.certificationId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">
                {getNotificationDataCertificationSurfaceLabel(certificationItem.surface)}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{certificationItem.surface}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge
                tone={
                  certificationItem.certificationStatus === "certified"
                    ? "green"
                    : certificationItem.certificationStatus === "fallback"
                      ? "amber"
                      : "red"
                }
              >
                {getNotificationDataCertificationStatusLabel(certificationItem.certificationStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={certificationItem.sanitizationReady ? "green" : "red"}>
                {certificationItem.sanitizationReady ? "Yes" : "No"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={certificationItem.maskingReady ? "green" : "red"}>
                {certificationItem.maskingReady ? "Yes" : "No"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={certificationItem.readOnlyReady ? "green" : "amber"}>
                {certificationItem.readOnlyReady ? "Yes" : "Fallback"}
              </AdminBadge>
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {certificationItem.checks.map((check) => (
                <p key={check.checkId} className="text-xs">
                  {check.passed ? "✓" : "✗"} {check.label}
                </p>
              ))}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
              {displaySanitizedNotificationError(certificationItem.safeSummary, "monitoring")}
            </td>
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
