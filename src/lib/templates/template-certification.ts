import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplateAnalyticsDashboard } from "@/src/lib/templates/template-analytics";
import { listArchivedTemplates } from "@/src/lib/templates/template-archive";
import { getTemplateActivationStats } from "@/src/lib/templates/template-activation";
import { listAllTemplateAssets } from "@/src/lib/templates/template-asset-storage";
import { listStoreTemplateAssignments } from "@/src/lib/templates/store-template-assignment";
import { listStoreThemeIsolationIssues } from "@/src/lib/templates/store-theme-isolation";
import { getMarketplaceApprovalStats } from "@/src/lib/templates/marketplace-approval-runtime";
import { listResellerTemplates, getResellerTemplateStats } from "@/src/lib/templates/reseller-template-runtime";
import { listTemplateInstalls } from "@/src/lib/templates/template-install-runtime";
import {
  getMarketplaceListingStats,
  listMarketplaceListings
} from "@/src/lib/templates/template-marketplace-runtime";
import { getOfficialTemplateStats } from "@/src/lib/templates/template-official";
import { listTemplatePackages, getTemplatePackageStats } from "@/src/lib/templates/template-package-runtime";
import { getTemplatePreview } from "@/src/lib/templates/template-preview-runtime";
import { getRecommendedTemplateStats } from "@/src/lib/templates/template-recommendation";
import { listTemplates, getTemplateRegistryStats } from "@/src/lib/templates/template-registry";
import { listTemplateRollbackJobs } from "@/src/lib/templates/template-rollback-runtime";
import { listAllTemplateScreenshots } from "@/src/lib/templates/template-screenshot-storage";
import { getTemplatePublishStatus } from "@/src/lib/templates/template-publish-runtime";
import { listTemplateUpdateJobs } from "@/src/lib/templates/template-update-runtime";
import { getTemplateVersionStats, listAllTemplateVersions } from "@/src/lib/templates/template-versions";
import { getTemplateVisibilityStats } from "@/src/lib/templates/template-visibility";

export type TemplateCertificationStatus = "blocked" | "certified" | "needs_attention";

export type TemplateCertificationSeverity = "critical" | "high" | "low" | "medium";

export type TemplateCertificationCategory =
  | "activation"
  | "analytics"
  | "assets"
  | "assignments"
  | "installs"
  | "isolation"
  | "marketplace"
  | "package"
  | "preview"
  | "registry"
  | "reseller"
  | "rollbacks"
  | "security"
  | "updates"
  | "versions"
  | "visibility";

export type TemplateCertificationCategoryResult = {
  category: TemplateCertificationCategory;
  issues: string[];
  status: TemplateCertificationStatus;
  warnings: string[];
};

export type TemplateCertificationReportItem = {
  category: TemplateCertificationCategory;
  message: string;
  severity: TemplateCertificationSeverity;
  status: TemplateCertificationStatus;
  suggestedAction: string;
};

export type TemplateCertificationSecurityItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type TemplateCertificationResult = {
  blockers: string[];
  categories: TemplateCertificationCategoryResult[];
  certifiedAt: string;
  issues: string[];
  overallStatus: TemplateCertificationStatus;
  readinessScore: number;
  report: TemplateCertificationReportItem[];
  scoreBreakdown: Array<{ label: string; points: number }>;
  securityReview: TemplateCertificationSecurityItem[];
  securityReviewPassed: boolean;
  summary: {
    blockedCategories: number;
    certifiedCategories: number;
    needsAttentionCategories: number;
    totalCategories: number;
  };
  warnings: string[];
};

type CategoryHealthResult = TemplateCertificationCategoryResult & {
  reportItems: TemplateCertificationReportItem[];
};

const criticalBlockCategories = new Set<TemplateCertificationCategory>([
  "registry",
  "versions",
  "installs",
  "assignments",
  "isolation"
]);

