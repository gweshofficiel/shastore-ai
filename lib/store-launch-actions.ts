"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { layoutDiffPreparation } from "@/lib/builder-version-utils";
import { assertStoreMutationAllowed } from "@/lib/billing/store-access";
import {
  getLaunchStatus,
  getStoreLaunchReadiness,
  publishStorefrontDraft,
  recordLaunchEvent,
  rollbackLaunchPublish,
  validateStoreBeforeLaunch
} from "@/lib/store-launch";
import { normalizeBuilderPageSchema, type BuilderPageSchema } from "@/lib/storefront/builder";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  connected_domain?: string | null;
  id: string;
  internal_slug?: string | null;
  requested_domain?: string | null;
  status?: string | null;
  visibility?: string | null;
};

type LaunchContext = {
  activeTheme: Record<string, unknown>;
  activeVersion: { id: string | null; schema: BuilderPageSchema | null; versionNumber: number };
  domains: Record<string, unknown>[];
  draft: { draft_schema?: unknown; editor_state?: unknown; has_unsaved_changes?: boolean; id?: string } | null;
  page: { active_version_id?: string | null; id?: string } | null;
  store: ClaimedStoreRow;
  storeId: string;
  supabase: SupabaseClient;
  userId: string;
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

async function requireLaunchContext(formData: FormData): Promise<LaunchContext> {
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

  const store = await getClaimedStore(supabase, storeId);

  if (!store) {
    builderRedirect(storeId, "launch-not-authorized");
  }

  const [{ data: pageData }, { data: themeData }, { data: domainsData }] = await Promise.all([
    supabase
      .from("builder_pages" as never)
      .select("id, active_version_id")
      .eq("store_instance_id", storeId)
      .eq("page_key", "home")
      .maybeSingle(),
    supabase
      .from("store_themes" as never)
      .select("theme_id, theme_key, color_palette, typography, layout_key")
      .eq("store_instance_id", storeId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("store_domains" as never)
      .select("id, hostname, subdomain, custom_domain, is_primary, dns_status, ssl_status")
      .eq("store_instance_id", storeId)
      .order("is_primary", { ascending: false })
      .limit(5)
  ]);
  const page = pageData as { active_version_id?: string | null; id?: string } | null;
  const { data: draftData } = page?.id
    ? await supabase
        .from("builder_drafts" as never)
        .select("id, draft_schema, editor_state, has_unsaved_changes")
        .eq("builder_page_id", page.id)
        .maybeSingle()
    : { data: null };
  const draft = draftData as LaunchContext["draft"];
  const { data: activeVersionData } = page?.id
    ? await supabase
        .from("builder_layout_versions" as never)
        .select("id, version_number, layout_schema")
        .eq("builder_page_id", page.id)
        .eq("status", "published")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const activeVersionRow = activeVersionData as {
    id?: string;
    layout_schema?: unknown;
    version_number?: number;
  } | null;

  return {
    activeTheme: isRecord(themeData) ? (themeData as Record<string, unknown>) : {},
    activeVersion: {
      id: activeVersionRow?.id ?? null,
      schema: activeVersionRow?.layout_schema
        ? normalizeBuilderPageSchema(activeVersionRow.layout_schema)
        : null,
      versionNumber: typeof activeVersionRow?.version_number === "number" ? activeVersionRow.version_number : 0
    },
    domains: Array.isArray(domainsData) ? (domainsData as Record<string, unknown>[]) : [],
    draft,
    page,
    store,
    storeId,
    supabase,
    userId: user.id
  };
}

function buildReadinessContext(context: LaunchContext) {
  return {
    activeTheme: context.activeTheme,
    activeVersionId: context.activeVersion.id,
    builderDraftSchema: context.draft?.draft_schema,
    connectedDomain: context.store.connected_domain ?? context.store.requested_domain ?? null,
    domains: context.domains,
    storeStatus: context.store.status,
    storeVisibility: context.store.visibility
  };
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

async function recordChecklist(context: LaunchContext, statusOverride?: string) {
  const readiness = getStoreLaunchReadiness(buildReadinessContext(context));
  const { data } = await context.supabase
    .from("store_launch_checklists" as never)
    .insert({
      active_version_id: context.activeVersion.id,
      blocking_reasons: readiness.blockingReasons,
      builder_draft_id: context.draft?.id ?? null,
      builder_page_id: context.page?.id ?? null,
      checklist_items: readiness.items,
      checklist_status: statusOverride ?? readiness.checklistStatus,
      completed_at: readiness.blockingReasons.length ? null : new Date().toISOString(),
      launch_metadata: {
        future: ["scheduled_publishing", "launch_email_notifications", "launch_analytics", "launch_qa_automation"],
        launchStatus: getLaunchStatus(buildReadinessContext(context))
      },
      owner_user_id: context.userId,
      readiness_score: readiness.readinessScore,
      store_instance_id: context.storeId
    } as never)
    .select("id")
    .maybeSingle();

  return {
    checklistId: data ? (data as { id?: string }).id ?? null : null,
    readiness
  };
}

async function insertLaunchEvent(
  context: LaunchContext,
  checklistId: string | null,
  event: ReturnType<typeof recordLaunchEvent>,
  versionId?: string | null
) {
  await context.supabase.from("store_launch_events" as never).insert({
    builder_layout_version_id: versionId ?? context.activeVersion.id,
    builder_page_id: context.page?.id ?? null,
    checklist_id: checklistId,
    event_payload: event.eventPayload,
    event_status: event.eventStatus,
    event_type: event.eventType,
    metadata: event.metadata,
    owner_user_id: context.userId,
    rollback_payload: event.rollbackPayload,
    store_instance_id: context.storeId
  } as never);
}

async function insertValidation(context: LaunchContext, checklistId: string | null) {
  const validation = validateStoreBeforeLaunch(buildReadinessContext(context));

  await context.supabase.from("store_publish_validations" as never).insert({
    blocking_errors: validation.blockingReasons,
    builder_draft_id: context.draft?.id ?? null,
    builder_page_id: context.page?.id ?? null,
    checklist_id: checklistId,
    metadata: {
      draftPreviewIsolated: true,
      publicStorefrontUsesPublishedVisibility: true
    },
    owner_user_id: context.userId,
    store_instance_id: context.storeId,
    validation_results: validation.items,
    validation_status: validation.validationStatus,
    warnings: validation.warnings
  } as never);

  return validation;
}

export async function refreshStoreLaunchReadinessAction(formData: FormData) {
  const context = await requireLaunchContext(formData);
  const { checklistId, readiness } = await recordChecklist(context);
  await insertValidation(context, checklistId);
  await insertLaunchEvent(
    context,
    checklistId,
    recordLaunchEvent({
      eventType: "readiness_checked",
      payload: { readinessScore: readiness.readinessScore },
      status: readiness.blockingReasons.length ? "blocked" : "succeeded"
    })
  );

  revalidatePath(builderPath(context.storeId));
  builderRedirect(context.storeId, readiness.blockingReasons.length ? "launch-readiness-blocked" : "launch-ready");
}

export async function publishStorefrontDraftAction(formData: FormData) {
  const context = await requireLaunchContext(formData);
  try {
    await assertStoreMutationAllowed(context.supabase, context.userId, { id: context.storeId });
  } catch {
    builderRedirect(context.storeId, "store-locked-by-plan");
  }

  const { checklistId } = await recordChecklist(context);
  const validation = await insertValidation(context, checklistId);

  if (!validation.canLaunch) {
    await insertLaunchEvent(
      context,
      checklistId,
      recordLaunchEvent({
        eventType: "validation_failed",
        payload: { blockingReasons: validation.blockingReasons },
        status: "blocked"
      })
    );
    builderRedirect(context.storeId, "launch-validation-blocked");
  }

  if (!context.page?.id || !context.draft?.id) {
    builderRedirect(context.storeId, "launch-draft-missing");
  }

  const published = publishStorefrontDraft(normalizeBuilderPageSchema(context.draft.draft_schema));

  if (published.validation.errors.length) {
    builderRedirect(context.storeId, "launch-validation-blocked");
  }

  const versionNumber = await nextVersionNumber(context.supabase, context.page.id);
  const { data: versionData, error: versionError } = await context.supabase
    .from("builder_layout_versions" as never)
    .insert({
      builder_page_id: context.page.id,
      layout_schema: published.schema,
      layout_tree: published.schema.layoutTree,
      owner_user_id: context.userId,
      published_at: new Date().toISOString(),
      responsive_config: published.schema.responsive,
      status: "published",
      store_instance_id: context.storeId,
      version_number: versionNumber
    } as never)
    .select("id")
    .single();

  if (versionError || !versionData) {
    builderRedirect(context.storeId, "launch-publish-failed");
  }

  const versionId = (versionData as { id: string }).id;
  const previousVisibility = context.store.visibility ?? "private";
  const { error: pageError } = await context.supabase
    .from("builder_pages" as never)
    .update({
      active_version_id: versionId,
      schema_version: published.schema.version,
      status: "published"
    } as never)
    .eq("id", context.page.id)
    .eq("store_instance_id", context.storeId);

  if (pageError) {
    await context.supabase.from("builder_layout_versions" as never).delete().eq("id", versionId);
    builderRedirect(context.storeId, "launch-publish-failed");
  }

  const publicationResult = await context.supabase.rpc(
    "set_storefront_publication_state" as never,
    {
      candidate_store_instance_id: context.storeId,
      publish_store: true
    } as never
  );

  if (publicationResult.error) {
    await context.supabase
      .from("builder_pages" as never)
      .update({
        active_version_id: context.activeVersion.id,
        status: context.activeVersion.id ? "published" : "draft"
      } as never)
      .eq("id", context.page.id)
      .eq("store_instance_id", context.storeId);
    await context.supabase.from("builder_layout_versions" as never).delete().eq("id", versionId);
    builderRedirect(context.storeId, "launch-publish-failed");
  }

  await context.supabase
    .from("builder_drafts" as never)
    .update({
      editor_state: {
        ...(isRecord(context.draft.editor_state) ? context.draft.editor_state : {}),
        lastLaunchPublishedAt: new Date().toISOString(),
        launchVersionId: versionId,
        previewSyncPending: false,
        source: "store_launch_flow"
      },
      has_unsaved_changes: false
    } as never)
    .eq("id", context.draft.id)
    .eq("store_instance_id", context.storeId);

  const snapshot = await context.supabase
    .from("builder_version_snapshots" as never)
    .insert({
      builder_draft_id: context.draft.id,
      builder_layout_version_id: versionId,
      builder_page_id: context.page.id,
      editor_state: isRecord(context.draft.editor_state) ? context.draft.editor_state : {},
      layout_diff: layoutDiffPreparation(context.activeVersion.schema, published.schema),
      layout_schema: published.schema,
      layout_tree: published.schema.layoutTree,
      metadata: {
        source: "store_launch_flow",
        versionNumber
      },
      owner_user_id: context.userId,
      responsive_config: published.schema.responsive,
      schema_version: published.schema.version,
      snapshot_label: `Launch version ${versionNumber}`,
      snapshot_type: "published",
      store_instance_id: context.storeId
    } as never)
    .select("id")
    .maybeSingle();

  await Promise.all([
    context.supabase.from("builder_publish_history" as never).insert({
      builder_layout_version_id: versionId,
      builder_page_id: context.page.id,
      metadata: { source: "store_launch_flow" },
      owner_user_id: context.userId,
      publish_status: "published",
      published_at: new Date().toISOString(),
      snapshot_id: snapshot.data ? (snapshot.data as { id?: string }).id ?? null : null,
      store_instance_id: context.storeId,
      version_number: versionNumber
    } as never),
    context.supabase
      .from("store_launch_checklists" as never)
      .update({
        active_version_id: versionId,
        checklist_status: "launched",
        completed_at: new Date().toISOString()
      } as never)
      .eq("id", checklistId ?? "")
      .eq("store_instance_id", context.storeId),
    insertLaunchEvent(
      context,
      checklistId,
      recordLaunchEvent({
        eventType: "store_launched",
        payload: {
          previousVisibility,
          versionId,
          versionNumber
        },
        rollbackPayload: rollbackLaunchPublish(previousVisibility),
        status: "succeeded"
      }),
      versionId
    )
  ]);

  revalidatePath(builderPath(context.storeId));
  revalidatePath(`/store/${context.store.internal_slug ?? context.storeId}`);
  builderRedirect(context.storeId, "launch-complete");
}

export async function rollbackLaunchPublishAction(formData: FormData) {
  const context = await requireLaunchContext(formData);
  const rollback = rollbackLaunchPublish("private");
  const { checklistId } = await recordChecklist(context, "rolled_back");

  await context.supabase.rpc(
    "set_storefront_publication_state" as never,
    {
      candidate_store_instance_id: context.storeId,
      publish_store: false
    } as never
  );

  await insertLaunchEvent(
    context,
    checklistId,
    recordLaunchEvent({
      eventType: "rollback_requested",
      payload: { rollback },
      rollbackPayload: rollback,
      status: "recorded"
    })
  );

  revalidatePath(builderPath(context.storeId));
  builderRedirect(context.storeId, "launch-rollback-prepared");
}
