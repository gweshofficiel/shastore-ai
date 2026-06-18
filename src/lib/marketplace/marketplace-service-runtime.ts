import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceServiceBindingStatus = "active" | "archived" | "disabled" | "draft";

export type MarketplaceServiceBindingRecord = {
  createdAt: string | null;
  id: string;
  marketplaceItemId: string;
  serviceBindingStatus: MarketplaceServiceBindingStatus;
  serviceCategory: string;
  serviceDescription: string;
  serviceDurationDays: number;
  serviceKey: string;
  serviceName: string;
  serviceRequirements: Record<string, unknown>;
  updatedAt: string | null;
};

export type MarketplaceServiceInspection = {
  bindingStatus: MarketplaceServiceBindingStatus | null;
  linkedServiceId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: string;
  publicEligible: boolean;
  serviceCategory: string | null;
  serviceDescription: string | null;
  serviceDurationDays: number | null;
  serviceKey: string | null;
  serviceName: string | null;
  serviceRequirementsSummary: string[];
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceServiceBindingStats = {
  activeServiceBindings: number;
  archivedServiceBindings: number;
  disabledServiceBindings: number;
  draftServiceBindings: number;
  totalServiceBindings: number;
  totalServiceItems: number;
  verifiedServiceBindings: number;
};

export const MARKETPLACE_SERVICE_BINDING_STATUSES: readonly MarketplaceServiceBindingStatus[] = [
  "draft",
  "active",
  "disabled",
  "archived"
] as const;

const SERVICE_FOUNDATION_CATALOG: Record<
  string,
  {
    category: string;
    description: string;
    durationDays: number;
    name: string;
    requirements: Record<string, unknown>;
  }
> = {
  "store-launch-assistance": {
    category: "launch_assistance",
    description: "Guided store launch assistance with onboarding checkpoints and setup review.",
    durationDays: 14,
    name: "Store Launch Assistance",
    requirements: {
      booking_runtime: false,
      delivery_runtime: false,
      foundation_only: true,
      prerequisites: ["active_store", "published_catalog"],
      purchase_runtime: false
    }
  }
};

const bindingSelect =
  "id, marketplace_item_id, service_key, service_name, service_category, service_description, service_duration_days, service_binding_status, service_requirements, created_at, updated_at";

const serviceItemSelect =
  "id, item_key, name, item_type, section, status, visibility, pricing_mode, linked_service_id";

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

function parseDurationDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export function isValidMarketplaceServiceBindingStatus(
  value: unknown
): value is MarketplaceServiceBindingStatus {
  return MARKETPLACE_SERVICE_BINDING_STATUSES.includes(value as MarketplaceServiceBindingStatus);
}

export function parseMarketplaceServiceBindingStatus(
  value: unknown
): MarketplaceServiceBindingStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceServiceBindingStatus(cleaned) ? cleaned : null;
}

export function serviceKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("service:") ? cleaned.slice("service:".length) : "";
}

export function isValidServiceKey(value: unknown) {
  const cleaned = text(value, 120);
  return /^[a-z0-9][a-z0-9_-]{0,119}$/.test(cleaned);
}

export function sanitizeServiceRequirements(requirements: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(requirements)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.booking_runtime = false;
  clean.purchase_runtime = false;
  clean.delivery_runtime = false;

  return clean;
}

export function validateServiceRequirements(requirements: Record<string, unknown>) {
  const serialized = JSON.stringify(requirements);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Service requirements must not contain secrets.");
  }
}

