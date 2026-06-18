import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMarketplaceCreatorAccount,
  type MarketplaceCreatorAccountRecord
} from "@/src/lib/marketplace/marketplace-creator-runtime";
import {
  parseMarketplaceCurrency,
  type MarketplaceCurrency
} from "@/src/lib/marketplace/marketplace-pricing-runtime";

export type MarketplacePayoutStatus =
  | "approved"
  | "cancelled"
  | "draft"
  | "failed"
  | "paid"
  | "pending_review"
  | "processing"
  | "rejected";

export type MarketplacePayoutMethod = "external_provider_placeholder" | "manual";

export type MarketplacePayoutRecipientType = "creator" | "reseller";

export type MarketplacePayoutRequestRecord = {
  createdAt: string | null;
  creatorAccountId: string | null;
  currency: MarketplaceCurrency;
  id: string;
  metadata: Record<string, unknown>;
  payoutAmount: number;
  payoutMethod: MarketplacePayoutMethod;
  payoutStatus: MarketplacePayoutStatus;
  requestedAt: string | null;
  requestedBy: string | null;
  resellerAccountId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  updatedAt: string | null;
};

export type MarketplacePayoutBalanceSummary = {
  availableAmount: number;
  currency: MarketplaceCurrency;
  lockedShareAmount: number;
  recipientAccountId: string;
  recipientType: MarketplacePayoutRecipientType;
  reservedPayoutAmount: number;
};

export type MarketplacePayoutRequestEligibility = {
  availableAmount: number;
  currency: MarketplaceCurrency;
  eligible: boolean;
  lockedShareAmount: number;
  payoutAmount: number;
  payoutMethod: MarketplacePayoutMethod;
  payoutStatus: MarketplacePayoutStatus;
  recipientAccount: MarketplaceCreatorAccountRecord | null;
  recipientAccountId: string;
  recipientDisplayName: string | null;
  recipientType: MarketplacePayoutRecipientType;
  reservedPayoutAmount: number;
  verificationIssues: string[];
};

export type MarketplacePayoutRequestStats = {
  approvedRequests: number;
  cancelledRequests: number;
  draftRequests: number;
  failedRequests: number;
  paidRequests: number;
  pendingReviewRequests: number;
  processingRequests: number;
  rejectedRequests: number;
  totalPayoutAmountApproved: number;
  totalPayoutAmountPaid: number;
  totalRequests: number;
};

export type CreateMarketplacePayoutRequestInput = {
  creatorAccountId?: string | null;
  currency: MarketplaceCurrency;
  metadata?: Record<string, unknown>;
  payoutAmount: number;
  payoutMethod?: MarketplacePayoutMethod;
  payoutStatus?: Extract<MarketplacePayoutStatus, "draft" | "pending_review">;
  resellerAccountId?: string | null;
};

export const MARKETPLACE_PAYOUT_STATUSES: readonly MarketplacePayoutStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "processing",
  "paid",
  "cancelled",
  "failed"
] as const;

export const MARKETPLACE_PAYOUT_ACTIVE_STATUSES: readonly MarketplacePayoutStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "processing"
] as const;

export const MARKETPLACE_PAYOUT_METHODS: readonly MarketplacePayoutMethod[] = [
  "manual",
  "external_provider_placeholder"
] as const;

const creatorSelect =
  "id, account_id, user_id, display_name, public_slug, creator_type, creator_status, verification_status, bio, website_url, support_email, metadata, created_at, updated_at";

const payoutRequestSelect =
  "id, creator_account_id, reseller_account_id, payout_status, payout_amount, currency, payout_method, requested_by, reviewed_by, requested_at, reviewed_at, metadata, created_at, updated_at";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|account_number|routing|swift|card_number|cvv|cvc|private[_-]?key|stripe.*secret)/i;

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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

export function isValidMarketplacePayoutStatus(value: unknown): value is MarketplacePayoutStatus {
  return MARKETPLACE_PAYOUT_STATUSES.includes(value as MarketplacePayoutStatus);
}

export function isValidMarketplacePayoutMethod(value: unknown): value is MarketplacePayoutMethod {
  return MARKETPLACE_PAYOUT_METHODS.includes(value as MarketplacePayoutMethod);
}

export function parseMarketplacePayoutStatus(value: unknown): MarketplacePayoutStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplacePayoutStatus(cleaned) ? cleaned : null;
}

