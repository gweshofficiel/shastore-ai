export type DomainPaymentPreparationStatus =
  | "covered_by_plan_credit"
  | "extra_payment_required"
  | "awaiting_payment"
  | "ready_for_future_registration"
  | "blocked_until_platform_balance_check";

export type DomainPaymentPreparation = {
  amountDueNowCents: number;
  nextStep: DomainPaymentPreparationStatus;
  paymentRequired: boolean;
  primaryStatus: DomainPaymentPreparationStatus;
  statuses: DomainPaymentPreparationStatus[];
};

export function buildDomainPaymentPreparation(customerDueCents: number): DomainPaymentPreparation {
  const amountDueNowCents = Math.max(0, customerDueCents);

  if (amountDueNowCents === 0) {
    return {
      amountDueNowCents,
      nextStep: "ready_for_future_registration",
      paymentRequired: false,
      primaryStatus: "covered_by_plan_credit",
      statuses: [
        "covered_by_plan_credit",
        "ready_for_future_registration",
        "blocked_until_platform_balance_check"
      ]
    };
  }

  return {
    amountDueNowCents,
    nextStep: "awaiting_payment",
    paymentRequired: true,
    primaryStatus: "extra_payment_required",
    statuses: [
      "extra_payment_required",
      "awaiting_payment",
      "blocked_until_platform_balance_check"
    ]
  };
}
