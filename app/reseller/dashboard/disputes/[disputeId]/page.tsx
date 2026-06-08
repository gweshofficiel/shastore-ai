import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  addDisputeNotePlaceholder,
  closeDisputePlaceholder,
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

type DisputeDetailPageProps = {
  params: Promise<{ disputeId: string }>;
  searchParams: Promise<{ saved?: string }>;
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

function DisputeHiddenFields({ dispute }: { dispute: ResellerDisputeRecord }) {
  return (
    <>
      <input name="returnTo" type="hidden" value={`/reseller/dashboard/disputes/${dispute.disputeId}`} />
      <input name="disputeId" type="hidden" value={dispute.disputeId} />
      <input name="category" type="hidden" value={dispute.category} />
      <input name="priority" type="hidden" value={dispute.priority} />
      <input name="relatedTransfer" type="hidden" value={dispute.relatedTransfer} />
      <input name="relatedDelivery" type="hidden" value={dispute.relatedDelivery} />
      <input name="relatedRequest" type="hidden" value={dispute.relatedRequest} />
      <input name="relatedReview" type="hidden" value={dispute.relatedReview} />
      <input name="disputeStatus" type="hidden" value={dispute.status} />
      <input name="summary" type="hidden" value={dispute.summary} />
      <input name="internalNotes" type="hidden" value={dispute.internalNotesPlaceholder} />
      <input name="evidencePlaceholder" type="hidden" value={dispute.evidencePlaceholder} />
    </>
  );
}

function DisputeActions({ dispute }: { dispute: ResellerDisputeRecord }) {
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

export default async function ResellerDisputeDetailPage({
  params,
  searchParams
}: DisputeDetailPageProps) {
  const [{ disputeId }, query] = await Promise.all([params, searchParams]);
  const data = await getResellerDisputesData(disputeId);
  const dispute = data.selectedDispute;

  if (!dispute) {
    return (
      <>
        <PageHeader
          description="This dispute is not available for the current reseller account."
          title="Dispute Not Found"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-sm font-semibold leading-7 text-muted">
            Disputes are private workflow records and are never public. Return to the dispute dashboard to create or view available placeholder disputes.
          </p>
          <Link className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-black text-white" href="/reseller/dashboard/disputes">
            Back to disputes
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        description="Private dispute detail, related records, status history, timeline, notes, and evidence placeholders."
        title={`Dispute ${dispute.disputeId}`}
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Dispute placeholder audit event recorded.</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-5">
        <Link className="text-sm font-black text-blue-700" href="/reseller/dashboard/disputes">
          Back to disputes
        </Link>
        <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(dispute.status)}`}>
          {dispute.status}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Dispute summary</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{dispute.summary}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            {dispute.category} · {dispute.priority} priority
          </p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Buyer privacy</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{dispute.buyerMaskedPlaceholder}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            Buyer data remains masked or placeholder-only and never appears publicly.
          </p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Safe actions</p>
          <div className="mt-5">
            <DisputeActions dispute={dispute} />
          </div>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Related records</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            Transfer: {dispute.relatedTransfer}
          </p>
          <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            Delivery: {dispute.relatedDelivery}
          </p>
          <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            Request: {dispute.relatedRequest}
          </p>
          <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            Review: {dispute.relatedReview}
          </p>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Internal notes placeholder</p>
          <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-7 text-muted">
            {dispute.internalNotesPlaceholder}
          </p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Evidence placeholder</p>
          <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-7 text-muted">
            {dispute.evidencePlaceholder}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Timeline</p>
          <div className="mt-5 grid gap-3">
            {dispute.timeline.map((event, index) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${event.action}-${index}`}>
                <p className="text-sm font-black text-ink">{event.action}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{event.status} · {event.createdAt ?? "Not tracked"}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">{event.note}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Status history</p>
          <div className="mt-5 grid gap-3">
            {dispute.statusHistory.map((event, index) => (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted" key={`${event.status}-${index}`}>
                {event.status} · {event.createdAt ?? "Not tracked"}
              </p>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
          ))}
        </div>
      </Card>
    </>
  );
}