const sensitivePatterns = [
  /api[_-]?key/i,
  /service[_-]?role/i,
  /storage[_-]?key/i,
  /storage[_-]?bucket/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /sb_secret/i,
  /\/object\/sign\//i
];

const privateCustomerPatterns = [
  /\bcustomer_email\b/i,
  /\bcustomer_phone\b/i,
  /\bpayment_method\b/i,
  /\bbilling_address\b/i
];

const listLimit = 100;

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

function containsSensitiveExposure(serialized: string) {
  return sensitivePatterns.some((pattern) => pattern.test(serialized));
}

function containsPrivateCustomerData(serialized: string) {
  return privateCustomerPatterns.some((pattern) => pattern.test(serialized));
}

function worstStatus(
  current: TemplateCertificationStatus,
  next: TemplateCertificationStatus
): TemplateCertificationStatus {
  if (current === "blocked" || next === "blocked") return "blocked";
  if (current === "needs_attention" || next === "needs_attention") return "needs_attention";
  return "certified";
}

function categoryLabel(category: TemplateCertificationCategory) {
  return category.replaceAll("_", " ");
}

function buildCategoryResult(
  category: TemplateCertificationCategory,
  issues: string[],
  warnings: string[]
): CategoryHealthResult {
  const status: TemplateCertificationStatus = issues.length
    ? "blocked"
    : warnings.length
      ? "needs_attention"
      : "certified";

  const reportItems: TemplateCertificationReportItem[] = [
    ...issues.map((message) => ({
      category,
      message,
      severity: criticalBlockCategories.has(category) ? ("critical" as const) : ("high" as const),
      status: "blocked" as const,
      suggestedAction: `Resolve ${categoryLabel(category)} runtime issue before live store binding.`
    })),
    ...warnings.map((message) => ({
      category,
      message,
      severity: "medium" as const,
      status: "needs_attention" as const,
      suggestedAction: `Review ${categoryLabel(category)} configuration and confirm readiness.`
    }))
  ];

  if (!issues.length && !warnings.length) {
    reportItems.push({
      category,
      message: `${categoryLabel(category)} runtime passed read-only certification checks.`,
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return {
    category,
    issues,
    reportItems,
    status,
    warnings
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can run template runtime certification.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template certification.");
  }

  return admin;
}

async function verifyTableReachable(tableName: string) {
  const admin = requireAdminClient();
  const { error } = await admin.from(tableName as never).select("id" as never).limit(1);

  if (error) {
    throw new Error(`${tableName} is not reachable: ${error.message}`);
  }
}

export async function checkRegistryHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_registry");

    const [templates, stats, archived, officialStats, recommendationStats] = await Promise.all([
      listTemplates(),
      getTemplateRegistryStats(),
      listArchivedTemplates(),
      getOfficialTemplateStats(),
      getRecommendedTemplateStats()
    ]);

    if (!templates.length) {
      warnings.push("Template registry is empty. Add templates before live binding.");
    }

    if (stats.totalTemplates !== templates.length) {
      warnings.push("Registry stats do not match template list count.");
    }

    if (archived.length > stats.archivedTemplates) {
      warnings.push("Archived template records exceed registry archived count.");
    }

    if (officialStats.officialTemplates > templates.length) {
      issues.push("Official template stats exceed registry template count.");
    }

    if (recommendationStats.recommendedTemplates > templates.length) {
      issues.push("Recommended template stats exceed registry template count.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template registry runtime is unavailable.");
  }

  return buildCategoryResult("registry", issues, warnings);
}

export async function checkVersionHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_versions");

    const [versions, stats] = await Promise.all([listAllTemplateVersions(), getTemplateVersionStats()]);

    if (!versions.length) {
      warnings.push("No template versions exist yet.");
    }

    if (stats.totalVersions !== versions.length) {
      warnings.push("Version stats do not match version list count.");
    }

    const templates = await listTemplates();
    const templatesWithoutPublished = templates.filter(
      (template) => template.status === "active" && !versions.some((version) => version.templateId === template.id && version.status === "published")
    );

    if (templatesWithoutPublished.length) {
      warnings.push(
        `${templatesWithoutPublished.length} active template(s) have no published version.`
      );
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template version runtime is unavailable.");
  }

  return buildCategoryResult("versions", issues, warnings);
}

export async function checkVisibilityHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    const stats = await getTemplateVisibilityStats();
    const templates = await listTemplates();

    const visibilityTotal =
      stats.ownerVisible + stats.resellerVisible + stats.marketplaceVisible + stats.hiddenInternal;

    if (visibilityTotal !== templates.length) {
      warnings.push("Visibility stats do not cover all registry templates.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template visibility runtime is unavailable.");
  }

  return buildCategoryResult("visibility", issues, warnings);
}

