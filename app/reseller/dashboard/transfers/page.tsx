import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  approveTransferPlaceholder,
  cancelTransferPlaceholder,
  createTransferRequestPlaceholder,
  markTransferReadyPlaceholder,
  viewTransferTimelinePlaceholder
} from "@/lib/reseller-showcase/transfer-actions";
import {
  getResellerOwnershipTransferData,
  type ResellerOwnershipTransferRequest,
  type ResellerTransferStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type TransfersPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
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

function TransferHiddenFields({ transfer }: { transfer: ResellerOwnershipTransferRequest | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/transfers" />
      <input name="transferId" type="hidden" value={transfer?.transferId ?? "transfer-placeholder"} />
      <input name="storeId" type="hidden" value={transfer?.storeId ?? "store-placeholder"} />
      <input name="storeName" type="hidden" value={transfer?.storeName ?? "Store placeholder"} />
      <input name="storeDescription" type="hidden" value={transfer?.storeDescription ?? "Store description placeholder"} />
      <input name="buyerPlaceholder" type="hidden" value={transfer?.buyerPlaceholder ?? "Buyer placeholder"} />
      <input name="notesPlaceholder" type="hidden" value={transfer?.notesPlaceholder ?? "Internal transfer notes placeholder"} />
      <input name="transferStatus" type="hidden" value={transfer?.transferStatus ?? "draft"} />
    </>
  );
}

function TransferActions({ transfer }: { transfer: ResellerOwnershipTransferRequest | null }) {
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

export default async function ResellerTransfersPage({ searchParams }: TransfersPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerOwnershipTransferData()]);
  const selected = data.selectedTransfer;

  return (
    <>
      <PageHeader
        description="Private ownership-transfer architecture for preparing store delivery workflows without changing owner IDs, workspaces, accounts, or RLS."
        title="Ownership Transfers"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Transfer placeholder audit event recorded.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.activeTransfers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.pendingTransfers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Completed placeholder</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.completedPlaceholders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Disputed</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.disputedTransfers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Cancelled</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.cancelledTransfers}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Transfer lifecycle statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statusFoundation.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create transfer request placeholder</p>
        <form action={createTransferRequestPlaceholder} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <input name="returnTo" type="hidden" value="/reseller/dashboard/transfers" />
          <label className="grid gap-2 text-sm font-bold text-ink">
            Owned store
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" name="storeId" required>
              <option value="">Select a store</option>
              {data.storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Buyer placeholder
            <input className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700" name="buyerPlaceholder" placeholder="Buyer placeholder" />
          </label>
          <button className="h-12 self-end rounded-full bg-ink px-5 text-sm font-black text-white" type="submit">
            Create request
          </button>
        </form>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          This creates an internal transfer audit record only. It never changes store ownership, workspace membership, account access, or RLS.
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Transfer requests</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.transfers.length ? (
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Transfer ID</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.transfers.map((transfer) => (
                    <tr key={transfer.transferId}>
                      <td className="px-4 py-4 font-black text-ink">{transfer.transferId}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{transfer.storeName}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{transfer.buyerPlaceholder}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(transfer.transferStatus)}`}>
                          {transfer.transferStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{transfer.createdAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{transfer.updatedAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4">
                        <Link className="text-sm font-black text-blue-700" href={`/reseller/dashboard/transfers/${transfer.transferId}`}>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Transfer detail preview</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.storeName ?? "No transfer selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Reseller ID: {selected?.resellerId ?? "No reseller selected"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Buyer placeholder: {selected?.buyerPlaceholder ?? "No buyer placeholder yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Notes: {selected?.notesPlaceholder ?? "No notes placeholder yet."}
            </p>
          </div>
          <div className="mt-5">
            <TransferActions transfer={selected} />
          </div>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Audit timeline</p>
        <div className="mt-5 grid gap-3">
          {(selected?.auditTimeline.length ? selected.auditTimeline : []).map((event, index) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${event.action}-${index}`}>
              <p className="text-sm font-black text-ink">{event.action}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{event.status} · {event.createdAt ?? "Not tracked"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{event.note}</p>
            </div>
          ))}
          {!selected?.auditTimeline.length ? (
            <p className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">
              No audit events yet. Create a transfer request placeholder to start the timeline.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Ownership safety protections</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future transfer hooks</p>
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
