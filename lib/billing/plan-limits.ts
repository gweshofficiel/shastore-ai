import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingUsageForUser, type BillingUsageMetrics } from "@/lib/billing/usage";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";

export type PlanLimitResource =
  | "aiGenerations"
  | "domains"
  | "exports"
  | "landings"
  | "ordersMonth"
  | "products"
  | "projects"
  | "storageMb"
  | "stores"
  | "teamMembers"
  | "templates";

export type PlanFeature =
  | "advanced_analytics"
  | "ai_generation"
  | "custom_branding"
  | "custom_domains"
  | "exports"
  | "multi_store"
  | "premium_templates"
  | "seo"
  | "team_members";

export type PlanLimits = Record<PlanLimitResource, number | null> & {
  features: Record<PlanFeature, boolean>;
};

export type PlanUsage = BillingUsageMetrics;

export const planLimitsConfig: Record<SubscriptionPlanId, PlanLimits> = {
  free: {
    aiGenerations: 10,
    domains: 0,
    exports: 1,
    landings: 1,
    ordersMonth: 50,
    products: 20,
    projects: 1,
    storageMb: 100,
    stores: 1,
    teamMembers: 1,
    templates: 2,
    features: {
      advanced_analytics: false,
      ai_generation: true,
      custom_branding: false,
      custom_domains: false,
      exports: true,
      multi_store: false,
      premium_templates: false,
      seo: false,
      team_members: false
    }
  },
  starter: {
    aiGenerations: 100,
    domains: 1,
    exports: 10,
    landings: 10,
    ordersMonth: 500,
    products: 100,
    projects: 10,
    storageMb: 1_000,
    stores: 1,
    teamMembers: 3,
    templates: 6,
    features: {
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
  },
  pro: {
    aiGenerations: 500,
    domains: 5,
    exports: 100,
    landings: 10,
    ordersMonth: 5_000,
    products: 1_000,
    projects: 15,
    storageMb: 10_000,
    stores: 5,
    teamMembers: 10,
    templates: null,
    features: {
      advanced_analytics: true,
      ai_generation: true,
      custom_branding: true,
      custom_domains: true,
      exports: true,
      multi_store: true,
      premium_templates: true,
      seo: true,
      team_members: true
    }
  },
  agency: {
    aiGenerations: null,
    domains: null,
    exports: null,
    landings: null,
    ordersMonth: null,
    products: null,
    projects: null,
    storageMb: null,
    stores: null,
    teamMembers: null,
    templates: null,
    features: {
      advanced_analytics: true,
      ai_generation: true,
      custom_branding: true,
      custom_domains: true,
      exports: true,
      multi_store: true,
      premium_templates: true,
      seo: true,
      team_members: true
    }
  }
};

export function getPlanLimits(planId: string | null | undefined): PlanLimits {
  const plan = getBillingPlan(planId);
  const limits = planLimitsConfig[plan.id];

  console.info("[plan-limit] limits resolved", { planId: plan.id });

  return limits;
}

export async function getCurrentUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanUsage> {
  const usage = await getBillingUsageForUser(supabase, userId);

  console.info("[usage-check] current usage resolved", {
    ...usage,
    userId
  });

  return usage;
}

export function usageForResource(usage: PlanUsage, resource: PlanLimitResource) {
  const values: Record<PlanLimitResource, number> = {
    aiGenerations: usage.aiGenerationsUsed,
    domains: usage.domainsUsed,
    exports: usage.exportsUsed,
    landings: usage.landingsUsed,
    ordersMonth: usage.ordersMonthUsed,
    products: usage.productsUsed,
    projects: usage.projectsUsed,
    storageMb: usage.storageMbUsed ?? 0,
    stores: usage.storesUsed,
    teamMembers: usage.teamMembersUsed,
    templates: usage.templatesUsed
  };

  return values[resource];
}

export function canUseFeature({
  feature,
  planId,
  resource,
  usage
}: {
  feature?: PlanFeature;
  planId: string | null | undefined;
  resource?: PlanLimitResource;
  usage?: PlanUsage;
}) {
  const plan = getBillingPlan(planId);
  const limits = getPlanLimits(plan.id);
  const featureAllowed = feature ? limits.features[feature] : true;
  const limit = resource ? limits[resource] : null;
  const used = resource && usage ? usageForResource(usage, resource) : 0;
  const withinLimit = !resource || limit === null || used < limit;
  const allowed = featureAllowed && withinLimit;

  console.info("[usage-check] feature usage checked", {
    allowed,
    feature: feature ?? null,
    limit,
    planId: plan.id,
    resource: resource ?? null,
    used
  });

  if (!allowed) {
    console.warn("[upgrade-required] plan limit reached", {
      feature: feature ?? null,
      limit,
      planId: plan.id,
      resource: resource ?? null,
      used
    });
  }

  return {
    allowed,
    featureAllowed,
    limit,
    planId: plan.id,
    resource: resource ?? null,
    used,
    withinLimit
  };
}
