import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";

export type BuilderVersionDiff = {
  addedSections: string[];
  orderChanged: boolean;
  removedSections: string[];
  sectionCountDelta: number;
  settingsChanged: boolean;
};

export function compareBuilderVersions(
  leftSchema: BuilderPageSchema | null,
  rightSchema: BuilderPageSchema | null
): BuilderVersionDiff {
  const left = leftSchema ? normalizeBuilderPageSchema(leftSchema) : normalizeBuilderPageSchema(null);
  const right = rightSchema ? normalizeBuilderPageSchema(rightSchema) : normalizeBuilderPageSchema(null);
  const leftIds = left.sections.map((section) => section.id);
  const rightIds = right.sections.map((section) => section.id);

  return {
    addedSections: rightIds.filter((id) => !leftIds.includes(id)),
    orderChanged: leftIds.join("|") !== rightIds.join("|"),
    removedSections: leftIds.filter((id) => !rightIds.includes(id)),
    sectionCountDelta: right.sections.length - left.sections.length,
    settingsChanged: JSON.stringify(left.sections.map((section) => section.props)) !==
      JSON.stringify(right.sections.map((section) => section.props))
  };
}

export function validateRollbackSafety({
  currentStoreId,
  snapshotStoreId,
  targetSchema
}: {
  currentStoreId: string;
  snapshotStoreId: string;
  targetSchema: BuilderPageSchema | null;
}) {
  const schema = targetSchema ? normalizeBuilderPageSchema(targetSchema) : null;

  if (currentStoreId !== snapshotStoreId) {
    return { error: "Snapshot belongs to a different store.", valid: false };
  }

  if (!schema || !schema.sections.length) {
    return { error: "Snapshot has no valid builder sections.", valid: false };
  }

  return { error: null, valid: true };
}

export function layoutDiffPreparation(
  previousSchema: BuilderPageSchema | null,
  nextSchema: BuilderPageSchema | null
) {
  const diff = compareBuilderVersions(previousSchema, nextSchema);

  return {
    ...diff,
    preparedAt: new Date().toISOString(),
    visualDiffReady: false
  };
}
