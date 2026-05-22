import OpenAI from "openai";
import {
  mapAIChangesToBuilderDraft,
  type AITemplateSuggestionPreview
} from "@/lib/ai-template-customization";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";

export type ControlledOpenAIRequest = {
  model: string;
  prompt: string;
  timeoutMs?: number;
};

export type ControlledOpenAIResult = {
  error: string | null;
  rawOutput: Record<string, unknown>;
  status: "blocked" | "failed" | "succeeded";
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
};

const allowedTopLevelKeys = new Set(["branding", "copy", "layout", "sectionCopy"]);
const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, fallback = "", maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function cleanColor(value: unknown, fallback: string) {
  const text = cleanText(value, fallback, 24);
  return hexPattern.test(text) ? text : fallback;
}

export async function executeOpenAIRequest(
  request: ControlledOpenAIRequest
): Promise<ControlledOpenAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      error: "OPENAI_API_KEY is not configured.",
      rawOutput: {},
      status: "blocked",
      tokenUsage: { input: 0, output: 0, total: 0 }
    };
  }

  try {
    const client = new OpenAI({ apiKey, timeout: request.timeoutMs ?? 20000 });
    const completion = await client.chat.completions.create({
      messages: [
        {
          content: [
            "You are SHASTORE AI controlled customization engine.",
            "Return JSON only with allowed keys: branding, copy, layout, sectionCopy.",
            "Never include SQL, code execution instructions, publishing commands, credentials, checkout, payment, or deletion actions.",
            request.prompt
          ].join("\n"),
          role: "user"
        }
      ],
      model: request.model,
      response_format: { type: "json_object" },
      temperature: 0.4
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as unknown;

    return {
      error: null,
      rawOutput: isRecord(parsed) ? parsed : {},
      status: "succeeded",
      tokenUsage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
        total: completion.usage?.total_tokens ?? 0
      }
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "OpenAI execution failed.",
      rawOutput: {},
      status: "failed",
      tokenUsage: { input: 0, output: 0, total: 0 }
    };
  }
}

export function sanitizeAIOutput(value: unknown): AITemplateSuggestionPreview {
  const record = isRecord(value) ? value : {};
  const branding = isRecord(record.branding) ? record.branding : {};
  const copy = isRecord(record.copy) ? record.copy : {};
  const layout = isRecord(record.layout) ? record.layout : {};

  return {
    branding: {
      accentColor: cleanColor(branding.accentColor, "#f59e0b"),
      primaryColor: cleanColor(branding.primaryColor, "#0f172a"),
      secondaryColor: cleanColor(branding.secondaryColor, "#2563eb"),
      tone: cleanText(branding.tone, "modern", 80)
    },
    copy: {
      ctaText: cleanText(copy.ctaText, "Start Shopping", 80),
      heroSubtitle: cleanText(copy.heroSubtitle, "AI-assisted storefront copy preview.", 220),
      heroTitle: cleanText(copy.heroTitle, "AI-assisted storefront", 120)
    },
    layout: {
      improvementNotes: Array.isArray(layout.improvementNotes)
        ? layout.improvementNotes
            .map((note) => cleanText(note, "", 160))
            .filter(Boolean)
            .slice(0, 5)
        : ["Keep AI changes draft-only and review before publish."],
      suggestedSectionFocus: cleanText(layout.suggestedSectionFocus, "hero", 80)
    },
    prompt: cleanText(record.prompt, "Controlled OpenAI customization output.", 500)
  };
}

export function validateOpenAIJSON(value: unknown) {
  const record = isRecord(value) ? value : {};
  const errors: string[] = [];
  const blockedFields = Object.keys(record).filter((key) => !allowedTopLevelKeys.has(key));

  if (blockedFields.length) {
    errors.push("AI response included blocked fields.");
  }

  const sanitized = sanitizeAIOutput(record);

  if (!sanitized.copy.heroTitle || !sanitized.copy.ctaText) {
    errors.push("AI response must include safe hero and CTA copy.");
  }

  return {
    blockedFields,
    errors,
    sanitized,
    valid: errors.length === 0
  };
}

export function mapOpenAIResponseToDraft(
  schema: BuilderPageSchema,
  response: unknown
): BuilderPageSchema {
  const validation = validateOpenAIJSON(response);

  if (!validation.valid) {
    return normalizeBuilderPageSchema(schema);
  }

  return mapAIChangesToBuilderDraft(normalizeBuilderPageSchema(schema), validation.sanitized);
}

export async function retryOpenAIExecution(
  request: ControlledOpenAIRequest,
  maxAttempts = 2
): Promise<ControlledOpenAIResult & { attempts: number }> {
  let attempts = 0;
  let result: ControlledOpenAIResult = {
    error: "OpenAI execution did not run.",
    rawOutput: {},
    status: "failed",
    tokenUsage: { input: 0, output: 0, total: 0 }
  };

  while (attempts < maxAttempts) {
    attempts += 1;
    result = await executeOpenAIRequest(request);

    if (result.status === "succeeded" || result.status === "blocked") {
      break;
    }
  }

  return { ...result, attempts };
}

export function createAIExecutionLog({
  prompt,
  status
}: {
  prompt: string;
  status: ControlledOpenAIResult["status"] | "prepared" | "running";
}) {
  return {
    blockedActions: [
      "direct_publish",
      "direct_database_mutation",
      "direct_theme_overwrite",
      "section_deletion",
      "unsafe_schema_injection"
    ],
    promptPreview: prompt.slice(0, 4000),
    safeActions: [
      "branding_suggestions",
      "color_palette_suggestions",
      "hero_copywriting",
      "cta_suggestions",
      "section_copy_suggestions",
      "niche_adaptation",
      "layout_recommendations"
    ],
    status
  };
}
