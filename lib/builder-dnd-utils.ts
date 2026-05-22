export type DraftSectionOrderItem = {
  id: string;
  section_key: string;
  section_order: number;
};

export type SectionMoveValidation = {
  error: string | null;
  valid: boolean;
};

export function calculateDropIndex({
  currentIndex,
  position,
  targetIndex,
  total
}: {
  currentIndex: number;
  position: "before" | "after";
  targetIndex: number;
  total: number;
}) {
  if (currentIndex < 0 || targetIndex < 0 || currentIndex >= total || targetIndex >= total) {
    return -1;
  }

  const intendedIndex = position === "before" ? targetIndex : targetIndex + 1;
  const adjustedIndex = currentIndex < intendedIndex ? intendedIndex - 1 : intendedIndex;

  return Math.max(0, Math.min(adjustedIndex, total - 1));
}

export function validateSectionMove({
  currentIndex,
  targetIndex,
  total
}: {
  currentIndex: number;
  targetIndex: number;
  total: number;
}): SectionMoveValidation {
  if (total <= 1) {
    return { error: "At least two sections are required to move sections.", valid: false };
  }

  if (currentIndex < 0) {
    return { error: "Moving section was not found.", valid: false };
  }

  if (targetIndex < 0 || targetIndex >= total) {
    return { error: "Drop target is outside the draft section list.", valid: false };
  }

  if (currentIndex === targetIndex) {
    return { error: "Section is already in that position.", valid: false };
  }

  return { error: null, valid: true };
}

export function moveDraftSection(
  sections: DraftSectionOrderItem[],
  sectionId: string,
  dropIndex: number
) {
  const currentIndex = sections.findIndex((section) => section.id === sectionId);

  if (currentIndex < 0 || dropIndex < 0 || dropIndex >= sections.length) {
    return sections;
  }

  const reordered = sections.slice();
  const [movingSection] = reordered.splice(currentIndex, 1);
  reordered.splice(dropIndex, 0, movingSection);

  return reordered.map((section, index) => ({
    ...section,
    section_order: index * 10 + 10
  }));
}

export function persistSectionOrder(sections: DraftSectionOrderItem[]) {
  return sections.map((section, index) => ({
    id: section.id,
    section_order: index * 10 + 10
  }));
}

export function rollbackSectionMove(previousSections: DraftSectionOrderItem[]) {
  return persistSectionOrder(previousSections);
}

export function syncBuilderPreviewState(sections: DraftSectionOrderItem[]) {
  return {
    hydrationSafe: true,
    lastMoveAt: new Date().toISOString(),
    noFlicker: true,
    orderedSectionKeys: sections.map((section) => section.section_key),
    previewTarget: "draft",
    sectionCount: sections.length
  };
}
