"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyRateLimit,
  detectAbusePattern,
  throttleBuilderMutations,
  trackSecurityEvent,
  validateSecureMutation,
  validateTenantAction
} from "@/lib/security-protection";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
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

async function requireSecurityContext(formData: FormData) {
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
    builderRedirect(storeId, "security-not-authorized");
  }

  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const page = pageData as { id?: string } | null;
  const { data: draftData } = page?.id
    ? await supabase
        .from("builder_drafts" as never)
        .select("id, draft_schema")
        .eq("builder_page_id", page.id)
        .maybeSingle()
    : { data: null };
  const draft = draftData as { draft_schema?: unknown; id?: string } | null;

  return {
    draft,
    page,
    store,
    storeId,
    supabase,
    userId: user.id
  };
}

export async function prepareSecurityFoundationAction(formData: FormData) {
  const { draft, page, store, storeId, supabase, userId } = await requireSecurityContext(formData);
  const tenantValidation = validateTenantAction({
    actorUserId: userId,
    ownerUserId: store.owner_user_id ?? userId,
    requestedStoreId: storeId,
    storeId
  });
  const requestLimit = applyRateLimit({ currentCount: 0, limit: 60, windowSeconds: 60 });
  const aiLimit = applyRateLimit({ currentCount: 0, limit: 20, windowSeconds: 3600 });
  const builderThrottle = throttleBuilderMutations({ currentCount: 0, limit: 40 });
  const secureMutation = validateSecureMutation({
    mutationScope: "builder",
    schema: draft?.draft_schema ?? {}
  });
  const abuseState = detectAbusePattern({
    aiRequests: aiLimit.requestCount,
    builderMutations: builderThrottle.requestCount,
    invalidMutations: secureMutation.errors.length,
    repeatedRequests: requestLimit.requestCount,
    unauthorizedAttempts: tenantValidation.allowed ? 0 : 1
  });
  const event = trackSecurityEvent({
    eventType: "security_snapshot",
    payload: {
      abuseStatus: abuseState.abuseStatus,
      builderThrottle: builderThrottle.status,
      rateLimit: requestLimit.status,
      secureMutation: secureMutation.allowed,
      tenantValidation: tenantValidation.allowed
    },
    severity: abuseState.riskScore >= 50 ? "medium" : "info",
    status: tenantValidation.allowed && secureMutation.allowed ? "allowed" : "warning"
  });

  await Promise.all([
    supabase.from("request_rate_limits" as never).insert({
      action_key: "dashboard_security_prepare",
      actor_key: userId,
      actor_user_id: userId,
      limit_status: requestLimit.status,
      metadata: {
        hostnameSpoofingProtectionReady: true,
        repeatedRequestBlockingReady: true
      },
      owner_user_id: userId,
      request_count: requestLimit.requestCount,
      request_limit: requestLimit.limit,
      request_scope: "dashboard",
      store_instance_id: storeId,
      window_seconds: requestLimit.windowSeconds
    } as never),
    supabase.from("ai_usage_limits" as never).insert({
      actor_user_id: userId,
      metadata: {
        aiAbuseProtectionReady: true,
        aiCostProtectionReady: true
      },
      owner_user_id: userId,
      request_count: aiLimit.requestCount,
      request_limit: aiLimit.limit,
      store_instance_id: storeId,
      token_count: 0,
      token_limit: 100000,
      usage_scope: "template_customization",
      usage_status: aiLimit.status === "allowed" ? "allowed" : "throttled"
    } as never),
    supabase.from("builder_action_logs" as never).insert({
      action_key: "security_foundation_prepare",
      action_status: secureMutation.allowed ? "allowed" : "blocked",
      actor_user_id: userId,
      builder_draft_id: draft?.id ?? null,
      builder_page_id: page?.id ?? null,
      metadata: {
        invalidMutationBlockingReady: true,
        sessionSafeBuilderActionsReady: true
      },
      mutation_scope: "builder",
      owner_user_id: userId,
      store_instance_id: storeId,
      throttle_state: builderThrottle,
      validation_result: secureMutation
    } as never),
    supabase.from("security_events" as never).insert({
      actor_user_id: userId,
      event_payload: event.eventPayload,
      event_status: event.eventStatus,
      event_type: event.eventType,
      metadata: event.metadata,
      mitigation_state: event.mitigationState,
      owner_user_id: userId,
      severity: event.severity,
      store_instance_id: storeId
    } as never),
    supabase.from("abuse_detection_states" as never).upsert(
      {
        abuse_status: abuseState.abuseStatus,
        actor_key: userId,
        actor_user_id: userId,
        detection_reasons: abuseState.detectionReasons,
        detection_scope: "dashboard",
        metadata: {
          botProtectionReady: true,
          ddosMitigationReady: true,
          fraudMonitoringReady: true
        },
        mitigation_state: abuseState.mitigationState,
        owner_user_id: userId,
        risk_score: abuseState.riskScore,
        signal_counts: abuseState.signalCounts,
        store_instance_id: storeId,
        updated_at: new Date().toISOString()
      } as never,
      { onConflict: "store_instance_id" }
    )
  ]);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "security-foundation-prepared");
}

export async function recordSecurityEventAction(formData: FormData) {
  const { storeId, supabase, userId } = await requireSecurityContext(formData);
  const eventType = cleanText(formData.get("eventType"), 80) || "security_snapshot";
  const event = trackSecurityEvent({
    eventType,
    payload: {
      foundationOnly: true,
      manualDashboardEvent: true
    },
    severity: "low",
    status: "recorded"
  });

  await supabase.from("security_events" as never).insert({
    actor_user_id: userId,
    event_payload: event.eventPayload,
    event_status: event.eventStatus,
    event_type: event.eventType,
    metadata: event.metadata,
    mitigation_state: event.mitigationState,
    owner_user_id: userId,
    severity: event.severity,
    store_instance_id: storeId
  } as never);

  revalidatePath(builderPath(storeId));
  builderRedirect(storeId, "security-event-recorded");
}