export function parseMarketplacePayoutMethod(value: unknown): MarketplacePayoutMethod | null {
  const cleaned = text(value, 80);
  return isValidMarketplacePayoutMethod(cleaned) ? cleaned : null;
}

export function resolveMarketplacePayoutRecipientType(params: {
  creatorAccountId: string | null;
  resellerAccountId: string | null;
}): MarketplacePayoutRecipientType | null {
  if (params.creatorAccountId && !params.resellerAccountId) {
    return "creator";
  }

  if (params.resellerAccountId && !params.creatorAccountId) {
    return "reseller";
  }

  return null;
}

export function sanitizePayoutMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.payout_execution = false;
  clean.provider_api_runtime = false;
  clean.withdrawal_runtime = false;

  return clean;
}

export function validatePayoutMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "Payout metadata must not contain secrets, bank details, payout credentials, or private keys."
    );
  }
}

export function parseMarketplacePayoutRequest(value: unknown): MarketplacePayoutRequestRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const payoutStatus = parseMarketplacePayoutStatus(row.payout_status);
  const payoutMethod = parseMarketplacePayoutMethod(row.payout_method);
  const currency = parseMarketplaceCurrency(row.currency);
  const payoutAmount = roundMoney(Math.max(0, parseNumber(row.payout_amount) ?? 0));
  const creatorAccountId = text(row.creator_account_id, 120) || null;
  const resellerAccountId = text(row.reseller_account_id, 120) || null;
  const recipientType = resolveMarketplacePayoutRecipientType({
    creatorAccountId,
    resellerAccountId
  });

  if (!id || !payoutStatus || !payoutMethod || !currency || !recipientType) {
    return null;
  }

  const metadata = sanitizePayoutMetadata(safeRecord(row.metadata));

  try {
    validatePayoutMetadata(metadata);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId,
    currency,
    id,
    metadata,
    payoutAmount,
    payoutMethod,
    payoutStatus,
    requestedAt: text(row.requested_at, 80) || null,
    requestedBy: text(row.requested_by, 120) || null,
    resellerAccountId,
    reviewedAt: text(row.reviewed_at, 80) || null,
    reviewedBy: text(row.reviewed_by, 120) || null,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function evaluateMarketplacePayoutRequestEligibility(params: {
  availableAmount: number;
  existingActiveRequest: MarketplacePayoutRequestRecord | null;
  lockedShareAmount: number;
  payoutAmount: number;
  payoutMethod: MarketplacePayoutMethod;
  payoutStatus: MarketplacePayoutStatus;
  recipientAccount: MarketplaceCreatorAccountRecord | null;
  recipientAccountId: string;
  recipientType: MarketplacePayoutRecipientType;
  reservedPayoutAmount: number;
  currency: MarketplaceCurrency;
}): MarketplacePayoutRequestEligibility {
  const verificationIssues: string[] = [];
  const payoutAmount = roundMoney(Math.max(0, params.payoutAmount));

  if (!params.recipientAccount) {
    verificationIssues.push("Payout recipient account was not found.");
  } else {
    if (params.recipientAccount.creatorStatus === "archived") {
      verificationIssues.push("Archived accounts cannot receive marketplace payout requests.");
    }

    if (params.recipientAccount.creatorStatus === "suspended" && params.payoutStatus !== "draft") {
      verificationIssues.push("Suspended accounts cannot submit active marketplace payout requests.");
    }
  }

  if (!isValidMarketplacePayoutMethod(params.payoutMethod)) {
    verificationIssues.push("Payout method is invalid.");
  }

  if (params.payoutMethod === "external_provider_placeholder" && params.payoutStatus === "processing") {
    verificationIssues.push("External provider placeholder cannot execute payout processing.");
  }

  if (!isValidMarketplacePayoutStatus(params.payoutStatus)) {
    verificationIssues.push("Payout status is invalid.");
  }

  if (params.payoutStatus !== "draft" && params.payoutStatus !== "pending_review") {
    verificationIssues.push("Payout requests can only be created as draft or pending_review.");
  }

  if (payoutAmount < 0) {
    verificationIssues.push("Payout amount cannot be negative.");
  }

  if (params.payoutStatus === "pending_review" && payoutAmount <= 0) {
    verificationIssues.push("Pending review payout requests require payout_amount greater than 0.");
  }

  if (payoutAmount > params.availableAmount) {
    verificationIssues.push("Payout amount exceeds available locked revenue share balance.");
  }

  if (params.existingActiveRequest) {
    verificationIssues.push("An active payout request already exists for this recipient and currency.");
  }

  return {
    availableAmount: params.availableAmount,
    currency: params.currency,
    eligible: verificationIssues.length === 0,
    lockedShareAmount: params.lockedShareAmount,
    payoutAmount,
    payoutMethod: params.payoutMethod,
    payoutStatus: params.payoutStatus,
    recipientAccount: params.recipientAccount,
    recipientAccountId: params.recipientAccountId,
    recipientDisplayName: params.recipientAccount?.displayName ?? null,
    recipientType: params.recipientType,
    reservedPayoutAmount: params.reservedPayoutAmount,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace payouts runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace payouts runtime.");
  }

  return admin;
}

async function loadCreatorAccountById(accountId: string) {
  const admin = requireAdminClient();
  const cleanedId = text(accountId, 120);

  if (!cleanedId) {
    return null;
  }

  const { data, error } = await admin
    .from("marketplace_creator_accounts" as never)
    .select(creatorSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace creator account could not be loaded: ${error.message}`);
  }

  return parseMarketplaceCreatorAccount(data);
}

async function sumLockedRevenueShares(params: {
  currency: MarketplaceCurrency;
  recipientAccountId: string;
  recipientType: MarketplacePayoutRecipientType;
}) {
  const admin = requireAdminClient();
  const column =
    params.recipientType === "creator" ? "creator_account_id" : "reseller_account_id";
  const amountColumn =
    params.recipientType === "creator" ? "creator_share_amount" : "reseller_share_amount";

  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .select(`${amountColumn}, currency, share_status` as never)
    .eq(column as never, text(params.recipientAccountId, 120) as never)
    .eq("share_status" as never, "locked" as never)
    .eq("currency" as never, params.currency as never);

  if (error) {
    throw new Error(`Locked marketplace revenue shares could not be loaded: ${error.message}`);
  }

  return roundMoney(
    (Array.isArray(data) ? (data as unknown[]) : []).reduce<number>((sum, row) => {
      const record = rowRecord(row);
      const amount =
        params.recipientType === "creator"
          ? parseNumber(record?.creator_share_amount)
          : parseNumber(record?.reseller_share_amount);

      return sum + Math.max(0, amount ?? 0);
    }, 0)
  );
}

async function sumReservedPayoutAmount(params: {
  currency: MarketplaceCurrency;
  recipientAccountId: string;
  recipientType: MarketplacePayoutRecipientType;
}) {
  const admin = requireAdminClient();
  const column =
    params.recipientType === "creator" ? "creator_account_id" : "reseller_account_id";

  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .select("payout_amount, currency, payout_status" as never)
    .eq(column as never, text(params.recipientAccountId, 120) as never)
    .eq("currency" as never, params.currency as never)
    .in("payout_status" as never, [...MARKETPLACE_PAYOUT_ACTIVE_STATUSES] as never);

  if (error) {
    throw new Error(`Active marketplace payout requests could not be loaded: ${error.message}`);
  }

  return roundMoney(
    (Array.isArray(data) ? (data as unknown[]) : []).reduce<number>((sum, row) => {
      const record = rowRecord(row);
      return sum + Math.max(0, parseNumber(record?.payout_amount) ?? 0);
    }, 0)
  );
}

export async function getMarketplacePayoutBalanceSummary(params: {
  creatorAccountId?: string | null;
  currency: MarketplaceCurrency;
  resellerAccountId?: string | null;
}): Promise<MarketplacePayoutBalanceSummary | null> {
  await requireSuperAdmin();

  const recipientType = resolveMarketplacePayoutRecipientType({
    creatorAccountId: params.creatorAccountId ?? null,
    resellerAccountId: params.resellerAccountId ?? null
  });

  if (!recipientType) {
    return null;
  }

  const recipientAccountId = text(
    recipientType === "creator" ? params.creatorAccountId : params.resellerAccountId,
    120
  );

  if (!recipientAccountId) {
    return null;
  }

  const lockedShareAmount = await sumLockedRevenueShares({
    currency: params.currency,
    recipientAccountId,
    recipientType
  });
  const reservedPayoutAmount = await sumReservedPayoutAmount({
    currency: params.currency,
    recipientAccountId,
    recipientType
  });

  return {
    availableAmount: roundMoney(Math.max(0, lockedShareAmount - reservedPayoutAmount)),
    currency: params.currency,
    lockedShareAmount,
    recipientAccountId,
    recipientType,
    reservedPayoutAmount
  };
}

async function getActivePayoutRequestForRecipient(params: {
  currency: MarketplaceCurrency;
  recipientAccountId: string;
  recipientType: MarketplacePayoutRecipientType;
}) {
  const admin = requireAdminClient();
  const column =
    params.recipientType === "creator" ? "creator_account_id" : "reseller_account_id";

  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .select(payoutRequestSelect as never)
    .eq(column as never, text(params.recipientAccountId, 120) as never)
    .eq("currency" as never, params.currency as never)
    .in("payout_status" as never, [...MARKETPLACE_PAYOUT_ACTIVE_STATUSES] as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Active marketplace payout request lookup failed: ${error.message}`);
  }

  return data ? parseMarketplacePayoutRequest(data) : null;
}