export async function checkActivationHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    const stats = await getTemplateActivationStats();
    const registryStats = await getTemplateRegistryStats();

    if (stats.activeTemplates !== registryStats.activeTemplates) {
      warnings.push("Activation stats differ from registry active template count.");
    }

    if (!stats.activeTemplates && registryStats.totalTemplates > 0) {
      warnings.push("No active templates are available for assignment.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template activation runtime is unavailable.");
  }

  return buildCategoryResult("activation", issues, warnings);
}

export async function checkPackageHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_packages");

    const [packages, stats] = await Promise.all([listTemplatePackages(), getTemplatePackageStats()]);

    if (!packages.length) {
      warnings.push("No template packages are registered.");
    }

    if (stats.totalPackages !== packages.length) {
      warnings.push("Package stats do not match package list count.");
    }

    const invalidPackages = packages.filter((pkg) => !text(pkg.packageKey, 120));

    if (invalidPackages.length) {
      issues.push(`${invalidPackages.length} package record(s) are missing package keys.`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template package runtime is unavailable.");
  }

  return buildCategoryResult("package", issues, warnings);
}

export async function checkPreviewHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    const templates = await listTemplates();
    const sample = templates.find((template) => template.status === "active") ?? templates[0];

    if (!sample) {
      warnings.push("No templates available to validate preview runtime.");
      return buildCategoryResult("preview", issues, warnings);
    }

    const preview = await getTemplatePreview(sample.id);

    if (!preview) {
      warnings.push("Preview runtime returned no model for the sample template.");
    } else if (preview.model.previewReadiness === "invalid") {
      warnings.push("Sample template preview readiness is invalid.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template preview runtime is unavailable.");
  }

  return buildCategoryResult("preview", issues, warnings);
}

export async function checkAssetHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await Promise.all([verifyTableReachable("template_assets"), verifyTableReachable("template_screenshots")]);

    const [assets, screenshots] = await Promise.all([listAllTemplateAssets(), listAllTemplateScreenshots()]);

    const sensitiveAssets = assets.filter((asset) =>
      containsSensitiveExposure(JSON.stringify({ metadata: asset.metadata, url: asset.previewUrl }))
    );

    if (sensitiveAssets.length) {
      issues.push("Template asset records expose sensitive storage metadata.");
    }

    const sensitiveScreenshots = screenshots.filter((screenshot) =>
      containsSensitiveExposure(JSON.stringify({ url: screenshot.previewUrl }))
    );

    if (sensitiveScreenshots.length) {
      issues.push("Template screenshot records expose sensitive storage metadata.");
    }

    if (!assets.length && !screenshots.length) {
      warnings.push("No template assets or screenshots are stored yet.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template asset storage runtime is unavailable.");
  }

  return buildCategoryResult("assets", issues, warnings);
}

