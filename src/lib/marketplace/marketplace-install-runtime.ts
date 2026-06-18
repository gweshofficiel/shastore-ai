import "server-only";

import { getAccountRoleForUser, isConfiguredSuperAdminEmail } from "@/lib/account-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isValidMarketplaceItemType,
  type MarketplaceItemType
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceItemStatus,
  type MarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";
import {
  isPublicMarketplaceEligible,
  parseMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceInstallStatus =
  | "active"
  | "disabled"
  | "failed"
  | "installed"
  | "uninstalled";

export type MarketplaceInstallEventRecord = {
  accountId: string | null;
  createdAt: string | null;
  id: string;
  installStatus: MarketplaceInstallStatus;
  itemType: MarketplaceItemType;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  source: string;
  storeId: string | null;
  updatedAt: string | null;
};

export type MarketplaceInstallEventInput = {
  accountId?: string | null;
  installStatus?: MarketplaceInstallStatus;
  metadata?: Record<string, unknown>;
  publicInstall?: boolean;
  source?: string;
  storeId?: string | null;
};

export type MarketplaceInstallStats = {
  activeInstallEvents: number;
  disabledInstallEvents: number;
  failedInstallEvents: number;
  installedInstallEvents: number;
  totalInstallEvents: number;
  totalLiveInstalls: number;
  uninstalledInstallEvents: number;
};

export type MarketplaceItemInstallSummary = {
  eventCount: number;
  installCount: number;
  installCountUpdatedAt: string | null;
  installEligible: boolean;
  liveInstalls: number;
  publicInstallEligible: boolean;
  recentEvents: MarketplaceInstallEventRecord[];
};

export const MARKETPLACE_INSTALL_STATUSES: readonly MarketplaceInstallStatus[] = [
  "installed",
  "active",
  "disabled",
  "uninstalled",
  "failed"
] as const;

export const MARKETPLACE_INSTALL_COUNTABLE_TYPES: readonly MarketplaceItemType[] = [
  "template",
  "theme",
  "plugin",
  "app"
] as const;

const installEventSelect =
  "id, marketplace_item_id, account_id, store_id, item_type, install_status, source, metadata, created_at, updated_at";

const itemInstallSelect =
  "id, item_key, name, item_type, status, visibility, install_count, live_installs, install_count_updated_at";

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

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

export function isValidMarketplaceInstallStatus(value: unknown): value is MarketplaceInstallStatus {
  return MARKETPLACE_INSTALL_STATUSES.includes(value as MarketplaceInstallStatus);
}

export function parseMarketplaceInstallStatus(value: unknown): MarketplaceInstallStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceInstallStatus(cleaned) ? cleaned : null;
}

export function isInstallCountableMarketplaceItemType(value: unknown): value is MarketplaceItemType {
  return MARKETPLACE_INSTALL_COUNTABLE_TYPES.includes(value as MarketplaceItemType);
}

export function isLiveMarketplaceInstallStatus(status: MarketplaceInstallStatus) {
  return status === "active";
}

export function isReservedMarketplaceInstallStatus(status: MarketplaceInstallStatus) {
  return status === "installed" || status === "active";
}

export function isPublicInstallEligible(params: {
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
}) {
  return isPublicMarketplaceEligible(params);
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace install runtime.");
  }

  return admin;
}

async function requireSuperAdmin() {
  const supabase = await createClient({ role: "admin" });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Only Super Admin can access marketplace install inspection.");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);
  const isSuperAdmin =
    isConfiguredSuperAdminEmail(user.email) &&
    accountRole?.role === "super_admin" &&
    accountRole.status === "active";

  if (!isSuperAdmin) {
    throw new Error("Only Super Admin can access marketplace install inspection.");
  }

  return { supabase, user };
}

async function resolveInstallActor() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication is required to record marketplace install events.");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);
  const isSuperAdmin =
    isConfiguredSuperAdminEmail(user.email) &&
    accountRole?.role === "super_admin" &&
    accountRole.status === "active";

  return { isSuperAdmin, supabase, user };
}

