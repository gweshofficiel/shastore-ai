import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
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
  getMarketplaceCreatorAccountById,
  type MarketplaceCreatorAccountRecord
} from "@/src/lib/marketplace/marketplace-creator-runtime";
import { getMarketplaceAppBindingByItemId } from "@/src/lib/marketplace/marketplace-app-runtime";
import { getMarketplacePluginBindingByItemId } from "@/src/lib/marketplace/marketplace-plugin-runtime";
import { getMarketplaceServiceBindingByItemId } from "@/src/lib/marketplace/marketplace-service-runtime";

export type MarketplaceSubmissionStatus = "approved" | "draft" | "rejected" | "submitted" | "withdrawn";

export type MarketplaceCreatorSubmissionRecord = {
  createdAt: string | null;
  creatorAccountId: string;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  submissionNote: string | null;
  submissionStatus: MarketplaceSubmissionStatus;
  submittedBy: string | null;
  updatedAt: string | null;
};

export type MarketplaceCreatorSubmissionInspection = {
  creatorAccountId: string | null;
  creatorDisplayName: string | null;
  creatorPublicSlug: string | null;
  marketplaceStatus: string;
  submissionNote: string | null;
  submissionStatus: MarketplaceSubmissionStatus | null;
  submittedAt: string | null;
  submittedBy: string | null;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceCreatorSubmissionResult = {
  creatorAccountId: string;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  previousStatus: MarketplaceItemStatus;
  status: MarketplaceItemStatus;
  submission: MarketplaceCreatorSubmissionRecord;
  submissionNote: string | null;
};

export const MARKETPLACE_SUBMISSION_STATUSES: readonly MarketplaceSubmissionStatus[] = [
  "draft",
  "submitted",
  "withdrawn",
  "rejected",
  "approved"
] as const;

const submissionSelect =
  "id, marketplace_item_id, creator_account_id, submitted_by, submission_status, submission_note, metadata, created_at, updated_at";

const itemSubmissionSelect =
  "id, item_key, name, item_type, section, status, visibility, creator_account_id, linked_template_id, linked_theme_id, linked_plugin_id, linked_app_id, linked_service_id, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, submitted_by, submitted_at, submission_note, submission_status, submission_updated_at";

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

export function isValidMarketplaceSubmissionStatus(value: unknown): value is MarketplaceSubmissionStatus {
  return MARKETPLACE_SUBMISSION_STATUSES.includes(value as MarketplaceSubmissionStatus);
}

export function parseMarketplaceSubmissionStatus(value: unknown): MarketplaceSubmissionStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceSubmissionStatus(cleaned) ? cleaned : null;
}

export function sanitizeSubmissionMetadata(metadata: Record<string, unknown>) {
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

export function validateSubmissionMetadata(metadata: Record<string, unknown>) {
  if (secretKeyPattern.test(JSON.stringify(metadata))) {
    throw new Error("Submission metadata must not contain secrets.");
  }
}

export function parseMarketplaceCreatorSubmission(value: unknown): MarketplaceCreatorSubmissionRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const creatorAccountId = text(row.creator_account_id, 120);
  const submissionStatus = parseMarketplaceSubmissionStatus(row.submission_status);

  if (!id || !marketplaceItemId || !creatorAccountId || !submissionStatus) {
    return null;
  }

  const metadata = sanitizeSubmissionMetadata(safeRecord(row.metadata));

  try {
    validateSubmissionMetadata(metadata);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId,
    id,
    marketplaceItemId,
    metadata,
    submissionNote: text(row.submission_note, 2000) || null,
    submissionStatus,
    submittedBy: text(row.submitted_by, 120) || null,
    updatedAt: text(row.updated_at, 80) || null
  };
}

function validatePricingForSubmission(pricing: MarketplacePricingRecord) {
  const issues: string[] = [];

  if (pricing.mode === "paid" && pricing.priceAmount <= 0) {
    issues.push("Paid marketplace items require a price amount before submission.");
  }

  if (pricing.mode === "subscription") {
    if (pricing.priceAmount <= 0) {
      issues.push("Subscription marketplace items require a price amount before submission.");
    }

    if (!pricing.billingInterval) {
      issues.push("Subscription marketplace items require a billing interval before submission.");
    }
  }

  return issues;
}

