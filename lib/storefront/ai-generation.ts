import type { BuilderPageSchema, BuilderSectionSchema } from "@/lib/storefront/builder";

export type AIStoreGenerationInput = {
  brandStyle: string;
  language: string;
  layoutIntent: string;
  niche: string;
  storeType: string;
  targetAudience: string;
};

export type AIStoreGenerationRequest = AIStoreGenerationInput & {
  requestedAt: string;
  schemaVersion: number;
};

export type GeneratedBrandingSchema = {
  accentColor: string;
  logoPrompt: string;
  primaryColor: string;
  secondaryColor: string;
  tone: string;
};

export type GeneratedStoreSchema = {
  branding: GeneratedBrandingSchema;
  layout: BuilderPageSchema;
  sections: BuilderSectionSchema[];
  store: {
    description: string;
    language: string;
    niche: string;
    title: string;
    type: string;
  };
};

const allowedStoreTypes = new Set(["general", "fashion", "beauty", "food", "digital", "services", "home"]);
const allowedLanguages = new Set(["en", "ar", "fr", "es", "pt"]);
const allowedBrandStyles = new Set(["modern", "luxury", "playful", "minimal", "bold", "natural"]);
const allowedLayoutIntents = new Set(["conversion", "catalog", "brand_story", "launch", "lead_capture"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, fallback = "", maxLength = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function colorValue(value: unknown, fallback: string) {
  const text = cleanText(value, fallback, 16);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : fallback;
}

function pick(value: unknown, allowed: Set<string>, fallback: string) {
  const text = cleanText(value, fallback, 80).toLowerCase().replace(/\s+/g, "_");
  return allowed.has(text) ? text : fallback;
}

export function validateAIStoreGenerationInput(input: Partial<AIStoreGenerationInput>) {
  const niche = cleanText(input.niche, "", 120);
  const targetAudience = cleanText(input.targetAudience, "General online buyers", 180);

  return {
    errors: niche.length < 3 ? ["Enter a niche with at least 3 characters."] : [],
    input: {
      brandStyle: pick(input.brandStyle, allowedBrandStyles, "modern"),
      language: pick(input.language, allowedLanguages, "en"),
      layoutIntent: pick(input.layoutIntent, allowedLayoutIntents, "conversion"),
      niche,
      storeType: pick(input.storeType, allowedStoreTypes, "general"),
      targetAudience
    }
  };
}

export function createAIStoreGenerationRequest(
  input: Partial<AIStoreGenerationInput>
): AIStoreGenerationRequest {
  const validation = validateAIStoreGenerationInput(input);

  return {
    ...validation.input,
    requestedAt: new Date().toISOString(),
    schemaVersion: 1
  };
}

export function prepareStoreGenerationPrompt(request: AIStoreGenerationRequest) {
  return [
    "Prepare a SHASTORE AI storefront generation plan.",
    `Niche: ${request.niche}`,
    `Store type: ${request.storeType}`,
    `Language: ${request.language}`,
    `Target audience: ${request.targetAudience}`,
    `Brand style: ${request.brandStyle}`,
    `Layout intent: ${request.layoutIntent}`,
    "Return JSON only with store, branding, layout, and sections.",
    "Do not include checkout, payments, provider credentials, or generated image binaries."
  ].join("\n");
}

function normalizeGeneratedSection(value: unknown, index: number): BuilderSectionSchema | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = cleanText(value.type || value.section_type, "rich_text", 80) as BuilderSectionSchema["type"];
  const allowedTypes = new Set([
    "hero",
    "banner",
    "product_grid",
    "featured_products",
    "rich_text",
    "image",
    "CTA",
    "testimonials",
    "newsletter",
    "spacer"
  ]);

  if (!allowedTypes.has(type)) {
    return null;
  }

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    id: cleanText(value.id, `ai-section-${index + 1}`, 80),
    order: typeof value.order === "number" ? value.order : index,
    position: isRecord(value.position) ? value.position : {},
    props: isRecord(value.props) ? value.props : isRecord(value.config) ? value.config : {},
    responsive: isRecord(value.responsive)
      ? {
          desktop: isRecord(value.responsive.desktop) ? value.responsive.desktop : {},
          mobile: isRecord(value.responsive.mobile) ? value.responsive.mobile : {},
          tablet: isRecord(value.responsive.tablet) ? value.responsive.tablet : {}
        }
      : {
          desktop: {},
          mobile: {},
          tablet: {}
        },
    type
  };
}

export function normalizeGeneratedStoreSchema(value: unknown): GeneratedStoreSchema {
  const record = isRecord(value) ? value : {};
  const branding = isRecord(record.branding) ? record.branding : {};
  const store = isRecord(record.store) ? record.store : {};
  const sections = Array.isArray(record.sections)
    ? record.sections
        .map(normalizeGeneratedSection)
        .filter((section): section is BuilderSectionSchema => Boolean(section))
    : [];

  return {
    branding: {
      accentColor: colorValue(branding.accentColor, "#f59e0b"),
      logoPrompt: cleanText(branding.logoPrompt, "Simple store wordmark", 240),
      primaryColor: colorValue(branding.primaryColor, "#0f172a"),
      secondaryColor: colorValue(branding.secondaryColor, "#2563eb"),
      tone: cleanText(branding.tone, "modern", 80)
    },
    layout: {
      layoutTree: isRecord(record.layoutTree) ? record.layoutTree : { root: { children: sections.map((section) => section.id) } },
      responsive: {
        desktop: {},
        mobile: {},
        tablet: {}
      },
      sections,
      version: 1
    },
    sections,
    store: {
      description: cleanText(store.description, "AI-generated store concept placeholder.", 300),
      language: cleanText(store.language, "en", 12),
      niche: cleanText(store.niche, "General store", 120),
      title: cleanText(store.title, "AI Store Concept", 120),
      type: cleanText(store.type, "general", 80)
    }
  };
}

export function mapAISchemaToBuilderDraft(schema: GeneratedStoreSchema): BuilderPageSchema {
  return {
    layoutTree: schema.layout.layoutTree,
    responsive: schema.layout.responsive,
    sections: schema.sections,
    version: schema.layout.version
  };
}

export function aiGenerationStatusLabel(status: unknown) {
  const text = cleanText(status, "draft", 40);
  return text.replace(/_/g, " ");
}
