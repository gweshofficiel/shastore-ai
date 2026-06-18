import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateMarketplaceAppBinding,
  parseMarketplaceAppBinding,
  type MarketplaceAppBindingRecord
} from "@/src/lib/marketplace/marketplace-app-runtime";
import {
  recordMarketplaceInstallEvent,
  transitionMarketplaceInstallStatus,
  type MarketplaceInstallEventRecord
} from "@/src/lib/marketplace/marketplace-install-runtime";
import {
  evaluateMarketplacePluginBinding,
  parseMarketplacePluginBinding,
  type MarketplacePluginBindingRecord
} from "@/src/lib/marketplace/marketplace-plugin-runtime";
import {
  getMarketplacePurchaseById,
  type MarketplacePurchaseRecord
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceAppPluginInstallationType = "app" | "plugin";

export type MarketplaceAppPluginInstallationStatus =
  | "active"
  | "disabled"
  | "failed"
  | "installed"
  | "pending"
  | "uninstalled";

export type MarketplaceAppPluginInstallationRecord = {
  appBindingId: string | null;
  buyerAccountId: string | null;
  createdAt: string | null;
  disabledAt: string | null;
  id: string;
  installationStatus: MarketplaceAppPluginInstallationStatus;
  installationType: MarketplaceAppPluginInstallationType;
  installedAt: string | null;
  marketplaceItemId: string;
  marketplacePurchaseId: string;
  metadata: Record<string, unknown>;
  pluginBindingId: string | null;
  storeId: string | null;
  uninstalledAt: string | null;
  updatedAt: string | null;
};

export type MarketplaceAppPluginInstallationEligibility = {
  appBindingId: string | null;
  appKey: string | null;
  appName: string | null;
  bindingVerified: boolean;
  buyerAccountId: string | null;
  eligible: boolean;
  installationType: MarketplaceAppPluginInstallationType | null;
  itemId: string;
  itemKey: string;
  itemName: string;
  marketplacePurchaseId: string;
  pluginBindingId: string | null;
  pluginKey: string | null;
  pluginName: string | null;
  purchaseStatus: string;
  storeId: string | null;
  verificationIssues: string[];
};

export type MarketplaceAppPluginInstallationStats = {
  activeInstallations: number;
  appInstallations: number;
  disabledInstallations: number;
  failedInstallations: number;
  installedInstallations: number;
  pendingInstallations: number;
  pluginInstallations: number;
  totalInstallations: number;
  uninstalledInstallations: number;
};

export type CreateMarketplaceAppPluginInstallationInput = {
  storeId?: string | null;
};

export const MARKETPLACE_APP_PLUGIN_INSTALLATION_TYPES: readonly MarketplaceAppPluginInstallationType[] = [
  "app",
  "plugin"
] as const;

export const MARKETPLACE_APP_PLUGIN_INSTALLATION_STATUSES: readonly MarketplaceAppPluginInstallationStatus[] = [
  "pending",
  "installed",
  "active",
  "disabled",
  "uninstalled",
  "failed"
] as const;

const ACTIVE_INSTALLATION_STATUSES: readonly MarketplaceAppPluginInstallationStatus[] = [
  "pending",
  "installed",
  "active"
] as const;

const appBindingSelect =
  "id, marketplace_item_id, app_key, app_name, app_version, app_manifest, app_binding_status, created_at, updated_at";

const pluginBindingSelect =
  "id, marketplace_item_id, plugin_key, plugin_name, plugin_version, plugin_manifest, plugin_binding_status, created_at, updated_at";

const installationSelect =
  "id, marketplace_purchase_id, marketplace_item_id, app_binding_id, plugin_binding_id, buyer_account_id, store_id, installation_type, installation_status, installed_at, disabled_at, uninstalled_at, metadata, created_at, updated_at";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key)/i;

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

