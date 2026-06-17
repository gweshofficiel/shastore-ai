import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplatePreviewModel } from "@/src/lib/templates/template-preview-runtime";
import { listTemplates, type TemplateRegistryRecord } from "@/src/lib/templates/template-registry";
import {
  getTemplatePackage,
  validateTemplatePackage,
  type TemplatePackageReadinessStatus
} from "@/src/lib/templates/template-package-runtime";
import { listMarketplaceListings } from "@/src/lib/templates/template-marketplace-runtime";
import { listPublishedTemplateScreenshots } from "@/src/lib/templates/template-screenshot-storage";
import {
  getPublishedTemplateVersion,
  getTemplateVersionById,
  listTemplateVersions,
  type TemplateVersionRecord
} from "@/src/lib/templates/template-versions";

export type TemplatePublishReadiness = {
  canPublish: boolean;
  hasPreview: boolean;
  hasScreenshots: boolean;
  issues: string[];
  packageReadiness: TemplatePackageReadinessStatus | "missing";
  securityIssues: string[];
  templateId: string | null;
  templateName: string | null;
  versionId: string;
  versionNumber: string | null;
  warnings: string[];
};

export type TemplatePublishStatus = {
  currentPublishedVersion: TemplateVersionRecord | null;
  draftVersions: TemplateVersionRecord[];
  lastPublishedAt: string | null;
  publishReadiness: TemplatePublishReadiness[];
  templateId: string;
  templateName: string;
  templateStatus: string;
};

export type TemplatePublishEvent = {
  createdAt: string | null;
  entityId: string | null;
  eventStatus: string;
  eventType: string;
  metadata: Record<string, unknown>;
  templateId: string | null;
  templateName: string | null;
  userId: string | null;
  versionId: string | null;
  versionNumber: string | null;
};

export type TemplatePublishEventFilters = {
  limit?: number;
  templateId?: string;
  versionId?: string;
};

const publishEventTypes = [
  "template_update_published",
  "template_version_published",
  "template_version_unpublished"
] as const;

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

function parseCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
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

  return issues;
}

function hasPackageSnapshot(snapshot: Record<string, unknown>) {
  return Object.keys(snapshot).length > 0;
}

function packageSummaryFromSnapshot(
  snapshot: Record<string, unknown>,
  fallback: TemplateRegistryRecord["packageSummary"]
) {
  return {
    aiVisualSupport:
      snapshot.aiVisualSupport === true ||
      snapshot.ai_support_enabled === true ||
      fallback.aiVisualSupport,
    blogCount: parseCount(snapshot.blogCount ?? snapshot.blog_posts_count) || fallback.blogCount,
    categoriesCount:
      parseCount(snapshot.categoriesCount ?? snapshot.categories_count) || fallback.categoriesCount,
    domainEmailReadiness:
      text(snapshot.domainEmailReadiness, 40) === "ready" ||
      snapshot.domain_ready === true ||
      fallback.domainEmailReadiness === "ready"
        ? ("ready" as const)
        : ("placeholder" as const),
    faqCount: parseCount(snapshot.faqCount ?? snapshot.faq_count) || fallback.faqCount,
    pagesCount: parseCount(snapshot.pagesCount ?? snapshot.pages_count) || fallback.pagesCount,
    productsCount: parseCount(snapshot.productsCount ?? snapshot.products_count) || fallback.productsCount
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template publish runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template publish runtime.");
  }

  return admin;
}

