import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StoreManagementSnapshot = {
  branding: Record<string, unknown>;
  domains: Record<string, unknown>[];
  media: Record<string, unknown>[];
  planLimits: Record<string, unknown>;
  roles: Record<string, unknown>[];
  settings: Record<string, unknown>;
  staff: Record<string, unknown>[];
  subscription: Record<string, unknown>;
  usage: Record<string, unknown>[];
};

export type OwnedStoreRow = {
  id: string;
  internal_slug: string;
  store_name: string;
};

export type DashboardReadResult = {
  error: PostgrestError | null;
  ok: boolean;
  schemaMissing: boolean;
};

function isSchemaMissing(error: PostgrestError | null) {
  if (!error) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    message.includes("could not find the function") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function logReadFailure(context: string, storeId: string, error: PostgrestError | null) {
  console.error(`[buyer-store-dashboard] ${context}`, {
    storeId,
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null
  });
}

export function emptyStoreManagementSnapshot(ownedStore: OwnedStoreRow): StoreManagementSnapshot {
  return {
    settings: {
      store_instance_id: ownedStore.id,
      store_name: ownedStore.store_name,
      store_slug: ownedStore.internal_slug,
      store_status: "draft",
      language: "en",
      currency: "USD",
      timezone: "UTC"
    },
    branding: {
      store_instance_id: ownedStore.id,
      primary_color: "#0f172a",
      secondary_color: "#2563eb",
      theme_mode: "light",
      branding_assets: {}
    },
    subscription: {
      store_instance_id: ownedStore.id,
      plan_id: "starter",
      subscription_status: "active"
    },
    planLimits: {
      plan_id: "starter",
      plan_name: "Starter"
    },
    domains: [],
    staff: [],
    roles: [],
    media: [],
    usage: []
  };
}

async function loadSnapshotViaTables(
  supabase: SupabaseClient,
  storeId: string
): Promise<{ result: DashboardReadResult; snapshot: Partial<StoreManagementSnapshot> | null }> {
  const [settings, branding, subscription, usage] = await Promise.all([
    supabase.from("store_settings" as never).select("*").eq("store_instance_id", storeId).maybeSingle(),
    supabase.from("store_branding" as never).select("*").eq("store_instance_id", storeId).maybeSingle(),
    supabase
      .from("store_subscriptions" as never)
      .select("*")
      .eq("store_instance_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_usage_tracking" as never)
      .select("*")
      .eq("store_instance_id", storeId)
      .order("period_start", { ascending: false })
      .limit(12)
  ]);

  const tableErrors = [settings.error, branding.error, subscription.error, usage.error].filter(
    (error): error is PostgrestError => Boolean(error)
  );
  const firstError = tableErrors[0] ?? null;

  if (firstError) {
    tableErrors.forEach((error) => logReadFailure("snapshot table read failed", storeId, error));
    return {
      result: {
        error: firstError,
        ok: false,
        schemaMissing: tableErrors.some((error) => isSchemaMissing(error))
      },
      snapshot: null
    };
  }

  let planLimits: Record<string, unknown> = {};
  const planId =
    subscription.data && typeof subscription.data === "object"
      ? (subscription.data as { plan_id?: string }).plan_id
      : "starter";

  if (planId) {
    const limits = await supabase.from("store_plan_limits" as never).select("*").eq("plan_id", planId).maybeSingle();
    if (!limits.error && limits.data && typeof limits.data === "object") {
      planLimits = limits.data as Record<string, unknown>;
    } else if (limits.error && !isSchemaMissing(limits.error)) {
      logReadFailure("plan limits read failed", storeId, limits.error);
    }
  }

  return {
    result: { error: null, ok: true, schemaMissing: false },
    snapshot: {
      settings:
        settings.data && typeof settings.data === "object"
          ? (settings.data as Record<string, unknown>)
          : {},
      branding:
        branding.data && typeof branding.data === "object"
          ? (branding.data as Record<string, unknown>)
          : {},
      subscription:
        subscription.data && typeof subscription.data === "object"
          ? (subscription.data as Record<string, unknown>)
          : {},
      planLimits,
      domains: [],
      staff: [],
      roles: [],
      media: [],
      usage: Array.isArray(usage.data) ? (usage.data as Record<string, unknown>[]) : []
    }
  };
}

export async function loadBuyerStoreManagementSnapshot(
  supabase: SupabaseClient,
  storeId: string,
  ownedStore: OwnedStoreRow
): Promise<{ defaults: DashboardReadResult; snapshot: StoreManagementSnapshot }> {
  const { data: rpcSnapshot, error: snapshotError } = await supabase.rpc(
    "get_store_management_snapshot" as never,
    { candidate_store_instance_id: storeId } as never
  );

  if (!snapshotError && rpcSnapshot && typeof rpcSnapshot === "object") {
    const management = rpcSnapshot as Partial<StoreManagementSnapshot>;
    return {
      defaults: { error: null, ok: true, schemaMissing: false },
      snapshot: {
        branding: (management.branding as Record<string, unknown>) ?? {},
        domains: Array.isArray(management.domains) ? management.domains : [],
        media: Array.isArray(management.media) ? management.media : [],
        planLimits: (management.planLimits as Record<string, unknown>) ?? {},
        roles: Array.isArray(management.roles) ? management.roles : [],
        settings: (management.settings as Record<string, unknown>) ?? {},
        staff: Array.isArray(management.staff) ? management.staff : [],
        subscription: (management.subscription as Record<string, unknown>) ?? {},
        usage: Array.isArray(management.usage) ? management.usage : []
      }
    };
  }

  if (snapshotError) {
    logReadFailure("get_store_management_snapshot failed", storeId, snapshotError);
  }

  const tableSnapshot = await loadSnapshotViaTables(supabase, storeId);
  const empty = emptyStoreManagementSnapshot(ownedStore);

  if (tableSnapshot.snapshot) {
    return {
      defaults: tableSnapshot.result,
      snapshot: {
        branding: tableSnapshot.snapshot.branding ?? empty.branding,
        domains: tableSnapshot.snapshot.domains ?? [],
        media: tableSnapshot.snapshot.media ?? [],
        planLimits: tableSnapshot.snapshot.planLimits ?? empty.planLimits,
        roles: tableSnapshot.snapshot.roles ?? [],
        settings: tableSnapshot.snapshot.settings ?? empty.settings,
        staff: tableSnapshot.snapshot.staff ?? [],
        subscription: tableSnapshot.snapshot.subscription ?? empty.subscription,
        usage: tableSnapshot.snapshot.usage ?? []
      }
    };
  }

  return {
    defaults: tableSnapshot.result,
    snapshot: empty
  };
}
