import {
  billingLimitState,
  canUseCustomBranding,
  canUseCustomDomain,
  canUseSeo,
  canUseTemplate,
  canViewAdvancedAnalytics,
  type BillingLimitResource,
  type UserSubscriptionAccess
} from "@/lib/billing/access";
import type { SubscriptionPlanId } from "@/lib/billing/plans";
import { getExpiryLockdownState, isPaidAccessLocked } from "@/lib/billing/expiry-lockdown";
import {
  canUseFeature as canUsePlanFeature,
  getPlanLimits,
  type PlanFeature
} from "@/lib/billing/plan-limits";

export type BillingFeature = PlanFeature;

export type BillingEnforcementCode =
  | "feature_unavailable"
  | "limit_reached"
  | "subscription_inactive";

export type BillingEnforcementContext = {
  feature?: BillingFeature;
  limit?: number | null;
  planId: SubscriptionPlanId;
  resource?: BillingLimitResource;
  status: UserSubscriptionAccess["status"];
  templateId?: string;
  used?: number;
};

export class BillingEnforcementError extends Error {
  code: BillingEnforcementCode;
  context: BillingEnforcementContext;
  userMessage: string;

  constructor(code: BillingEnforcementCode, userMessage: string, context: BillingEnforcementContext) {
    super(userMessage);
    this.name = "BillingEnforcementError";
    this.code = code;
    this.context = context;
    this.userMessage = userMessage;
  }
}

export const planCapabilities: Record<
  SubscriptionPlanId,
  Record<BillingFeature, boolean>
> = {
  agency: {
    advanced_analytics: true,
    ai_generation: true,
    custom_branding: true,
    custom_domains: true,
    exports: true,
    multi_store: true,
    premium_templates: true,
    seo: true,
    team_members: true
  },
  free: {
    advanced_analytics: false,
    ai_generation: true,
    custom_branding: false,
    custom_domains: false,
    exports: true,
    multi_store: false,
    premium_templates: false,
    seo: false,
    team_members: false
  },
  pro: {
    advanced_analytics: true,
    ai_generation: true,
    custom_branding: true,
    custom_domains: true,
    exports: true,
    multi_store: true,
    premium_templates: true,
    seo: true,
    team_members: true
  },
  starter: {
    advanced_analytics: false,
    ai_generation: true,
    custom_branding: false,
    custom_domains: true,
    exports: true,
    multi_store: false,
    premium_templates: true,
    seo: false,
    team_members: false
  }
};

function featureMessage(feature: BillingFeature) {
  const messages: Record<BillingFeature, string> = {
    advanced_analytics: "Advanced analytics are unavailable on your current plan. Upgrade at /dashboard/billing.",
    ai_generation: "AI generations are unavailable on your current plan. Upgrade at /dashboard/billing.",
    custom_branding: "Full branding controls are unavailable on your current plan. Upgrade at /dashboard/billing.",
    custom_domains: "Custom domains are unavailable on your current plan. Upgrade at /dashboard/billing.",
    exports: "Exports are unavailable on your current plan. Upgrade at /dashboard/billing.",
    multi_store: "Multiple stores are unavailable on your current plan. Upgrade at /dashboard/billing.",
    premium_templates: "Premium templates are unavailable on your current plan. Upgrade at /dashboard/billing.",
    seo: "SEO settings are unavailable on your current plan. Upgrade at /dashboard/billing.",
    team_members: "Team members are unavailable on your current plan. Upgrade at /dashboard/billing."
  };

  return messages[feature];
}

function limitMessage(resource: BillingLimitResource) {
  const labels: Record<BillingLimitResource, string> = {
    aiGenerations: "AI generation",
    domains: "domain",
    exports: "export",
    landings: "landing page",
    projects: "project",
    stores: "store",
    teamMembers: "team member",
    templates: "template"
  };

  return `Your current plan has reached its ${labels[resource]} limit. Upgrade at /dashboard/billing.`;
}

function isActiveForBilling(access: UserSubscriptionAccess) {
  return !isPaidAccessLocked({
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd,
    gracePeriodUntil: access.gracePeriodUntil,
    planId: access.plan.id,
    status: access.status
  });
}

function featureAllowed(access: UserSubscriptionAccess, feature: BillingFeature, templateId?: string) {
  if (!isActiveForBilling(access)) {
    return false;
  }

  if (feature === "custom_branding") {
    return canUseCustomBranding(access);
  }

  if (feature === "custom_domains") {
    return canUseCustomDomain(access);
  }

  if (feature === "seo") {
    return canUseSeo(access);
  }

  if (feature === "advanced_analytics") {
    return canViewAdvancedAnalytics(access);
  }

  if (feature === "premium_templates" && templateId) {
    return canUseTemplate(access, templateId);
  }

  return canUsePlanFeature({
    feature,
    planId: access.plan.id,
    usage: access.usage
  }).allowed;
}

export function assertFeatureAccess(
  access: UserSubscriptionAccess,
  feature: BillingFeature,
  options: { templateId?: string } = {}
) {
  const allowed = featureAllowed(access, feature, options.templateId);

  console.info("[plan-limit] feature access check", {
    allowed,
    feature,
    planId: access.plan.id,
    status: access.status,
    templateId: options.templateId ?? null,
    userId: access.userId
  });

  if (!allowed) {
    console.warn("[upgrade-required] feature blocked", {
      feature,
      planId: access.plan.id,
      status: access.status,
      templateId: options.templateId ?? null,
      userId: access.userId
    });
    const expiry = getExpiryLockdownState(access);
    throw new BillingEnforcementError("feature_unavailable", expiry.reason ?? featureMessage(feature), {
      feature,
      planId: access.plan.id,
      status: access.status,
      templateId: options.templateId
    });
  }
}

export function assertUsageWithinLimits(
  access: UserSubscriptionAccess,
  resource: BillingLimitResource
) {
  const state = billingLimitState(access, resource);
  const limits = getPlanLimits(access.plan.id);

  console.info("[usage-check] usage limit check", {
    allowed: state.allowed,
    limit: state.limit,
    planId: state.planId,
    resource,
    status: state.status,
    used: state.used,
    userId: access.userId
  });

  if (!isActiveForBilling(access)) {
    console.warn("[upgrade-required] subscription inactive", {
      planId: access.plan.id,
      resource,
      status: access.status,
      userId: access.userId
    });
    const expiry = getExpiryLockdownState(access);
    throw new BillingEnforcementError("subscription_inactive", expiry.reason ?? "Your subscription is not active. Upgrade at /dashboard/billing.", {
      limit: state.limit,
      planId: access.plan.id,
      resource,
      status: access.status,
      used: state.used
    });
  }

  if (!state.allowed) {
    console.warn("[upgrade-required] usage limit blocked", {
      limit: state.limit,
      planId: access.plan.id,
      resource,
      used: state.used,
      userId: access.userId
    });
    throw new BillingEnforcementError("limit_reached", limitMessage(resource), {
      limit: limits[resource],
      planId: access.plan.id,
      resource,
      status: access.status,
      used: state.used
    });
  }
}

export function billingEnforcementMessage(error: unknown) {
  return error instanceof BillingEnforcementError ? error.userMessage : null;
}
