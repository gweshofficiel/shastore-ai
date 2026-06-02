import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type ShippingZoneProfileOption = {
  enabled: boolean;
  id: string;
  name: string;
};

export type ShippingZoneRow = {
  cities: string[];
  city: string | null;
  country: string;
  created_at: string;
  enabled: boolean;
  id: string;
  profile_id: string;
  profileName: string;
  region: string | null;
  regions: string[];
  sort_order: number;
  status: "active" | "inactive";
  store_id: string;
  updated_at: string;
  workspace_id: string;
  zone_name: string;
};

export type ShippingZonesDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  profiles: ShippingZoneProfileOption[];
  ready: boolean;
  stores: UserStoreRow[];
  zones: ShippingZoneRow[];
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

function parseList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function jsonList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function isMissingShippingZones(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("shipping_zones") ||
    message.includes("could not find the table")
  );
}

function normalizeProfile(row: Record<string, unknown>): ShippingZoneProfileOption {
  return {
    enabled: row.enabled !== false && row.status !== "inactive",
    id: String(row.id),
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Shipping profile"
  };
}

function normalizeZone(row: Record<string, unknown>, profilesById: Map<string, ShippingZoneProfileOption>): ShippingZoneRow {
  const status = row.status === "inactive" || row.enabled === false ? "inactive" : "active";
  const profileId = String(row.profile_id ?? "");
  const regions = jsonList(row.regions);
  const cities = jsonList(row.cities);
  const country = typeof row.country === "string" && row.country.trim() ? row.country : "Country";

  return {
    cities,
    city: typeof row.city === "string" && row.city.trim() ? row.city : cities[0] ?? null,
    country,
    created_at: String(row.created_at ?? ""),
    enabled: status === "active",
    id: String(row.id),
    profile_id: profileId,
    profileName: profilesById.get(profileId)?.name ?? "Shipping profile",
    region: typeof row.region === "string" && row.region.trim() ? row.region : regions[0] ?? null,
    regions,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    status,
    store_id: String(row.store_id ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
    workspace_id: String(row.workspace_id ?? ""),
    zone_name: typeof row.zone_name === "string" && row.zone_name.trim()
      ? row.zone_name
      : `${country} zone`
  };
}

export async function getShippingZonesDashboardData(selectedStoreId?: string): Promise<ShippingZonesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage shipping zones.", profiles: [], ready: true, stores: [], zones: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: storesError, profiles: [], ready: true, stores: [], zones: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, profiles: [], ready: true, stores, zones: [] };
  }

  const [profilesResult, zonesResult] = await Promise.all([
    supabase
      .from("shipping_profiles" as never)
      .select("id, name, enabled, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never),
    supabase
      .from("shipping_zones" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never)
  ]);

  if (zonesResult.error && isMissingShippingZones(zonesResult.error)) {
    return {
      activeStore,
      error: "Apply the shipping zones migration to enable zone management.",
      profiles: [],
      ready: false,
      stores,
      zones: []
    };
  }

  const profiles = ((profilesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map(normalizeProfile);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    activeStore,
    error: profilesResult.error?.message ?? zonesResult.error?.message ?? null,
    profiles,
    ready: !profilesResult.error && !zonesResult.error,
    stores,
    zones: ((zonesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((zone) =>
      normalizeZone(zone, profilesById)
    )
  };
}

export async function saveShippingZone(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/shipping-zones");
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
  const zoneId = cleanText(formData.get("zoneId"), 80);
  const profileId = cleanText(formData.get("profileId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 240) || "/dashboard/shipping-zones";
  const zoneName = cleanText(formData.get("zoneName"), 160);
  const country = cleanText(formData.get("country"), 120);
  const regions = parseList(formData.get("regions"));
  const cities = parseList(formData.get("cities"));

  if (!storeId || !profileId || !zoneName || !country) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Zone name, country, and shipping profile are required.")}`);
  }

  const { data: profile } = await supabase
    .from("shipping_profiles" as never)
    .select("id")
    .eq("id" as never, profileId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (!profile) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Shipping profile could not be verified.")}`);
  }

  const enabled = formBoolean(formData, "enabled");
  const payload = {
    cities: cities as Json,
    city: cities[0] ?? null,
    country,
    enabled,
    profile_id: profileId,
    region: regions[0] ?? null,
    regions: regions as Json,
    sort_order: parseInteger(formData.get("sortOrder"), 0),
    status: enabled ? "active" : "inactive",
    store_id: storeId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId,
    zone_name: zoneName
  };
  const result = zoneId
    ? await supabase
      .from("shipping_zones" as never)
      .update(payload as never)
      .eq("id" as never, zoneId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .select("id")
      .single()
    : await supabase
      .from("shipping_zones" as never)
      .insert({ ...payload, created_at: new Date().toISOString() } as never)
      .select("id")
      .single();
  const savedZone = result.data as { id?: string } | null;

  if (result.error || !savedZone?.id) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Shipping zone could not be saved.")}`);
  }

  await recordWorkspaceActivitySafe({
    action: "shipping_settings_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: savedZone.id,
    entityType: "shipping_zone",
    metadata: {
      country,
      profileId,
      storeId,
      zoneName
    },
    supabase,
    workspaceId
  });

  revalidatePath("/dashboard/shipping-zones");
  revalidatePath("/dashboard/shipping-profiles");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=zone`);
}
