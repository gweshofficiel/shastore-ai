"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkDeploymentHealth,
  resolveFeatureFlags,
  resolveRuntimeEnvironment,
  trackDeploymentRuntime,
  validateProductionEnvironment
} from "@/lib/deployment-hardening";
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

async function requireDeploymentContext(formData: FormData) {
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
    builderRedirect(storeId, "deployment-not-authorized");
  }

  return {
    store,
    storeId,
    supabase,
    userId: user.id
  };
}

export async function prepareDeploymentHardeningAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireDeploymentContext(formData);
  const production = validateProductionEnvironment();
  const runtime = resolveRuntimeEnvironment();
  const health = checkDeploymentHealth();
  const flags = resolveFeatureFlags();
  const runtimeLog = trackDeploymentRuntime({
    logKey: "deployment_hardening_prepared",
    scope: "deployment",
    status: runtime.runtimeStatus
  });

  await Promise.all([
    supabase.from("runtime_environment_states" as never).upsert(
      {
        app_base_url: runtime.appBaseUrl,
        cache_state: runtime.cacheState,
        environment_mode: runtime.environmentMode,
        hydration_state: runtime.hydrationState,
        metadata: {
          edgeRuntimeOptimizationReady: true,
          vercelProductionDeploymentReady: true
        },
        middleware_state: runtime.middlewareState,
        optional_env_state: runtime.optionalEnvState,
        owner_user_id: userId,
        required_env_state: runtime.requiredEnvState,
        runtime_status: runtime.runtimeStatus,
        secret_validation_state: runtime.secretValidationState,
        store_instance_id: storeId,
        updated_at: new Date().toISOString()
      } as never,
      { onConflict: "store_instance_id,environment_mode" }
    ),
    ...health.checks.map((check) =>
      supabase.from("deployment_health_checks" as never).insert({
        blocking_errors: check.status === "blocked" ? production.missingRequired : [],
        check_key: check.key,
        check_payload: {
          environmentMode: runtime.environmentMode,
          status: check.status
        },
        check_scope: check.scope,
        check_status: check.status,
        metadata: {
          startupValidationReady: true
        },
        owner_user_id: userId,
        store_instance_id: storeId,
        warnings: production.warnings
      } as never)
    ),
    ...flags.map((flag) =>
      supabase.from("production_feature_flags" as never).upsert(
        {
          fallback_value: flag.fallbackValue,
          flag_enabled: flag.flagEnabled,
          flag_key: flag.flagKey,
          flag_scope: flag.flagScope,
          metadata: flag.metadata,
          owner_user_id: userId,
          rollout_state: flag.rolloutState,
          store_instance_id: storeId,
          updated_at: new Date().toISOString()
        } as never,
        { onConflict: "store_instance_id,flag_key" }
      )
    ),
    supabase.from("deployment_runtime_logs" as never).insert({
      log_key: runtimeLog.logKey,
      log_level: runtimeLog.logLevel,
      log_payload: runtimeLog.logPayload,
      log_scope: runtimeLog.logScope,
      metadata: {
        deploymentSafeEnvironmentLoading: true,
        productionSafeRuntimeFallbacks: true
      },
      owner_user_id: userId,
      store_instance_id: storeId
    } as never)
  ]);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, health.healthStatus === "healthy" ? "deployment-hardening-ready" : "deployment-hardening-degraded");
}

export async function recordDeploymentRuntimeAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireDeploymentContext(formData);
  const logKey = cleanText(formData.get("logKey"), 120) || "deployment_runtime_snapshot";
  const runtime = resolveRuntimeEnvironment();
  const runtimeLog = trackDeploymentRuntime({
    logKey,
    scope: "health",
    status: runtime.runtimeStatus
  });

  await supabase.from("deployment_runtime_logs" as never).insert({
    log_key: runtimeLog.logKey,
    log_level: runtimeLog.logLevel,
    log_payload: runtimeLog.logPayload,
    log_scope: runtimeLog.logScope,
    metadata: {
      manualDashboardEvent: true
    },
    owner_user_id: userId,
    store_instance_id: storeId
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "deployment-runtime-recorded");
}
