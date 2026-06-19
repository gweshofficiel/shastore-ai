import "server-only";

import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingAudience =
  | "admins"
  | "affiliates"
  | "all_users"
  | "creators"
  | "existing_users"
  | "new_users"
  | "resellers"
  | "store_owners";

export type MarketingAudienceBadgeTone = "amber" | "blue" | "green" | "red";

export type MarketingAudienceCatalogEntry = {
  audience: MarketingAudience;
  badgeTone: MarketingAudienceBadgeTone;
  description: string;
  label: string;
};

export type MarketingAudienceStats = {
  adminAudiences: number;
  affiliateAudiences: number;
  allUserAudiences: number;
  creatorAudiences: number;
  existingUserAudiences: number;
  newUserAudiences: number;
  resellerAudiences: number;
  storeOwnerAudiences: number;
  totalItems: number;
  unclassifiedAudiences: number;
};

export type MarketingAudienceView = {
  audienceBadgeTone: MarketingAudienceBadgeTone;
  audienceDescription: string;
  audienceKey: MarketingAudience | null;
  audienceLabel: string;
  targetAudienceSummary: string;
};

export const MARKETING_AUDIENCES: readonly MarketingAudience[] = [
  "all_users",
  "store_owners",
  "resellers",
  "creators",
  "affiliates",
  "admins",
  "new_users",
  "existing_users"
] as const;

const audienceLabels: Record<MarketingAudience, string> = {
  admins: "Admins",
  affiliates: "Affiliates",
  all_users: "All users",
  creators: "Creators",
  existing_users: "Existing users",
  new_users: "New users",
  resellers: "Resellers",
  store_owners: "Store owners"
};

const audienceDescriptions: Record<MarketingAudience, string> = {
  admins: "Platform administrators and internal marketing operators.",
  affiliates: "Affiliate partners and future commission participants.",
  all_users: "All SHASTORE platform users in a broadcast-safe classification.",
  creators: "Creators, agencies, and creator marketplace participants.",
  existing_users: "Existing subscribers and returning platform customers.",
  new_users: "New platform subscribers and onboarding cohorts.",
  resellers: "Reseller partners and selected launch collaborators.",
  store_owners: "Store owners and merchant account holders."
};

const badgeToneByAudience: Record<MarketingAudience, MarketingAudienceBadgeTone> = {
  admins: "amber",
  affiliates: "green",
  all_users: "blue",
  creators: "green",
  existing_users: "blue",
  new_users: "amber",
  resellers: "green",
  store_owners: "blue"
};

const registryKeyAudienceMap: Record<string, MarketingAudience> = {
  "affiliate:creator-partners": "affiliates",
  "campaign:platform-announcements": "all_users",
  "gift-code:launch-credit": "resellers",
  "platform-coupon:welcome-plan-credit": "new_users",
  "platform-promotion:annual-upgrade": "existing_users",
  "referral:owner-invite": "store_owners"
};

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function sanitizeMarketingAudienceSummary(value: unknown) {
  const cleaned = text(value, 500);

  if (!cleaned) {
    return "Audience summary unavailable.";
  }

  if (secretPattern.test(cleaned)) {
    return "Audience summary hidden for safety.";
  }

  return cleaned;
}

export function isValidMarketingAudience(value: unknown): value is MarketingAudience {
  return typeof value === "string" && MARKETING_AUDIENCES.includes(value as MarketingAudience);
}

export function parseMarketingAudience(value: unknown): MarketingAudience | null {
  const cleaned = text(value, 80).toLowerCase().replace(/\s+/g, "_");
  return isValidMarketingAudience(cleaned) ? cleaned : null;
}

export function assertValidMarketingAudience(value: unknown): MarketingAudience {
  const audience = parseMarketingAudience(value);

  if (!audience) {
    throw new Error(
      "Marketing audience must be all_users, store_owners, resellers, creators, affiliates, admins, new_users, or existing_users."
    );
  }

  return audience;
}

export function getMarketingAudienceLabel(audience: MarketingAudience) {
  return audienceLabels[audience];
}

export function getMarketingAudienceDescription(audience: MarketingAudience) {
  return audienceDescriptions[audience];
}

export function getMarketingAudienceBadgeTone(audience: MarketingAudience): MarketingAudienceBadgeTone {
  return badgeToneByAudience[audience];
}

export function resolveMarketingAudienceLabel(value: unknown) {
  const audience = parseMarketingAudience(value);
  return audience ? getMarketingAudienceLabel(audience) : "Custom audience";
}

export function resolveMarketingAudienceBadgeTone(value: unknown): MarketingAudienceBadgeTone {
  const audience = parseMarketingAudience(value);
  return audience ? getMarketingAudienceBadgeTone(audience) : "amber";
}

