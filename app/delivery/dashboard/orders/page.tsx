import { requireDeliveryAccess } from "@/lib/delivery/access";
import { markCashCollectedAction } from "@/lib/delivery/cod-actions";
import { getDeliveryAssignedOrdersData, type DeliveryAssignmentStatus } from "@/lib/delivery/data";
import { submitProofOfDeliveryAction } from "@/lib/delivery/proof-actions";
import { reportFailedDeliveryAction } from "@/lib/delivery/return-actions";
import { updateDeliveryAssignmentStatusAction } from "@/lib/delivery/status-actions";

export const dynamic = "force-dynamic";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    accepted: "Accepted",
    assigned: "Assigned",
    delivered: "Delivered",
    picked_up: "Picked Up",
    returned: "Returned"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "returned") {
    return "bg-red-100 text-red-700";
  }

  if (status === "accepted" || status === "picked_up") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

function nextStatuses(status: DeliveryAssignmentStatus) {
  const transitions: Record<DeliveryAssignmentStatus, DeliveryAssignmentStatus[]> = {
    accepted: ["picked_up"],
    assigned: ["accepted"],
    delivered: [],
    picked_up: ["returned"],
    returned: []
  };

  return transitions[status];
}

function statusMessage(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  const messages: Record<string, { className: string; text: string }> = {
    "access-denied": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Delivery access could not be verified."
    },
    "cod-collected": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Cash collection marked collected."
    },
    "cod-delivered-required": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Cash can only be collected after proof delivery marks the order delivered."
    },
    "cod-failed": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Cash collection could not be saved. Please try again."
    },
    "cod-invalid": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Choose a valid assignment before collecting cash."
    },
    "cod-not-found": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That COD assignment does not belong to this delivery account."
    },
    failed: {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Delivery status could not be updated. Please try again."
    },
    invalid: {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Choose a valid delivery status."
    },
    "invalid-transition": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That status change is not allowed. Move one step at a time."
    },
    "not-found": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That assignment does not belong to this delivery account."
    },
    "proof-code-invalid": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "The delivery code does not match this assignment."
    },
    "proof-duplicate": {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      text: "Proof has already been submitted for this assignment."
    },
    "proof-failed": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Proof of delivery could not be submitted. Please try again."
    },
    "proof-invalid": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Proof submission is missing a valid assignment."
    },
    "proof-required": {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      text: "Delivered status requires proof submission."
    },
    "proof-status-required": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Proof can only be submitted after the order is picked up."
    },
    "proof-submitted": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Proof of delivery submitted and order marked delivered."
    },
    "return-failed": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Failed delivery report could not be saved. Please try again."
    },
    "return-invalid": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Choose a valid failed delivery reason."
    },
    "return-not-found": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "That return assignment does not belong to this delivery account."
    },
    "return-reported": {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Failed delivery / return report submitted."
    },
    "return-status-invalid": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "This order can no longer be reported as failed from delivery."
    },
    unavailable: {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      text: "Delivery status service is not configured."
    },
    updated: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Delivery status updated."
    }
  };

  return status ? messages[status] ?? null : null;
}

