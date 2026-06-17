import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTemplatePackage,
  validateTemplatePackage,
  type TemplatePackageReadinessStatus
} from "@/src/lib/templates/template-package-runtime";
import { buildTemplatePreviewModel } from "@/src/lib/templates/template-preview-runtime";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import {
  listPublishedTemplateScreenshots,
  type TemplateScreenshotRecord
} from "@/src/lib/templates/template-screenshot-storage";
import { getPublishedTemplateVersion } from "@/src/lib/templates/template-versions";

export type MarketplaceListingStatus = "archived" | "draft" | "published";
export type MarketplacePricingType = "free" | "included" | "paid";
export type MarketplaceApprovalStatus =
  | "approved"
  | "changes_requested"
  | "pending_review"
  | "rejected";
export type MarketplaceListingVisibility = "internal" | "marketplace" | "owner" | "reseller";

export type MarketplaceListingRecord = {
  approvalStatus: MarketplaceApprovalStatus;
  createdAt: string | null;
  currency: string | null;
  featured: boolean;
  id: string;
  listingDescription: string | null;
  listingStatus: MarketplaceListingStatus;
  listingTitle: string;
  metadata: Record<string, unknown>;
  priceAmount: number | null;
  pricingType: MarketplacePricingType;
  publishedAt: string | null;
  templateId: string;
  templateVersionId: string | null;
  updatedAt: string | null;
  visibility: MarketplaceListingVisibility;
};

export type MarketplaceListingInput = {
  approvalStatus?: MarketplaceApprovalStatus;
  currency?: string | null;
  featured?: boolean;
  listingDescription?: string | null;
  listingTitle?: string;
  priceAmount?: number | null;
  pricingType?: MarketplacePricingType;
  templateVersionId?: string | null;
  visibility?: MarketplaceListingVisibility;
};

export type MarketplaceListingFilters = {
  approvalStatus?: MarketplaceApprovalStatus | MarketplaceApprovalStatus[];
  featured?: boolean;
  limit?: number;
  listingStatus?: MarketplaceListingStatus | MarketplaceListingStatus[];
  templateId?: string;
};

export type MarketplaceListingEligibility = {
  canList: boolean;
  hasPreview: boolean;
  hasScreenshots: boolean;
  issues: string[];
  packageReadiness: TemplatePackageReadinessStatus | "missing";
  publishedVersionId: string | null;
  publishedVersionNumber: string | null;
  templateId: string;
  templateName: string | null;
  warnings: string[];
};

export type MarketplaceListingStats = {
  approvedListings: number;
  archivedListings: number;
  draftListings: number;
  featuredListings: number;
  pendingReviewListings: number;
  publishedListings: number;
  rejectedListings: number;
  changesRequestedListings: number;
  totalListings: number;
};

export type MarketplaceCatalogCard = {
  approvalStatus: MarketplaceApprovalStatus;
  badges: string[];
  category: string | null;
  featured: boolean;
  id: string;
  industry: string | null;
  isOfficial: boolean;
  isRecommended: boolean;
  listingDescription: string | null;
  listingStatus: MarketplaceListingStatus;
  listingTitle: string;
  previewGradient: string | null;
  pricingLabel: string;
  pricingType: MarketplacePricingType;
  publishedAt: string | null;
  screenshots: Array<{
    imageUrl: string | null;
    label: string;
  }>;
  templateId: string;
  templateName: string;
  templateSlug: string;
  versionNumber: string | null;
};

type MarketplaceListingRow = {
  approval_status?: string | null;
  created_at?: string | null;
  currency?: string | null;
  featured?: boolean | null;
  id?: string | null;
  listing_description?: string | null;
  listing_status?: string | null;
  listing_title?: string | null;
  metadata?: unknown;
  price_amount?: number | string | null;
  pricing_type?: string | null;
  published_at?: string | null;
  template_id?: string | null;
  template_version_id?: string | null;
  updated_at?: string | null;
  visibility?: string | null;
};

