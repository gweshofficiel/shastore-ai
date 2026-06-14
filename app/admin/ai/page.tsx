import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import {
  clearAIJobReview,
  markAISecretRotatedAction,
  markAISecretRotationRequiredAction,
  markAIJobUnderReview,
  runAIDiagnosticAction,
  runAllAIDiagnosticsAction,
  viewAIJobDetails,
  viewAIPublicAsset
} from "@/lib/admin/ai-actions";
import { getAdminAIControl } from "@/lib/admin/data";
import { getAIUsageAnalyticsSnapshot } from "@/src/lib/ai/analytics/ai-usage-analytics";
import type { AIUsageDateRange } from "@/src/lib/ai/analytics/ai-usage-types";
import { listAiAuditLogs } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AiAuditEventType,
  AiAuditStatus
} from "@/src/lib/ai/audit/ai-audit-types";
import {
  aiErrorGroups,
  aiErrorSeverities
} from "@/src/lib/ai/errors/error-center";
import { getAIErrorCenterSnapshot } from "@/src/lib/ai/errors/error-service";
import type {
  AIErrorGroup,
  AIErrorSeverity
} from "@/src/lib/ai/errors/error-types";
import { getAIDiagnosticsSnapshot } from "@/src/lib/ai/diagnostics/diagnostics-service";
import { getAIProviderHealthSnapshot } from "@/src/lib/ai/health/health-service";
import { getAIQueueMonitoringSnapshot } from "@/src/lib/ai/queue/ai-queue-monitoring";
import type {
  AIQueueDateRange,
  AIQueueJobStatus
} from "@/src/lib/ai/queue/ai-queue-types";
import { listAISecretsMonitoring } from "@/src/lib/ai/secrets/ai-secrets-monitoring";

function toneForStatus(status: string) {
  if (["completed", "configured", "connected", "fresh", "healthy", "low", "masked_configured", "succeeded"].includes(status)) {
    return "green" as const;
  }

  if (["critical", "failed", "high", "missing", "missing_config", "offline", "rotation_required", "stale_queue", "stale_running", "timeout"].includes(status)) {
    return "red" as const;
  }

  if (["disabled", "processing", "active", "placeholder", "no_secret_required", "queued", "retry_pending", "running", "skipped", "unknown"].includes(status)) {
    return "blue" as const;
  }

  return "amber" as const;
}