export function parseMarketplaceServiceBinding(value: unknown): MarketplaceServiceBindingRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const serviceKey = text(row.service_key, 120);
  const serviceName = text(row.service_name, 240);
  const serviceCategory = text(row.service_category, 120);
  const serviceDescription = text(row.service_description, 2000);
  const serviceBindingStatus = parseMarketplaceServiceBindingStatus(row.service_binding_status);

  if (
    !id ||
    !marketplaceItemId ||
    !serviceKey ||
    !serviceName ||
    !serviceCategory ||
    !serviceBindingStatus
  ) {
    return null;
  }

  if (!isValidServiceKey(serviceKey)) return null;

  const serviceRequirements = sanitizeServiceRequirements(safeRecord(row.service_requirements));

  try {
    validateServiceRequirements(serviceRequirements);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    id,
    marketplaceItemId,
    serviceBindingStatus,
    serviceCategory,
    serviceDescription,
    serviceDurationDays: parseDurationDays(row.service_duration_days),
    serviceKey,
    serviceName,
    serviceRequirements,
    updatedAt: text(row.updated_at, 80) || null
  };
}

function requirementsSummary(binding: {
  serviceCategory: string;
  serviceDescription: string;
  serviceDurationDays: number;
  serviceRequirements: Record<string, unknown>;
}) {
  const summary: string[] = [];

  summary.push(`Category: ${binding.serviceCategory}`);

  if (binding.serviceDurationDays > 0) {
    summary.push(`Duration: ${binding.serviceDurationDays} days`);
  }

  if (Array.isArray(binding.serviceRequirements.prerequisites)) {
    summary.push(
      `Prerequisites: ${binding.serviceRequirements.prerequisites.map((value) => text(value, 80)).filter(Boolean).join(", ")}`
    );
  }

  summary.push("Foundation only");
  summary.push("No purchase or booking runtime");

  return summary;
}

function bindingStatusForMarketplaceStatus(status: string): MarketplaceServiceBindingStatus {
  if (status === "approved") return "active";
  if (status === "archived") return "archived";
  if (status === "rejected") return "disabled";
  return "draft";
}

export function evaluateMarketplaceServiceBinding(params: {
  binding: MarketplaceServiceBindingRecord | null;
  itemKey: string;
  itemType: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: string;
}): MarketplaceServiceInspection {
  if (params.itemType !== "service") {
    return {
      bindingStatus: null,
      linkedServiceId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pricingMode: params.pricingMode,
      publicEligible: false,
      serviceCategory: null,
      serviceDescription: null,
      serviceDurationDays: null,
      serviceKey: null,
      serviceName: null,
      serviceRequirementsSummary: [],
      verificationIssues: [],
      verified: true
    };
  }

  const verificationIssues: string[] = [];
  const expectedServiceKey = serviceKeyFromMarketplaceItemKey(params.itemKey);
  const publicEligible =
    params.marketplaceStatus === "approved" && params.marketplaceVisibility === "public";

  if (!params.binding) {
    return {
      bindingStatus: null,
      linkedServiceId: null,
      marketplaceStatus: params.marketplaceStatus,
      marketplaceVisibility: params.marketplaceVisibility,
      pricingMode: params.pricingMode,
      publicEligible,
      serviceCategory: null,
      serviceDescription: null,
      serviceDurationDays: null,
      serviceKey: expectedServiceKey || null,
      serviceName: null,
      serviceRequirementsSummary: [],
      verificationIssues: ["Service marketplace item is missing a service binding record."],
      verified: false
    };
  }

  if (expectedServiceKey && expectedServiceKey !== params.binding.serviceKey) {
    verificationIssues.push("Marketplace item_key does not match service_key.");
  }

  if (params.binding.serviceBindingStatus === "archived" && params.marketplaceStatus === "approved") {
    verificationIssues.push("Archived service binding cannot back an approved marketplace item.");
  }

  if (publicEligible && params.binding.serviceBindingStatus !== "active") {
    verificationIssues.push("Public approved service marketplace items require an active service binding.");
  }

  if (!params.binding.serviceCategory) {
    verificationIssues.push("Service binding requires a service category.");
  }

  return {
    bindingStatus: params.binding.serviceBindingStatus,
    linkedServiceId: params.binding.id,
    marketplaceStatus: params.marketplaceStatus,
    marketplaceVisibility: params.marketplaceVisibility,
    pricingMode: params.pricingMode,
    publicEligible,
    serviceCategory: params.binding.serviceCategory,
    serviceDescription: params.binding.serviceDescription,
    serviceDurationDays: params.binding.serviceDurationDays,
    serviceKey: params.binding.serviceKey,
    serviceName: params.binding.serviceName,
    serviceRequirementsSummary: requirementsSummary(params.binding),
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace service runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace service runtime.");
  }

  return admin;
}

