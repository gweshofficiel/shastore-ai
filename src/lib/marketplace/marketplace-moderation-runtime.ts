import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMarketplaceApprovalAction,
  type MarketplaceApprovalAction
} from "@/src/lib/marketplace/marketplace-approval-runtime";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplacePricingRecord,
  type MarketplacePricingRecord
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
import {
  parseMarketplaceItemStatus,
  type MarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";
import {
  isPublicMarketplaceEligible,
  parseMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";
import {
  parseMarketplaceSubmissionStatus,
  type MarketplaceSubmissionStatus
} from "@/src/lib/marketplace/marketplace-creator-submission-runtime";

export type MarketplaceModerationAction = "approve" | "archive" | "reject" | "request_changes";

export type MarketplaceModerationEventRecord = {
  createdAt: string | null;
  creatorAccountId: string | null;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  moderatedBy: string | null;
  moderationAction: MarketplaceModerationAction;
  moderationNote: string | null;
  moderationReason: string | null;
  newStatus: MarketplaceItemStatus;
  previousStatus: MarketplaceItemStatus;
  updatedAt: string | null;
};

export type MarketplaceModerationInspection = {
  availableActions: MarketplaceModerationAction[];
  creatorAccountId: string | null;
  creatorDisplayName: string | null;
  itemName: string;
  itemType: string;
  marketplaceStatus: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderationAction: MarketplaceModerationAction | null;
  moderationNote: string | null;
  moderationReason: string | null;
  pricingMode: string;
  publicEligible: boolean;
  submissionNote: string | null;
  submissionStatus: MarketplaceSubmissionStatus | null;
  submittedAt: string | null;
  verificationIssues: string[];
  verified: boolean;
  visibility: string;
};

export type MarketplaceModerationResult = {
  creatorAccountId: string | null;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  moderation: MarketplaceModerationEventRecord;
  moderationAction: MarketplaceModerationAction;
  previousStatus: MarketplaceItemStatus;
  publicEligible: boolean;
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
};

export const MARKETPLACE_MODERATION_ACTIONS: readonly MarketplaceModerationAction[] = [
  "approve",
  "reject",
  "request_changes",
  "archive"
] as const;

const actionToStatus: Record<MarketplaceModerationAction, MarketplaceItemStatus> = {
  approve: "approved",
  archive: "archived",
  reject: "rejected",
  request_changes: "draft"
};

const allowedTransitions: Record<MarketplaceItemStatus, MarketplaceModerationAction[]> = {
  approved: ["archive"],
  archived: ["request_changes"],
  draft: [],
  pending_review: ["approve", "reject", "request_changes", "archive"],
  rejected: ["request_changes"]
};

const actionToApprovalAction: Record<MarketplaceModerationAction, MarketplaceApprovalAction> = {
  approve: "approve",
  archive: "archive",
  reject: "reject",
  request_changes: "restore_to_draft"
};

const actionToAuditEvent: Record<MarketplaceModerationAction, string> = {
  approve: "admin_marketplace_moderation_approve",
  archive: "admin_marketplace_moderation_archive",
  reject: "admin_marketplace_moderation_reject",
  request_changes: "admin_marketplace_moderation_request_changes"
};

const moderationSelect =
  "id, marketplace_item_id, creator_account_id, moderated_by, moderation_action, previous_status, new_status, moderation_reason, moderation_note, metadata, created_at, updated_at";

const itemModerationSelect =
  "id, item_key, name, item_type, status, visibility, creator_account_id, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, submitted_by, submitted_at, submission_note, submission_status, submission_updated_at, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, moderated_by, moderated_at, moderation_action, moderation_reason, moderation_note, moderation_updated_at";

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

export function isValidMarketplaceModerationAction(value: unknown): value is MarketplaceModerationAction {
  return MARKETPLACE_MODERATION_ACTIONS.includes(value as MarketplaceModerationAction);
}

export function parseMarketplaceModerationAction(value: unknown): MarketplaceModerationAction | null {
  const cleaned = text(value, 60);
  return isValidMarketplaceModerationAction(cleaned) ? cleaned : null;
}

export function assertValidMarketplaceModerationAction(value: unknown): MarketplaceModerationAction {
  if (!isValidMarketplaceModerationAction(value)) {
    throw new Error("Marketplace moderation action must be approve, reject, request_changes, or archive.");
  }

  return value;
}

export function getMarketplaceModerationTargetStatus(action: MarketplaceModerationAction) {
  return actionToStatus[action];
}

export function getAvailableMarketplaceModerationActions(
  status: MarketplaceItemStatus
): MarketplaceModerationAction[] {
  return allowedTransitions[status] ?? [];
}

export function canApplyMarketplaceModerationAction(
  currentStatus: MarketplaceItemStatus,
  action: MarketplaceModerationAction
) {
  return getAvailableMarketplaceModerationActions(currentStatus).includes(action);
}

export function assertMarketplaceModerationTransition(
  currentStatus: MarketplaceItemStatus,
  action: MarketplaceModerationAction
) {
  if (!canApplyMarketplaceModerationAction(currentStatus, action)) {
    throw new Error(
      `Marketplace moderation action "${action}" is not allowed from status "${currentStatus}".`
    );
  }
}

export function sanitizeModerationMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;
    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;
    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.purchase_runtime = false;

  return clean;
}

export function parseMarketplaceModerationEvent(value: unknown): MarketplaceModerationEventRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const moderationAction = parseMarketplaceModerationAction(row.moderation_action);
  const previousStatus = parseMarketplaceItemStatus(row.previous_status);
  const newStatus = parseMarketplaceItemStatus(row.new_status);

  if (!id || !marketplaceItemId || !moderationAction || !previousStatus || !newStatus) {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    id,
    marketplaceItemId,
    metadata: sanitizeModerationMetadata(safeRecord(row.metadata)),
    moderatedBy: text(row.moderated_by, 120) || null,
    moderationAction,
    moderationNote: text(row.moderation_note, 2000) || null,
    moderationReason: text(row.moderation_reason, 500) || null,
    newStatus,
    previousStatus,
    updatedAt: text(row.updated_at, 80) || null
  };
}

