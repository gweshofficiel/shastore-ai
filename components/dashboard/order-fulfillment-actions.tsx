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

const statuses = [
  { label: "Unfulfilled", value: "unfulfilled" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready for pickup", value: "ready_for_pickup" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Fulfilled", value: "fulfilled" }
];

function isStatusAllowed({
  currentStatus,
  deliveryMethod,
  orderStatus,
  status
}: {
  currentStatus: string;
  deliveryMethod?: string | null;
  orderStatus: string;
  status: string;
}) {
  if (orderStatus === "cancelled" || orderStatus === "canceled" || currentStatus === "fulfilled") {
    return false;
  }

  if (orderStatus === "draft" && status === "fulfilled") {
    return false;
  }

  if (status === "ready_for_pickup") {
    return deliveryMethod === "pickup";
  }

  if (status === "out_for_delivery") {
    return deliveryMethod === "delivery";
  }

  return true;
}

function FulfillmentButton({
  currentStatus,
  deliveryMethod,
  label,
  orderStatus,
  value
}: {
  currentStatus: string;
  deliveryMethod?: string | null;
  label: string;
  orderStatus: string;
  value: string;
}) {
  const { pending } = useFormStatus();
  const disabled =
    pending ||
    currentStatus === value ||
    !isStatusAllowed({ currentStatus, deliveryMethod, orderStatus, status: value });

  return (
    <button
      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
  deliveryMethod,
  fulfillmentNotes,
  orderId,
  orderStatus,
  returnTo,
  source
}: OrderFulfillmentActionsProps) {
  const normalizedStatus =
    currentStatus && currentStatus !== "pending" ? currentStatus : "unfulfilled";
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const displayedStatus = optimisticStatus ?? normalizedStatus;

  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const nextStatus = submitter?.value;

        if (nextStatus) {
          setOptimisticStatus(nextStatus);
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
        Current fulfillment: {displayedStatus.replaceAll("_", " ")}
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
          Updating fulfillment to {displayedStatus.replaceAll("_", " ")}...
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <FulfillmentButton
            currentStatus={normalizedStatus}
            deliveryMethod={deliveryMethod}
            key={status.value}
            label={status.label}
            orderStatus={orderStatus}
            value={status.value}
          />
        ))}
      </div>
      <p className="text-xs font-semibold leading-5 text-muted">
        Cancelled and fulfilled orders are locked. Pickup orders can be marked ready for pickup.
        Delivery orders can be marked out for delivery.
      </p>
    </form>
  );
}