export function isValidMarketplaceAppPluginInstallationType(
  value: unknown
): value is MarketplaceAppPluginInstallationType {
  return MARKETPLACE_APP_PLUGIN_INSTALLATION_TYPES.includes(value as MarketplaceAppPluginInstallationType);
}

export function isValidMarketplaceAppPluginInstallationStatus(
  value: unknown
): value is MarketplaceAppPluginInstallationStatus {
  return MARKETPLACE_APP_PLUGIN_INSTALLATION_STATUSES.includes(value as MarketplaceAppPluginInstallationStatus);
}

export function parseMarketplaceAppPluginInstallationType(
  value: unknown
): MarketplaceAppPluginInstallationType | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAppPluginInstallationType(cleaned) ? cleaned : null;
}

export function parseMarketplaceAppPluginInstallationStatus(
  value: unknown
): MarketplaceAppPluginInstallationStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAppPluginInstallationStatus(cleaned) ? cleaned : null;
}

export function sanitizeAppPluginInstallationMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string") {
      if (/\bjavascript:/i.test(value)) continue;
      if (/<script/i.test(value)) continue;
      if (/\beval\s*\(/i.test(value)) continue;
    }

    clean[key] = value;
  }

  clean.app_execution_runtime = false;
  clean.foundation_only = true;
  clean.plugin_execution_runtime = false;
  clean.remote_script_runtime = false;

  return clean;
}

export function validateAppPluginInstallationMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "App/plugin installation metadata must not contain secrets, card data, private keys, or payout credentials."
    );
  }

  if (/<script/i.test(serialized) || /\beval\s*\(/i.test(serialized)) {
    throw new Error("App/plugin installation metadata must not contain executable code.");
  }
}

