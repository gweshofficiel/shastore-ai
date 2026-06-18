import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceAppBindingStatus = "active" | "archived" | "disabled" | "draft";

export type MarketplaceAppBindingRecord = {
  appBindingStatus: MarketplaceAppBindingStatus;
  appKey: string;
  appManifest: Record<string, unknown>;
  appName: string;
  appVersion: string;
  createdAt: string | null;
  id: string;
  marketplaceItemId: string;
  updatedAt: string | null;
};

export type MarketplaceAppInspection = {
  appKey: string | null;
  appManifestSummary: string[];
  appName: string | null;
  appVersion: string | null;
  bindingStatus: MarketplaceAppBindingStatus | null;
  linkedAppId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: string;
  publicEligible: boolean;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceAppBindingStats = {
  activeAppBindings: number;
  archivedAppBindings: number;
  disabledAppBindings: number;
  draftAppBindings: number;
  totalAppBindings: number;
  totalAppItems: number;
  verifiedAppBindings: number;
};

export const MARKETPLACE_APP_BINDING_STATUSES: readonly MarketplaceAppBindingStatus[] = [
  "draft",
  "active",
  "disabled",
  "archived"
] as const;

const APP_FOUNDATION_CATALOG: Record<
  string,
  {
    manifest: Record<string, unknown>;
    name: string;
    version: string;
  }
> = {
  "analytics-connector": {
    manifest: {
      capabilities: ["analytics_sync", "event_tracking"],
      category: "analytics",
      executable: false,
      foundation_only: true,
      install_runtime: false
    },
    name: "Analytics Connector App",
    version: "1.0.0"
  }
};

const bindingSelect =
  "id, marketplace_item_id, app_key, app_name, app_version, app_manifest, app_binding_status, created_at, updated_at";

const appItemSelect =
  "id, item_key, name, item_type, section, status, visibility, pricing_mode, linked_app_id";

const secretKeyPattern = /(api[_-]?key|secret|token|password|credential)/i;

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

export function isValidMarketplaceAppBindingStatus(value: unknown): value is MarketplaceAppBindingStatus {
  return MARKETPLACE_APP_BINDING_STATUSES.includes(value as MarketplaceAppBindingStatus);
}

export function parseMarketplaceAppBindingStatus(value: unknown): MarketplaceAppBindingStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAppBindingStatus(cleaned) ? cleaned : null;
}

export function appKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("app:") ? cleaned.slice("app:".length) : "";
}

export function isValidAppKey(value: unknown) {
  const cleaned = text(value, 120);
  return /^[a-z0-9][a-z0-9_-]{0,119}$/.test(cleaned);
}

export function sanitizeAppManifest(manifest: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(manifest)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.executable = false;
  clean.foundation_only = true;
  clean.install_runtime = false;

  return clean;
}

export function validateAppManifest(manifest: Record<string, unknown>) {
  const serialized = JSON.stringify(manifest);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("App manifest must not contain secrets.");
  }

  if (manifest.executable === true) {
    throw new Error("App manifest cannot enable executable apps in foundation runtime.");
  }
}

export function parseMarketplaceAppBinding(value: unknown): MarketplaceAppBindingRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const appKey = text(row.app_key, 120);
  const appName = text(row.app_name, 240);
  const appVersion = text(row.app_version, 40);
  const appBindingStatus = parseMarketplaceAppBindingStatus(row.app_binding_status);

  if (!id || !marketplaceItemId || !appKey || !appName || !appVersion || !appBindingStatus) {
    return null;
  }

  if (!isValidAppKey(appKey)) return null;

  const appManifest = sanitizeAppManifest(safeRecord(row.app_manifest));

  try {
    validateAppManifest(appManifest);
  } catch {
    return null;
  }

  return {
    appBindingStatus,
    appKey,
    appManifest,
    appName,
    appVersion,
    createdAt: text(row.created_at, 80) || null,
    id,
    marketplaceItemId,
    updatedAt: text(row.updated_at, 80) || null
  };
}

function manifestSummary(manifest: Record<string, unknown>) {
  const summary: string[] = [];

  if (Array.isArray(manifest.capabilities)) {
    summary.push(`Capabilities: ${manifest.capabilities.map((value) => text(value, 80)).filter(Boolean).join(", ")}`);
  }

  if (typeof manifest.category === "string") {
    summary.push(`Category: ${text(manifest.category, 80)}`);
  }

  summary.push("Foundation only");
  summary.push("No execution runtime");

  return summary;
}

