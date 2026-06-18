import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceCreatorStatus = "active" | "archived" | "draft" | "suspended";

export type MarketplaceCreatorVerificationStatus = "pending" | "rejected" | "unverified" | "verified";

export type MarketplaceCreatorType = "agency" | "company" | "individual" | "internal";

export type MarketplaceCreatorAccountRecord = {
  accountId: string | null;
  bio: string;
  createdAt: string | null;
  creatorStatus: MarketplaceCreatorStatus;
  creatorType: MarketplaceCreatorType;
  displayName: string;
  id: string;
  metadata: Record<string, unknown>;
  publicSlug: string;
  supportEmail: string | null;
  updatedAt: string | null;
  userId: string | null;
  verificationStatus: MarketplaceCreatorVerificationStatus;
  websiteUrl: string | null;
};

export type MarketplaceCreatorInspection = {
  accountId: string | null;
  creatorStatus: MarketplaceCreatorStatus | null;
  creatorType: MarketplaceCreatorType | null;
  displayName: string | null;
  linkedUserId: string | null;
  publicEligible: boolean;
  publicSlug: string | null;
  verificationIssues: string[];
  verificationStatus: MarketplaceCreatorVerificationStatus | null;
  verified: boolean;
};

export type MarketplaceItemCreatorInspection = {
  creatorAccountId: string | null;
  creatorInspection: MarketplaceCreatorInspection | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  publicEligible: boolean;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceCreatorAccountStats = {
  activeCreatorAccounts: number;
  archivedCreatorAccounts: number;
  draftCreatorAccounts: number;
  suspendedCreatorAccounts: number;
  totalCreatorAccounts: number;
  totalLinkedItems: number;
  verifiedCreatorAccounts: number;
};

export const MARKETPLACE_CREATOR_STATUSES: readonly MarketplaceCreatorStatus[] = [
  "draft",
  "active",
  "suspended",
  "archived"
] as const;

export const MARKETPLACE_CREATOR_VERIFICATION_STATUSES: readonly MarketplaceCreatorVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "rejected"
] as const;

export const MARKETPLACE_CREATOR_TYPES: readonly MarketplaceCreatorType[] = [
  "individual",
  "company",
  "agency",
  "internal"
] as const;

const CREATOR_FOUNDATION_CATALOG: Record<
  string,
  {
    bio: string;
    creatorStatus: MarketplaceCreatorStatus;
    creatorType: MarketplaceCreatorType;
    displayName: string;
    metadata: Record<string, unknown>;
    verificationStatus: MarketplaceCreatorVerificationStatus;
  }
> = {
  "shastore-platform": {
    bio: "Official SHASTORE platform marketplace creator account.",
    creatorStatus: "active",
    creatorType: "internal",
    displayName: "SHASTORE Platform",
    metadata: {
      foundation_only: true,
      payout_runtime: false,
      source: "marketplace_creator_runtime"
    },
    verificationStatus: "verified"
  },
  "shastore-services": {
    bio: "Official SHASTORE services marketplace creator account.",
    creatorStatus: "active",
    creatorType: "internal",
    displayName: "SHASTORE Services",
    metadata: {
      foundation_only: true,
      payout_runtime: false,
      source: "marketplace_creator_runtime"
    },
    verificationStatus: "verified"
  }
};

const creatorSelect =
  "id, account_id, user_id, display_name, public_slug, creator_type, creator_status, verification_status, bio, website_url, support_email, metadata, created_at, updated_at";

const marketplaceItemCreatorSelect =
  "id, item_key, name, item_type, section, status, visibility, creator_source, source_type, creator_account_id";

const secretKeyPattern = /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account)/i;

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

export function isValidMarketplaceCreatorStatus(value: unknown): value is MarketplaceCreatorStatus {
  return MARKETPLACE_CREATOR_STATUSES.includes(value as MarketplaceCreatorStatus);
}

export function parseMarketplaceCreatorStatus(value: unknown): MarketplaceCreatorStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceCreatorStatus(cleaned) ? cleaned : null;
}

