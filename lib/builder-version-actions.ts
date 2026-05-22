"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import {
  compareBuilderVersions,
  layoutDiffPreparation,
  validateRollbackSafety
} from "@/lib/builder-version-utils";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
};

export type BuilderVersionHistoryRecord = {
  created_at: string;
  id: string;
  layout_diff: Record<string, unknown>;
  metadata: Record<string, unknown>;
  snapshot_label: string | null;
  snapshot_type: string;
};

export type BuilderPublishHistoryRecord = {
  builder_layout_version_id: string | null;
  created_at: string;
  id: string;
  publish_status: string;
  published_at: string;
  version_number: number | null;
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

async function getBuilderPage(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("builder_pages" as never)
    .select("id, active_version_id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();

  return data as { active_version_id?: string | null; id?: string } | null;
}

async function getDraft(supabase: SupabaseClient, pageId: string) {
  const { data } = await supabase
    .from("builder_drafts" as never)
    .select("id, draft_schema, layout_tree, responsive_config, editor_state")
    .eq("builder_page_id", pageId)
    .maybeSingle();

  return data as {
    draft_schema?: unknown;
    editor_state?: unknown;
    id?: string;
    layout_tree?: unknown;
    responsive_config?: unknown;
  } | null;
}

async function getPublishedLayout(supabase: SupabaseClient, pageId: string, versionId?: string | null) {
  let query = supabase
    .from("builder_layout_versions" as never)
    .select("id, version_number, layout_schema, layout_tree, responsive_config, published_at")
    .eq("builder_page_id", pageId)
    .eq("status", "published");

  query = versionId
    ? query.eq("id", versionId)
    : query.order("version_number", { ascending: false }).limit(1);

  const { data } = await query.maybeSingle();

  return data as {
    id?: string;
    layout_schema?: unknown;
    layout_tree?: unknown;
    published_at?: string | null;
    responsive_config?: unknown;
    version_number?: number;
  } | null;
}

export async function getBuilderVersionHistory(storeId: string) {
  const supabase = await createClient();
  const [{ data: snapshotData }, { data: publishData }] = await Promise.all([
    supabase
      .from("builder_version_snapshots" as never)
      .select("id, snapshot_type, snapshot_label, layout_diff, metadata, created_at")
      .eq("store_instance_id", storeId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("builder_publish_history" as never)
      .select("id, builder_layout_version_id, publish_status, version_number, published_at, created_at")
      .eq("store_instance_id", storeId)
      .order("published_at", { ascending: false })
      .limit(8)
  ]);

  return {
    publishHistory: Array.isArray(publishData)
      ? (publishData as BuilderPublishHistoryRecord[])
      : [],
    snapshots: Array.isArray(snapshotData)
      ? (snapshotData as BuilderVersionHistoryRecord[])
      : []
  };
}

export async function createBuilderSnapshot(formData: FormData) {
  const { storeId, supabase, userId } = await requireBuilderStore(formData);
  const snapshotType = cleanText(formData.get("snapshotType"), 40) === "published" ? "published" : "draft";
  const label = cleanText(formData.get("snapshotLabel"), 160) || `${snapshotType} snapshot`;
  const page = await getBuilderPage(supabase, storeId);

  if (!page?.id) {
    builderRedirect(storeId, "snapshot-page-missing");
  }

  const draft = await getDraft(supabase, page.id);
  const published = await getPublishedLayout(supabase, page.id, page.active_version_id ?? null);
  const sourceSchema =
    snapshotType === "published"
      ? normalizeBuilderPageSchema(published?.layout_schema)
      : normalizeBuilderPageSchema(draft?.draft_schema);

  if (!sourceSchema.sections.length) {
    builderRedirect(storeId, "snapshot-invalid");
  }

  const diff = layoutDiffPreparation(
    published?.layout_schema ? normalizeBuilderPageSchema(published.layout_schema) : null,
    sourceSchema
  );
  const { error } = await supabase.from("builder_version_snapshots" as never).insert({
    builder_draft_id: snapshotType === "draft" ? draft?.id ?? null : null,
    builder_layout_version_id: snapshotType === "published" ? published?.id ?? null : null,
    builder_page_id: page.id,
    editor_state: isRecord(draft?.editor_state) ? draft?.editor_state : {},
    layout_diff: diff,
    layout_schema: sourceSchema,
    layout_tree: sourceSchema.layoutTree,
    metadata: {
      future: ["collaborative_editing", "ai_generated_snapshots", "visual_version_diff"],
      source: "manual_snapshot"
    },
    owner_user_id: userId,
    responsive_config: sourceSchema.responsive,
    schema_version: sourceSchema.version,
    snapshot_label: label,
    snapshot_type: snapshotType,
    store_instance_id: storeId
  } as never);

  if (error) {
    builderRedirect(storeId, "snapshot-failed");
  }

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "snapshot-created");
}

export async function restoreBuilderVersion(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const snapshotId = cleanText(formData.get("snapshotId"), 80);

  if (!snapshotId) {
    builderRedirect(storeId, "restore-version-missing");
  }

  const page = await getBuilderPage(supabase, storeId);

  if (!page?.id) {
    builderRedirect(storeId, "restore-version-page-missing");
  }

  const draft = await getDraft(supabase, page.id);

  if (!draft?.id) {
    builderRedirect(storeId, "restore-version-draft-missing");
  }

  const { data: snapshotData } = await supabase
    .from("builder_version_snapshots" as never)
    .select("id, store_instance_id, layout_schema")
    .eq("id", snapshotId)
    .eq("store_instance_id", storeId)
    .maybeSingle();
  const snapshot = snapshotData as { layout_schema?: unknown; store_instance_id?: string } | null;
  const schema = snapshot ? normalizeBuilderPageSchema(snapshot.layout_schema) : null;
  const safety = validateRollbackSafety({
    currentStoreId: storeId,
    snapshotStoreId: snapshot?.store_instance_id ?? "",
    targetSchema: schema
  });

  if (!safety.valid || !schema) {
    builderRedirect(storeId, "restore-version-unsafe");
  }

  const { error } = await supabase
    .from("builder_drafts" as never)
    .update({
      draft_schema: schema,
      editor_state: {
        ...(isRecord(draft.editor_state) ? draft.editor_state : {}),
        previewSyncPending: true,
        restoredFromSnapshotId: snapshotId,
        source: "builder_version_restore"
      },
      has_unsaved_changes: true,
      layout_tree: schema.layoutTree,
      responsive_config: schema.responsive
    } as never)
    .eq("id", draft.id)
    .eq("store_instance_id", storeId);

  if (error) {
    builderRedirect(storeId, "restore-version-failed");
  }

  await supabase.from("builder_publish_history" as never).insert({
    builder_page_id: page.id,
    metadata: {
      restoredSnapshotId: snapshotId,
      target: "draft_only"
    },
    publish_status: "restored",
    store_instance_id: storeId
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "restore-version-complete");
}

export async function compareBuilderVersionsAction(formData: FormData) {
  const { storeId, supabase } = await requireBuilderStore(formData);
  const leftSnapshotId = cleanText(formData.get("leftSnapshotId"), 80);
  const rightSnapshotId = cleanText(formData.get("rightSnapshotId"), 80);

  if (!leftSnapshotId || !rightSnapshotId) {
    builderRedirect(storeId, "compare-version-missing");
  }

  const { data } = await supabase
    .from("builder_version_snapshots" as never)
    .select("id, layout_schema")
    .eq("store_instance_id", storeId)
    .in("id", [leftSnapshotId, rightSnapshotId] as never);
  const rows = Array.isArray(data) ? (data as Array<{ id: string; layout_schema?: unknown }>) : [];
  const left = rows.find((row) => row.id === leftSnapshotId);
  const right = rows.find((row) => row.id === rightSnapshotId);

  if (!left || !right) {
    builderRedirect(storeId, "compare-version-missing");
  }

  const diff = compareBuilderVersions(
    normalizeBuilderPageSchema(left.layout_schema),
    normalizeBuilderPageSchema(right.layout_schema)
  );

  await supabase.from("builder_version_snapshots" as never).insert({
    layout_diff: {
      ...diff,
      comparedSnapshotIds: [leftSnapshotId, rightSnapshotId]
    },
    layout_schema: normalizeBuilderPageSchema(right.layout_schema),
    metadata: {
      source: "version_compare_placeholder"
    },
    snapshot_label: "Version comparison placeholder",
    snapshot_type: "auto_save",
    store_instance_id: storeId
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "compare-version-ready");
}
