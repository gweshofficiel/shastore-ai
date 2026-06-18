import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplacePluginBindingStatus = "active" | "archived" | "disabled" | "draft";

export type MarketplacePluginBindingRecord = {
  createdAt: string | null;
  id: string;
  marketplaceItemId: string;
  pluginBindingStatus: MarketplacePluginBindingStatus;
  pluginKey: string;
  pluginManifest: Record<string, unknown>;
  pluginName: string;
  pluginVersion: string;
  updatedAt: string | null;
};

export type MarketplacePluginInspection = {
  bindingStatus: MarketplacePluginBindingStatus | null;
  linkedPluginId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pluginKey: string | null;
  pluginManifestSummary: string[];
  pluginName: string | null;
  pluginVersion: string | null;
  pricingMode: string;
  publicEligible: boolean;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplacePluginBindingStats = {
  activePluginBindings: number;
  archivedPluginBindings: number;
  disabledPluginBindings: number;
  draftPluginBindings: number;
  totalPluginBindings: number;
  totalPluginItems: number;
  verifiedPluginBindings: number;
};

export const MARKETPLACE_PLUGIN_BINDING_STATUSES: readonly MarketplacePluginBindingStatus[] = [
  "draft",
  "active",
  "disabled",
  "archived"
] as const;

const PLUGIN_FOUNDATION_CATALOG: Record<
  string,
  {
    manifest: Record<string, unknown>;
    name: string;
    version: string;
  }
> = {
  "loyalty-foundation": {
    manifest: {
      capabilities: ["loyalty_points", "customer_rewards"],
      category: "loyalty",
      executable: false,
      foundation_only: true,
      install_runtime: false
    },
    name: "Loyalty Plugin Foundation",
    version: "1.0.0"
  }
};

const bindingSelect =
  "id, marketplace_item_id, plugin_key, plugin_name, plugin_version, plugin_manifest, plugin_binding_status, created_at, updated_at";

const pluginItemSelect =
  "id, item_key, name, item_type, section, status, visibility, pricing_mode, linked_plugin_id";

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

export function isValidMarketplacePluginBindingStatus(
  value: unknown
): value is MarketplacePluginBindingStatus {
  return MARKETPLACE_PLUGIN_BINDING_STATUSES.includes(value as MarketplacePluginBindingStatus);
}

export function parseMarketplacePluginBindingStatus(
  value: unknown
): MarketplacePluginBindingStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplacePluginBindingStatus(cleaned) ? cleaned : null;
}

export function pluginKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("plugin:") ? cleaned.slice("plugin:".length) : "";
}

export function isValidPluginKey(value: unknown) {
  const cleaned = text(value, 120);
  return /^[a-z0-9][a-z0-9_-]{0,119}$/.test(cleaned);
}

export function sanitizePluginManifest(manifest: Record<string, unknown>) {
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

export function validatePluginManifest(manifest: Record<string, unknown>) {
  const serialized = JSON.stringify(manifest);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Plugin manifest must not contain secrets.");
  }

  if (manifest.executable === true) {
    throw new Error("Plugin manifest cannot enable executable plugins in foundation runtime.");
  }
}