export function isValidMarketplaceCreatorVerificationStatus(
  value: unknown
): value is MarketplaceCreatorVerificationStatus {
  return MARKETPLACE_CREATOR_VERIFICATION_STATUSES.includes(value as MarketplaceCreatorVerificationStatus);
}

export function parseMarketplaceCreatorVerificationStatus(
  value: unknown
): MarketplaceCreatorVerificationStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceCreatorVerificationStatus(cleaned) ? cleaned : null;
}

export function isValidMarketplaceCreatorType(value: unknown): value is MarketplaceCreatorType {
  return MARKETPLACE_CREATOR_TYPES.includes(value as MarketplaceCreatorType);
}

export function parseMarketplaceCreatorType(value: unknown): MarketplaceCreatorType | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceCreatorType(cleaned) ? cleaned : null;
}

export function isValidCreatorPublicSlug(value: unknown) {
  const cleaned = text(value, 80);
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(cleaned);
}

export function sanitizeCreatorMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.payout_runtime = false;

  return clean;
}

export function validateCreatorMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Creator metadata must not contain secrets or payout credentials.");
  }
}

export function parseMarketplaceCreatorAccount(value: unknown): MarketplaceCreatorAccountRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const displayName = text(row.display_name, 240);
  const publicSlug = text(row.public_slug, 80);
  const creatorType = parseMarketplaceCreatorType(row.creator_type);
  const creatorStatus = parseMarketplaceCreatorStatus(row.creator_status);
  const verificationStatus = parseMarketplaceCreatorVerificationStatus(row.verification_status);

  if (!id || !displayName || !publicSlug || !creatorType || !creatorStatus || !verificationStatus) {
    return null;
  }

  if (!isValidCreatorPublicSlug(publicSlug)) return null;

  const metadata = sanitizeCreatorMetadata(safeRecord(row.metadata));

  try {
    validateCreatorMetadata(metadata);
  } catch {
    return null;
  }

  return {
    accountId: text(row.account_id, 120) || null,
    bio: text(row.bio, 2000),
    createdAt: text(row.created_at, 80) || null,
    creatorStatus,
    creatorType,
    displayName,
    id,
    metadata,
    publicSlug,
    supportEmail: text(row.support_email, 240) || null,
    updatedAt: text(row.updated_at, 80) || null,
    userId: text(row.user_id, 120) || null,
    verificationStatus,
    websiteUrl: text(row.website_url, 500) || null
  };
}

export function isPublicCreatorEligible(creator: MarketplaceCreatorAccountRecord) {
  return creator.creatorStatus === "active" && creator.verificationStatus === "verified";
}

export function evaluateMarketplaceCreatorAccount(
  creator: MarketplaceCreatorAccountRecord | null
): MarketplaceCreatorInspection {
  if (!creator) {
    return {
      accountId: null,
      creatorStatus: null,
      creatorType: null,
      displayName: null,
      linkedUserId: null,
      publicEligible: false,
      publicSlug: null,
      verificationIssues: ["Creator not linked."],
      verificationStatus: null,
      verified: false
    };
  }

  const verificationIssues: string[] = [];
  const publicEligible = isPublicCreatorEligible(creator);

  if (creator.creatorStatus === "suspended") {
    verificationIssues.push("Suspended creator accounts cannot be exposed publicly.");
  }

  if (creator.creatorStatus === "archived") {
    verificationIssues.push("Archived creator accounts cannot be exposed publicly.");
  }

  if (creator.creatorStatus === "draft") {
    verificationIssues.push("Draft creator accounts cannot be exposed publicly.");
  }

  if (creator.verificationStatus !== "verified") {
    verificationIssues.push("Creator account must be verified before public exposure.");
  }

  if (creator.metadata.payout_runtime === true) {
    verificationIssues.push("Payout runtime is not enabled in creator foundation phase.");
  }

  return {
    accountId: creator.accountId,
    creatorStatus: creator.creatorStatus,
    creatorType: creator.creatorType,
    displayName: creator.displayName,
    linkedUserId: creator.userId,
    publicEligible,
    publicSlug: creator.publicSlug,
    verificationIssues,
    verificationStatus: creator.verificationStatus,
    verified: verificationIssues.length === 0
  };
}

