import {
  normalizeBuilderPageSchema,
  type BuilderPageSchema,
  type BuilderSectionSchema
} from "@/lib/storefront/builder";
import type { StoreTemplateRecord } from "@/lib/storefront/template-library";

export type AITemplateCustomizationInput = {
  brandTone: string;
  businessDescription: string;
  niche: string;
  targetAudience: string;
};

export type AITemplateCustomizationRequest = AITemplateCustomizationInput & {
  requestedAt: string;
  schemaVersion: number;
  templateId: string;
};

export type AITemplateSuggestionPreview = {
  branding: {
    accentColor: string;
    primaryColor: string;
    secondaryColor: string;
    tone: string;
  };
  copy: {
    ctaText: string;
    heroSubtitle: string;
    heroTitle: string;
  };
  layout: {
    improvementNotes: string[];
    suggestedSectionFocus: string;
  };
  prompt: string;
};

const allowedAudiences = new Set([
  "general_buyers",
  "young_adults",
  "premium_buyers",
  "local_customers",
  "families",
  "professionals"
]);
const allowedBrandTones = new Set(["modern", "luxury", "playful", "minimal", "bold", "natural"]);

function cleanText(value: unknown, fallback = "", maxLength = 260) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function pick(value: unknown, allowed: Set<string>, fallback: string) {
  const text = cleanText(value, fallback, 80).toLowerCase().replace(/\s+/g, "_");
  return allowed.has(text) ? text : fallback;
}

function colorFromTone(tone: string) {
  if (tone === "luxury") {
    return { accentColor: "#d97706", primaryColor: "#111827", secondaryColor: "#6b7280" };
  }

  if (tone === "playful") {
    return { accentColor: "#ec4899", primaryColor: "#7c3aed", secondaryColor: "#06b6d4" };
  }

  if (tone === "natural") {
    return { accentColor: "#84cc16", primaryColor: "#14532d", secondaryColor: "#65a30d" };
  }

  if (tone === "bold") {
    return { accentColor: "#ef4444", primaryColor: "#020617", secondaryColor: "#2563eb" };
  }

  return { accentColor: "#f59e0b", primaryColor: "#0f172a", secondaryColor: "#2563eb" };
}

export function validateCustomizationInput(input: Partial<AITemplateCustomizationInput>) {
  const niche = cleanText(input.niche, "", 120);
  const businessDescription = cleanText(input.businessDescription, "", 500);
  const errors: string[] = [];

  if (niche.length < 3) {
    errors.push("Enter a niche with at least 3 characters.");
  }

  if (businessDescription.length < 12) {
    errors.push("Enter a business description with at least 12 characters.");
  }

  return {
    errors,
    input: {
      brandTone: pick(input.brandTone, allowedBrandTones, "modern"),
      businessDescription,
      niche,
      targetAudience: pick(input.targetAudience, allowedAudiences, "general_buyers")
    }
  };
}

export function createAITemplateCustomization(
  templateId: string,
  input: Partial<AITemplateCustomizationInput>
): AITemplateCustomizationRequest {
  const validation = validateCustomizationInput(input);

  return {
    ...validation.input,
    requestedAt: new Date().toISOString(),
    schemaVersion: 1,
    templateId
  };
}

export function prepareTemplateCustomizationPrompt(
  request: AITemplateCustomizationRequest,
  template: StoreTemplateRecord
) {
  return [
    "Prepare a SHASTORE AI template customization plan.",
    `Template: ${template.name} (${template.id})`,
    `Niche: ${request.niche}`,
    `Business description: ${request.businessDescription}`,
    `Target audience: ${request.targetAudience}`,
    `Brand tone: ${request.brandTone}`,
    "Suggest branding adaptation, color palette, typography direction, hero copy, CTA copy, and layout improvements.",
    "Return JSON only. Do not call checkout, payments, provider APIs, image generation, or external systems."
  ].join("\n");
}

export function previewAIThemeChanges(
  request: AITemplateCustomizationRequest,
  template: StoreTemplateRecord
): AITemplateSuggestionPreview {
  const colors = colorFromTone(request.brandTone);
  const prompt = prepareTemplateCustomizationPrompt(request, template);

  return {
    branding: {
      ...colors,
      tone: request.brandTone
    },
    copy: {
      ctaText: request.targetAudience === "premium_buyers" ? "Shop the Collection" : "Start Shopping",
      heroSubtitle: `Curated for ${request.targetAudience.replace(/_/g, " ")} with ${request.brandTone} styling.`,
      heroTitle: `${request.niche} built for ${template.name}`
    },
    layout: {
      improvementNotes: [
        "Adapt hero messaging to business niche.",
        "Prioritize product discovery before secondary content.",
        "Keep responsive sections compatible with existing builder drafts."
      ],
      suggestedSectionFocus: "hero"
    },
    prompt
  };
}

function customizeSection(
  section: BuilderSectionSchema,
  suggestion: AITemplateSuggestionPreview,
  index: number
): BuilderSectionSchema {
  if (section.type === "hero" || index === 0) {
    return {
      ...section,
      props: {
        ...section.props,
        ctaText: suggestion.copy.ctaText,
        heading: suggestion.copy.heroTitle,
        subheading: suggestion.copy.heroSubtitle
      }
    };
  }

  if (section.type === "CTA") {
    return {
      ...section,
      props: {
        ...section.props,
        ctaText: suggestion.copy.ctaText
      }
    };
  }

  return section;
}

export function mapAIChangesToBuilderDraft(
  schema: BuilderPageSchema,
  suggestion: AITemplateSuggestionPreview
): BuilderPageSchema {
  const normalized = normalizeBuilderPageSchema(schema);

  return {
    ...normalized,
    sections: normalized.sections.map((section, index) =>
      customizeSection(section, suggestion, index)
    )
  };
}
