"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

type SectionDraftRow = {
  draft_schema: Record<string, unknown>;
  id: string;
  section_enabled: boolean;
  section_key: string;
  section_order: number;
  section_type: string;
  settings: Record<string, unknown>;
};

const supportedSectionTypes = new Set([
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

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function cleanSectionType(value: FormDataEntryValue | null) {
  const sectionType = cleanText(value, 80);
  return supportedSectionTypes.has(sectionType) ? sectionType : "rich_text";
}

function cleanOrder(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(cleanText(value, 20), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function builderRedirect(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${storeId}?builder=${encodeURIComponent(status)}#overview`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sectionSettingsFromForm(formData: FormData) {
  return {
    body: cleanText(formData.get("body"), 1000),
    cta: cleanText(formData.get("cta"), 120),
    heading: cleanText(formData.get("heading"), 160),
    subheading: cleanText(formData.get("subheading"), 280)
  };
}

async function getClaimedStore(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    (data as ClaimedStoreRow[]).find(
      (store) =>
        store.id === storeId &&
        (!store.access_role || store.access_role === "owner" || store.access_role === "admin")
    ) ?? null
  );
}

async function requireBuilderStore(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!storeId) {
    redirect("/dashboard/stores?builder=missing-store");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/stores/${storeId}`)}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    builderRedirect(storeId, "not-authorized");
  }

  return { storeId, supabase, userId: user.id };
}

function emptySchema(): BuilderPageSchema {
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

async function getOrCreateDraftContext(supabase: SupabaseClient, storeId: string, userId: string) {
  const { data: pageData, error: pageError } = await supabase
    .from("builder_pages" as never)
    .upsert(
      {
        owner_user_id: userId,
        page_key: "home",
        page_title: "Home",
        status: "draft",
        store_instance_id: storeId
      } as never,
      { onConflict: "store_instance_id,page_key" }
    )
    .select("id")
    .single();

  if (pageError || !pageData) {
    throw new Error(pageError?.message ?? "Unable to prepare builder page.");
  }

  const pageId = (pageData as { id: string }).id;
  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, draft_schema, editor_state")
    .eq("builder_page_id", pageId)
    .maybeSingle();
  const draft = draftData as { draft_schema?: unknown; editor_state?: unknown; id?: string } | null;

  if (draft?.id) {
    return {
      draftId: draft.id,
      editorState: isRecord(draft.editor_state) ? draft.editor_state : {},
      pageId,
      schema: normalizeBuilderPageSchema(draft.draft_schema)
    };
  }

  const schema = emptySchema();
  const { data: createdDraft, error: draftError } = await supabase
    .from("builder_drafts" as never)
    .insert({
      builder_page_id: pageId,
      draft_schema: schema,
      editor_state: {
        mode: "desktop",
        previewSyncPending: false,
        selectedSectionId: null
      },
      has_unsaved_changes: false,
      layout_tree: schema.layoutTree,
      owner_user_id: userId,
      responsive_config: schema.responsive,
      store_instance_id: storeId
    } as never)
    .select("id")
    .single();

  if (draftError || !createdDraft) {
    throw new Error(draftError?.message ?? "Unable to prepare builder draft.");
  }

  return {
    draftId: (createdDraft as { id: string }).id,
    editorState: {},
    pageId,
    schema
  };
}

function sectionFromSchema(section: BuilderPageSchema["sections"][number]) {
  return {
    draft_schema: {
      enabled: section.enabled,
      id: section.id,
      order: section.order,
      position: section.position,
      props: section.props,
      responsive: section.responsive,
      type: section.type
    },
    section_enabled: section.enabled,
    section_key: section.id,
    section_order: section.order,
    section_type: section.type,
    settings: section.props
  };
}

async function seedSectionDraftsIfMissing(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  pageId: string,
  draftId: string,
  schema: BuilderPageSchema
) {
  const { data: existing } = await supabase
    .from("store_builder_section_drafts" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .limit(1);

  if (Array.isArray(existing) && existing.length) {
    return;
  }

  const rows = schema.sections.map((section, index) => ({
    ...sectionFromSchema(section),
    builder_draft_id: draftId,
    builder_page_id: pageId,
    editor_metadata: {
      seededFrom: "builder_draft",
      seededOrder: index
    },
    owner_user_id: userId,
    store_instance_id: storeId
  }));

  if (rows.length) {
    await supabase.from("store_builder_section_drafts" as never).insert(rows as never);
  }
}

async function getSectionDrafts(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("store_builder_section_drafts" as never)
    .select("id, section_key, section_type, section_order, section_enabled, settings, draft_schema")
    .eq("store_instance_id", storeId)
    .order("section_order", { ascending: true })
    .order("created_at", { ascending: true });

  return Array.isArray(data)
    ? (data as Record<string, unknown>[]).map((row) => ({
        draft_schema: isRecord(row.draft_schema) ? row.draft_schema : {},
        id: String(row.id),
        section_enabled: row.section_enabled !== false,
        section_key: String(row.section_key),
        section_order: typeof row.section_order === "number" ? row.section_order : 0,
        section_type: String(row.section_type),
        settings: isRecord(row.settings) ? row.settings : {}
      }))
    : [];
}

function schemaFromSectionDrafts(sections: SectionDraftRow[]): BuilderPageSchema {
  const normalized = normalizeBuilderPageSchema({
    layoutTree: {
      root: {
        children: sections.map((section) => section.section_key)
      }
    },
    responsive: {
      desktop: {},
      mobile: {},
      tablet: {}
    },
    sections: sections.map((section, index) => ({
      enabled: section.section_enabled,
      id: section.section_key,
      order: index * 10 + 10,
      position: isRecord(section.draft_schema.position) ? section.draft_schema.position : {},
      props: section.settings,
      responsive: isRecord(section.draft_schema.responsive) ? section.draft_schema.responsive : {},
      type: section.section_type
    })),
    version: 1
  });

  if (!normalized.sections.length) {
    throw new Error("Draft must contain at least one section.");
  }

  return normalized;
}

async function writeHistory(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  pageId: string,
  draftId: string,
  actionKey: string,
  schema: BuilderPageSchema,
  sections: SectionDraftRow[]
) {
  await supabase.from("store_builder_history" as never).insert({
    action_key: actionKey,
    builder_draft_id: draftId,
    builder_page_id: pageId,
    editor_metadata: {
      source: "visual_builder_editing"
    },
    owner_user_id: userId,
    snapshot_schema: schema,
    snapshot_sections: sections,
    store_instance_id: storeId
  } as never);
}

async function syncDraftSchema({
  actionKey,
  draftId,
  editorState = {},
  pageId,
  storeId,
  supabase,
  userId
}: {
  actionKey: string;
  draftId: string;
  editorState?: Record<string, unknown>;
  pageId: string;
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const sections = await getSectionDrafts(supabase, storeId);
  const schema = schemaFromSectionDrafts(sections);

  await writeHistory(supabase, storeId, userId, pageId, draftId, actionKey, schema, sections);

  const { error } = await supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: schema,
      editor_state: {
        ...editorState,
        mode: editorState.mode ?? "desktop",
        previewSyncPending: true,
        source: "visual_builder_editing"
      },
      has_unsaved_changes: true,
      layout_tree: schema.layoutTree,
      responsive_config: schema.responsive
    } as never)
    .eq("id", draftId)
    .eq("store_instance_id", storeId);

  if (error) {
    throw new Error(error.message);
  }
}

async function prepareBuilderEdit(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const context = await getOrCreateDraftContext(supabase, storeId, userId);

  await seedSectionDraftsIfMissing(
    supabase,
    storeId,
    userId,
    context.pageId,
    context.draftId,
    context.schema
  );

  return { ...context, storeId, supabase, userId };
}

export async function updateDraftSection(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);

  if (!sectionId) {
    builderRedirect(context.storeId, "missing-section");
  }

  const settings = sectionSettingsFromForm(formData);
  const { error } = await context.supabase
    .from("store_builder_section_drafts" as never)
    .update({
      editor_metadata: {
        updatedFrom: "section_settings"
      },
      settings
    } as never)
    .eq("id", sectionId)
    .eq("store_instance_id", context.storeId);

  if (error) {
    builderRedirect(context.storeId, "update-failed");
  }

  await syncDraftSchema({
    ...context,
    actionKey: "update_section",
    editorState: {
      ...context.editorState,
      selectedSectionId: sectionId
    }
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "section-updated");
}

export async function reorderDraftSections(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);
  const direction = cleanText(formData.get("direction"), 10);
  const sections = await getSectionDrafts(context.supabase, context.storeId);
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sections.length) {
    builderRedirect(context.storeId, "reorder-skipped");
  }

  const reordered = [...sections];
  const [current] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, current);

  await Promise.all(
    reordered.map((section, index) =>
      context.supabase
        .from("store_builder_section_drafts" as never)
        .update({ section_order: index * 10 + 10 } as never)
        .eq("id", section.id)
        .eq("store_instance_id", context.storeId)
    )
  );
  await syncDraftSchema({
    ...context,
    actionKey: "reorder_sections",
    editorState: {
      ...context.editorState,
      selectedSectionId: sectionId
    }
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "sections-reordered");
}

export async function toggleDraftSectionVisibility(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);
  const enabled = cleanText(formData.get("enabled"), 10) === "true";
  const { error } = await context.supabase
    .from("store_builder_section_drafts" as never)
    .update({ section_enabled: !enabled } as never)
    .eq("id", sectionId)
    .eq("store_instance_id", context.storeId);

  if (error) {
    builderRedirect(context.storeId, "visibility-failed");
  }

  await syncDraftSchema({
    ...context,
    actionKey: "toggle_visibility",
    editorState: {
      ...context.editorState,
      selectedSectionId: sectionId
    }
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "visibility-updated");
}

export async function duplicateDraftSection(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);
  const sections = await getSectionDrafts(context.supabase, context.storeId);
  const section = sections.find((candidate) => candidate.id === sectionId);

  if (!section) {
    builderRedirect(context.storeId, "missing-section");
  }

  const newKey = `${section.section_key}-copy-${randomUUID().slice(0, 8)}`;
  const { error } = await context.supabase.from("store_builder_section_drafts" as never).insert({
    builder_draft_id: context.draftId,
    builder_page_id: context.pageId,
    draft_schema: {
      ...section.draft_schema,
      id: newKey
    },
    editor_metadata: {
      duplicatedFrom: section.id
    },
    owner_user_id: context.userId,
    section_enabled: section.section_enabled,
    section_key: newKey,
    section_order: section.section_order + 5,
    section_type: section.section_type,
    settings: section.settings,
    store_instance_id: context.storeId
  } as never);

  if (error) {
    builderRedirect(context.storeId, "duplicate-failed");
  }

  await syncDraftSchema({
    ...context,
    actionKey: "duplicate_section",
    editorState: {
      ...context.editorState,
      selectedSectionId: newKey
    }
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "section-duplicated");
}

export async function deleteDraftSection(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionId = cleanText(formData.get("sectionId"), 80);
  const sections = await getSectionDrafts(context.supabase, context.storeId);

  if (sections.length <= 1) {
    builderRedirect(context.storeId, "last-section-protected");
  }

  const { error } = await context.supabase
    .from("store_builder_section_drafts" as never)
    .delete()
    .eq("id", sectionId)
    .eq("store_instance_id", context.storeId);

  if (error) {
    builderRedirect(context.storeId, "delete-failed");
  }

  await syncDraftSchema({
    ...context,
    actionKey: "delete_section",
    editorState: context.editorState
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "section-deleted");
}

export async function createDraftSection(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const sectionType = cleanSectionType(formData.get("sectionType"));
  const sections = await getSectionDrafts(context.supabase, context.storeId);
  const sectionKey = `${sectionType}-${randomUUID().slice(0, 8)}`;
  const settings = sectionSettingsFromForm(formData);
  const order = cleanOrder(formData.get("sectionOrder"), sections.length * 10 + 10);
  const { error } = await context.supabase.from("store_builder_section_drafts" as never).insert({
    builder_draft_id: context.draftId,
    builder_page_id: context.pageId,
    draft_schema: {
      enabled: true,
      id: sectionKey,
      order,
      position: {},
      props: settings,
      responsive: {},
      type: sectionType
    },
    editor_metadata: {
      createdFrom: "visual_builder_editor"
    },
    owner_user_id: context.userId,
    section_enabled: true,
    section_key: sectionKey,
    section_order: order,
    section_type: sectionType,
    settings,
    store_instance_id: context.storeId
  } as never);

  if (error) {
    builderRedirect(context.storeId, "create-failed");
  }

  await syncDraftSchema({
    ...context,
    actionKey: "create_section",
    editorState: {
      ...context.editorState,
      selectedSectionId: sectionKey
    }
  });
  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "section-created");
}

export async function saveBuilderSession(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const selectedSectionId = cleanText(formData.get("selectedSectionId"), 80) || null;
  const responsiveMode = cleanText(formData.get("responsiveMode"), 20);
  const mode = responsiveMode === "tablet" || responsiveMode === "mobile" ? responsiveMode : "desktop";
  const { error } = await context.supabase.from("store_builder_edit_sessions" as never).insert({
    builder_draft_id: context.draftId,
    builder_page_id: context.pageId,
    editor_metadata: {
      source: "visual_builder_editor"
    },
    owner_user_id: context.userId,
    preview_state: {
      hydrationSafe: true,
      isolatedDraftPreview: true
    },
    responsive_mode: mode,
    saved_at: new Date().toISOString(),
    selected_section_id: selectedSectionId,
    session_status: "saved",
    store_instance_id: context.storeId
  } as never);

  if (error) {
    builderRedirect(context.storeId, "session-failed");
  }

  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "session-saved");
}

export async function rollbackBuilderDraft(formData: FormData) {
  const context = await prepareBuilderEdit(formData);
  const { data: historyData } = await context.supabase
    .from("store_builder_history" as never)
    .select("snapshot_schema, snapshot_sections")
    .eq("store_instance_id", context.storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const history = historyData as { snapshot_schema?: unknown; snapshot_sections?: unknown } | null;

  if (!history) {
    builderRedirect(context.storeId, "rollback-empty");
  }

  const schema = normalizeBuilderPageSchema(history.snapshot_schema);
  const sections = Array.isArray(history.snapshot_sections)
    ? (history.snapshot_sections as SectionDraftRow[])
    : [];

  if (!schema.sections.length || !sections.length) {
    builderRedirect(context.storeId, "rollback-invalid");
  }

  await context.supabase
    .from("store_builder_section_drafts" as never)
    .delete()
    .eq("store_instance_id", context.storeId);
  await context.supabase.from("store_builder_section_drafts" as never).insert(
    sections.map((section) => ({
      builder_draft_id: context.draftId,
      builder_page_id: context.pageId,
      draft_schema: section.draft_schema,
      editor_metadata: {
        rolledBack: true
      },
      owner_user_id: context.userId,
      section_enabled: section.section_enabled,
      section_key: section.section_key,
      section_order: section.section_order,
      section_type: section.section_type,
      settings: section.settings,
      store_instance_id: context.storeId
    })) as never
  );
  const { error } = await context.supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: schema,
      editor_state: {
        ...context.editorState,
        previewSyncPending: true,
        source: "visual_builder_rollback"
      },
      has_unsaved_changes: true,
      layout_tree: schema.layoutTree,
      responsive_config: schema.responsive
    } as never)
    .eq("id", context.draftId)
    .eq("store_instance_id", context.storeId);

  if (error) {
    builderRedirect(context.storeId, "rollback-failed");
  }

  revalidatePath(`/dashboard/stores/${context.storeId}`);
  builderRedirect(context.storeId, "rollback-complete");
}