function submissionStatusForModerationAction(
  action: MarketplaceModerationAction
): MarketplaceSubmissionStatus | null {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "request_changes") return "withdrawn";
  return null;
}

export function evaluateMarketplaceModerationInspection(params: {
  creatorDisplayName: string | null;
  item: {
    creatorAccountId: string | null;
    itemType: string;
    moderatedAt: string | null;
    moderatedBy: string | null;
    moderationAction: MarketplaceModerationAction | null;
    moderationNote: string | null;
    moderationReason: string | null;
    name: string;
    pricing: MarketplacePricingRecord;
    status: MarketplaceItemStatus;
    submissionNote: string | null;
    submissionStatus: MarketplaceSubmissionStatus | null;
    submittedAt: string | null;
    visibility: MarketplaceItemVisibility;
  };
}): MarketplaceModerationInspection {
  const verificationIssues: string[] = [];
  const availableActions = getAvailableMarketplaceModerationActions(params.item.status);
  const publicEligible = isPublicMarketplaceEligible({
    status: params.item.status,
    visibility: params.item.visibility
  });

  if (!params.item.creatorAccountId) {
    verificationIssues.push("Marketplace item is missing a creator account link required for moderation.");
  }

  if (params.item.status === "pending_review" && params.item.submissionStatus !== "submitted") {
    verificationIssues.push("Pending review items should have submission_status submitted.");
  }

  return {
    availableActions,
    creatorAccountId: params.item.creatorAccountId,
    creatorDisplayName: params.creatorDisplayName,
    itemName: params.item.name,
    itemType: params.item.itemType,
    marketplaceStatus: params.item.status,
    moderatedAt: params.item.moderatedAt,
    moderatedBy: params.item.moderatedBy,
    moderationAction: params.item.moderationAction,
    moderationNote: params.item.moderationNote,
    moderationReason: params.item.moderationReason,
    pricingMode: params.item.pricing.mode,
    publicEligible,
    submissionNote: params.item.submissionNote,
    submissionStatus: params.item.submissionStatus,
    submittedAt: params.item.submittedAt,
    verificationIssues,
    verified: verificationIssues.length === 0,
    visibility: params.item.visibility
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace moderation runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace moderation runtime.");
  }

  return admin;
}

