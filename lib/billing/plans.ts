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
  "minimal",
  "local-business"
] as const;

export const premiumTemplateIds = ["beauty", "fashion", "gadget", "luxury"] as const;

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceCents: 0,
    description: "Launch one landing page with SHASTORE branding and limited analytics.",
    landingLimit: 1,
    storeLimit: 0,
    domainLimit: 0,
    analytics: "limited",
    templateAccess: "limited",
    customBranding: false,
    publish: true,
    seo: false,
    customDomains: false,
    shastoreBranding: true,
    priorityRendering: false,
    storeSupport: false,
    teamFeatures: false,
    prioritySupport: false,
    features: [
      "1 landing page",
      "Limited analytics",
      "SHASTORE branding",
      "Starter templates"
    ]
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    priceCents: 1900,
    stripePriceEnv: "PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER",
    description: "Build up to 10 landing pages with custom branding and domains.",
    landingLimit: 10,
    storeLimit: 0,
    domainLimit: 1,
    analytics: "basic",
    templateAccess: "premium",
    customBranding: true,
    publish: true,
    seo: true,
    customDomains: true,
    shastoreBranding: false,
    priorityRendering: false,
    storeSupport: false,
    teamFeatures: false,
    prioritySupport: false,
    features: [
      "10 landing pages",
      "Custom branding",
      "Basic analytics",
      "1 custom domain"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    priceCents: 4900,
    stripePriceEnv: "PLATFORM_BILLING_STRIPE_PRICE_ID_PRO",
    description: "Unlimited pages, advanced analytics, premium templates, and store support.",
    landingLimit: null,
    storeLimit: null,
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
      "Unlimited landing pages",
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
    description: "Multi-brand workspace for agencies with unlimited stores and domains.",
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
      "Unlimited domains",
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
