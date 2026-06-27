import "server-only";

import { isBlockedCanonicalPath, SEO_CANONICAL_MAX_LENGTH } from "@/src/lib/seo/seo-canonical-runtime";
import { normalizeSeoLanguage, SEO_LANGUAGE_MAX_LENGTH } from "@/src/lib/seo/seo-language-runtime";
import { SEO_META_DESCRIPTION_MAX_LENGTH } from "@/src/lib/seo/seo-meta-description-runtime";
import { SEO_META_TITLE_MAX_LENGTH } from "@/src/lib/seo/seo-meta-title-runtime";

export type AiSeoRuntimeStatus = "ai_ready" | "invalid" | "placeholder";

export type AiSeoGeneratorPlaceholder = {
  canonicalSuggestion: string;
  generated: false;
  keywordFocus: string;
  language: string;
  message: string;
  metaDescriptionSuggestion: string;
  metaTitleSuggestion: string;
  readOnly: true;
  source: "seo_ai_runtime";
  targetPage: string;
};

export type AiSeoInput = {
  canonicalSuggestion?: unknown;
  keywordFocus?: unknown;
  language?: unknown;
  metaDescriptionSuggestion?: unknown;
  metaTitleSuggestion?: unknown;
  targetPage?: unknown;
};

export type AiSeoInputValidation = {
  isValid: boolean;
  issues: string[];
  normalizedInput: {
    canonicalSuggestion: string;
    keywordFocus: string;
    language: string;
    metaDescriptionSuggestion: string;
    metaTitleSuggestion: string;
    targetPage: string;
  } | null;
};

export type AiSeoSummary = {
  readOnly: true;
  runtimeStatus: AiSeoRuntimeStatus;
  summary: string;
};

export type AiSeoRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export type AiSeoFutureField = {
  description: string;
  id:
    | "canonicalSuggestion"
    | "keywordFocus"
    | "language"
    | "metaDescriptionSuggestion"
    | "metaTitleSuggestion"
    | "targetPage";
  implemented: false;
  label: string;
};

export const AI_SEO_HOOK_LABEL = "AI SEO generator" as const;
export const AI_SEO_SOURCE = "seo_ai_runtime" as const;
export const AI_SEO_KEYWORD_FOCUS_MAX_LENGTH = 120 as const;
export const AI_SEO_NOT_CONNECTED_MESSAGE =
  "AI SEO generation is reserved for a later secure phase. No AI provider calls, prompts, tokens, or suggestions are enabled." as const;

const SAFE_LANGUAGE_CODES = ["ar", "en", "fr"] as const;

const PRIVATE_ROUTE_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

