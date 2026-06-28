import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminOperationsControl } from "@/lib/admin/data";
import {
  exportOperationsDiagnosticsPlaceholder,
  markOperationsIncidentReviewed,
  retryOperationsPlaceholder,
  viewOperationsLogs
} from "@/lib/admin/operations-actions";
import {
  operationsDashboardRuntimeStatusBadgeTone,
  operationsDashboardRuntimeStatusLabel,
  type OperationsDashboardRuntimeStatus
} from "@/src/lib/operations/operations-dashboard-runtime";
import {
  operationsQueueRuntimeStatusBadgeTone,
  operationsQueueRuntimeStatusLabel,
  type OperationsQueueRuntimeStatus
} from "@/src/lib/operations/operations-queue-runtime";
import {
  operationsWorkerRuntimeStatusBadgeTone,
  operationsWorkerRuntimeStatusLabel,
  type OperationsWorkerRuntimeStatus
} from "@/src/lib/operations/operations-worker-runtime";
import {
  operationsCronRuntimeStatusBadgeTone,
  operationsCronRuntimeStatusLabel,
  type OperationsCronRuntimeStatus
} from "@/src/lib/operations/operations-cron-runtime";
import {
  operationsStorageHealthStatusLabel,
  operationsStorageRuntimeStatusBadgeTone,
  operationsStorageRuntimeStatusLabel,
  type OperationsStorageRuntimeStatus
} from "@/src/lib/operations/operations-storage-runtime";
import {
  operationsDatabaseHealthStatusLabel,
  operationsDatabaseRuntimeStatusBadgeTone,
  operationsDatabaseRuntimeStatusLabel,
  type OperationsDatabaseRuntimeStatus
} from "@/src/lib/operations/operations-database-runtime";
import {
  operationsEmailQueueRuntimeStatusBadgeTone,
  operationsEmailQueueRuntimeStatusLabel,
  type OperationsEmailQueueRuntimeStatus
} from "@/src/lib/operations/operations-email-queue-runtime";
import {
  operationsAiQueueRuntimeStatusBadgeTone,
  operationsAiQueueRuntimeStatusLabel,
  type OperationsAiQueueRuntimeStatus
} from "@/src/lib/operations/operations-ai-queue-runtime";
import {
  operationsDomainEmailQueueRuntimeStatusBadgeTone,
  operationsDomainEmailQueueRuntimeStatusLabel,
  type OperationsDomainEmailQueueRuntimeStatus
} from "@/src/lib/operations/operations-domain-email-queue-runtime";
import {
  operationsMonitoringEventsRuntimeStatusBadgeTone,
  operationsMonitoringEventsRuntimeStatusLabel,
  type OperationsMonitoringEventsRuntimeStatus
} from "@/src/lib/operations/operations-monitoring-events-runtime";