async function assertStoreOwnership(userId: string, storeId: string) {
  const admin = requireAdminClient();
  const cleanedStoreId = text(storeId, 120);

  if (!cleanedStoreId) {
    throw new Error("Store id is required for marketplace install events.");
  }

  const { data, error } = await admin
    .from("stores" as never)
    .select("id, user_id, owner_user_id" as never)
    .eq("id" as never, cleanedStoreId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Store ownership could not be validated: ${error.message}`);
  }

  if (!data) {
    throw new Error("Store was not found for marketplace install validation.");
  }

  const row = rowRecord(data);
  const ownerId = text(row?.owner_user_id, 120) || text(row?.user_id, 120);

  if (!ownerId || ownerId !== userId) {
    throw new Error("Store ownership validation failed for marketplace install event.");
  }
}

export function parseMarketplaceInstallEvent(value: unknown): MarketplaceInstallEventRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const itemType = text(row.item_type, 40) as MarketplaceItemType;
  const installStatus = parseMarketplaceInstallStatus(row.install_status);

  if (!id || !marketplaceItemId || !installStatus || !isValidMarketplaceItemType(itemType)) {
    return null;
  }

  return {
    accountId: text(row.account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    id,
    installStatus,
    itemType,
    marketplaceItemId,
    metadata: safeRecord(row.metadata),
    source: text(row.source, 120) || "marketplace_install_runtime",
    storeId: text(row.store_id, 120) || null,
    updatedAt: text(row.updated_at, 80) || null
  };
}

async function loadMarketplaceInstallItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemInstallSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace install item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace install item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);
  const visibility = parseMarketplaceItemVisibility(row.visibility);

  if (!id || !itemKey || !name || !status || !visibility || !isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace install item record is invalid.");
  }

  return {
    id,
    installCount: Math.max(0, parseNumber(row.install_count) ?? 0),
    installCountUpdatedAt: text(row.install_count_updated_at, 80) || null,
    itemKey,
    itemType: itemType as MarketplaceItemType,
    liveInstalls: Math.max(0, parseNumber(row.live_installs) ?? 0),
    name,
    status,
    visibility
  };
}

async function findExistingReservedInstall(params: {
  itemId: string;
  storeId: string;
}) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_install_events" as never)
    .select(installEventSelect as never)
    .eq("marketplace_item_id" as never, params.itemId as never)
    .eq("store_id" as never, params.storeId as never)
    .in("install_status" as never, ["installed", "active"] as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace install reservation could not be checked: ${error.message}`);
  }

  return data ? parseMarketplaceInstallEvent(data) : null;
}

