"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cacheStorefrontRender,
  getCachedStorefrontRuntime,
  invalidateStorefrontCache,
  optimizePreviewRender,
  resolveTenantRuntimeState,
  trackRuntimePerformance
} from "@/lib/runtime-optimization";
import { normalizeBuilderPageSchema } from "@/lib/storefront/builder";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  owner_user_id?: string | null;
};

const builderPath = (storeId: string) => `/dashboard/stores/${storeId}`;

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function builderRedirect(storeId: string, status: string): never {
  redirect(`${builderPath(storeId)}?builder=${encodeURIComponent(status)}#overview`);
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

async function requireRuntimeContext(formData: FormData) {
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
    builderRedirect(storeId, "runtime-optimization-not-authorized");
  }

  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id, active_version_id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData as { active_version_id?: string | null; id?: string } | null;
  const { data: draftData } = page?.id
    ? await supabase
        .from("builder_drafts" as never)
        .select("id, draft_schema")
        .eq("builder_page_id", page.id)
        .maybeSingle()
    : { data: null };
  const draft = draftData as { draft_schema?: unknown; id?: string } | null;
  const { data: versionData } = page?.id
    ? await supabase
        .from("builder_layout_versions" as never)
        .select("id, layout_schema")
        .eq("builder_page_id", page.id)
        .eq("status", "published")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const version = versionData as { id?: string; layout_schema?: unknown } | null;

  return {
    draft,
    page,
    store,
    storeId,
    supabase,
    userId: user.id,
    version
  };
}

export async function prepareRuntimeOptimizationAction(formData: FormData) {
  const { draft, page, store, storeId, supabase, userId, version } =
    await requireRuntimeContext(formData);
  const mode = cleanText(formData.get("mode"), 20) || "desktop";
  const publishedSchema = normalizeBuilderPageSchema(version?.layout_schema ?? draft?.draft_schema);
  const draftSchema = normalizeBuilderPageSchema(draft?.draft_schema ?? publishedSchema);
  const existingCache = await supabase
    .from("storefront_runtime_cache" as never)
    .select("cache_key, cache_status, expires_at, render_payload")
    .eq("store_instance_id", storeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cacheState = getCachedStorefrontRuntime(existingCache.data as never);
  const storefrontCache = cacheStorefrontRender({
    activeVersionId: version?.id ?? page?.active_version_id ?? null,
    schema: publishedSchema,
    storeId
  });
  const previewOptimization = optimizePreviewRender({ mode, schema: draftSchema });
  const tenantState = resolveTenantRuntimeState({
    mode,
    schema: publishedSchema,
    storeId,
    tenantKey: store.internal_slug ?? storeId
  });
  const perf = trackRuntimePerformance({
    cacheHit: cacheState.cacheHit,
    durationMs: 0,
    renderCount: publishedSchema.sections.length,
    scope: "storefront"
  });

  await Promise.all([
    supabase.from("storefront_runtime_cache" as never).insert({
      builder_layout_version_id: version?.id ?? page?.active_version_id ?? null,
      builder_page_id: page?.id ?? null,
      cache_key: storefrontCache.cacheKey,
      cache_scope: "published_storefront",
      cache_status: "fresh",
      expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      hydration_payload: storefrontCache.hydrationPayload,
      memoization_state: storefrontCache.memoizationState,
      metadata: {
        cdnReady: true,
        edgeRenderingReady: true,
        publishedStorefrontRenderingUnchanged: true
      },
      owner_user_id: userId,
      render_payload: storefrontCache.renderPayload,
      store_instance_id: storeId
    } as never),
    supabase.from("preview_runtime_cache" as never).insert({
      builder_draft_id: draft?.id ?? null,
      builder_page_id: page?.id ?? null,
      cache_key: previewOptimization.cacheKey,
      cache_status: previewOptimization.runtimeStatus === "ready" ? "fresh" : "error",
      expires_at: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
      hydration_payload: previewOptimization.hydrationState,
      isolation_payload: previewOptimization.isolationState,
      metadata: {
        builderPerformanceIsolated: true,
        realtimePreviewScalingReady: true
      },
      owner_user_id: userId,
      preview_mode: previewOptimization.responsiveState.activeMode,
      render_payload: previewOptimization.renderTree,
      responsive_payload: previewOptimization.responsiveState,
      store_instance_id: storeId
    } as never),
    supabase.from("tenant_render_states" as never).upsert(
      {
        cache_state: tenantState.cacheState,
        hydration_state: tenantState.hydrationState,
        isolation_state: tenantState.isolationState,
        memoization_state: tenantState.memoizationState,
        metadata: {
          aiRenderOptimizationReady: true,
          analyticsInstrumentationReady: true,
          tenantIsolationCoreUnchanged: true
        },
        owner_user_id: userId,
        responsive_state: tenantState.responsiveState,
        runtime_status: tenantState.runtimeStatus,
        store_instance_id: storeId,
        tenant_key: tenantState.tenantKey,
        updated_at: new Date().toISOString()
      } as never,
      { onConflict: "store_instance_id" }
    ),
    supabase.from("runtime_performance_logs" as never).insert({
      cache_hit: perf.cacheHit,
      duration_ms: perf.durationMs,
      event_status: perf.eventStatus,
      event_type: perf.eventType,
      metadata: {
        source: "runtime_optimization_prepare"
      },
      owner_user_id: userId,
      performance_payload: perf.performancePayload,
      render_count: perf.renderCount,
      runtime_scope: perf.runtimeScope,
      store_instance_id: storeId
    } as never)
  ]);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "runtime-optimization-prepared");
}

export async function invalidateRuntimeCacheAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireRuntimeContext(formData);
  const invalidation = invalidateStorefrontCache(cleanText(formData.get("reason"), 120) || "manual_refresh");

  await Promise.all([
    supabase
      .from("storefront_runtime_cache" as never)
      .update({
        cache_status: "invalidated",
        invalidation_state: invalidation,
        updated_at: new Date().toISOString()
      } as never)
      .eq("store_instance_id", storeId),
    supabase
      .from("preview_runtime_cache" as never)
      .update({
        cache_status: "invalidated",
        updated_at: new Date().toISOString()
      } as never)
      .eq("store_instance_id", storeId),
    supabase.from("runtime_performance_logs" as never).insert({
      cache_hit: false,
      duration_ms: 0,
      event_status: "recorded",
      event_type: "cache_invalidated",
      owner_user_id: userId,
      performance_payload: invalidation,
      render_count: 0,
      runtime_scope: "storefront",
      store_instance_id: storeId
    } as never)
  ]);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "runtime-cache-invalidated");
}