function bindingStatusForMarketplaceStatus(status: string): MarketplaceAppBindingStatus {
  if (status === "approved") return "active";
  if (status === "archived") return "archived";
  if (status === "rejected") return "disabled";
  return "draft";
}

export function evaluateMarketplaceAppBinding(params: {
  binding: MarketplaceAppBindingRecord | null;
  itemKey: string;
  itemType: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: string;
}): MarketplaceAppInspection {
  if (params.itemType !== "app") {
    return {
      appKey: null,
      appManifestSummary: [],
      appName: null,
      appVersion: null,
      bindingStatus: null,
      linkedAppId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pricingMode: params.pricingMode,
      publicEligible: false,
      verificationIssues: [],
      verified: true
    };
  }

  const verificationIssues: string[] = [];
  const expectedAppKey = appKeyFromMarketplaceItemKey(params.itemKey);
  const publicEligible =
    params.marketplaceStatus === "approved" && params.marketplaceVisibility === "public";

  if (!params.binding) {
    return {
      appKey: expectedAppKey || null,
      appManifestSummary: [],
      appName: null,
      appVersion: null,
      bindingStatus: null,
      linkedAppId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pricingMode: params.pricingMode,
      publicEligible,
      verificationIssues: ["App marketplace item is missing an app binding record."],
      verified: false
    };
  }

  if (expectedAppKey && expectedAppKey !== params.binding.appKey) {
    verificationIssues.push("Marketplace item_key does not match app_key.");
  }

  if (params.binding.appBindingStatus === "archived" && params.marketplaceStatus === "approved") {
    verificationIssues.push("Archived app binding cannot back an approved marketplace item.");
  }

  if (publicEligible && params.binding.appBindingStatus !== "active") {
    verificationIssues.push("Public approved app marketplace items require an active app binding.");
  }

  if (params.binding.appManifest.executable === true) {
    verificationIssues.push("App manifest cannot enable executable runtime in foundation phase.");
  }

  return {
    appKey: params.binding.appKey,
    appManifestSummary: manifestSummary(params.binding.appManifest),
    appName: params.binding.appName,
    appVersion: params.binding.appVersion,
    bindingStatus: params.binding.appBindingStatus,
    linkedAppId: params.binding.id,
    marketplaceStatus: params.marketplaceStatus,
    marketplaceVisibility: params.marketplaceVisibility,
    pricingMode: params.pricingMode,
    publicEligible,
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace app runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace app runtime.");
  }

  return admin;
}

async function loadMarketplaceAppItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(appItemSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace app item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace app item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);

  if (!id || !itemKey || !name || itemType !== "app") {
    throw new Error("Marketplace app runtime requires an app marketplace item.");
  }

  return {
    id,
    itemKey,
    linkedAppId: text(row.linked_app_id, 120) || null,
    name,
    pricingMode: text(row.pricing_mode, 40) || "free",
    status: text(row.status, 40),
    visibility: text(row.visibility, 40)
  };
}

