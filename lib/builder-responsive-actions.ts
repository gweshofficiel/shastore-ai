"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import {
  applyResponsiveLayoutOverride,
  getResponsiveBuilderMode,
  responsiveBreakpoints,
  syncResponsivePreviewState,
  validateResponsiveSchema
} from "@/lib/builder-responsive-utils";
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

async function getBuilderPageAndDraft(supabase: SupabaseClient, storeId: string) {
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
    .select("id, draft_schema, editor_state, responsive_config")
    .eq("builder_page_id", page.id)
    .maybeSingle();

  return {
    draft: draftData as {
      draft_schema?: unknown;
      editor_state?: unknown;
      id?: string;
      responsive_config?: unknown;
    } | null,
    page
  };
}

export async function switchResponsiveBuilderMode(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const mode = getResponsiveBuilderMode(cleanText(formData.get("mode"), 20));
  const { draft, page } = await getBuilderPageAndDraft(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "responsive-draft-missing");
  }

  const editorState = isRecord(draft.editor_state) ? draft.editor_state : {};
  const previewState = syncResponsivePreviewState({
    mode,
    schema: normalizeBuilderPageSchema(draft.draft_schema)
  });

  const { error: draftError } = await supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...editorState,
        mode,
        previewSyncPending: false,
        responsivePreview: previewState,
        responsivePreviewIsolated: true
      }
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  if (draftError) {
    builderRedirect(storeId, "responsive-mode-failed");
  }

  await supabase.from("responsive_layout_states" as never).upsert({
    active_breakpoint: mode,
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    device_frame: responsiveBreakpoints[mode],
    hydration_state: {
      breakpointSafe: true,
      hydrationSafe: previewState.hydratedSafely
    },
    layout_state: {
      mode,
      responsivePreviewOnly: true
    },
    metadata: {
      source: "responsive_mode_switch"
    },
    owner_user_id: userId,
    preview_state: previewState,
    store_instance_id: storeId,
    updated_at: new Date().toISOString()
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "responsive-mode-synced");
}

export async function syncResponsivePreviewStateAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const mode = getResponsiveBuilderMode(cleanText(formData.get("mode"), 20));
  const { draft, page } = await getBuilderPageAndDraft(supabase, storeId);

  if (!page?.id || !draft?.id) {
    builderRedirect(storeId, "responsive-draft-missing");
  }

  const schema = normalizeBuilderPageSchema(draft.draft_schema);
  const validation = validateResponsiveSchema(schema);

  if (validation.errors.length) {
    builderRedirect(storeId, "responsive-schema-invalid");
  }

  const previewState = syncResponsivePreviewState({ mode, schema: validation.schema });

  await supabase.from("builder_responsive_configs" as never).upsert({
    breakpoint_key: mode,
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    config: validation.schema.responsive[mode],
    layout_overrides: validation.schema.responsive[mode],
    metadata: {
      future: ["visual_responsive_editing", "ai_responsive_optimization", "adaptive_layouts"],
      source: "responsive_preview_sync"
    },
    owner_user_id: userId,
    section_overrides: validation.schema.sections.reduce<Record<string, unknown>>((overrides, section) => {
      overrides[section.id] = section.responsive[mode];
      return overrides;
    }, {}),
    store_instance_id: storeId,
    updated_at: new Date().toISOString()
  } as never);

  await supabase.from("responsive_layout_states" as never).upsert({
    active_breakpoint: mode,
    builder_draft_id: draft.id,
    builder_page_id: page.id,
    device_frame: responsiveBreakpoints[mode],
    hydration_state: {
      breakpointSafe: true,
      hydrationSafe: true
    },
    layout_state: {
      mode,
      responsivePreviewOnly: true
    },
    metadata: {
      source: "responsive_preview_sync"
    },
    owner_user_id: userId,
    preview_state: previewState,
    store_instance_id: storeId,
    updated_at: new Date().toISOString()
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "responsive-preview-synced");
}

export async function applyResponsiveLayoutOverrideAction(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const mode = getResponsiveBuilderMode(cleanText(formData.get("mode"), 20));
  const { draft } = await getBuilderPageAndDraft(supabase, storeId);

  if (!draft?.id) {
    builderRedirect(storeId, "responsive-draft-missing");
  }

  const schema = applyResponsiveLayoutOverride(
    normalizeBuilderPageSchema(draft.draft_schema),
    mode,
    {
      breakpointSafe: true,
      placeholderSpacing: "ready",
      placeholderTypography: "ready",
      updatedAt: new Date().toISOString()
    }
  );

  const { error } = await supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: schema,
      has_unsaved_changes: true,
      responsive_config: schema.responsive
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  if (error) {
    builderRedirect(storeId, "responsive-override-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "responsive-override-applied");
}
