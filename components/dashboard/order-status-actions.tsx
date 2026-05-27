"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type OrderStatusActionsProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentStatus: string;
  orderId: string;
  source: "orders" | "store_orders";
};

type StatusActionButtonProps = {
  disabled?: boolean;
  label: string;
  status: string;
  variant?: "primary" | "secondary" | "danger";
};

const buttonVariants = {
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  primary: "bg-ink text-white hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50"
};

function StatusActionButton({
  disabled,
  label,
  status,
  variant = "secondary"
}: StatusActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`h-10 rounded-full px-4 text-xs font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]}`}
      disabled={disabled || pending}
      name="status"
      type="submit"
      value={status}
    >
      {pending ? "Updating..." : label}
    </button>
  );
}

export function OrderStatusActions({
  action,
  currentStatus,
  orderId,
  source
}: OrderStatusActionsProps) {
  const normalizedStatus = currentStatus === "canceled" ? "cancelled" : currentStatus;
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const displayedStatus = optimisticStatus ?? normalizedStatus;
  const isCancelled = normalizedStatus === "cancelled";

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
      <input name="source" type="hidden" value={source} />
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        Status actions
      </p>
      {optimisticStatus ? (
        <p className="text-xs font-bold text-blue-700">
          Updating status to {displayedStatus}...
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <StatusActionButton
          disabled={isCancelled || normalizedStatus === "confirmed"}
          label="Confirm order"
          status="confirmed"
          variant="primary"
        />
        <StatusActionButton
          disabled={isCancelled || normalizedStatus === "pending"}
          label="Mark pending"
          status="pending"
        />
        <StatusActionButton
          disabled={isCancelled}
          label="Cancel order"
          status="cancelled"
          variant="danger"
        />
      </div>
    </form>
  );
}