async function loadMarketplaceModerationItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemModerationSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace moderation item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace moderation item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);
  const visibility = parseMarketplaceItemVisibility(row.visibility);
  const pricing = parseMarketplacePricingRecord(row);

  if (!id || !itemKey || !name || !status || !visibility || !pricing) {
    throw new Error("Marketplace moderation item record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return {
    approvalAction: parseMarketplaceApprovalAction(row.approval_action),
    creatorAccountId: text(row.creator_account_id, 120) || null,
    id,
    itemKey,
    itemType,
    moderatedAt: text(row.moderated_at, 80) || null,
    moderatedBy: text(row.moderated_by, 120) || null,
    moderationAction: parseMarketplaceModerationAction(row.moderation_action),
    moderationNote: text(row.moderation_note, 2000) || null,
    moderationReason: text(row.moderation_reason, 500) || null,
    name,
    pricing,
    status,
    submissionNote: text(row.submission_note, 2000) || null,
    submissionStatus: parseMarketplaceSubmissionStatus(row.submission_status),
    submittedAt: text(row.submitted_at, 80) || null,
    visibility
  };
}

function buildModerationUpdatePayload(params: {
  action: MarketplaceModerationAction;
  moderationNote: string | null;
  moderationReason: string | null;
  now: string;
  userId: string;
}) {
  const nextStatus = getMarketplaceModerationTargetStatus(params.action);
  const approvalAction = actionToApprovalAction[params.action];
  const nextSubmissionStatus = submissionStatusForModerationAction(params.action);

  const payload: Record<string, unknown> = {
    approval_action: approvalAction,
    approval_updated_at: params.now,
    moderated_at: params.now,
    moderated_by: params.userId,
    moderation_action: params.action,
    moderation_note: params.moderationNote,
    moderation_reason: params.moderationReason,
    moderation_updated_at: params.now,
    status: nextStatus
  };

  if (params.moderationNote) {
    payload.approval_note = params.moderationNote;
  }

  if (params.action === "approve") {
    payload.approved_by = params.userId;
    payload.approved_at = params.now;
  }

  if (params.action === "reject") {
    payload.rejected_by = params.userId;
    payload.rejected_at = params.now;
  }

  if (nextSubmissionStatus) {
    payload.submission_status = nextSubmissionStatus;
    payload.submission_updated_at = params.now;
  }

  return payload;
}

