import { createClient } from "@/lib/supabase/server";
import {
  billingPlans,
  freeTemplateIds,
  getBillingPlan,
  premiumTemplateIds,
  type BillingPlan,
  type SubscriptionPlanId
} from "@/lib/billing/plans";

export type UserSubscriptionAccess = {
  userId: string;
  plan: BillingPlan;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd: string | null;
  usage: {
    landingsUsed: number;
    storesUsed: number;
    publishedStoresUsed: number;
    ordersUsed: number;
    trafficUsed: number;
    storageMbUsed: number;
    domainsUsed: number;
    landingLimit: number | null;
    storeLimit: number | null;
    domainLimit: number | null;
  };
};

type SubscriptionRow = {
  plan_id?: string | null;
  status?: UserSubscriptionAccess["status"] | null;
  current_period_end?: string | null;
};

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

  const { count: storesCount } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: publishedStoresCount } = await supabase
    .from("published_stores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "published");

  const { count: landingsCount } = await supabase
    .from("landing_pages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: ordersCount } = await supabase
    .from("commerce_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: domainsCount } = await supabase
    .from("commerce_domain_publications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: trafficCount } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "page_view");

  const { count: storageImageCount } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data, error } = await supabase
    .from("user_subscriptions" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingBillingTable(error)) {
    // Default to Free for any recoverable billing data issue. Billing pages can still render.
  }

  const subscription = data as SubscriptionRow | null;
  const plan = getBillingPlan(subscription?.plan_id ?? "free");

  return {
    userId,
    plan,
    status: subscription?.status ?? "active",
    currentPeriodEnd: subscription?.current_period_end ?? null,
    usage: {
      landingsUsed: landingsCount ?? 0,
      storesUsed: storesCount ?? 0,
      publishedStoresUsed: publishedStoresCount ?? 0,
      ordersUsed: ordersCount ?? 0,
      trafficUsed: trafficCount ?? 0,
      storageMbUsed: Math.round(((storageImageCount ?? 0) * 1.5 + Number.EPSILON) * 10) / 10,
      domainsUsed: domainsCount ?? 0,
      landingLimit: plan.landingLimit,
      storeLimit: plan.storeLimit,
      domainLimit: plan.domainLimit
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

export function canPublishStore(access: UserSubscriptionAccess) {
  return access.plan.publish && access.status !== "canceled";
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
  return access.plan.customBranding && access.status !== "canceled";
}

export function canUseSeo(access: UserSubscriptionAccess) {
  return access.plan.seo && access.status !== "canceled";
}

export function canUseCustomDomain(access: UserSubscriptionAccess) {
  return (
    access.plan.customDomains &&
    access.status !== "canceled" &&
    (access.plan.domainLimit === null || access.usage.domainsUsed < access.plan.domainLimit)
  );
}

export function canViewAdvancedAnalytics(access: UserSubscriptionAccess) {
  return access.plan.analytics === "advanced" && access.status !== "canceled";
}

export function canViewBasicAnalytics(access: UserSubscriptionAccess) {
  return access.plan.analytics !== "limited" && access.status !== "canceled";
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
    branding: "Custom branding is available on Starter, Pro, and Agency plans.",
    domain: "Custom domains are available on Starter, Pro, and Agency plans.",
    landings: "Your current plan has reached its landing page limit.",
    publish: "Publishing is available on all active SHASTORE AI plans.",
    seo: "SEO settings are available on Starter, Pro, and Agency plans.",
    stores: "",
    template: "Premium templates are available on Starter, Pro, and Agency plans."
  };

  return messages[reason];
}

export function planRank(planId: SubscriptionPlanId) {
  return billingPlans.findIndex((plan) => plan.id === planId);
}