const AI_SEO_FUTURE_FIELDS: readonly AiSeoFutureField[] = [
  {
    description: "Future target public SEO page route for AI suggestions.",
    id: "targetPage",
    implemented: false,
    label: "Target page"
  },
  {
    description: "Future AI-generated meta title suggestion placeholder.",
    id: "metaTitleSuggestion",
    implemented: false,
    label: "Meta title suggestion"
  },
  {
    description: "Future AI-generated meta description suggestion placeholder.",
    id: "metaDescriptionSuggestion",
    implemented: false,
    label: "Meta description suggestion"
  },
  {
    description: "Future keyword focus placeholder for AI SEO generation.",
    id: "keywordFocus",
    implemented: false,
    label: "Keyword focus"
  },
  {
    description: "Future AI-generated canonical path suggestion placeholder.",
    id: "canonicalSuggestion",
    implemented: false,
    label: "Canonical suggestion"
  },
  {
    description: "Future language context for AI SEO generation.",
    id: "language",
    implemented: false,
    label: "Language"
  }
] as const;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isPrivateRoute(path: string) {
  const normalized = path.toLowerCase();
  return PRIVATE_ROUTE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function validateTargetPage(value: unknown, issues: string[]) {
  const cleaned = text(value, SEO_CANONICAL_MAX_LENGTH);

  if (!cleaned) {
    issues.push("Target page cannot be empty.");
    return "";
  }

  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  if (!normalized.startsWith("/")) {
    issues.push('Target page must start with "/".');
  }

  if (isBlockedCanonicalPath(normalized)) {
    issues.push("Target page cannot use admin, api, or dashboard routes.");
  }

  if (isPrivateRoute(normalized)) {
    issues.push("Target page cannot use private tenant or account routes.");
  }

  return normalized;
}

function validateOptionalMetaTitle(value: unknown, issues: string[]) {
  const cleaned = text(value, SEO_META_TITLE_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  if (cleaned.length > SEO_META_TITLE_MAX_LENGTH) {
    issues.push(`Meta title suggestion exceeds ${SEO_META_TITLE_MAX_LENGTH} characters.`);
  }

  return cleaned;
}

function validateOptionalMetaDescription(value: unknown, issues: string[]) {
  const cleaned = text(value, SEO_META_DESCRIPTION_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  if (cleaned.length > SEO_META_DESCRIPTION_MAX_LENGTH) {
    issues.push(`Meta description suggestion exceeds ${SEO_META_DESCRIPTION_MAX_LENGTH} characters.`);
  }

  return cleaned;
}

function validateOptionalKeywordFocus(value: unknown, issues: string[]) {
  const cleaned = text(value, AI_SEO_KEYWORD_FOCUS_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  if (cleaned.length > AI_SEO_KEYWORD_FOCUS_MAX_LENGTH) {
    issues.push(`Keyword focus exceeds ${AI_SEO_KEYWORD_FOCUS_MAX_LENGTH} characters.`);
  }

  return cleaned;
}

function validateOptionalCanonicalSuggestion(value: unknown, issues: string[]) {
  const cleaned = text(value, SEO_CANONICAL_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  if (!normalized.startsWith("/")) {
    issues.push('Canonical suggestion must start with "/".');
  }

  if (isBlockedCanonicalPath(normalized)) {
    issues.push("Canonical suggestion cannot use admin, api, or dashboard routes.");
  }

  if (isPrivateRoute(normalized)) {
    issues.push("Canonical suggestion cannot use private tenant or account routes.");
  }

  return normalized;
}

function validateOptionalLanguage(value: unknown, issues: string[]) {
  const cleaned = text(value, SEO_LANGUAGE_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  const normalized = normalizeSeoLanguage(cleaned);

  if (!SAFE_LANGUAGE_CODES.includes(normalized as (typeof SAFE_LANGUAGE_CODES)[number])) {
    issues.push("Language must use a safe platform language code (en, fr, ar).");
  }

  return normalized;
}

export function getAiSeoGeneratorPlaceholder(): AiSeoGeneratorPlaceholder {
  return {
    canonicalSuggestion: "",
    generated: false,
    keywordFocus: "",
    language: "",
    message: AI_SEO_NOT_CONNECTED_MESSAGE,
    metaDescriptionSuggestion: "",
    metaTitleSuggestion: "",
    readOnly: true,
    source: AI_SEO_SOURCE,
    targetPage: ""
  };
}

export function validateAiSeoInput(input: AiSeoInput = {}): AiSeoInputValidation {
  const issues: string[] = [];
  const targetPage = validateTargetPage(input.targetPage, issues);
  const metaTitleSuggestion = validateOptionalMetaTitle(input.metaTitleSuggestion, issues);
  const metaDescriptionSuggestion = validateOptionalMetaDescription(input.metaDescriptionSuggestion, issues);
  const keywordFocus = validateOptionalKeywordFocus(input.keywordFocus, issues);
  const canonicalSuggestion = validateOptionalCanonicalSuggestion(input.canonicalSuggestion, issues);
  const language = validateOptionalLanguage(input.language, issues);

  if (issues.length > 0) {
    return {
      isValid: false,
      issues,
      normalizedInput: null
    };
  }

  return {
    isValid: true,
    issues: [],
    normalizedInput: {
      canonicalSuggestion,
      keywordFocus,
      language,
      metaDescriptionSuggestion,
      metaTitleSuggestion,
      targetPage
    }
  };
}

export function validateAiSeoRuntime(
  placeholder: AiSeoGeneratorPlaceholder = getAiSeoGeneratorPlaceholder()
): AiSeoRuntimeValidation {
  const issues: string[] = [];

  if (!placeholder.readOnly) {
    issues.push("AI SEO runtime must remain read-only.");
  }

  if (placeholder.generated !== false) {
    issues.push("AI SEO runtime must not generate suggestions in this phase.");
  }

  if (placeholder.source !== AI_SEO_SOURCE) {
    issues.push("AI SEO runtime must originate from the AI SEO runtime source.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getAiSeoRuntimeStatus(
  placeholder: AiSeoGeneratorPlaceholder = getAiSeoGeneratorPlaceholder()
): AiSeoRuntimeStatus {
  const validation = validateAiSeoRuntime(placeholder);

  if (!validation.isValid) {
    return "invalid";
  }

  if (placeholder.generated !== false) {
    return "invalid";
  }

  return "placeholder";
}

export function getAiSeoSummary(
  fields: AiSeoFutureField[] = [...AI_SEO_FUTURE_FIELDS]
): AiSeoSummary {
  const placeholder = getAiSeoGeneratorPlaceholder();
  const runtimeStatus = getAiSeoRuntimeStatus(placeholder);

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `${fields.length} future AI field(s)`,
      "0 generated",
      "validation-only",
      "no AI provider calls"
    ].join("; ")
  };
}

export function mapAiSeoRuntimeToAdminFields() {
  const placeholder = getAiSeoGeneratorPlaceholder();
  const validation = validateAiSeoRuntime(placeholder);
  const aiSummary = getAiSeoSummary();

  return {
    futureFields: [...AI_SEO_FUTURE_FIELDS],
    hookLabel: AI_SEO_HOOK_LABEL,
    message: placeholder.message,
    readOnly: true,
    runtimeStatus: validation.isValid ? aiSummary.runtimeStatus : "placeholder",
    summary: validation.isValid ? aiSummary.summary : "AI SEO runtime validation requires safe read-only defaults."
  };
}

// SEO-26+ placeholders: AI provider integration, apply suggestions, and persistence stay disconnected.
export const AI_SEO_FUTURE_HOOKS = ["ai_seo_provider", "ai_seo_apply", "ai_seo_persistence"] as const;
