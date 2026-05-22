"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAIDraftSnapshot,
  previewAIChanges,
  rejectAISuggestion,
  rollbackAIApplication,
  validateAISuggestionPatch
} from "@/lib/ai-draft-application";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import { getTemplateLibrary, mapTemplateToBuilderDraft } from "@/lib/storefront/template-library";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

const templatePagePath = "/dashboard/templates";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function applicationRedirect(status: string, storeId?: string, templateId?: string): never {
  const params = new URLSearchParams({ templateApply: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  if (templateId) {
    params.set("templateId", templateId);
  }

  redirect(`${templatePagePath}?${params.toString()}`);
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

async function requireApplicationContext(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const templateId = cleanText(formData.get("templateId"), 120);

  if (!storeId || !templateId) {
    applicationRedirect("ai-application-missing", storeId, templateId);
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(templatePagePath)}`);
  }

  const claimedStore = await getClaimedStore(supabase, storeId);

  if (!claimedStore) {
    applicationRedirect("not-authorized", storeId, templateId);
  }

  const library = await getTemplateLibrary();
  const template = library.templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    applicationRedirect("template-missing", storeId, templateId);
  }

  return { storeId, supabase, template, templateId, userId: user.id };
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

async function latestCustomization(supabase: SupabaseClient, storeId: string, templateId: string) {
  const { data } = await supabase
    .from("ai_template_customizations" as never)
    .select("id, suggested_changes")
    .eq("store_instance_id", storeId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id?: string; suggested_changes?: unknown } | null;
}

export async function previewAIChangesAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireApplicationContext(formData);
  const customization = await latestCustomization(supabase, storeId, templateId);

  if (!customization?.id || !customization.suggested_changes) {
    applicationRedirect("ai-application-no-suggestion", storeId, templateId);
  }

  const { draft, page } = await getBuilderDraft(supabase, storeId);
  const currentDraft = draft?.draft_schema
    ? normalizeBuilderPageSchema(draft.draft_schema)
    : mapTemplateToBuilderDraft(template);
  const preview = previewAIChanges(currentDraft, customization.suggested_changes);
  const { data: applicationData, error } = await supabase
    .from("ai_draft_applications" as never)
    .insert({
      after_snapshot: createAIDraftSnapshot(preview.after, { source: "ai_preview_after" }),
      application_status: "preview",
      before_snapshot: createAIDraftSnapshot(preview.before, { source: "ai_preview_before" }),
      builder_draft_id: draft?.id ?? null,
      builder_page_id: page?.id ?? null,
      customization_id: customization.id,
      metadata: {
        draftOnly: true,
        partialApplyReady: true,
        source: "ai_changes_preview"
      },
      owner_user_id: userId,
      rollback_snapshot: createAIDraftSnapshot(preview.before, { source: "ai_rollback_snapshot" }),
      store_instance_id: storeId
    } as never)
    .select("id")
    .single();

  if (error || !applicationData) {
    applicationRedirect("ai-application-preview-failed", storeId, templateId);
  }

  const applicationId = (applicationData as { id: string }).id;

  await Promise.all([
    supabase.from("ai_change_previews" as never).insert({
      blocked_patch: preview.blockedPatch,
      customization_id: customization.id,
      diff_summary: preview.diffSummary,
      draft_application_id: applicationId,
      draft_sync_state: {
        previewReady: true,
        syncedToDraft: false
      },
      metadata: {
        future: ["ai_visual_editing", "conversion_optimization", "multilingual_storefronts"]
      },
      owner_user_id: userId,
      patch_preview: customization.suggested_changes,
      safe_patch: preview.safePatch,
      store_instance_id: storeId
    } as never),
    supabase.from("ai_suggestion_reviews" as never).insert({
      customization_id: customization.id,
      draft_application_id: applicationId,
      metadata: {
        partialApplyPlaceholder: true
      },
      owner_user_id: userId,
      partial_apply_config: {
        allowedScopes: ["copy_only", "branding_only", "layout_recommendations"]
      },
      reviewed_fields: [],
      store_instance_id: storeId
    } as never)
  ]);

  revalidatePath(templatePagePath);
  applicationRedirect("ai-application-preview-created", storeId, templateId);
}

export async function applyAISuggestionToDraftAction(formData: FormData) {
  const { storeId, supabase, template, templateId, userId } =
    await requireApplicationContext(formData);
  const customization = await latestCustomization(supabase, storeId, templateId);

  if (!customization?.id || !customization.suggested_changes) {
    applicationRedirect("ai-application-no-suggestion", storeId, templateId);
  }

  const validation = validateAISuggestionPatch(customization.suggested_changes);

  if (!validation.valid) {
    applicationRedirect("ai-application-invalid", storeId, templateId);
  }

  const { draft, page } = await getBuilderDraft(supabase, storeId);

  if (!page?.id) {
    applicationRedirect("ai-application-draft-missing", storeId, templateId);
  }

  const currentDraft = draft?.draft_schema
    ? normalizeBuilderPageSchema(draft.draft_schema)
    : mapTemplateToBuilderDraft(template);
  const preview = previewAIChanges(currentDraft, customization.suggested_changes);

  const { data: applicationData, error: applicationError } = await supabase
    .from("ai_draft_applications" as never)
    .insert({
      after_snapshot: createAIDraftSnapshot(preview.after, { source: "ai_application_after" }),
      application_status: "applied",
      applied_at: new Date().toISOString(),
      applied_fields: ["hero_text", "cta", "branding", "section_copy", "layout_recommendations"],
      before_snapshot: createAIDraftSnapshot(preview.before, { source: "ai_application_before" }),
      builder_draft_id: draft?.id ?? null,
      builder_page_id: page.id,
      customization_id: customization.id,
      metadata: {
        directPublishAllowed: false,
        draftOnly: true,
        destructiveOverwrite: false
      },
      owner_user_id: userId,
      rollback_snapshot: createAIDraftSnapshot(preview.before, { source: "ai_application_rollback" }),
      store_instance_id: storeId
    } as never)
    .select("id")
    .single();

  if (applicationError || !applicationData) {
    applicationRedirect("ai-application-failed", storeId, templateId);
  }

  const applicationId = (applicationData as { id: string }).id;
  const editorState =
    draft?.editor_state && typeof draft.editor_state === "object" && !Array.isArray(draft.editor_state)
      ? (draft.editor_state as Record<string, unknown>)
      : {};
  const { error } = await supabase.from("builder_drafts" as never).upsert(
    {
      builder_page_id: page.id,
      draft_schema: preview.after,
      editor_state: {
        ...editorState,
        aiDraftApplicationId: applicationId,
        mode: "desktop",
        previewSyncPending: true,
        source: "ai_draft_application",
        templateId
      },
      has_unsaved_changes: true,
      layout_tree: preview.after.layoutTree,
      owner_user_id: userId,
      responsive_config: preview.after.responsive,
      store_instance_id: storeId
    } as never,
    { onConflict: "builder_page_id" }
  );

  if (error) {
    applicationRedirect("ai-application-failed", storeId, templateId);
  }

  await Promise.all([
    supabase.from("ai_change_previews" as never).insert({
      customization_id: customization.id,
      diff_summary: preview.diffSummary,
      draft_application_id: applicationId,
      draft_sync_state: {
        previewReady: true,
        syncedToDraft: true,
        syncedAt: new Date().toISOString()
      },
      owner_user_id: userId,
      preview_status: "applied",
      safe_patch: preview.safePatch,
      store_instance_id: storeId
    } as never),
    supabase.from("ai_suggestion_reviews" as never).insert({
      customization_id: customization.id,
      draft_application_id: applicationId,
      owner_user_id: userId,
      review_status: "accepted",
      reviewed_at: new Date().toISOString(),
      reviewed_fields: ["hero_text", "cta", "branding", "section_copy"],
      store_instance_id: storeId
    } as never)
  ]);

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("ai-application-applied", storeId, templateId);
}

export async function rejectAISuggestionAction(formData: FormData) {
  const { storeId, supabase, templateId, userId } = await requireApplicationContext(formData);
  const customization = await latestCustomization(supabase, storeId, templateId);

  if (!customization?.id) {
    applicationRedirect("ai-application-no-suggestion", storeId, templateId);
  }

  const rejection = rejectAISuggestion(cleanText(formData.get("reason"), 240) || "Rejected in AI review UI.");
  await supabase.from("ai_suggestion_reviews" as never).insert({
    customization_id: customization.id,
    metadata: rejection,
    owner_user_id: userId,
    rejected_fields: ["all"],
    review_notes: rejection.reason,
    review_status: "rejected",
    reviewed_at: rejection.rejectedAt,
    store_instance_id: storeId
  } as never);

  await supabase
    .from("ai_template_customizations" as never)
    .update({ customization_status: "archived" } as never)
    .eq("id", customization.id)
    .eq("store_instance_id", storeId);

  revalidatePath(templatePagePath);
  applicationRedirect("ai-application-rejected", storeId, templateId);
}

export async function rollbackAIApplicationAction(formData: FormData) {
  const { storeId, supabase, templateId, userId } = await requireApplicationContext(formData);
  const applicationId = cleanText(formData.get("applicationId"), 80);

  if (!applicationId) {
    applicationRedirect("ai-application-rollback-missing", storeId, templateId);
  }

  const { data: applicationData } = await supabase
    .from("ai_draft_applications" as never)
    .select("id, builder_page_id, rollback_snapshot")
    .eq("id", applicationId)
    .eq("store_instance_id", storeId)
    .maybeSingle();
  const application = applicationData as {
    builder_page_id?: string | null;
    id?: string;
    rollback_snapshot?: unknown;
  } | null;

  if (!application?.id || !application.builder_page_id) {
    applicationRedirect("ai-application-rollback-missing", storeId, templateId);
  }

  const schema = rollbackAIApplication(application.rollback_snapshot);
  const { error } = await supabase.from("builder_drafts" as never).upsert(
    {
      builder_page_id: application.builder_page_id,
      draft_schema: schema,
      editor_state: {
        aiRollbackApplicationId: application.id,
        mode: "desktop",
        previewSyncPending: true,
        source: "ai_application_rollback"
      },
      has_unsaved_changes: true,
      layout_tree: schema.layoutTree,
      owner_user_id: userId,
      responsive_config: schema.responsive,
      store_instance_id: storeId
    } as never,
    { onConflict: "builder_page_id" }
  );

  if (error) {
    applicationRedirect("ai-application-rollback-failed", storeId, templateId);
  }

  await supabase
    .from("ai_draft_applications" as never)
    .update({ application_status: "rolled_back" } as never)
    .eq("id", application.id)
    .eq("store_instance_id", storeId);

  revalidatePath(templatePagePath);
  revalidatePath(`/dashboard/stores/${storeId}`);
  applicationRedirect("ai-application-rolled-back", storeId, templateId);
}
