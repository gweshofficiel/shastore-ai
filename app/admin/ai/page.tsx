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
  markAIJobUnderReview,
  viewAIJobDetails,
  viewAIPublicAsset
} from "@/lib/admin/ai-actions";
import { getAdminAIControl } from "@/lib/admin/data";
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
import { getAIProviderHealthSnapshot } from "@/src/lib/ai/health/health-service";

function toneForStatus(status: string) {
  if (["completed", "configured", "healthy", "low", "masked_configured", "succeeded"].includes(status)) {
    return "green" as const;
  }

  if (["critical", "failed", "high", "missing", "missing_config", "offline"].includes(status)) {
    return "red" as const;
  }

  if (["processing", "active", "placeholder", "no_secret_required", "unknown"].includes(status)) {
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
  const [control, healthSnapshot, auditLogs, errorSnapshot] = await Promise.all([
    getAdminAIControl(),
    getAIProviderHealthSnapshot(),
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
    })
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