async function recordPayoutAudit(params: {
  eligibility: MarketplacePayoutRequestEligibility;
  note: string;
  payout: MarketplacePayoutRequestRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.payout.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_payout_request_foundation",
    metadata: {
      available_amount: params.eligibility.availableAmount,
      currency: params.payout.currency,
      locked_share_amount: params.eligibility.lockedShareAmount,
      note: params.note,
      payout_amount: params.payout.payoutAmount,
      payout_method: params.payout.payoutMethod,
      payout_status: params.payout.payoutStatus,
      recipient_account_id: params.eligibility.recipientAccountId,
      recipient_display_name: params.eligibility.recipientDisplayName,
      recipient_type: params.eligibility.recipientType,
      reserved_payout_amount: params.eligibility.reservedPayoutAmount,
      source_runtime: "marketplace_payouts_runtime",
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplacePayoutRequests(params: {
  creatorAccountId?: string;
  currency?: MarketplaceCurrency;
  limit?: number;
  payoutStatus?: MarketplacePayoutStatus | MarketplacePayoutStatus[];
  resellerAccountId?: string;
} = {}): Promise<MarketplacePayoutRequestRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_payout_requests" as never).select(payoutRequestSelect as never);

  if (params.creatorAccountId) {
    query = query.eq("creator_account_id" as never, text(params.creatorAccountId, 120) as never);
  }

  if (params.resellerAccountId) {
    query = query.eq("reseller_account_id" as never, text(params.resellerAccountId, 120) as never);
  }

  if (params.currency) {
    query = query.eq("currency" as never, params.currency as never);
  }

  if (params.payoutStatus) {
    const statuses = Array.isArray(params.payoutStatus) ? params.payoutStatus : [params.payoutStatus];
    query = query.in("payout_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace payout requests could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplacePayoutRequest(row))
    .filter((request): request is MarketplacePayoutRequestRecord => Boolean(request));
}

export async function getMarketplacePayoutRequestById(
  payoutRequestId: string
): Promise<MarketplacePayoutRequestRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .select(payoutRequestSelect as never)
    .eq("id" as never, text(payoutRequestId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace payout request could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplacePayoutRequest(data) : null;
}

export async function getMarketplacePayoutRequestStats(): Promise<MarketplacePayoutRequestStats> {
  const requests = await listMarketplacePayoutRequests({ limit: 2000 });

  return requests.reduce<MarketplacePayoutRequestStats>(
    (stats, request) => {
      stats.totalRequests += 1;

      if (request.payoutStatus === "draft") stats.draftRequests += 1;
      if (request.payoutStatus === "pending_review") stats.pendingReviewRequests += 1;
      if (request.payoutStatus === "approved") {
        stats.approvedRequests += 1;
        stats.totalPayoutAmountApproved = roundMoney(
          stats.totalPayoutAmountApproved + request.payoutAmount
        );
      }
      if (request.payoutStatus === "processing") stats.processingRequests += 1;
      if (request.payoutStatus === "paid") {
        stats.paidRequests += 1;
        stats.totalPayoutAmountPaid = roundMoney(stats.totalPayoutAmountPaid + request.payoutAmount);
      }
      if (request.payoutStatus === "rejected") stats.rejectedRequests += 1;
      if (request.payoutStatus === "cancelled") stats.cancelledRequests += 1;
      if (request.payoutStatus === "failed") stats.failedRequests += 1;

      return stats;
    },
    {
      approvedRequests: 0,
      cancelledRequests: 0,
      draftRequests: 0,
      failedRequests: 0,
      paidRequests: 0,
      pendingReviewRequests: 0,
      processingRequests: 0,
      rejectedRequests: 0,
      totalPayoutAmountApproved: 0,
      totalPayoutAmountPaid: 0,
      totalRequests: 0
    }
  );
}

export async function inspectMarketplacePayoutRequestEligibility(
  input: CreateMarketplacePayoutRequestInput
) {
  await requireSuperAdmin();

  const recipientType = resolveMarketplacePayoutRecipientType({
    creatorAccountId: input.creatorAccountId ?? null,
    resellerAccountId: input.resellerAccountId ?? null
  });

  if (!recipientType) {
    throw new Error("Payout request must specify creator_account_id or reseller_account_id exclusively.");
  }

  const recipientAccountId = text(
    recipientType === "creator" ? input.creatorAccountId : input.resellerAccountId,
    120
  );

  if (!recipientAccountId) {
    throw new Error("Payout recipient account id is required.");
  }

  const currency = parseMarketplaceCurrency(input.currency);

  if (!currency) {
    throw new Error("Payout currency is invalid.");
  }

  const payoutMethod = parseMarketplacePayoutMethod(input.payoutMethod ?? "manual") ?? "manual";
  const payoutStatus = parseMarketplacePayoutStatus(input.payoutStatus ?? "draft") ?? "draft";

  if (payoutStatus !== "draft" && payoutStatus !== "pending_review") {
    throw new Error("Payout requests can only be created as draft or pending_review.");
  }

  const recipientAccount = await loadCreatorAccountById(recipientAccountId);
  const balance = await getMarketplacePayoutBalanceSummary({
    creatorAccountId: recipientType === "creator" ? recipientAccountId : null,
    currency,
    resellerAccountId: recipientType === "reseller" ? recipientAccountId : null
  });

  if (!balance) {
    throw new Error("Marketplace payout balance could not be calculated.");
  }

  const existingActiveRequest = await getActivePayoutRequestForRecipient({
    currency,
    recipientAccountId,
    recipientType
  });

  return evaluateMarketplacePayoutRequestEligibility({
    availableAmount: balance.availableAmount,
    existingActiveRequest,
    lockedShareAmount: balance.lockedShareAmount,
    payoutAmount: input.payoutAmount,
    payoutMethod,
    payoutStatus,
    recipientAccount,
    recipientAccountId,
    recipientType,
    reservedPayoutAmount: balance.reservedPayoutAmount,
    currency
  });
}

export async function createMarketplacePayoutRequestFoundation(
  input: CreateMarketplacePayoutRequestInput
) {
  const access = await requireSuperAdmin();
  const eligibility = await inspectMarketplacePayoutRequestEligibility(input);

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Marketplace payout request eligibility failed.");
  }

  const now = new Date().toISOString();
  const metadata = sanitizePayoutMetadata({
    available_amount: eligibility.availableAmount,
    foundation_only: true,
    locked_share_amount: eligibility.lockedShareAmount,
    payout_execution: false,
    provider_api_runtime: false,
    recipient_display_name: eligibility.recipientDisplayName,
    recipient_type: eligibility.recipientType,
    source_runtime: "marketplace_payouts_runtime",
    withdrawal_runtime: false,
    ...safeRecord(input.metadata)
  });

  validatePayoutMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .insert({
      creator_account_id: eligibility.recipientType === "creator" ? eligibility.recipientAccountId : null,
      currency: eligibility.currency,
      metadata,
      payout_amount: eligibility.payoutAmount,
      payout_method: eligibility.payoutMethod,
      payout_status: eligibility.payoutStatus,
      requested_at: eligibility.payoutStatus === "pending_review" ? now : null,
      requested_by: access.user.id,
      reseller_account_id: eligibility.recipientType === "reseller" ? eligibility.recipientAccountId : null,
      reviewed_at: null,
      reviewed_by: null
    } as never)
    .select(payoutRequestSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace payout request could not be created: ${error.message}`);
  }

  const payout = parseMarketplacePayoutRequest(data);

  if (!payout) {
    throw new Error("Created marketplace payout request record is invalid.");
  }

  await recordPayoutAudit({
    eligibility,
    note: "Super Admin marketplace payout request foundation. No real payout execution or provider APIs.",
    payout,
    userId: access.user.id
  });

  return payout;
}

async function transitionMarketplacePayoutStatus(params: {
  allowedFrom: MarketplacePayoutStatus[];
  eventType: string;
  nextStatus: MarketplacePayoutStatus;
  note: string;
  payoutRequestId: string;
  setReviewed?: boolean;
}) {
  const access = await requireSuperAdmin();
  const payout = await getMarketplacePayoutRequestById(params.payoutRequestId);

  if (!payout) {
    throw new Error("Marketplace payout request was not found.");
  }

  if (payout.payoutStatus === params.nextStatus) {
    return payout;
  }

  if (!params.allowedFrom.includes(payout.payoutStatus)) {
    throw new Error(`Marketplace payout request cannot transition from ${payout.payoutStatus}.`);
  }

  const now = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .update({
      payout_status: params.nextStatus,
      reviewed_at: params.setReviewed ? now : payout.reviewedAt,
      reviewed_by: params.setReviewed ? access.user.id : payout.reviewedBy
    } as never)
    .eq("id" as never, payout.id as never)
    .select(payoutRequestSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace payout request status could not be updated: ${error.message}`);
  }

  const updated = parseMarketplacePayoutRequest(data);

  if (!updated) {
    throw new Error("Updated marketplace payout request record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: params.eventType,
    metadata: {
      currency: updated.currency,
      note: params.note,
      payout_amount: updated.payoutAmount,
      payout_method: updated.payoutMethod,
      payout_status: updated.payoutStatus,
      source_runtime: "marketplace_payouts_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function submitMarketplacePayoutRequestForReview(payoutRequestId: string) {
  const payout = await getMarketplacePayoutRequestById(payoutRequestId);

  if (!payout) {
    throw new Error("Marketplace payout request was not found.");
  }

  if (payout.payoutAmount <= 0) {
    throw new Error("Payout amount must be greater than 0 before review submission.");
  }

  const access = await requireSuperAdmin();
  const now = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .update({
      payout_status: "pending_review",
      requested_at: payout.requestedAt ?? now,
      requested_by: payout.requestedBy ?? access.user.id
    } as never)
    .eq("id" as never, payout.id as never)
    .eq("payout_status" as never, "draft" as never)
    .select(payoutRequestSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace payout request could not be submitted for review: ${error.message}`);
  }

  const updated = parseMarketplacePayoutRequest(data);

  if (!updated) {
    throw new Error("Submitted marketplace payout request record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_submit_payout_request_review",
    metadata: {
      note: "Super Admin marketplace payout review submission. No payout execution.",
      payout_status: updated.payoutStatus,
      source_runtime: "marketplace_payouts_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function approveMarketplacePayoutRequestFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["pending_review"],
    eventType: "admin_marketplace_approve_payout_request_foundation",
    nextStatus: "approved",
    note: "Super Admin marketplace payout approval foundation. Status only. No money transfer.",
    payoutRequestId,
    setReviewed: true
  });
}

export async function rejectMarketplacePayoutRequestFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["pending_review", "approved"],
    eventType: "admin_marketplace_reject_payout_request_foundation",
    nextStatus: "rejected",
    note: "Super Admin marketplace payout rejection foundation. No money transfer.",
    payoutRequestId,
    setReviewed: true
  });
}

export async function cancelMarketplacePayoutRequestFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["draft", "pending_review", "approved"],
    eventType: "admin_marketplace_cancel_payout_request_foundation",
    nextStatus: "cancelled",
    note: "Super Admin marketplace payout cancellation foundation. No money transfer.",
    payoutRequestId
  });
}

export async function markMarketplacePayoutProcessingFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["approved"],
    eventType: "admin_marketplace_mark_payout_processing_foundation",
    nextStatus: "processing",
    note: "Super Admin marketplace payout processing foundation. Status only. No provider payout API.",
    payoutRequestId
  });
}

export async function markMarketplacePayoutPaidFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["processing"],
    eventType: "admin_marketplace_mark_payout_paid_foundation",
    nextStatus: "paid",
    note: "Super Admin marketplace payout paid foundation. Status only. No real money transfer.",
    payoutRequestId
  });
}

export async function markMarketplacePayoutFailedFoundation(payoutRequestId: string) {
  return transitionMarketplacePayoutStatus({
    allowedFrom: ["processing"],
    eventType: "admin_marketplace_mark_payout_failed_foundation",
    nextStatus: "failed",
    note: "Super Admin marketplace payout failed foundation. Status only. No provider payout API.",
    payoutRequestId
  });
}
