import { createAdminClient } from "@/lib/supabase/admin";

export type PublicShippingMethod = {
  deliveryNotes: string | null;
  estimatedMaxDays: number | null;
  estimatedMinDays: number | null;
  fee: number;
  freeShippingThreshold: number | null;
  id: string;
  name: string;
  processingTimeDays: number | null;
  profile: {
    codSupported: boolean;
    description: string | null;
    estimatedDeliveryDays: number | null;
    freeShippingEnabled: boolean;
    id: string;
    name: string;
    preparationDays: number | null;
  } | null;
  rates: PublicShippingRate[];
  type: "express" | "local_delivery" | "local_pickup" | "standard";
};

export type PublicShippingRate = {
  currency: string;
  id: string;
  maxOrderAmount: number | null;
  maxWeight: number | null;
  minOrderAmount: number | null;
  minWeight: number | null;
  name: string;
  price: number;
  profileId: string;
  type: "flat_rate" | "free_shipping" | "order_amount" | "weight_based";
  zone: {
    cities: string[];
    country: string;
    id: string;
    name: string;
    regions: string[];
  };
};

export type ShippingRateMatch = {
  message: string | null;
  rate: PublicShippingRate | null;
  shippingAmount: number;
  unavailable: boolean;
};

type ShippingMethodRow = {
  delivery_notes?: string | null;
  enabled?: boolean | null;
  estimated_delivery_days?: number | string | null;
  estimated_max_days?: number | string | null;
  estimated_min_days?: number | string | null;
  fixed_fee?: number | string | null;
  flat_fee?: number | string | null;
  free_shipping_enabled?: boolean | null;
  free_shipping_threshold?: number | string | null;
  id: string;
  local_delivery_enabled?: boolean | null;
  method_name?: string | null;
  method_type?: string | null;
  name?: string | null;
  pickup_enabled?: boolean | null;
  preparation_delay_days?: number | string | null;
  profile_id?: string | null;
  processing_time_days?: number | string | null;
  status?: string | null;
};

type ShippingProfileRow = {
  cod_supported?: boolean | null;
  description?: string | null;
  enabled?: boolean | null;
  estimated_delivery_days?: number | string | null;
  free_shipping_enabled?: boolean | null;
  id: string;
  name?: string | null;
  preparation_days?: number | string | null;
  status?: string | null;
};

type ShippingRateRow = {
  currency?: string | null;
  enabled?: boolean | null;
  id: string;
  max_order_amount?: number | string | null;
  max_weight?: number | string | null;
  min_order_amount?: number | string | null;
  min_weight?: number | string | null;
  price?: number | string | null;
  profile_id?: string | null;
  rate_name?: string | null;
  rate_type?: string | null;
  status?: string | null;
  zone_id?: string | null;
};

type ShippingZoneRow = {
  cities?: unknown;
  city?: string | null;
  country?: string | null;
  enabled?: boolean | null;
  id: string;
  profile_id?: string | null;
  region?: string | null;
  regions?: unknown;
  status?: string | null;
  zone_name?: string | null;
};

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function textList(value: unknown, fallback?: string | null) {
  const values = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!values.length && fallback?.trim()) {
    values.push(fallback.trim());
  }

  return values;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function rateType(value: string | null | undefined): PublicShippingRate["type"] {
  return value === "free_shipping" || value === "order_amount" || value === "weight_based"
    ? value
    : "flat_rate";
}

function isActiveShippingMethod(row: ShippingMethodRow) {
  if (row.status) {
    return row.status === "active";
  }

  return row.enabled !== false;
}

function normalizeRate(row: ShippingRateRow, zone: ShippingZoneRow | null): PublicShippingRate | null {
  if (!zone || row.enabled === false || row.status === "inactive" || zone.enabled === false || zone.status === "inactive") {
    return null;
  }

  return {
    currency: row.currency?.trim() || "USD",
    id: row.id,
    maxOrderAmount: numberValue(row.max_order_amount),
    maxWeight: numberValue(row.max_weight),
    minOrderAmount: numberValue(row.min_order_amount),
    minWeight: numberValue(row.min_weight),
    name: row.rate_name?.trim() || "Shipping rate",
    price: rateType(row.rate_type) === "free_shipping" ? 0 : numberValue(row.price) ?? 0,
    profileId: row.profile_id ?? "",
    type: rateType(row.rate_type),
    zone: {
      cities: textList(zone.cities, zone.city),
      country: zone.country?.trim() || "Country",
      id: zone.id,
      name: zone.zone_name?.trim() || `${zone.country ?? "Shipping"} zone`,
      regions: textList(zone.regions, zone.region)
    }
  };
}

