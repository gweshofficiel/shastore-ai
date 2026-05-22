import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BuilderPageSchema, VisualEditorState } from "@/lib/storefront/builder";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";

export type BuilderPageRecord = {
  id: string;
  active_version_id: string | null;
  page_key: string;
  page_title: string;
  schema_version: number;
  status: "draft" | "published" | "archived";
  store_instance_id: string;
};

export type BuilderDraftRecord = {
  id: string | null;
  draftSchema: BuilderPageSchema;
  editorState: VisualEditorState & {
    previewSyncPending?: boolean;
  };
  hasUnsavedChanges: boolean;
  responsiveConfig: Record<string, unknown>;
  updatedAt: string | null;
};

export type BuilderPublishedLayout = {
  id: string | null;
  layoutSchema: BuilderPageSchema | null;
  publishedAt: string | null;
  versionNumber: number | null;
};

export type BuilderPersistenceState = {
  draft: BuilderDraftRecord;
  page: BuilderPageRecord | null;
  published: BuilderPublishedLayout;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function editorState(value: unknown): BuilderDraftRecord["editorState"] {
  const record = isRecord(value) ? value : {};
  const mode =
    record.mode === "tablet" || record.mode === "mobile" ? record.mode : "desktop";

  return {
    mode,
    previewSyncPending:
      typeof record.previewSyncPending === "boolean" ? record.previewSyncPending : false,
    selectedSectionId:
      typeof record.selectedSectionId === "string" ? record.selectedSectionId : null,
    status: record.status === "published" || record.status === "archived" ? record.status : "draft"
  };
}

function emptyDraft(): BuilderDraftRecord {
  return {
    draftSchema: normalizeBuilderPageSchema(null),
    editorState: {
      mode: "desktop",
      previewSyncPending: false,
      selectedSectionId: null,
      status: "draft"
    },
    hasUnsavedChanges: false,
    id: null,
    responsiveConfig: {},
    updatedAt: null
  };
}

function missingPersistenceError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  const message = (record.message ?? "").toLowerCase();
  return (
    record.code === "PGRST202" ||
    record.code === "PGRST205" ||
    message.includes("builder_pages") ||
    message.includes("builder_layout_versions") ||
    message.includes("builder_drafts") ||
    message.includes("schema cache")
  );
}

export async function getBuilderPage(
  context: StoreTenantContext,
  pageKey = "home"
): Promise<BuilderPageRecord | null> {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("builder_pages" as never)
    .select("id, store_instance_id, page_key, page_title, status, active_version_id, schema_version")
    .eq("store_instance_id", context.store_instance_id)
    .eq("page_key", pageKey)
    .maybeSingle();

  if (error || !data) {
    if (error && !missingPersistenceError(error)) {
      console.error("[builder-persistence] page read failed", {
        code: error.code,
        message: error.message,
        storeInstanceId: context.store_instance_id
      });
    }
    return null;
  }

  const row = data as Record<string, unknown>;
  const status =
    row.status === "published" || row.status === "archived" ? row.status : "draft";

  return {
    active_version_id: typeof row.active_version_id === "string" ? row.active_version_id : null,
    id: textValue(row.id),
    page_key: textValue(row.page_key, pageKey),
    page_title: textValue(row.page_title, "Home"),
    schema_version: numberValue(row.schema_version, 1),
    status,
    store_instance_id: context.store_instance_id
  };
}

export async function getBuilderDraft(
  page: BuilderPageRecord | null
): Promise<BuilderDraftRecord> {
  const admin = createAdminClient();

  if (!admin || !page) {
    return emptyDraft();
  }

  const { data, error } = await admin
    .from("builder_drafts" as never)
    .select("id, draft_schema, responsive_config, editor_state, has_unsaved_changes, updated_at")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  if (error || !data) {
    return emptyDraft();
  }

  const row = data as Record<string, unknown>;

  return {
    draftSchema: normalizeBuilderPageSchema(row.draft_schema),
    editorState: editorState(row.editor_state),
    hasUnsavedChanges: row.has_unsaved_changes === true,
    id: typeof row.id === "string" ? row.id : null,
    responsiveConfig: isRecord(row.responsive_config) ? row.responsive_config : {},
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
  };
}

export async function getPublishedBuilderLayout(
  page: BuilderPageRecord | null
): Promise<BuilderPublishedLayout> {
  const admin = createAdminClient();

  if (!admin || !page) {
    return {
      id: null,
      layoutSchema: null,
      publishedAt: null,
      versionNumber: null
    };
  }

  let query = admin
    .from("builder_layout_versions" as never)
    .select("id, version_number, layout_schema, published_at")
    .eq("builder_page_id", page.id)
    .eq("status", "published");

  query = page.active_version_id
    ? query.eq("id", page.active_version_id)
    : query.order("version_number", { ascending: false }).limit(1);

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      id: null,
      layoutSchema: null,
      publishedAt: null,
      versionNumber: null
    };
  }

  const row = data as Record<string, unknown>;

  return {
    id: typeof row.id === "string" ? row.id : null,
    layoutSchema: normalizeBuilderPageSchema(row.layout_schema),
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    versionNumber: numberValue(row.version_number, 1)
  };
}

export async function resolveBuilderPersistence(
  context: StoreTenantContext
): Promise<BuilderPersistenceState> {
  const page = await getBuilderPage(context);
  const [draft, published] = await Promise.all([
    getBuilderDraft(page),
    getPublishedBuilderLayout(page)
  ]);

  return {
    draft,
    page,
    published
  };
}

export function saveLayoutDraftPlaceholder() {
  return "Draft layout persistence is prepared. Server action wiring can save draft_schema into builder_drafts.";
}

export function publishLayoutPlaceholder() {
  return "Publish layout persistence is prepared. Server action wiring can create builder_layout_versions and update builder_pages.active_version_id.";
}

export function restorePublishedLayoutPlaceholder() {
  return "Restore published layout is prepared. Server action wiring can copy active published layout into builder_drafts.";
}

export function getLivePreviewSyncState(state: BuilderPersistenceState) {
  return {
    hasUnsavedChanges: state.draft.hasUnsavedChanges,
    lastDraftSavedAt: state.draft.updatedAt,
    publishedAt: state.published.publishedAt,
    publishedVersion: state.published.versionNumber,
    syncPending: Boolean(state.draft.editorState.previewSyncPending)
  };
}
