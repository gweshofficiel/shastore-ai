export type SubscriptionPlanId = "free" | "starter" | "pro" | "agency";

export type BillingPlan = {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  priceCents: number;
  stripePriceEnv?: string;
  description: string;
  landingLimit: number | null;
  storeLimit: number | null;
  domainLimit: number | null;
  analytics: "limited" | "basic" | "advanced";
  templateAccess: "limited" | "premium" | "all";
  customBranding: boolean;
  publish: boolean;
  seo: boolean;
  customDomains: boolean;
  shastoreBranding: boolean;
  priorityRendering: boolean;
  storeSupport: boolean;
  teamFeatures: boolean;
  prioritySupport: boolean;
  features: string[];
};

export const freeTemplateIds = [
  "shastore-flagship-premium",
  "minimal",
  "local-business"
] as const;

export const premiumTemplateIds = [
  "aurora-pro",
  "beauty",
  "beauty-starter",
  "electronics-starter",
  "fashion",
  "fashion-starter",
  "gadget",
  "general-starter",
  "luxury"
] as const;

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceCents: 0,
    description: "Launch one store and one landing page with basic SHASTORE branding.",
    landingLimit: 1,
    storeLimit: 1,
    domainLimit: 0,
    analytics: "limited",
    templateAccess: "limited",
    customBranding: false,
    publish: true,
    seo: false,
    customDomains: false,
    shastoreBranding: true,
    priorityRendering: false,
    storeSupport: true,
    teamFeatures: false,
    prioritySupport: false,
    features: [
      "1 landing page",
      "1 store",
      "Basic theme controls",
      "Limited analytics",
      "SHASTORE branding"
    ]
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    priceCents: 1900,
    stripePriceEnv: "PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER",
    description: "Legacy starter plan for landing-page customers.",
    landingLimit: 10,
    storeLimit: 1,
    domainLimit: 1,
    analytics: "basic",
    templateAccess: "premium",
    customBranding: false,
    publish: true,
    seo: false,
    customDomains: true,
    shastoreBranding: false,
    priorityRendering: false,
    storeSupport: true,
    teamFeatures: false,
    prioritySupport: false,
    features: [
      "10 landing pages",
      "Basic analytics",
      "1 custom domain",
      "Premium landing templates"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    priceCents: 4900,
    stripePriceEnv: "PLATFORM_BILLING_STRIPE_PRICE_ID_PRO",
    description: "Grow with five stores, ten landing pages, custom domains, and full theme controls.",
    landingLimit: 10,
    storeLimit: 5,
    domainLimit: 5,
    analytics: "advanced",
    templateAccess: "all",
    customBranding: true,
    publish: true,
    seo: true,
    customDomains: true,
    shastoreBranding: false,
    priorityRendering: true,
    storeSupport: true,
    teamFeatures: false,
    prioritySupport: true,
    features: [
      "5 stores",
      "10 landing pages",
      "Custom domains",
      "Full theme controls",
      "Advanced analytics",
      "Priority rendering",
      "Premium templates",
      "Store support"
    ]
  },
  {
    id: "agency",
    name: "Agency",
    price: "$149",
    priceCents: 14900,
    stripePriceEnv: "PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY",
    description: "Multi-brand workspace with unlimited stores, landing pages, and domains.",
    landingLimit: null,
    storeLimit: null,
    domainLimit: null,
    analytics: "advanced",
    templateAccess: "all",
    customBranding: true,
    publish: true,
    seo: true,
    customDomains: true,
    shastoreBranding: false,
    priorityRendering: true,
    storeSupport: true,
    teamFeatures: true,
    prioritySupport: true,
    features: [
      "Multi-brand workspace",
      "Unlimited stores",
      "Unlimited landing pages",
      "Unlimited domains",
      "Reseller-ready foundation",
      "Team features",
      "Priority support"
    ]
  }
];

export function getBillingPlan(planId: string | null | undefined): BillingPlan {
  const normalizedPlanId = planId === "business" ? "agency" : planId;
  return billingPlans.find((plan) => plan.id === normalizedPlanId) ?? billingPlans[0];
}

export function estimateCreditsForGeneration(kind: "landing_copy" | "seo_copy") {
  return kind === "seo_copy" ? 1 : 3;
}
