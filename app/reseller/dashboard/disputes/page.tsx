import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  addDisputeNotePlaceholder,
  closeDisputePlaceholder,
  createDisputePlaceholder,
  escalateDisputePlaceholder,
  requestDisputeReviewPlaceholder,
  uploadDisputeEvidencePlaceholder
} from "@/lib/reseller-showcase/dispute-actions";
import {
  getResellerDisputesData,
  type ResellerDisputeRecord,
  type ResellerDisputeStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type DisputesPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function statusClass(status: ResellerDisputeStatus) {
  if (status === "resolved_placeholder" || status === "closed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "escalated") {
    return "bg-red-100 text-red-700";
  }

  if (status === "under_review") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "awaiting_response") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "rejected") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-violet-100 text-violet-700";
}

function DisputeHiddenFields({ dispute }: { dispute: ResellerDisputeRecord | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/disputes" />
      <input name="disputeId" type="hidden" value={dispute?.disputeId ?? "dispute-placeholder"} />
      <input name="category" type="hidden" value={dispute?.category ?? "other"} />
      <input name="priority" type="hidden" value={dispute?.priority ?? "normal"} />
      <input name="relatedTransfer" type="hidden" value={dispute?.relatedTransfer ?? "transfer-placeholder"} />
      <input name="relatedDelivery" type="hidden" value={dispute?.relatedDelivery ?? "delivery-placeholder"} />
      <input name="relatedRequest" type="hidden" value={dispute?.relatedRequest ?? "request-placeholder"} />
      <input name="relatedReview" type="hidden" value={dispute?.relatedReview ?? "review-placeholder"} />
      <input name="disputeStatus" type="hidden" value={dispute?.status ?? "open"} />
      <input name="summary" type="hidden" value={dispute?.summary ?? "Dispute summary placeholder"} />
      <input name="internalNotes" type="hidden" value={dispute?.internalNotesPlaceholder ?? "Private note placeholder"} />
      <input name="evidencePlaceholder" type="hidden" value={dispute?.evidencePlaceholder ?? "Evidence placeholder"} />
    </>
  );
}

function DisputeActions({ dispute }: { dispute: ResellerDisputeRecord | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={addDisputeNotePlaceholder}>
        <DisputeHiddenFields dispute={dispute} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Add note
        </button>
      </form>
      <form action={uploadDisputeEvidencePlaceholder}>
        <DisputeHiddenFields dispute={dispute} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Evidence
        </button>
      </form>
      <form action={requestDisputeReviewPlaceholder}>
        <DisputeHiddenFields dispute={dispute} />
        <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
          Request review
        </button>
      </form>
      <form action={escalateDisputePlaceholder}>
        <DisputeHiddenFields dispute={dispute} />
        <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
          Escalate
        </button>
      </form>
      <form action={closeDisputePlaceholder}>
        <DisputeHiddenFields dispute={dispute} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Close
        </button>
      </form>
    </div>
  );
}

export default async function ResellerDisputesPage({ searchParams }: DisputesPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerDisputesData()]);
  const selected = data.selectedDispute;

  return (
    <>
      <PageHeader
        description="Private dispute workflow for deliveries, ownership transfers, reviews, buyer requests, communication, and future marketplace issues."
        title="Disputes Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Dispute placeholder audit event recorded.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Open</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.open}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Under review</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.underReview}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Awaiting response</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.awaitingResponse}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Escalated</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.escalated}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Closed</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.closed}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Dispute categories</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.categories.map((category) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={category.value}>
              {category.label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Status workflow</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statusFoundation.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create dispute placeholder</p>
        <form action={createDisputePlaceholder} className="mt-5 grid gap-4 lg:grid-cols-3">
          <input name="returnTo" type="hidden" value="/reseller/dashboard/disputes" />
          <label className="grid gap-2 text-sm font-bold text-ink">
            Category
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" name="category">
              {data.categories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Priority
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" name="priority">
              {data.priorityOptions.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Related transfer
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" name="relatedTransfer">
              <option value="transfer-placeholder">No transfer selected</option>
              {data.relatedOptions.transfers.map((transfer) => (
                <option key={transfer.transferId} value={transfer.transferId}>{transfer.storeName}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink lg:col-span-2">
            Summary
            <input className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700" name="summary" placeholder="Describe the disagreement without buyer private data" />
          </label>
          <button className="h-12 self-end rounded-full bg-ink px-5 text-sm font-black text-white" type="submit">
            Create dispute
          </button>
        </form>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Dispute records</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.disputes.length ? (
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Dispute ID</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Related</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.disputes.map((dispute) => (
                    <tr key={dispute.disputeId}>
                      <td className="px-4 py-4 font-black text-ink">{dispute.disputeId}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{dispute.category}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{dispute.priority}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(dispute.status)}`}>
                          {dispute.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">
                        {dispute.relatedTransfer} / {dispute.relatedDelivery}
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{dispute.updatedAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4">
                        <Link className="text-sm font-black text-blue-700" href={`/reseller/dashboard/disputes/${dispute.disputeId}`}>
                          Open
                        </Link>
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

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Dispute detail preview</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.summary ?? "No dispute selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Buyer: {selected?.buyerMaskedPlaceholder ?? "Buyer masked placeholder"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Evidence: {selected?.evidencePlaceholder ?? "Evidence placeholder"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Notes: {selected?.internalNotesPlaceholder ?? "Private note placeholder"}
            </p>
          </div>
          <div className="mt-5">
            <DisputeActions dispute={selected} />
          </div>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Timeline</p>
        <div className="mt-5 grid gap-3">
          {(selected?.timeline.length ? selected.timeline : []).map((event, index) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${event.action}-${index}`}>
              <p className="text-sm font-black text-ink">{event.action}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{event.status} · {event.createdAt ?? "Not tracked"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{event.note}</p>
            </div>
          ))}
          {!selected?.timeline.length ? (
            <p className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">
              No dispute timeline yet. Create a dispute placeholder to start tracking status history.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
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
