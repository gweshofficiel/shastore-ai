import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  cancelDeliveryPlaceholder,
  markDeliveryChecklistItemCompletePlaceholder,
  markDeliveryReadyForHandoffPlaceholder,
  prepareBuyerInstructionsPlaceholder,
  startDeliveryPreparationPlaceholder
} from "@/lib/reseller-showcase/delivery-actions";
import {
  getResellerStoreDeliveryData,
  type ResellerDeliveryChecklistItem,
  type ResellerDeliveryStatus,
  type ResellerOwnershipTransferRequest,
  type ResellerStoreDeliveryRecord
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type DeliveriesPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function statusClass(status: ResellerDeliveryStatus) {
  if (status === "ready_to_handoff") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "delivered_placeholder" || status === "buyer_invited") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "disputed") {
    return "bg-red-100 text-red-700";
  }

  if (status === "preparing" || status === "waiting_buyer_claim") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-violet-100 text-violet-700";
}

function DeliveryHiddenFields({
  checklistItem,
  delivery
}: {
  checklistItem?: ResellerDeliveryChecklistItem;
  delivery: ResellerStoreDeliveryRecord | null;
}) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/deliveries" />
      <input name="deliveryId" type="hidden" value={delivery?.deliveryId ?? "delivery-placeholder"} />
      <input name="transferId" type="hidden" value={delivery?.transferId ?? "transfer-placeholder"} />
      <input name="storeId" type="hidden" value={delivery?.storeId ?? "store-placeholder"} />
      <input name="storeName" type="hidden" value={delivery?.storeName ?? "Store placeholder"} />
      <input name="buyerPlaceholder" type="hidden" value={delivery?.buyerPlaceholder ?? "Buyer placeholder"} />
      <input name="deliveryStatus" type="hidden" value={delivery?.deliveryStatus ?? "not_started"} />
      {checklistItem ? <input name="checklistKey" type="hidden" value={checklistItem.key} /> : null}
    </>
  );
}

function TransferOptionHiddenFields({ transfer }: { transfer: ResellerOwnershipTransferRequest }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/deliveries" />
      <input name="transferId" type="hidden" value={transfer.transferId} />
      <input name="storeId" type="hidden" value={transfer.storeId} />
      <input name="storeName" type="hidden" value={transfer.storeName} />
      <input name="buyerPlaceholder" type="hidden" value={transfer.buyerPlaceholder} />
      <input name="deliveryStatus" type="hidden" value="not_started" />
    </>
  );
}

function DeliveryActions({ delivery }: { delivery: ResellerStoreDeliveryRecord | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={prepareBuyerInstructionsPlaceholder}>
        <DeliveryHiddenFields delivery={delivery} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Prepare instructions
        </button>
      </form>
      <form action={markDeliveryReadyForHandoffPlaceholder}>
        <DeliveryHiddenFields delivery={delivery} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Ready handoff
        </button>
      </form>
      <form action={cancelDeliveryPlaceholder}>
        <DeliveryHiddenFields delivery={delivery} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Cancel
        </button>
      </form>
    </div>
  );
}

export default async function ResellerDeliveriesPage({ searchParams }: DeliveriesPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerStoreDeliveryData()]);
  const selected = data.selectedDelivery;

  return (
    <>
      <PageHeader
        description="Private digital store handoff workflow for tracking delivery steps before a future buyer claim. No ownership transfer occurs here."
        title="Store Delivery Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Delivery placeholder audit event recorded.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.activeDeliveries}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Buyer claim</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.pendingBuyerClaims}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Ready</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.readyToHandoff}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Delivered placeholder</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.deliveredPlaceholders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Disputed</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.disputedDeliveries}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Cancelled</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.cancelledDeliveries}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Delivery statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statusFoundation.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Start preparation from transfer</p>
        <div className="mt-5 grid gap-3">
          {data.transferOptions.length ? (
            data.transferOptions.slice(0, 5).map((transfer) => (
              <form action={startDeliveryPreparationPlaceholder} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4" key={transfer.transferId}>
                <TransferOptionHiddenFields transfer={transfer} />
                <div>
                  <p className="text-sm font-black text-ink">{transfer.storeName}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    {transfer.transferId} · {transfer.transferStatus}
                  </p>
                </div>
                <button className="h-10 rounded-full bg-ink px-4 text-sm font-black text-white" type="submit">
                  Start preparation
                </button>
              </form>
            ))
          ) : (
            <p className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">
              No transfer requests available yet. Prepare an ownership transfer placeholder before starting delivery.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Delivery records</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.deliveries.length ? (
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Delivery ID</th>
                    <th className="px-4 py-3">Transfer</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.deliveries.map((delivery) => (
                    <tr key={delivery.deliveryId}>
                      <td className="px-4 py-4 font-black text-ink">{delivery.deliveryId}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{delivery.transferId}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{delivery.storeName}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{delivery.buyerPlaceholder}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(delivery.deliveryStatus)}`}>
                          {delivery.deliveryStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{delivery.createdAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{delivery.updatedAt ?? "Not tracked"}</td>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Delivery detail</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.storeName ?? "No delivery selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Transfer ID: {selected?.transferId ?? "No transfer selected"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Reseller ID: {selected?.resellerId ?? "No reseller selected"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Buyer placeholder: {selected?.buyerPlaceholder ?? "No buyer placeholder yet."}
            </p>
          </div>
          <div className="mt-5">
            <DeliveryActions delivery={selected} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Delivery checklist</p>
          <div className="mt-5 grid gap-3">
            {(selected?.checklist ?? []).map((item) => (
              <form action={markDeliveryChecklistItemCompletePlaceholder} className="rounded-3xl border border-slate-200 bg-white p-4" key={item.key}>
                <DeliveryHiddenFields checklistItem={item} delivery={selected} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-ink">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted">{item.description}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      {item.completed ? "Complete" : "Open"}
                    </p>
                  </div>
                  <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Mark complete
                  </button>
                </div>
              </form>
            ))}
            {!selected?.checklist.length ? (
              <p className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">
                No checklist yet. Start delivery preparation to create the handoff checklist.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Delivery timeline</p>
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
                No delivery timeline yet. Future events include delivery created, checklist started, buyer invited placeholder, handoff ready, and delivered placeholder.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Delivery safety protections</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future delivery hooks</p>
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