function validateCreatorCanSubmit(creator: MarketplaceCreatorAccountRecord | null, creatorAccountId: string | null) {
  const issues: string[] = [];

  if (!creatorAccountId) {
    issues.push("Marketplace item is missing a creator_account_id link.");
    return issues;
  }

  if (!creator) {
    issues.push("Marketplace item references a missing creator account.");
    return issues;
  }

  if (creator.id !== creatorAccountId) {
    issues.push("Creator account does not own this marketplace item.");
  }

  if (creator.creatorStatus === "draft") {
    issues.push("Draft creator accounts cannot submit marketplace items.");
  }

  if (creator.creatorStatus === "suspended") {
    issues.push("Suspended creator accounts cannot submit marketplace items.");
  }

  if (creator.creatorStatus === "archived") {
    issues.push("Archived creator accounts cannot submit marketplace items.");
  }

  if (creator.creatorStatus !== "active") {
    issues.push("Only active creator accounts can submit marketplace items.");
  }

  return issues;
}

async function validateBindingForSubmission(item: {
  id: string;
  itemType: string;
  linkedTemplateId: string | null;
  linkedThemeId: string | null;
}) {
  const issues: string[] = [];

  if (item.itemType === "template" && !item.linkedTemplateId) {
    issues.push("Template marketplace items require a linked template before submission.");
  }

  if (item.itemType === "theme" && !item.linkedThemeId) {
    issues.push("Theme marketplace items require a linked theme before submission.");
  }

  if (item.itemType === "plugin") {
    const binding = await getMarketplacePluginBindingByItemId(item.id);
    if (!binding) {
      issues.push("Plugin marketplace items require a plugin binding before submission.");
    }
  }

  if (item.itemType === "app") {
    const binding = await getMarketplaceAppBindingByItemId(item.id);
    if (!binding) {
      issues.push("App marketplace items require an app binding before submission.");
    }
  }

  if (item.itemType === "service") {
    const binding = await getMarketplaceServiceBindingByItemId(item.id);
    if (!binding) {
      issues.push("Service marketplace items require a service binding before submission.");
    }
  }

  return issues;
}

export async function validateMarketplaceCreatorSubmission(params: {
  creator: MarketplaceCreatorAccountRecord | null;
  item: {
    creatorAccountId: string | null;
    id: string;
    itemType: string;
    linkedTemplateId: string | null;
    linkedThemeId: string | null;
    pricing: MarketplacePricingRecord;
    status: MarketplaceItemStatus;
  };
}) {
  const issues: string[] = [];

  if (params.item.status !== "draft") {
    issues.push("Only draft marketplace items can be submitted for review.");
  }

  if (!isValidMarketplaceItemType(params.item.itemType)) {
    issues.push("Marketplace item type is invalid.");
  }

  issues.push(...validateCreatorCanSubmit(params.creator, params.item.creatorAccountId));
  issues.push(...validatePricingForSubmission(params.item.pricing));
  issues.push(...(await validateBindingForSubmission(params.item)));

  return {
    issues,
    ready: issues.length === 0
  };
}

export function evaluateMarketplaceCreatorSubmissionInspection(params: {
  creator: MarketplaceCreatorAccountRecord | null;
  item: {
    creatorAccountId: string | null;
    status: string;
    submissionNote: string | null;
    submissionStatus: MarketplaceSubmissionStatus | null;
    submittedAt: string | null;
    submittedBy: string | null;
  };
}): MarketplaceCreatorSubmissionInspection {
  const verificationIssues: string[] = [];

  if (!params.item.creatorAccountId) {
    verificationIssues.push("Marketplace item is missing a creator account link.");
  } else if (!params.creator) {
    verificationIssues.push("Marketplace item references a missing creator account.");
  }

  if (params.item.status === "pending_review" && params.item.submissionStatus !== "submitted") {
    verificationIssues.push("Pending review items should have submission_status submitted.");
  }

  if (
    params.item.status !== "approved" &&
    params.item.status !== "pending_review" &&
    params.item.submissionStatus === "submitted"
  ) {
    verificationIssues.push("Submitted status metadata is inconsistent with marketplace item status.");
  }

  return {
    creatorAccountId: params.item.creatorAccountId,
    creatorDisplayName: params.creator?.displayName ?? null,
    creatorPublicSlug: params.creator?.publicSlug ?? null,
    marketplaceStatus: params.item.status,
    submissionNote: params.item.submissionNote,
    submissionStatus: params.item.submissionStatus,
    submittedAt: params.item.submittedAt,
    submittedBy: params.item.submittedBy,
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace creator submission runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace creator submission runtime.");
  }

  return admin;
}

async function loadMarketplaceSubmissionItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemSubmissionSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace submission item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace submission item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const status = parseMarketplaceItemStatus(row.status);
  const pricing = parseMarketplacePricingRecord(row);

  if (!id || !itemKey || !name || !status || !pricing) {
    throw new Error("Marketplace submission item record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return {
    creatorAccountId: text(row.creator_account_id, 120) || null,
    id,
    itemKey,
    itemType,
    linkedTemplateId: text(row.linked_template_id, 120) || null,
    linkedThemeId: text(row.linked_theme_id, 120) || null,
    name,
    pricing,
    status,
    submissionNote: text(row.submission_note, 2000) || null,
    submissionStatus: parseMarketplaceSubmissionStatus(row.submission_status),
    submittedAt: text(row.submitted_at, 80) || null,
    submittedBy: text(row.submitted_by, 120) || null
  };
}

