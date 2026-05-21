import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  prepareStoreTransferRecord,
  updateStorePurchaseRequestStatus
} from "@/lib/store-purchase/actions";
import {
  getResellerStorePurchaseData,
  storePurchaseMigrationMessage
} from "@/lib/store-purchase/data";
import type {
  StorePurchaseOrder,
  StorePurchaseRequestStatus
} from "@/lib/store-purchase/types";

export const dynamic = "force-dynamic";

const statusLabels: Record<StorePurchaseRequestStatus, string> = {
  approved: "Approved",
  delivered: "Delivered",
  pending: "Pending",
  preparing: "Preparing",
  rejected: "Rejected"
};

function statusClass(status: StorePurchaseRequestStatus) {
  if (status === "approved" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  if (status === "preparing") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

function StatusAction({
  label,
  requestId,
  status
}: {
  label: string;
  requestId: string;
  status: StorePurchaseRequestStatus;
}) {
  return (
    <form action={updateStorePurchaseRequestStatus}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <input name="requestStatus" type="hidden" value={status} />
      <button
        className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-ink transition hover:border-slate-300 hover:bg-slate-50"
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}

function TransferPreparationAction({ requestId }: { requestId: string }) {
  return (
    <form action={prepareStoreTransferRecord}>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <button
        className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-xs font-black text-white transition hover:bg-slate-800"
        type="submit"
      >
        Prepare transfer
      </button>
    </form>
  );
}

function OrderCard({ order }: { order: StorePurchaseOrder }) {
  return (
    <Card className="grid gap-5 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {order.showcase_title ?? "Ready-made store"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
            {order.business_name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {order.showcase_price_label ?? "Pricing on request"} | Transfer code{" "}
            {order.transfer_code}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(
            order.request_status
          )}`}
        >
          {statusLabels[order.request_status]}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Buyer</p>
          <p className="mt-2 font-black text-ink">{order.buyer_name}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{order.buyer_email}</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {order.buyer_phone ?? "No phone"} | {order.buyer_whatsapp ?? "No WhatsApp"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Domain</p>
          <p className="mt-2 font-black text-ink">{order.requested_domain ?? "Not requested"}</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Requested {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Transfer Status
          </p>
          <p className="mt-2 font-black capitalize text-ink">
            {order.transfer_record?.transfer_status.replace(/_/g, " ") ?? "Not started"}
          </p>
          <p className="mt-1 text-sm font-semibold capitalize text-muted">
            Delivery: {order.transfer_record?.delivery_status.replace(/_/g, " ") ?? "Not sent"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Future Automation
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Account creation, ownership transfer, domain connection, PDF credentials, WhatsApp,
            email, and deployment are placeholders only.
          </p>
        </div>
      </div>

      {order.notes ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Notes</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{order.notes}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <StatusAction label="Approve" requestId={order.id} status="approved" />
        <StatusAction label="Reject" requestId={order.id} status="rejected" />
        <StatusAction label="Mark delivered" requestId={order.id} status="delivered" />
        <TransferPreparationAction requestId={order.id} />
      </div>
    </Card>
  );
}

export default async function PrivateResellerOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([searchParams, getResellerStorePurchaseData()]);
  const pendingOrders = data.orders.filter((order) => order.request_status === "pending");
  const preparingOrders = data.orders.filter((order) => order.request_status === "preparing");

  return (
    <>
      <PageHeader
        description="Review buyer requests for ready-made stores and prepare ownership transfer placeholders without touching checkout or payments."
        title="Reseller Orders"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{storePurchaseMigrationMessage()}</p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Store purchase order updated.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Purchase Requests
          </p>
          <p className="mt-3 text-3xl font-black text-ink">{data.orders.length}</p>
          <p className="mt-1 text-sm text-muted">Ready-made store inquiries</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-black text-ink">{pendingOrders.length}</p>
          <p className="mt-1 text-sm text-muted">Awaiting approval or rejection</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Transfer Prep
          </p>
          <p className="mt-3 text-3xl font-black text-ink">{preparingOrders.length}</p>
          <p className="mt-1 text-sm text-muted">Ownership handoff placeholders</p>
        </Card>
      </div>
      {data.orders.length ? (
        <div className="grid gap-5">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
            No reseller purchase requests yet
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Buyers will appear here after they click Buy this store on your public reseller
            showcase and submit the request form.
          </p>
        </Card>
      )}
    </>
  );
}
