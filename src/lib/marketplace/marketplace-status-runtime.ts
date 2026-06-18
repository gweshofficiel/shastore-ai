import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";

export type MarketplaceItemStatus =
  | "approved"
  | "archived"
  | "draft"
  | "pending_review"
  | "rejected";

export type MarketplaceStatusStats = {
  approvedItems: number;
  archivedItems: number;
  draftItems: number;
  pendingReviewItems: number;
  rejectedItems: number;
  totalItems: number;
};

export type MarketplaceStatusTransition =
  | "approve"
  | "archive"
  | "draft"
  | "pending_review"
  | "reject";

export const MARKETPLACE_ITEM_STATUSES: readonly MarketplaceItemStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "archived"
] as const;

const transitionToStatus: Record<MarketplaceStatusTransition, MarketplaceItemStatus> = {
  approve: "approved",
  archive: "archived",
  draft: "draft",
  pending_review: "pending_review",
  reject: "rejected"
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

export function isValidMarketplaceItemStatus(value: unknown): value is MarketplaceItemStatus {
  return MARKETPLACE_ITEM_STATUSES.includes(value as MarketplaceItemStatus);
}

export function parseMarketplaceItemStatus(value: unknown): MarketplaceItemStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceItemStatus(cleaned) ? cleaned : null;
}

export function assertValidMarketplaceItemStatus(value: unknown): MarketplaceItemStatus {
  const status = parseMarketplaceItemStatus(value);

  if (!status) {
    throw new Error(
      "Marketplace item status must be draft, pending_review, approved, rejected, or archived."
    );
  }

  return status;
}

export function getMarketplaceStatusForTransition(
  transition: MarketplaceStatusTransition
): MarketplaceItemStatus {
  return transitionToStatus[transition];
}

export function countMarketplaceItemsByStatus<
  T extends { status: MarketplaceItemStatus }
>(items: T[]): MarketplaceStatusStats {
  return {
    approvedItems: items.filter((item) => item.status === "approved").length,
    archivedItems: items.filter((item) => item.status === "archived").length,
    draftItems: items.filter((item) => item.status === "draft").length,
    pendingReviewItems: items.filter((item) => item.status === "pending_review").length,
    rejectedItems: items.filter((item) => item.status === "rejected").length,
    totalItems: items.length
  };
}

export function filterMarketplaceItemsByStatus<
  T extends { status: MarketplaceItemStatus }
>(items: T[], status: MarketplaceItemStatus): T[] {
  return items.filter((item) => item.status === status);
}

export type MarketplaceStatusTransitionResult = {
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  previousStatus: MarketplaceItemStatus;
  status: MarketplaceItemStatus;
  transition: MarketplaceStatusTransition;
};

type MarketplaceStatusAuditEvent =
  | "admin_marketplace_approve_item"
  | "admin_marketplace_archive_item"
  | "admin_marketplace_mark_review"
  | "admin_marketplace_reject_item"
  | "admin_marketplace_set_draft";

const transitionToAuditEvent: Record<MarketplaceStatusTransition, MarketplaceStatusAuditEvent> = {
  approve: "admin_marketplace_approve_item",
  archive: "admin_marketplace_archive_item",
  draft: "admin_marketplace_set_draft",
  pending_review: "admin_marketplace_mark_review",
  reject: "admin_marketplace_reject_item"
};

const statusSelect = "id, item_key, name, item_type, status";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage marketplace item status.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace status runtime.");
  }

  return admin;
}

async function loadMarketplaceItemStatusRow(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(statusSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item status could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace item status record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);

  if (!id || !itemKey || !name || !status) {
    throw new Error("Marketplace item status record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return { id, itemKey, itemType, name, status };
}

async function recordMarketplaceStatusAudit(params: {
  eventType: MarketplaceStatusAuditEvent;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
  };
  previousStatus: MarketplaceItemStatus;
  status: MarketplaceItemStatus;
  transition: MarketplaceStatusTransition;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.item.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: params.eventType,
    metadata: {
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      note: "Super Admin marketplace status runtime transition. Status only. No payment, install, deletion, or public exposure.",
      previous_status: params.previousStatus,
      source: "super_admin_marketplace_status_runtime",
      status: params.status,
      transition: params.transition
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function getMarketplaceItemStatus(
  itemId: string
): Promise<MarketplaceItemStatus | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceItemStatusRow(itemId);
    return item.status;
  } catch (error) {
    if (error instanceof Error && error.message === "Marketplace item was not found.") {
      return null;
    }

    throw error;
  }
}

export async function transitionMarketplaceItemStatus(
  itemId: string,
  transition: MarketplaceStatusTransition
): Promise<MarketplaceStatusTransitionResult> {
  const access = await requireSuperAdmin();
  const nextStatus = getMarketplaceStatusForTransition(transition);
  const item = await loadMarketplaceItemStatusRow(itemId);

  if (item.status === nextStatus) {
    return {
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      itemType: item.itemType,
      previousStatus: item.status,
      status: nextStatus,
      transition
    };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .update({ status: nextStatus } as never)
    .eq("id" as never, item.id as never)
    .select(statusSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace item status could not be updated: ${error.message}`);
  }

  const updatedStatus = parseMarketplaceItemStatus(rowRecord(data)?.status);

  if (!updatedStatus) {
    throw new Error("Marketplace item status update returned an invalid status.");
  }

  await recordMarketplaceStatusAudit({
    eventType: transitionToAuditEvent[transition],
    item,
    previousStatus: item.status,
    status: updatedStatus,
    transition,
    userId: access.user.id
  });

  return {
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    previousStatus: item.status,
    status: updatedStatus,
    transition
  };
}

export async function approveMarketplaceItemStatus(itemId: string) {
  return transitionMarketplaceItemStatus(itemId, "approve");
}

export async function rejectMarketplaceItemStatus(itemId: string) {
  return transitionMarketplaceItemStatus(itemId, "reject");
}

export async function markMarketplaceItemPendingReview(itemId: string) {
  return transitionMarketplaceItemStatus(itemId, "pending_review");
}

export async function archiveMarketplaceItemStatus(itemId: string) {
  return transitionMarketplaceItemStatus(itemId, "archive");
}

export async function setMarketplaceItemDraft(itemId: string) {
  return transitionMarketplaceItemStatus(itemId, "draft");
}
