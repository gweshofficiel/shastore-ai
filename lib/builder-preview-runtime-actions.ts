"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPreviewSession,
  refreshPreviewState,
  syncDraftPreview
} from "@/lib/builder-preview-runtime";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
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

async function getBuilderDraft(supabase: SupabaseClient, storeId: string) {
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData as { id?: string } | null;

  if (!page?.id) {
    return { draft: null, page: null };
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("id, draft_schema, editor_state")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  return {
    draft: draftData as { draft_schema?: unknown; editor_state?: unknown; id?: string } | null,
    page
  };
}

async function persistPreviewRuntime({
  draft,
  mode,
  pageId,
  source,
  storeId,
  supabase,
  userId
}: {
  draft: { draft_schema?: unknown; editor_state?: unknown; id: string };
  mode: string;
  pageId: string;
  source: string;
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const schema = normalizeBuilderPageSchema(draft.draft_schema);
  const session = createPreviewSession({ mode, schema, source });
  const runtime =
    source === "manual_refresh"
      ? refreshPreviewState({ mode, schema })
      : syncDraftPreview({ mode, schema, source });
  const { data: sessionData, error: sessionError } = await supabase
    .from("builder_preview_sessions" as never)
    .insert({
      builder_draft_id: draft.id,
      builder_page_id: pageId,
      hydration_state: session.hydrationState,
      isolation_state: session.isolationState,
      metadata: session.metadata,
      owner_user_id: userId,
      preview_mode: session.previewMode,
      session_status: source === "manual_refresh" ? "refreshing" : session.sessionStatus,
      store_instance_id: storeId,
      sync_state: session.syncState
    } as never)
    .select("id")
    .single();

  if (sessionError || !sessionData) {
    return { error: sessionError ?? new Error("Preview session failed."), runtime: null };
  }

  const sessionId = (sessionData as { id: string }).id;
  const runtimePayload = {
    builder_draft_id: draft.id,
    builder_page_id: pageId,
    error_state: runtime.errorState,
    hydration_state: runtime.hydrationState,
    isolation_state: runtime.isolationState,
    metadata: {
      draftOnly: true,
      publishedStorefrontUntouched: true
    },
    owner_user_id: userId,
    preview_session_id: sessionId,
    render_tree: runtime.renderTree,
    responsive_state: runtime.responsiveState,
    runtime_schema: runtime.runtimeSchema,
    runtime_status: runtime.runtimeStatus,
    store_instance_id: storeId,
    sync_source: runtime.syncSource,
    updated_at: new Date().toISOString()
  };
  const { error: runtimeError } = await supabase
    .from("preview_runtime_states" as never)
    .upsert(runtimePayload as never, { onConflict: "builder_draft_id" });

  if (runtimeError) {
    return { error: runtimeError, runtime: null };
  }

  await supabase.from("preview_render_cache" as never).insert({
    builder_draft_id: draft.id,
    builder_page_id: pageId,
    cache_key: runtime.cacheKey,
    cache_status: runtime.runtimeStatus === "ready" ? "fresh" : "error",
    expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    hydration_payload: runtime.hydrationState,
    metadata: {
      cacheOnly: true,
      futurePerformanceOptimization: true
    },
    owner_user_id: userId,
    preview_session_id: sessionId,
    render_payload: runtime.renderTree,
    responsive_payload: runtime.responsiveState,
    store_instance_id: storeId
  } as never);

  const editorState = isRecord(draft.editor_state) ? draft.editor_state : {};
  await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...editorState,
        livePreviewRuntime: {
          lastSessionId: sessionId,
          lastSyncAt: runtime.syncedAt,
          mode: runtime.responsiveState.activeMode,
          status: runtime.runtimeStatus
        },
        previewHydrationSafe: runtime.hydrationState.hydrationSafe,
        previewRenderingIsolated: true,
        previewSyncPending: false,
        previewTarget: "draft"
      }
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  await supabase
    .from("builder_preview_sessions" as never)
    .update({
      session_status: runtime.runtimeStatus === "ready" ? "synced" : "error",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id", sessionId)
    .eq("store_instance_id", storeId);

  return { error: null, runtime };
}

export async function createPreviewSessionAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const mode = cleanText(formData.get("mode"), 20) || "desktop";
  const { draft, page } = await getBuilderDraft(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "preview-runtime-draft-missing");
  }

  const result = await persistPreviewRuntime({
    draft: { ...draft, id: draft.id },
    mode,
    pageId: page.id,
    source: "draft_change",
    storeId,
    supabase,
    userId
  });

  if (result.error) {
    builderRedirect(storeId, "preview-runtime-session-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "preview-runtime-session-created");
}

export async function syncDraftPreviewAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const mode = cleanText(formData.get("mode"), 20) || "desktop";
  const source = cleanText(formData.get("source"), 40) || "draft_change";
  const { draft, page } = await getBuilderDraft(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "preview-runtime-draft-missing");
  }

  const result = await persistPreviewRuntime({
    draft: { ...draft, id: draft.id },
    mode,
    pageId: page.id,
    source,
    storeId,
    supabase,
    userId
  });

  if (result.error) {
    builderRedirect(storeId, "preview-runtime-sync-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "preview-runtime-synced");
}

export async function refreshPreviewStateAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const mode = cleanText(formData.get("mode"), 20) || "desktop";
  const { draft, page } = await getBuilderDraft(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "preview-runtime-draft-missing");
  }

  const result = await persistPreviewRuntime({
    draft: { ...draft, id: draft.id },
    mode,
    pageId: page.id,
    source: "manual_refresh",
    storeId,
    supabase,
    userId
  });

  if (result.error) {
    builderRedirect(storeId, "preview-runtime-refresh-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "preview-runtime-refreshed");
}
