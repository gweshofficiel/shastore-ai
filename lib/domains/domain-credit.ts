import type { BillingPlan, SubscriptionPlanId } from "@/lib/billing/plans";
import type { DomainPricingQuote } from "@/lib/domains/domain-pricing";

export type DomainCreditQuote = {
  creditUsedCents: number;
  customerDueCents: number;
  includedCreditCents: number;
  planId: SubscriptionPlanId;
  planName: string;
  planPrice: string;
};

export const includedDomainCreditByPlan: Record<SubscriptionPlanId, number> = {
  agency: 5000,
  free: 0,
  pro: 2500,
  starter: 1200
};

export function includedDomainCreditForPlan(plan: BillingPlan) {
  return includedDomainCreditByPlan[plan.id] ?? 0;
}

export function calculateDomainCreditQuote({
  plan,
  pricing
}: {
  plan: BillingPlan;
  pricing: DomainPricingQuote;
}): DomainCreditQuote {
  const includedCreditCents = includedDomainCreditForPlan(plan);
  const creditUsedCents = Math.min(pricing.subtotalCents, includedCreditCents);

  return {
    creditUsedCents,
    customerDueCents: Math.max(pricing.subtotalCents - creditUsedCents, 0),
    includedCreditCents,
    planId: plan.id,
    planName: plan.name,
    planPrice: plan.price
  };
}