export function resolveMarketingAudienceDescription(value: unknown) {
  const audience = parseMarketingAudience(value);
  return audience ? getMarketingAudienceDescription(audience) : "Audience classification is descriptive only.";
}

export function listMarketingAudienceCatalog(): MarketingAudienceCatalogEntry[] {
  return MARKETING_AUDIENCES.map((audience) => ({
    audience,
    badgeTone: getMarketingAudienceBadgeTone(audience),
    description: getMarketingAudienceDescription(audience),
    label: getMarketingAudienceLabel(audience)
  }));
}

function inferMarketingAudienceFromText(targetAudience: string, marketingType?: MarketingType): MarketingAudience | null {
  const normalized = targetAudience.toLowerCase();

  if (/all.*platform users|all users|everyone/.test(normalized)) {
    return "all_users";
  }

  if (/store owner|merchant/.test(normalized)) {
    return "store_owners";
  }

  if (/reseller|launch partner/.test(normalized)) {
    return "resellers";
  }

  if (/creator|agenc/.test(normalized)) {
    return marketingType === "affiliate" ? "affiliates" : "creators";
  }

  if (/affiliate|commission partner/.test(normalized)) {
    return "affiliates";
  }

  if (/admin|internal team|operator/.test(normalized)) {
    return "admins";
  }

  if (/new.*subscriber|welcome|onboarding/.test(normalized)) {
    return "new_users";
  }

  if (/monthly plan|existing|returning|upgrade/.test(normalized)) {
    return "existing_users";
  }

  if (marketingType === "affiliate") {
    return "affiliates";
  }

  if (marketingType === "referral") {
    return "store_owners";
  }

  if (marketingType === "campaign") {
    return "all_users";
  }

  return null;
}

export function resolveMarketingAudienceKey(params: {
  marketingType?: MarketingType;
  metadata?: Record<string, unknown>;
  registryKey?: string;
  targetAudience: string;
}): MarketingAudience | null {
  const metadata = safeRecord(params.metadata);
  const metadataAudience =
    parseMarketingAudience(metadata.audience_key) ??
    parseMarketingAudience(metadata.target_audience_key) ??
    parseMarketingAudience(metadata.audience);

  if (metadataAudience) {
    return metadataAudience;
  }

  const registryKey = text(params.registryKey, 160);

  if (registryKey && registryKeyAudienceMap[registryKey]) {
    return registryKeyAudienceMap[registryKey];
  }

  const directAudience = parseMarketingAudience(params.targetAudience);

  if (directAudience) {
    return directAudience;
  }

  const summary = sanitizeMarketingAudienceSummary(params.targetAudience);
  return inferMarketingAudienceFromText(summary, params.marketingType);
}

export function resolveMarketingAudienceView(params: {
  marketingType?: MarketingType;
  metadata?: Record<string, unknown>;
  registryKey?: string;
  targetAudience: string;
}): MarketingAudienceView {
  const targetAudienceSummary = sanitizeMarketingAudienceSummary(params.targetAudience);
  const audienceKey = resolveMarketingAudienceKey({
    marketingType: params.marketingType,
    metadata: params.metadata,
    registryKey: params.registryKey,
    targetAudience: targetAudienceSummary
  });

  if (!audienceKey) {
    return {
      audienceBadgeTone: "amber",
      audienceDescription: "Audience classification is descriptive only. No private user lists are exposed.",
      audienceKey: null,
      audienceLabel: "Custom audience",
      targetAudienceSummary
    };
  }

  return {
    audienceBadgeTone: getMarketingAudienceBadgeTone(audienceKey),
    audienceDescription: getMarketingAudienceDescription(audienceKey),
    audienceKey,
    audienceLabel: getMarketingAudienceLabel(audienceKey),
    targetAudienceSummary
  };
}

export function countMarketingItemsByAudience<T extends { audienceKey: MarketingAudience | null }>(
  items: T[]
): MarketingAudienceStats {
  return {
    adminAudiences: items.filter((item) => item.audienceKey === "admins").length,
    affiliateAudiences: items.filter((item) => item.audienceKey === "affiliates").length,
    allUserAudiences: items.filter((item) => item.audienceKey === "all_users").length,
    creatorAudiences: items.filter((item) => item.audienceKey === "creators").length,
    existingUserAudiences: items.filter((item) => item.audienceKey === "existing_users").length,
    newUserAudiences: items.filter((item) => item.audienceKey === "new_users").length,
    resellerAudiences: items.filter((item) => item.audienceKey === "resellers").length,
    storeOwnerAudiences: items.filter((item) => item.audienceKey === "store_owners").length,
    totalItems: items.length,
    unclassifiedAudiences: items.filter((item) => !item.audienceKey).length
  };
}