const listingSelect =
  "id, template_id, template_version_id, listing_status, listing_title, listing_description, pricing_type, price_amount, currency, visibility, featured, approval_status, metadata, published_at, created_at, updated_at";

const listingVisibilities: MarketplaceListingVisibility[] = ["owner", "reseller", "marketplace", "internal"];

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

function coerceText(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return text(value, maxLength);
  return text(String(value), maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parsePriceAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseListingStatus(value: unknown): MarketplaceListingStatus {
  const cleaned = text(value, 40);
  if (cleaned === "published") return "published";
  if (cleaned === "archived") return "archived";
  return "draft";
}

function parsePricingType(value: unknown): MarketplacePricingType {
  const cleaned = text(value, 40);
  if (cleaned === "paid") return "paid";
  if (cleaned === "included") return "included";
  return "free";
}

function parseApprovalStatus(value: unknown): MarketplaceApprovalStatus {
  const cleaned = text(value, 40);
  if (cleaned === "approved") return "approved";
  if (cleaned === "rejected") return "rejected";
  if (cleaned === "changes_requested") return "changes_requested";
  return "pending_review";
}

function parseVisibility(value: unknown): MarketplaceListingVisibility {
  const cleaned = text(value, 40);
  return listingVisibilities.includes(cleaned as MarketplaceListingVisibility)
    ? (cleaned as MarketplaceListingVisibility)
    : "marketplace";
}

function parseListing(row: unknown): MarketplaceListingRecord | null {
  if (!isRecord(row)) return null;

  const value = row as MarketplaceListingRow;
  const id = coerceText(value.id, 120);
  const templateId = coerceText(value.template_id, 120);
  const listingTitle = coerceText(value.listing_title, 240);

  if (!id || !templateId || !listingTitle) return null;

  return {
    approvalStatus: parseApprovalStatus(value.approval_status),
    createdAt: coerceText(value.created_at, 80) || null,
    currency: coerceText(value.currency, 12) || null,
    featured: value.featured === true,
    id,
    listingDescription: coerceText(value.listing_description, 4000) || null,
    listingStatus: parseListingStatus(value.listing_status),
    listingTitle,
    metadata: safeRecord(value.metadata),
    priceAmount: parsePriceAmount(value.price_amount),
    pricingType: parsePricingType(value.pricing_type),
    publishedAt: coerceText(value.published_at, 80) || null,
    templateId,
    templateVersionId: coerceText(value.template_version_id, 120) || null,
    updatedAt: coerceText(value.updated_at, 80) || null,
    visibility: parseVisibility(value.visibility)
  };
}

function pricingLabelFor(listing: MarketplaceListingRecord) {
  if (listing.pricingType === "included") return "Included";
  if (listing.pricingType === "paid") {
    if (listing.priceAmount !== null) {
      const currency = listing.currency?.toUpperCase() || "USD";
      return `${currency} ${listing.priceAmount.toFixed(2)}`;
    }
    return "Paid";
  }
  return "Free";
}

function templateAllowsMarketplace(template: TemplateRegistryRecord) {
  if (template.visibility === "marketplace") return true;

  const metadata = safeRecord(template.metadata);
  return metadata.marketplaceAllowed === true || metadata.allowMarketplace === true;
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template marketplace runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template marketplace runtime.");
  }

  return admin;
}

async function findRegistryTemplate(templateId: string) {
  const cleaned = text(templateId, 120);
  if (!cleaned) return null;
  return (await listTemplates()).find((template) => template.id === cleaned) ?? null;
}

async function findActiveListingForTemplate(templateId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .select(listingSelect)
    .eq("template_id" as never, templateId as never)
    .in("listing_status" as never, ["draft", "published"] as never)
    .order("created_at" as never, { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Template marketplace listings could not be inspected: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  return row ? parseListing(row) : null;
}

function normalizePricingInput(input: MarketplaceListingInput) {
  const pricingType = input.pricingType ? parsePricingType(input.pricingType) : "free";
  const currency = input.currency === undefined ? undefined : coerceText(input.currency, 12).toUpperCase() || null;
  const priceAmount =
    input.priceAmount === undefined ? undefined : parsePriceAmount(input.priceAmount);

  if (pricingType === "paid") {
    if (priceAmount === null || priceAmount === undefined) {
      throw new Error("Paid marketplace listings require a valid price amount.");
    }
    if (!currency) {
      throw new Error("Paid marketplace listings require a currency code.");
    }
  }

  return {
    currency: pricingType === "paid" ? currency ?? "USD" : currency ?? null,
    priceAmount: pricingType === "paid" ? (priceAmount ?? null) : null,
    pricingType
  };
}

export async function validateMarketplaceListingEligibility(
  templateId: string
): Promise<MarketplaceListingEligibility> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const warnings: string[] = [];
  const template = await findRegistryTemplate(templateId);
  const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;
  const pkg = template ? await getTemplatePackage(template.id) : null;
  const packageValidation = template ? await validateTemplatePackage(template.id) : null;
  const screenshots = template ? await listPublishedTemplateScreenshots(template.id) : [];

  if (!template) {
    return {
      canList: false,
      hasPreview: false,
      hasScreenshots: false,
      issues: ["Template registry record was not found."],
      packageReadiness: "missing",
      publishedVersionId: null,
      publishedVersionNumber: null,
      templateId: text(templateId, 120),
      templateName: null,
      warnings: []
    };
  }

  if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  if (!templateAllowsMarketplace(template)) {
    issues.push(
      "Template visibility must be marketplace or template metadata must explicitly allow marketplace listings."
    );
  }

  if (!publishedVersion) {
    issues.push("A published template version is required for marketplace listing eligibility.");
  }

  const packageReadiness = pkg?.readinessStatus ?? "missing";

  if (!pkg || pkg.readinessStatus !== "ready") {
    issues.push(`Template package readiness must be ready (current: ${packageReadiness}).`);
  }

  if (packageValidation && packageValidation.issues.length) {
    for (const issue of packageValidation.issues) {
      if (!issues.includes(issue)) issues.push(issue);
    }
  }

  const hasScreenshots = screenshots.length > 0;
  let hasPreview = hasScreenshots;

  if (!hasScreenshots) {
    try {
      const preview = await buildTemplatePreviewModel(template.id);
      hasPreview = Boolean(preview);
      if (!hasPreview) {
        warnings.push("No published screenshots found; marketplace preview will use generated placeholders.");
      }
    } catch {
      warnings.push("No published screenshots found; preview fallback could not be generated.");
    }
  }

  return {
    canList: issues.length === 0,
    hasPreview,
    hasScreenshots,
    issues,
    packageReadiness,
    publishedVersionId: publishedVersion?.id ?? null,
    publishedVersionNumber: publishedVersion?.versionNumber ?? null,
    templateId: template.id,
    templateName: template.name,
    warnings
  };
}

async function recordMarketplaceAudit(
  eventType:
    | "template_marketplace_listing_archived"
    | "template_marketplace_listing_created"
    | "template_marketplace_listing_featured"
    | "template_marketplace_listing_published"
    | "template_marketplace_listing_updated",
  params: {
    listing: MarketplaceListingRecord;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.listing.id,
    entity_type: "admin_template_marketplace_listing",
    event_status: "info",
    event_type: eventType,
    metadata: {
      approval_status: params.listing.approvalStatus,
      featured: params.listing.featured,
      listing_status: params.listing.listingStatus,
      listing_title: params.listing.listingTitle,
      note: "Super Admin template marketplace runtime. No install, payment, or store mutation.",
      pricing_type: params.listing.pricingType,
      source: "super_admin_template_marketplace_runtime",
      template_id: params.listing.templateId,
      ...(params.metadata ?? {})
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceListings(
  filters: MarketplaceListingFilters = {}
): Promise<MarketplaceListingRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  let query = admin.from("template_marketplace_listings" as never).select(listingSelect);

  if (filters.templateId) {
    query = query.eq("template_id" as never, text(filters.templateId, 120) as never);
  }

  if (filters.featured !== undefined) {
    query = query.eq("featured" as never, filters.featured as never);
  }

  if (filters.listingStatus) {
    const statuses = Array.isArray(filters.listingStatus) ? filters.listingStatus : [filters.listingStatus];
    query = query.in("listing_status" as never, statuses as never);
  }

  if (filters.approvalStatus) {
    const statuses = Array.isArray(filters.approvalStatus)
      ? filters.approvalStatus
      : [filters.approvalStatus];
    query = query.in("approval_status" as never, statuses as never);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const { data, error } = await query
    .order("updated_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Template marketplace listings could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseListing(row))
    .filter((listing): listing is MarketplaceListingRecord => Boolean(listing));
}

export async function getMarketplaceListing(listingId: string): Promise<MarketplaceListingRecord | null> {
  await requireSuperAdmin();

  const cleanedId = text(listingId, 120);
  if (!cleanedId) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .select(listingSelect)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Template marketplace listing could not be loaded: ${error.message}`);
  }

  return parseListing(data);
}

export async function createMarketplaceListing(templateId: string, input: MarketplaceListingInput = {}) {
  const access = await requireSuperAdmin();
  const eligibility = await validateMarketplaceListingEligibility(templateId);

  if (!eligibility.canList) {
    throw new Error(eligibility.issues.join(" ") || "Template is not eligible for marketplace listing.");
  }

  const existing = await findActiveListingForTemplate(eligibility.templateId);

  if (existing) {
    throw new Error(
      "An active draft or published marketplace listing already exists for this template. Archive it before creating another."
    );
  }

  const template = await findRegistryTemplate(eligibility.templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const pricing = normalizePricingInput(input);
  const listingTitle = text(input.listingTitle, 240) || template.name;
  const listingDescription =
    input.listingDescription === undefined
      ? null
      : text(input.listingDescription, 4000) || null;
  const templateVersionId =
    input.templateVersionId === undefined
      ? eligibility.publishedVersionId
      : text(input.templateVersionId, 120) || eligibility.publishedVersionId;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .insert({
      approval_status: input.approvalStatus ? parseApprovalStatus(input.approvalStatus) : "pending_review",
      currency: pricing.currency,
      featured: input.featured === true,
      listing_description: listingDescription,
      listing_status: "draft",
      listing_title: listingTitle,
      metadata: {
        eligibility_warnings: eligibility.warnings,
        has_preview: eligibility.hasPreview,
        has_screenshots: eligibility.hasScreenshots,
        package_readiness: eligibility.packageReadiness
      },
      price_amount: pricing.priceAmount,
      pricing_type: pricing.pricingType,
      template_id: eligibility.templateId,
      template_version_id: templateVersionId,
      visibility: input.visibility ? parseVisibility(input.visibility) : "marketplace"
    } as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Template marketplace listing could not be created: ${error.message}`);
  }

  const listing = parseListing(data);

  if (!listing) {
    throw new Error("Created template marketplace listing could not be parsed.");
  }

  await recordMarketplaceAudit("template_marketplace_listing_created", {
    listing,
    metadata: { eligibility_warnings: eligibility.warnings },
    userId: access.user.id
  });

  return { eligibility, listing };
}

export async function updateMarketplaceListing(listingId: string, input: MarketplaceListingInput) {
  const access = await requireSuperAdmin();
  const existing = await getMarketplaceListing(listingId);

  if (!existing) {
    throw new Error("Template marketplace listing was not found.");
  }

  if (existing.listingStatus === "archived") {
    throw new Error("Archived marketplace listings cannot be edited.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (input.listingTitle !== undefined) {
    const listingTitle = text(input.listingTitle, 240);
    if (!listingTitle) throw new Error("Listing title cannot be empty.");
    updatePayload.listing_title = listingTitle;
  }

  if (input.listingDescription !== undefined) {
    updatePayload.listing_description = text(input.listingDescription, 4000) || null;
  }

  if (input.pricingType !== undefined || input.priceAmount !== undefined || input.currency !== undefined) {
    const pricing = normalizePricingInput({
      currency: input.currency ?? existing.currency,
      priceAmount: input.priceAmount ?? existing.priceAmount,
      pricingType: input.pricingType ?? existing.pricingType
    });
    updatePayload.pricing_type = pricing.pricingType;
    updatePayload.price_amount = pricing.priceAmount;
    updatePayload.currency = pricing.currency;
  }

  if (input.visibility !== undefined) {
    updatePayload.visibility = parseVisibility(input.visibility);
  }

  if (input.featured !== undefined) {
    updatePayload.featured = input.featured === true;
  }

  if (input.approvalStatus !== undefined) {
    updatePayload.approval_status = parseApprovalStatus(input.approvalStatus);
  }

  if (input.templateVersionId !== undefined) {
    updatePayload.template_version_id = text(input.templateVersionId, 120) || null;
  }

  if (!Object.keys(updatePayload).length) {
    return { listing: existing };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .update(updatePayload as never)
    .eq("id" as never, existing.id as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Template marketplace listing could not be updated: ${error.message}`);
  }

  const listing = parseListing(data);

  if (!listing) {
    throw new Error("Updated template marketplace listing could not be parsed.");
  }

  await recordMarketplaceAudit("template_marketplace_listing_updated", {
    listing,
    metadata: { updated_fields: Object.keys(updatePayload) },
    userId: access.user.id
  });

  return { listing };
}

export async function publishMarketplaceListing(listingId: string) {
  const access = await requireSuperAdmin();
  const existing = await getMarketplaceListing(listingId);

  if (!existing) {
    throw new Error("Template marketplace listing was not found.");
  }

  if (existing.listingStatus !== "draft") {
    throw new Error(`Only draft listings can be published (current: ${existing.listingStatus}).`);
  }

  if (existing.approvalStatus !== "approved") {
    throw new Error("Marketplace listing must be approved before publishing.");
  }

  const eligibility = await validateMarketplaceListingEligibility(existing.templateId);

  if (!eligibility.canList) {
    throw new Error(eligibility.issues.join(" ") || "Template is no longer eligible for marketplace listing.");
  }

  const publishedAt = new Date().toISOString();
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .update({
      listing_status: "published",
      metadata: {
        ...existing.metadata,
        eligibility_warnings: eligibility.warnings,
        has_preview: eligibility.hasPreview,
        has_screenshots: eligibility.hasScreenshots,
        published_by: access.user.id
      },
      published_at: publishedAt,
      template_version_id: existing.templateVersionId ?? eligibility.publishedVersionId
    } as never)
    .eq("id" as never, existing.id as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Template marketplace listing could not be published: ${error.message}`);
  }

  const listing = parseListing(data);

  if (!listing) {
    throw new Error("Published template marketplace listing could not be parsed.");
  }

  await recordMarketplaceAudit("template_marketplace_listing_published", {
    listing,
    metadata: {
      note: "Publishing does not install templates, charge payments, or mutate customer stores.",
      published_at: publishedAt
    },
    userId: access.user.id
  });

  return { eligibility, listing };
}

export async function archiveMarketplaceListing(listingId: string) {
  const access = await requireSuperAdmin();
  const existing = await getMarketplaceListing(listingId);

  if (!existing) {
    throw new Error("Template marketplace listing was not found.");
  }

  if (existing.listingStatus === "archived") {
    return { listing: existing };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .update({
      featured: false,
      listing_status: "archived"
    } as never)
    .eq("id" as never, existing.id as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Template marketplace listing could not be archived: ${error.message}`);
  }

  const listing = parseListing(data);

  if (!listing) {
    throw new Error("Archived template marketplace listing could not be parsed.");
  }

  await recordMarketplaceAudit("template_marketplace_listing_archived", {
    listing,
    userId: access.user.id
  });

  return { listing };
}

export async function setMarketplaceListingFeatured(listingId: string, featured: boolean) {
  const access = await requireSuperAdmin();
  const existing = await getMarketplaceListing(listingId);

  if (!existing) {
    throw new Error("Template marketplace listing was not found.");
  }

  if (existing.listingStatus === "archived") {
    throw new Error("Archived marketplace listings cannot be featured.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("template_marketplace_listings" as never)
    .update({ featured: featured === true } as never)
    .eq("id" as never, existing.id as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Template marketplace listing featured flag could not be updated: ${error.message}`);
  }

  const listing = parseListing(data);

  if (!listing) {
    throw new Error("Updated template marketplace listing could not be parsed.");
  }

  await recordMarketplaceAudit("template_marketplace_listing_featured", {
    listing,
    metadata: { featured: listing.featured },
    userId: access.user.id
  });

  return { listing };
}

export async function getMarketplaceListingStats(): Promise<MarketplaceListingStats> {
  const listings = await listMarketplaceListings({ limit: 500 });

  return {
    approvedListings: listings.filter((listing) => listing.approvalStatus === "approved").length,
    archivedListings: listings.filter((listing) => listing.listingStatus === "archived").length,
    changesRequestedListings: listings.filter(
      (listing) => listing.approvalStatus === "changes_requested"
    ).length,
    draftListings: listings.filter((listing) => listing.listingStatus === "draft").length,
    featuredListings: listings.filter((listing) => listing.featured).length,
    pendingReviewListings: listings.filter((listing) => listing.approvalStatus === "pending_review").length,
    publishedListings: listings.filter((listing) => listing.listingStatus === "published").length,
    rejectedListings: listings.filter((listing) => listing.approvalStatus === "rejected").length,
    totalListings: listings.length
  };
}

async function screenshotsForCatalog(
  templateId: string,
  screenshots: TemplateScreenshotRecord[]
) {
  if (screenshots.length) {
    return screenshots.slice(0, 4).map((screenshot) => ({
      imageUrl: screenshot.previewUrl,
      label: screenshot.screenshotType
    }));
  }

  try {
    const preview = await buildTemplatePreviewModel(templateId);
    return (preview?.screenshots ?? []).slice(0, 4).map((screenshot) => ({
      imageUrl: screenshot.imageUrl,
      label: screenshot.label
    }));
  } catch {
    return [];
  }
}

export async function getMarketplaceCatalogPreview(): Promise<MarketplaceCatalogCard[]> {
  await requireSuperAdmin();

  const listings = await listMarketplaceListings({
    approvalStatus: "approved",
    listingStatus: "published",
    limit: 100
  });
  const templates = await listTemplates();
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const screenshotsByTemplateId = new Map<string, TemplateScreenshotRecord[]>();

  for (const template of templates) {
    screenshotsByTemplateId.set(template.id, await listPublishedTemplateScreenshots(template.id));
  }

  const cards: MarketplaceCatalogCard[] = [];

  for (const listing of listings) {
    const template = templateById.get(listing.templateId);
    if (!template) continue;

    const screenshots = await screenshotsForCatalog(
      template.id,
      screenshotsByTemplateId.get(template.id) ?? []
    );
    const publishedVersion = await getPublishedTemplateVersion(template.id);

    let gradientFallback: string | null = null;
    if (!screenshots.some((entry) => entry.imageUrl)) {
      try {
        const preview = await buildTemplatePreviewModel(template.id);
        gradientFallback = preview?.screenshots[0]?.gradient ?? null;
      } catch {
        gradientFallback = null;
      }
    }

    cards.push({
      approvalStatus: listing.approvalStatus,
      badges: template.badges,
      category: template.category,
      featured: listing.featured,
      id: listing.id,
      industry: template.industry,
      isOfficial: template.isOfficial,
      isRecommended: template.isRecommended,
      listingDescription: listing.listingDescription,
      listingStatus: listing.listingStatus,
      listingTitle: listing.listingTitle,
      previewGradient: gradientFallback,
      pricingLabel: pricingLabelFor(listing),
      pricingType: listing.pricingType,
      publishedAt: listing.publishedAt,
      screenshots,
      templateId: template.id,
      templateName: template.name,
      templateSlug: template.slug,
      versionNumber: publishedVersion?.versionNumber ?? template.version
    });
  }

  return cards.sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
  });
}
