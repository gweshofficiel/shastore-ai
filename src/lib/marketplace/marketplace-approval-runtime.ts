import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceItemStatus,
  type MarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";
import {
  isPublicMarketplaceEligible,
  parseMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceApprovalAction =
  | "approve"
  | "archive"
  | "reject"
  | "restore_to_draft"
  | "submit_for_review";

export type MarketplaceApprovalMetadata = {
  approvalAction: MarketplaceApprovalAction | null;
  approvalNote: string | null;
  approvalUpdatedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type MarketplaceApprovalResult = MarketplaceApprovalMetadata & {
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  previousStatus: MarketplaceItemStatus;
  publicEligible: boolean;
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
};

export const MARKETPLACE_APPROVAL_ACTIONS: readonly MarketplaceApprovalAction[] = [
  "submit_for_review",
  "approve",
  "reject",
  "archive",
  "restore_to_draft"
] as const;

const actionToStatus: Record<MarketplaceApprovalAction, MarketplaceItemStatus> = {
  approve: "approved",
  archive: "archived",
  reject: "rejected",
  restore_to_draft: "draft",
  submit_for_review: "pending_review"
};

const allowedTransitions: Record<MarketplaceItemStatus, MarketplaceApprovalAction[]> = {
  approved: ["archive"],
  archived: ["restore_to_draft"],
  draft: ["submit_for_review"],
  pending_review: ["approve", "reject"],
  rejected: ["restore_to_draft"]
};

type MarketplaceApprovalAuditEvent =
  | "admin_marketplace_approve_item"
  | "admin_marketplace_archive_item"
  | "admin_marketplace_mark_review"
  | "admin_marketplace_reject_item"
  | "admin_marketplace_set_draft";

const actionToAuditEvent: Record<MarketplaceApprovalAction, MarketplaceApprovalAuditEvent> = {
  approve: "admin_marketplace_approve_item",
  archive: "admin_marketplace_archive_item",
  reject: "admin_marketplace_reject_item",
  restore_to_draft: "admin_marketplace_set_draft",
  submit_for_review: "admin_marketplace_mark_review"
};

const approvalSelect =
  "id, item_key, name, item_type, status, visibility, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at";

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

function sanitizeApprovalNote(value: unknown) {
  return text(value, 2000) || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function parseApprovalMetadata(row: Record<string, unknown>): MarketplaceApprovalMetadata {
  return {
    approvalAction: parseMarketplaceApprovalAction(row.approval_action),
    approvalNote: text(row.approval_note, 2000) || null,
    approvalUpdatedAt: text(row.approval_updated_at, 80) || null,
    approvedAt: text(row.approved_at, 80) || null,
    approvedBy: text(row.approved_by, 120) || null,
    rejectedAt: text(row.rejected_at, 80) || null,
    rejectedBy: text(row.rejected_by, 120) || null,
    reviewedAt: text(row.reviewed_at, 80) || null,
    reviewedBy: text(row.reviewed_by, 120) || null
  };
}

export function parseMarketplaceApprovalAction(value: unknown): MarketplaceApprovalAction | null {
  const cleaned = text(value, 60);
  return MARKETPLACE_APPROVAL_ACTIONS.includes(cleaned as MarketplaceApprovalAction)
    ? (cleaned as MarketplaceApprovalAction)
    : null;
}

export function isValidMarketplaceApprovalAction(
  value: unknown
): value is MarketplaceApprovalAction {
  return MARKETPLACE_APPROVAL_ACTIONS.includes(value as MarketplaceApprovalAction);
}

export function assertValidMarketplaceApprovalAction(
  value: unknown
): MarketplaceApprovalAction {
  if (!isValidMarketplaceApprovalAction(value)) {
    throw new Error(
      "Marketplace approval action must be submit_for_review, approve, reject, archive, or restore_to_draft."
    );
  }

  return value;
}

export function getMarketplaceApprovalTargetStatus(
  action: MarketplaceApprovalAction
): MarketplaceItemStatus {
  return actionToStatus[action];
}

export function getAvailableMarketplaceApprovalActions(
  status: MarketplaceItemStatus
): MarketplaceApprovalAction[] {
  return allowedTransitions[status] ?? [];
}

export function canApplyMarketplaceApprovalAction(
  currentStatus: MarketplaceItemStatus,
  action: MarketplaceApprovalAction
): boolean {
  return getAvailableMarketplaceApprovalActions(currentStatus).includes(action);
}

export function assertMarketplaceApprovalTransition(
  currentStatus: MarketplaceItemStatus,
  action: MarketplaceApprovalAction
) {
  if (!canApplyMarketplaceApprovalAction(currentStatus, action)) {
    throw new Error(
      `Marketplace approval action "${action}" is not allowed from status "${currentStatus}".`
    );
  }
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage marketplace approvals.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace approval runtime.");
  }

  return admin;
}

async function loadMarketplaceApprovalRow(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(approvalSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace approval record could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace approval record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);
  const visibility = parseMarketplaceItemVisibility(row.visibility);

  if (!id || !itemKey || !name || !status || !visibility) {
    throw new Error("Marketplace approval record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return {
    id,
    itemKey,
    itemType,
    name,
    status,
    visibility,
    ...parseApprovalMetadata(row)
  };
}

function buildApprovalUpdatePayload(params: {
  action: MarketplaceApprovalAction;
  approvalNote?: string | null;
  now: string;
  userId: string;
}) {
  const nextStatus = getMarketplaceApprovalTargetStatus(params.action);
  const payload: Record<string, unknown> = {
    approval_action: params.action,
    approval_updated_at: params.now,
    status: nextStatus
  };

  if (params.approvalNote) {
    payload.approval_note = params.approvalNote;
  }

  if (params.action === "submit_for_review") {
    payload.reviewed_by = params.userId;
    payload.reviewed_at = params.now;
  }

  if (params.action === "approve") {
    payload.approved_by = params.userId;
    payload.approved_at = params.now;
  }

  if (params.action === "reject") {
    payload.rejected_by = params.userId;
    payload.rejected_at = params.now;
  }

  return payload;
}

async function recordMarketplaceApprovalAudit(params: {
  action: MarketplaceApprovalAction;
  approvalNote: string | null;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
    visibility: MarketplaceItemVisibility;
  };
  previousStatus: MarketplaceItemStatus;
  status: MarketplaceItemStatus;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.item.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: actionToAuditEvent[params.action],
    metadata: {
      approval_action: params.action,
      approval_note: params.approvalNote,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      note: "Super Admin marketplace approval runtime. Approval metadata and status only. No payment, install, deletion, or public storefront exposure.",
      previous_status: params.previousStatus,
      public_eligible: isPublicMarketplaceEligible({
        status: params.status,
        visibility: params.item.visibility
      }),
      source: "super_admin_marketplace_approval_runtime",
      status: params.status,
      visibility: params.item.visibility
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function applyMarketplaceApprovalAction(
  itemId: string,
  action: MarketplaceApprovalAction,
  approvalNote?: string | null
): Promise<MarketplaceApprovalResult> {
  const access = await requireSuperAdmin();
  const validatedAction = assertValidMarketplaceApprovalAction(action);
  const item = await loadMarketplaceApprovalRow(itemId);
  const cleanedNote = sanitizeApprovalNote(approvalNote);

  assertMarketplaceApprovalTransition(item.status, validatedAction);

  const nextStatus = getMarketplaceApprovalTargetStatus(validatedAction);

  if (item.status === nextStatus && item.approvalAction === validatedAction) {
    return {
      approvalAction: item.approvalAction,
      approvalNote: cleanedNote ?? item.approvalNote,
      approvalUpdatedAt: item.approvalUpdatedAt,
      approvedAt: item.approvedAt,
      approvedBy: item.approvedBy,
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      itemType: item.itemType,
      previousStatus: item.status,
      publicEligible: isPublicMarketplaceEligible({
        status: item.status,
        visibility: item.visibility
      }),
      rejectedAt: item.rejectedAt,
      rejectedBy: item.rejectedBy,
      reviewedAt: item.reviewedAt,
      reviewedBy: item.reviewedBy,
      status: item.status,
      visibility: item.visibility
    };
  }

  const now = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .update(
      buildApprovalUpdatePayload({
        action: validatedAction,
        approvalNote: cleanedNote,
        now,
        userId: access.user.id
      }) as never
    )
    .eq("id" as never, item.id as never)
    .select(approvalSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace approval action could not be applied: ${error.message}`);
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace approval update returned an invalid record.");
  }

  const status = parseMarketplaceItemStatus(row.status);
  const visibility = parseMarketplaceItemVisibility(row.visibility);

  if (!status || !visibility) {
    throw new Error("Marketplace approval update returned invalid status or visibility.");
  }

  const metadata = parseApprovalMetadata(row);

  await recordMarketplaceApprovalAudit({
    action: validatedAction,
    approvalNote: metadata.approvalNote,
    item: {
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      name: item.name,
      visibility
    },
    previousStatus: item.status,
    status,
    userId: access.user.id
  });

  return {
    ...metadata,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    previousStatus: item.status,
    publicEligible: isPublicMarketplaceEligible({ status, visibility }),
    status,
    visibility
  };
}

export async function submitMarketplaceItemForReview(itemId: string, approvalNote?: string | null) {
  return applyMarketplaceApprovalAction(itemId, "submit_for_review", approvalNote);
}

export async function approveMarketplaceItemApproval(itemId: string, approvalNote?: string | null) {
  return applyMarketplaceApprovalAction(itemId, "approve", approvalNote);
}

export async function rejectMarketplaceItemApproval(itemId: string, approvalNote?: string | null) {
  return applyMarketplaceApprovalAction(itemId, "reject", approvalNote);
}

export async function archiveMarketplaceItemApproval(itemId: string, approvalNote?: string | null) {
  return applyMarketplaceApprovalAction(itemId, "archive", approvalNote);
}

export async function restoreMarketplaceItemToDraft(itemId: string, approvalNote?: string | null) {
  return applyMarketplaceApprovalAction(itemId, "restore_to_draft", approvalNote);
}