async function loadMarketplaceServiceItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(serviceItemSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace service item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace service item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);

  if (!id || !itemKey || !name || itemType !== "service") {
    throw new Error("Marketplace service runtime requires a service marketplace item.");
  }

  return {
    id,
    itemKey,
    linkedServiceId: text(row.linked_service_id, 120) || null,
    name,
    pricingMode: text(row.pricing_mode, 40) || "free",
    status: text(row.status, 40),
    visibility: text(row.visibility, 40)
  };
}

async function recordMarketplaceServiceAudit(params: {
  binding: MarketplaceServiceBindingRecord;
  inspection: MarketplaceServiceInspection;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.binding.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_service_binding",
    metadata: {
      binding_status: params.binding.serviceBindingStatus,
      item_id: params.binding.marketplaceItemId,
      note: "Super Admin marketplace service runtime foundation verification. No purchase, booking, delivery, or payouts.",
      service_category: params.binding.serviceCategory,
      service_key: params.binding.serviceKey,
      source_runtime: "marketplace_service_runtime",
      verification_issues: params.inspection.verificationIssues,
      verified: params.inspection.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceServiceBindings(params: {
  itemId?: string;
  limit?: number;
} = {}): Promise<MarketplaceServiceBindingRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_service_bindings" as never).select(bindingSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace service bindings could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceServiceBinding(row))
    .filter((binding): binding is MarketplaceServiceBindingRecord => Boolean(binding));
}

export async function getMarketplaceServiceBindingByItemId(
  itemId: string
): Promise<MarketplaceServiceBindingRecord | null> {
  const bindings = await listMarketplaceServiceBindings({ itemId, limit: 1 });
  return bindings[0] ?? null;
}

export async function getMarketplaceServiceInspection(
  itemId: string
): Promise<MarketplaceServiceInspection | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceServiceItem(itemId);
    const binding = await getMarketplaceServiceBindingByItemId(item.id);

    return evaluateMarketplaceServiceBinding({
      binding,
      itemKey: item.itemKey,
      itemType: "service",
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      pricingMode: item.pricingMode
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires a service marketplace item")) {
      return null;
    }

    throw error;
  }
}

export async function verifyMarketplaceServiceBinding(itemId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceServiceItem(itemId);
  const binding = await getMarketplaceServiceBindingByItemId(item.id);
  const inspection = evaluateMarketplaceServiceBinding({
    binding,
    itemKey: item.itemKey,
    itemType: "service",
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    pricingMode: item.pricingMode
  });

  if (binding) {
    await recordMarketplaceServiceAudit({
      binding,
      inspection,
      userId: access.user.id
    });
  }

  return inspection;
}

async function upsertServiceBindingForItem(row: Record<string, unknown>) {
  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const status = text(row.status, 40);

  if (!id || !itemKey) return null;

  const serviceKey = serviceKeyFromMarketplaceItemKey(itemKey);

  if (!isValidServiceKey(serviceKey)) return null;

  const catalog = SERVICE_FOUNDATION_CATALOG[serviceKey];
  const serviceName = catalog?.name ?? name;
  const serviceCategory = catalog?.category ?? "general";
  const serviceDescription =
    catalog?.description ?? "Marketplace service foundation binding.";
  const serviceDurationDays = catalog?.durationDays ?? 0;
  const serviceRequirements = sanitizeServiceRequirements(
    catalog?.requirements ?? {
      booking_runtime: false,
      delivery_runtime: false,
      foundation_only: true,
      purchase_runtime: false,
      source: "marketplace_service_runtime"
    }
  );

  validateServiceRequirements(serviceRequirements);

  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("marketplace_service_bindings" as never)
    .select(bindingSelect as never)
    .eq("marketplace_item_id" as never, id as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Marketplace service binding could not be inspected: ${existingError.message}`);
  }

  const bindingStatus = bindingStatusForMarketplaceStatus(status);

  if (existing) {
    const parsed = parseMarketplaceServiceBinding(existing);

    if (!parsed) {
      throw new Error("Existing marketplace service binding is invalid.");
    }

    const { data, error } = await admin
      .from("marketplace_service_bindings" as never)
      .update({
        service_category: serviceCategory,
        service_description: serviceDescription,
        service_duration_days: serviceDurationDays,
        service_name: serviceName,
        service_requirements: serviceRequirements
      } as never)
      .eq("id" as never, parsed.id as never)
      .select(bindingSelect as never)
      .single();

    if (error) {
      throw new Error(`Marketplace service binding could not be updated: ${error.message}`);
    }

    const binding = parseMarketplaceServiceBinding(data);

    if (!binding) {
      throw new Error("Updated marketplace service binding is invalid.");
    }

    await admin
      .from("marketplace_items" as never)
      .update({ linked_service_id: binding.id } as never)
      .eq("id" as never, id as never);

    return binding;
  }

  const { data, error } = await admin
    .from("marketplace_service_bindings" as never)
    .insert({
      marketplace_item_id: id,
      service_binding_status: bindingStatus,
      service_category: serviceCategory,
      service_description: serviceDescription,
      service_duration_days: serviceDurationDays,
      service_key: serviceKey,
      service_name: serviceName,
      service_requirements: serviceRequirements
    } as never)
    .select(bindingSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace service binding could not be created: ${error.message}`);
  }

  const binding = parseMarketplaceServiceBinding(data);

  if (!binding) {
    throw new Error("Created marketplace service binding is invalid.");
  }

  await admin
    .from("marketplace_items" as never)
    .update({ linked_service_id: binding.id } as never)
    .eq("id" as never, id as never);

  return binding;
}