export default async function DeliveryAssignedOrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ delivery?: string | string[] }>;
}) {
  const query = await searchParams;
  const { agent } = await requireDeliveryAccess();
  const data = await getDeliveryAssignedOrdersData(agent);
  const message = statusMessage(query?.delivery);

  return (
    <div className="grid gap-6 lg:gap-8">
      <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
          Delivery orders
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          Assigned Orders
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Only orders assigned to {agent?.agentName ?? "this delivery agent"} for{" "}
          {agent?.storeName ?? "the linked store"} are shown here.
        </p>
      </section>

      {message ? (
        <section className={`rounded-3xl border p-4 text-sm font-bold ${message.className}`}>
          {message.text}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned Orders", value: data.assignedOrders },
          { label: "Accepted Orders", value: data.acceptedOrders },
          { label: "Picked Up Orders", value: data.pickedUpOrders },
          { label: "Delivered Orders", value: data.deliveredOrders },
          { label: "Failed Deliveries", value: data.failedDeliveries },
          { label: "Returns In Progress", value: data.returnsInProgress },
          { label: "Completed Returns", value: data.completedReturns },
          { label: "Reschedules", value: data.reschedules }
        ].map((card) => (
          <article
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]"
            key={card.label}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Collected Today", value: formatMoney(data.codCollectedToday) },
          { label: "Collected Total", value: formatMoney(data.codCollectedTotal) },
          { label: "Pending Settlement", value: formatMoney(data.codPendingSettlement) },
          { label: "Settled", value: formatMoney(data.codSettled) }
        ].map((card) => (
          <article
            className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/80 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]"
            key={card.label}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-black text-emerald-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Assignment list
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Store-scoped deliveries
            </h2>
          </div>
          <p className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            {agent?.cityZone ?? "Zone pending"}
          </p>
        </div>

        {data.orders.length ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid min-w-[980px] grid-cols-[1fr_1.1fr_1fr_0.9fr_0.9fr_0.9fr_1fr_1.4fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Order Number</span>
              <span>Customer</span>
              <span>Phone</span>
              <span>City</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Assigned Date</span>
              <span>Update Status</span>
            </div>
            <div className="grid overflow-x-auto">
              {data.orders.map((order) => (
                <article
                  className="min-w-[980px] border-t border-slate-100 px-4 py-4 text-sm font-semibold text-slate-600"
                  key={order.id}
                >
                  <div className="grid grid-cols-[1fr_1.1fr_1fr_0.9fr_0.9fr_0.9fr_1fr_1.4fr] gap-3">
                    <span className="font-black text-slate-950">{order.orderNumber}</span>
                    <span>{order.customer ?? "Customer"}</span>
                    <span>{order.phone ?? "Not provided"}</span>
                    <span>{order.city ?? "Not set"}</span>
                    <span>{formatMoney(order.amount, order.currency)}</span>
                    <span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </span>
                    <span>{formatDate(order.assignedAt)}</span>
                    <StatusUpdateForm assignmentId={order.id} status={order.status} />
                  </div>
                  <ProofSection order={order} />
                  <CodCollectionSection order={order} />
                  <FailedDeliverySection order={order} />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950">
              No assigned orders yet
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
              When a store owner assigns an order to this delivery agent, it will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function returnReasonLabel(reason: string | null) {
  const labels: Record<string, string> = {
    customer_refused: "Customer Refused",
    customer_unreachable: "Customer Unreachable",
    reschedule_requested: "Reschedule Requested",
    wrong_address: "Wrong Address"
  };

  return reason ? labels[reason] ?? reason.replaceAll("_", " ") : "Not reported";
}

function returnStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    customer_refused: "Customer Refused",
    customer_unreachable: "Customer Unreachable",
    reschedule_requested: "Reschedule Requested",
    return_completed: "Return Completed",
    return_in_progress: "Return In Progress",
    returned_to_store: "Returned To Store",
    wrong_address: "Wrong Address"
  };

  return status ? labels[status] ?? status.replaceAll("_", " ") : "Not started";
}

function FailedDeliverySection({
  order
}: {
  order: {
    id: string;
    returnNotes: string | null;
    returnReason: string | null;
    returnRequestedDate: string | null;
    returnStatus: string | null;
    status: DeliveryAssignmentStatus;
  };
}) {
  if (order.returnStatus) {
    return (
      <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-950">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
          Failed delivery / return
        </p>
        <p className="mt-2 font-black">{returnStatusLabel(order.returnStatus)}</p>
        <p className="mt-1">Reason: {returnReasonLabel(order.returnReason)}</p>
        {order.returnRequestedDate ? (
          <p className="mt-1">Requested delivery date: {formatDate(order.returnRequestedDate)}</p>
        ) : null}
        {order.returnNotes ? (
          <p className="mt-3 rounded-2xl bg-white p-3 leading-6">{order.returnNotes}</p>
        ) : null}
      </div>
    );
  }

  if (order.status === "delivered" || order.status === "returned") {
    return null;
  }

  return (
    <form
      action={reportFailedDeliveryAction}
      className="mt-4 grid gap-3 rounded-2xl border border-red-100 bg-red-50 p-4"
    >
      <input name="assignmentId" type="hidden" value={order.id} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
          Report failed delivery
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-red-950">
          Report a failed delivery, return action, or reschedule request for this assigned order.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">
          Reason
          <select
            className="h-11 rounded-2xl border border-red-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            name="reason"
            required
          >
            <option value="customer_refused">Customer Refused</option>
            <option value="customer_unreachable">Customer Unreachable</option>
            <option value="wrong_address">Wrong Address</option>
            <option value="reschedule_requested">Reschedule Requested</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">
          New delivery date placeholder
          <input
            className="h-11 rounded-2xl border border-red-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            name="requestedDeliveryDate"
            type="datetime-local"
          />
        </label>
      </div>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">
        Notes
        <textarea
          className="min-h-24 rounded-2xl border border-red-100 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
          name="notes"
          placeholder="Add safe notes for the store owner. Do not include sensitive customer data."
        />
      </label>
      <button
        className="h-11 rounded-2xl bg-red-700 px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
        type="submit"
      >
        Submit return action
      </button>
    </form>
  );
}

function codStatusLabel(status: string) {
  const labels: Record<string, string> = {
    collected: "Collected",
    disputed: "Disputed",
    not_started: "Pending Collection",
    pending_collection: "Pending Collection",
    settled_to_store: "Settled To Store"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function CodCollectionSection({
  order
}: {
  order: {
    codAmount: number;
    codCollectedAt: string | null;
    codCurrency: string;
    codNotes: string | null;
    codSettledAt: string | null;
    codStatus: string;
    id: string;
    proofSubmitted: boolean;
    status: DeliveryAssignmentStatus;
  };
}) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            Cash on delivery
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-950">
            COD Amount: {formatMoney(order.codAmount, order.codCurrency)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
            {codStatusLabel(order.codStatus)}
          </p>
        </div>
        {order.codCollectedAt ? (
          <p className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Collected {formatDate(order.codCollectedAt)}
          </p>
        ) : null}
      </div>
      {order.codNotes ? (
        <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-amber-950">
          {order.codNotes}
        </p>
      ) : null}
      {order.codSettledAt ? (
        <p className="mt-3 text-sm font-bold text-amber-950">
          Settled to store {formatDate(order.codSettledAt)}.
        </p>
      ) : null}
      {order.proofSubmitted && (order.codStatus === "not_started" || order.codStatus === "pending_collection") ? (
        <form action={markCashCollectedAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1.6fr_auto]">
          <input name="assignmentId" type="hidden" value={order.id} />
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
            Amount
            <input
              className="h-11 rounded-2xl border border-amber-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
              defaultValue={order.codAmount.toFixed(2)}
              name="amount"
              type="number"
              min="0"
              step="0.01"
            />
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
            Collection notes
            <input
              className="h-11 rounded-2xl border border-amber-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
              name="notes"
              placeholder="Cash received from customer"
            />
          </label>
          <button
            className="self-end rounded-2xl bg-amber-600 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
            type="submit"
          >
            Mark Cash Collected
          </button>
        </form>
      ) : !order.proofSubmitted ? (
        <p className="mt-3 text-sm font-bold text-amber-800">
          Submit proof of delivery before collecting COD cash.
        </p>
      ) : null}
    </div>
  );
}

function ProofSection({
  order
}: {
  order: {
    customer: string | null;
    deliveredAt: string | null;
    deliveryCodeRequired: boolean;
    id: string;
    proofNotes: string | null;
    proofSubmitted: boolean;
    status: DeliveryAssignmentStatus;
  };
}) {
  if (order.proofSubmitted) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">
        <p className="font-black">Proof submitted</p>
        <p className="mt-1">
          Delivered {order.deliveredAt ? formatDate(order.deliveredAt) : "with proof"}.
          {order.proofNotes ? ` Note: ${order.proofNotes}` : ""}
        </p>
      </div>
    );
  }

  if (order.status !== "picked_up") {
    return null;
  }

  return (
    <form
      action={submitProofOfDeliveryAction}
      className="mt-4 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
    >
      <input name="assignmentId" type="hidden" value={order.id} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
          Proof of delivery
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">
          Submit proof to mark this order delivered.{" "}
          {order.deliveryCodeRequired
            ? "Delivery code is required for this assignment."
            : "No delivery code exists yet, so a safe fallback will be recorded."}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
          Delivery code
          <input
            className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            name="deliveryCode"
            placeholder={order.deliveryCodeRequired ? "Enter delivery code" : "Optional placeholder"}
          />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
          Customer name
          <input
            className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            defaultValue={order.customer ?? ""}
            name="customerName"
            placeholder="Customer name"
          />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
          Signature placeholder
          <input
            className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            name="signatureTextPlaceholder"
            placeholder="Signature captured placeholder"
          />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
          Photo placeholder
          <input
            className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            name="photoUrlPlaceholder"
            placeholder="Photo URL placeholder"
          />
        </label>
      </div>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
        Notes
        <textarea
          className="min-h-24 rounded-2xl border border-emerald-100 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
          name="notes"
          placeholder="Safe delivery note visible to store owner and customer when appropriate."
        />
      </label>
      <button
        className="h-11 rounded-2xl bg-emerald-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
        type="submit"
      >
        Submit proof and mark delivered
      </button>
    </form>
  );
}

function StatusUpdateForm({
  assignmentId,
  status
}: {
  assignmentId: string;
  status: DeliveryAssignmentStatus;
}) {
  const options = nextStatuses(status);

  if (!options.length) {
    return (
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        Final status
      </span>
    );
  }

  return (
    <form action={updateDeliveryAssignmentStatusAction} className="flex gap-2">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <select
        className="h-10 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none"
        defaultValue={options[0]}
        name="status"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
      <button
        className="h-10 rounded-2xl bg-emerald-950 px-3 text-xs font-black uppercase tracking-[0.12em] text-white"
        type="submit"
      >
        Update
      </button>
    </form>
  );
}
