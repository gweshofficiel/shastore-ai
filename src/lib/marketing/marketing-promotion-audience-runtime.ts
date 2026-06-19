import "server-only";

import {
  resolveMarketingAudienceView,
  sanitizeMarketingAudienceSummary,
  type MarketingAudience,
  type MarketingAudienceBadgeTone
} from "@/src/lib/marketing/marketing-audience-runtime";

export type MarketingPromotionAudienceReadinessState = "classified" | "custom" | "unclassified" | "unknown";

export type MarketingPromotionAudienceView = {
  audienceBadgeTone: MarketingAudienceBadgeTone;
  audienceDescription: string;
  audienceKey: MarketingAudience | null;
  audienceLabel: string;
  promotionAudienceDescription: string;
  promotionAudienceLabel: string;
  promotionAudienceReadinessState: MarketingPromotionAudienceReadinessState;
};

export type MarketingPromotionAudienceInput = {
  metadata?: unknown;
  registryKey: string;
  targetAudience: string;
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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function resolveMarketingPromotionAudienceReadinessState(params: {
  audienceKey: MarketingAudience | null;
  targetAudienceSummary: string;
}): MarketingPromotionAudienceReadinessState {
  const summary = sanitizeMarketingAudienceSummary(params.targetAudienceSummary);

  if (summary === "Audience summary unavailable.") {
    return "unclassified";
  }

  if (params.audienceKey) {
    return "classified";
  }

  if (summary) {
    return "custom";
  }

  return "unclassified";
}

export function getMarketingPromotionAudienceReadinessLabel(
  state: MarketingPromotionAudienceReadinessState
) {
  if (state === "classified") return "Classified";
  if (state === "custom") return "Custom audience";
  if (state === "unclassified") return "Unclassified";
  return "Unknown";
}

export function getMarketingPromotionAudienceReadinessDescription(
  state: MarketingPromotionAudienceReadinessState
) {
  if (state === "classified") {
    return "Promotion audience is classified for Super Admin display only. No targeting enforcement is connected.";
  }

  if (state === "custom") {
    return "Promotion audience is descriptive only and not yet classified for audience readiness.";
  }

  if (state === "unclassified") {
    return "Promotion audience summary is unavailable for classification.";
  }

  return "Promotion audience could not be classified safely. No customer lists are exposed.";
}

export function getMarketingPromotionAudienceReadinessBadgeTone(
  state: MarketingPromotionAudienceReadinessState
): MarketingAudienceBadgeTone {
  if (state === "classified") return "green";
  if (state === "custom") return "amber";
  if (state === "unclassified") return "red";
  return "blue";
}

export function resolveMarketingPromotionAudienceView(
  input: MarketingPromotionAudienceInput
): MarketingPromotionAudienceView & { targetAudienceSummary: string } {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata);
  const audience = resolveMarketingAudienceView({
    marketingType: "promotion",
    metadata,
    registryKey,
    targetAudience: input.targetAudience
  });
  const promotionAudienceReadinessState = resolveMarketingPromotionAudienceReadinessState({
    audienceKey: audience.audienceKey,
    targetAudienceSummary: audience.targetAudienceSummary
  });

  return {
    audienceBadgeTone: audience.audienceBadgeTone,
    audienceDescription: audience.audienceDescription,
    audienceKey: audience.audienceKey,
    audienceLabel: audience.audienceLabel,
    promotionAudienceDescription: getMarketingPromotionAudienceReadinessDescription(
      promotionAudienceReadinessState
    ),
    promotionAudienceLabel: getMarketingPromotionAudienceReadinessLabel(promotionAudienceReadinessState),
    promotionAudienceReadinessState,
    targetAudienceSummary: audience.targetAudienceSummary
  };
}

export function resolveMarketingPromotionAudienceViewSafe(
  input: MarketingPromotionAudienceInput
): MarketingPromotionAudienceView & { targetAudienceSummary: string } {
  try {
    return resolveMarketingPromotionAudienceView(input);
  } catch (error) {
    console.error("[marketing-promotion-audience-runtime] audience view failed", error);

    return {
      audienceBadgeTone: "blue",
      audienceDescription: "Audience classification is descriptive only. No private user lists are exposed.",
      audienceKey: null,
      audienceLabel: "Custom audience",
      promotionAudienceDescription: getMarketingPromotionAudienceReadinessDescription("unknown"),
      promotionAudienceLabel: getMarketingPromotionAudienceReadinessLabel("unknown"),
      promotionAudienceReadinessState: "unknown",
      targetAudienceSummary: "Audience summary unavailable."
    };
  }
}

export function isValidMarketingPromotionAudienceReadinessState(
  value: unknown
): value is MarketingPromotionAudienceReadinessState {
  return (
    value === "classified" ||
    value === "custom" ||
    value === "unclassified" ||
    value === "unknown"
  );
}
