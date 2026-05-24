import type { BillingLimitResource, UserSubscriptionAccess } from "@/lib/billing/access";
import { isStoreLocked, getRemainingDomainQuota } from "@/lib/billing/domain-access";
import { getExpiryLockdownState } from "@/lib/billing/expiry-lockdown";
import { getBillingPlan } from "@/lib/billing/plans";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";

export type DerivedSubscriptionStateLabel =
  | "active"
  | "cancel_at_period_end"
  | "canceled"
  | "grace_period"
  | "past_due"
  | "restricted"
  | "downgraded_over_limit"
  | "unpaid";

export type OverLimitResourceState = {
  label: string;
  limit: number;
  resource: BillingLimitResource;
  used: number;
};

export type DerivedSubscriptionState = {
  cancellationDate: string | null;
  gracePeriodRemainingDays: number | null;
  gracePeriodUntil: string | null;
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
  const expiry = getExpiryLockdownState({
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd,
    gracePeriodUntil: access.gracePeriodUntil,
    planId: access.plan.id,
    status: access.status
  });
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
  let label: DerivedSubscriptionStateLabel = "active";

  if (expiry.label === "grace_period") {
    label = "grace_period";
  } else if (expiry.label === "canceled") {
    label = "canceled";
  } else if (expiry.label === "past_due") {
    label = "past_due";
  } else if (expiry.label === "unpaid") {
    label = "unpaid";
  } else if (expiry.label === "restricted") {
    label = "restricted";
  } else if (hasOverLimitUsage) {
    label = "downgraded_over_limit";
  } else if (expiry.label === "cancel_at_period_end") {
    label = "cancel_at_period_end";
  }

  let warning: string | null = null;

  if (hasOverLimitUsage) {
    warning = "Your current usage is above this plan's limits. Existing data stays safe, but new resources are blocked until usage is reduced or you upgrade again.";
  } else if (label === "past_due" || label === "unpaid") {
    warning = "Payment needs attention. Existing data stays safe, but paid actions are locked until billing is resolved.";
  } else if (label === "grace_period") {
    warning = `Payment failed. Storefronts remain online during grace period, but protected actions are paused${expiry.gracePeriodRemainingDays ? ` for ${expiry.gracePeriodRemainingDays} more day${expiry.gracePeriodRemainingDays === 1 ? "" : "s"}` : ""}.`;
  } else if (label === "cancel_at_period_end") {
    warning = "Your subscription is scheduled to cancel at period end. Access continues until the current period ends.";
  } else if (label === "canceled") {
    warning = "Your subscription period has ended. Reactivate billing to unlock paid features again.";
  } else if (label === "restricted") {
    warning = "Your subscription is restricted. Existing resources remain available, but new paid resources are blocked.";
  }

  console.info("[billing-state] derived subscription state", {
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    label,
    overLimitResources: overLimitResources.map((resource) => resource.resource),
    planId: access.plan.id,
    status: access.status,
    userId: access.userId
  });

  return {
    cancellationDate: access.cancelAtPeriodEnd || label === "canceled" ? access.currentPeriodEnd : null,
    gracePeriodRemainingDays: expiry.gracePeriodRemainingDays,
    gracePeriodUntil: expiry.gracePeriodUntil,
    label,
    overLimitResources,
    restricted:
      label === "past_due" ||
      label === "unpaid" ||
      label === "grace_period" ||
      label === "canceled" ||
      label === "restricted" ||
      label === "downgraded_over_limit",
    upgradePlanId: upgrade.planId,
    upgradePlanName: upgrade.planName,
    warning
  };
}

export { getRemainingDomainQuota, isStoreLocked };
