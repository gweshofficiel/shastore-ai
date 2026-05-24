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
  | "canceled"
  | "grace_period"
  | "past_due"
  | "restricted"
  | "unpaid";

export type ExpiryLockdownInput = {
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: string | null;
  gracePeriodUntil?: string | null;
  planId?: string | null;
  status?: ExpiryLockdownStatus | null;
};

export type ExpiryLockdownState = {
  currentPeriodEnd: string | null;
  gracePeriodRemainingDays: number | null;
  gracePeriodUntil: string | null;
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

function futureTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now() ? time : null;
}

function remainingDays(until?: string | null) {
  const time = futureTimestamp(until);

  if (!time) {
    return null;
  }

  return Math.max(1, Math.ceil((time - Date.now()) / 86_400_000));
}

export function getExpiryLockdownState(input: ExpiryLockdownInput): ExpiryLockdownState {
  const status = input.status ?? "active";
  const currentPeriodEnd = input.currentPeriodEnd ?? null;
  const gracePeriodUntil = input.gracePeriodUntil ?? null;
  const periodEnded = hasPeriodEnded(currentPeriodEnd);
  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);
  const hasGracePeriod = Boolean(futureTimestamp(gracePeriodUntil));
  const label: ExpiryLockdownLabel =
    (status === "past_due" || status === "unpaid") && hasGracePeriod
      ? "grace_period"
      : status === "past_due"
        ? "past_due"
        : status === "unpaid"
          ? "unpaid"
        : status === "incomplete"
          ? "restricted"
          : status === "canceled" || (cancelAtPeriodEnd && periodEnded)
            ? "canceled"
            : cancelAtPeriodEnd
              ? "cancel_at_period_end"
              : "active";
  const paymentRestricted =
    label === "grace_period" ||
    label === "past_due" ||
    label === "unpaid" ||
    label === "restricted";
  const paidAccessLocked = paymentRestricted || label === "canceled";
  const gracePeriodRemainingDays = remainingDays(gracePeriodUntil);

  return {
    currentPeriodEnd,
    gracePeriodRemainingDays,
    gracePeriodUntil,
    label,
    locked: paidAccessLocked,
    paidAccessLocked,
    paymentRestricted,
    periodEnded,
    reason: paidAccessLocked
      ? label === "grace_period"
        ? "Your subscription payment failed. Storefronts remain online during grace period, but protected actions are paused until billing is resolved."
        : label === "canceled"
          ? "Your subscription has ended. Reactivate billing to unlock paid features."
        : "Your subscription payment needs attention. Update billing to unlock paid features."
      : null,
    storefrontLocked: paidAccessLocked && label !== "grace_period"
  };
}

export function isPaidAccessLocked(input: ExpiryLockdownInput) {
  return getExpiryLockdownState(input).paidAccessLocked;
}

export function assertPaidAccessNotLocked(input: ExpiryLockdownInput) {
  const state = getExpiryLockdownState(input);

  console.info("[billing-expiry] paid access checked", {
    gracePeriodUntil: state.gracePeriodUntil,
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