export function evaluateMarketplaceItemCreatorLink(params: {
  creator: MarketplaceCreatorAccountRecord | null;
  creatorAccountId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
}): MarketplaceItemCreatorInspection {
  const itemPublicEligible =
    params.marketplaceStatus === "approved" && params.marketplaceVisibility === "public";
  const creatorInspection = evaluateMarketplaceCreatorAccount(params.creator);
  const verificationIssues = [...creatorInspection.verificationIssues];

  if (!params.creatorAccountId) {
    verificationIssues.push("Creator not linked.");
  } else if (!params.creator) {
    verificationIssues.push("Marketplace item references a missing creator account.");
  }

  if (itemPublicEligible && !creatorInspection.publicEligible) {
    verificationIssues.push("Public approved marketplace items require an active verified creator account.");
  }

  const publicEligible = itemPublicEligible && creatorInspection.publicEligible;

  return {
    creatorAccountId: params.creatorAccountId,
    creatorInspection,
    marketplaceStatus: params.marketplaceStatus,
    marketplaceVisibility: params.marketplaceVisibility,
    publicEligible,
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

function creatorSlugForItem(row: Record<string, unknown>) {
  const creatorSource = text(row.creator_source, 240).toLowerCase();

  if (creatorSource.includes("services")) {
    return "shastore-services";
  }

  return "shastore-platform";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace creator runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace creator runtime.");
  }

  return admin;
}

async function recordMarketplaceCreatorAudit(params: {
  creator: MarketplaceCreatorAccountRecord;
  inspection: MarketplaceCreatorInspection;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.creator.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_creator_account",
    metadata: {
      creator_status: params.creator.creatorStatus,
      creator_type: params.creator.creatorType,
      note: "Super Admin marketplace creator account foundation verification. No payouts or revenue sharing.",
      public_slug: params.creator.publicSlug,
      source_runtime: "marketplace_creator_runtime",
      verification_issues: params.inspection.verificationIssues,
      verification_status: params.creator.verificationStatus,
      verified: params.inspection.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceCreatorAccounts(params: {
  limit?: number;
  slug?: string;
} = {}): Promise<MarketplaceCreatorAccountRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_creator_accounts" as never).select(creatorSelect as never);

  if (params.slug) {
    query = query.eq("public_slug" as never, text(params.slug, 80) as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace creator accounts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceCreatorAccount(row))
    .filter((creator): creator is MarketplaceCreatorAccountRecord => Boolean(creator));
}

export async function getMarketplaceCreatorAccountById(
  creatorAccountId: string
): Promise<MarketplaceCreatorAccountRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(creatorAccountId, 120);

  if (!cleanedId) return null;

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

export async function getMarketplaceCreatorInspection(
  creatorAccountId: string
): Promise<MarketplaceCreatorInspection | null> {
  const creator = await getMarketplaceCreatorAccountById(creatorAccountId);
  if (!creator) return null;
  return evaluateMarketplaceCreatorAccount(creator);
}

export async function verifyMarketplaceCreatorAccount(creatorAccountId: string) {
  const access = await requireSuperAdmin();
  const creator = await getMarketplaceCreatorAccountById(creatorAccountId);

  if (!creator) {
    throw new Error("Marketplace creator account was not found.");
  }

  const inspection = evaluateMarketplaceCreatorAccount(creator);

  await recordMarketplaceCreatorAudit({
    creator,
    inspection,
    userId: access.user.id
  });

  return inspection;
}

async function upsertCreatorFromCatalog(publicSlug: string) {
  const catalog = CREATOR_FOUNDATION_CATALOG[publicSlug];

  if (!catalog) return null;

  const metadata = sanitizeCreatorMetadata(catalog.metadata);
  validateCreatorMetadata(metadata);

  const admin = requireAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("marketplace_creator_accounts" as never)
    .select(creatorSelect as never)
    .eq("public_slug" as never, publicSlug as never)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Marketplace creator account could not be inspected: ${existingError.message}`);
  }

  if (existing) {
    const parsed = parseMarketplaceCreatorAccount(existing);

    if (!parsed) {
      throw new Error("Existing marketplace creator account is invalid.");
    }

    const { data, error } = await admin
      .from("marketplace_creator_accounts" as never)
      .update({
        bio: catalog.bio,
        display_name: catalog.displayName,
        metadata
      } as never)
      .eq("id" as never, parsed.id as never)
      .select(creatorSelect as never)
      .single();

    if (error) {
      throw new Error(`Marketplace creator account could not be updated: ${error.message}`);
    }

    return parseMarketplaceCreatorAccount(data);
  }

  const { data, error } = await admin
    .from("marketplace_creator_accounts" as never)
    .insert({
      bio: catalog.bio,
      creator_status: catalog.creatorStatus,
      creator_type: catalog.creatorType,
      display_name: catalog.displayName,
      metadata,
      public_slug: publicSlug,
      verification_status: catalog.verificationStatus
    } as never)
    .select(creatorSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace creator account could not be created: ${error.message}`);
  }

  return parseMarketplaceCreatorAccount(data);
}

export async function ensureMarketplaceCreatorAccounts() {
  await requireSuperAdmin();

  for (const publicSlug of Object.keys(CREATOR_FOUNDATION_CATALOG)) {
    await upsertCreatorFromCatalog(publicSlug);
  }
}

export async function ensureMarketplaceCreatorItemLinks() {
  await ensureMarketplaceCreatorAccounts();

  const admin = requireAdminClient();
  const creators = await listMarketplaceCreatorAccounts({ limit: 1000 });
  const creatorBySlug = new Map(creators.map((creator) => [creator.publicSlug, creator]));

  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(marketplaceItemCreatorSelect as never);

  if (error) {
    throw new Error(`Marketplace items could not be loaded for creator linking: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    const itemId = text(row.id, 120);
    const existingCreatorAccountId = text(row.creator_account_id, 120);

    if (!itemId || existingCreatorAccountId) continue;

    const slug = creatorSlugForItem(row);
    const creator = creatorBySlug.get(slug);

    if (!creator) continue;

    await admin
      .from("marketplace_items" as never)
      .update({ creator_account_id: creator.id } as never)
      .eq("id" as never, itemId as never);
  }
}

export async function ensureMarketplaceCreatorFoundation() {
  await ensureMarketplaceCreatorAccounts();
  await ensureMarketplaceCreatorItemLinks();
}

export async function getMarketplaceCreatorAccountStats(): Promise<MarketplaceCreatorAccountStats> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const [creators, { data: items, error: itemsError }] = await Promise.all([
    listMarketplaceCreatorAccounts({ limit: 1000 }),
    admin
      .from("marketplace_items" as never)
      .select("id, creator_account_id" as never)
      .not("creator_account_id" as never, "is" as never, null as never)
  ]);

  if (itemsError) {
    throw new Error(`Marketplace creator-linked items could not be counted: ${itemsError.message}`);
  }

  const linkedItems = Array.isArray(items) ? items.length : 0;

  return creators.reduce<MarketplaceCreatorAccountStats>(
    (stats, creator) => {
      if (creator.creatorStatus === "active") stats.activeCreatorAccounts += 1;
      if (creator.creatorStatus === "draft") stats.draftCreatorAccounts += 1;
      if (creator.creatorStatus === "suspended") stats.suspendedCreatorAccounts += 1;
      if (creator.creatorStatus === "archived") stats.archivedCreatorAccounts += 1;
      if (creator.verificationStatus === "verified") stats.verifiedCreatorAccounts += 1;

      return stats;
    },
    {
      activeCreatorAccounts: 0,
      archivedCreatorAccounts: 0,
      draftCreatorAccounts: 0,
      suspendedCreatorAccounts: 0,
      totalCreatorAccounts: creators.length,
      totalLinkedItems: linkedItems,
      verifiedCreatorAccounts: 0
    }
  );
}