export async function ensureMarketplaceServiceBindings() {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(serviceItemSelect as never)
    .eq("item_type" as never, "service" as never);

  if (error) {
    throw new Error(`Marketplace service items could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    await upsertServiceBindingForItem(row);
  }
}

export async function getMarketplaceServiceBindingStats(): Promise<MarketplaceServiceBindingStats> {
  await ensureMarketplaceServiceBindings();

  const admin = requireAdminClient();
  const [{ data: items, error: itemsError }, bindings] = await Promise.all([
    admin.from("marketplace_items" as never).select("id" as never).eq("item_type" as never, "service" as never),
    listMarketplaceServiceBindings({ limit: 1000 })
  ]);

  if (itemsError) {
    throw new Error(`Marketplace service items could not be counted: ${itemsError.message}`);
  }

  const itemRows = Array.isArray(items) ? items : [];

  return bindings.reduce<MarketplaceServiceBindingStats>(
    (stats, binding) => {
      if (binding.serviceBindingStatus === "active") stats.activeServiceBindings += 1;
      if (binding.serviceBindingStatus === "draft") stats.draftServiceBindings += 1;
      if (binding.serviceBindingStatus === "disabled") stats.disabledServiceBindings += 1;
      if (binding.serviceBindingStatus === "archived") stats.archivedServiceBindings += 1;

      return stats;
    },
    {
      activeServiceBindings: 0,
      archivedServiceBindings: 0,
      disabledServiceBindings: 0,
      draftServiceBindings: 0,
      totalServiceBindings: bindings.length,
      totalServiceItems: itemRows.length,
      verifiedServiceBindings: 0
    }
  );
}
