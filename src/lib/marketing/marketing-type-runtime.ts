import "server-only";

export type MarketingType =
  | "affiliate"
  | "campaign"
  | "coupon"
  | "gift_code"
  | "promotion"
  | "referral";

export type MarketingTypeSection =
  | "Affiliate program"
  | "Campaigns"
  | "Gift codes"
  | "Platform coupons"
  | "Platform promotions"
  | "Referral program";

export type MarketingTypeBadgeTone = "amber" | "blue" | "green" | "red";

export type MarketingTypeCatalogEntry = {
  badgeTone: MarketingTypeBadgeTone;
  description: string;
  label: string;
  section: MarketingTypeSection;
  sectionLabel: string;
  type: MarketingType;
};

export type MarketingTypeStats = {
  affiliateItems: number;
  campaignItems: number;
  couponItems: number;
  giftCodeItems: number;
  promotionItems: number;
  referralItems: number;
  totalItems: number;
};

export type MarketingTypeGroup<T extends { marketingType: MarketingType }> = {
  items: T[];
  section: MarketingTypeSection;
  sectionLabel: string;
  type: MarketingType;
  typeLabel: string;
};

export const MARKETING_TYPES: readonly MarketingType[] = [
  "coupon",
  "promotion",
  "gift_code",
  "referral",
  "affiliate",
  "campaign"
] as const;

const typeLabels: Record<MarketingType, string> = {
  affiliate: "Affiliate",
  campaign: "Campaign",
  coupon: "Coupon",
  gift_code: "Gift code",
  promotion: "Promotion",
  referral: "Referral"
};

const typeDescriptions: Record<MarketingType, string> = {
  affiliate: "Creator and partner affiliate program foundation.",
  campaign: "Platform announcement and broadcast campaign foundation.",
  coupon: "Platform subscription coupon foundation.",
  gift_code: "Platform credit gift code foundation.",
  promotion: "Platform plan promotion and upgrade incentive foundation.",
  referral: "Store owner referral program foundation."
};

const sectionByType: Record<MarketingType, MarketingTypeSection> = {
  affiliate: "Affiliate program",
  campaign: "Campaigns",
  coupon: "Platform coupons",
  gift_code: "Gift codes",
  promotion: "Platform promotions",
  referral: "Referral program"
};

const badgeToneByType: Record<MarketingType, MarketingTypeBadgeTone> = {
  affiliate: "green",
  campaign: "amber",
  coupon: "blue",
  gift_code: "amber",
  promotion: "blue",
  referral: "green"
};

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

export function isValidMarketingType(value: unknown): value is MarketingType {
  return typeof value === "string" && MARKETING_TYPES.includes(value as MarketingType);
}

export function parseMarketingType(value: unknown): MarketingType | null {
  const cleaned = text(value, 80);
  return isValidMarketingType(cleaned) ? cleaned : null;
}

export function assertValidMarketingType(value: unknown): MarketingType {
  const marketingType = parseMarketingType(value);

  if (!marketingType) {
    throw new Error("Marketing type must be coupon, promotion, gift_code, referral, affiliate, or campaign.");
  }

  return marketingType;
}

export function getMarketingTypeLabel(type: MarketingType) {
  return typeLabels[type];
}

export function getMarketingTypeDescription(type: MarketingType) {
  return typeDescriptions[type];
}

export function getMarketingTypeBadgeTone(type: MarketingType): MarketingTypeBadgeTone {
  return badgeToneByType[type];
}

export function getMarketingTypeSection(type: MarketingType): MarketingTypeSection {
  return sectionByType[type];
}

export function getMarketingTypeSectionLabel(type: MarketingType) {
  return sectionByType[type];
}

export function resolveMarketingTypeLabel(value: unknown) {
  const marketingType = parseMarketingType(value);
  return marketingType ? getMarketingTypeLabel(marketingType) : "Unknown type";
}

export function resolveMarketingTypeBadgeTone(value: unknown): MarketingTypeBadgeTone {
  const marketingType = parseMarketingType(value);
  return marketingType ? getMarketingTypeBadgeTone(marketingType) : "red";
}

export function listMarketingTypeCatalog(): MarketingTypeCatalogEntry[] {
  return MARKETING_TYPES.map((type) => {
    const section = getMarketingTypeSection(type);

    return {
      badgeTone: getMarketingTypeBadgeTone(type),
      description: getMarketingTypeDescription(type),
      label: getMarketingTypeLabel(type),
      section,
      sectionLabel: section,
      type
    };
  });
}

export function countMarketingItemsByType<T extends { marketingType: MarketingType }>(
  items: T[]
): MarketingTypeStats {
  return {
    affiliateItems: items.filter((item) => item.marketingType === "affiliate").length,
    campaignItems: items.filter((item) => item.marketingType === "campaign").length,
    couponItems: items.filter((item) => item.marketingType === "coupon").length,
    giftCodeItems: items.filter((item) => item.marketingType === "gift_code").length,
    promotionItems: items.filter((item) => item.marketingType === "promotion").length,
    referralItems: items.filter((item) => item.marketingType === "referral").length,
    totalItems: items.length
  };
}

export function filterMarketingItemsByType<T extends { marketingType: MarketingType }>(
  items: T[],
  type: MarketingType
): T[] {
  return items.filter((item) => item.marketingType === type);
}

export function groupMarketingRegistryItemsByType<T extends { marketingType: MarketingType }>(
  items: T[]
): MarketingTypeGroup<T>[] {
  return MARKETING_TYPES.map((type) => {
    const groupedItems = filterMarketingItemsByType(items, type);
    const section = getMarketingTypeSection(type);

    return {
      items: groupedItems,
      section,
      sectionLabel: section,
      type,
      typeLabel: getMarketingTypeLabel(type)
    };
  });
}