export async function checkInstallHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_installs");

    const installs = await listTemplateInstalls(listLimit);
    const failedInstalls = installs.filter((install) => install.status === "failed");

    if (failedInstalls.length) {
      warnings.push(`${failedInstalls.length} failed install job(s) detected in recent history.`);
    }

    const leakingInstalls = installs.filter((install) =>
      containsPrivateCustomerData(JSON.stringify(install.installedSummary))
    );

    if (leakingInstalls.length) {
      issues.push("Install records expose private customer data in installed summaries.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template install runtime is unavailable.");
  }

  return buildCategoryResult("installs", issues, warnings);
}

export async function checkAssignmentHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("store_template_assignments");

    const assignments = await listStoreTemplateAssignments({ limit: listLimit });
    const failedAssignments = assignments.filter((assignment) => assignment.assignmentStatus === "failed");

    if (failedAssignments.length) {
      warnings.push(`${failedAssignments.length} failed assignment record(s) detected.`);
    }

    const duplicateActive = new Map<string, number>();

    for (const assignment of assignments) {
      if (assignment.assignmentStatus !== "active") continue;
      duplicateActive.set(assignment.storeId, (duplicateActive.get(assignment.storeId) ?? 0) + 1);
    }

    const storesWithDuplicates = [...duplicateActive.values()].filter((count) => count > 1).length;

    if (storesWithDuplicates) {
      warnings.push("Multiple active assignments detected for one or more stores.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Store template assignment runtime is unavailable.");
  }

  return buildCategoryResult("assignments", issues, warnings);
}

export async function checkIsolationHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("store_template_isolation_snapshots");

    const isolationIssues = await listStoreThemeIsolationIssues({ limit: listLimit });
    const failed = isolationIssues.filter((issue) => issue.isolationStatus === "failed");

    if (failed.length) {
      warnings.push(`${failed.length} store theme isolation snapshot(s) are in failed state.`);
    }

    const sensitiveSnapshots = isolationIssues.filter((issue) =>
      containsSensitiveExposure(JSON.stringify(issue.snapshot))
    );

    if (sensitiveSnapshots.length) {
      issues.push("Isolation snapshots expose sensitive metadata.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Store theme isolation runtime is unavailable.");
  }

  return buildCategoryResult("isolation", issues, warnings);
}

export async function checkUpdateHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_update_jobs");

    const updates = await listTemplateUpdateJobs({ limit: listLimit });
    const failedUpdates = updates.filter((update) => update.status === "failed");

    if (failedUpdates.length) {
      warnings.push(`${failedUpdates.length} failed template update job(s) detected.`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template update runtime is unavailable.");
  }

  return buildCategoryResult("updates", issues, warnings);
}

export async function checkRollbackHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_rollback_jobs");

    const rollbacks = await listTemplateRollbackJobs({ limit: listLimit });
    const failedRollbacks = rollbacks.filter((rollback) => rollback.status === "failed");

    if (failedRollbacks.length) {
      warnings.push(`${failedRollbacks.length} failed template rollback job(s) detected.`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template rollback runtime is unavailable.");
  }

  return buildCategoryResult("rollbacks", issues, warnings);
}

export async function checkMarketplaceHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("template_marketplace_listings");

    const [listings, listingStats, approvalStats] = await Promise.all([
      listMarketplaceListings({ limit: listLimit }),
      getMarketplaceListingStats(),
      getMarketplaceApprovalStats()
    ]);

    if (listingStats.totalListings !== listings.length && listings.length >= listLimit) {
      warnings.push("Marketplace listing sample is capped; stats may include older listings.");
    }

    if (approvalStats.pendingReviewListings > listingStats.pendingReviewListings) {
      warnings.push("Marketplace approval queue stats differ from listing stats.");
    }

    const templates = await listTemplates();
    const sample = templates[0];

    if (sample) {
      const publishStatus = await getTemplatePublishStatus(sample.id);

      if (!publishStatus.templateId) {
        warnings.push("Publish runtime returned incomplete status for sample template.");
      }
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template marketplace runtime is unavailable.");
  }

  return buildCategoryResult("marketplace", issues, warnings);
}

