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

function toneForStatus(status: string) {
  if (["configured", "healthy", "idle", "monitoring", "ready", "running", "dashboard_ready", "registry_ready"].includes(status)) {
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

      <AdminTable headers={["Queue", "Pending", "Processing", "Completed", "Failed", "Last processed", "Retry"]}>
        {control.queues.map((queue) => (
          <tr key={queue.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{queue.name}</td>
            <td className="px-5 py-4 text-slate-600">{queue.pending}</td>
            <td className="px-5 py-4 text-slate-600">{queue.processing}</td>
            <td className="px-5 py-4 text-slate-600">{queue.completed}</td>
            <td className="px-5 py-4"><AdminBadge tone={queue.failed ? "red" : "green"}>{queue.failed}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(queue.lastProcessed)}</td>
            <td className="px-5 py-4">
              <OperationsActionButtons targetName={queue.name} targetType="queue" />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Worker", "Status", "Last run", "Failures", "Next run", "Controls"]}>
        {control.workers.map((worker) => (
          <tr key={worker.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{worker.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(worker.status)}>{worker.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(worker.lastRun)}</td>
            <td className="px-5 py-4 text-slate-600">{worker.failures}</td>
            <td className="px-5 py-4 text-slate-600">{worker.nextRun}</td>
            <td className="px-5 py-4">
              <OperationsActionButtons targetName={worker.name} targetType="worker" />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Cron job", "Schedule", "Last run", "Next run", "Status", "Controls"]}>
        {control.cronJobs.map((cron) => (
          <tr key={cron.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{cron.name}</td>
            <td className="px-5 py-4 text-slate-600">{cron.schedule}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(cron.lastRun)}</td>
            <td className="px-5 py-4 text-slate-600">{cron.nextRun}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(cron.status)}>{cron.status}</AdminBadge></td>
            <td className="px-5 py-4">
              <OperationsActionButtons targetName={cron.name} targetType="cron" />
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