function normalizeShippingMethod(
  row: ShippingMethodRow,
  profile: ShippingProfileRow | null = null,
  ratesByProfileId = new Map<string, PublicShippingRate[]>()
): PublicShippingMethod | null {
  if (!isActiveShippingMethod(row)) {
    return null;
  }

  const rawType = row.method_type;
  const type =
    rawType === "express" || rawType === "local_delivery" || rawType === "local_pickup"
      ? rawType
      : row.pickup_enabled
        ? "local_pickup"
        : row.local_delivery_enabled
          ? "local_delivery"
          : "standard";
  const estimatedDays = numberValue(row.estimated_delivery_days);

  return {
    deliveryNotes: row.delivery_notes ?? null,
    estimatedMaxDays: numberValue(row.estimated_max_days) ?? estimatedDays,
    estimatedMinDays: numberValue(row.estimated_min_days) ?? estimatedDays,
    fee: row.free_shipping_enabled ? 0 : numberValue(row.fixed_fee) ?? numberValue(row.flat_fee) ?? 0,
    freeShippingThreshold: row.free_shipping_enabled
      ? 0
      : numberValue(row.free_shipping_threshold),
    id: row.id,
    name: row.name?.trim() || row.method_name?.trim() || "Shipping method",
    processingTimeDays: numberValue(row.processing_time_days) ?? numberValue(row.preparation_delay_days),
    profile: profile && profile.status !== "inactive" && profile.enabled !== false
      ? {
        codSupported: profile.cod_supported !== false,
        description: profile.description ?? null,
        estimatedDeliveryDays: numberValue(profile.estimated_delivery_days),
        freeShippingEnabled: profile.free_shipping_enabled === true,
        id: profile.id,
        name: profile.name?.trim() || "Shipping profile",
        preparationDays: numberValue(profile.preparation_days)
      }
      : null,
    rates: row.profile_id ? ratesByProfileId.get(row.profile_id) ?? [] : [],
    type
  };
}

function normalizeShippingMethods(
  rows: ShippingMethodRow[],
  profilesById = new Map<string, ShippingProfileRow>(),
  ratesByProfileId = new Map<string, PublicShippingRate[]>()
) {
  return rows
    .map((row) => normalizeShippingMethod(
      row,
      row.profile_id ? profilesById.get(row.profile_id) ?? null : null,
      ratesByProfileId
    ))
    .filter((method): method is PublicShippingMethod => Boolean(method));
}

function addressMatchesZone(addressText: string, zone: PublicShippingRate["zone"]) {
  const normalizedAddress = normalizeText(addressText);

  if (!normalizedAddress) {
    return false;
  }

  const candidates = [zone.country, zone.name, ...zone.regions, ...zone.cities]
    .map(normalizeText)
    .filter(Boolean);

  return candidates.some((candidate) => normalizedAddress.includes(candidate));
}

function amountMatches(rate: PublicShippingRate, subtotalAmount: number) {
  return (
    (rate.minOrderAmount == null || subtotalAmount >= rate.minOrderAmount) &&
    (rate.maxOrderAmount == null || subtotalAmount <= rate.maxOrderAmount)
  );
}

function weightMatches(rate: PublicShippingRate, totalWeight: number | null) {
  if (rate.type !== "weight_based") {
    return true;
  }

  if (totalWeight == null) {
    return false;
  }

  return (
    (rate.minWeight == null || totalWeight >= rate.minWeight) &&
    (rate.maxWeight == null || totalWeight <= rate.maxWeight)
  );
}

export function matchPublicShippingRate({
  addressText,
  method,
  subtotalAmount,
  totalWeight = null
}: {
  addressText: string;
  method: PublicShippingMethod | null;
  subtotalAmount: number;
  totalWeight?: number | null;
}): ShippingRateMatch {
  if (!method) {
    return { message: null, rate: null, shippingAmount: 0, unavailable: false };
  }

  if (!method.rates.length) {
    const thresholdReached = method.freeShippingThreshold != null && subtotalAmount >= method.freeShippingThreshold;

    return {
      message: null,
      rate: null,
      shippingAmount: thresholdReached ? 0 : method.fee,
      unavailable: false
    };
  }

  const matchingRate = method.rates.find((rate) =>
    addressMatchesZone(addressText, rate.zone) &&
    amountMatches(rate, subtotalAmount) &&
    weightMatches(rate, totalWeight)
  ) ?? null;

  if (!matchingRate) {
    return {
      message: "Shipping is not available for this address.",
      rate: null,
      shippingAmount: 0,
      unavailable: true
    };
  }

  return {
    message: null,
    rate: matchingRate,
    shippingAmount: matchingRate.type === "free_shipping" ? 0 : matchingRate.price,
    unavailable: false
  };
}