async function recordMarketplaceAppAudit(params: {
  binding: MarketplaceAppBindingRecord;
  inspection: MarketplaceAppInspection;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.binding.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_app_binding",
    metadata: {
      app_key: params.binding.appKey,
      app_version: params.binding.appVersion,
      binding_status: params.binding.appBindingStatus,
      item_id: params.binding.marketplaceItemId,
      note: "Super Admin marketplace app runtime foundation verification. No app installation or execution.",
      source_runtime: "marketplace_app_runtime",
      verification_issues: params.inspection.verificationIssues,
      verified: params.inspection.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceAppBindings(params: {
  itemId?: string;
  limit?: number;
} = {}): Promise<MarketplaceAppBindingRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_app_bindings" as never).select(bindingSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace app bindings could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceAppBinding(row))
    .filter((binding): binding is MarketplaceAppBindingRecord => Boolean(binding));
}

export async function getMarketplaceAppBindingByItemId(
  itemId: string
): Promise<MarketplaceAppBindingRecord | null> {
  const bindings = await listMarketplaceAppBindings({ itemId, limit: 1 });
  return bindings[0] ?? null;
}

export async function getMarketplaceAppInspection(itemId: string): Promise<MarketplaceAppInspection | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceAppItem(itemId);
    const binding = await getMarketplaceAppBindingByItemId(item.id);

    return evaluateMarketplaceAppBinding({
      binding,
      itemKey: item.itemKey,
      itemType: "app",
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      pricingMode: item.pricingMode
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires an app marketplace item")) {
      return null;
    }

    throw error;
  }
}

export async function verifyMarketplaceAppBinding(itemId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceAppItem(itemId);
  const binding = await getMarketplaceAppBindingByItemId(item.id);
  const inspection = evaluateMarketplaceAppBinding({
    binding,
    itemKey: item.itemKey,
    itemType: "app",
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    pricingMode: item.pricingMode
  });

  if (binding) {
    await recordMarketplaceAppAudit({
      binding,
      inspection,
      userId: access.user.id
    });
  }

  return inspection;
}

async function upsertAppBindingForItem(row: Record<string, unknown>) {
  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const status = text(row.status, 40);

  if (!id || !itemKey) return null;

  const appKey = appKeyFromMarketplaceItemKey(itemKey);

  if (!isValidAppKey(appKey)) return null;

  const catalog = APP_FOUNDATION_CATALOG[appKey];
  const appName = catalog?.name ?? name;
  const appVersion = catalog?.version ?? "1.0.0";
  const appManifest = sanitizeAppManifest(
    catalog?.manifest ?? {
      category: "foundation",
      executable: false,
      foundation_only: true,
      install_runtime: false,
      source: "marketplace_app_runtime"
    }
  );

  validateAppManifest(appManifest);

  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("marketplace_app_bindings" as never)
    .select(bindingSelect as never)
    .eq("marketplace_item_id" as never, id as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Marketplace app binding could not be inspected: ${existingError.message}`);
  }

  const bindingStatus = bindingStatusForMarketplaceStatus(status);

  if (existing) {
    const parsed = parseMarketplaceAppBinding(existing);

    if (!parsed) {
      throw new Error("Existing marketplace app binding is invalid.");
    }

    const { data, error } = await admin
      .from("marketplace_app_bindings" as never)
      .update({
        app_manifest: appManifest,
        app_name: appName,
        app_version: appVersion
      } as never)
      .eq("id" as never, parsed.id as never)
      .select(bindingSelect as never)
      .single();

    if (error) {
      throw new Error(`Marketplace app binding could not be updated: ${error.message}`);
    }

    const binding = parseMarketplaceAppBinding(data);

    if (!binding) {
      throw new Error("Updated marketplace app binding is invalid.");
    }

    await admin
      .from("marketplace_items" as never)
      .update({ linked_app_id: binding.id } as never)
      .eq("id" as never, id as never);

    return binding;
  }

  const { data, error } = await admin
    .from("marketplace_app_bindings" as never)
    .insert({
      app_binding_status: bindingStatus,
      app_key: appKey,
      app_manifest: appManifest,
      app_name: appName,
      app_version: appVersion,
      marketplace_item_id: id
    } as never)
    .select(bindingSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace app binding could not be created: ${error.message}`);
  }

  const binding = parseMarketplaceAppBinding(data);

  if (!binding) {
    throw new Error("Created marketplace app binding is invalid.");
  }

  await admin
    .from("marketplace_items" as never)
    .update({ linked_app_id: binding.id } as never)
    .eq("id" as never, id as never);

  return binding;
}

export async function ensureMarketplaceAppBindings() {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(appItemSelect as never)
    .eq("item_type" as never, "app" as never);

  if (error) {
    throw new Error(`Marketplace app items could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    await upsertAppBindingForItem(row);
  }
}

export async function getMarketplaceAppBindingStats(): Promise<MarketplaceAppBindingStats> {
  await ensureMarketplaceAppBindings();

  const admin = requireAdminClient();
  const [{ data: items, error: itemsError }, bindings] = await Promise.all([
    admin.from("marketplace_items" as never).select("id" as never).eq("item_type" as never, "app" as never),
    listMarketplaceAppBindings({ limit: 1000 })
  ]);

  if (itemsError) {
    throw new Error(`Marketplace app items could not be counted: ${itemsError.message}`);
  }

  const itemRows = Array.isArray(items) ? items : [];

  return bindings.reduce<MarketplaceAppBindingStats>(
    (stats, binding) => {
      if (binding.appBindingStatus === "active") stats.activeAppBindings += 1;
      if (binding.appBindingStatus === "draft") stats.draftAppBindings += 1;
      if (binding.appBindingStatus === "disabled") stats.disabledAppBindings += 1;
      if (binding.appBindingStatus === "archived") stats.archivedAppBindings += 1;

      return stats;
    },
    {
      activeAppBindings: 0,
      archivedAppBindings: 0,
      disabledAppBindings: 0,
      draftAppBindings: 0,
      totalAppBindings: bindings.length,
      totalAppItems: itemRows.length,
      verifiedAppBindings: 0
    }
  );
}
