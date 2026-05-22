import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreSection, StoreSectionType } from "@/lib/storefront/sections";
import { createBuilderInteractionState, getPreviewSyncPayload } from "@/lib/storefront/interactions";
import { resolveBuilderPersistence } from "@/lib/storefront/builder-persistence";

export type BuilderResponsiveMode = "desktop" | "tablet" | "mobile";
export type BuilderStatus = "draft" | "published" | "archived";

export type BuilderSectionSchema = {
  id: string;
  type: StoreSectionType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
  responsive: Partial<Record<BuilderResponsiveMode, Record<string, unknown>>>;
  position: {
    column?: number;
    row?: number;
  };
};

export type BuilderPageSchema = {
  version: number;
  sections: BuilderSectionSchema[];
  layoutTree: Record<string, unknown>;
  responsive: Record<BuilderResponsiveMode, Record<string, unknown>>;
};

export type VisualEditorState = {
  mode: BuilderResponsiveMode;
  selectedSectionId: string | null;
  status: BuilderStatus;
};

export type StoreBuilderState = {
  id: string | null;
  store_instance_id: string;
  owner_user_id: string | null;
  status: BuilderStatus;
  pageSchema: BuilderPageSchema;
  draftSchema: BuilderPageSchema;
  publishedSchema: BuilderPageSchema | null;
  editorState: VisualEditorState;
};

const supportedSectionTypes: StoreSectionType[] = [
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
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function responsiveMode(value: unknown): BuilderResponsiveMode {
  return value === "tablet" || value === "mobile" ? value : "desktop";
}

function defaultSchema(): BuilderPageSchema {
  return {
    layoutTree: { root: { children: [] } },
    responsive: {
      desktop: {},
      mobile: {},
      tablet: {}
    },
    sections: [],
    version: 1
  };
}

function normalizeSectionSchema(value: unknown): BuilderSectionSchema | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = textValue(value.type || value.section_type) as StoreSectionType;

  if (!supportedSectionTypes.includes(type)) {
    return null;
  }

  const responsive = isRecord(value.responsive) ? value.responsive : {};

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    id: textValue(value.id, crypto.randomUUID()),
    order: numberValue(value.order || value.section_order),
    position: isRecord(value.position) ? value.position : {},
    props: isRecord(value.props) ? value.props : isRecord(value.config) ? value.config : {},
    responsive: {
      desktop: isRecord(responsive.desktop) ? responsive.desktop : {},
      mobile: isRecord(responsive.mobile) ? responsive.mobile : {},
      tablet: isRecord(responsive.tablet) ? responsive.tablet : {}
    },
    type
  };
}

export function normalizeBuilderPageSchema(value: unknown): BuilderPageSchema {
  if (!isRecord(value)) {
    return defaultSchema();
  }

  const responsive = isRecord(value.responsive) ? value.responsive : {};

  return {
    layoutTree: isRecord(value.layoutTree)
      ? value.layoutTree
      : isRecord(value.layout_tree)
        ? value.layout_tree
        : { root: { children: [] } },
    responsive: {
      desktop: isRecord(responsive.desktop) ? responsive.desktop : {},
      mobile: isRecord(responsive.mobile) ? responsive.mobile : {},
      tablet: isRecord(responsive.tablet) ? responsive.tablet : {}
    },
    sections: Array.isArray(value.sections)
      ? value.sections
          .map(normalizeSectionSchema)
          .filter((section): section is BuilderSectionSchema => Boolean(section))
      : [],
    version: numberValue(value.version, 1)
  };
}

function normalizeBuilderState(value: unknown, context: StoreTenantContext): StoreBuilderState {
  if (!isRecord(value)) {
    return {
      draftSchema: defaultSchema(),
      editorState: {
        mode: "desktop",
        selectedSectionId: null,
        status: "draft"
      },
      id: null,
      owner_user_id: context.owner_user_id,
      pageSchema: defaultSchema(),
      publishedSchema: null,
      status: "draft",
      store_instance_id: context.store_instance_id
    };
  }

  const editorState = isRecord(value.editor_state) ? value.editor_state : {};
  const status =
    value.status === "published" || value.status === "archived" ? value.status : "draft";

  return {
    draftSchema: normalizeBuilderPageSchema(value.draft_schema),
    editorState: {
      mode: responsiveMode(editorState.mode),
      selectedSectionId:
        typeof editorState.selectedSectionId === "string" ? editorState.selectedSectionId : null,
      status
    },
    id: typeof value.id === "string" ? value.id : null,
    owner_user_id: typeof value.owner_user_id === "string" ? value.owner_user_id : context.owner_user_id,
    pageSchema: normalizeBuilderPageSchema(value.page_schema),
    publishedSchema: value.published_schema ? normalizeBuilderPageSchema(value.published_schema) : null,
    status,
    store_instance_id: context.store_instance_id
  };
}

export async function loadVisualEditorState(context: StoreTenantContext): Promise<StoreBuilderState> {
  const admin = createAdminClient();
  const persistence = await resolveBuilderPersistence(context);

  if (persistence.page || persistence.draft.id || persistence.published.id) {
    return {
      draftSchema: persistence.draft.draftSchema,
      editorState: {
        mode: persistence.draft.editorState.mode,
        selectedSectionId: persistence.draft.editorState.selectedSectionId,
        status: persistence.page?.status ?? "draft"
      },
      id: persistence.page?.id ?? persistence.draft.id,
      owner_user_id: context.owner_user_id,
      pageSchema: persistence.published.layoutSchema ?? persistence.draft.draftSchema,
      publishedSchema: persistence.published.layoutSchema,
      status: persistence.page?.status ?? "draft",
      store_instance_id: context.store_instance_id
    };
  }

  if (!admin) {
    return normalizeBuilderState(null, context);
  }

  const { data, error } = await admin
    .from("store_builder_states" as never)
    .select("*")
    .eq("store_instance_id", context.store_instance_id)
    .maybeSingle();

  if (error || !data) {
    return normalizeBuilderState(null, context);
  }

  return normalizeBuilderState(data, context);
}

export function resolveBuilderSchema(state: StoreBuilderState) {
  return state.publishedSchema ?? state.pageSchema;
}

export function resolveBuilderSections(state: StoreBuilderState, context: StoreTenantContext): StoreSection[] {
  return resolveBuilderSchema(state).sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      config: {
        ...section.props,
        responsive: section.responsive,
        visualBuilderPosition: section.position
      },
      id: section.id,
      owner_user_id: context.owner_user_id,
      section_enabled: section.enabled,
      section_order: section.order,
      section_type: section.type,
      store_instance_id: context.store_instance_id
    }));
}

export function getVisualBuilderPayload(state: StoreBuilderState) {
  const schema = resolveBuilderSchema(state);

  return {
    editorState: state.editorState,
    interactionState: createBuilderInteractionState(state),
    pageSchema: {
      layoutTree: schema.layoutTree,
      responsive: schema.responsive,
      sectionCount: schema.sections.length,
      version: schema.version
    },
    previewSync: getPreviewSyncPayload(state),
    status: state.status
  };
}
