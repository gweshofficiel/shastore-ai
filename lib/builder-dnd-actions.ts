"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import {
  calculateDropIndex,
  moveDraftSection as moveSectionOrder,
  persistSectionOrder,
  rollbackSectionMove,
  syncBuilderPreviewState,
  validateSectionMove,
  type DraftSectionOrderItem
} from "@/lib/builder-dnd-utils";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

type DraftSectionRow = DraftSectionOrderItem & {
  draft_schema: Record<string, unknown>;
  section_enabled: boolean;
  section_type: string;
  settings: Record<string, unknown>;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function cleanIndex(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(cleanText(value, 20), 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function builderRedirect(storeId: string, status: string): never {
  redirect(`/dashboard/stores/${storeId}?builder=${encodeURIComponent(status)}#overview`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

async function getDraftContext(supabase: SupabaseClient, storeId: string) {
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const pageId = pageData ? (pageData as { id?: string }).id : "";

  if (!pageId) {
    return null;
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, editor_state")
    .eq("builder_page_id", pageId)
    .maybeSingle();
  const draft = draftData as { editor_state?: unknown; id?: string } | null;

  if (!draft?.id) {
    return null;
  }

  return {
    draftId: draft.id,
    editorState: isRecord(draft.editor_state) ? draft.editor_state : {},
    pageId
  };
}

async function getSectionDrafts(supabase: SupabaseClient, storeId: string): Promise<DraftSectionRow[]> {
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

function schemaFromSections(sections: DraftSectionRow[]): BuilderPageSchema {
  return normalizeBuilderPageSchema({
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
}

async function writeMoveHistory({
  draftId,
  pageId,
  sections,
  storeId,
  supabase,
  userId
}: {
  draftId: string;
  pageId: string;
  sections: DraftSectionRow[];
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  await supabase.from("store_builder_history" as never).insert({
    action_key: "drag_section_move",
    builder_draft_id: draftId,
    builder_page_id: pageId,
    editor_metadata: {
      interaction: "drag_drop",
      source: "visual_builder_dnd"
    },
    owner_user_id: userId,
    snapshot_schema: schemaFromSections(sections),
    snapshot_sections: sections,
    store_instance_id: storeId
  } as never);
}

async function writeOrders(
  supabase: SupabaseClient,
  storeId: string,
  sections: DraftSectionOrderItem[]
) {
  await Promise.all(
    persistSectionOrder(sections).map((section) =>
      supabase
        .from("store_builder_section_drafts" as never)
        .update({ section_order: section.section_order } as never)
        .eq("id", section.id)
        .eq("store_instance_id", storeId)
    )
  );
}

export async function rollbackSectionMoveAction({
  storeId,
  supabase,
  sections
}: {
  sections: DraftSectionOrderItem[];
  storeId: string;
  supabase: SupabaseClient;
}) {
  await Promise.all(
    rollbackSectionMove(sections).map((section) =>
      supabase
        .from("store_builder_section_drafts" as never)
        .update({ section_order: section.section_order } as never)
        .eq("id", section.id)
        .eq("store_instance_id", storeId)
    )
  );
}

export async function syncBuilderPreviewStateAction({
  draftId,
  editorState,
  pageId,
  sections,
  storeId,
  supabase
}: {
  draftId: string;
  editorState: Record<string, unknown>;
  pageId: string;
  sections: DraftSectionRow[];
  storeId: string;
  supabase: SupabaseClient;
}) {
  const schema = schemaFromSections(sections);
  const previewState = syncBuilderPreviewState(sections);
  const { error: draftError } = await supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: schema,
      editor_state: {
        ...editorState,
        dragInteraction: previewState,
        mode: editorState.mode ?? "desktop",
        previewSyncPending: true,
        source: "visual_builder_dnd"
      },
      has_unsaved_changes: true,
      layout_tree: schema.layoutTree,
      responsive_config: schema.responsive
    } as never)
    .eq("id", draftId)
    .eq("store_instance_id", storeId);

  if (draftError) {
    throw new Error(draftError.message);
  }

  await supabase.from("store_builder_edit_sessions" as never).insert({
    builder_draft_id: draftId,
    builder_page_id: pageId,
    editor_metadata: {
      interaction: "drag_drop",
      movementAnimationPrep: true,
      optimisticOrdering: true
    },
    preview_state: previewState,
    responsive_mode: editorState.mode === "tablet" || editorState.mode === "mobile" ? editorState.mode : "desktop",
    session_status: "saved",
    store_instance_id: storeId
  } as never);
}

export async function moveDraftSection(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const context = await getDraftContext(supabase, storeId);

  if (!context) {
    builderRedirect(storeId, "drag-draft-missing");
  }

  const sectionId = cleanText(formData.get("sectionId"), 80);
  const targetIndex = cleanIndex(formData.get("targetIndex"));
  const position = cleanText(formData.get("position"), 20) === "after" ? "after" : "before";
  const sections = await getSectionDrafts(supabase, storeId);
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const validation = validateSectionMove({
    currentIndex,
    targetIndex,
    total: sections.length
  });

  if (!validation.valid) {
    builderRedirect(storeId, "drag-move-invalid");
  }

  const dropIndex = calculateDropIndex({
    currentIndex,
    position,
    targetIndex,
    total: sections.length
  });

  if (dropIndex < 0 || dropIndex === currentIndex) {
    builderRedirect(storeId, "drag-move-skipped");
  }

  const previousSections = sections.map((section) => ({ ...section }));
  const movedOrder = moveSectionOrder(sections, sectionId, dropIndex);

  try {
    await writeMoveHistory({
      draftId: context.draftId,
      pageId: context.pageId,
      sections,
      storeId,
      supabase,
      userId
    });
    await writeOrders(supabase, storeId, movedOrder);
    const updatedSections = await getSectionDrafts(supabase, storeId);
    await syncBuilderPreviewStateAction({
      draftId: context.draftId,
      editorState: {
        ...context.editorState,
        draggingSectionId: sectionId,
        dropTargetIndex: dropIndex,
        selectedSectionId: sectionId
      },
      pageId: context.pageId,
      sections: updatedSections,
      storeId,
      supabase
    });
  } catch (error) {
    await rollbackSectionMoveAction({ sections: previousSections, storeId, supabase });
    console.error("[builder-dnd] move failed", {
      error,
      sectionId,
      storeId
    });
    builderRedirect(storeId, "drag-move-failed");
  }

  revalidatePath(`/dashboard/stores/${storeId}`);
  builderRedirect(storeId, "drag-move-saved");
}
