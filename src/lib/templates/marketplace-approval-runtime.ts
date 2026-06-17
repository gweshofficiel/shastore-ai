import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplatePreviewModel } from "@/src/lib/templates/template-preview-runtime";
import { listTemplates } from "@/src/lib/templates/template-registry";
import { listPublishedTemplateScreenshots } from "@/src/lib/templates/template-screenshot-storage";
import {
  getMarketplaceListing,
  listMarketplaceListings,
  type MarketplaceApprovalStatus,
  type MarketplaceListingRecord,
  type MarketplacePricingType
} from "@/src/lib/templates/template-marketplace-runtime";
import {
  getPublishedTemplateVersion,
  type TemplateVersionRecord
} from "@/src/lib/templates/template-versions";
import {
  getTemplatePackage,
  validateTemplatePackage,
  type TemplatePackageReadinessStatus
} from "@/src/lib/templates/template-package-runtime";

export type MarketplaceApprovalEligibility = {
  canApprove: boolean;
  hasPreview: boolean;
  hasScreenshots: boolean;
  issues: string[];
  listingId: string;
  listingTitle: string | null;
  packageReadiness: TemplatePackageReadinessStatus | "missing";
  publishedVersionNumber: string | null;
  securityIssues: string[];
  templateId: string | null;
  templateName: string | null;
  warnings: string[];
};

export type MarketplaceApprovalStats = {
  approvedListings: number;
  changesRequestedListings: number;
  pendingReviewListings: number;
  rejectedListings: number;
  totalReviewableListings: number;
};

export type MarketplaceApprovalQueueItem = MarketplaceListingRecord & {
  lastReviewNote: string | null;
  packageReadiness: TemplatePackageReadinessStatus | "missing";
  readinessLabel: string;
  rejectionReason: string | null;
  templateName: string | null;
  versionNumber: string | null;
};

const listingSelect =
  "id, template_id, template_version_id, listing_status, listing_title, listing_description, pricing_type, price_amount, currency, visibility, featured, approval_status, metadata, published_at, created_at, updated_at";

const pricingTypes: MarketplacePricingType[] = ["free", "paid", "included"];

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
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

