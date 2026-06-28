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

function toneForStatus(status: string) {
  if (["configured", "healthy", "idle", "monitoring", "ready", "running", "dashboard_ready", "registry_ready", "queue_runtime_ready", "worker_runtime_ready", "cron_runtime_ready"].includes(status)) {
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
