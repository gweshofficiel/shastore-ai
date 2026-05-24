export type ExpiryLockdownStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "past_due"
  | "trialing"
  | "unpaid";

export type ExpiryLockdownLabel =
  | "active"
  | "cancel_at_period_end"
  | "expired"
  | "past_due"
  | "restricted"
  | "unpaid";

export type ExpiryLockdownInput = {
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: string | null;
  planId?: string | null;
  status?: ExpiryLockdownStatus | null;
};

export type ExpiryLockdownState = {
  currentPeriodEnd: string | null;
  label: ExpiryLockdownLabel;
  locked: boolean;
  paidAccessLocked: boolean;
  paymentRestricted: boolean;
  periodEnded: boolean;
  reason: string | null;
  storefrontLocked: boolean;
};

function hasPeriodEnded(currentPeriodEnd?: string | null) {
  if (!currentPeriodEnd) {
    return false;
  }

  const time = new Date(currentPeriodEnd).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

export function getExpiryLockdownState(input: ExpiryLockdownInput): ExpiryLockdownState {
  const status = input.status ?? "active";
  const currentPeriodEnd = input.currentPeriodEnd ?? null;
  const periodEnded = hasPeriodEnded(currentPeriodEnd);
  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);
  const label: ExpiryLockdownLabel =
    status === "past_due"
      ? "past_due"
      : status === "unpaid"
        ? "unpaid"
        : status === "incomplete"
          ? "restricted"
          : status === "canceled" || (cancelAtPeriodEnd && periodEnded)
            ? "expired"
            : cancelAtPeriodEnd
              ? "cancel_at_period_end"
              : "active";
  const paymentRestricted =
    label === "past_due" || label === "unpaid" || label === "restricted";
  const paidAccessLocked = paymentRestricted || label === "expired";

  return {
    currentPeriodEnd,
    label,
    locked: paidAccessLocked,
    paidAccessLocked,
    paymentRestricted,
    periodEnded,
    reason: paidAccessLocked
      ? label === "expired"
        ? "Your subscription has expired. Reactivate billing to unlock paid features."
        : "Your subscription payment needs attention. Update billing to unlock paid features."
      : null,
    storefrontLocked: paidAccessLocked
  };
}

export function isPaidAccessLocked(input: ExpiryLockdownInput) {
  return getExpiryLockdownState(input).paidAccessLocked;
}

export function assertPaidAccessNotLocked(input: ExpiryLockdownInput) {
  const state = getExpiryLockdownState(input);

  console.info("[billing-expiry] paid access checked", {
    label: state.label,
    locked: state.paidAccessLocked,
    periodEnded: state.periodEnded,
    planId: input.planId ?? null,
    status: input.status ?? null
  });

  if (state.paidAccessLocked) {
    throw new Error(state.reason ?? "Billing needs attention before this action can continue.");
  }

  return state;
}