async function findRegistryTemplate(templateId: string) {
  return (await listTemplates()).find((template) => template.id === text(templateId, 120)) ?? null;
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

async function validateMarketplaceSecurity(templateId: string, issues: string[]) {
  const listings = await listMarketplaceListings({
    limit: 50,
    templateId
  });

  const activeListings = listings.filter((listing) => listing.listingStatus !== "archived");
  const rejected = activeListings.filter((listing) => listing.approvalStatus === "rejected");

  if (rejected.length) {
    issues.push("Rejected marketplace listings must be resolved before publishing this template version.");
  }
}

async function recordPublishEvent(
  eventType: (typeof publishEventTypes)[number],
  params: {
    metadata?: Record<string, unknown>;
    templateId: string;
    userId: string;
    version: TemplateVersionRecord;
  }
) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.version.id,
    entity_type: "admin_template_publish",
    event_status: "info",
    event_type: eventType,
    metadata: {
      note: "Super Admin template publish runtime. Catalog metadata only. No store update, install, or payment.",
      source: "super_admin_template_publish_runtime",
      template_id: params.templateId,
      version_id: params.version.id,
      version_number: params.version.versionNumber,
      ...(params.metadata ?? {})
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function validateTemplateVersionPublish(versionId: string): Promise<TemplatePublishReadiness> {
  await requireSuperAdmin();

  const issues: string[] = [];
  const warnings: string[] = [];
  const securityIssues: string[] = [];
  const version = await getTemplateVersionById(versionId);

  if (!version) {
    return {
      canPublish: false,
      hasPreview: false,
      hasScreenshots: false,
      issues: ["Template version was not found."],
      packageReadiness: "missing",
      securityIssues: [],
      templateId: null,
      templateName: null,
      versionId: text(versionId, 120),
      versionNumber: null,
      warnings: []
    };
  }

  if (version.status === "published") {
    issues.push("Template version is already published.");
  }

  if (version.status === "archived") {
    issues.push("Archived template versions cannot be published.");
  }

  if (!hasPackageSnapshot(version.packageSnapshot)) {
    issues.push("Package snapshot is required before publishing this template version.");
  }

  if (version.changelog) {
    securityIssues.push(...detectUnsafeText(version.changelog, "Version changelog"));
  }

  const template = await findRegistryTemplate(version.templateId);

  if (!template) {
    issues.push("Template registry record was not found.");
  } else if (template.status === "archived") {
    issues.push("Archived templates cannot publish new versions.");
  } else if (!["active", "draft"].includes(template.status)) {
    issues.push(`Template status must be active or draft (current: ${template.status}).`);
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

    const previewAvailability = await validatePreviewAvailability(template.id);
    const hasPreview = previewAvailability.hasPreview;
    const hasScreenshots = previewAvailability.hasScreenshots;

    if (!hasPreview) {
      issues.push("Published screenshots or a safe preview must be available before publishing.");
    } else if (!hasScreenshots) {
      warnings.push("No published screenshots found; publish uses generated preview placeholders.");
    }

    await validateMarketplaceSecurity(template.id, issues);

    return {
      canPublish: issues.length === 0 && securityIssues.length === 0,
      hasPreview,
      hasScreenshots,
      issues: [...issues, ...securityIssues],
      packageReadiness,
      securityIssues,
      templateId: template.id,
      templateName: template.name,
      versionId: version.id,
      versionNumber: version.versionNumber,
      warnings
    };
  }

  for (const issue of securityIssues) {
    if (!issues.includes(issue)) issues.push(issue);
  }

  return {
    canPublish: issues.length === 0,
    hasPreview: false,
    hasScreenshots: false,
    issues,
    packageReadiness,
    securityIssues,
    templateId: version.templateId,
    templateName: null,
    versionId: version.id,
    versionNumber: version.versionNumber,
    warnings
  };
}

async function demoteOtherPublishedVersions(templateId: string, versionId: string) {
  const admin = requireAdminClient();

  const { error } = await admin
    .from("template_versions" as never)
    .update({ status: "draft" } as never)
    .eq("template_id" as never, templateId as never)
    .eq("status" as never, "published" as never)
    .neq("id" as never, versionId as never);

  if (error) {
    throw new Error(`Previously published template versions could not be demoted: ${error.message}`);
  }
}

async function syncRegistryFromPublishedVersion(
  template: TemplateRegistryRecord,
  version: TemplateVersionRecord
) {
  const admin = requireAdminClient();
  const packageSummary = packageSummaryFromSnapshot(version.packageSnapshot, template.packageSummary);
  const nextStatus = template.status === "draft" ? "active" : template.status;

  const { error } = await admin
    .from("template_registry" as never)
    .update({
      package_summary: packageSummary,
      status: nextStatus,
      version: version.versionNumber
    } as never)
    .eq("id" as never, template.id as never);

  if (error) {
    throw new Error(`Template registry metadata could not be updated for publish: ${error.message}`);
  }

  const pkg = await getTemplatePackage(template.id);

  if (pkg) {
    const { error: packageError } = await admin
      .from("template_packages" as never)
      .update({
        package_summary: packageSummary,
        version_id: version.id
      } as never)
      .eq("id" as never, pkg.id as never);

    if (packageError) {
      throw new Error(`Template package version reference could not be updated: ${packageError.message}`);
    }
  }
}

export async function publishTemplateVersion(versionId: string) {
  const access = await requireSuperAdmin();
  const readiness = await validateTemplateVersionPublish(versionId);

  if (!readiness.canPublish) {
    throw new Error(readiness.issues.join(" ") || "Template version is not eligible for publish.");
  }

  const version = await getTemplateVersionById(versionId);

  if (!version) {
    throw new Error("Template version was not found.");
  }

  const template = await findRegistryTemplate(version.templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const publishedAt = new Date().toISOString();
  const admin = requireAdminClient();

  await demoteOtherPublishedVersions(version.templateId, version.id);

  const { error } = await admin
    .from("template_versions" as never)
    .update({
      published_at: publishedAt,
      status: "published"
    } as never)
    .eq("id" as never, version.id as never);

  if (error) {
    throw new Error(`Template version could not be published: ${error.message}`);
  }

  const publishedVersion = await getTemplateVersionById(version.id);

  if (!publishedVersion) {
    throw new Error("Published template version could not be loaded.");
  }

  await syncRegistryFromPublishedVersion(template, publishedVersion);

  await recordPublishEvent("template_version_published", {
    metadata: {
      demoted_previous_published: true,
      published_at: publishedAt,
      readiness_warnings: readiness.warnings
    },
    templateId: template.id,
    userId: access.user.id,
    version: publishedVersion
  });

  return { publishedVersion, readiness, template };
}

export async function publishTemplateUpdate(templateId: string, versionId: string) {
  const access = await requireSuperAdmin();
  const cleanedTemplateId = text(templateId, 120);
  const version = await getTemplateVersionById(versionId);

  if (!version) {
    throw new Error("Template version was not found.");
  }

  if (version.templateId !== cleanedTemplateId) {
    throw new Error("Template version does not belong to the selected template.");
  }

  const currentPublished = await getPublishedTemplateVersion(cleanedTemplateId);
  const result = await publishTemplateVersion(versionId);

  await recordPublishEvent("template_update_published", {
    metadata: {
      previous_published_version_id: currentPublished?.id ?? null,
      previous_published_version_number: currentPublished?.versionNumber ?? null,
      published_at: result.publishedVersion.publishedAt
    },
    templateId: cleanedTemplateId,
    userId: access.user.id,
    version: result.publishedVersion
  });

  return result;
}

export async function unpublishTemplateVersion(versionId: string) {
  const access = await requireSuperAdmin();
  const version = await getTemplateVersionById(versionId);

  if (!version) {
    throw new Error("Template version was not found.");
  }

  if (version.status !== "published") {
    throw new Error(`Only published template versions can be unpublished (current: ${version.status}).`);
  }

  const template = await findRegistryTemplate(version.templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  const publishedVersions = (await listTemplateVersions(version.templateId)).filter(
    (entry) => entry.status === "published"
  );
  const otherPublished = publishedVersions.filter((entry) => entry.id !== version.id);
  const admin = requireAdminClient();

  if (!otherPublished.length) {
    const { error: registryError } = await admin
      .from("template_registry" as never)
      .update({ status: "draft" } as never)
      .eq("id" as never, template.id as never);

    if (registryError) {
      throw new Error(`Template registry could not be moved to draft safely: ${registryError.message}`);
    }
  }

  const { error } = await admin
    .from("template_versions" as never)
    .update({ status: "draft" } as never)
    .eq("id" as never, version.id as never);

  if (error) {
    throw new Error(`Template version could not be unpublished: ${error.message}`);
  }

  const unpublishedVersion = await getTemplateVersionById(version.id);

  if (!unpublishedVersion) {
    throw new Error("Unpublished template version could not be loaded.");
  }

  await recordPublishEvent("template_version_unpublished", {
    metadata: {
      moved_template_to_draft: otherPublished.length === 0,
      other_published_version_count: otherPublished.length,
      preserved_published_at: version.publishedAt
    },
    templateId: template.id,
    userId: access.user.id,
    version: unpublishedVersion
  });

  return {
    movedTemplateToDraft: otherPublished.length === 0,
    template,
    version: unpublishedVersion
  };
}

export async function getTemplatePublishStatus(templateId: string): Promise<TemplatePublishStatus> {
  await requireSuperAdmin();

  const cleanedTemplateId = text(templateId, 120);
  const template = await findRegistryTemplate(cleanedTemplateId);
  const versions = await listTemplateVersions(cleanedTemplateId);
  const currentPublishedVersion =
    versions.find((version) => version.status === "published") ??
    (await getPublishedTemplateVersion(cleanedTemplateId));
  const draftVersions = versions.filter((version) => version.status === "draft");
  const publishReadiness = await Promise.all(
    draftVersions.map((version) => validateTemplateVersionPublish(version.id))
  );

  return {
    currentPublishedVersion: currentPublishedVersion ?? null,
    draftVersions,
    lastPublishedAt: currentPublishedVersion?.publishedAt ?? null,
    publishReadiness,
    templateId: cleanedTemplateId,
    templateName: template?.name ?? "Template",
    templateStatus: template?.status ?? "unknown"
  };
}

export async function listTemplatePublishEvents(
  filters: TemplatePublishEventFilters = {}
): Promise<TemplatePublishEvent[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  let query = admin
    .from("monitoring_events" as never)
    .select("event_type, event_status, entity_id, metadata, created_at, user_id")
    .eq("entity_type" as never, "admin_template_publish" as never)
    .in("event_type" as never, [...publishEventTypes] as never);

  if (filters.templateId) {
    query = query.contains("metadata" as never, { template_id: text(filters.templateId, 120) } as never);
  }

  if (filters.versionId) {
    query = query.contains("metadata" as never, { version_id: text(filters.versionId, 120) } as never);
  }

  const { data, error } = await query
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Template publish events could not be loaded: ${error.message}`);
  }

  const templates = await listTemplates();
  const templateNameById = new Map(templates.map((entry) => [entry.id, entry.name]));

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => {
      if (!isRecord(row)) return null;

      const metadata = safeRecord(row.metadata);
      const templateId = coerceText(metadata.template_id, 120) || null;
      const versionId = coerceText(metadata.version_id ?? row.entity_id, 120) || null;

      return {
        createdAt: coerceText(row.created_at, 80) || null,
        entityId: coerceText(row.entity_id, 120) || null,
        eventStatus: coerceText(row.event_status, 40) || "info",
        eventType: coerceText(row.event_type, 80),
        metadata,
        templateId,
        templateName: templateId ? templateNameById.get(templateId) ?? null : null,
        userId: coerceText(row.user_id, 120) || null,
        versionId,
        versionNumber: coerceText(metadata.version_number, 40) || null
      };
    })
    .filter((event): event is TemplatePublishEvent => Boolean(event?.eventType));
}