function toneForStatus(status: string) {
  if (["configured", "healthy", "idle", "monitoring", "ready", "running", "dashboard_ready", "registry_ready", "queue_runtime_ready", "worker_runtime_ready", "cron_runtime_ready", "storage_runtime_ready", "database_runtime_ready", "email_queue_runtime_ready", "ai_queue_runtime_ready", "domain_email_queue_runtime_ready", "monitoring_events_runtime_ready"].includes(status)) {
    return "green" as const;
  }

  if (["failed", "missing", "missing_config", "review", "warning"].includes(status)) {
    return "red" as const;
  }

  if (["needs_review", "partial", "needs_attention"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForDashboardRuntimeStatus(status: string) {
  return operationsDashboardRuntimeStatusBadgeTone(status as OperationsDashboardRuntimeStatus);
}

function toneForQueueRuntimeStatus(status: string) {
  return operationsQueueRuntimeStatusBadgeTone(status as OperationsQueueRuntimeStatus);
}

function toneForWorkerRuntimeStatus(status: string) {
  return operationsWorkerRuntimeStatusBadgeTone(status as OperationsWorkerRuntimeStatus);
}

function toneForCronRuntimeStatus(status: string) {
  return operationsCronRuntimeStatusBadgeTone(status as OperationsCronRuntimeStatus);
}

function toneForStorageRuntimeStatus(status: string) {
  return operationsStorageRuntimeStatusBadgeTone(status as OperationsStorageRuntimeStatus);
}

function toneForDatabaseRuntimeStatus(status: string) {
  return operationsDatabaseRuntimeStatusBadgeTone(status as OperationsDatabaseRuntimeStatus);
}

function toneForEmailQueueRuntimeStatus(status: string) {
  return operationsEmailQueueRuntimeStatusBadgeTone(status as OperationsEmailQueueRuntimeStatus);
}

function toneForAiQueueRuntimeStatus(status: string) {
  return operationsAiQueueRuntimeStatusBadgeTone(status as OperationsAiQueueRuntimeStatus);
}

function toneForDomainEmailQueueRuntimeStatus(status: string) {
  return operationsDomainEmailQueueRuntimeStatusBadgeTone(status as OperationsDomainEmailQueueRuntimeStatus);
}

function toneForMonitoringEventsRuntimeStatus(status: string) {
  return operationsMonitoringEventsRuntimeStatusBadgeTone(status as OperationsMonitoringEventsRuntimeStatus);
}

function supportLabel(enabled: boolean) {
  return enabled ? "Supported" : "Not supported";
}

function supportTone(enabled: boolean) {
  return enabled ? ("green" as const) : ("slate" as const);
}

function OperationsHiddenFields({ targetName, targetType }: { targetName: string; targetType: string }) {
  return (
    <>
      <input name="targetName" type="hidden" value={targetName} />
      <input name="targetType" type="hidden" value={targetType} />
    </>
  );
}

function DatabaseSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Refresh Health", "Review Policies", "Review Migrations", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No database action is executed during OP-7 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StorageSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Refresh Health", "Repair", "Cleanup", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No storage action is executed during OP-6 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CronSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Trigger Now", "Pause", "Resume", "Reschedule", "Inspect Runs"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No cron action is executed during OP-5 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function WorkerSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Start", "Stop", "Restart", "Retry", "Inspect Logs"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No worker action is executed during OP-4 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function QueueSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Retry", "Pause", "Resume", "Purge", "Inspect"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No queue action is executed during OP-3 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EmailQueueSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Retry Failed", "Pause Queue", "Resume Queue", "Cancel Pending", "Inspect"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No email queue action is executed during OP-8 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AiQueueSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Retry Failed", "Pause Queue", "Resume Queue", "Cancel Pending", "Inspect"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No AI queue action is executed during OP-9 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DomainEmailQueueSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Retry Failed", "Pause Queue", "Resume Queue", "Cancel Pending", "Inspect"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No domain or email queue action is executed during OP-10 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MonitoringEventsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Acknowledge", "Resolve", "Retry Alert", "Inspect", "Export"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No monitoring action is executed during OP-11 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OperationsActionButtons({ targetName, targetType }: { targetName: string; targetType: string }) {
  return (
    <div className="grid min-w-52 gap-2">
      <form action={markOperationsIncidentReviewed}>
        <OperationsHiddenFields targetName={targetName} targetType={targetType} />
        <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Mark reviewed
        </button>
      </form>
      <form action={viewOperationsLogs}>
        <OperationsHiddenFields targetName={targetName} targetType={targetType} />
        <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View logs
        </button>
      </form>
      <form action={retryOperationsPlaceholder}>
        <OperationsHiddenFields targetName={targetName} targetType={targetType} />
        <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
          Retry placeholder
        </button>
      </form>
    </div>
  );
}

export default async function AdminOperationsPage() {
  const control = await getAdminOperationsControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Read-only operations dashboard powered by the OP-1 registry runtime. Registry-derived module counts and section metadata load without queue execution, worker communication, cron runs, backups, or diagnostics."
        title="Platform Operations Center"
      />

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations dashboard</span>
        <AdminBadge tone={toneForStatus(control.dashboard.status)}>{control.dashboard.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.dashboard.summary}</span>
      </div>

      <AdminStatGrid stats={control.dashboardStats} />

      {control.dashboardSections.map((section) => (
        <AdminTable
          key={section.key}
          headers={[
            `${section.title} module`,
            "Category",
            "Runtime status",
            "Visibility",
            "Monitoring",
            "Audit",
            "Health",
            "Description"
          ]}
        >
          {section.items.map((item) => (
            <tr key={item.key}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.title}</td>
              <td className="px-5 py-4 text-slate-600">{item.category}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForDashboardRuntimeStatus(item.runtimeStatus)}>
                  {operationsDashboardRuntimeStatusLabel(item.runtimeStatus as OperationsDashboardRuntimeStatus)}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{item.visibility}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportTone(item.monitoringSupport)}>{supportLabel(item.monitoringSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportTone(item.auditSupport)}>{supportLabel(item.auditSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportTone(item.healthSupport)}>{supportLabel(item.healthSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{item.description}</td>
            </tr>
          ))}
        </AdminTable>
      ))}

      <AdminTable headers={["Section", "Status", "Notes", "Safe controls"]}>
        {control.sections.map((section) => (
          <tr key={section.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{section.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{section.note}</td>
            <td className="px-5 py-4">
              <OperationsActionButtons targetName={section.name} targetType="operations_section" />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Queue runtime</span>
        <AdminBadge tone={toneForStatus(control.queueRuntime.status)}>{control.queueRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.queueRuntime.summary}</span>
      </div>

      {control.queueRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} module{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable headers={["Queue", "Pending", "Processing", "Completed", "Failed", "Last processed", "Safe controls"]}>
        {control.queueRuntimeItems.map((queue) => (
          <tr key={queue.queueKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{queue.queueName}</span>
                <AdminBadge tone={toneForQueueRuntimeStatus(queue.runtimeStatus)}>
                  {operationsQueueRuntimeStatusLabel(queue.runtimeStatus as OperationsQueueRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {queue.tableDetected
                    ? queue.tableName
                      ? `Read-only from ${queue.tableName}`
                      : "Read-only workflow aggregate"
                    : "No queue table detected"}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{queue.pendingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{queue.processingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{queue.completedJobs}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={queue.failedJobs ? "red" : "green"}>{queue.failedJobs}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queue.lastJobAt)}</td>
            <td className="px-5 py-4">
              <QueueSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Email queue runtime</span>
        <AdminBadge tone={toneForStatus(control.emailQueueRuntime.status)}>{control.emailQueueRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.emailQueueRuntime.summary}</span>
      </div>

      {control.emailQueueRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} queue{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Email queue",
          "Total",
          "Pending",
          "Processing",
          "Sent",
          "Failed",
          "Provider",
          "Last email",
          "Safe controls"
        ]}
      >
        {control.emailQueueRuntimeItems.map((emailQueue) => (
          <tr key={emailQueue.emailQueueKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{emailQueue.queueName}</span>
                <AdminBadge tone={toneForEmailQueueRuntimeStatus(emailQueue.runtimeStatus)}>
                  {operationsEmailQueueRuntimeStatusLabel(emailQueue.runtimeStatus as OperationsEmailQueueRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {emailQueue.tableDetected
                    ? "Read-only from email_event_logs (metadata only; recipients and bodies hidden)"
                    : "No email queue table detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {emailQueue.reviewStatus} · Visibility: {emailQueue.visibility} · Masked recipients: {emailQueue.maskedRecipientCount}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{emailQueue.totalEmails}</td>
            <td className="px-5 py-4 text-slate-600">{emailQueue.pendingEmails}</td>
            <td className="px-5 py-4 text-slate-600">{emailQueue.processingEmails}</td>
            <td className="px-5 py-4 text-slate-600">{emailQueue.sentEmails}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={emailQueue.failedEmails ? "red" : "green"}>{emailQueue.failedEmails}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{emailQueue.provider}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(emailQueue.lastEmailAt)}</td>
            <td className="px-5 py-4">
              <EmailQueueSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI queue runtime</span>
        <AdminBadge tone={toneForStatus(control.aiQueueRuntime.status)}>{control.aiQueueRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.aiQueueRuntime.summary}</span>
      </div>

      {control.aiQueueRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} queue{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "AI queue",
          "Total",
          "Pending",
          "Processing",
          "Completed",
          "Failed",
          "Provider",
          "Model family",
          "Last job",
          "Safe controls"
        ]}
      >
        {control.aiQueueRuntimeItems.map((aiQueue) => (
          <tr key={aiQueue.aiQueueKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{aiQueue.queueName}</span>
                <AdminBadge tone={toneForAiQueueRuntimeStatus(aiQueue.runtimeStatus)}>
                  {operationsAiQueueRuntimeStatusLabel(aiQueue.runtimeStatus as OperationsAiQueueRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {aiQueue.tableDetected
                    ? "Read-only from ai_generation_queue (metadata only; prompts and outputs hidden)"
                    : "No AI queue table detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {aiQueue.reviewStatus} · Visibility: {aiQueue.visibility} · Cancelled: {aiQueue.cancelledJobs}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.totalJobs}</td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.pendingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.processingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.completedJobs}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={aiQueue.failedJobs ? "red" : "green"}>{aiQueue.failedJobs}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.provider}</td>
            <td className="px-5 py-4 text-slate-600">{aiQueue.modelFamily}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(aiQueue.lastJobAt)}</td>
            <td className="px-5 py-4">
              <AiQueueSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Domain & email queue runtime</span>
        <AdminBadge tone={toneForStatus(control.domainEmailQueueRuntime.status)}>{control.domainEmailQueueRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.domainEmailQueueRuntime.summary}</span>
      </div>

      {control.domainEmailQueueRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} queue{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Domain & email queue",
          "Type",
          "Total",
          "Pending",
          "Processing",
          "Completed",
          "Failed",
          "Provider",
          "Last job",
          "Safe controls"
        ]}
      >
        {control.domainEmailQueueRuntimeItems.map((domainEmailQueue) => (
          <tr key={domainEmailQueue.domainEmailQueueKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{domainEmailQueue.queueName}</span>
                <AdminBadge tone={toneForDomainEmailQueueRuntimeStatus(domainEmailQueue.runtimeStatus)}>
                  {operationsDomainEmailQueueRuntimeStatusLabel(
                    domainEmailQueue.runtimeStatus as OperationsDomainEmailQueueRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {domainEmailQueue.tableDetected
                    ? "Read-only queue metadata only; owner, customer, DNS values, and secrets hidden"
                    : "No domain or email queue table detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {domainEmailQueue.reviewStatus} · Visibility: {domainEmailQueue.visibility} · Masked jobs:{" "}
                  {domainEmailQueue.maskedJobCount}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.queueType}</td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.totalJobs}</td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.pendingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.processingJobs}</td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.completedJobs}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={domainEmailQueue.failedJobs ? "red" : "green"}>{domainEmailQueue.failedJobs}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{domainEmailQueue.provider}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(domainEmailQueue.lastJobAt)}</td>
            <td className="px-5 py-4">
              <DomainEmailQueueSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Worker runtime</span>
        <AdminBadge tone={toneForStatus(control.workerRuntime.status)}>{control.workerRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.workerRuntime.summary}</span>
      </div>

      {control.workerRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} worker{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable headers={["Worker", "Status", "Last run", "Failures", "Next run", "Safe controls"]}>
        {control.workerRuntimeItems.map((worker) => (
          <tr key={worker.workerKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{worker.workerName}</span>
                <AdminBadge tone={toneForWorkerRuntimeStatus(worker.runtimeStatus)}>
                  {operationsWorkerRuntimeStatusLabel(worker.runtimeStatus as OperationsWorkerRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {worker.tableDetected
                    ? worker.metadataSource
                      ? `Read-only from ${worker.metadataSource}`
                      : "Read-only workflow aggregate"
                    : "No worker table detected"}
                </span>
              </div>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForWorkerRuntimeStatus(worker.runtimeStatus)}>
                {operationsWorkerRuntimeStatusLabel(worker.runtimeStatus as OperationsWorkerRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(worker.lastRunAt)}</td>
            <td className="px-5 py-4 text-slate-600">{worker.failedRuns}</td>
            <td className="px-5 py-4 text-slate-600">{worker.nextRunLabel}</td>
            <td className="px-5 py-4">
              <WorkerSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Cron jobs runtime</span>
        <AdminBadge tone={toneForStatus(control.cronRuntime.status)}>{control.cronRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.cronRuntime.summary}</span>
      </div>

      {control.cronRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} cron job{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable headers={["Cron job", "Schedule", "Last run", "Next run", "Status", "Safe controls"]}>
        {control.cronRuntimeItems.map((cron) => (
          <tr key={cron.cronKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{cron.cronName}</span>
                <AdminBadge tone={toneForCronRuntimeStatus(cron.runtimeStatus)}>
                  {operationsCronRuntimeStatusLabel(cron.runtimeStatus as OperationsCronRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {cron.tableDetected
                    ? cron.metadataSource
                      ? `Read-only from ${cron.metadataSource}`
                      : "Read-only cron registry metadata"
                    : "No cron table detected"}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{cron.scheduleExpression}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(cron.lastRunAt)}</td>
            <td className="px-5 py-4 text-slate-600">{cron.nextRunLabel}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForCronRuntimeStatus(cron.runtimeStatus)}>
                {operationsCronRuntimeStatusLabel(cron.runtimeStatus as OperationsCronRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <CronSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Storage health runtime</span>
        <AdminBadge tone={toneForStatus(control.storageRuntime.status)}>{control.storageRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.storageRuntime.summary}</span>
      </div>

      {control.storageRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} target{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Storage",
          "Provider",
          "Bucket",
          "Health",
          "Runtime status",
          "Warnings",
          "Errors",
          "Safe controls"
        ]}
      >
        {control.storageRuntimeItems.map((storage) => (
          <tr key={storage.storageKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{storage.storageName}</span>
                <span className="text-xs text-slate-500">
                  {storage.metadataDetected
                    ? storage.metadataSource
                      ? `Read-only from ${storage.metadataSource}`
                      : "Read-only registry metadata"
                    : "No storage metadata detected"}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{storage.provider}</td>
            <td className="px-5 py-4 text-slate-600">{storage.bucketName ?? "Not configured"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStorageRuntimeStatus(storage.runtimeStatus)}>
                {operationsStorageHealthStatusLabel(storage.healthStatus as Parameters<typeof operationsStorageHealthStatusLabel>[0])}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStorageRuntimeStatus(storage.runtimeStatus)}>
                {operationsStorageRuntimeStatusLabel(storage.runtimeStatus as OperationsStorageRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{storage.warningCount}</td>
            <td className="px-5 py-4 text-slate-600">{storage.errorCount}</td>
            <td className="px-5 py-4">
              <StorageSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Database health runtime</span>
        <AdminBadge tone={toneForStatus(control.databaseRuntime.status)}>{control.databaseRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.databaseRuntime.summary}</span>
      </div>

      {control.databaseRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} target{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Database",
          "Provider",
          "Tables",
          "Health",
          "Runtime status",
          "Migrations",
          "Warnings",
          "Safe controls"
        ]}
      >
        {control.databaseRuntimeItems.map((database) => (
          <tr key={database.databaseKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{database.databaseName}</span>
                <span className="text-xs text-slate-500">
                  {database.metadataDetected
                    ? database.metadataSource
                      ? `Read-only from ${database.metadataSource}`
                      : "Read-only registry metadata"
                    : "No database metadata detected"}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{database.provider}</td>
            <td className="px-5 py-4 text-slate-600">{database.tableCount}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForDatabaseRuntimeStatus(database.runtimeStatus)}>
                {operationsDatabaseHealthStatusLabel(database.healthStatus as Parameters<typeof operationsDatabaseHealthStatusLabel>[0])}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForDatabaseRuntimeStatus(database.runtimeStatus)}>
                {operationsDatabaseRuntimeStatusLabel(database.runtimeStatus as OperationsDatabaseRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{database.migrationCount}</td>
            <td className="px-5 py-4 text-slate-600">{database.warningCount}</td>
            <td className="px-5 py-4">
              <DatabaseSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Monitoring events runtime</span>
        <AdminBadge tone={toneForStatus(control.monitoringEventsRuntime.status)}>{control.monitoringEventsRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.monitoringEventsRuntime.summary}</span>
      </div>

      {control.monitoringEventsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} stream{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Monitoring stream",
          "Event type",
          "Severity",
          "Status",
          "Count",
          "Source",
          "Last seen",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.monitoringEventsRuntimeItems.map((monitoringEvent) => (
          <tr key={monitoringEvent.monitoringEventKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{monitoringEvent.title}</span>
                <AdminBadge tone={toneForMonitoringEventsRuntimeStatus(monitoringEvent.runtimeStatus)}>
                  {operationsMonitoringEventsRuntimeStatusLabel(
                    monitoringEvent.runtimeStatus as OperationsMonitoringEventsRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {monitoringEvent.tableDetected
                    ? "Read-only from monitoring_events (metadata only; payloads and secrets hidden)"
                    : "No monitoring events table detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {monitoringEvent.reviewStatus} · Visibility: {monitoringEvent.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{monitoringEvent.eventType}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={monitoringEvent.severity === "critical" ? "red" : monitoringEvent.severity === "warning" ? "amber" : "green"}>
                {monitoringEvent.severity}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{monitoringEvent.status}</td>
            <td className="px-5 py-4 text-slate-600">{monitoringEvent.count}</td>
            <td className="px-5 py-4 text-slate-600">{monitoringEvent.source}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(monitoringEvent.lastSeenAt)}</td>
            <td className="px-5 py-4 text-slate-600">{monitoringEvent.safeSummary}</td>
            <td className="px-5 py-4">
              <MonitoringEventsSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Storage / database metric", "Value", "Status", "Notes"]}>
        {control.databaseStorage.map((metric) => (
          <tr key={metric.metric}>
            <td className="px-5 py-4 font-bold text-slate-950">{metric.metric}</td>
            <td className="px-5 py-4 text-slate-600">{metric.value}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(metric.status)}>{metric.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{metric.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Backup / disaster recovery", "Status", "Notes", "Diagnostics"]}>
        {control.backupRecovery.map((item) => (
          <tr key={item.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{item.note}</td>
            <td className="px-5 py-4">
              <form action={exportOperationsDiagnosticsPlaceholder}>
                <OperationsHiddenFields targetName={item.name} targetType="backup_disaster_recovery" />
                <button className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                  Export diagnostics
                </button>
              </form>
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