function firstParam(value: string | string[] | undefined, fallback = "all") {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function safeSummaryText(value: Record<string, unknown> | null) {
  if (!value || !Object.keys(value).length) {
    return "No summary";
  }

  return JSON.stringify(value).slice(0, 300);
}

const auditStatuses: Array<AiAuditStatus | "all"> = [
  "all",
  "started",
  "success",
  "failed",
  "skipped",
  "blocked"
];
const auditEventTypes: Array<AiAuditEventType | "all"> = [
  "all",
  "ai_secret_rotation_required",
  "ai_secret_marked_rotated",
  "ai_queue_monitor_viewed",
  "ai_stale_job_detected",
  "ai_diagnostic_started",
  "ai_diagnostic_success",
  "ai_diagnostic_failed",
  "ai_diagnostic_skipped",
  "ai_job_requested",
  "ai_job_queued",
  "ai_job_started",
  "ai_job_completed",
  "ai_job_failed",
  "ai_job_cancelled",
  "ai_asset_created",
  "ai_asset_published",
  "ai_asset_review_marked",
  "ai_asset_review_cleared"
];
const errorDateRanges = ["24h", "7d", "30d", "all"];
const queueStatuses: Array<AIQueueJobStatus | "all"> = [
  "all",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "retry_pending"
];
const queueDateRanges: Array<AIQueueDateRange> = ["24h", "7d", "30d", "all"];
const usageDateRanges: Array<AIUsageDateRange> = [
  "today",
  "last_7_days",
  "last_30_days",
  "all_time"
];

function AIJobHiddenFields({
  job
}: {
  job: Awaited<ReturnType<typeof getAdminAIControl>>["jobs"][number];
}) {
  return (
    <>
      <input name="jobId" type="hidden" value={job.id} />
      <input name="storeId" type="hidden" value={job.storeId ?? ""} />
      <input name="provider" type="hidden" value={job.provider} />
      <input name="status" type="hidden" value={job.status} />
    </>
  );
}

export default async function AdminAIPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const auditStatus = firstParam(params.auditStatus) as AiAuditStatus | "all";
  const auditProvider = firstParam(params.auditProvider);
  const auditAssetType = firstParam(params.auditAssetType);
  const auditEventType = firstParam(params.auditEventType) as AiAuditEventType | "all";
  const errorProvider = firstParam(params.errorProvider);
  const errorSeverity = firstParam(params.errorSeverity) as AIErrorSeverity | "all";
  const errorGroup = firstParam(params.errorGroup) as AIErrorGroup | "all";
  const errorDateRange = firstParam(params.errorDateRange, "7d") as "24h" | "7d" | "30d" | "all";
  const errorStore = firstParam(params.errorStore);
  const queueStatus = firstParam(params.queueStatus) as AIQueueJobStatus | "all";
  const queueProvider = firstParam(params.queueProvider);
  const queueAssetType = firstParam(params.queueAssetType);
  const queueStore = firstParam(params.queueStore);
  const queueDateRange = firstParam(params.queueDateRange, "7d") as AIQueueDateRange;
  const usageDateRange = firstParam(params.usageDateRange, "last_30_days") as AIUsageDateRange;
  const usageProvider = firstParam(params.usageProvider);
  const usageStore = firstParam(params.usageStore);
  const usageAssetType = firstParam(params.usageAssetType);
  const usageStatus = firstParam(params.usageStatus);
  const [control, healthSnapshot, usageSnapshot, auditLogs, errorSnapshot, diagnosticsSnapshot, queueSnapshot, secretsSnapshot] = await Promise.all([
    getAdminAIControl(),
    getAIProviderHealthSnapshot(),
    getAIUsageAnalyticsSnapshot({
      assetType: usageAssetType,
      dateRange: usageDateRange,
      provider: usageProvider,
      status: usageStatus,
      storeId: usageStore
    }),
    listAiAuditLogs({
      assetType: auditAssetType,
      eventType: auditEventType,
      providerKey: auditProvider,
      status: auditStatus
    }),
    getAIErrorCenterSnapshot({
      dateRange: errorDateRange,
      errorGroup,
      provider: errorProvider,
      severity: errorSeverity,
      storeId: errorStore
    }),
    getAIDiagnosticsSnapshot(),
    getAIQueueMonitoringSnapshot({
      assetType: queueAssetType,
      dateRange: queueDateRange,
      provider: queueProvider,
      status: queueStatus,
      storeId: queueStore
    }, { audit: true }),
    listAISecretsMonitoring()
  ]);
  const auditProviders = [...new Set(auditLogs.map((log) => log.providerKey).filter(Boolean))].sort();
  const auditAssetTypes = [...new Set(auditLogs.map((log) => log.assetType).filter(Boolean))].sort();
  const errorProviders = [...new Set([
    ...errorSnapshot.errors.map((error) => error.provider).filter(Boolean),
    errorProvider !== "all" ? errorProvider : null
  ].filter(Boolean))].sort();
  const errorStores = [...new Set([
    ...errorSnapshot.errors.map((error) => error.storeId).filter(Boolean),
    errorStore !== "all" ? errorStore : null
  ].filter(Boolean))].sort();
  const queueProviders = [...new Set([
    ...queueSnapshot.jobs.map((job) => job.provider).filter(Boolean),
    queueProvider !== "all" ? queueProvider : null
  ].filter(Boolean))].sort();
  const queueAssetTypes = [...new Set([
    ...queueSnapshot.jobs.map((job) => job.assetType).filter(Boolean),
    queueAssetType !== "all" ? queueAssetType : null
  ].filter(Boolean))].sort();
  const queueStores = [...new Set([
    ...queueSnapshot.jobs.map((job) => job.storeId).filter(Boolean),
    queueStore !== "all" ? queueStore : null
  ].filter(Boolean))].sort();
  const usageStatuses = [
    "all",
    ...usageSnapshot.usageByStatus.map((row) => row.status)
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin monitoring for AI Visuals and future AI systems. This center uses safe metadata only: no API keys, no raw provider responses, no regenerate action, and no provider calls."
        title="AI Control Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Total AI jobs", value: control.overview.totalJobs },
          { label: "Completed jobs", value: control.overview.completedJobs },
          { label: "Failed jobs", value: control.overview.failedJobs },
          { label: "Pending jobs", value: control.overview.pendingJobs },
          { label: "Processing jobs", value: control.overview.processingJobs },
          { label: "Estimated AI cost", value: formatAdminMoney(control.overview.estimatedCost) },
          { label: "Stores using AI", value: control.overview.storesUsingAI },
          { label: "Top AI asset types", value: control.overview.topAssetTypes }
        ]}
      />

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
            AI Runtime Health Engine
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
            AI Provider Health
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
            Calculated from existing AI jobs, logs, provider configuration status, and runtime metadata. No provider calls, generations, raw responses, or secret values are used.
          </p>
        </div>
        <AdminTable
          empty={!healthSnapshot.providers.length ? "No AI provider health metadata is available." : null}
          headers={["Provider", "Configured", "Enabled", "Health", "Last Activity", "Recent Failures"]}
        >
          {healthSnapshot.providers.map((provider) => (
            <tr key={provider.provider}>
              <td className="px-5 py-4 font-bold text-slate-950">{provider.providerName}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={provider.configured ? "green" : "blue"}>
                  {provider.configured ? "configured" : "not_configured"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={provider.enabled ? "green" : "red"}>
                  {provider.enabled ? "enabled" : "disabled"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(provider.health)}>{provider.health}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(provider.lastActivity)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={provider.recentFailures > 0 ? "red" : "green"}>
                  {provider.recentFailures}
                </AdminBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
              AI Usage Analytics
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              AI usage and asset activity
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Aggregated from existing AI jobs, queue rows, result rows, and AI audit logs. No provider calls, generation, credit changes, prompts, raw responses, private URLs, or secrets are used.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-5" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Date range
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageDateRange}
                name="usageDateRange"
              >
                {usageDateRanges.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageProvider}
                name="usageProvider"
              >
                <option value="all">All providers</option>
                {usageSnapshot.providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Store
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageStore}
                name="usageStore"
              >
                <option value="all">All stores</option>
                {usageSnapshot.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Asset type
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageAssetType}
                name="usageAssetType"
              >
                <option value="all">All asset types</option>
                {usageSnapshot.assetTypes.map((assetType) => (
                  <option key={assetType} value={assetType}>
                    {assetType}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageStatus}
                name="usageStatus"
              >
                {usageStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 sm:col-span-5"
              type="submit"
            >
              Apply usage filters
            </button>
          </form>
        </div>
        <AdminStatGrid
          stats={[
            { label: "Total AI jobs", value: usageSnapshot.summary.totalAiJobs },
            { label: "Successful jobs", value: usageSnapshot.summary.successfulJobs },
            { label: "Failed jobs", value: usageSnapshot.summary.failedJobs },
            { label: "Cancelled jobs", value: usageSnapshot.summary.cancelledJobs },
            { label: "Success rate", value: `${usageSnapshot.summary.successRate}%` },
            { label: "Failure rate", value: `${usageSnapshot.summary.failureRate}%` },
            { label: "Unique stores", value: usageSnapshot.summary.uniqueStoresUsingAi },
            { label: "Unique users", value: usageSnapshot.summary.uniqueUsersUsingAi },
            { label: "Generated assets", value: usageSnapshot.summary.generatedAssetsCount },
            { label: "Reviewed assets", value: usageSnapshot.summary.reviewedAssetsCount },
            { label: "Published assets", value: usageSnapshot.summary.publishedAssetsCount }
          ]}
        />
        <AdminTable
          empty={!usageSnapshot.usageByProvider.length ? "No provider usage found for the current filters." : null}
          headers={["Provider", "Total jobs", "Successful", "Failed", "Cancelled", "Generated assets", "Success rate"]}
        >
          {usageSnapshot.usageByProvider.map((row) => (
            <tr key={row.key}>
              <td className="px-5 py-4 font-bold text-slate-950">{row.label}</td>
              <td className="px-5 py-4 text-slate-600">{row.totalJobs}</td>
              <td className="px-5 py-4"><AdminBadge tone="green">{row.successfulJobs}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={row.failedJobs > 0 ? "red" : "green"}>{row.failedJobs}</AdminBadge></td>
              <td className="px-5 py-4 text-slate-600">{row.cancelledJobs}</td>
              <td className="px-5 py-4 text-slate-600">{row.generatedAssets}</td>
              <td className="px-5 py-4 text-slate-600">{row.successRate}%</td>
            </tr>
          ))}
        </AdminTable>
        <AdminTable
          empty={!usageSnapshot.usageByStore.length ? "No store usage found for the current filters." : null}
          headers={["Store", "Total jobs", "Successful", "Failed", "Cancelled", "Generated assets", "Success rate"]}
        >
          {usageSnapshot.usageByStore.map((row) => (
            <tr key={row.key}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{row.label}</p>
                <p className="mt-1 break-all text-xs font-semibold text-slate-400">{row.key}</p>
              </td>
              <td className="px-5 py-4 text-slate-600">{row.totalJobs}</td>
              <td className="px-5 py-4"><AdminBadge tone="green">{row.successfulJobs}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={row.failedJobs > 0 ? "red" : "green"}>{row.failedJobs}</AdminBadge></td>
              <td className="px-5 py-4 text-slate-600">{row.cancelledJobs}</td>
              <td className="px-5 py-4 text-slate-600">{row.generatedAssets}</td>
              <td className="px-5 py-4 text-slate-600">{row.successRate}%</td>
            </tr>
          ))}
        </AdminTable>
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminTable
            empty={!usageSnapshot.usageByAssetType.length ? "No asset type usage found for the current filters." : null}
            headers={["Asset type", "Total jobs", "Successful", "Failed", "Generated assets"]}
          >
            {usageSnapshot.usageByAssetType.map((row) => (
              <tr key={row.key}>
                <td className="px-5 py-4 font-bold text-slate-950">{row.label}</td>
                <td className="px-5 py-4 text-slate-600">{row.totalJobs}</td>
                <td className="px-5 py-4 text-slate-600">{row.successfulJobs}</td>
                <td className="px-5 py-4 text-slate-600">{row.failedJobs}</td>
                <td className="px-5 py-4 text-slate-600">{row.generatedAssets}</td>
              </tr>
            ))}
          </AdminTable>
          <AdminTable
            empty={!usageSnapshot.usageByStatus.length ? "No status breakdown found for the current filters." : null}
            headers={["Status", "Count"]}
          >
            {usageSnapshot.usageByStatus.map((row) => (
              <tr key={row.status}>
                <td className="px-5 py-4"><AdminBadge tone={toneForStatus(row.status)}>{row.status}</AdminBadge></td>
                <td className="px-5 py-4 text-slate-600">{row.count}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
              AI Queue Monitoring
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              AI queue runtime overview
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Read-only monitoring for existing AI jobs and queues. Stale jobs are flagged in this dashboard only; no worker, retry, cancellation, provider call, generation, or credit behavior is changed.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-5" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={queueStatus}
                name="queueStatus"
              >
                {queueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={queueProvider}
                name="queueProvider"
              >
                <option value="all">All providers</option>
                {queueProviders.map((provider) => (
                  <option key={provider} value={provider ?? ""}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Asset type
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={queueAssetType}
                name="queueAssetType"
              >
                <option value="all">All asset types</option>
                {queueAssetTypes.map((assetType) => (
                  <option key={assetType} value={assetType ?? ""}>
                    {assetType}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Store
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={queueStore}
                name="queueStore"
              >
                <option value="all">All stores</option>
                {queueStores.map((storeId) => (
                  <option key={storeId} value={storeId ?? ""}>
                    {storeId}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Date range
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={queueDateRange}
                name="queueDateRange"
              >
                {queueDateRanges.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-cyan-200 bg-cyan-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-cyan-700 sm:col-span-5"
              type="submit"
            >
              Apply queue filters
            </button>
          </form>
        </div>
        <AdminStatGrid
          stats={[
            { label: "Total jobs", value: queueSnapshot.summary.totalJobs },
            { label: "Queued", value: queueSnapshot.summary.queued },
            { label: "Running", value: queueSnapshot.summary.running },
            { label: "Completed", value: queueSnapshot.summary.completed },
            { label: "Failed", value: queueSnapshot.summary.failed },
            { label: "Cancelled", value: queueSnapshot.summary.cancelled },
            { label: "Timeout/stale", value: queueSnapshot.summary.timeout },
            { label: "Retry pending", value: queueSnapshot.summary.retryPending },
            { label: "Oldest queued", value: formatAdminDate(queueSnapshot.summary.oldestQueuedJob) },
            { label: "Avg processing time", value: queueSnapshot.summary.averageProcessingTimeText }
          ]}
        />
        <AdminTable
          empty={!queueSnapshot.jobs.length ? "No AI queue jobs match the current filters." : null}
          headers={[
            "Job ID",
            "Provider",
            "Store",
            "User",
            "Asset type",
            "Status",
            "Created",
            "Started",
            "Completed",
            "Duration",
            "Error summary"
          ]}
        >
          {queueSnapshot.jobs.map((job) => (
            <tr key={`${job.source}:${job.jobId}`}>
              <td className="px-5 py-4 break-all font-bold text-slate-950">{job.jobId}</td>
              <td className="px-5 py-4 text-slate-600">{job.provider}</td>
              <td className="px-5 py-4 text-slate-600">
                {job.storeName}
                {job.storeId ? (
                  <p className="mt-1 break-all text-xs font-semibold text-slate-400">{job.storeId}</p>
                ) : null}
              </td>
              <td className="px-5 py-4 break-all text-slate-600">{job.userId ?? "Unknown user"}</td>
              <td className="px-5 py-4 text-slate-600">{job.assetType ?? "No asset type"}</td>
              <td className="px-5 py-4">
                <div className="grid gap-2">
                  <AdminBadge tone={toneForStatus(job.status)}>{job.status}</AdminBadge>
                  {job.staleState !== "fresh" ? (
                    <AdminBadge tone={toneForStatus(job.staleState)}>{job.staleState}</AdminBadge>
                  ) : null}
                </div>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.startedAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.completedAt)}</td>
              <td className="px-5 py-4 text-slate-600">{job.durationText}</td>
              <td className="px-5 py-4 text-slate-600">{job.errorMessage ?? "No error"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <AdminTable
        empty={!control.providers.length ? "No AI provider status records found." : null}
        headers={["Provider", "Runtime", "Configuration", "Health", "Cost tracking", "Secret status"]}
      >
        {control.providers.map((provider) => (
          <tr key={provider.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{provider.name}</td>
            <td className="px-5 py-4 text-slate-600">{provider.provider}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(provider.configurationStatus)}>{provider.configurationStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(provider.healthStatus)}>{provider.healthStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{provider.costTracking}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(provider.secretStatus)}>{provider.secretStatus}</AdminBadge>
              <p className="mt-2 text-xs font-semibold text-slate-500">Provider secrets are masked and never displayed.</p>
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">
              AI Diagnostics Center
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Safe AI provider diagnostics
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Diagnostics validate configuration and runtime readiness with env/config presence checks only. No provider calls, generation, credit deduction, raw responses, prompts, or secrets are used.
            </p>
          </div>
          <form action={runAllAIDiagnosticsAction}>
            <button
              className="h-10 rounded-full border border-indigo-200 bg-indigo-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-indigo-700"
              type="submit"
            >
              Run all diagnostics
            </button>
          </form>
        </div>
        <AdminTable
          empty={!diagnosticsSnapshot.providers.length ? "No AI diagnostics are available." : null}
          headers={[
            "Provider",
            "Configured",
            "Enabled",
            "Status",
            "Last Checked",
            "Response Time",
            "Safe Message",
            "Actions"
          ]}
        >
          {diagnosticsSnapshot.providers.map((diagnostic) => (
            <tr key={diagnostic.provider}>
              <td className="px-5 py-4 font-bold text-slate-950">{diagnostic.provider_name}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={diagnostic.configured ? "green" : "red"}>
                  {diagnostic.configured ? "configured" : "missing_config"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={diagnostic.enabled ? "green" : "blue"}>
                  {diagnostic.enabled ? "enabled" : "disabled"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(diagnostic.status)}>{diagnostic.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(diagnostic.last_checked_at)}</td>
              <td className="px-5 py-4 text-slate-600">{diagnostic.response_time_ms}ms</td>
              <td className="px-5 py-4 text-slate-600">
                {diagnostic.safe_message}
                {diagnostic.error_message ? (
                  <p className="mt-2 text-xs font-semibold text-red-500">
                    {diagnostic.error_code ?? "diagnostic_error"}: {diagnostic.error_message}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-4">
                <form action={runAIDiagnosticAction}>
                  <input name="provider" type="hidden" value={diagnostic.provider} />
                  <button
                    className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                    type="submit"
                  >
                    Run diagnostic
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
            AI Provider Secrets Monitoring
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
            AI provider configuration and rotation metadata
          </h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
            Displays secret key names and rotation state only. Secret values, tokens, passwords, authorization headers, private keys, and raw env values are never displayed or modified.
          </p>
        </div>
        <AdminTable
          empty={!secretsSnapshot.providers.length ? "No AI provider secret metadata is available." : null}
          headers={[
            "Provider",
            "Status",
            "Required keys",
            "Missing keys",
            "Rotation required",
            "Last rotated",
            "Actions"
          ]}
        >
          {secretsSnapshot.providers.map((secret) => (
            <tr key={secret.provider}>
              <td className="px-5 py-4 font-bold text-slate-950">{secret.provider_name}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(secret.status)}>{secret.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {secret.required_secret_names.join(", ")}
              </td>
              <td className="px-5 py-4 text-slate-600">
                {secret.missing_required_secrets.length ? secret.missing_required_secrets.join(", ") : "No required keys missing"}
                {secret.optional_secrets_missing.length ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Optional missing: {secret.optional_secrets_missing.join(", ")}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={secret.rotation_required ? "red" : "green"}>
                  {secret.rotation_required ? "required" : "not_required"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(secret.last_rotated_at)}</td>
              <td className="px-5 py-4">
                <div className="grid min-w-48 gap-2">
                  <form action={markAISecretRotationRequiredAction}>
                    <input name="provider" type="hidden" value={secret.provider} />
                    <button
                      className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
                      type="submit"
                    >
                      Mark rotation required
                    </button>
                  </form>
                  <form action={markAISecretRotatedAction}>
                    <input name="provider" type="hidden" value={secret.provider} />
                    <button
                      className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                      type="submit"
                    >
                      Mark rotated
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <AdminTable
        empty={!control.jobs.length ? "No AI jobs found." : null}
        headers={[
          "Store",
          "Owner",
          "Job type",
          "Provider",
          "Status",
          "Cost estimate",
          "Created",
          "Completed",
          "Error summary",
          "Actions"
        ]}
      >
        {control.jobs.map((job) => (
          <tr key={`${job.storeId ?? "platform"}-${job.id}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{job.storeName}</td>
            <td className="px-5 py-4 text-slate-600">{job.ownerEmail}</td>
            <td className="px-5 py-4 text-slate-600">{job.jobType}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{job.provider}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(job.status)}>{job.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(job.costEstimate)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.completedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{job.errorSummary ?? "No error"}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markAIJobUnderReview}>
                  <AIJobHiddenFields job={job} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Mark review
                  </button>
                </form>
                <form action={clearAIJobReview}>
                  <AIJobHiddenFields job={job} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Clear review
                  </button>
                </form>
                <form action={viewAIJobDetails}>
                  <AIJobHiddenFields job={job} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    View details
                  </button>
                </form>
                {job.assetUrl ? (
                  <form action={viewAIPublicAsset}>
                    <AIJobHiddenFields job={job} />
                    <Link
                      className="flex h-9 w-full items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                      href={job.assetUrl}
                      target="_blank"
                    >
                      Public asset
                    </Link>
                  </form>
                ) : (
                  <button
                    className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    No public asset
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              AI Error Center
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Aggregated AI runtime failures
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Repeated AI failures are grouped from existing audit logs, queue metadata, and visual job metadata. This view never exposes prompts, raw provider responses, secrets, tokens, or private asset URLs.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-5" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorProvider}
                name="errorProvider"
              >
                <option value="all">All providers</option>
                {errorProviders.map((provider) => (
                  <option key={provider} value={provider ?? ""}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Severity
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorSeverity}
                name="errorSeverity"
              >
                <option value="all">All severities</option>
                {aiErrorSeverities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Group
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorGroup}
                name="errorGroup"
              >
                <option value="all">All groups</option>
                {aiErrorGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Date range
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorDateRange}
                name="errorDateRange"
              >
                {errorDateRanges.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Store
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorStore}
                name="errorStore"
              >
                <option value="all">All stores</option>
                {errorStores.map((storeId) => (
                  <option key={storeId} value={storeId ?? ""}>
                    {storeId}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700 sm:col-span-5"
              type="submit"
            >
              Apply error filters
            </button>
          </form>
        </div>
        <AdminTable
          empty={!errorSnapshot.errors.length ? "No AI errors match the current filters." : null}
          headers={[
            "Error Group",
            "Provider",
            "Severity",
            "Occurrences",
            "First Seen",
            "Last Seen",
            "Store",
            "Asset Type"
          ]}
        >
          {errorSnapshot.errors.map((error) => (
            <tr key={error.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{error.errorGroup}</p>
                <p className="mt-2 max-w-sm text-xs font-semibold text-slate-500">
                  {error.errorMessage ?? "No safe error message"}
                </p>
                {error.errorCode ? (
                  <p className="mt-1 text-xs font-semibold text-slate-400">Code: {error.errorCode}</p>
                ) : null}
              </td>
              <td className="px-5 py-4 text-slate-600">{error.provider ?? "No provider"}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(error.severity)}>{error.severity}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={error.occurrences >= 10 ? "red" : error.occurrences >= 3 ? "amber" : "blue"}>
                  {error.occurrences}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(error.firstSeenAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(error.lastSeenAt)}</td>
              <td className="px-5 py-4 break-all text-slate-600">{error.storeId ?? "No store"}</td>
              <td className="px-5 py-4 text-slate-600">{error.assetType ?? "No asset type"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              AI Audit Logs
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Centralized AI runtime audit trail
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Safe metadata only. Prompts, raw provider responses, private asset URLs, tokens, and API keys are never displayed.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-4" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditStatus}
                name="auditStatus"
              >
                {auditStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditProvider}
                name="auditProvider"
              >
                <option value="all">All providers</option>
                {auditProviders.map((provider) => (
                  <option key={provider} value={provider ?? ""}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Asset type
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditAssetType}
                name="auditAssetType"
              >
                <option value="all">All asset types</option>
                {auditAssetTypes.map((assetType) => (
                  <option key={assetType} value={assetType ?? ""}>
                    {assetType}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Event type
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditEventType}
                name="auditEventType"
              >
                {auditEventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700 sm:col-span-4"
              type="submit"
            >
              Apply audit filters
            </button>
          </form>
        </div>
        <AdminTable
          empty={!auditLogs.length ? "No AI audit logs match the current filters." : null}
          headers={[
            "Time",
            "Event type",
            "Provider",
            "Job",
            "Store",
            "Asset type",
            "Status",
            "Error",
            "Safe summary"
          ]}
        >
          {auditLogs.map((log) => (
            <tr key={log.id}>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(log.createdAt)}</td>
              <td className="px-5 py-4 font-bold text-slate-950">{log.eventType}</td>
              <td className="px-5 py-4 text-slate-600">{log.providerKey ?? "No provider"}</td>
              <td className="px-5 py-4 break-all text-slate-600">{log.jobId ?? "No job"}</td>
              <td className="px-5 py-4 break-all text-slate-600">{log.storeId ?? "No store"}</td>
              <td className="px-5 py-4 text-slate-600">{log.assetType ?? "No asset type"}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(log.status)}>{log.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {log.errorMessage ?? "No error"}
                {log.errorCode ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Code: {log.errorCode}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-4 break-all text-slate-600">{safeSummaryText(log.safeSummary)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <AdminTable
        empty={!control.storeUsage.length ? "No store AI usage found." : null}
        headers={["Store", "Owner", "Total jobs", "Completed", "Failed", "Estimated cost", "Last activity"]}
      >
        {control.storeUsage.map((store) => (
          <tr key={store.storeId}>
            <td className="px-5 py-4 font-bold text-slate-950">{store.storeName}</td>
            <td className="px-5 py-4 text-slate-600">{store.ownerEmail}</td>
            <td className="px-5 py-4 text-slate-600">{store.totalJobs}</td>
            <td className="px-5 py-4"><AdminBadge tone="green">{store.completed}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={store.failed > 0 ? "red" : "green"}>{store.failed}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(store.estimatedCost)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(store.lastActivity)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Failure monitor", "Count", "Scope"]}>
        {control.failureMonitoring.map((failure) => (
          <tr key={failure.label}>
            <td className="px-5 py-4 font-bold text-slate-950">{failure.label}</td>
            <td className="px-5 py-4"><AdminBadge tone={failure.count > 0 ? "red" : "green"}>{failure.count}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{failure.note}</td>
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
