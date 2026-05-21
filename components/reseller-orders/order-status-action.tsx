"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  updateStorePurchaseRequestStatus,
  type StoreOrderStatusFormState
} from "@/lib/store-purchase/actions";
import type { StorePurchaseRequestStatus } from "@/lib/store-purchase/types";

const initialState: StoreOrderStatusFormState = {
  message: "",
  status: "idle"
};

function StatusSubmitButton({
  label,
  pendingLabel
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function OrderStatusAction({
  label,
  pendingLabel,
  requestId,
  status
}: {
  label: string;
  pendingLabel: string;
  requestId: string;
  status: StorePurchaseRequestStatus;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateStorePurchaseRequestStatus, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input name="returnTo" type="hidden" value="/reseller/dashboard/orders" />
      <input name="requestId" type="hidden" value={requestId} />
      <input name="requestStatus" type="hidden" value={status} />
      <StatusSubmitButton label={label} pendingLabel={pendingLabel} />
      {state.status === "error" ? (
        <p className="max-w-xs text-xs font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="max-w-xs text-xs font-semibold text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
