import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  approveTransferPlaceholder,
  cancelTransferPlaceholder,
  markTransferReadyPlaceholder,
  viewTransferTimelinePlaceholder
} from "@/lib/reseller-showcase/transfer-actions";
import {
  getResellerOwnershipTransferData,
  type ResellerOwnershipTransferRequest,
  type ResellerTransferStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type TransferDetailPageProps = {
  params: Promise<{ transferId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerTransferStatus) {
  if (status === "approved" || status === "ready_for_transfer") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "completed_placeholder") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "disputed") {
    return "bg-red-100 text-red-700";
  }

  if (status === "pending_buyer" || status === "pending_review") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-violet-100 text-violet-700";
}

function TransferHiddenFields({ transfer }: { transfer: ResellerOwnershipTransferRequest }) {
  return (
    <>
      <input name="returnTo" type="hidden" value={`/reseller/dashboard/transfers/${transfer.transferId}`} />
      <input name="transferId" type="hidden" value={transfer.transferId} />
      <input name="storeId" type="hidden" value={transfer.storeId} />
      <input name="storeName" type="hidden" value={transfer.storeName} />
      <input name="storeDescription" type="hidden" value={transfer.storeDescription ?? "Store description placeholder"} />
      <input name="buyerPlaceholder" type="hidden" value={transfer.buyerPlaceholder} />
      <input name="notesPlaceholder" type="hidden" value={transfer.notesPlaceholder} />
      <input name="transferStatus" type="hidden" value={transfer.transferStatus} />
    </>
  );
}

function TransferActions({ transfer }: { transfer: ResellerOwnershipTransferRequest }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={viewTransferTimelinePlaceholder}>
        <TransferHiddenFields transfer={transfer} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View timeline
        </button>
      </form>
      <form action={markTransferReadyPlaceholder}>
        <TransferHiddenFields transfer={transfer} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Mark ready
        </button>
      </form>
      <form action={approveTransferPlaceholder}>
        <TransferHiddenFields transfer={transfer} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Approve
        </button>
      </form>
      <form action={cancelTransferPlaceholder}>
        <TransferHiddenFields transfer={transfer} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Cancel
        </button>
      </form>
    </div>
  );
}

export default async function ResellerTransferDetailPage({
  params,
  searchParams
}: TransferDetailPageProps) {
  const [{ transferId }, query] = await Promise.all([params, searchParams]);
  const data = await getResellerOwnershipTransferData(transferId);
  const transfer = data.selectedTransfer;

  if (!transfer) {
    return (
      <>
        <PageHeader
          description="This transfer request is not available for the current reseller account."
          title="Transfer Not Found"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-sm font-semibold leading-7 text-muted">
            Transfer records are private internal workflow items and are never public. Return to the transfer dashboard to create or view available placeholder requests.
          </p>
          <Link className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-black text-white" href="/reseller/dashboard/transfers">
            Back to transfers
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        description="Private transfer detail and audit timeline. This page does not change ownership, workspace, account access, or RLS."
        title={`Transfer ${transfer.transferId}`}
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Transfer placeholder audit event recorded.</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-5">
        <Link className="text-sm font-black text-blue-700" href="/reseller/dashboard/transfers">
          Back to transfers
        </Link>
        <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(transfer.transferStatus)}`}>
          {transfer.transferStatus}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Store information</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{transfer.storeName}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">Store ID: {transfer.storeId}</p>
          <p className="mt-2 text-sm font-semibold leading-7 text-muted">
            {transfer.storeDescription ?? "No store description placeholder."}
          </p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reseller information</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{transfer.resellerId}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            Reseller remains the current owner in this foundation. No existing store owner IDs are changed.
          </p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Buyer placeholder</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{transfer.buyerPlaceholder}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            Buyer claim, verification, and account assignment are future hooks only. Buyer private data is never public.
          </p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Safe actions</p>
        <div className="mt-5">
          <TransferActions transfer={transfer} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Ownership timeline</p>
          <div className="mt-5 grid gap-3">
            {transfer.ownershipTimeline.map((item) => (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted" key={item}>
                {item}
              </p>
            ))}
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Notes placeholder</p>
          <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-7 text-muted">
            {transfer.notesPlaceholder}
          </p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Audit timeline</p>
        <div className="mt-5 grid gap-3">
          {transfer.auditTimeline.map((event, index) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${event.action}-${index}`}>
              <p className="text-sm font-black text-ink">{event.action}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{event.status} · {event.createdAt ?? "Not tracked"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{event.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Ownership safety</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
          ))}
        </div>
      </Card>
    </>
  );
}