async function recordMarketplaceCreatorSubmissionAudit(params: {
  creatorAccountId: string;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
  };
  previousStatus: MarketplaceItemStatus;
  submission: MarketplaceCreatorSubmissionRecord;
  submissionNote: string | null;
  status: MarketplaceItemStatus;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.submission.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_creator_submit_for_review",
    metadata: {
      creator_account_id: params.creatorAccountId,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      note: "Creator marketplace submission runtime. Draft to pending_review only. No approval, purchase, or payout runtime.",
      previous_status: params.previousStatus,
      source_runtime: "marketplace_creator_submission_runtime",
      status: params.status,
      submission_id: params.submission.id,
      submission_note: params.submissionNote,
      submission_status: params.submission.submissionStatus
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function getLatestMarketplaceCreatorSubmission(
  itemId: string
): Promise<MarketplaceCreatorSubmissionRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(itemId, 120);

  if (!cleanedId) return null;

  const { data, error } = await admin
    .from("marketplace_creator_submissions" as never)
    .select(submissionSelect as never)
    .eq("marketplace_item_id" as never, cleanedId as never)
    .order("created_at" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace creator submission could not be loaded: ${error.message}`);
  }

  return parseMarketplaceCreatorSubmission(data);
}

export async function submitMarketplaceCreatorSubmission(params: {
  itemId: string;
  submissionNote?: string | null;
}) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceSubmissionItem(params.itemId);

  if (item.status !== "draft") {
    throw new Error(
      `Marketplace creator submission is only allowed from draft status. Current status: ${item.status}.`
    );
  }

  const creator = item.creatorAccountId
    ? await getMarketplaceCreatorAccountById(item.creatorAccountId)
    : null;

  const validation = await validateMarketplaceCreatorSubmission({
    creator,
    item: {
      creatorAccountId: item.creatorAccountId,
      id: item.id,
      itemType: item.itemType,
      linkedTemplateId: item.linkedTemplateId,
      linkedThemeId: item.linkedThemeId,
      pricing: item.pricing,
      status: item.status
    }
  });

  if (!validation.ready) {
    throw new Error(validation.issues.join(" "));
  }

  if (!item.creatorAccountId || !creator) {
    throw new Error("Creator account ownership could not be validated.");
  }

  const admin = requireAdminClient();
  const now = new Date().toISOString();
  const submissionNote = text(params.submissionNote, 2000) || null;
  const metadata = sanitizeSubmissionMetadata({
    action: "submit_for_review",
    foundation_only: true,
    previous_status: item.status,
    source_runtime: "marketplace_creator_submission_runtime"
  });

  validateSubmissionMetadata(metadata);

  const { data: submissionRow, error: submissionError } = await admin
    .from("marketplace_creator_submissions" as never)
    .insert({
      creator_account_id: item.creatorAccountId,
      marketplace_item_id: item.id,
      metadata,
      submission_note: submissionNote,
      submission_status: "submitted",
      submitted_by: access.user.id
    } as never)
    .select(submissionSelect as never)
    .single();

  if (submissionError) {
    throw new Error(`Marketplace creator submission could not be recorded: ${submissionError.message}`);
  }

  const submission = parseMarketplaceCreatorSubmission(submissionRow);

  if (!submission) {
    throw new Error("Recorded marketplace creator submission is invalid.");
  }

  const { error: itemError } = await admin
    .from("marketplace_items" as never)
    .update({
      approval_action: "submit_for_review",
      approval_updated_at: now,
      status: "pending_review",
      submission_note: submissionNote,
      submission_status: "submitted",
      submission_updated_at: now,
      submitted_at: now,
      submitted_by: access.user.id
    } as never)
    .eq("id" as never, item.id as never)
    .eq("status" as never, "draft" as never);

  if (itemError) {
    throw new Error(`Marketplace item could not be submitted for review: ${itemError.message}`);
  }

  await recordMarketplaceCreatorSubmissionAudit({
    creatorAccountId: item.creatorAccountId,
    item: {
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      name: item.name
    },
    previousStatus: item.status,
    submission,
    submissionNote,
    status: "pending_review",
    userId: access.user.id
  });

  return {
    creatorAccountId: item.creatorAccountId,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    previousStatus: item.status,
    status: "pending_review" as const,
    submission,
    submissionNote
  } satisfies MarketplaceCreatorSubmissionResult;
}
