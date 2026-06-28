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
  formatStorageMetricsBytes,
  operationsStorageMetricsRuntimeStatusBadgeTone,
  operationsStorageMetricsRuntimeStatusLabel,
  type OperationsStorageMetricsRuntimeStatus
} from "@/src/lib/operations/operations-storage-metrics-runtime";
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
import {
  operationsWorkerMonitoringRuntimeStatusBadgeTone,
  operationsWorkerMonitoringRuntimeStatusLabel,
  type OperationsWorkerMonitoringRuntimeStatus
} from "@/src/lib/operations/operations-worker-monitoring-runtime";
import {
  operationsCronMonitoringRuntimeStatusBadgeTone,
  operationsCronMonitoringRuntimeStatusLabel,
  type OperationsCronMonitoringRuntimeStatus
} from "@/src/lib/operations/operations-cron-monitoring-runtime";
import {
  formatBackupBytes,
  operationsBackupRuntimeStatusBadgeTone,
  operationsBackupRuntimeStatusLabel,
  operationsBackupStatusLabel,
  type OperationsBackupRuntimeStatus
} from "@/src/lib/operations/operations-backup-runtime";
import {
  operationsDisasterRecoveryRuntimeStatusBadgeTone,
  operationsDisasterRecoveryRuntimeStatusLabel,
  operationsDisasterRecoveryStatusLabel,
  type OperationsDisasterRecoveryRuntimeStatus
} from "@/src/lib/operations/operations-disaster-recovery-runtime";
import {
  operationsDiagnosticsRuntimeStatusBadgeTone,
  operationsDiagnosticsRuntimeStatusLabel,
  operationsDiagnosticsStatusLabel,
  type OperationsDiagnosticsRuntimeStatus
} from "@/src/lib/operations/operations-diagnostics-runtime";
import {
  operationsSafeControlExecutionStatusLabel,
  operationsSafeControlRiskLevelTone,
  operationsSafeControlsRuntimeStatusBadgeTone,
  operationsSafeControlsRuntimeStatusLabel,
  type OperationsSafeControlsRuntimeStatus
} from "@/src/lib/operations/operations-safe-controls-runtime";
import {
  operationsStatusRuntimeStatusBadgeTone,
  operationsStatusRuntimeStatusLabel,
  type OperationsStatusRuntimeStatus
} from "@/src/lib/operations/operations-status-runtime";
import {
  operationsVisibilityStateBadgeTone,
  operationsVisibilityStateLabel,
  type OperationsVisibilityState
} from "@/src/lib/operations/operations-visibility-runtime";
import {
  operationsAuditRuntimeStatusBadgeTone,
  operationsAuditRuntimeStatusLabel,
  type OperationsAuditRuntimeStatus
} from "@/src/lib/operations/operations-audit-runtime";
import {
  operationsReviewStateBadgeTone,
  operationsReviewStateLabel,
  type OperationsReviewState
} from "@/src/lib/operations/operations-review-runtime";
import {
  operationsDataCertificationIntegrityLabel,
  operationsDataCertificationIntegrityTone,
  operationsDataCertificationSafetyLabel,
  type OperationsDataCertificationIntegrityStatus
} from "@/src/lib/operations/operations-data-certification-runtime";
import {
  operationsSecurityCertificationStatusLabel,
  operationsSecurityCertificationStatusTone,
  type OperationsSecurityCertificationStatus
} from "@/src/lib/operations/operations-security-certification-runtime";
import {
  operationsRuntimeCertificationStatusLabel,
  operationsRuntimeCertificationStatusTone,
  type OperationsRuntimeCertificationStatus
} from "@/src/lib/operations/operations-runtime-certification-runtime";
import {
  operationsProductionCertificationStatusLabel,
  operationsProductionCertificationStatusTone,
  operationsProductionReadinessLabel,
  type OperationsProductionCertificationStatus,
  type OperationsProductionReadinessStatus
} from "@/src/lib/operations/operations-production-certification-runtime";