async function hasPriorInstallForStore(params: { itemId: string; storeId: string }) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_install_events" as never)
    .select("id, install_status" as never)
    .eq("marketplace_item_id" as never, params.itemId as never)
    .eq("store_id" as never, params.storeId as never)
    .neq("install_status" as never, "failed" as never)
    .limit(1);

  if (error) {
    throw new Error(`Marketplace install history could not be checked: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []).length > 0;
}

async function updateMarketplaceInstallCounters(params: {
  installCountDelta: number;
  itemId: string;
  liveInstallsDelta: number;
}) {
  const item = await loadMarketplaceInstallItem(params.itemId);
  const nextInstallCount = Math.max(0, item.installCount + params.installCountDelta);
  const nextLiveInstalls = Math.max(0, item.liveInstalls + params.liveInstallsDelta);
  const now = new Date().toISOString();
  const admin = requireAdminClient();

  const { error } = await admin
    .from("marketplace_items" as never)
    .update({
      install_count: nextInstallCount,
      install_count_updated_at: now,
      live_installs: nextLiveInstalls
    } as never)
    .eq("id" as never, item.id as never);

  if (error) {
    throw new Error(`Marketplace install counters could not be updated: ${error.message}`);
  }
}

function installCounterDeltasForNewEvent(status: MarketplaceInstallStatus, isFirstInstall: boolean) {
  return {
    installCountDelta: isFirstInstall && status !== "failed" ? 1 : 0,
    liveInstallsDelta: status === "active" ? 1 : 0
  };
}

function installCounterDeltasForTransition(
  previousStatus: MarketplaceInstallStatus,
  nextStatus: MarketplaceInstallStatus
) {
  const wasLive = isLiveMarketplaceInstallStatus(previousStatus);
  const isLive = isLiveMarketplaceInstallStatus(nextStatus);

  return {
    installCountDelta: 0,
    liveInstallsDelta: (isLive ? 1 : 0) - (wasLive ? 1 : 0)
  };
}

async function recordMarketplaceInstallAudit(params: {
  event: MarketplaceInstallEventRecord;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
  };
  note: string;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.event.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_record_install_event",
    metadata: {
      account_id: params.event.accountId,
      install_event_id: params.event.id,
      install_status: params.event.installStatus,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      marketplace_item_id: params.event.marketplaceItemId,
      note: params.note,
      source: params.event.source,
      source_runtime: "marketplace_install_counter_runtime",
      store_id: params.event.storeId
    },
    store_id: params.event.storeId,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceInstallEvents(params: {
  itemId?: string;
  limit?: number;
  installStatus?: MarketplaceInstallStatus | MarketplaceInstallStatus[];
} = {}): Promise<MarketplaceInstallEventRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_install_events" as never).select(installEventSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.installStatus) {
    const statuses = Array.isArray(params.installStatus) ? params.installStatus : [params.installStatus];
    query = query.in("install_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace install events could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceInstallEvent(row))
    .filter((event): event is MarketplaceInstallEventRecord => Boolean(event));
}

export async function getMarketplaceInstallStats(): Promise<MarketplaceInstallStats> {
  const events = await listMarketplaceInstallEvents({ limit: 1000 });

  return events.reduce<MarketplaceInstallStats>(
    (stats, event) => {
      stats.totalInstallEvents += 1;

      if (event.installStatus === "active") {
        stats.activeInstallEvents += 1;
        stats.totalLiveInstalls += 1;
      }
      if (event.installStatus === "installed") stats.installedInstallEvents += 1;
      if (event.installStatus === "disabled") stats.disabledInstallEvents += 1;
      if (event.installStatus === "uninstalled") stats.uninstalledInstallEvents += 1;
      if (event.installStatus === "failed") stats.failedInstallEvents += 1;

      return stats;
    },
    {
      activeInstallEvents: 0,
      disabledInstallEvents: 0,
      failedInstallEvents: 0,
      installedInstallEvents: 0,
      totalInstallEvents: 0,
      totalLiveInstalls: 0,
      uninstalledInstallEvents: 0
    }
  );
}

export async function getMarketplaceItemInstallSummary(
  itemId: string
): Promise<MarketplaceItemInstallSummary> {
  await requireSuperAdmin();

  const item = await loadMarketplaceInstallItem(itemId);
  const events = await listMarketplaceInstallEvents({ itemId: item.id, limit: 20 });

  return {
    eventCount: events.length,
    installCount: item.installCount,
    installCountUpdatedAt: item.installCountUpdatedAt,
    installEligible: isInstallCountableMarketplaceItemType(item.itemType),
    liveInstalls: item.liveInstalls,
    publicInstallEligible: isPublicInstallEligible({
      status: item.status,
      visibility: item.visibility
    }),
    recentEvents: events.slice(0, 5)
  };
}

export async function recordMarketplaceInstallEvent(
  itemId: string,
  input: MarketplaceInstallEventInput = {}
): Promise<MarketplaceInstallEventRecord> {
  const actor = await resolveInstallActor();
  const item = await loadMarketplaceInstallItem(itemId);
  const installStatus = input.installStatus
    ? parseMarketplaceInstallStatus(input.installStatus)
    : "installed";

  if (!installStatus) {
    throw new Error("Marketplace install status is invalid.");
  }

  if (!isInstallCountableMarketplaceItemType(item.itemType)) {
    throw new Error("Marketplace service items are excluded from install counting.");
  }

  const storeId = text(input.storeId, 120) || null;
  const accountId = text(input.accountId, 120) || actor.user.id;
  const publicInstall = Boolean(input.publicInstall);

  if (publicInstall && !isPublicInstallEligible({ status: item.status, visibility: item.visibility })) {
    throw new Error("Only approved public marketplace items are eligible for public install counting.");
  }

  if (!actor.isSuperAdmin) {
    if (!storeId) {
      throw new Error("Store id is required for authorized marketplace install events.");
    }

    await assertStoreOwnership(actor.user.id, storeId);

    if (accountId !== actor.user.id) {
      throw new Error("Marketplace install account ownership validation failed.");
    }
  }

  if (isReservedMarketplaceInstallStatus(installStatus)) {
    if (!storeId) {
      throw new Error("Store id is required for installed or active marketplace install events.");
    }

    const reserved = await findExistingReservedInstall({ itemId: item.id, storeId });

    if (reserved) {
      throw new Error("Duplicate active marketplace install is not allowed for the same store.");
    }
  }

  const isFirstInstall = storeId
    ? !(await hasPriorInstallForStore({ itemId: item.id, storeId }))
    : true;
  const counterDeltas = installCounterDeltasForNewEvent(installStatus, isFirstInstall);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_install_events" as never)
    .insert({
      account_id: accountId,
      install_status: installStatus,
      item_type: item.itemType,
      marketplace_item_id: item.id,
      metadata: {
        foundation_only: true,
        item_key: item.itemKey,
        public_install: publicInstall,
        source_runtime: "marketplace_install_counter_runtime",
        ...safeRecord(input.metadata)
      },
      source: text(input.source, 120) || "marketplace_install_runtime",
      store_id: storeId
    } as never)
    .select(installEventSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace install event could not be recorded: ${error.message}`);
  }

  const event = parseMarketplaceInstallEvent(data);

  if (!event) {
    throw new Error("Marketplace install event returned an invalid record.");
  }

  if (counterDeltas.installCountDelta !== 0 || counterDeltas.liveInstallsDelta !== 0) {
    await updateMarketplaceInstallCounters({
      installCountDelta: counterDeltas.installCountDelta,
      itemId: item.id,
      liveInstallsDelta: counterDeltas.liveInstallsDelta
    });
  }

  await recordMarketplaceInstallAudit({
    event,
    item,
    note: "Marketplace install counter runtime foundation event. Install counting only. No purchase, activation, or payout runtime.",
    userId: actor.user.id
  });

  return event;
}

