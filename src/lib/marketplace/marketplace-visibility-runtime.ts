import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceItemStatus,
  type MarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";

export type MarketplaceItemVisibility = "internal" | "private" | "public";

export type MarketplaceVisibilityStats = {
  internalItems: number;
  privateItems: number;
  publicItems: number;
  totalItems: number;
};

export const MARKETPLACE_ITEM_VISIBILITIES: readonly MarketplaceItemVisibility[] = [
  "private",
  "internal",
  "public"
] as const;

const legacyVisibilityMap: Record<string, MarketplaceItemVisibility> = {
  internal: "internal",
  marketplace: "public",
  owner: "private",
  private: "private",
  public: "public",
  reseller: "private"
};

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

export function isValidMarketplaceItemVisibility(
  value: unknown
): value is MarketplaceItemVisibility {
  return MARKETPLACE_ITEM_VISIBILITIES.includes(value as MarketplaceItemVisibility);
}

export function normalizeMarketplaceItemVisibility(
  value: unknown
): MarketplaceItemVisibility | null {
  const cleaned = text(value, 40);
  return legacyVisibilityMap[cleaned] ?? null;
}

export function parseMarketplaceItemVisibility(
  value: unknown
): MarketplaceItemVisibility | null {
  return normalizeMarketplaceItemVisibility(value);
}

export function assertValidMarketplaceItemVisibility(
  value: unknown
): MarketplaceItemVisibility {
  const visibility = parseMarketplaceItemVisibility(value);

  if (!visibility) {
    throw new Error("Marketplace item visibility must be private, internal, or public.");
  }

  return visibility;
}

export function countMarketplaceItemsByVisibility<
  T extends { visibility: MarketplaceItemVisibility }
>(items: T[]): MarketplaceVisibilityStats {
  return {
    internalItems: items.filter((item) => item.visibility === "internal").length,
    privateItems: items.filter((item) => item.visibility === "private").length,
    publicItems: items.filter((item) => item.visibility === "public").length,
    totalItems: items.length
  };
}

export function filterMarketplaceItemsByVisibility<
  T extends { visibility: MarketplaceItemVisibility }
>(items: T[], visibility: MarketplaceItemVisibility): T[] {
  return items.filter((item) => item.visibility === visibility);
}

export function isPublicMarketplaceEligible(params: {
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
}): boolean {
  return params.visibility === "public" && params.status === "approved";
}

export function canExposeMarketplaceItemPublicly(params: {
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
}): boolean {
  if (params.visibility !== "public") {
    return false;
  }

  return params.status === "approved";
}

export function filterPublicMarketplaceEligibleItems<
  T extends { status: MarketplaceItemStatus; visibility: MarketplaceItemVisibility }
>(items: T[]): T[] {
  return items.filter((item) => isPublicMarketplaceEligible(item));
}

export type MarketplaceVisibilityUpdateResult = {
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  previousVisibility: MarketplaceItemVisibility;
  visibility: MarketplaceItemVisibility;
};

const visibilitySelect = "id, item_key, name, item_type, status, visibility";

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage marketplace item visibility.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace visibility runtime.");
  }

  return admin;
}

async function loadMarketplaceItemVisibilityRow(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(visibilitySelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item visibility could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace item visibility record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);
  const visibility = parseMarketplaceItemVisibility(row.visibility);

  if (!id || !itemKey || !name || !status || !visibility) {
    throw new Error("Marketplace item visibility record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return { id, itemKey, itemType, name, status, visibility };
}

async function recordMarketplaceVisibilityAudit(params: {
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
    status: MarketplaceItemStatus;
  };
  previousVisibility: MarketplaceItemVisibility;
  userId: string;
  visibility: MarketplaceItemVisibility;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.item.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_set_visibility",
    metadata: {
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      note: "Super Admin marketplace visibility runtime update. Visibility only. No payment, install, deletion, or public storefront exposure.",
      previous_visibility: params.previousVisibility,
      public_eligible: isPublicMarketplaceEligible({
        status: params.item.status,
        visibility: params.visibility
      }),
      source: "super_admin_marketplace_visibility_runtime",
      status: params.item.status,
      visibility: params.visibility
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function getMarketplaceItemVisibility(
  itemId: string
): Promise<MarketplaceItemVisibility | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceItemVisibilityRow(itemId);
    return item.visibility;
  } catch (error) {
    if (error instanceof Error && error.message === "Marketplace item was not found.") {
      return null;
    }

    throw error;
  }
}

export async function setMarketplaceItemVisibility(
  itemId: string,
  visibility: MarketplaceItemVisibility
): Promise<MarketplaceVisibilityUpdateResult> {
  const access = await requireSuperAdmin();
  const nextVisibility = assertValidMarketplaceItemVisibility(visibility);
  const item = await loadMarketplaceItemVisibilityRow(itemId);

  if (item.visibility === nextVisibility) {
    return {
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      itemType: item.itemType,
      previousVisibility: item.visibility,
      visibility: nextVisibility
    };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .update({ visibility: nextVisibility } as never)
    .eq("id" as never, item.id as never)
    .select(visibilitySelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace item visibility could not be updated: ${error.message}`);
  }

  const updatedVisibility = parseMarketplaceItemVisibility(rowRecord(data)?.visibility);

  if (!updatedVisibility) {
    throw new Error("Marketplace item visibility update returned an invalid visibility.");
  }

  await recordMarketplaceVisibilityAudit({
    item,
    previousVisibility: item.visibility,
    userId: access.user.id,
    visibility: updatedVisibility
  });

  return {
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    previousVisibility: item.visibility,
    visibility: updatedVisibility
  };
}
