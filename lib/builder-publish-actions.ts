"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import { validateDraftBeforePublish } from "@/lib/builder-publish-utils";
import { layoutDiffPreparation } from "@/lib/builder-version-utils";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

type BuilderDraftSnapshot = {
  draftId: string;
  editorState: Record<string, unknown>;
  hasUnsavedChanges: boolean;
  pageId: string;
  pageStatus: string;
  schema: BuilderPageSchema;
};

type PublishedSnapshot = {
  id: string | null;
  publishedAt: string | null;
  schema: BuilderPageSchema | null;
  versionNumber: number;
};

const builderPath = (storeId: string) => `/dashboard/stores/${storeId}`;

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function builderRedirect(storeId: string, status: string): never {
  redirect(`${builderPath(storeId)}?builder=${encodeURIComponent(status)}#overview`);
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
    redirect(`/login?next=${encodeURIComponent(builderPath(storeId))}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    builderRedirect(storeId, "not-authorized");
  }

  return { storeId, supabase, userId: user.id };
}

async function getDraftSnapshot(
  supabase: SupabaseClient,
  storeId: string
): Promise<BuilderDraftSnapshot | null> {
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id, status")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData as { id?: string; status?: string } | null;

  if (!page?.id) {
    return null;
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, draft_schema, editor_state, has_unsaved_changes")
    .eq("builder_page_id", page.id)
    .maybeSingle();
  const draft = draftData as {
    draft_schema?: unknown;
    editor_state?: unknown;
    has_unsaved_changes?: boolean;
    id?: string;
  } | null;

  if (!draft?.id) {
    return null;
  }

  return {
    draftId: draft.id,
    editorState: isRecord(draft.editor_state) ? draft.editor_state : {},
    hasUnsavedChanges: draft.has_unsaved_changes === true,
    pageId: page.id,
    pageStatus: page.status ?? "draft",
    schema: normalizeBuilderPageSchema(draft.draft_schema)
  };
}

async function getActivePublishedLayout(
  supabase: SupabaseClient,
  pageId: string,
  activeVersionId?: string | null
): Promise<PublishedSnapshot> {
  let query = supabase
    .from("builder_layout_versions" as never)
    .select("id, version_number, layout_schema, published_at")
    .eq("builder_page_id", pageId)
    .eq("status", "published");

  query = activeVersionId
    ? query.eq("id", activeVersionId)
    : query.order("version_number", { ascending: false }).limit(1);

  const { data } = await query.maybeSingle();
  const row = data as {
    id?: string;
    layout_schema?: unknown;
    published_at?: string | null;
    version_number?: number;
  } | null;

  return {
    id: row?.id ?? null,
    publishedAt: row?.published_at ?? null,
    schema: row ? normalizeBuilderPageSchema(row.layout_schema) : null,
    versionNumber: typeof row?.version_number === "number" ? row.version_number : 0
  };
}

async function getPageActiveVersion(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("builder_pages" as never)
    .select("id, active_version_id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();

  return data as { active_version_id?: string | null; id?: string } | null;
}

async function nextVersionNumber(supabase: SupabaseClient, pageId: string) {
  const { data } = await supabase
    .from("builder_layout_versions" as never)
    .select("version_number")
    .eq("builder_page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { version_number?: number } | null;

  return (typeof row?.version_number === "number" ? row.version_number : 0) + 1;
}

export async function syncLivePreviewState(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const draft = await getDraftSnapshot(supabase, storeId);

  if (!draft) {
    builderRedirect(storeId, "preview-draft-missing");
  }

  const { error } = await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...draft.editorState,
        isolatedDraftPreview: true,
        lastPreviewRefreshAt: new Date().toISOString(),
        previewHydrationSafe: true,
        previewRenderingIsolated: true,
        previewSyncPending: false,
        previewTarget: "draft"
      }
    } as never)
    .eq("id", draft.draftId)
    .eq("store_instance_id", storeId);

  if (error) {
    builderRedirect(storeId, "preview-refresh-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "preview-refreshed");
}

export async function publishBuilderDraft(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const draft = await getDraftSnapshot(supabase, storeId);

  if (!draft) {
    builderRedirect(storeId, "publish-draft-missing");
  }

  const validation = validateDraftBeforePublish(draft.schema);

  if (validation.errors.length) {
    builderRedirect(storeId, "publish-invalid-draft");
  }

  const activePage = await getPageActiveVersion(supabase, storeId);
  const activePublished = await getActivePublishedLayout(
    supabase,
    draft.pageId,
    activePage?.active_version_id ?? null
  );
  const versionNumber = await nextVersionNumber(supabase, draft.pageId);
  const { data: versionData, error: versionError } = await supabase
    .from("builder_layout_versions" as never)
    .insert({
      builder_page_id: draft.pageId,
      layout_schema: validation.schema,
      layout_tree: validation.schema.layoutTree,
      owner_user_id: userId,
      published_at: new Date().toISOString(),
      responsive_config: validation.schema.responsive,
      status: "published",
      store_instance_id: storeId,
      version_number: versionNumber
    } as never)
    .select("id")
    .single();

  if (versionError || !versionData) {
    builderRedirect(storeId, "publish-version-failed");
  }

  const versionId = (versionData as { id: string }).id;
  const { error: pageError } = await supabase
    .from("builder_pages" as never)
    .update({
      active_version_id: versionId,
      schema_version: validation.schema.version,
      status: "published"
    } as never)
    .eq("id", draft.pageId)
    .eq("store_instance_id", storeId);

  if (pageError) {
    await rollbackPublishedVersion({
      activeVersionId: activePublished.id,
      pageId: draft.pageId,
      storeId,
      supabase,
      versionId
    });
    builderRedirect(storeId, "publish-rollback-complete");
  }

  await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...draft.editorState,
        lastPublishedAt: new Date().toISOString(),
        previewSyncPending: false,
        publishedVersionId: versionId,
        source: "builder_publish"
      },
      has_unsaved_changes: false
    } as never)
    .eq("id", draft.draftId)
    .eq("store_instance_id", storeId);

  const snapshotResult = await supabase
    .from("builder_version_snapshots" as never)
    .insert({
      builder_draft_id: draft.draftId,
      builder_layout_version_id: versionId,
      builder_page_id: draft.pageId,
      editor_state: draft.editorState,
      layout_diff: layoutDiffPreparation(activePublished.schema, validation.schema),
      layout_schema: validation.schema,
      layout_tree: validation.schema.layoutTree,
      metadata: {
        source: "builder_publish",
        versionNumber
      },
      owner_user_id: userId,
      responsive_config: validation.schema.responsive,
      schema_version: validation.schema.version,
      snapshot_label: `Published version ${versionNumber}`,
      snapshot_type: "published",
      store_instance_id: storeId
    } as never)
    .select("id")
    .maybeSingle();

  await supabase.from("builder_publish_history" as never).insert({
    builder_layout_version_id: versionId,
    builder_page_id: draft.pageId,
    metadata: {
      source: "builder_publish"
    },
    owner_user_id: userId,
    publish_status: "published",
    published_at: new Date().toISOString(),
    snapshot_id: snapshotResult.data ? (snapshotResult.data as { id?: string }).id ?? null : null,
    store_instance_id: storeId,
    version_number: versionNumber
  } as never);

  revalidatePath(builderPath(storeId));
  revalidatePath(`/store/${storeId}`);
  builderRedirect(storeId, "publish-complete");
}

export async function restorePublishedLayout(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const draft = await getDraftSnapshot(supabase, storeId);

  if (!draft) {
    builderRedirect(storeId, "restore-draft-missing");
  }

  const activePage = await getPageActiveVersion(supabase, storeId);
  const published = await getActivePublishedLayout(
    supabase,
    draft.pageId,
    activePage?.active_version_id ?? null
  );

  if (!published.schema) {
    builderRedirect(storeId, "restore-no-published");
  }

  const { error } = await supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: published.schema,
      editor_state: {
        ...draft.editorState,
        previewSyncPending: true,
        restoredFromPublishedVersion: published.id,
        source: "restore_published_layout"
      },
      has_unsaved_changes: true,
      layout_tree: published.schema.layoutTree,
      responsive_config: published.schema.responsive
    } as never)
    .eq("id", draft.draftId)
    .eq("store_instance_id", storeId);

  if (error) {
    builderRedirect(storeId, "restore-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "restore-complete");
}

export async function rollbackPublishedVersion({
  activeVersionId,
  pageId,
  storeId,
  supabase,
  versionId
}: {
  activeVersionId: string | null;
  pageId: string;
  storeId: string;
  supabase: SupabaseClient;
  versionId?: string;
}) {
  if (versionId) {
    await supabase.from("builder_layout_versions" as never).delete().eq("id", versionId);
  }

  await supabase
    .from("builder_pages" as never)
    .update({
      active_version_id: activeVersionId,
      status: activeVersionId ? "published" : "draft"
    } as never)
    .eq("id", pageId)
    .eq("store_instance_id", storeId);
}

export async function rollbackPublishedVersionAction(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const draft = await getDraftSnapshot(supabase, storeId);

  if (!draft) {
    builderRedirect(storeId, "rollback-published-missing");
  }

  const activePage = await getPageActiveVersion(supabase, storeId);

  if (!activePage?.active_version_id) {
    builderRedirect(storeId, "rollback-no-active-version");
  }

  const { data: previousData } = await supabase
    .from("builder_layout_versions" as never)
    .select("id")
    .eq("builder_page_id", draft.pageId)
    .eq("status", "published")
    .neq("id", activePage.active_version_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousId = (previousData as { id?: string } | null)?.id ?? null;

  if (!previousId) {
    builderRedirect(storeId, "rollback-no-previous-version");
  }

  const { error } = await supabase
    .from("builder_pages" as never)
    .update({
      active_version_id: previousId,
      status: "published"
    } as never)
    .eq("id", draft.pageId)
    .eq("store_instance_id", storeId);

  if (error) {
    builderRedirect(storeId, "rollback-published-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "rollback-published-complete");
}