export async function getPublicShippingMethodsForStore(storeId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data: storeRow } = await admin
    .from("stores")
    .select("id, user_id, owner_user_id, workspace_id")
    .eq("id", storeId)
    .maybeSingle();
  const store = storeRow as {
    id: string;
    owner_user_id?: string | null;
    user_id: string;
    workspace_id?: string | null;
  } | null;

  if (!store) {
    return [];
  }

  const selectColumns =
    "id, name, method_name, method_type, status, enabled, fixed_fee, flat_fee, free_shipping_enabled, free_shipping_threshold, processing_time_days, preparation_delay_days, estimated_min_days, estimated_max_days, estimated_delivery_days, local_delivery_enabled, pickup_enabled, delivery_notes, profile_id, sort_order";
  const { data: storeScopedMethods } = await admin
    .from("shipping_methods" as never)
    .select(selectColumns)
    .eq("store_id" as never, storeId as never)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const profileIds = [
    ...new Set(
      ((storeScopedMethods ?? []) as unknown as ShippingMethodRow[])
        .map((method) => method.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId))
    )
  ];
  const profilesById = new Map<string, ShippingProfileRow>();

  if (profileIds.length) {
    const { data: profileRows } = await admin
      .from("shipping_profiles" as never)
      .select("id, name, description, enabled, status, preparation_days, estimated_delivery_days, cod_supported, free_shipping_enabled")
      .eq("store_id" as never, storeId as never)
      .in("id" as never, profileIds as never);

    for (const profile of (profileRows ?? []) as unknown as ShippingProfileRow[]) {
      profilesById.set(profile.id, profile);
    }
  }
  const { data: zoneRows } = profileIds.length
    ? await admin
      .from("shipping_zones" as never)
      .select("id, zone_name, country, regions, cities, region, city, profile_id, enabled, status")
      .eq("store_id" as never, storeId as never)
      .in("profile_id" as never, profileIds as never)
    : { data: [] };
  const zonesById = new Map<string, ShippingZoneRow>();

  for (const zone of (zoneRows ?? []) as unknown as ShippingZoneRow[]) {
    zonesById.set(zone.id, zone);
  }

  const { data: rateRows } = profileIds.length
    ? await admin
      .from("shipping_rates" as never)
      .select("id, rate_name, rate_type, price, currency, min_order_amount, max_order_amount, min_weight, max_weight, profile_id, zone_id, enabled, status, sort_order")
      .eq("store_id" as never, storeId as never)
      .eq("enabled" as never, true as never)
      .eq("status" as never, "active" as never)
      .in("profile_id" as never, profileIds as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never)
    : { data: [] };
  const ratesByProfileId = new Map<string, PublicShippingRate[]>();

  for (const row of (rateRows ?? []) as unknown as ShippingRateRow[]) {
    const rate = normalizeRate(row, row.zone_id ? zonesById.get(row.zone_id) ?? null : null);

    if (!rate || !row.profile_id) {
      continue;
    }

    ratesByProfileId.set(row.profile_id, [...(ratesByProfileId.get(row.profile_id) ?? []), rate]);
  }

  const ownerUserId = store.owner_user_id ?? store.user_id;
  const { data: legacyMethods } = await admin
    .from("shipping_methods" as never)
    .select(selectColumns)
    .eq("user_id" as never, ownerUserId as never)
    .eq("dashboard_scope" as never, "seller" as never)
    .is("store_id" as never, null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const merged = new Map<string, ShippingMethodRow>();

  for (const method of [
    ...((storeScopedMethods ?? []) as unknown as ShippingMethodRow[]),
    ...((legacyMethods ?? []) as unknown as ShippingMethodRow[])
  ]) {
    merged.set(method.id, method);
  }

  return normalizeShippingMethods([...merged.values()], profilesById, ratesByProfileId);
}

export async function getPublicShippingMethodForStore({
  methodId,
  storeId
}: {
  methodId: string;
  storeId: string;
}) {
  const methods = await getPublicShippingMethodsForStore(storeId);
  return methods.find((method) => method.id === methodId) ?? null;
}