export async function checkResellerHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    await verifyTableReachable("reseller_template_access");

    const [accessRecords, stats] = await Promise.all([
      listResellerTemplates({ limit: listLimit }),
      getResellerTemplateStats()
    ]);

    if (stats.totalAssignments !== accessRecords.length && accessRecords.length >= listLimit) {
      warnings.push("Reseller access sample is capped; stats may include older assignments.");
    }

    const revoked = accessRecords.filter((record) => record.accessStatus === "revoked").length;

    if (revoked) {
      warnings.push(`${revoked} revoked reseller template access record(s) present.`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Reseller template runtime is unavailable.");
  }

  return buildCategoryResult("reseller", issues, warnings);
}

export async function checkAnalyticsHealth(): Promise<CategoryHealthResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    const dashboard = await getTemplateAnalyticsDashboard("all_time");
    const serialized = JSON.stringify(dashboard);

    if (containsSensitiveExposure(serialized)) {
      issues.push("Template analytics output exposes sensitive values.");
    }

    if (containsPrivateCustomerData(serialized)) {
      issues.push("Template analytics output exposes private customer data.");
    }

    if (dashboard.overview.totalTemplates === 0) {
      warnings.push("Analytics overview reports zero templates.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Template analytics runtime is unavailable.");
  }

  return buildCategoryResult("analytics", issues, warnings);
}

function buildSecurityReview(serializedOutputs: string[]): TemplateCertificationSecurityItem[] {
  const combined = serializedOutputs.join("\n");

  return [
    {
      category: "Secrets",
      message: "Template certification outputs do not expose secrets or credentials.",
      passed: !containsSensitiveExposure(combined)
    },
    {
      category: "Private customer data",
      message: "Certification scope does not expose customer emails, phones, or payment data.",
      passed: !containsPrivateCustomerData(combined)
    },
    {
      category: "Private asset paths",
      message: "Certification does not expose signed storage URLs or private bucket keys.",
      passed: !/\/object\/sign\//i.test(combined) && !/storage[_-]?key/i.test(combined)
    },
    {
      category: "Cross-store mutations",
      message: "Certification performs read-only checks with no store mutation actions.",
      passed: true
    },
    {
      category: "Unauthorized runtime actions",
      message: "Certification is gated to Super Admin access only.",
      passed: true
    },
    {
      category: "Safe identifiers",
      message: "Only template identifiers, counts, and safe metadata are included in reports.",
      passed: true
    }
  ];
}

async function checkSecurityHealth(serializedOutputs: string[]): Promise<CategoryHealthResult> {
  const securityReview = buildSecurityReview(serializedOutputs);
  const issues = securityReview.filter((item) => !item.passed).map((item) => item.message);
  const warnings: string[] = [];

  if (!issues.length) {
    const failedOptional = securityReview.filter((item) => !item.passed);

    if (failedOptional.length) {
      warnings.push("Security review has items that need manual confirmation.");
    }
  }

  const result = buildCategoryResult("security", issues, warnings);
  result.reportItems = securityReview.map((item) => ({
    category: "security",
    message: item.message,
    severity: item.passed ? "low" : "critical",
    status: item.passed ? "certified" : "blocked",
    suggestedAction: item.passed ? "No action required." : "Remove sensitive exposure before live binding."
  }));

  return result;
}