function detectUnsafeText(value: string, field: string) {
  const issues: string[] = [];
  const raw = value.trim();

  if (!raw) return issues;

  if (/<\s*\/?\s*[a-z]/i.test(raw)) {
    issues.push(`${field} must not contain HTML markup.`);
  }

  if (/\bon\w+\s*=/i.test(raw) || /\bjavascript:/i.test(raw)) {
    issues.push(`${field} contains unsafe script-like content.`);
  }

  if (/\{\{|\}\}|\$\{|`/.test(raw)) {
    issues.push(`${field} contains unsafe template interpolation patterns.`);
  }

  return issues;
}

function sanitizeReviewNote(value: unknown, maxLength = 2000) {
  return coerceText(value, maxLength);
}

function readinessLabelFor(status: TemplatePackageReadinessStatus | "missing") {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs attention";
  if (status === "invalid") return "Invalid";
  if (status === "draft") return "Draft";
  return "Missing";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace approval runtime.");
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

function validatePricing(listing: MarketplaceListingRecord, issues: string[]) {
  if (!pricingTypes.includes(listing.pricingType)) {
    issues.push(`Pricing type must be free, paid, or included (current: ${listing.pricingType}).`);
    return;
  }

  if (listing.pricingType === "paid") {
    if (listing.priceAmount === null || listing.priceAmount <= 0) {
      issues.push("Paid listings require a valid price amount.");
    }
    if (!listing.currency) {
      issues.push("Paid listings require a currency code.");
    }
  }
}

async function validatePreviewAvailability(templateId: string) {
  const screenshots = await listPublishedTemplateScreenshots(templateId);
  const hasScreenshots = screenshots.length > 0;

  if (hasScreenshots) {
    return { hasPreview: true, hasScreenshots: true };
  }

  try {
    const preview = await buildTemplatePreviewModel(templateId);
    return { hasPreview: Boolean(preview), hasScreenshots: false };
  } catch {
    return { hasPreview: false, hasScreenshots: false };
  }
}

export async function validateMarketplaceApprovalEligibility(
  listingId: string
): Promise<MarketplaceApprovalEligibility> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const warnings: string[] = [];
  const securityIssues: string[] = [];
  const listing = await getMarketplaceListing(listingId);

  if (!listing) {
    return {
      canApprove: false,
      hasPreview: false,
      hasScreenshots: false,
      issues: ["Marketplace listing was not found."],
      listingId: text(listingId, 120),
      listingTitle: null,
      packageReadiness: "missing",
      publishedVersionNumber: null,
      securityIssues: [],
      templateId: null,
      templateName: null,
      warnings: []
    };
  }

  if (listing.listingStatus === "archived") {
    issues.push("Archived marketplace listings cannot be approved.");
  }

  if (!listing.listingTitle.trim()) {
    issues.push("Listing title is required for approval.");
  } else {
    securityIssues.push(...detectUnsafeText(listing.listingTitle, "Listing title"));
  }

  const description = listing.listingDescription?.trim() ?? "";

  if (!description) {
    issues.push("Listing description is required for approval.");
  } else {
    securityIssues.push(...detectUnsafeText(description, "Listing description"));
  }

  const template = (await listTemplates()).find((entry) => entry.id === listing.templateId) ?? null;

  if (!template) {
    issues.push("Template registry record was not found.");
  } else if (template.status === "archived") {
    issues.push("Archived templates cannot be approved for marketplace listings.");
  } else if (template.status !== "active") {
    issues.push(`Template status must be active (current: ${template.status}).`);
  }

  let publishedVersion: TemplateVersionRecord | null = null;

  if (template) {
    publishedVersion = await getPublishedTemplateVersion(template.id);

    if (!publishedVersion) {
      issues.push("A published template version is required for marketplace approval.");
    }
  }

  const pkg = template ? await getTemplatePackage(template.id) : null;
  const packageReadiness = pkg?.readinessStatus ?? "missing";

  if (!pkg || pkg.readinessStatus !== "ready") {
    issues.push(`Template package readiness must be ready (current: ${packageReadiness}).`);
  }

  if (template) {
    const packageValidation = await validateTemplatePackage(template.id);

    for (const issue of packageValidation.issues) {
      if (!issues.includes(issue)) issues.push(issue);
    }
  }

  validatePricing(listing, issues);

  let hasPreview = false;
  let hasScreenshots = false;

  if (template) {
    const previewAvailability = await validatePreviewAvailability(template.id);
    hasPreview = previewAvailability.hasPreview;
    hasScreenshots = previewAvailability.hasScreenshots;

    if (!hasPreview) {
      issues.push("Published screenshots or a safe preview must be available before approval.");
    } else if (!hasScreenshots) {
      warnings.push("No published screenshots found; approval uses generated preview placeholders.");
    }
  }

  for (const issue of securityIssues) {
    if (!issues.includes(issue)) issues.push(issue);
  }

  return {
    canApprove: issues.length === 0,
    hasPreview,
    hasScreenshots,
    issues,
    listingId: listing.id,
    listingTitle: listing.listingTitle,
    packageReadiness,
    publishedVersionNumber: publishedVersion?.versionNumber ?? null,
    securityIssues,
    templateId: template?.id ?? listing.templateId,
    templateName: template?.name ?? null,
    warnings
  };
}

async function recordApprovalAudit(
  eventType:
    | "template_marketplace_approval_approved"
    | "template_marketplace_approval_changes_requested"
    | "template_marketplace_approval_rejected",
  params: {
    listing: MarketplaceListingRecord;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.listing.id,
    entity_type: "admin_template_marketplace_approval",
    event_status: "info",
    event_type: eventType,
    metadata: {
      approval_status: params.listing.approvalStatus,
      listing_id: params.listing.id,
      listing_status: params.listing.listingStatus,
      listing_title: params.listing.listingTitle,
      note: "Super Admin marketplace approval runtime. Approval status only. No install, payment, or store mutation.",
      source: "super_admin_marketplace_approval_runtime",
      template_id: params.listing.templateId,
      ...(params.metadata ?? {})
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

async function updateListingApproval(
  listing: MarketplaceListingRecord,
  approvalStatus: MarketplaceApprovalStatus,
  metadataPatch: Record<string, unknown>
) {
  const admin = requireAdminClient();
  const { error } = await admin
    .from("template_marketplace_listings" as never)
    .update({
      approval_status: approvalStatus,
      metadata: {
        ...listing.metadata,
        ...metadataPatch
      }
    } as never)
    .eq("id" as never, listing.id as never)
    .select(listingSelect)
    .single();

  if (error) {
    throw new Error(`Marketplace listing approval status could not be updated: ${error.message}`);
  }

  const updated = await getMarketplaceListing(listing.id);

  if (!updated) {
    throw new Error("Updated marketplace listing could not be loaded.");
  }

  return updated;
}

export async function approveMarketplaceListing(listingId: string) {
  const access = await requireSuperAdmin();
  const listing = await getMarketplaceListing(listingId);

  if (!listing) {
    throw new Error("Marketplace listing was not found.");
  }

  if (listing.listingStatus === "archived") {
    throw new Error("Archived marketplace listings cannot be approved.");
  }

  const eligibility = await validateMarketplaceApprovalEligibility(listingId);

  if (!eligibility.canApprove) {
    throw new Error(eligibility.issues.join(" ") || "Marketplace listing is not eligible for approval.");
  }

  const approvedAt = new Date().toISOString();
  const updated = await updateListingApproval(listing, "approved", {
    approval_eligibility_warnings: eligibility.warnings,
    approved_at: approvedAt,
    approved_by: access.user.id,
    last_review_action: "approved",
    last_review_at: approvedAt,
    last_review_by: access.user.id
  });

  await recordApprovalAudit("template_marketplace_approval_approved", {
    listing: updated,
    metadata: {
      approved_at: approvedAt,
      listing_status: updated.listingStatus,
      note: "Approval does not auto-publish, install templates, or enable payments."
    },
    userId: access.user.id
  });

  return { eligibility, listing: updated };
}

export async function rejectMarketplaceListing(listingId: string, reason: string) {
  const access = await requireSuperAdmin();
  const listing = await getMarketplaceListing(listingId);

  if (!listing) {
    throw new Error("Marketplace listing was not found.");
  }

  if (listing.listingStatus === "archived") {
    throw new Error("Archived marketplace listings cannot be rejected.");
  }

  const rejectionReason = sanitizeReviewNote(reason, 2000);

  if (!rejectionReason) {
    throw new Error("A safe rejection reason is required.");
  }

  const unsafeReasonIssues = detectUnsafeText(rejectionReason, "Rejection reason");

  if (unsafeReasonIssues.length) {
    throw new Error(unsafeReasonIssues.join(" "));
  }

  const rejectedAt = new Date().toISOString();
  const updated = await updateListingApproval(listing, "rejected", {
    last_review_action: "rejected",
    last_review_at: rejectedAt,
    last_review_by: access.user.id,
    last_review_note: rejectionReason,
    rejection_reason: rejectionReason,
    rejected_at: rejectedAt,
    rejected_by: access.user.id
  });

  await recordApprovalAudit("template_marketplace_approval_rejected", {
    listing: updated,
    metadata: {
      rejected_at: rejectedAt,
      rejection_reason: rejectionReason
    },
    userId: access.user.id
  });

  return { listing: updated, rejectionReason };
}

export async function requestMarketplaceChanges(listingId: string, reason: string) {
  const access = await requireSuperAdmin();
  const listing = await getMarketplaceListing(listingId);

  if (!listing) {
    throw new Error("Marketplace listing was not found.");
  }

  if (listing.listingStatus === "archived") {
    throw new Error("Archived marketplace listings cannot be sent back for changes.");
  }

  const reviewNote = sanitizeReviewNote(reason, 2000);

  if (!reviewNote) {
    throw new Error("A safe review note is required when requesting changes.");
  }

  const unsafeReasonIssues = detectUnsafeText(reviewNote, "Review note");

  if (unsafeReasonIssues.length) {
    throw new Error(unsafeReasonIssues.join(" "));
  }

  const requestedAt = new Date().toISOString();
  const updated = await updateListingApproval(listing, "changes_requested", {
    changes_requested_at: requestedAt,
    changes_requested_by: access.user.id,
    last_review_action: "changes_requested",
    last_review_at: requestedAt,
    last_review_by: access.user.id,
    last_review_note: reviewNote,
    review_note: reviewNote
  });

  await recordApprovalAudit("template_marketplace_approval_changes_requested", {
    listing: updated,
    metadata: {
      changes_requested_at: requestedAt,
      review_note: reviewNote
    },
    userId: access.user.id
  });

  return { listing: updated, reviewNote };
}

export async function listPendingMarketplaceListings(): Promise<MarketplaceApprovalQueueItem[]> {
  await requireSuperAdmin();

  const listings = await listMarketplaceListings({
    approvalStatus: "pending_review",
    limit: 200
  });
  const templates = await listTemplates();
  const templateNameById = new Map(templates.map((template) => [template.id, template.name]));

  const queue: MarketplaceApprovalQueueItem[] = [];

  for (const listing of listings) {
    if (listing.listingStatus === "archived") continue;

    const pkg = await getTemplatePackage(listing.templateId);
    const packageReadiness = pkg?.readinessStatus ?? "missing";
    const metadata = safeRecord(listing.metadata);
    const publishedVersion = await getPublishedTemplateVersion(listing.templateId);

    queue.push({
      ...listing,
      lastReviewNote:
        coerceText(metadata.last_review_note ?? metadata.review_note, 2000) || null,
      packageReadiness,
      readinessLabel: readinessLabelFor(packageReadiness),
      rejectionReason: coerceText(metadata.rejection_reason, 2000) || null,
      templateName: templateNameById.get(listing.templateId) ?? null,
      versionNumber: publishedVersion?.versionNumber ?? null
    });
  }

  return queue.sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}

export async function getMarketplaceApprovalStats(): Promise<MarketplaceApprovalStats> {
  const listings = await listMarketplaceListings({
    limit: 500
  });

  const reviewable = listings.filter((listing) => listing.listingStatus !== "archived");

  return {
    approvedListings: reviewable.filter((listing) => listing.approvalStatus === "approved").length,
    changesRequestedListings: reviewable.filter(
      (listing) => listing.approvalStatus === "changes_requested"
    ).length,
    pendingReviewListings: reviewable.filter(
      (listing) => listing.approvalStatus === "pending_review"
    ).length,
    rejectedListings: reviewable.filter((listing) => listing.approvalStatus === "rejected").length,
    totalReviewableListings: reviewable.length
  };
}
