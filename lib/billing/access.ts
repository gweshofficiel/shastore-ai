import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billingPlans,
  freeTemplateIds,
  getBillingPlan,
  premiumTemplateIds,
  type BillingPlan,
  type SubscriptionPlanId
} from "@/lib/billing/plans";
import { isPaidAccessLocked } from "@/lib/billing/expiry-lockdown";
import {
  canUseFeature,
  getCurrentUsage,
  getPlanLimits,
  type PlanLimitResource
} from "@/lib/billing/plan-limits";

export type UserSubscriptionAccess = {
  userId: string;
  plan: BillingPlan;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
  currentPeriodEnd: string | null;
  gracePeriodUntil: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    aiGenerationsLimit: number | null;
    aiGenerationsUsed: number;
    exportLimit: number | null;
    exportsUsed: number;
    landingsUsed: number;
    storesUsed: number;
    publishedStoresUsed: number;
    ordersUsed: number;
    trafficUsed: number;
    storageMbUsed: number | null;
    domainsUsed: number;
    landingLimit: number | null;
    projectLimit: number | null;
    projectsUsed: number;
    storeLimit: number | null;
    domainLimit: number | null;
    teamMemberLimit: number | null;
    teamMembersUsed: number;
    templateLimit: number | null;
    templatesUsed: number;
  };
};

export type BillingLimitResource = PlanLimitResource;

type SubscriptionRow = {
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  grace_period_until?: string | null;
  plan_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  status?: UserSubscriptionAccess["status"] | null;
};

function isSubscriptionStillActive(subscription: SubscriptionRow | null) {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "trialing" || subscription.status === "active") {
    if (!subscription.cancel_at_period_end || !subscription.current_period_end) {
      return true;
    }

    return new Date(subscription.current_period_end).getTime() > Date.now();
  }

  return subscription.status === "past_due" || subscription.status === "unpaid";
}

function isMissingBillingTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  return (
    record.code === "PGRST205" ||
    record.message?.toLowerCase().includes("user_subscriptions") ||
    false
  );
}

export async function getUserSubscriptionAccess(
  userId: string
): Promise<UserSubscriptionAccess> {
  const supabase = await createClient();
  return getUserSubscriptionAccessForClient(supabase, userId);
}

export async function getUserSubscriptionAccessForClient(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSubscriptionAccess> {
  const usage = await getCurrentUsage(supabase, userId);

  const { data, error } = await supabase
    .from("user_subscriptions" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingBillingTable(error)) {
    // Default to Free for any recoverable billing data issue. Billing pages can still render.
  }

  const subscription = data as SubscriptionRow | null;
  const subscriptionIsActive = isSubscriptionStillActive(subscription);
  const status = subscription
    ? subscriptionIsActive
      ? (subscription.status ?? "active")
      : "canceled"
    : "active";
  const plan = getBillingPlan(subscriptionIsActive ? subscription?.plan_id : "free");
  const limits = getPlanLimits(plan.id);

  return {
    userId,
    plan,
    status,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    gracePeriodUntil: subscription?.grace_period_until ?? null,
    stripeCustomerId: subscription?.stripe_customer_id ?? null,
    stripeSubscriptionId: subscription?.stripe_subscription_id ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    usage: {
      aiGenerationsLimit: limits.aiGenerations,
      aiGenerationsUsed: usage.aiGenerationsUsed,
      landingsUsed: usage.landingsUsed,
      storesUsed: usage.storesUsed,
      publishedStoresUsed: usage.publishedStoresUsed,
      ordersUsed: usage.ordersUsed,
      trafficUsed: usage.trafficUsed,
      storageMbUsed: usage.storageMbUsed,
      domainsUsed: usage.domainsUsed,
      exportLimit: limits.exports,
      exportsUsed: usage.exportsUsed,
      landingLimit: limits.landings,
      projectLimit: limits.projects,
      projectsUsed: usage.projectsUsed,
      storeLimit: limits.stores,
      domainLimit: limits.domains,
      teamMemberLimit: limits.teamMembers,
      teamMembersUsed: usage.teamMembersUsed,
      templateLimit: limits.templates,
      templatesUsed: usage.templatesUsed
    }
  };
}

export async function getCurrentUserSubscriptionAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getUserSubscriptionAccess(user.id);
}

export function canCreateStore(access: UserSubscriptionAccess) {
  if (!access.plan.storeSupport && access.plan.storeLimit === 0) {
    return false;
  }

  return (
    access.plan.storeLimit === null || access.usage.storesUsed < access.plan.storeLimit
  );
}

export function canCreateLanding(access: UserSubscriptionAccess) {
  return (
    access.plan.landingLimit === null ||
    access.usage.landingsUsed < access.plan.landingLimit
  );
}

export function canCreateDomain(access: UserSubscriptionAccess) {
  return (
    access.plan.customDomains &&
    !isPaidAccessLocked({
      cancelAtPeriodEnd: access.cancelAtPeriodEnd,
      currentPeriodEnd: access.currentPeriodEnd,
      gracePeriodUntil: access.gracePeriodUntil,
      planId: access.plan.id,
      status: access.status
    }) &&
    (access.plan.domainLimit === null || access.usage.domainsUsed < access.plan.domainLimit)
  );
}

