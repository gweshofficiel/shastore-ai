import type { BillingLimitResource, UserSubscriptionAccess } from "@/lib/billing/access";
import { getBillingPlan } from "@/lib/billing/plans";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";

export type DerivedSubscriptionStateLabel =
  | "active"
  | "cancel_at_period_end"
  | "downgraded_over_limit"
  | "past_due"
  | "restricted";

export type OverLimitResourceState = {
  label: string;
  limit: number;
  resource: BillingLimitResource;
  used: number;
};

export type DerivedSubscriptionState = {
  cancellationDate: string | null;
  label: DerivedSubscriptionStateLabel;
  overLimitResources: OverLimitResourceState[];
  restricted: boolean;
  upgradePlanId: ReturnType<typeof getRecommendedUpgrade>["planId"];
  upgradePlanName: string;
  warning: string | null;
};

const resourceLabels: Record<BillingLimitResource, string> = {
  domains: "Custom domains",
  landings: "Landing pages",
  stores: "Stores"
};

function overLimitResource(
  resource: BillingLimitResource,
  used: number,
  limit: number | null
) {
  if (limit === null || used <= limit) {
    return null;
  }

  return {
    label: resourceLabels[resource],
    limit,
    resource,
    used
  };
}

export function getSubscriptionState(access: UserSubscriptionAccess): DerivedSubscriptionState {
  const overLimitResources = [
    overLimitResource("stores", access.usage.storesUsed, access.usage.storeLimit),
    overLimitResource("landings", access.usage.landingsUsed, access.usage.landingLimit),
    overLimitResource("domains", access.usage.domainsUsed, access.usage.domainLimit)
  ].filter((resource): resource is OverLimitResourceState => Boolean(resource));
  const hasOverLimitUsage = overLimitResources.length > 0;
  const primaryOverLimitResource = overLimitResources[0]?.resource;
  const proPlan = getBillingPlan("pro");
  const needsUnlimited = overLimitResources.some((resource) => {
    const proLimit = {
      domains: proPlan.domainLimit,
      landings: proPlan.landingLimit,
      stores: proPlan.storeLimit
    }[resource.resource];

    return proLimit !== null && resource.used > proLimit;
  });
  const upgrade = getRecommendedUpgrade({
    blockedResource: primaryOverLimitResource,
    currentPlanId: access.plan.id,
    needsUnlimited
  });
  const label: DerivedSubscriptionStateLabel =
    access.status === "past_due"
      ? "past_due"
      : access.status === "canceled" || access.status === "incomplete"
        ? "restricted"
        : hasOverLimitUsage
          ? "downgraded_over_limit"
          : access.cancelAtPeriodEnd
            ? "cancel_at_period_end"
            : "active";
  const warning = hasOverLimitUsage
    ? "Your current usage is above this plan's limits. Existing data stays safe, but new resources are blocked until usage is reduced or you upgrade again."
    : label === "past_due"
      ? "Payment is past due. Existing resources stay online, but some paid actions may be restricted until billing is resolved."
      : label === "cancel_at_period_end"
        ? "Your subscription is scheduled to cancel at period end. Your data will remain safe."
        : label === "restricted"
          ? "Your subscription is restricted. Existing resources remain available, but new paid resources are blocked."
          : null;

  console.info("[billing-state] derived subscription state", {
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    label,
    overLimitResources: overLimitResources.map((resource) => resource.resource),
    planId: access.plan.id,
    status: access.status,
    userId: access.userId
  });

  return {
    cancellationDate: access.cancelAtPeriodEnd ? access.currentPeriodEnd : null,
    label,
    overLimitResources,
    restricted:
      label === "past_due" || label === "restricted" || label === "downgraded_over_limit",
    upgradePlanId: upgrade.planId,
    upgradePlanName: upgrade.planName,
    warning
  };
}
