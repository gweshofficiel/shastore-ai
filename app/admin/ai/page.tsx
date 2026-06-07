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

function toneForStatus(status: string) {
  if (["completed", "configured", "healthy", "masked_configured", "succeeded"].includes(status)) {
    return "green" as const;
  }

  if (["failed", "missing", "missing_config"].includes(status)) {
    return "red" as const;
  }

  if (["processing", "active", "placeholder", "no_secret_required"].includes(status)) {
    return "blue" as const;
  }

  return "amber" as const;
}

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

export default async function AdminAIPage() {
  const control = await getAdminAIControl();

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
