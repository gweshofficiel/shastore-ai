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

export type BillingFeature =
  | "advanced_analytics"
  | "custom_branding"
  | "custom_domains"
  | "multi_store"
  | "premium_templates"
  | "seo";

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
    custom_branding: true,
    custom_domains: true,
    multi_store: true,
    premium_templates: true,
    seo: true
  },
  free: {
    advanced_analytics: false,
    custom_branding: false,
    custom_domains: false,
    multi_store: false,
    premium_templates: false,
    seo: false
  },
  pro: {
    advanced_analytics: true,
    custom_branding: true,
    custom_domains: true,
    multi_store: true,
    premium_templates: true,
    seo: true
  },
  starter: {
    advanced_analytics: false,
    custom_branding: false,
    custom_domains: true,
    multi_store: false,
    premium_templates: true,
    seo: false
  }
};

function featureMessage(feature: BillingFeature) {
  const messages: Record<BillingFeature, string> = {
    advanced_analytics: "Advanced analytics are unavailable on your current plan. Upgrade at /dashboard/billing.",
    custom_branding: "Full branding controls are unavailable on your current plan. Upgrade at /dashboard/billing.",
    custom_domains: "Custom domains are unavailable on your current plan. Upgrade at /dashboard/billing.",
    multi_store: "Multiple stores are unavailable on your current plan. Upgrade at /dashboard/billing.",
    premium_templates: "Premium templates are unavailable on your current plan. Upgrade at /dashboard/billing.",
    seo: "SEO settings are unavailable on your current plan. Upgrade at /dashboard/billing."
  };

  return messages[feature];
}

function limitMessage(resource: BillingLimitResource) {
  const labels: Record<BillingLimitResource, string> = {
    domains: "domain",
    landings: "landing page",
    stores: "store"
  };

  return `Your current plan has reached its ${labels[resource]} limit. Upgrade at /dashboard/billing.`;
}

function isActiveForBilling(access: UserSubscriptionAccess) {
  return access.status !== "canceled" && access.status !== "incomplete";
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

  return planCapabilities[access.plan.id][feature];
}

export function assertFeatureAccess(
  access: UserSubscriptionAccess,
  feature: BillingFeature,
  options: { templateId?: string } = {}
) {
  const allowed = featureAllowed(access, feature, options.templateId);

  console.info("[billing-enforcement] feature access check", {
    allowed,
    feature,
    planId: access.plan.id,
    status: access.status,
    templateId: options.templateId ?? null,
    userId: access.userId
  });

  if (!allowed) {
    throw new BillingEnforcementError("feature_unavailable", featureMessage(feature), {
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

  console.info("[billing-enforcement] usage limit check", {
    allowed: state.allowed,
    limit: state.limit,
    planId: state.planId,
    resource,
    status: state.status,
    used: state.used,
    userId: access.userId
  });

  if (!isActiveForBilling(access)) {
    throw new BillingEnforcementError("subscription_inactive", "Your subscription is not active. Upgrade at /dashboard/billing.", {
      limit: state.limit,
      planId: access.plan.id,
      resource,
      status: access.status,
      used: state.used
    });
  }

  if (!state.allowed) {
    throw new BillingEnforcementError("limit_reached", limitMessage(resource), {
      limit: state.limit,
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