export function parseMarketplaceAppPluginInstallation(
  value: unknown
): MarketplaceAppPluginInstallationRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplacePurchaseId = text(row.marketplace_purchase_id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const installationType = parseMarketplaceAppPluginInstallationType(row.installation_type);
  const installationStatus = parseMarketplaceAppPluginInstallationStatus(row.installation_status);

  if (!id || !marketplacePurchaseId || !marketplaceItemId || !installationType || !installationStatus) {
    return null;
  }

  const metadata = sanitizeAppPluginInstallationMetadata(safeRecord(row.metadata));

  try {
    validateAppPluginInstallationMetadata(metadata);
  } catch {
    return null;
  }

  return {
    appBindingId: text(row.app_binding_id, 120) || null,
    buyerAccountId: text(row.buyer_account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    disabledAt: text(row.disabled_at, 80) || null,
    id,
    installationStatus,
    installationType,
    installedAt: text(row.installed_at, 80) || null,
    marketplaceItemId,
    marketplacePurchaseId,
    metadata,
    pluginBindingId: text(row.plugin_binding_id, 120) || null,
    storeId: text(row.store_id, 120) || null,
    uninstalledAt: text(row.uninstalled_at, 80) || null,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function evaluateMarketplaceAppPluginInstallationEligibility(params: {
  appInspection: ReturnType<typeof evaluateMarketplaceAppBinding> | null;
  existingActiveInstallation: MarketplaceAppPluginInstallationRecord | null;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    linkedAppId: string | null;
    linkedPluginId: string | null;
    name: string;
    pricingMode: string;
    status: string;
    visibility: string;
  };
  pluginInspection: ReturnType<typeof evaluateMarketplacePluginBinding> | null;
  purchase: MarketplacePurchaseRecord;
  storeId: string | null;
  storeValidated: boolean;
}): MarketplaceAppPluginInstallationEligibility {
  const verificationIssues: string[] = [];

  if (params.purchase.purchaseStatus !== "paid") {
    verificationIssues.push("Marketplace purchase must be paid before creating an app or plugin installation.");
  }

  if (params.purchase.marketplaceItemId !== params.item.id) {
    verificationIssues.push("Marketplace purchase does not match the app or plugin marketplace item.");
  }

  if (params.item.itemType !== "app" && params.item.itemType !== "plugin") {
    verificationIssues.push("Marketplace item must be an app or plugin.");
  }

  if (
    !isPublicMarketplaceEligible({
      status: params.item.status as "approved",
      visibility: params.item.visibility as "public"
    })
  ) {
    verificationIssues.push("App or plugin marketplace item must be approved and public.");
  }

  const installationType: MarketplaceAppPluginInstallationType | null =
    params.item.itemType === "app" || params.item.itemType === "plugin" ? params.item.itemType : null;

  let appBindingId: string | null = null;
  let pluginBindingId: string | null = null;
  let appKey: string | null = null;
  let appName: string | null = null;
  let pluginKey: string | null = null;
  let pluginName: string | null = null;
  let bindingVerified = false;

  if (installationType === "app") {
    if (!params.appInspection) {
      verificationIssues.push("App marketplace item is missing app binding inspection.");
    } else {
      appKey = params.appInspection.appKey;
      appName = params.appInspection.appName;
      appBindingId = params.appInspection.linkedAppId;
      bindingVerified = params.appInspection.verified;

      if (!params.appInspection.verified) {
        verificationIssues.push("App marketplace item requires a verified app binding.");
        verificationIssues.push(...params.appInspection.verificationIssues);
      }

      if (params.item.linkedAppId && appBindingId && params.item.linkedAppId !== appBindingId) {
        verificationIssues.push("App binding does not match marketplace item linked_app_id.");
      }
    }
  }

  if (installationType === "plugin") {
    if (!params.pluginInspection) {
      verificationIssues.push("Plugin marketplace item is missing plugin binding inspection.");
    } else {
      pluginKey = params.pluginInspection.pluginKey;
      pluginName = params.pluginInspection.pluginName;
      pluginBindingId = params.pluginInspection.linkedPluginId;
      bindingVerified = params.pluginInspection.verified;

      if (!params.pluginInspection.verified) {
        verificationIssues.push("Plugin marketplace item requires a verified plugin binding.");
        verificationIssues.push(...params.pluginInspection.verificationIssues);
      }

      if (params.item.linkedPluginId && pluginBindingId && params.item.linkedPluginId !== pluginBindingId) {
        verificationIssues.push("Plugin binding does not match marketplace item linked_plugin_id.");
      }
    }
  }

  if (params.purchase.buyerAccountId && !text(params.purchase.buyerAccountId, 120)) {
    verificationIssues.push("Buyer account id is invalid.");
  }

  if (params.storeId && !params.storeValidated) {
    verificationIssues.push("Store id could not be validated for installation.");
  }

  if (params.existingActiveInstallation) {
    verificationIssues.push("An active app or plugin installation already exists for this purchase or store.");
  }

  return {
    appBindingId,
    appKey,
    appName,
    bindingVerified,
    buyerAccountId: params.purchase.buyerAccountId,
    eligible: verificationIssues.length === 0,
    installationType,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    marketplacePurchaseId: params.purchase.id,
    pluginBindingId,
    pluginKey,
    pluginName,
    purchaseStatus: params.purchase.purchaseStatus,
    storeId: params.storeId,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace app and plugin installation runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "Service-role admin access is required for marketplace app and plugin installation runtime."
    );
  }

  return admin;
}

async function loadAppPluginMarketplaceItem(itemId: string) {
  const items = await listMarketplaceItemsForPublicCatalog({ itemId: text(itemId, 120), limit: 1 });
  const item = items[0];

  if (!item || (item.itemType !== "app" && item.itemType !== "plugin")) {
    throw new Error("Public app or plugin marketplace item was not found.");
  }

  return item;
}

async function loadAppBindingByItemId(itemId: string): Promise<MarketplaceAppBindingRecord | null> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_app_bindings" as never)
    .select(appBindingSelect as never)
    .eq("marketplace_item_id" as never, text(itemId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace app binding could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceAppBinding(data) : null;
}

async function loadPluginBindingByItemId(itemId: string): Promise<MarketplacePluginBindingRecord | null> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_plugin_bindings" as never)
    .select(pluginBindingSelect as never)
    .eq("marketplace_item_id" as never, text(itemId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace plugin binding could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplacePluginBinding(data) : null;
}

async function validateStoreForInstallation(params: { buyerAccountId: string | null; storeId: string }) {
  const admin = requireAdminClient();
  const cleanedStoreId = text(params.storeId, 120);

  if (!cleanedStoreId) {
    return false;
  }

  const { data, error } = await admin
    .from("stores" as never)
    .select("id, user_id, owner_user_id" as never)
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Store could not be validated for installation: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  const row = rowRecord(data);
  const ownerId = text(row?.owner_user_id, 120) || text(row?.user_id, 120);

  if (params.buyerAccountId && ownerId && ownerId !== params.buyerAccountId) {
    throw new Error("Store ownership does not match the marketplace purchase buyer account.");
  }

  return true;
}

async function getActiveInstallationForPurchase(purchaseId: string) {
  const installations = await listMarketplaceAppPluginInstallations({
    limit: 1,
    marketplacePurchaseId: purchaseId,
    installationStatus: [...ACTIVE_INSTALLATION_STATUSES]
  });

  return installations[0] ?? null;
}

async function getActiveInstallationForStoreItem(params: { itemId: string; storeId: string }) {
  const installations = await listMarketplaceAppPluginInstallations({
    itemId: params.itemId,
    limit: 1,
    installationStatus: [...ACTIVE_INSTALLATION_STATUSES],
    storeId: params.storeId
  });

  return installations[0] ?? null;
}

async function recordInstallationAudit(params: {
  eligibility: MarketplaceAppPluginInstallationEligibility;
  installation: MarketplaceAppPluginInstallationRecord;
  note: string;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.installation.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_app_plugin_installation_foundation",
    metadata: {
      app_binding_id: params.installation.appBindingId,
      app_key: params.eligibility.appKey,
      app_name: params.eligibility.appName,
      installation_status: params.installation.installationStatus,
      installation_type: params.installation.installationType,
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      marketplace_item_id: params.installation.marketplaceItemId,
      marketplace_purchase_id: params.installation.marketplacePurchaseId,
      note: params.note,
      plugin_binding_id: params.installation.pluginBindingId,
      plugin_key: params.eligibility.pluginKey,
      plugin_name: params.eligibility.pluginName,
      source_runtime: "marketplace_app_plugin_installation_runtime",
      store_id: params.installation.storeId,
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: params.installation.storeId,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

function installEventIdFromMetadata(metadata: Record<string, unknown>) {
  return text(metadata.install_event_id, 120) || null;
}

async function syncInstallCounterForInstallation(params: {
  accountId: string | null;
  installation: MarketplaceAppPluginInstallationRecord;
  installStatus: "active" | "disabled" | "uninstalled";
}) {
  if (!params.installation.storeId) {
    return null;
  }

  const existingEventId = installEventIdFromMetadata(params.installation.metadata);

  if (existingEventId && params.installStatus !== "active") {
    return transitionMarketplaceInstallStatus(existingEventId, params.installStatus);
  }

  if (params.installStatus === "active") {
    const event = await recordMarketplaceInstallEvent(params.installation.marketplaceItemId, {
      accountId: params.accountId,
      installStatus: "active",
      metadata: {
        app_plugin_installation_id: params.installation.id,
        foundation_only: true,
        installation_type: params.installation.installationType,
        marketplace_purchase_id: params.installation.marketplacePurchaseId,
        source_runtime: "marketplace_app_plugin_installation_runtime"
      },
      publicInstall: true,
      source: "marketplace_app_plugin_installation_runtime",
      storeId: params.installation.storeId
    });

    return event;
  }

  return null;
}

export async function listMarketplaceAppPluginInstallations(params: {
  buyerAccountId?: string;
  installationStatus?:
    | MarketplaceAppPluginInstallationStatus
    | MarketplaceAppPluginInstallationStatus[];
  installationType?: MarketplaceAppPluginInstallationType;
  itemId?: string;
  limit?: number;
  marketplacePurchaseId?: string;
  storeId?: string;
} = {}): Promise<MarketplaceAppPluginInstallationRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin
    .from("marketplace_app_plugin_installations" as never)
    .select(installationSelect as never);

  if (params.marketplacePurchaseId) {
    query = query.eq(
      "marketplace_purchase_id" as never,
      text(params.marketplacePurchaseId, 120) as never
    );
  }

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.storeId) {
    query = query.eq("store_id" as never, text(params.storeId, 120) as never);
  }

  if (params.buyerAccountId) {
    query = query.eq("buyer_account_id" as never, text(params.buyerAccountId, 120) as never);
  }

  if (params.installationType) {
    query = query.eq("installation_type" as never, params.installationType as never);
  }

  if (params.installationStatus) {
    const statuses = Array.isArray(params.installationStatus)
      ? params.installationStatus
      : [params.installationStatus];
    query = query.in("installation_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace app/plugin installations could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceAppPluginInstallation(row))
    .filter((installation): installation is MarketplaceAppPluginInstallationRecord => Boolean(installation));
}

export async function getMarketplaceAppPluginInstallationById(
  installationId: string
): Promise<MarketplaceAppPluginInstallationRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_app_plugin_installations" as never)
    .select(installationSelect as never)
    .eq("id" as never, text(installationId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace app/plugin installation could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceAppPluginInstallation(data) : null;
}

export async function getMarketplaceAppPluginInstallationByPurchaseId(
  purchaseId: string
): Promise<MarketplaceAppPluginInstallationRecord | null> {
  const installations = await listMarketplaceAppPluginInstallations({
    limit: 1,
    marketplacePurchaseId: purchaseId
  });

  return installations[0] ?? null;
}

export async function getMarketplaceAppPluginInstallationStats(): Promise<MarketplaceAppPluginInstallationStats> {
  const installations = await listMarketplaceAppPluginInstallations({ limit: 2000 });

  return installations.reduce<MarketplaceAppPluginInstallationStats>(
    (stats, installation) => {
      stats.totalInstallations += 1;

      if (installation.installationType === "app") stats.appInstallations += 1;
      if (installation.installationType === "plugin") stats.pluginInstallations += 1;
      if (installation.installationStatus === "pending") stats.pendingInstallations += 1;
      if (installation.installationStatus === "installed") stats.installedInstallations += 1;
      if (installation.installationStatus === "active") stats.activeInstallations += 1;
      if (installation.installationStatus === "disabled") stats.disabledInstallations += 1;
      if (installation.installationStatus === "uninstalled") stats.uninstalledInstallations += 1;
      if (installation.installationStatus === "failed") stats.failedInstallations += 1;

      return stats;
    },
    {
      activeInstallations: 0,
      appInstallations: 0,
      disabledInstallations: 0,
      failedInstallations: 0,
      installedInstallations: 0,
      pendingInstallations: 0,
      pluginInstallations: 0,
      totalInstallations: 0,
      uninstalledInstallations: 0
    }
  );
}

export async function inspectMarketplaceAppPluginInstallationEligibility(
  purchaseId: string,
  input: CreateMarketplaceAppPluginInstallationInput = {}
) {
  await requireSuperAdmin();

  const purchase = await getMarketplacePurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  const item = await loadAppPluginMarketplaceItem(purchase.marketplaceItemId);
  const storeId = text(input.storeId, 120) || null;
  const storeValidated = storeId
    ? await validateStoreForInstallation({
        buyerAccountId: purchase.buyerAccountId,
        storeId
      })
    : false;

  const appBinding = item.itemType === "app" ? await loadAppBindingByItemId(item.id) : null;
  const pluginBinding = item.itemType === "plugin" ? await loadPluginBindingByItemId(item.id) : null;

  const appInspection =
    item.itemType === "app"
      ? evaluateMarketplaceAppBinding({
          binding: appBinding,
          itemKey: item.itemKey,
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          pricingMode: item.pricing.mode
        })
      : null;

  const pluginInspection =
    item.itemType === "plugin"
      ? evaluateMarketplacePluginBinding({
          binding: pluginBinding,
          itemKey: item.itemKey,
          itemType: item.itemType,
          marketplaceStatus: item.status,
          marketplaceVisibility: item.visibility,
          pricingMode: item.pricing.mode
        })
      : null;

  const existingByPurchase = await getActiveInstallationForPurchase(purchase.id);
  const existingByStore =
    storeId && storeValidated
      ? await getActiveInstallationForStoreItem({ itemId: item.id, storeId })
      : null;

  return evaluateMarketplaceAppPluginInstallationEligibility({
    appInspection,
    existingActiveInstallation: existingByPurchase ?? existingByStore,
    item: {
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      linkedAppId: item.linkedAppId,
      linkedPluginId: item.linkedPluginId,
      name: item.name,
      pricingMode: item.pricing.mode,
      status: item.status,
      visibility: item.visibility
    },
    pluginInspection,
    purchase,
    storeId,
    storeValidated
  });
}

export async function createMarketplaceAppPluginInstallationFromPurchase(
  purchaseId: string,
  input: CreateMarketplaceAppPluginInstallationInput = {}
) {
  const access = await requireSuperAdmin();
  const eligibility = await inspectMarketplaceAppPluginInstallationEligibility(purchaseId, input);

  if (!eligibility.eligible || !eligibility.installationType) {
    throw new Error(eligibility.verificationIssues[0] ?? "App/plugin installation eligibility failed.");
  }

  const now = new Date().toISOString();
  const metadata = sanitizeAppPluginInstallationMetadata({
    app_key: eligibility.appKey,
    app_name: eligibility.appName,
    foundation_only: true,
    installation_type: eligibility.installationType,
    item_key: eligibility.itemKey,
    item_name: eligibility.itemName,
    plugin_key: eligibility.pluginKey,
    plugin_name: eligibility.pluginName,
    purchase_status: eligibility.purchaseStatus,
    source_runtime: "marketplace_app_plugin_installation_runtime"
  });

  validateAppPluginInstallationMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_app_plugin_installations" as never)
    .insert({
      app_binding_id: eligibility.installationType === "app" ? eligibility.appBindingId : null,
      buyer_account_id: eligibility.buyerAccountId,
      disabled_at: null,
      installation_status: "active",
      installation_type: eligibility.installationType,
      installed_at: now,
      marketplace_item_id: eligibility.itemId,
      marketplace_purchase_id: eligibility.marketplacePurchaseId,
      metadata,
      plugin_binding_id: eligibility.installationType === "plugin" ? eligibility.pluginBindingId : null,
      store_id: eligibility.storeId,
      uninstalled_at: null
    } as never)
    .select(installationSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace app/plugin installation could not be created: ${error.message}`);
  }

  let installation = parseMarketplaceAppPluginInstallation(data);

  if (!installation) {
    throw new Error("Created marketplace app/plugin installation record is invalid.");
  }

  let installEvent: MarketplaceInstallEventRecord | null = null;

  try {
    installEvent = await syncInstallCounterForInstallation({
      accountId: installation.buyerAccountId,
      installation,
      installStatus: "active"
    });
  } catch (counterError) {
    await admin
      .from("marketplace_app_plugin_installations" as never)
      .update({
        installation_status: "failed",
        metadata: sanitizeAppPluginInstallationMetadata({
          ...installation.metadata,
          install_counter_error:
            counterError instanceof Error ? counterError.message : "Install counter sync failed."
        })
      } as never)
      .eq("id" as never, installation.id as never);

    throw counterError;
  }

  if (installEvent) {
    const nextMetadata = sanitizeAppPluginInstallationMetadata({
      ...installation.metadata,
      install_event_id: installEvent.id
    });

    validateAppPluginInstallationMetadata(nextMetadata);

    const { data: updatedData, error: updateError } = await admin
      .from("marketplace_app_plugin_installations" as never)
      .update({ metadata: nextMetadata } as never)
      .eq("id" as never, installation.id as never)
      .select(installationSelect as never)
      .single();

    if (updateError) {
      throw new Error(`Marketplace app/plugin installation metadata could not be updated: ${updateError.message}`);
    }

    installation = parseMarketplaceAppPluginInstallation(updatedData);

    if (!installation) {
      throw new Error("Updated marketplace app/plugin installation record is invalid.");
    }
  }

  await recordInstallationAudit({
    eligibility,
    installation,
    note: "Super Admin marketplace app/plugin installation foundation. No app/plugin execution, remote scripts, or payouts.",
    userId: access.user.id
  });

  return installation;
}

export async function disableMarketplaceAppPluginInstallationFoundation(installationId: string) {
  const access = await requireSuperAdmin();
  const installation = await getMarketplaceAppPluginInstallationById(installationId);

  if (!installation) {
    throw new Error("Marketplace app/plugin installation was not found.");
  }

  if (installation.installationStatus === "uninstalled") {
    throw new Error("Uninstalled app/plugin installations cannot be disabled.");
  }

  if (installation.installationStatus === "disabled") {
    return installation;
  }

  const now = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_app_plugin_installations" as never)
    .update({
      disabled_at: now,
      installation_status: "disabled"
    } as never)
    .eq("id" as never, installation.id as never)
    .select(installationSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace app/plugin installation could not be disabled: ${error.message}`);
  }

  const updated = parseMarketplaceAppPluginInstallation(data);

  if (!updated) {
    throw new Error("Disabled marketplace app/plugin installation record is invalid.");
  }

  await syncInstallCounterForInstallation({
    accountId: updated.buyerAccountId,
    installation: updated,
    installStatus: "disabled"
  });

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_disable_app_plugin_installation_foundation",
    metadata: {
      installation_status: updated.installationStatus,
      installation_type: updated.installationType,
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace app/plugin installation disable foundation. No app/plugin execution.",
      source_runtime: "marketplace_app_plugin_installation_runtime",
      store_id: updated.storeId
    },
    store_id: updated.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function uninstallMarketplaceAppPluginInstallationFoundation(installationId: string) {
  const access = await requireSuperAdmin();
  const installation = await getMarketplaceAppPluginInstallationById(installationId);

  if (!installation) {
    throw new Error("Marketplace app/plugin installation was not found.");
  }

  if (installation.installationStatus === "uninstalled") {
    return installation;
  }

  const now = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_app_plugin_installations" as never)
    .update({
      installation_status: "uninstalled",
      uninstalled_at: now
    } as never)
    .eq("id" as never, installation.id as never)
    .select(installationSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace app/plugin installation could not be uninstalled: ${error.message}`);
  }

  const updated = parseMarketplaceAppPluginInstallation(data);

  if (!updated) {
    throw new Error("Uninstalled marketplace app/plugin installation record is invalid.");
  }

  await syncInstallCounterForInstallation({
    accountId: updated.buyerAccountId,
    installation: updated,
    installStatus: "uninstalled"
  });

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_uninstall_app_plugin_installation_foundation",
    metadata: {
      installation_status: updated.installationStatus,
      installation_type: updated.installationType,
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace app/plugin installation uninstall foundation. No app/plugin execution.",
      source_runtime: "marketplace_app_plugin_installation_runtime",
      store_id: updated.storeId
    },
    store_id: updated.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}
