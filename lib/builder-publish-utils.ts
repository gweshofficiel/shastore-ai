import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";

export function validateDraftBeforePublish(schema: BuilderPageSchema) {
  const normalized = normalizeBuilderPageSchema(schema);
  const enabledSections = normalized.sections.filter((section) => section.enabled);

  return {
    errors: enabledSections.length ? [] : ["Draft must contain at least one visible section."],
    schema: normalized
  };
}

export function compareDraftVsPublished(
  draftSchema: BuilderPageSchema,
  publishedSchema: BuilderPageSchema | null
) {
  const draft = normalizeBuilderPageSchema(draftSchema);
  const published = publishedSchema ? normalizeBuilderPageSchema(publishedSchema) : null;
  const draftSectionIds = draft.sections.map((section) => section.id);
  const publishedSectionIds = published?.sections.map((section) => section.id) ?? [];

  return {
    draftSectionCount: draft.sections.length,
    hasPublishedVersion: Boolean(published),
    orderChanged: published
      ? draftSectionIds.join("|") !== publishedSectionIds.join("|")
      : draft.sections.length > 0,
    publishedSectionCount: published?.sections.length ?? 0,
    schemaChanged: published ? JSON.stringify(draft) !== JSON.stringify(published) : true
  };
}
