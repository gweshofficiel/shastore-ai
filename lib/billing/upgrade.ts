import type { BillingLimitResource } from "@/lib/billing/access";
import type { BillingFeature } from "@/lib/billing/enforcement";
import {
  billingPlans,
  getBillingPlan,
  type SubscriptionPlanId
} from "@/lib/billing/plans";
import type { PaidSubscriptionPlanId } from "@/lib/billing/platform-checkout";

const paidPlanIds = ["starter", "pro", "agency"] as const satisfies readonly PaidSubscriptionPlanId[];

export type UpgradeIntent = {
  blockedFeature?: BillingFeature;
  blockedResource?: BillingLimitResource;
  currentPlanId: SubscriptionPlanId;
  needsUnlimited?: boolean;
};

export type RecommendedUpgrade = {
  planId: PaidSubscriptionPlanId | null;
  planName: string;
  reason: string;
};

function planIndex(planId: SubscriptionPlanId) {
  return billingPlans.findIndex((plan) => plan.id === planId);
}

function asPaidUpgrade(planId: SubscriptionPlanId) {
  return paidPlanIds.includes(planId as PaidSubscriptionPlanId)
    ? (planId as PaidSubscriptionPlanId)
    : null;
}

function nextPaidPlan(currentPlanId: SubscriptionPlanId) {
  const currentIndex = planIndex(currentPlanId);
  const nextPlan = billingPlans.find(
    (plan) => plan.priceCents > 0 && planIndex(plan.id) > currentIndex
  );

  return asPaidUpgrade(nextPlan?.id ?? "starter") ?? "starter";
}

function minimumPlanForFeature(feature: BillingFeature): PaidSubscriptionPlanId {
  const minimums: Record<BillingFeature, PaidSubscriptionPlanId> = {
    advanced_analytics: "pro",
    custom_branding: "pro",
    custom_domains: "starter",
    multi_store: "pro",
    premium_templates: "starter",
    seo: "pro"
  };

  return minimums[feature];
}

function minimumPlanForResource(resource: BillingLimitResource): PaidSubscriptionPlanId {
  const minimums: Record<BillingLimitResource, PaidSubscriptionPlanId> = {
    domains: "starter",
    landings: "starter",
    stores: "pro"
  };

  return minimums[resource];
}

function higherPlan(
  currentPlanId: SubscriptionPlanId,
  targetPlanId: PaidSubscriptionPlanId
): PaidSubscriptionPlanId {
  return planIndex(targetPlanId) > planIndex(currentPlanId)
    ? targetPlanId
    : nextPaidPlan(currentPlanId);
}

function reasonForUpgrade(intent: UpgradeIntent, planName: string) {
  if (intent.needsUnlimited || intent.currentPlanId === "pro") {
    return "Agency plan required for unlimited usage.";
  }

  if (intent.blockedFeature === "custom_domains" || intent.blockedResource === "domains") {
    return intent.currentPlanId === "free"
      ? "Custom domains require Starter."
      : "Custom domain limit reached on your current plan.";
  }

  if (intent.blockedFeature === "advanced_analytics") {
    return "Advanced analytics require Pro.";
  }

  if (intent.blockedFeature === "premium_templates") {
    return "Premium templates require a paid plan.";
  }

  if (intent.blockedResource === "stores") {
    return "Store limit reached on your current plan.";
  }

  if (intent.blockedResource === "landings") {
    return "Landing page limit reached on your current plan.";
  }

  return `Upgrade to ${planName} to unlock this action.`;
}

export function getRecommendedUpgrade(intent: UpgradeIntent): RecommendedUpgrade {
  const currentPlan = getBillingPlan(intent.currentPlanId);

  if (currentPlan.id === "agency") {
    return {
      planId: null,
      planName: currentPlan.name,
      reason: "Your Agency plan already includes the highest SHASTORE AI limits."
    };
  }

  const minimumPlanId = intent.needsUnlimited
    ? "agency"
    : intent.blockedFeature
      ? minimumPlanForFeature(intent.blockedFeature)
      : intent.blockedResource
        ? minimumPlanForResource(intent.blockedResource)
        : nextPaidPlan(currentPlan.id);
  const planId = higherPlan(currentPlan.id, minimumPlanId);
  const plan = getBillingPlan(planId);

  console.info("[billing-upgrade] recommended upgrade", {
    blockedFeature: intent.blockedFeature ?? null,
    blockedResource: intent.blockedResource ?? null,
    currentPlanId: currentPlan.id,
    needsUnlimited: intent.needsUnlimited ?? false,
    recommendedPlanId: planId
  });

  return {
    planId,
    planName: plan.name,
    reason: reasonForUpgrade(intent, plan.name)
  };
}

export function canCheckoutUpgrade(currentPlanId: SubscriptionPlanId, requestedPlanId: string) {
  const requestedPlan = getBillingPlan(requestedPlanId);
  const requestedPaidPlan = asPaidUpgrade(requestedPlan.id);

  if (!requestedPaidPlan) {
    return {
      allowed: false,
      code: "invalid_upgrade",
      message: "Choose a paid upgrade plan."
    };
  }

  if (requestedPlan.id === currentPlanId) {
    return {
      allowed: false,
      code: "current_plan",
      message: "You are already on this plan."
    };
  }

  if (planIndex(requestedPlan.id) < planIndex(currentPlanId)) {
    return {
      allowed: false,
      code: "downgrade_not_supported",
      message: "Use the Stripe customer portal to manage downgrades or cancellations."
    };
  }

  return {
    allowed: true,
    code: "upgrade_allowed",
    message: "Upgrade allowed.",
    planId: requestedPaidPlan
  };
}
