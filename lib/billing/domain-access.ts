import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserSubscriptionAccessForClient, type UserSubscriptionAccess } from "@/lib/billing/access";
import { getExpiryLockdownState, isPaidAccessLocked } from "@/lib/billing/expiry-lockdown";
import {
  getStoreAccessForUser,
  type StoreAccessResult
} from "@/lib/billing/store-access";

type DomainAccessInput = {
  storeAccess?: StoreAccessResult | null;
  subscription: UserSubscriptionAccess;
};

export function canUseCustomDomains(subscription: UserSubscriptionAccess) {
  return (
    subscription.plan.customDomains &&
    !isPaidAccessLocked({
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      gracePeriodUntil: subscription.gracePeriodUntil,
      planId: subscription.plan.id,
      status: subscription.status
    })
  );
}

export function getRemainingDomainQuota(subscription: UserSubscriptionAccess) {
  const limit = subscription.usage.domainLimit;

  if (limit === null) {
    return null;
  }

  return Math.max(0, limit - subscription.usage.domainsUsed);
}

export function isStoreLocked(storeAccess: StoreAccessResult | null | undefined) {
  return storeAccess?.state === "locked_by_plan" || storeAccess?.state === "suspended";
}

export function canConnectAnotherDomain(input: DomainAccessInput) {
  const remaining = getRemainingDomainQuota(input.subscription);
  const allowed =
    canUseCustomDomains(input.subscription) &&
    !isStoreLocked(input.storeAccess) &&
    (remaining === null || remaining > 0);

  console.info("[usage-check] domain quota checked", {
    allowed,
    domainLimit: input.subscription.usage.domainLimit,
    domainsUsed: input.subscription.usage.domainsUsed,
    planId: input.subscription.plan.id,
    remaining,
    status: input.subscription.status,
    storeAccessState: input.storeAccess?.state ?? null,
    userId: input.subscription.userId
  });

  return {
    allowed,
    remaining,
    reason: allowed
      ? null
      : isStoreLocked(input.storeAccess)
        ? "Store locked due to current subscription limits."
        : !canUseCustomDomains(input.subscription)
          ? getExpiryLockdownState(input.subscription).reason ??
            "Custom domains are not available on your current subscription."
          : "Your current plan has reached its custom domain limit."
  };
}

export async function assertCanConnectCustomDomain(
  supabase: SupabaseClient,
  userId: string,
  storeId: string
) {
  const subscription = await getUserSubscriptionAccessForClient(supabase, userId);
  const storeAccess = await getStoreAccessForUser(supabase, userId, { id: storeId });
  const domainAccess = canConnectAnotherDomain({ storeAccess, subscription });

  if (!domainAccess.allowed) {
    console.warn("[upgrade-required] custom domain blocked", {
      domainLimit: subscription.usage.domainLimit,
      domainsUsed: subscription.usage.domainsUsed,
      planId: subscription.plan.id,
      reason: domainAccess.reason,
      storeAccessState: storeAccess.state,
      storeId,
      userId
    });
    console.warn("[billing-domain-lock] custom domain mutation blocked", {
      domainLimit: subscription.usage.domainLimit,
      domainsUsed: subscription.usage.domainsUsed,
      planId: subscription.plan.id,
      reason: domainAccess.reason,
      storeAccessState: storeAccess.state,
      storeId,
      userId
    });
    throw new Error(domainAccess.reason ?? "Custom domain limit reached.");
  }

  console.info("[billing-domain] custom domain mutation allowed", {
    planId: subscription.plan.id,
    remaining: domainAccess.remaining,
    storeId,
    userId
  });

  return {
    domainAccess,
    storeAccess,
    subscription
  };
}

export async function assertCanUseExistingCustomDomain(
  supabase: SupabaseClient,
  userId: string,
  storeId: string
) {
  const subscription = await getUserSubscriptionAccessForClient(supabase, userId);
  const storeAccess = await getStoreAccessForUser(supabase, userId, { id: storeId });

  if (isStoreLocked(storeAccess) || !canUseCustomDomains(subscription)) {
    console.warn("[billing-domain-lock] existing custom domain update blocked", {
      planId: subscription.plan.id,
      status: subscription.status,
      storeAccessState: storeAccess.state,
      storeId,
      userId
    });
    throw new Error(
      isStoreLocked(storeAccess)
        ? "Store locked due to current subscription limits."
        : "Custom domains are not available on your current subscription."
    );
  }

  console.info("[billing-domain] existing custom domain update allowed", {
    planId: subscription.plan.id,
    storeId,
    userId
  });

  return {
    storeAccess,
    subscription
  };
}
