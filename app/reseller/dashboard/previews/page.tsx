import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  copyPreviewLinkPlaceholder,
  disablePreviewPlaceholder,
  enablePreviewPlaceholder,
  expirePreviewPlaceholder,
  openPreviewPlaceholder,
  regeneratePreviewLinkPlaceholder
} from "@/lib/reseller-showcase/preview-actions";
import {
  getResellerPreviewsData,
  type ResellerPreviewItem,
  type ResellerPreviewStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type PreviewsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function statusClass(status: ResellerPreviewStatus) {
  if (status === "public_preview" || status === "enabled") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "draft_preview") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "under_review") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "expired") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-200 text-slate-700";
}

function PreviewHiddenFields({ preview }: { preview: ResellerPreviewItem }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/previews" />
      <input name="itemId" type="hidden" value={preview.id} />
    </>
  );
}

function PreviewActions({ preview }: { preview: ResellerPreviewItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={enablePreviewPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Enable
        </button>
      </form>
      <form action={disablePreviewPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Disable
        </button>
      </form>
      <form action={copyPreviewLinkPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Copy link
        </button>
      </form>
      <form action={openPreviewPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Open placeholder
        </button>
      </form>
      <form action={regeneratePreviewLinkPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-ink/10 bg-ink px-3 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
          Regenerate
        </button>
      </form>
      <form action={expirePreviewPlaceholder}>
        <PreviewHiddenFields preview={preview} />
        <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
          Expire
        </button>
      </form>
    </div>
  );
}

export default async function ResellerPreviewsPage({ searchParams }: PreviewsPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerPreviewsData()]);

  return (
    <>
      <PageHeader
        description="Manage safe public-ready preview links for store listings, templates, and showcase items before any purchase flow exists."
        title="Store Preview Management"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Preview placeholder action recorded.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Enabled</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.enabled}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Public previews</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.publicPreview}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Disabled</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.disabled}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Under review</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.underReview}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Preview statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statuses.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Preview list</p>
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
          {data.previews.length ? (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Item name</th>
                  <th className="px-4 py-3">Item type</th>
                  <th className="px-4 py-3">Preview URL</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last viewed</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.previews.map((preview) => (
                  <tr key={preview.id}>
                    <td className="px-4 py-4 font-black text-ink">{preview.itemName}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{preview.itemType}</td>
                    <td className="px-4 py-4">
                      {preview.status === "public_preview" || preview.status === "enabled" || preview.status === "draft_preview" ? (
                        <Link className="font-bold text-blue-700 underline-offset-4 hover:underline" href={preview.previewUrl}>
                          {preview.previewUrl}
                        </Link>
                      ) : (
                        <span className="font-semibold text-muted">{preview.previewUrl}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(preview.status)}`}>
                        {preview.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-muted">{preview.visibility}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{preview.createdAt ?? "Not tracked"}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{preview.lastViewedPlaceholder}</td>
                    <td className="px-4 py-4">
                      <PreviewActions preview={preview} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">{data.emptyState}</p>
          )}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Preview safety</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-7 text-amber-900" key={note}>
              {note}
            </p>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
