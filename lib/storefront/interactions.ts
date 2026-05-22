import type {
  BuilderPageSchema,
  BuilderResponsiveMode,
  BuilderSectionSchema,
  StoreBuilderState
} from "@/lib/storefront/builder";

export type BuilderDragState = {
  draggingSectionId: string | null;
  dropTargetSectionId: string | null;
  isDragging: boolean;
};

export type BuilderSelectionState = {
  activeEditingSectionId: string | null;
  focusedSectionId: string | null;
  hoveredSectionId: string | null;
  selectedSectionId: string | null;
};

export type BuilderInteractionState = {
  drag: BuilderDragState;
  mode: BuilderResponsiveMode;
  previewSync: {
    lastSyncedAt: string | null;
    pending: boolean;
    target: "draft" | "published";
  };
  reorder: {
    canReorder: boolean;
    pendingSectionOrder: string[];
  };
  selection: BuilderSelectionState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function responsiveMode(value: unknown): BuilderResponsiveMode {
  return value === "tablet" || value === "mobile" ? value : "desktop";
}

export function createBuilderInteractionState(state: StoreBuilderState): BuilderInteractionState {
  const editor = state.editorState as StoreBuilderState["editorState"] & {
    activeEditingSectionId?: unknown;
    draggingSectionId?: unknown;
    dropTargetSectionId?: unknown;
    focusedSectionId?: unknown;
    hoveredSectionId?: unknown;
    lastSyncedAt?: unknown;
    previewSyncPending?: unknown;
  };
  const selectedSectionId = textOrNull(editor.selectedSectionId);
  const sections = state.draftSchema.sections.length
    ? state.draftSchema.sections
    : state.pageSchema.sections;

  return {
    drag: {
      draggingSectionId: textOrNull(editor.draggingSectionId),
      dropTargetSectionId: textOrNull(editor.dropTargetSectionId),
      isDragging: Boolean(editor.draggingSectionId)
    },
    mode: responsiveMode(editor.mode),
    previewSync: {
      lastSyncedAt: textOrNull(editor.lastSyncedAt),
      pending: Boolean(editor.previewSyncPending),
      target: state.status === "published" ? "published" : "draft"
    },
    reorder: {
      canReorder: sections.length > 1,
      pendingSectionOrder: sections
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((section) => section.id)
    },
    selection: {
      activeEditingSectionId: textOrNull(editor.activeEditingSectionId) ?? selectedSectionId,
      focusedSectionId: textOrNull(editor.focusedSectionId),
      hoveredSectionId: textOrNull(editor.hoveredSectionId),
      selectedSectionId
    }
  };
}

export function reorderSections(
  schema: BuilderPageSchema,
  fromSectionId: string,
  toSectionId: string
): BuilderPageSchema {
  const fromIndex = schema.sections.findIndex((section) => section.id === fromSectionId);
  const toIndex = schema.sections.findIndex((section) => section.id === toSectionId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return schema;
  }

  const sections = schema.sections.slice();
  const [movingSection] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, movingSection);

  return {
    ...schema,
    sections: sections.map((section, index) => ({
      ...section,
      order: index
    }))
  };
}

export function selectSection(
  state: BuilderInteractionState,
  sectionId: string | null
): BuilderInteractionState {
  return {
    ...state,
    selection: {
      ...state.selection,
      activeEditingSectionId: sectionId,
      focusedSectionId: sectionId,
      selectedSectionId: sectionId
    }
  };
}

export function sectionInteractionAttributes(
  section: BuilderSectionSchema,
  state: BuilderInteractionState
) {
  const selected = state.selection.selectedSectionId === section.id;
  const hovered = state.selection.hoveredSectionId === section.id;
  const focused = state.selection.focusedSectionId === section.id;

  return {
    "data-builder-dragging": state.drag.draggingSectionId === section.id ? "true" : "false",
    "data-builder-focused": focused ? "true" : "false",
    "data-builder-hovered": hovered ? "true" : "false",
    "data-builder-section-id": section.id,
    "data-builder-selected": selected ? "true" : "false",
    draggable: true
  };
}

export function getPreviewSyncPayload(
  state: StoreBuilderState,
  interactionState = createBuilderInteractionState(state)
) {
  const schema = state.publishedSchema ?? state.pageSchema;

  return {
    interaction: interactionState,
    schemaVersion: schema.version,
    sectionCount: schema.sections.length,
    storeInstanceId: state.store_instance_id,
    syncTarget: interactionState.previewSync.target
  };
}

export function normalizeInteractionState(value: unknown, state: StoreBuilderState) {
  if (!isRecord(value)) {
    return createBuilderInteractionState(state);
  }

  return {
    ...createBuilderInteractionState(state),
    mode: responsiveMode(value.mode)
  };
}
