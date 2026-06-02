import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordWorkspaceActivitySafe } from "@/lib/audit/workspace-activity";
import { getUserPrimaryWorkspaceId, requirePermission } from "@/lib/permissions/rbac";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { createClient } from "@/lib/supabase/server";

export type ShippingRateType = "flat_rate" | "free_shipping" | "order_amount" | "weight_based";

export type ShippingRateProfileOption = {
  enabled: boolean;
  id: string;
  name: string;
};

export type ShippingRateZoneOption = {
  country: string;
  enabled: boolean;
  id: string;
  name: string;
  profile_id: string;
};

export type ShippingRateRow = {
  currency: string;
  enabled: boolean;
  id: string;
  max_order_amount: number | null;
  max_weight: number | null;
  min_order_amount: number | null;
  min_weight: number | null;
  price: number;
  profile_id: string;
  profileName: string;
  rate_name: string;
  rate_type: ShippingRateType;
  sort_order: number;
  status: "active" | "inactive";
  store_id: string;
  zone_id: string;
  zoneName: string;
};

export type ShippingRatesDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  profiles: ShippingRateProfileOption[];
  rates: ShippingRateRow[];
  ready: boolean;
  stores: UserStoreRow[];
  zones: ShippingRateZoneOption[];
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function formBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizeRateType(value: FormDataEntryValue | null): ShippingRateType {
  return value === "free_shipping" || value === "order_amount" || value === "weight_based"
    ? value
    : "flat_rate";
}

function isMissingShippingRates(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("shipping_rates") ||
    message.includes("could not find the table")
  );
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeProfile(row: Record<string, unknown>): ShippingRateProfileOption {
  return {
    enabled: row.enabled !== false && row.status !== "inactive",
    id: String(row.id),
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Shipping profile"
  };
}

function normalizeZone(row: Record<string, unknown>): ShippingRateZoneOption {
  return {
    country: typeof row.country === "string" && row.country.trim() ? row.country : "Country",
    enabled: row.enabled !== false && row.status !== "inactive",
    id: String(row.id),
    name: typeof row.zone_name === "string" && row.zone_name.trim() ? row.zone_name : `${row.country ?? "Shipping"} zone`,
    profile_id: String(row.profile_id ?? "")
  };
}

function normalizeRate(
  row: Record<string, unknown>,
  profilesById: Map<string, ShippingRateProfileOption>,
  zonesById: Map<string, ShippingRateZoneOption>
): ShippingRateRow {
  const profileId = String(row.profile_id ?? "");
  const zoneId = String(row.zone_id ?? "");
  const rateType = normalizeRateType(typeof row.rate_type === "string" ? row.rate_type : null);
  const status = row.status === "inactive" || row.enabled === false ? "inactive" : "active";

  return {
    currency: typeof row.currency === "string" && row.currency.trim() ? row.currency : "USD",
    enabled: status === "active",
    id: String(row.id),
    max_order_amount: numericValue(row.max_order_amount),
    max_weight: numericValue(row.max_weight),
    min_order_amount: numericValue(row.min_order_amount),
    min_weight: numericValue(row.min_weight),
    price: numericValue(row.price) ?? 0,
    profile_id: profileId,
    profileName: profilesById.get(profileId)?.name ?? "Shipping profile",
    rate_name: typeof row.rate_name === "string" && row.rate_name.trim() ? row.rate_name : "Shipping rate",
    rate_type: rateType,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    status,
    store_id: String(row.store_id ?? ""),
    zone_id: zoneId,
    zoneName: zonesById.get(zoneId)?.name ?? "Shipping zone"
  };
}

export async function getShippingRatesDashboardData(selectedStoreId?: string): Promise<ShippingRatesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage shipping rates.", profiles: [], rates: [], ready: true, stores: [], zones: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: storesError, profiles: [], rates: [], ready: true, stores: [], zones: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, profiles: [], rates: [], ready: true, stores, zones: [] };
  }

  const [profilesResult, zonesResult, ratesResult] = await Promise.all([
    supabase
      .from("shipping_profiles" as never)
      .select("id, name, enabled, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never),
    supabase
      .from("shipping_zones" as never)
      .select("id, zone_name, country, profile_id, enabled, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never),
    supabase
      .from("shipping_rates" as never)
      .select("*")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never)
  ]);

  if (ratesResult.error && isMissingShippingRates(ratesResult.error)) {
    return {
      activeStore,
      error: "Apply the shipping rates migration to enable rate management.",
      profiles: [],
      rates: [],
      ready: false,
      stores,
      zones: []
    };
  }

  const profiles = ((profilesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map(normalizeProfile);
  const zones = ((zonesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map(normalizeZone);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));

  return {
    activeStore,
    error: profilesResult.error?.message ?? zonesResult.error?.message ?? ratesResult.error?.message ?? null,
    profiles,
    rates: ((ratesResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((rate) =>
      normalizeRate(rate, profilesById, zonesById)
    ),
    ready: !profilesResult.error && !zonesResult.error && !ratesResult.error,
    stores,
    zones
  };
}

export async function saveShippingRate(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/shipping-rates");
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
  const rateId = cleanText(formData.get("rateId"), 80);
  const profileId = cleanText(formData.get("profileId"), 80);
  const zoneId = cleanText(formData.get("zoneId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 240) || "/dashboard/shipping-rates";
  const rateName = cleanText(formData.get("rateName"), 160);
  const rateType = normalizeRateType(formData.get("rateType"));

  if (!storeId || !profileId || !zoneId || !rateName) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Rate name, profile, and zone are required.")}`);
  }

  const { data: zone } = await supabase
    .from("shipping_zones" as never)
    .select("id")
    .eq("id" as never, zoneId as never)
    .eq("profile_id" as never, profileId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (!zone) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Shipping zone could not be verified for this profile.")}`);
  }

  const enabled = formBoolean(formData, "enabled");
  const payload = {
    currency: cleanText(formData.get("currency"), 8).toUpperCase() || "USD",
    enabled,
    max_order_amount: parseOptionalNumber(formData.get("maxOrderAmount")),
    max_weight: parseOptionalNumber(formData.get("maxWeight")),
    min_order_amount: parseOptionalNumber(formData.get("minOrderAmount")),
    min_weight: parseOptionalNumber(formData.get("minWeight")),
    price: rateType === "free_shipping" ? 0 : parseNumber(formData.get("price"), 0),
    profile_id: profileId,
    rate_name: rateName,
    rate_type: rateType,
    sort_order: parseInteger(formData.get("sortOrder"), 0),
    status: enabled ? "active" : "inactive",
    store_id: storeId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId,
    zone_id: zoneId
  };
  const result = rateId
    ? await supabase
      .from("shipping_rates" as never)
      .update(payload as never)
      .eq("id" as never, rateId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .select("id")
      .single()
    : await supabase
      .from("shipping_rates" as never)
      .insert({ ...payload, created_at: new Date().toISOString() } as never)
      .select("id")
      .single();
  const savedRate = result.data as { id?: string } | null;

  if (result.error || !savedRate?.id) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Shipping rate could not be saved.")}`);
  }

  await recordWorkspaceActivitySafe({
    action: "shipping_settings_updated",
    actorEmail: user.email,
    actorUserId: user.id,
    entityId: savedRate.id,
    entityType: "shipping_rate",
    metadata: {
      profileId,
      rateName,
      rateType,
      storeId,
      zoneId
    },
    supabase,
    workspaceId
  });

  revalidatePath("/dashboard/shipping-rates");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=rate`);
}