export function parseMarketplacePluginBinding(value: unknown): MarketplacePluginBindingRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const pluginKey = text(row.plugin_key, 120);
  const pluginName = text(row.plugin_name, 240);
  const pluginVersion = text(row.plugin_version, 40);
  const pluginBindingStatus = parseMarketplacePluginBindingStatus(row.plugin_binding_status);

  if (!id || !marketplaceItemId || !pluginKey || !pluginName || !pluginVersion || !pluginBindingStatus) {
    return null;
  }

  if (!isValidPluginKey(pluginKey)) return null;

  const pluginManifest = sanitizePluginManifest(safeRecord(row.plugin_manifest));

  try {
    validatePluginManifest(pluginManifest);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    id,
    marketplaceItemId,
    pluginBindingStatus,
    pluginKey,
    pluginManifest,
    pluginName,
    pluginVersion,
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

function bindingStatusForMarketplaceStatus(status: string): MarketplacePluginBindingStatus {
  if (status === "approved") return "active";
  if (status === "archived") return "archived";
  if (status === "rejected") return "disabled";
  return "draft";
}

export function evaluateMarketplacePluginBinding(params: {
  binding: MarketplacePluginBindingRecord | null;
  itemKey: string;
  itemType: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: string;
}): MarketplacePluginInspection {
  if (params.itemType !== "plugin") {
    return {
      bindingStatus: null,
      linkedPluginId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pluginKey: null,
      pluginManifestSummary: [],
      pluginName: null,
      pluginVersion: null,
      pricingMode: params.pricingMode,
      publicEligible: false,
      verificationIssues: [],
      verified: true
    };
  }

  const verificationIssues: string[] = [];
  const expectedPluginKey = pluginKeyFromMarketplaceItemKey(params.itemKey);
  const publicEligible =
    params.marketplaceStatus === "approved" && params.marketplaceVisibility === "public";

  if (!params.binding) {
    return {
      bindingStatus: null,
      linkedPluginId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pluginKey: expectedPluginKey || null,
      pluginManifestSummary: [],
      pluginName: null,
      pluginVersion: null,
      pricingMode: params.pricingMode,
      publicEligible,
      verificationIssues: ["Plugin marketplace item is missing a plugin binding record."],
      verified: false
    };
  }

  if (expectedPluginKey && expectedPluginKey !== params.binding.pluginKey) {
    verificationIssues.push("Marketplace item_key does not match plugin_key.");
  }

  if (params.binding.pluginBindingStatus === "archived" && params.marketplaceStatus === "approved") {
    verificationIssues.push("Archived plugin binding cannot back an approved marketplace item.");
  }

  if (publicEligible && params.binding.pluginBindingStatus !== "active") {
    verificationIssues.push("Public approved plugin marketplace items require an active plugin binding.");
  }

  if (params.binding.pluginManifest.executable === true) {
    verificationIssues.push("Plugin manifest cannot enable executable runtime in foundation phase.");
  }

  return {
    bindingStatus: params.binding.pluginBindingStatus,
    linkedPluginId: params.binding.id,
    marketplaceStatus: params.marketplaceStatus,
    marketplaceVisibility: params.marketplaceVisibility,
    pluginKey: params.binding.pluginKey,
    pluginManifestSummary: manifestSummary(params.binding.pluginManifest),
    pluginName: params.binding.pluginName,
    pluginVersion: params.binding.pluginVersion,
    pricingMode: params.pricingMode,
    publicEligible,
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace plugin runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace plugin runtime.");
  }

  return admin;
}

async function loadMarketplacePluginItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(pluginItemSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace plugin item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace plugin item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);

  if (!id || !itemKey || !name || itemType !== "plugin") {
    throw new Error("Marketplace plugin runtime requires a plugin marketplace item.");
  }

  return {
    id,
    itemKey,
    linkedPluginId: text(row.linked_plugin_id, 120) || null,
    name,
    pricingMode: text(row.pricing_mode, 40) || "free",
    status: text(row.status, 40),
    visibility: text(row.visibility, 40)
  };
}