function toneForStatus(status: string) {
  if (["configured", "healthy", "idle", "monitoring", "ready", "running", "dashboard_ready", "registry_ready", "queue_runtime_ready", "worker_runtime_ready", "cron_runtime_ready", "storage_runtime_ready", "storage_metrics_runtime_ready", "backup_runtime_ready", "disaster_recovery_runtime_ready", "diagnostics_runtime_ready", "safe_controls_runtime_ready", "operations_status_runtime_ready", "operations_visibility_runtime_ready", "operations_audit_runtime_ready", "operations_review_runtime_ready", "operations_data_certification_ready", "operations_security_certification_ready", "operations_runtime_certification_ready", "operations_production_certification_ready", "database_runtime_ready", "email_queue_runtime_ready", "ai_queue_runtime_ready", "domain_email_queue_runtime_ready", "monitoring_events_runtime_ready", "worker_monitoring_runtime_ready", "cron_monitoring_runtime_ready"].includes(status)) {
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

function toneForStorageMetricsRuntimeStatus(status: string) {
  return operationsStorageMetricsRuntimeStatusBadgeTone(status as OperationsStorageMetricsRuntimeStatus);
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

function toneForWorkerMonitoringRuntimeStatus(status: string) {
  return operationsWorkerMonitoringRuntimeStatusBadgeTone(status as OperationsWorkerMonitoringRuntimeStatus);
}

function toneForCronMonitoringRuntimeStatus(status: string) {
  return operationsCronMonitoringRuntimeStatusBadgeTone(status as OperationsCronMonitoringRuntimeStatus);
}

function toneForBackupRuntimeStatus(status: string) {
  return operationsBackupRuntimeStatusBadgeTone(status as OperationsBackupRuntimeStatus);
}

function toneForDisasterRecoveryRuntimeStatus(status: string) {
  return operationsDisasterRecoveryRuntimeStatusBadgeTone(status as OperationsDisasterRecoveryRuntimeStatus);
}

function toneForDiagnosticsRuntimeStatus(status: string) {
  return operationsDiagnosticsRuntimeStatusBadgeTone(status as OperationsDiagnosticsRuntimeStatus);
}

function toneForSafeControlsRuntimeStatus(status: string) {
  return operationsSafeControlsRuntimeStatusBadgeTone(status as OperationsSafeControlsRuntimeStatus);
}

function toneForStatusRuntimeStatus(status: string) {
  return operationsStatusRuntimeStatusBadgeTone(status as OperationsStatusRuntimeStatus);
}

function toneForVisibilityState(status: string) {
  return operationsVisibilityStateBadgeTone(status as OperationsVisibilityState);
}

function toneForAuditRuntimeStatus(status: string) {
  return operationsAuditRuntimeStatusBadgeTone(status as OperationsAuditRuntimeStatus);
}

function toneForReviewState(status: string) {
  return operationsReviewStateBadgeTone(status as OperationsReviewState);
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

function StorageMetricsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Refresh Metrics", "Inspect Objects", "Cleanup", "Repair", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No storage metrics action is executed during OP-14 page load."
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

function WorkerMonitoringSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect Logs", "Restart Worker", "Retry Failed", "Pause Worker", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No worker monitoring action is executed during OP-12 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CronMonitoringSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect Runs", "Trigger Now", "Pause Cron", "Resume Cron", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No cron monitoring action is executed during OP-13 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BackupSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Create Backup", "Restore Backup", "Verify Backup", "Download", "Delete", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No backup action is executed during OP-15 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DisasterRecoverySafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Run Recovery Test", "Restore", "Failover", "Rollback", "Verify Recovery Plan", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No disaster recovery action is executed during OP-16 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DiagnosticsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Run Diagnostics", "Inspect", "Repair", "Auto Fix", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No diagnostics action is executed during OP-17 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VisibilitySafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Change Visibility", "Review Permissions", "Review Route", "Review Feature Flag", "Export Report"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No visibility action is executed during OP-20 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AuditSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect Audit", "Resolve", "Export Audit", "Review Actor", "Review Payload"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No audit action is executed during OP-21 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReviewSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Approve Review", "Reject Review", "Resolve Blocker", "Mark Production Ready", "Export Review"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No review action is executed during OP-22 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DataCertificationSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Approve Certification", "Recheck Data", "Export Certification", "Resolve Blocker", "Mark Certified"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No certification action is executed during OP-23 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SecurityCertificationSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Approve Security Certification", "Recheck Security", "Export Security Report", "Resolve Security Blocker", "Mark Security Certified"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No security certification action is executed during OP-24 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RuntimeCertificationSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Approve Runtime Certification", "Recheck Runtime", "Export Runtime Report", "Resolve Runtime Blocker", "Mark Runtime Certified"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No runtime certification action is executed during OP-25 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ProductionCertificationSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Approve Production Certification", "Recheck Production Readiness", "Export Production Report", "Resolve Production Blocker", "Mark Production Certified"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No production certification action is executed during OP-26 page load."
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
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Worker monitoring runtime</span>
        <AdminBadge tone={toneForStatus(control.workerMonitoringRuntime.status)}>{control.workerMonitoringRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.workerMonitoringRuntime.summary}</span>
      </div>

      {control.workerMonitoringRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} monitor{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Worker monitor",
          "Type",
          "Linked queue",
          "Monitoring",
          "Runs",
          "Failed",
          "Warnings",
          "Last seen",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.workerMonitoringRuntimeItems.map((workerMonitor) => (
          <tr key={workerMonitor.workerMonitoringKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{workerMonitor.workerName}</span>
                <AdminBadge tone={toneForWorkerMonitoringRuntimeStatus(workerMonitor.runtimeStatus)}>
                  {operationsWorkerMonitoringRuntimeStatusLabel(
                    workerMonitor.runtimeStatus as OperationsWorkerMonitoringRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {workerMonitor.metadataDetected
                    ? "Read-only worker metadata and monitoring events only; logs and payloads hidden"
                    : "No worker monitoring metadata detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {workerMonitor.reviewStatus} · Visibility: {workerMonitor.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{workerMonitor.workerType}</td>
            <td className="px-5 py-4 text-slate-600">{workerMonitor.linkedQueue}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={workerMonitor.monitoringStatus === "failed" ? "red" : workerMonitor.monitoringStatus === "warning" ? "amber" : "green"}>
                {workerMonitor.monitoringStatus}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{workerMonitor.totalRuns}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={workerMonitor.failedRuns ? "red" : "green"}>{workerMonitor.failedRuns}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{workerMonitor.warningCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(workerMonitor.lastSeenAt)}</td>
            <td className="px-5 py-4 text-slate-600">{workerMonitor.safeSummary}</td>
            <td className="px-5 py-4">
              <WorkerMonitoringSafeControls />
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
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Cron monitoring runtime</span>
        <AdminBadge tone={toneForStatus(control.cronMonitoringRuntime.status)}>{control.cronMonitoringRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.cronMonitoringRuntime.summary}</span>
      </div>

      {control.cronMonitoringRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} monitor{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Cron monitor",
          "Type",
          "Schedule",
          "Monitoring",
          "Runs",
          "Failed",
          "Last run",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.cronMonitoringRuntimeItems.map((cronMonitor) => (
          <tr key={cronMonitor.cronMonitoringKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{cronMonitor.cronName}</span>
                <AdminBadge tone={toneForCronMonitoringRuntimeStatus(cronMonitor.runtimeStatus)}>
                  {operationsCronMonitoringRuntimeStatusLabel(
                    cronMonitor.runtimeStatus as OperationsCronMonitoringRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {cronMonitor.metadataDetected
                    ? "Read-only cron metadata and monitoring events only; logs and payloads hidden"
                    : "No cron monitoring metadata detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {cronMonitor.reviewStatus} · Visibility: {cronMonitor.visibility} · TZ: {cronMonitor.timezone}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{cronMonitor.cronType}</td>
            <td className="px-5 py-4 text-slate-600">{cronMonitor.scheduleExpression}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={cronMonitor.monitoringStatus === "failed" ? "red" : cronMonitor.monitoringStatus === "warning" ? "amber" : "green"}>
                {cronMonitor.monitoringStatus}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{cronMonitor.totalRuns}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={cronMonitor.failedRuns ? "red" : "green"}>{cronMonitor.failedRuns}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(cronMonitor.lastRunAt)}</td>
            <td className="px-5 py-4 text-slate-600">{cronMonitor.safeSummary}</td>
            <td className="px-5 py-4">
              <CronMonitoringSafeControls />
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
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Storage metrics runtime</span>
        <AdminBadge tone={toneForStatus(control.storageMetricsRuntime.status)}>{control.storageMetricsRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.storageMetricsRuntime.summary}</span>
      </div>

      {control.storageMetricsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} metric{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Storage metric",
          "Provider",
          "Bucket",
          "Objects",
          "Size",
          "Runtime status",
          "Last measured",
          "Warnings",
          "Safe controls"
        ]}
      >
        {control.storageMetricsRuntimeItems.map((metric) => (
          <tr key={metric.storageMetricKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{metric.storageName}</span>
                <AdminBadge tone={toneForStorageMetricsRuntimeStatus(metric.runtimeStatus)}>
                  {operationsStorageMetricsRuntimeStatusLabel(
                    metric.runtimeStatus as OperationsStorageMetricsRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {metric.metricsDetected
                    ? metric.metadataSource
                      ? `Read-only from ${metric.metadataSource}; object paths and signed URLs hidden`
                      : "Read-only recorded storage metrics only"
                    : "No storage metrics detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {metric.reviewStatus} · Visibility: {metric.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{metric.provider}</td>
            <td className="px-5 py-4 text-slate-600">{metric.bucketName ?? "Not configured"}</td>
            <td className="px-5 py-4 text-slate-600">{metric.totalObjects}</td>
            <td className="px-5 py-4 text-slate-600">{formatStorageMetricsBytes(metric.totalSizeBytes)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStorageMetricsRuntimeStatus(metric.runtimeStatus)}>
                {operationsStorageMetricsRuntimeStatusLabel(
                  metric.runtimeStatus as OperationsStorageMetricsRuntimeStatus
                )}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(metric.lastMeasuredAt)}</td>
            <td className="px-5 py-4 text-slate-600">{metric.warningCount}</td>
            <td className="px-5 py-4">
              <StorageMetricsSafeControls />
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

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Backup runtime</span>
        <AdminBadge tone={toneForStatus(control.backupRuntime.status)}>{control.backupRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.backupRuntime.summary}</span>
      </div>

      {control.backupRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} backup{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Backup",
          "Type",
          "Provider",
          "Location",
          "Status",
          "Count",
          "Size",
          "Last backup",
          "Safe controls"
        ]}
      >
        {control.backupRuntimeItems.map((backup) => (
          <tr key={backup.backupKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{backup.backupName}</span>
                <AdminBadge tone={toneForBackupRuntimeStatus(backup.runtimeStatus)}>
                  {operationsBackupRuntimeStatusLabel(backup.runtimeStatus as OperationsBackupRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {backup.metadataDetected
                    ? backup.metadataSource
                      ? `Read-only from ${backup.metadataSource}; paths, dumps, and credentials hidden`
                      : "Read-only recorded backup metadata only"
                    : "No backup metadata detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {backup.reviewStatus} · Visibility: {backup.visibility} · Retention: {backup.retentionPolicyLabel}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{backup.backupType}</td>
            <td className="px-5 py-4 text-slate-600">{backup.provider}</td>
            <td className="px-5 py-4 text-slate-600">{backup.storageLocationLabel}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={backup.backupStatus === "failed" ? "red" : backup.backupStatus === "warning" ? "amber" : "green"}>
                {operationsBackupStatusLabel(backup.backupStatus as Parameters<typeof operationsBackupStatusLabel>[0])}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{backup.backupCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatBackupBytes(backup.totalSizeBytes)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(backup.lastBackupAt)}</td>
            <td className="px-5 py-4">
              <BackupSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Disaster recovery runtime</span>
        <AdminBadge tone={toneForStatus(control.disasterRecoveryRuntime.status)}>{control.disasterRecoveryRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.disasterRecoveryRuntime.summary}</span>
      </div>

      {control.disasterRecoveryRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} recover{group.itemCount === 1 ? "y" : "ies"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Recovery",
          "Type",
          "Scope",
          "Status",
          "RPO",
          "RTO",
          "Last test",
          "Backup dependency",
          "Safe controls"
        ]}
      >
        {control.disasterRecoveryRuntimeItems.map((recovery) => (
          <tr key={recovery.recoveryKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{recovery.recoveryName}</span>
                <AdminBadge tone={toneForDisasterRecoveryRuntimeStatus(recovery.runtimeStatus)}>
                  {operationsDisasterRecoveryRuntimeStatusLabel(
                    recovery.runtimeStatus as OperationsDisasterRecoveryRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {recovery.metadataDetected
                    ? recovery.metadataSource
                      ? `Read-only from ${recovery.metadataSource}; endpoints, URLs, and credentials hidden`
                      : "Read-only recorded recovery metadata only"
                    : "No recovery metadata detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {recovery.reviewStatus} · Visibility: {recovery.visibility} · Provider: {recovery.provider}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{recovery.recoveryType}</td>
            <td className="px-5 py-4 text-slate-600">{recovery.recoveryScope}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={recovery.recoveryStatus === "failed" ? "red" : recovery.recoveryStatus === "warning" ? "amber" : "green"}>
                {operationsDisasterRecoveryStatusLabel(
                  recovery.recoveryStatus as Parameters<typeof operationsDisasterRecoveryStatusLabel>[0]
                )}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{recovery.recoveryPointObjectiveLabel}</td>
            <td className="px-5 py-4 text-slate-600">{recovery.recoveryTimeObjectiveLabel}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(recovery.lastRecoveryTestAt)}</td>
            <td className="px-5 py-4 text-slate-600">{recovery.backupDependencyLabel}</td>
            <td className="px-5 py-4">
              <DisasterRecoverySafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Diagnostics runtime</span>
        <AdminBadge tone={toneForStatus(control.diagnosticsRuntime.status)}>{control.diagnosticsRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.diagnosticsRuntime.summary}</span>
      </div>

      {control.diagnosticsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} diagnostic{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Diagnostic",
          "Type",
          "Source",
          "Status",
          "Runtime status",
          "Last checked",
          "Warnings",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.diagnosticsRuntimeItems.map((diagnostic) => (
          <tr key={diagnostic.diagnosticKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{diagnostic.diagnosticName}</span>
                <AdminBadge tone={toneForDiagnosticsRuntimeStatus(diagnostic.runtimeStatus)}>
                  {operationsDiagnosticsRuntimeStatusLabel(
                    diagnostic.runtimeStatus as OperationsDiagnosticsRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {diagnostic.metadataDetected
                    ? "Read-only diagnostic metadata and recorded events only; logs, payloads, and credentials hidden"
                    : "No diagnostic metadata detected"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {diagnostic.reviewStatus} · Visibility: {diagnostic.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{diagnostic.diagnosticType}</td>
            <td className="px-5 py-4 text-slate-600">{diagnostic.source}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={diagnostic.diagnosticStatus === "failed" ? "red" : diagnostic.diagnosticStatus === "warning" ? "amber" : "green"}>
                {operationsDiagnosticsStatusLabel(
                  diagnostic.diagnosticStatus as Parameters<typeof operationsDiagnosticsStatusLabel>[0]
                )}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForDiagnosticsRuntimeStatus(diagnostic.runtimeStatus)}>
                {operationsDiagnosticsRuntimeStatusLabel(
                  diagnostic.runtimeStatus as OperationsDiagnosticsRuntimeStatus
                )}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(diagnostic.lastCheckedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{diagnostic.warningCount}</td>
            <td className="px-5 py-4 text-slate-600">{diagnostic.safeSummary}</td>
            <td className="px-5 py-4">
              <DiagnosticsSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Safe controls runtime</span>
        <AdminBadge tone={toneForStatus(control.safeControlsRuntime.status)}>{control.safeControlsRuntime.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.safeControlsRuntime.summary}</span>
      </div>

      {control.safeControlsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.controlCount} control{group.controlCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Control",
          "Type",
          "Target runtime",
          "Risk",
          "Execution",
          "Permissions",
          "Disabled reason",
          "Action"
        ]}
      >
        {control.safeControlsRuntimeItems.map((safeControl) => (
          <tr key={safeControl.controlKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{safeControl.controlName}</span>
                <AdminBadge tone={toneForSafeControlsRuntimeStatus(safeControl.runtimeStatus)}>
                  {operationsSafeControlsRuntimeStatusLabel(
                    safeControl.runtimeStatus as OperationsSafeControlsRuntimeStatus
                  )}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  {safeControl.metadataDetected
                    ? "Registry-based disabled control; read-only metadata only"
                    : "Control registered; metadata pending"}
                </span>
                <span className="text-xs text-slate-500">
                  Review: {safeControl.reviewStatus} · Visibility: {safeControl.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{safeControl.controlType}</td>
            <td className="px-5 py-4 text-slate-600">{safeControl.targetRuntime}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={operationsSafeControlRiskLevelTone(safeControl.riskLevel as Parameters<typeof operationsSafeControlRiskLevelTone>[0])}>
                {safeControl.riskLevel}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-xs text-slate-600">
                <span>Disabled</span>
                <span>Read-only</span>
                <span>Requires future certification</span>
                <span>{operationsSafeControlExecutionStatusLabel(safeControl.executionStatus as Parameters<typeof operationsSafeControlExecutionStatusLabel>[0])}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{safeControl.permissionScope}</td>
            <td className="px-5 py-4 text-slate-600">{safeControl.disabledReason}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                title={safeControl.disabledReason}
                type="button"
              >
                {safeControl.controlName}
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations status runtime</span>
        <AdminBadge tone={toneForStatus(control.statusRuntime.overallStatus)}>{control.statusRuntime.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.statusRuntime.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total modules", value: String(control.statusRuntime.totalModules) },
          { label: "Runtime ready", value: String(control.statusRuntime.runtimeReadyModules) },
          { label: "Review required", value: String(control.statusRuntime.reviewRequiredModules) },
          { label: "Production ready", value: String(control.statusRuntime.productionReadyModules) },
          { label: "Warnings", value: String(control.statusRuntime.warningModules) },
          { label: "Future hooks", value: String(control.statusRuntime.futureHooks) }
        ]}
      />

      {control.statusRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} module{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Module",
          "Category",
          "Runtime",
          "Health",
          "Monitoring",
          "Certification",
          "Review",
          "Safe summary"
        ]}
      >
        {control.statusRuntimeItems.map((statusItem) => (
          <tr key={statusItem.operationsStatusKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{statusItem.moduleName}</span>
                <AdminBadge tone={toneForStatusRuntimeStatus(statusItem.runtimeStatus)}>
                  {operationsStatusRuntimeStatusLabel(statusItem.runtimeStatus as OperationsStatusRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only status derived from registry and runtime metadata only; no status mutation
                </span>
                <span className="text-xs text-slate-500">
                  Module: {statusItem.moduleKey} · Visibility: {statusItem.visibility}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{statusItem.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatusRuntimeStatus(statusItem.runtimeStatus)}>
                {operationsStatusRuntimeStatusLabel(statusItem.runtimeStatus as OperationsStatusRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{statusItem.healthStatus}</td>
            <td className="px-5 py-4 text-slate-600">{statusItem.monitoringStatus}</td>
            <td className="px-5 py-4 text-slate-600">{statusItem.certificationStatus}</td>
            <td className="px-5 py-4 text-slate-600">{statusItem.reviewStatus}</td>
            <td className="px-5 py-4 text-slate-600">{statusItem.safeSummary}</td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations visibility runtime</span>
        <AdminBadge tone={toneForStatus(control.visibilityRuntime.overallStatus)}>{control.visibilityRuntime.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.visibilityRuntime.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total modules", value: String(control.visibilityRuntime.totalModules) },
          { label: "Visible", value: String(control.visibilityRuntime.visibleModules) },
          { label: "Hidden", value: String(control.visibilityRuntime.hiddenModules) },
          { label: "Disabled", value: String(control.visibilityRuntime.disabledModules) },
          { label: "Super admin only", value: String(control.visibilityRuntime.superAdminOnlyModules) },
          { label: "Review required", value: String(control.visibilityRuntime.reviewRequiredModules) },
          { label: "Future hooks", value: String(control.visibilityRuntime.futureHookModules) }
        ]}
      />

      {control.visibilityRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} module{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Module",
          "Category",
          "Visibility",
          "Access",
          "Permissions",
          "Route",
          "Feature",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.visibilityRuntimeItems.map((visibilityItem) => (
          <tr key={visibilityItem.visibilityKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{visibilityItem.moduleName}</span>
                <AdminBadge tone={toneForVisibilityState(visibilityItem.visibility)}>
                  {operationsVisibilityStateLabel(visibilityItem.visibility as OperationsVisibilityState)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only visibility derived from registry and runtime metadata only; no visibility mutation
                </span>
                <span className="text-xs text-slate-500">
                  Module: {visibilityItem.moduleKey} · Review: {visibilityItem.reviewStatus}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForVisibilityState(visibilityItem.visibility)}>
                {operationsVisibilityStateLabel(visibilityItem.visibility as OperationsVisibilityState)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.accessLevel}</td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.permissionScope}</td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.routeStatus}</td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.featureStatus}</td>
            <td className="px-5 py-4 text-slate-600">{visibilityItem.safeSummary}</td>
            <td className="px-5 py-4">
              <VisibilitySafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations audit runtime</span>
        <AdminBadge tone={toneForStatus(control.auditRuntime.overallStatus)}>{control.auditRuntime.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.auditRuntime.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total audit items", value: String(control.auditRuntime.totalAuditItems) },
          { label: "Available", value: String(control.auditRuntime.availableItems) },
          { label: "Registered", value: String(control.auditRuntime.registeredItems) },
          { label: "Empty", value: String(control.auditRuntime.emptyItems) },
          { label: "No audit data", value: String(control.auditRuntime.noAuditDataItems) },
          { label: "Review required", value: String(control.auditRuntime.reviewRequiredItems) },
          { label: "Future hooks", value: String(control.auditRuntime.futureHookItems) }
        ]}
      />

      {control.auditRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} item{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Module",
          "Category",
          "Audit status",
          "Type",
          "Action",
          "Actor",
          "Severity",
          "Occurred",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.auditRuntimeItems.map((auditItem) => (
          <tr key={auditItem.auditKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{auditItem.moduleName}</span>
                <AdminBadge tone={toneForAuditRuntimeStatus(auditItem.runtimeStatus)}>
                  {operationsAuditRuntimeStatusLabel(auditItem.runtimeStatus as OperationsAuditRuntimeStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only audit metadata only; no audit creation, mutation, export, or payload exposure
                </span>
                <span className="text-xs text-slate-500">
                  Module: {auditItem.moduleKey} · Review: {auditItem.reviewStatus}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{auditItem.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForAuditRuntimeStatus(auditItem.runtimeStatus)}>
                {operationsAuditRuntimeStatusLabel(auditItem.runtimeStatus as OperationsAuditRuntimeStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{auditItem.auditType}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.actionType}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.actorType}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.severity}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.occurredAt ?? "Not recorded"}</td>
            <td className="px-5 py-4 text-slate-600">{auditItem.safeSummary}</td>
            <td className="px-5 py-4">
              <AuditSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations review runtime</span>
        <AdminBadge tone={toneForStatus(control.reviewRuntime.overallStatus)}>{control.reviewRuntime.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.reviewRuntime.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total modules", value: String(control.reviewRuntime.totalModules) },
          { label: "Reviewed", value: String(control.reviewRuntime.reviewedModules) },
          { label: "Review required", value: String(control.reviewRuntime.reviewRequiredModules) },
          { label: "Blocked", value: String(control.reviewRuntime.blockedModules) },
          { label: "Warnings", value: String(control.reviewRuntime.warningModules) },
          { label: "Production ready candidates", value: String(control.reviewRuntime.productionReadyCandidates) },
          { label: "Disabled", value: String(control.reviewRuntime.disabledModules) },
          { label: "Future hooks", value: String(control.reviewRuntime.futureHooks) }
        ]}
      />

      {control.reviewRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} module{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Module",
          "Category",
          "Review",
          "Runtime",
          "Health",
          "Visibility",
          "Audit",
          "Blockers",
          "Warnings",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.reviewRuntimeItems.map((reviewItem) => (
          <tr key={reviewItem.reviewKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{reviewItem.moduleName}</span>
                <AdminBadge tone={toneForReviewState(reviewItem.reviewStatus)}>
                  {operationsReviewStateLabel(reviewItem.reviewStatus as OperationsReviewState)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only review derived from registry, status, visibility, and audit metadata only; no approval or mutation
                </span>
                <span className="text-xs text-slate-500">
                  Module: {reviewItem.moduleKey}
                  {reviewItem.certificationCandidate ? " · Production ready candidate" : ""}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForReviewState(reviewItem.reviewStatus)}>
                {operationsReviewStateLabel(reviewItem.reviewStatus as OperationsReviewState)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.runtimeStatus}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.healthStatus}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.visibility}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.auditStatus}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.blockerCount}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.warningCount}</td>
            <td className="px-5 py-4 text-slate-600">{reviewItem.safeSummary}</td>
            <td className="px-5 py-4">
              <ReviewSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations data certification</span>
        <AdminBadge tone={toneForStatus(control.dataCertification.overallStatus)}>{control.dataCertification.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.dataCertification.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total scopes", value: String(control.dataCertification.totalCertifications) },
          { label: "Certified", value: String(control.dataCertification.certifiedScopes) },
          { label: "Review required", value: String(control.dataCertification.reviewRequiredScopes) },
          { label: "Blocked", value: String(control.dataCertification.blockedScopes) },
          { label: "Warnings", value: String(control.dataCertification.warningScopes) }
        ]}
      />

      {control.dataCertificationGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} scope{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Certification",
          "Scope",
          "Integrity",
          "Placeholders",
          "Mutation",
          "Secrets",
          "Execution",
          "Certified",
          "Review",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.dataCertificationItems.map((certificationItem) => (
          <tr key={certificationItem.certificationKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{certificationItem.certificationName}</span>
                <AdminBadge tone={operationsDataCertificationIntegrityTone(certificationItem.dataIntegrityStatus as OperationsDataCertificationIntegrityStatus)}>
                  {operationsDataCertificationIntegrityLabel(certificationItem.dataIntegrityStatus as OperationsDataCertificationIntegrityStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only certification derived from OP-1 through OP-22 metadata only; no certification mutation
                </span>
                <span className="text-xs text-slate-500">
                  Blocked: {certificationItem.blockedModules} · Warnings: {certificationItem.warningModules}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{certificationItem.certificationScope}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={operationsDataCertificationIntegrityTone(certificationItem.dataIntegrityStatus as OperationsDataCertificationIntegrityStatus)}>
                {operationsDataCertificationIntegrityLabel(certificationItem.dataIntegrityStatus as OperationsDataCertificationIntegrityStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{operationsDataCertificationSafetyLabel(certificationItem.placeholderStatus as never)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsDataCertificationSafetyLabel(certificationItem.mutationSafetyStatus as never)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsDataCertificationSafetyLabel(certificationItem.secretSafetyStatus as never)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsDataCertificationSafetyLabel(certificationItem.executionSafetyStatus as never)}</td>
            <td className="px-5 py-4 text-slate-600">{certificationItem.certifiedModules}</td>
            <td className="px-5 py-4 text-slate-600">{certificationItem.reviewRequiredModules}</td>
            <td className="px-5 py-4 text-slate-600">{certificationItem.safeSummary}</td>
            <td className="px-5 py-4">
              <DataCertificationSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations security certification</span>
        <AdminBadge tone={toneForStatus(control.securityCertification.overallStatus)}>{control.securityCertification.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.securityCertification.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total scopes", value: String(control.securityCertification.totalCertifications) },
          { label: "Certified", value: String(control.securityCertification.certifiedScopes) },
          { label: "Review required", value: String(control.securityCertification.reviewRequiredScopes) },
          { label: "Blocked", value: String(control.securityCertification.blockedScopes) },
          { label: "Warnings", value: String(control.securityCertification.warningScopes) }
        ]}
      />

      {control.securityCertificationGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} scope{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Certification",
          "Scope",
          "Super Admin",
          "Read only",
          "Mutation",
          "Execution",
          "Secrets",
          "Private data",
          "RLS",
          "Actions",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.securityCertificationItems.map((securityItem) => (
          <tr key={securityItem.securityCertificationKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{securityItem.certificationName}</span>
                <AdminBadge tone={operationsSecurityCertificationStatusTone(securityItem.superAdminOnlyStatus as OperationsSecurityCertificationStatus)}>
                  {operationsSecurityCertificationStatusLabel(securityItem.superAdminOnlyStatus as OperationsSecurityCertificationStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only security certification derived from OP-1 through OP-23 metadata only; no security mutation
                </span>
                <span className="text-xs text-slate-500">
                  Certified modules: {securityItem.certifiedModules} · Blocked: {securityItem.blockedModules} · Warnings: {securityItem.warningModules}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{securityItem.certificationScope}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.superAdminOnlyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.readOnlyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.mutationSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.executionSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.secretSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.privateDataSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.rlsSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsSecurityCertificationStatusLabel(securityItem.actionSafetyStatus as OperationsSecurityCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{securityItem.safeSummary}</td>
            <td className="px-5 py-4">
              <SecurityCertificationSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations runtime certification</span>
        <AdminBadge tone={toneForStatus(control.runtimeCertification.overallStatus)}>{control.runtimeCertification.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.runtimeCertification.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total scopes", value: String(control.runtimeCertification.totalCertifications) },
          { label: "Certified", value: String(control.runtimeCertification.certifiedScopes) },
          { label: "Review required", value: String(control.runtimeCertification.reviewRequiredScopes) },
          { label: "Blocked", value: String(control.runtimeCertification.blockedScopes) },
          { label: "Warnings", value: String(control.runtimeCertification.warningScopes) }
        ]}
      />

      {control.runtimeCertificationGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} scope{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Certification",
          "Scope",
          "Integrity",
          "Read only",
          "Mutation",
          "Execution",
          "Data",
          "Security",
          "Certified",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.runtimeCertificationItems.map((runtimeItem) => (
          <tr key={runtimeItem.runtimeCertificationKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{runtimeItem.certificationName}</span>
                <AdminBadge tone={operationsRuntimeCertificationStatusTone(runtimeItem.runtimeIntegrityStatus as OperationsRuntimeCertificationStatus)}>
                  {operationsRuntimeCertificationStatusLabel(runtimeItem.runtimeIntegrityStatus as OperationsRuntimeCertificationStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only runtime certification derived from OP-1 through OP-24 metadata only; no runtime mutation
                </span>
                <span className="text-xs text-slate-500">
                  Blocked: {runtimeItem.blockedModules} · Warnings: {runtimeItem.warningModules}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{runtimeItem.certificationScope}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={operationsRuntimeCertificationStatusTone(runtimeItem.runtimeIntegrityStatus as OperationsRuntimeCertificationStatus)}>
                {operationsRuntimeCertificationStatusLabel(runtimeItem.runtimeIntegrityStatus as OperationsRuntimeCertificationStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{operationsRuntimeCertificationStatusLabel(runtimeItem.readOnlyStatus as OperationsRuntimeCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsRuntimeCertificationStatusLabel(runtimeItem.mutationSafetyStatus as OperationsRuntimeCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsRuntimeCertificationStatusLabel(runtimeItem.executionSafetyStatus as OperationsRuntimeCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsRuntimeCertificationStatusLabel(runtimeItem.dataSafetyStatus as OperationsRuntimeCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsRuntimeCertificationStatusLabel(runtimeItem.securitySafetyStatus as OperationsRuntimeCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{runtimeItem.certifiedModules}</td>
            <td className="px-5 py-4 text-slate-600">{runtimeItem.safeSummary}</td>
            <td className="px-5 py-4">
              <RuntimeCertificationSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Operations production certification</span>
        <AdminBadge tone={toneForStatus(control.productionCertification.overallStatus)}>{control.productionCertification.overallStatus}</AdminBadge>
        <span className="text-sm text-slate-600">{control.productionCertification.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Total scopes", value: String(control.productionCertification.totalCertifications) },
          { label: "Production ready", value: String(control.productionCertification.productionReadyScopes) },
          { label: "Review required", value: String(control.productionCertification.reviewRequiredScopes) },
          { label: "Blocked", value: String(control.productionCertification.blockedScopes) },
          { label: "Warnings", value: String(control.productionCertification.warningScopes) }
        ]}
      />

      {control.productionCertificationGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">{group.itemCount} scope{group.itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      ))}

      <AdminTable
        headers={[
          "Certification",
          "Scope",
          "Production readiness",
          "Integrity",
          "Read only",
          "Mutation",
          "Execution",
          "Data",
          "Security",
          "Certified",
          "Safe summary",
          "Safe controls"
        ]}
      >
        {control.productionCertificationItems.map((productionItem) => (
          <tr key={productionItem.productionCertificationKey}>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <span className="font-bold text-slate-950">{productionItem.certificationName}</span>
                <AdminBadge tone={operationsProductionCertificationStatusTone(productionItem.productionReadinessStatus as OperationsProductionReadinessStatus)}>
                  {operationsProductionReadinessLabel(productionItem.productionReadinessStatus as OperationsProductionReadinessStatus)}
                </AdminBadge>
                <span className="text-xs text-slate-500">
                  Read-only production certification derived from OP-1 through OP-25 metadata only; no production mutation
                </span>
                <span className="text-xs text-slate-500">
                  Blocked: {productionItem.blockedModules} · Warnings: {productionItem.warningModules}
                </span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{productionItem.certificationScope}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={operationsProductionCertificationStatusTone(productionItem.productionReadinessStatus as OperationsProductionReadinessStatus)}>
                {operationsProductionReadinessLabel(productionItem.productionReadinessStatus as OperationsProductionReadinessStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={operationsProductionCertificationStatusTone(productionItem.runtimeIntegrityStatus as OperationsProductionCertificationStatus)}>
                {operationsProductionCertificationStatusLabel(productionItem.runtimeIntegrityStatus as OperationsProductionCertificationStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{operationsProductionCertificationStatusLabel(productionItem.readOnlyStatus as OperationsProductionCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsProductionCertificationStatusLabel(productionItem.mutationSafetyStatus as OperationsProductionCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsProductionCertificationStatusLabel(productionItem.executionSafetyStatus as OperationsProductionCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsProductionCertificationStatusLabel(productionItem.dataSafetyStatus as OperationsProductionCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{operationsProductionCertificationStatusLabel(productionItem.securitySafetyStatus as OperationsProductionCertificationStatus)}</td>
            <td className="px-5 py-4 text-slate-600">{productionItem.certifiedModules}</td>
            <td className="px-5 py-4 text-slate-600">{productionItem.safeSummary}</td>
            <td className="px-5 py-4">
              <ProductionCertificationSafeControls />
            </td>
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
