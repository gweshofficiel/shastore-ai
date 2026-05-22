import { sanitizeAIOutput, validateOpenAIJSON } from "@/lib/openai-execution";
import {
  mapAIChangesToBuilderDraft,
  type AITemplateSuggestionPreview
} from "@/lib/ai-template-customization";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";

const allowedPatchFields = new Set([
  "branding",
  "copy",
  "layout",
  "sectionCopy",
  "heroText",
  "ctaText",
  "colorPalette",
  "typography"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sectionSignature(schema: BuilderPageSchema) {
  return schema.sections.map((section) => ({
    id: section.id,
    order: section.order,
    props: section.props,
    type: section.type
  }));
}

export function validateAISuggestionPatch(value: unknown) {
  const record = isRecord(value) ? value : {};
  const blockedFields = Object.keys(record).filter((key) => !allowedPatchFields.has(key));
  const openAIValidation = validateOpenAIJSON(record);
  const errors = [...openAIValidation.errors];

  if (blockedFields.length) {
    errors.push("AI suggestion includes blocked patch fields.");
  }

  return {
    blockedFields,
    errors,
    safePatch: sanitizeAIOutput(record),
    valid: errors.length === 0
  };
}

export function previewAIChanges(currentDraft: BuilderPageSchema, suggestion: unknown) {
  const before = normalizeBuilderPageSchema(currentDraft);
  const validation = validateAISuggestionPatch(suggestion);
  const after = validation.valid
    ? applyAISuggestionToDraft(before, validation.safePatch)
    : before;

  return {
    after,
    before,
    blockedPatch: validation.blockedFields,
    diffSummary: {
      beforeSections: before.sections.length,
      copyChanged: JSON.stringify(sectionSignature(before)) !== JSON.stringify(sectionSignature(after)),
      layoutRecommendationsReady: validation.valid,
      sectionCountChanged: after.sections.length - before.sections.length
    },
    errors: validation.errors,
    safePatch: validation.safePatch
  };
}

export function applyAISuggestionToDraft(
  currentDraft: BuilderPageSchema,
  suggestion: AITemplateSuggestionPreview
) {
  return mapAIChangesToBuilderDraft(normalizeBuilderPageSchema(currentDraft), suggestion);
}

export function rejectAISuggestion(reason = "User rejected AI suggestion.") {
  return {
    rejectedAt: new Date().toISOString(),
    reason,
    status: "rejected"
  };
}

export function createAIDraftSnapshot(schema: BuilderPageSchema, metadata: Record<string, unknown> = {}) {
  const normalized = normalizeBuilderPageSchema(schema);

  return {
    metadata,
    schema: normalized,
    snapshotAt: new Date().toISOString()
  };
}

export function rollbackAIApplication(snapshot: unknown) {
  const record = isRecord(snapshot) ? snapshot : {};

  return normalizeBuilderPageSchema(record.schema);
}