export async function transitionMarketplaceInstallStatus(
  installEventId: string,
  nextStatusInput: MarketplaceInstallStatus
): Promise<MarketplaceInstallEventRecord> {
  const actor = await resolveInstallActor();
  const nextStatus = parseMarketplaceInstallStatus(nextStatusInput);

  if (!nextStatus) {
    throw new Error("Marketplace install status is invalid.");
  }

  const admin = requireAdminClient();
  const cleanedId = text(installEventId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace install event id is required.");
  }

  const { data: existingData, error: existingError } = await admin
    .from("marketplace_install_events" as never)
    .select(installEventSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Marketplace install event could not be loaded: ${existingError.message}`);
  }

  const existing = parseMarketplaceInstallEvent(existingData);

  if (!existing) {
    throw new Error("Marketplace install event was not found.");
  }

  if (!actor.isSuperAdmin) {
    if (!existing.storeId) {
      throw new Error("Store id is required to transition marketplace install events.");
    }

    await assertStoreOwnership(actor.user.id, existing.storeId);
  }

  if (existing.installStatus === nextStatus) {
    return existing;
  }

  if (
    isReservedMarketplaceInstallStatus(nextStatus) &&
    existing.storeId &&
    existing.installStatus !== nextStatus
  ) {
    const reserved = await findExistingReservedInstall({
      itemId: existing.marketplaceItemId,
      storeId: existing.storeId
    });

    if (reserved && reserved.id !== existing.id) {
      throw new Error("Duplicate active marketplace install is not allowed for the same store.");
    }
  }

  const counterDeltas = installCounterDeltasForTransition(existing.installStatus, nextStatus);
  const { data, error } = await admin
    .from("marketplace_install_events" as never)
    .update({
      install_status: nextStatus,
      metadata: {
        ...existing.metadata,
        previous_install_status: existing.installStatus,
        transitioned_at: new Date().toISOString()
      }
    } as never)
    .eq("id" as never, existing.id as never)
    .select(installEventSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace install status could not be updated: ${error.message}`);
  }

  const event = parseMarketplaceInstallEvent(data);

  if (!event) {
    throw new Error("Marketplace install status update returned an invalid record.");
  }

  if (counterDeltas.installCountDelta !== 0 || counterDeltas.liveInstallsDelta !== 0) {
    await updateMarketplaceInstallCounters({
      installCountDelta: counterDeltas.installCountDelta,
      itemId: existing.marketplaceItemId,
      liveInstallsDelta: counterDeltas.liveInstallsDelta
    });
  }

  await recordMarketplaceInstallAudit({
    event,
    item: await loadMarketplaceInstallItem(existing.marketplaceItemId),
    note: "Marketplace install status transition. Install counting only. No purchase, activation, or payout runtime.",
    userId: actor.user.id
  });

  return event;
}