async function recordMarketplaceModerationAudit(params: {
  action: MarketplaceModerationAction;
  item: {
    creatorAccountId: string | null;
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
    visibility: MarketplaceItemVisibility;
  };
  moderationEventId: string;
  moderationNote: string | null;
  moderationReason: string | null;
  previousStatus: MarketplaceItemStatus;
  status: MarketplaceItemStatus;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.moderationEventId,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: actionToAuditEvent[params.action],
    metadata: {
      creator_account_id: params.item.creatorAccountId,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      moderation_action: params.action,
      moderation_note: params.moderationNote,
      moderation_reason: params.moderationReason,
      note: "Super Admin marketplace moderation runtime. No purchase, payout, or public catalog exposure.",
      previous_status: params.previousStatus,
      public_eligible: isPublicMarketplaceEligible({
        status: params.status,
        visibility: params.item.visibility
      }),
      source_runtime: "marketplace_moderation_runtime",
      status: params.status,
      visibility: params.item.visibility
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function getLatestMarketplaceModerationEvent(
  itemId: string
): Promise<MarketplaceModerationEventRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(itemId, 120);

  if (!cleanedId) return null;

  const { data, error } = await admin
    .from("marketplace_moderation_events" as never)
    .select(moderationSelect as never)
    .eq("marketplace_item_id" as never, cleanedId as never)
    .order("created_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace moderation event could not be loaded: ${error.message}`);
  }

  return parseMarketplaceModerationEvent(data);
}

export async function applyMarketplaceModerationAction(params: {
  itemId: string;
  moderationAction: MarketplaceModerationAction;
  moderationNote?: string | null;
  moderationReason?: string | null;
}) {
  const access = await requireSuperAdmin();
  const action = assertValidMarketplaceModerationAction(params.moderationAction);
  const item = await loadMarketplaceModerationItem(params.itemId);
  const moderationNote = text(params.moderationNote, 2000) || null;
  const moderationReason = text(params.moderationReason, 500) || null;

  if (!item.creatorAccountId) {
    throw new Error("Marketplace moderation requires a linked creator account.");
  }

  assertMarketplaceModerationTransition(item.status, action);

  const nextStatus = getMarketplaceModerationTargetStatus(action);
  const now = new Date().toISOString();
  const metadata = sanitizeModerationMetadata({
    approval_action: actionToApprovalAction[action],
    foundation_only: true,
    previous_status: item.status,
    source_runtime: "marketplace_moderation_runtime"
  });

  const admin = requireAdminClient();

  const { data: moderationRow, error: moderationError } = await admin
    .from("marketplace_moderation_events" as never)
    .insert({
      creator_account_id: item.creatorAccountId,
      marketplace_item_id: item.id,
      metadata,
      moderated_by: access.user.id,
      moderation_action: action,
      moderation_note: moderationNote,
      moderation_reason: moderationReason,
      new_status: nextStatus,
      previous_status: item.status
    } as never)
    .select(moderationSelect as never)
    .single();

  if (moderationError) {
    throw new Error(`Marketplace moderation event could not be recorded: ${moderationError.message}`);
  }

  const moderation = parseMarketplaceModerationEvent(moderationRow);

  if (!moderation) {
    throw new Error("Recorded marketplace moderation event is invalid.");
  }

  let updateQuery = admin
    .from("marketplace_items" as never)
    .update(
      buildModerationUpdatePayload({
        action,
        moderationNote,
        moderationReason,
        now,
        userId: access.user.id
      }) as never
    )
    .eq("id" as never, item.id as never);

  if (item.status === "pending_review") {
    updateQuery = updateQuery.eq("status" as never, "pending_review" as never);
  } else if (action === "archive" && item.status === "approved") {
    updateQuery = updateQuery.eq("status" as never, "approved" as never);
  } else if (action === "request_changes" && (item.status === "rejected" || item.status === "archived")) {
    updateQuery = updateQuery.eq("status" as never, item.status as never);
  } else {
    updateQuery = updateQuery.eq("status" as never, item.status as never);
  }

  const { error: itemError } = await updateQuery;

  if (itemError) {
    throw new Error(`Marketplace moderation action could not be applied: ${itemError.message}`);
  }

  await recordMarketplaceModerationAudit({
    action,
    item: {
      creatorAccountId: item.creatorAccountId,
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      name: item.name,
      visibility: item.visibility
    },
    moderationEventId: moderation.id,
    moderationNote,
    moderationReason,
    previousStatus: item.status,
    status: nextStatus,
    userId: access.user.id
  });

  return {
    creatorAccountId: item.creatorAccountId,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    moderation,
    moderationAction: action,
    previousStatus: item.status,
    publicEligible: isPublicMarketplaceEligible({
      status: nextStatus,
      visibility: item.visibility
    }),
    status: nextStatus,
    visibility: item.visibility
  } satisfies MarketplaceModerationResult;
}