export function billingLimitState(
  access: UserSubscriptionAccess,
  resource: BillingLimitResource
) {
  const limits = getPlanLimits(access.plan.id);
  const state = {
    aiGenerations: {
      allowed: canUseFeature({
        feature: "ai_generation",
        planId: access.plan.id,
        resource,
        usage: access.usage
      }).allowed,
      limit: limits.aiGenerations,
      used: access.usage.aiGenerationsUsed
    },
    domains: {
      allowed: canCreateDomain(access),
      limit: access.usage.domainLimit,
      used: access.usage.domainsUsed
    },
    exports: {
      allowed: canUseFeature({
        feature: "exports",
        planId: access.plan.id,
        resource,
        usage: access.usage
      }).allowed,
      limit: limits.exports,
      used: access.usage.exportsUsed
    },
    landings: {
      allowed: canCreateLanding(access),
      limit: access.usage.landingLimit,
      used: access.usage.landingsUsed
    },
    projects: {
      allowed: canUseFeature({
        planId: access.plan.id,
        resource,
        usage: access.usage
      }).allowed,
      limit: limits.projects,
      used: access.usage.projectsUsed
    },
    stores: {
      allowed: canCreateStore(access),
      limit: access.usage.storeLimit,
      used: access.usage.storesUsed
    },
    teamMembers: {
      allowed: canUseFeature({
        feature: "team_members",
        planId: access.plan.id,
        resource,
        usage: access.usage
      }).allowed,
      limit: limits.teamMembers,
      used: access.usage.teamMembersUsed
    },
    templates: {
      allowed: canUseFeature({
        feature: "premium_templates",
        planId: access.plan.id,
        resource,
        usage: access.usage
      }).allowed,
      limit: limits.templates,
      used: access.usage.templatesUsed
    }
  }[resource];

  return {
    ...state,
    planId: access.plan.id,
    resource,
    status: access.status
  };
}

export function logBillingLimitCheck(
  access: UserSubscriptionAccess,
  resource: BillingLimitResource
) {
  const state = billingLimitState(access, resource);

  console.info("[billing-limit] resource creation check", state);

  return state;
}

export function canPublishStore(access: UserSubscriptionAccess) {
  return (
    access.plan.publish &&
    !isPaidAccessLocked({
      cancelAtPeriodEnd: access.cancelAtPeriodEnd,
      currentPeriodEnd: access.currentPeriodEnd,
      gracePeriodUntil: access.gracePeriodUntil,
      planId: access.plan.id,
      status: access.status
    })
  );
}

export function canUseTemplate(access: UserSubscriptionAccess, templateId: string) {
  if (access.plan.templateAccess === "all") {
    return true;
  }

  if (access.plan.templateAccess === "premium") {
    return (
      freeTemplateIds.includes(templateId as never) ||
      premiumTemplateIds.includes(templateId as never)
    );
  }

  return freeTemplateIds.includes(templateId as never);
}

export function canUseCustomBranding(access: UserSubscriptionAccess) {
  return access.plan.customBranding && !isPaidAccessLocked(access);
}

export function canUseSeo(access: UserSubscriptionAccess) {
  return access.plan.seo && !isPaidAccessLocked(access);
}

export function canUseCustomDomain(access: UserSubscriptionAccess) {
  return (
    access.plan.customDomains &&
    !isPaidAccessLocked(access) &&
    (access.plan.domainLimit === null || access.usage.domainsUsed < access.plan.domainLimit)
  );
}

export function canViewAdvancedAnalytics(access: UserSubscriptionAccess) {
  return access.plan.analytics === "advanced" && !isPaidAccessLocked(access);
}

export function canViewBasicAnalytics(access: UserSubscriptionAccess) {
  return access.plan.analytics !== "limited" && !isPaidAccessLocked(access);
}

export function getUpgradeMessage(
  reason:
    | "landings"
    | "stores"
    | "publish"
    | "template"
    | "branding"
    | "seo"
    | "domain"
    | "analytics"
) {
  const messages = {
    analytics: "Advanced analytics is available on the Pro and Agency plans.",
    branding: "Full theme and branding controls are available on Pro and Agency plans. Upgrade at /dashboard/billing.",
    domain: "Custom domains are available on Starter, Pro, and Agency plans. Upgrade at /dashboard/billing.",
    landings: "Your current plan has reached its landing page limit. Upgrade at /dashboard/billing.",
    publish: "Publishing is available on all active SHASTORE AI plans.",
    seo: "SEO settings are available on Pro and Agency plans. Upgrade at /dashboard/billing.",
    stores: "Your current plan has reached its store limit. Upgrade at /dashboard/billing.",
    template: "Premium templates are available on Pro and Agency plans. Upgrade at /dashboard/billing."
  };

  return messages[reason];
}

export function planRank(planId: SubscriptionPlanId) {
  return billingPlans.findIndex((plan) => plan.id === planId);
}
