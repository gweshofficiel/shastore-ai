"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type FulfillmentAction = (formData: FormData) => void | Promise<void>;
type OrderSource = "orders" | "store_orders";

type OrderFulfillmentActionsProps = {
  action: FulfillmentAction;
  currentStatus: string;
  deliveryMethod?: string | null;
  fulfillmentNotes?: string | null;
  orderId: string;
  orderStatus: string;
  returnTo?: string;
  source: OrderSource;
};

type FulfillmentStatus =
  | "pending"
  | "processing"
  | "preparing"
  | "ready_for_pickup"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  out_for_delivery: "Out for Delivery",
  pending: "Pending",
  preparing: "Preparing",
  processing: "Processing",
  ready_for_pickup: "Ready for Pickup",
  refunded: "Refunded",
  returned: "Returned",
  shipped: "Shipped"
};

const nextActions: Partial<Record<FulfillmentStatus, { label: string; value: FulfillmentStatus }>> = {
  out_for_delivery: { label: "Mark Delivered", value: "delivered" },
  pending: { label: "Start Processing", value: "processing" },
  preparing: { label: "Ready For Pickup", value: "ready_for_pickup" },
  processing: { label: "Mark Preparing", value: "preparing" },
  ready_for_pickup: { label: "Mark Shipped", value: "shipped" },
  shipped: { label: "Out For Delivery", value: "out_for_delivery" }
};

function normalizeFulfillmentStatus(status: string | null | undefined): FulfillmentStatus {
  const normalized = status?.trim() || "pending";

  if (normalized === "unfulfilled") {
    return "pending";
  }

  if (normalized === "fulfilled") {
    return "delivered";
  }

  return normalized in fulfillmentLabels ? (normalized as FulfillmentStatus) : "pending";
}

function fulfillmentStatusLabel(status: FulfillmentStatus) {
  return fulfillmentLabels[status];
}

function getFulfillmentActions(status: FulfillmentStatus) {
  const actions: Array<{ label: string; value: FulfillmentStatus; variant?: "danger" }> = [];
  const nextAction = nextActions[status];

  if (nextAction) {
    actions.push(nextAction);
  }

  if (status !== "cancelled" && status !== "delivered" && status !== "returned" && status !== "refunded") {
    actions.push({ label: "Cancel", value: "cancelled", variant: "danger" });
  }

  if (status === "delivered") {
    actions.push({ label: "Mark Returned", value: "returned" });
    actions.push({ label: "Mark Refunded", value: "refunded" });
  }

  if (status === "cancelled" || status === "returned") {
    actions.push({ label: "Mark Refunded", value: "refunded" });
  }

  return actions;
}

function isStatusAllowed({
  orderStatus,
  status
}: {
  orderStatus: string;
  status: FulfillmentStatus;
}) {
  if (
    (orderStatus === "cancelled" || orderStatus === "canceled") &&
    status !== "cancelled" &&
    status !== "returned" &&
    status !== "refunded"
  ) {
    return false;
  }

  return true;
}

function FulfillmentButton({
  currentStatus,
  label,
  orderStatus,
  variant,
  value
}: {
  currentStatus: FulfillmentStatus;
  label: string;
  orderStatus: string;
  variant?: "danger";
  value: FulfillmentStatus;
}) {
  const { pending } = useFormStatus();
  const disabled =
    pending ||
    currentStatus === value ||
    !isStatusAllowed({ orderStatus, status: value });
  const className =
    variant === "danger"
      ? "h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      : "h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      className={className}
      disabled={disabled}
      name="fulfillmentStatus"
      type="submit"
      value={value}
    >
      {pending ? "Updating..." : label}
    </button>
  );
}

export function OrderFulfillmentActions({
  action,
  currentStatus,
  fulfillmentNotes,
  orderId,
  orderStatus,
  returnTo,
  source
}: OrderFulfillmentActionsProps) {
  const normalizedStatus = normalizeFulfillmentStatus(currentStatus);
  const [optimisticStatus, setOptimisticStatus] = useState<FulfillmentStatus | null>(null);
  const displayedStatus = optimisticStatus ?? normalizedStatus;
  const actions = getFulfillmentActions(displayedStatus);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const nextStatus = submitter?.value;

        if (nextStatus) {
          setOptimisticStatus(normalizeFulfillmentStatus(nextStatus));
        }
      }}
    >
      <input name="orderId" type="hidden" value={orderId} />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <input name="source" type="hidden" value={source} />
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        Fulfillment actions
      </p>
      <p className="text-sm font-bold text-muted">
        Current fulfillment: {fulfillmentStatusLabel(displayedStatus)}
      </p>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Fulfillment notes optional</span>
        <textarea
          className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          defaultValue={fulfillmentNotes ?? ""}
          name="fulfillmentNotes"
          placeholder="Private packing, pickup, or delivery notes"
        />
      </label>
      {optimisticStatus ? (
        <p className="text-xs font-bold text-blue-700">
          Updating fulfillment to {fulfillmentStatusLabel(displayedStatus)}...
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <FulfillmentButton
            currentStatus={normalizedStatus}
            key={status.value}
            label={status.label}
            orderStatus={orderStatus}
            variant={status.variant}
            value={status.value}
          />
        ))}
      </div>
      <p className="text-xs font-semibold leading-5 text-muted">
        Move fulfillment forward one step at a time. Use cancel, return, or refund only for exceptions.
      </p>
    </form>
  );
}