async function recordMarketplacePluginAudit(params: {
  binding: MarketplacePluginBindingRecord;
  inspection: MarketplacePluginInspection;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.binding.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_plugin_binding",
    metadata: {
      binding_status: params.binding.pluginBindingStatus,
      item_id: params.binding.marketplaceItemId,
      note: "Super Admin marketplace plugin runtime foundation verification. No plugin installation or execution.",
      plugin_key: params.binding.pluginKey,
      plugin_version: params.binding.pluginVersion,
      source_runtime: "marketplace_plugin_runtime",
      verification_issues: params.inspection.verificationIssues,
      verified: params.inspection.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplacePluginBindings(params: {
  itemId?: string;
  limit?: number;
} = {}): Promise<MarketplacePluginBindingRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_plugin_bindings" as never).select(bindingSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace plugin bindings could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplacePluginBinding(row))
    .filter((binding): binding is MarketplacePluginBindingRecord => Boolean(binding));
}

export async function getMarketplacePluginBindingByItemId(
  itemId: string
): Promise<MarketplacePluginBindingRecord | null> {
  const bindings = await listMarketplacePluginBindings({ itemId, limit: 1 });
  return bindings[0] ?? null;
}

export async function getMarketplacePluginInspection(itemId: string): Promise<MarketplacePluginInspection | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplacePluginItem(itemId);
    const binding = await getMarketplacePluginBindingByItemId(item.id);

    return evaluateMarketplacePluginBinding({
      binding,
      itemKey: item.itemKey,
      itemType: "plugin",
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      pricingMode: item.pricingMode
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires a plugin marketplace item")) {
      return null;
    }

    throw error;
  }
}

export async function verifyMarketplacePluginBinding(itemId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplacePluginItem(itemId);
  const binding = await getMarketplacePluginBindingByItemId(item.id);
  const inspection = evaluateMarketplacePluginBinding({
    binding,
    itemKey: item.itemKey,
    itemType: "plugin",
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    pricingMode: item.pricingMode
  });

  if (binding) {
    await recordMarketplacePluginAudit({
      binding,
      inspection,
      userId: access.user.id
    });
  }

  return inspection;
}

async function upsertPluginBindingForItem(row: Record<string, unknown>) {
  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const status = text(row.status, 40);

  if (!id || !itemKey) return null;

  const pluginKey = pluginKeyFromMarketplaceItemKey(itemKey);

  if (!isValidPluginKey(pluginKey)) return null;

  const catalog = PLUGIN_FOUNDATION_CATALOG[pluginKey];
  const pluginName = catalog?.name ?? name;
  const pluginVersion = catalog?.version ?? "1.0.0";
  const pluginManifest = sanitizePluginManifest(
    catalog?.manifest ?? {
      category: "foundation",
      executable: false,
      foundation_only: true,
      install_runtime: false,
      source: "marketplace_plugin_runtime"
    }
  );

  validatePluginManifest(pluginManifest);

  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("marketplace_plugin_bindings" as never)
    .select(bindingSelect as never)
    .eq("marketplace_item_id" as never, id as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Marketplace plugin binding could not be inspected: ${existingError.message}`);
  }

  const bindingStatus = bindingStatusForMarketplaceStatus(status);

  if (existing) {
    const parsed = parseMarketplacePluginBinding(existing);

    if (!parsed) {
      throw new Error("Existing marketplace plugin binding is invalid.");
    }

    const { data, error } = await admin
      .from("marketplace_plugin_bindings" as never)
      .update({
        plugin_manifest: pluginManifest,
        plugin_name: pluginName,
        plugin_version: pluginVersion
      } as never)
      .eq("id" as never, parsed.id as never)
      .select(bindingSelect as never)
      .single();

    if (error) {
      throw new Error(`Marketplace plugin binding could not be updated: ${error.message}`);
    }

    const binding = parseMarketplacePluginBinding(data);

    if (!binding) {
      throw new Error("Updated marketplace plugin binding is invalid.");
    }

    await admin
      .from("marketplace_items" as never)
      .update({ linked_plugin_id: binding.id } as never)
      .eq("id" as never, id as never);

    return binding;
  }

  const { data, error } = await admin
    .from("marketplace_plugin_bindings" as never)
    .insert({
      marketplace_item_id: id,
      plugin_binding_status: bindingStatus,
      plugin_key: pluginKey,
      plugin_manifest: pluginManifest,
      plugin_name: pluginName,
      plugin_version: pluginVersion
    } as never)
    .select(bindingSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace plugin binding could not be created: ${error.message}`);
  }

  const binding = parseMarketplacePluginBinding(data);

  if (!binding) {
    throw new Error("Created marketplace plugin binding is invalid.");
  }

  await admin
    .from("marketplace_items" as never)
    .update({ linked_plugin_id: binding.id } as never)
    .eq("id" as never, id as never);

  return binding;
}

export async function ensureMarketplacePluginBindings() {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(pluginItemSelect as never)
    .eq("item_type" as never, "plugin" as never);

  if (error) {
    throw new Error(`Marketplace plugin items could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    await upsertPluginBindingForItem(row);
  }
}

export async function getMarketplacePluginBindingStats(): Promise<MarketplacePluginBindingStats> {
  await ensureMarketplacePluginBindings();

  const admin = requireAdminClient();
  const [{ data: items, error: itemsError }, bindings] = await Promise.all([
    admin.from("marketplace_items" as never).select("id" as never).eq("item_type" as never, "plugin" as never),
    listMarketplacePluginBindings({ limit: 1000 })
  ]);

  if (itemsError) {
    throw new Error(`Marketplace plugin items could not be counted: ${itemsError.message}`);
  }

  const itemRows = Array.isArray(items) ? items : [];

  return bindings.reduce<MarketplacePluginBindingStats>(
    (stats, binding) => {
      if (binding.pluginBindingStatus === "active") stats.activePluginBindings += 1;
      if (binding.pluginBindingStatus === "draft") stats.draftPluginBindings += 1;
      if (binding.pluginBindingStatus === "disabled") stats.disabledPluginBindings += 1;
      if (binding.pluginBindingStatus === "archived") stats.archivedPluginBindings += 1;

      return stats;
    },
    {
      activePluginBindings: 0,
      archivedPluginBindings: 0,
      disabledPluginBindings: 0,
      draftPluginBindings: 0,
      totalPluginBindings: bindings.length,
      totalPluginItems: itemRows.length,
      verifiedPluginBindings: 0
    }
  );
}