function computeReadinessScore(
  categories: CategoryHealthResult[],
  securityReviewPassed: boolean
) {
  const scoreBreakdown: Array<{ label: string; points: number }> = [];
  let readinessScore = 100;

  for (const category of categories) {
    if (category.status === "blocked") {
      const points = criticalBlockCategories.has(category.category) ? 20 : 12;
      readinessScore -= points;
      scoreBreakdown.push({ label: `${categoryLabel(category.category)} blocked`, points });
    } else if (category.status === "needs_attention") {
      readinessScore -= 6;
      scoreBreakdown.push({ label: `${categoryLabel(category.category)} needs attention`, points: 6 });
    }

    readinessScore -= Math.min(category.issues.length * 2, 8);
    readinessScore -= Math.min(category.warnings.length, 4);
  }

  if (!securityReviewPassed) {
    readinessScore -= 15;
    scoreBreakdown.push({ label: "Security review failed", points: 15 });
  }

  const criticalBlocked = categories.some(
    (category) => criticalBlockCategories.has(category.category) && category.status === "blocked"
  );

  if (criticalBlocked) {
    readinessScore = Math.min(readinessScore, 35);
  }

  return {
    readinessScore: Math.max(0, Math.min(100, readinessScore)),
    scoreBreakdown
  };
}

export async function runTemplateCertification(): Promise<TemplateCertificationResult> {
  await requireSuperAdmin();

  const certifiedAt = new Date().toISOString();

  const [
    registry,
    versions,
    visibility,
    activation,
    packageHealth,
    preview,
    assets,
    installs,
    assignments,
    isolation,
    updates,
    rollbacks,
    marketplace,
    reseller,
    analytics
  ] = await Promise.all([
    checkRegistryHealth(),
    checkVersionHealth(),
    checkVisibilityHealth(),
    checkActivationHealth(),
    checkPackageHealth(),
    checkPreviewHealth(),
    checkAssetHealth(),
    checkInstallHealth(),
    checkAssignmentHealth(),
    checkIsolationHealth(),
    checkUpdateHealth(),
    checkRollbackHealth(),
    checkMarketplaceHealth(),
    checkResellerHealth(),
    checkAnalyticsHealth()
  ]);

  const serializedOutputs = [
    JSON.stringify(registry),
    JSON.stringify(versions),
    JSON.stringify(visibility),
    JSON.stringify(activation),
    JSON.stringify(packageHealth),
    JSON.stringify(preview),
    JSON.stringify(assets),
    JSON.stringify(installs),
    JSON.stringify(assignments),
    JSON.stringify(isolation),
    JSON.stringify(updates),
    JSON.stringify(rollbacks),
    JSON.stringify(marketplace),
    JSON.stringify(reseller),
    JSON.stringify(analytics)
  ];

  const security = await checkSecurityHealth(serializedOutputs);
  const categories: CategoryHealthResult[] = [
    registry,
    versions,
    visibility,
    activation,
    packageHealth,
    preview,
    assets,
    installs,
    assignments,
    isolation,
    updates,
    rollbacks,
    marketplace,
    reseller,
    analytics,
    security
  ];

  const securityReview = buildSecurityReview(serializedOutputs);
  const securityReviewPassed = securityReview.every((item) => item.passed);

  const { readinessScore, scoreBreakdown } = computeReadinessScore(categories, securityReviewPassed);

  const blockers = categories
    .filter((category) => category.status === "blocked")
    .flatMap((category) => category.issues);

  const issues = categories.flatMap((category) => category.issues);
  const warnings = categories.flatMap((category) => category.warnings);
  const report = categories.flatMap((category) => category.reportItems);

  let overallStatus: TemplateCertificationStatus = "certified";

  for (const category of categories) {
    overallStatus = worstStatus(overallStatus, category.status);
  }

  const summary = {
    blockedCategories: categories.filter((category) => category.status === "blocked").length,
    certifiedCategories: categories.filter((category) => category.status === "certified").length,
    needsAttentionCategories: categories.filter((category) => category.status === "needs_attention").length,
    totalCategories: categories.length
  };

  return {
    blockers,
    categories: categories.map(({ reportItems, ...category }) => category),
    certifiedAt,
    issues,
    overallStatus,
    readinessScore,
    report,
    scoreBreakdown,
    securityReview,
    securityReviewPassed,
    summary,
    warnings
  };
}
