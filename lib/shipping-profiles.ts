import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type ShippingProfileRow = {
  cod_supported: boolean;
  created_at: string;
  description: string | null;
  enabled: boolean;
  estimated_delivery_days: number;
  free_shipping_enabled: boolean;
  id: string;
  is_default: boolean;
  linkedMethodIds: string[];
  name: string;
  preparation_days: number;
  sort_order: number;
  status: "active" | "inactive";
  store_id: string;
  updated_at: string;
  workspace_id: string;
};

export type ShippingProfileMethodRow = {
  cod_supported?: boolean | null;
  enabled?: boolean | null;
  estimated_delivery_days?: number | null;
  flat_fee?: number | string | null;
  free_shipping_enabled?: boolean | null;
  id: string;
  method_name?: string | null;
  name?: string | null;
  profile_id?: string | null;
  shipping_regions?: Json;
  store_id?: string | null;
};

export type ShippingProfilesDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  methods: ShippingProfileMethodRow[];
  profiles: ShippingProfileRow[];
  ready: boolean;
  stores: UserStoreRow[];
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function formBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function isMissingShippingProfiles(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("shipping_profiles") ||
    message.includes("could not find the table")
  );
}

function normalizeProfile(row: Record<string, unknown>, linkedMethodIds: string[]): ShippingProfileRow {
  const status = row.status === "inactive" || row.enabled === false ? "inactive" : "active";

  return {
    cod_supported: row.cod_supported !== false,
    created_at: String(row.created_at ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    enabled: row.enabled !== false && status === "active",
    estimated_delivery_days: typeof row.estimated_delivery_days === "number" ? row.estimated_delivery_days : 3,
    free_shipping_enabled: row.free_shipping_enabled === true,
    id: String(row.id),
    is_default: row.is_default === true,
    linkedMethodIds,
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Shipping profile",
    preparation_days: typeof row.preparation_days === "number" ? row.preparation_days : 0,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    status,
    store_id: String(row.store_id ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
    workspace_id: String(row.workspace_id ?? "")
  };
}

async function loadMethodsForStore({
  store,
  supabase,
  userId,
  workspaceId
}: {
  store: UserStoreRow;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const selectColumns =
    "id, name, method_name, enabled, flat_fee, free_shipping_enabled, cod_supported, estimated_delivery_days, shipping_regions, profile_id, store_id, sort_order, created_at";
  const [storeMethodsResult, legacyMethodsResult] = await Promise.all([
    supabase
      .from("shipping_methods" as never)
      .select(selectColumns)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, store.id as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never),
    supabase
      .from("shipping_methods" as never)
      .select(selectColumns)
      .eq("user_id" as never, userId as never)
      .eq("dashboard_scope" as never, "seller" as never)
      .is("store_id" as never, null)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never)
  ]);

  const merged = new Map<string, ShippingProfileMethodRow>();

  for (const row of [
    ...((storeMethodsResult.data ?? []) as unknown as ShippingProfileMethodRow[]),
    ...((legacyMethodsResult.data ?? []) as unknown as ShippingProfileMethodRow[])
  ]) {
    merged.set(row.id, row);
  }

  return {
    error: storeMethodsResult.error ?? legacyMethodsResult.error,
    methods: [...merged.values()]
  };
}

export async function getShippingProfilesDashboardData(selectedStoreId?: string): Promise<ShippingProfilesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage shipping profiles.", methods: [], profiles: [], ready: true, stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: storesError, methods: [], profiles: [], ready: true, stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, methods: [], profiles: [], ready: true, stores };
  }

  const [profilesResult, methodsResult] = await Promise.all([
    supabase
      .from("shipping_profiles" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never),
    loadMethodsForStore({
      store: activeStore,
      supabase,
      userId: user.id,
      workspaceId
    })
  ]);

  if (profilesResult.error && isMissingShippingProfiles(profilesResult.error)) {
    return {
      activeStore,
      error: "Apply the shipping profiles migration to enable advanced profiles.",
      methods: methodsResult.methods,
      profiles: [],
      ready: false,
      stores
    };
  }

  const methods = methodsResult.methods;
  const linkedByProfile = new Map<string, string[]>();

  for (const method of methods) {
    if (!method.profile_id) {
      continue;
    }

    linkedByProfile.set(method.profile_id, [...(linkedByProfile.get(method.profile_id) ?? []), method.id]);
  }

  return {
    activeStore,
    error: profilesResult.error?.message ?? methodsResult.error?.message ?? null,
    methods,
    profiles: ((profilesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) =>
      normalizeProfile(row, linkedByProfile.get(String(row.id)) ?? [])
    ),
    ready: !profilesResult.error,
    stores
  };
}

export async function saveShippingProfile(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/shipping-profiles");
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);

  try {
    await requirePermission({
      permission: "shipping.edit",
      supabase,
      userId: user.id,
      workspaceId
    });
  } catch {
    redirect("/dashboard?workspace=denied");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const profileId = cleanText(formData.get("profileId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 240) || "/dashboard/shipping-profiles";
  const name = cleanText(formData.get("name"), 160);
  const selectedMethodIds = formData
    .getAll("methodIds")
    .map((value) => cleanText(value, 80))
    .filter(Boolean);

  if (!storeId || !name) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Profile name and store are required.")}`);
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (!store) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Store could not be verified.")}`);
  }

  const enabled = formBoolean(formData, "enabled");
  const payload = {
    cod_supported: formBoolean(formData, "codSupported"),
    description: cleanText(formData.get("description"), 1000) || null,
    enabled,
    estimated_delivery_days: parseInteger(formData.get("estimatedDeliveryDays"), 3),
    free_shipping_enabled: formBoolean(formData, "freeShippingEnabled"),
    is_default: formBoolean(formData, "isDefault"),
    name,
    preparation_days: parseInteger(formData.get("preparationDays"), 0),
    sort_order: parseInteger(formData.get("sortOrder"), 0),
    status: enabled ? "active" : "inactive",
    store_id: storeId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId
  };
  const saveResult = profileId
    ? await supabase
      .from("shipping_profiles" as never)
      .update(payload as never)
      .eq("id" as never, profileId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .select("id")
      .single()
    : await supabase
      .from("shipping_profiles" as never)
      .insert({ ...payload, created_at: new Date().toISOString() } as never)
      .select("id")
      .single();

  const savedProfile = saveResult.data as { id?: string } | null;

  if (saveResult.error || !savedProfile?.id) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Shipping profile could not be saved.")}`);
  }

  const savedProfileId = savedProfile.id;

  await supabase
    .from("shipping_methods" as never)
    .update({ profile_id: null } as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("profile_id" as never, savedProfileId as never);

  if (selectedMethodIds.length) {
    await supabase
      .from("shipping_methods" as never)
      .update({
        profile_id: savedProfileId,
        store_id: storeId,
        workspace_id: workspaceId
      } as never)
      .in("id" as never, selectedMethodIds as never);
  }

  await recordWorkspaceActivitySafe({
    action: "shipping_settings_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: savedProfileId,
    entityType: "shipping_profile",
    metadata: {
      linkedMethodCount: selectedMethodIds.length,
      name,
      storeId
    },
    supabase,
    workspaceId
  });

  revalidatePath("/dashboard/shipping-profiles");
  revalidatePath("/dashboard/shipping");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=profile`);
}
