import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplateAnalyticsDashboard } from "@/src/lib/templates/template-analytics";
import { listStoreTemplateAssignments } from "@/src/lib/templates/store-template-assignment";
import { listStoreThemeIsolationIssues } from "@/src/lib/templates/store-theme-isolation";
import { listLiveStoreRenderingDiagnostics } from "@/src/lib/templates/store-rendering-runtime";
import { getMarketplaceApprovalStats } from "@/src/lib/templates/marketplace-approval-runtime";
import { listResellerTemplates, getResellerTemplateStats } from "@/src/lib/templates/reseller-template-runtime";
import { listTemplateInstalls } from "@/src/lib/templates/template-install-runtime";
import {
  getMarketplaceListingStats,
  listMarketplaceListings
} from "@/src/lib/templates/template-marketplace-runtime";
import { listTemplatePackages, getTemplatePackageStats } from "@/src/lib/templates/template-package-runtime";
import { getTemplatePreview } from "@/src/lib/templates/template-preview-runtime";
import { listTemplates, getTemplateRegistryStats } from "@/src/lib/templates/template-registry";
import { listTemplateRollbackJobs } from "@/src/lib/templates/template-rollback-runtime";
import { listAllTemplateAssets } from "@/src/lib/templates/template-asset-storage";
import { listAllTemplateScreenshots } from "@/src/lib/templates/template-screenshot-storage";
import { listTemplateUpdateJobs } from "@/src/lib/templates/template-update-runtime";
import { getTemplateVersionStats, listAllTemplateVersions } from "@/src/lib/templates/template-versions";

export type TemplatesProductionStatus = "blocked" | "certified" | "needs_attention";

export type TemplatesProductionSeverity = "critical" | "high" | "low" | "medium";

export type TemplatesProductionCheck = {
  check: string;
  message: string;
  severity: TemplatesProductionSeverity;
  status: TemplatesProductionStatus;
  suggestedAction: string;
};

export type TemplatesProductionCertification = {
  assignmentStatus: TemplatesProductionStatus;
  certifiedAt: string;
  checks: TemplatesProductionCheck[];
  emptyStates: string[];
  installStatus: TemplatesProductionStatus;
  isolationStatus: TemplatesProductionStatus;
  liveRenderingStatus: TemplatesProductionStatus;
  marketplaceStatus: TemplatesProductionStatus;
  overallStatus: TemplatesProductionStatus;
  packageStatus: TemplatesProductionStatus;
  readinessScore: number;
  registryStatus: TemplatesProductionStatus;
  resellerStatus: TemplatesProductionStatus;
  scoreBreakdown: Array<{ label: string; points: number }>;
  securityStatus: TemplatesProductionStatus;
};

const listLimit = 100;

const criticalBlockChecks = new Set([
  "template_registry_missing",
  "published_version_missing",
  "package_runtime_broken",
  "install_runtime_broken",
  "assignment_runtime_broken",
  "isolation_runtime_broken",
  "live_rendering_binding_broken",
  "cross_store_mutation_risk",
  "private_asset_paths_exposed"
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

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view templates production certification.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for templates production certification.");
  }

  return admin;
}

function addCheck(checks: TemplatesProductionCheck[], check: TemplatesProductionCheck) {
  const key = `${check.check}-${check.message}`;

  if (!checks.some((item) => `${item.check}-${item.message}` === key)) {
    checks.push(check);
  }
}

function statusFromChecks(checks: TemplatesProductionCheck[], names: string[]): TemplatesProductionStatus {
  const scoped = checks.filter((check) => names.includes(check.check));

  if (scoped.some((check) => check.status === "blocked")) {
    return "blocked";
  }

  if (scoped.some((check) => check.status === "needs_attention")) {
    return "needs_attention";
  }

  return "certified";
}

async function verifyTableReachable(tableName: string) {
  const admin = requireAdminClient();
  const { error } = await admin.from(tableName as never).select("id" as never).limit(1);

  if (error) {
    throw new Error(`${tableName} is not reachable: ${error.message}`);
  }
}

export async function checkTemplateRegistry(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_registry");

    const [templates, stats] = await Promise.all([listTemplates(), getTemplateRegistryStats()]);

    if (!templates.length) {
      addCheck(checks, {
        check: "template_registry_missing",
        message: "Template registry has no templates.",
        severity: "critical",
        status: "blocked",
        suggestedAction: "Seed or create template registry records before production binding."
      });
    } else {
      addCheck(checks, {
        check: "template_registry_available",
        message: `${templates.length} template registry record(s) are available.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    if (stats.totalTemplates !== templates.length) {
      addCheck(checks, {
        check: "template_registry_stats",
        message: "Registry stats do not match template list count.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review registry stats aggregation before production rollout."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "template_registry_missing",
      message: error instanceof Error ? error.message : "Template registry runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore template registry access before production certification."
    });
  }

  return checks;
}

export async function checkTemplateVersions(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_versions");

    const [versions, stats, templates] = await Promise.all([
      listAllTemplateVersions(),
      getTemplateVersionStats(),
      listTemplates()
    ]);

    if (!versions.length) {
      addCheck(checks, {
        check: "published_version_missing",
        message: "No template versions exist in the runtime.",
        severity: "high",
        status: "needs_attention",
        suggestedAction: "Create and publish template versions before live store binding."
      });
    } else if (!stats.publishedVersions) {
      const activeTemplates = templates.filter((template) => template.status === "active").length;

      addCheck(checks, {
        check: "published_version_missing",
        message:
          activeTemplates > 0
            ? "Active templates exist but no published versions are available."
            : "No published template versions are available.",
        severity: activeTemplates > 0 ? "critical" : "high",
        status: activeTemplates > 0 ? "blocked" : "needs_attention",
        suggestedAction: "Publish at least one template version for production stores."
      });
    } else {
      addCheck(checks, {
        check: "published_versions_available",
        message: `${stats.publishedVersions} published template version(s) are available.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    const activeWithoutPublished = templates.filter(
      (template) =>
        template.status === "active" &&
        !versions.some((version) => version.templateId === template.id && version.status === "published")
    );

    if (activeWithoutPublished.length) {
      addCheck(checks, {
        check: "active_template_publish_gap",
        message: `${activeWithoutPublished.length} active template(s) have no published version.`,
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Publish versions for active templates or archive unused templates."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "published_version_missing",
      message: error instanceof Error ? error.message : "Template version runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore template version runtime before production certification."
    });
  }

  return checks;
}

export async function checkTemplatePackages(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_packages");

    const [packages, stats] = await Promise.all([listTemplatePackages(), getTemplatePackageStats()]);

    if (!packages.length) {
      addCheck(checks, {
        check: "template_packages_empty",
        message: "No template packages are registered.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Register template package metadata before production installs."
      });
    } else {
      addCheck(checks, {
        check: "template_packages_available",
        message: `${packages.length} template package record(s) are available.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    const invalidPackages = packages.filter((pkg) => !text(pkg.packageKey, 120));

    if (invalidPackages.length) {
      addCheck(checks, {
        check: "package_runtime_broken",
        message: `${invalidPackages.length} package record(s) are missing package keys.`,
        severity: "critical",
        status: "blocked",
        suggestedAction: "Repair package metadata before production rollout."
      });
    }

    if (stats.totalPackages !== packages.length) {
      addCheck(checks, {
        check: "template_package_stats",
        message: "Package stats do not match package list count.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review package stats aggregation."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "package_runtime_broken",
      message: error instanceof Error ? error.message : "Template package runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore template package runtime before production certification."
    });
  }

  return checks;
}

export async function checkTemplateAssets(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await Promise.all([verifyTableReachable("template_assets"), verifyTableReachable("template_screenshots")]);

    const [assets, screenshots, templates] = await Promise.all([
      listAllTemplateAssets(),
      listAllTemplateScreenshots(),
      listTemplates()
    ]);

    const sensitiveAssets = assets.filter((asset) =>
      containsSensitiveExposure(JSON.stringify({ metadata: asset.metadata, url: asset.previewUrl }))
    );
    const sensitiveScreenshots = screenshots.filter((screenshot) =>
      containsSensitiveExposure(JSON.stringify({ url: screenshot.previewUrl })) ||
      /\/object\/sign\//i.test(text(screenshot.previewUrl, 1000))
    );

    if (sensitiveAssets.length || sensitiveScreenshots.length) {
      addCheck(checks, {
        check: "private_asset_paths_exposed",
        message: "Template asset or screenshot records expose private storage metadata.",
        severity: "critical",
        status: "blocked",
        suggestedAction: "Remove private storage paths from template asset outputs."
      });
    } else {
      addCheck(checks, {
        check: "template_assets_safe",
        message: "Template asset and screenshot records do not expose private storage paths.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    if (!assets.length && !screenshots.length && templates.length) {
      addCheck(checks, {
        check: "template_assets_empty",
        message: "No template assets or screenshots are stored yet.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Upload published template assets before marketplace or preview launch."
      });
    }

    const sample = templates.find((template) => template.status === "active") ?? templates[0];

    if (sample) {
      const preview = await getTemplatePreview(sample.id);

      if (!preview) {
        addCheck(checks, {
          check: "template_preview_runtime",
          message: "Preview runtime returned no model for a sample template.",
          severity: "medium",
          status: "needs_attention",
          suggestedAction: "Verify preview runtime for active templates."
        });
      } else if (preview.model.previewReadiness === "invalid") {
        addCheck(checks, {
          check: "template_preview_readiness",
          message: "Sample template preview readiness is invalid.",
          severity: "medium",
          status: "needs_attention",
          suggestedAction: "Repair package or version readiness for preview templates."
        });
      }
    }
  } catch (error) {
    addCheck(checks, {
      check: "template_assets_runtime",
      message: error instanceof Error ? error.message : "Template asset runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review template asset storage runtime."
    });
  }

  return checks;
}

export async function checkTemplateInstallRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_installs");

    const installs = await listTemplateInstalls(listLimit);
    const completedInstalls = installs.filter((install) => install.status === "completed");
    const failedInstalls = installs.filter((install) => install.status === "failed");

    if (!completedInstalls.length) {
      addCheck(checks, {
        check: "production_installs_empty",
        message:
          "Templates runtime is structurally ready, but no production template installs have been executed yet.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Execute a controlled Super Admin install when ready for production validation."
      });
    } else {
      addCheck(checks, {
        check: "production_installs_present",
        message: `${completedInstalls.length} completed template install(s) are recorded.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    if (failedInstalls.length) {
      addCheck(checks, {
        check: "failed_template_installs",
        message: `${failedInstalls.length} failed template install(s) detected in recent history.`,
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review failed install jobs before broad production rollout."
      });
    }

    const leakingInstalls = installs.filter((install) =>
      containsPrivateCustomerData(JSON.stringify(install.installedSummary))
    );

    if (leakingInstalls.length) {
      addCheck(checks, {
        check: "install_runtime_broken",
        message: "Install records expose private customer data in installed summaries.",
        severity: "critical",
        status: "blocked",
        suggestedAction: "Sanitize install summaries before production certification."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "install_runtime_broken",
      message: error instanceof Error ? error.message : "Template install runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore template install runtime before production certification."
    });
  }

  return checks;
}

export async function checkStoreAssignments(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("store_template_assignments");

    const assignments = await listStoreTemplateAssignments({ limit: listLimit });
    const activeAssignments = assignments.filter((assignment) =>
      ["active", "assigned"].includes(assignment.assignmentStatus)
    );
    const failedAssignments = assignments.filter((assignment) => assignment.assignmentStatus === "failed");

    if (!activeAssignments.length) {
      addCheck(checks, {
        check: "store_assignments_empty",
        message: "No active store template assignments are recorded.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Assign templates to pilot stores before live rendering rollout."
      });
    } else {
      addCheck(checks, {
        check: "store_assignments_present",
        message: `${activeAssignments.length} active store template assignment(s) are recorded.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    if (failedAssignments.length) {
      addCheck(checks, {
        check: "failed_store_assignments",
        message: `${failedAssignments.length} failed store assignment record(s) detected.`,
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review failed assignments before production rollout."
      });
    }

    const duplicateActive = new Map<string, number>();

    for (const assignment of assignments) {
      if (assignment.assignmentStatus !== "active") continue;
      duplicateActive.set(assignment.storeId, (duplicateActive.get(assignment.storeId) ?? 0) + 1);
    }

    if ([...duplicateActive.values()].some((count) => count > 1)) {
      addCheck(checks, {
        check: "assignment_runtime_broken",
        message: "Multiple active assignments detected for one or more stores.",
        severity: "critical",
        status: "blocked",
        suggestedAction: "Resolve duplicate active assignments before production rollout."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "assignment_runtime_broken",
      message: error instanceof Error ? error.message : "Store template assignment runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore store assignment runtime before production certification."
    });
  }

  return checks;
}

export async function checkStoreIsolation(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("store_template_isolation_snapshots");

    const isolationIssues = await listStoreThemeIsolationIssues({ limit: listLimit });
    const failed = isolationIssues.filter((issue) => issue.isolationStatus === "failed");

    if (failed.length) {
      addCheck(checks, {
        check: "isolation_runtime_broken",
        message: `${failed.length} store theme isolation snapshot(s) are in failed state.`,
        severity: "critical",
        status: "blocked",
        suggestedAction: "Resolve failed isolation snapshots before production rollout."
      });
    } else {
      addCheck(checks, {
        check: "store_isolation_safe",
        message: "No failed store theme isolation snapshots were detected in recent history.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    const sensitiveSnapshots = isolationIssues.filter((issue) =>
      containsSensitiveExposure(JSON.stringify(issue.snapshot))
    );

    if (sensitiveSnapshots.length) {
      addCheck(checks, {
        check: "isolation_snapshot_exposure",
        message: "Isolation snapshots expose sensitive metadata.",
        severity: "high",
        status: "needs_attention",
        suggestedAction: "Sanitize isolation snapshot payloads."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "isolation_runtime_broken",
      message: error instanceof Error ? error.message : "Store theme isolation runtime is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore store isolation runtime before production certification."
    });
  }

  return checks;
}

export async function checkUpdateRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_update_jobs");

    const updates = await listTemplateUpdateJobs({ limit: listLimit });
    const failedUpdates = updates.filter((update) => update.status === "failed");

    if (failedUpdates.length) {
      addCheck(checks, {
        check: "failed_template_updates",
        message: `${failedUpdates.length} failed template update job(s) detected.`,
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review failed update jobs before production rollout."
      });
    } else {
      addCheck(checks, {
        check: "template_update_runtime",
        message: "Template update runtime is readable and has no recent failed jobs.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "template_update_runtime",
      message: error instanceof Error ? error.message : "Template update runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review template update runtime availability."
    });
  }

  return checks;
}

export async function checkRollbackRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_rollback_jobs");

    const rollbacks = await listTemplateRollbackJobs({ limit: listLimit });
    const failedRollbacks = rollbacks.filter((rollback) => rollback.status === "failed");

    if (failedRollbacks.length) {
      addCheck(checks, {
        check: "failed_template_rollbacks",
        message: `${failedRollbacks.length} failed template rollback job(s) detected.`,
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review failed rollback jobs before production rollout."
      });
    } else {
      addCheck(checks, {
        check: "template_rollback_runtime",
        message: "Template rollback runtime is readable and has no recent failed jobs.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "template_rollback_runtime",
      message: error instanceof Error ? error.message : "Template rollback runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review template rollback runtime availability."
    });
  }

  return checks;
}

export async function checkMarketplaceRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("template_marketplace_listings");

    const [listings, listingStats, approvalStats] = await Promise.all([
      listMarketplaceListings({ limit: listLimit }),
      getMarketplaceListingStats(),
      getMarketplaceApprovalStats()
    ]);

    if (!listings.length) {
      addCheck(checks, {
        check: "marketplace_listings_empty",
        message: "No marketplace listings are registered.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required until marketplace launch."
      });
    } else {
      addCheck(checks, {
        check: "marketplace_runtime_available",
        message: `${listingStats.totalListings} marketplace listing record(s) are available.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }

    if (approvalStats.pendingReviewListings > listingStats.pendingReviewListings) {
      addCheck(checks, {
        check: "marketplace_approval_stats",
        message: "Marketplace approval queue stats differ from listing stats.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Review marketplace approval queue consistency."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "marketplace_runtime_available",
      message: error instanceof Error ? error.message : "Template marketplace runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review marketplace runtime availability."
    });
  }

  return checks;
}

export async function checkResellerRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    await verifyTableReachable("reseller_template_access");

    const [accessRecords, stats] = await Promise.all([
      listResellerTemplates({ limit: listLimit }),
      getResellerTemplateStats()
    ]);

    if (!accessRecords.length) {
      addCheck(checks, {
        check: "reseller_access_empty",
        message: "No reseller template access records are registered.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required until reseller catalog rollout."
      });
    } else {
      addCheck(checks, {
        check: "reseller_runtime_available",
        message: `${stats.totalAssignments} reseller template access record(s) are available.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "reseller_runtime_available",
      message: error instanceof Error ? error.message : "Reseller template runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review reseller template runtime availability."
    });
  }

  return checks;
}

export async function checkAnalyticsRuntime(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    const dashboard = await getTemplateAnalyticsDashboard("all_time");
    const serialized = JSON.stringify(dashboard);

    if (containsSensitiveExposure(serialized) || containsPrivateCustomerData(serialized)) {
      addCheck(checks, {
        check: "analytics_runtime_safe",
        message: "Template analytics output exposes sensitive or private customer data.",
        severity: "high",
        status: "needs_attention",
        suggestedAction: "Sanitize analytics outputs before production certification."
      });
    } else {
      addCheck(checks, {
        check: "analytics_runtime_safe",
        message: "Template analytics runtime is readable and exposes counts only.",
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "analytics_runtime_safe",
      message: error instanceof Error ? error.message : "Template analytics runtime is unavailable.",
      severity: "high",
      status: "needs_attention",
      suggestedAction: "Review template analytics runtime availability."
    });
  }

  return checks;
}

export async function checkLiveRenderingBinding(): Promise<TemplatesProductionCheck[]> {
  const checks: TemplatesProductionCheck[] = [];

  try {
    const diagnostics = await listLiveStoreRenderingDiagnostics(50);

    if (!diagnostics.length) {
      addCheck(checks, {
        check: "live_rendering_binding_empty",
        message: "No active store assignments are available for live rendering diagnostics.",
        severity: "medium",
        status: "needs_attention",
        suggestedAction: "Assign templates to pilot stores to validate live rendering binding."
      });
      return checks;
    }

    const failedIsolation = diagnostics.filter((status) => status.isolationStatus === "failed");
    const brokenBinding = diagnostics.filter(
      (status) => !status.validation.assignmentReadable || !status.validation.fallbackAvailable
    );
    const assignmentBound = diagnostics.filter((status) => status.renderingSource === "store_assignment");

    if (failedIsolation.length) {
      addCheck(checks, {
        check: "live_rendering_binding_broken",
        message: `${failedIsolation.length} live rendering diagnostic(s) report failed isolation.`,
        severity: "critical",
        status: "blocked",
        suggestedAction: "Resolve live rendering isolation failures before production rollout."
      });
    }

    if (brokenBinding.length) {
      addCheck(checks, {
        check: "live_rendering_binding_broken",
        message: `${brokenBinding.length} live rendering diagnostic(s) are missing readable assignment or fallback data.`,
        severity: "critical",
        status: "blocked",
        suggestedAction: "Repair live rendering resolver outputs for assigned stores."
      });
    }

    if (!failedIsolation.length && !brokenBinding.length) {
      addCheck(checks, {
        check: "live_rendering_binding_safe",
        message: `${assignmentBound.length} store(s) resolve live rendering through active assignments.`,
        severity: "low",
        status: "certified",
        suggestedAction: "No action required."
      });
    }
  } catch (error) {
    addCheck(checks, {
      check: "live_rendering_binding_broken",
      message: error instanceof Error ? error.message : "Live store rendering binding is unavailable.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Restore live rendering binding runtime before production certification."
    });
  }

  return checks;
}

function buildSecurityIsolationChecks(allChecks: TemplatesProductionCheck[]): TemplatesProductionCheck[] {
  const checks: TemplatesProductionCheck[] = [];
  const combined = JSON.stringify(allChecks);

  addCheck(checks, {
    check: "no_customer_private_data_exposed",
    message: "Certification scope does not expose customer emails, phones, or payment data.",
    severity: "critical",
    status: containsPrivateCustomerData(combined) ? "blocked" : "certified",
    suggestedAction: containsPrivateCustomerData(combined)
      ? "Remove private customer data from certification outputs."
      : "No action required."
  });

  addCheck(checks, {
    check: "no_secrets_exposed",
    message: "Certification outputs do not expose secrets or credentials.",
    severity: "critical",
    status: containsSensitiveExposure(combined) ? "blocked" : "certified",
    suggestedAction: containsSensitiveExposure(combined)
      ? "Remove secrets from certification outputs."
      : "No action required."
  });

  addCheck(checks, {
    check: "no_private_asset_paths_exposed",
    message: "Certification does not expose signed storage URLs or private bucket keys.",
    severity: "critical",
    status:
      /\/object\/sign\//i.test(combined) ||
      allChecks.some((check) => check.check === "private_asset_paths_exposed" && check.status === "blocked")
        ? "blocked"
        : "certified",
    suggestedAction: "Use public preview URLs only in template runtime outputs."
  });

  addCheck(checks, {
    check: "no_cross_store_rendering",
    message: "Live rendering diagnostics do not report cross-store isolation failures.",
    severity: "critical",
    status: allChecks.some(
      (check) => check.check === "live_rendering_binding_broken" && check.status === "blocked"
    )
      ? "blocked"
      : "certified",
    suggestedAction: "Resolve cross-store rendering isolation before production rollout."
  });

  addCheck(checks, {
    check: "no_destructive_runtime_actions",
    message: "Production certification performs read-only checks with no install, update, rollback, or store mutation.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  addCheck(checks, {
    check: "super_admin_only_actions",
    message: "Template production certification is gated to Super Admin access only.",
    severity: "low",
    status: "certified",
    suggestedAction: "No action required."
  });

  const crossStoreRisk = allChecks.some(
    (check) =>
      (check.check === "live_rendering_binding_broken" || check.check === "cross_store_mutation_risk") &&
      check.status === "blocked"
  );

  if (crossStoreRisk) {
    addCheck(checks, {
      check: "cross_store_mutation_risk",
      message: "Cross-store mutation or rendering risk detected in live binding diagnostics.",
      severity: "critical",
      status: "blocked",
      suggestedAction: "Resolve store isolation issues before production rollout."
    });
  } else {
    addCheck(checks, {
      check: "cross_store_mutation_risk",
      message: "No cross-store mutation risk detected in production certification scope.",
      severity: "low",
      status: "certified",
      suggestedAction: "No action required."
    });
  }

  return checks;
}

export async function checkSecurityIsolation(): Promise<TemplatesProductionCheck[]> {
  const baseChecks = (
    await Promise.all([
      checkTemplateRegistry(),
      checkTemplateAssets(),
      checkTemplateInstallRuntime(),
      checkAnalyticsRuntime(),
      checkLiveRenderingBinding()
    ])
  ).flat();

  return buildSecurityIsolationChecks(baseChecks);
}

function computeReadinessScore(checks: TemplatesProductionCheck[]) {
  const scoreBreakdown: Array<{ label: string; points: number }> = [];
  let score = 100;

  for (const check of checks) {
    if (check.status === "blocked") {
      const points = check.severity === "critical" || criticalBlockChecks.has(check.check) ? 20 : 12;
      score -= points;
      scoreBreakdown.push({ label: check.check, points });
    } else if (check.status === "needs_attention") {
      const points = check.severity === "high" ? 8 : check.severity === "medium" ? 5 : 3;
      score -= points;
      scoreBreakdown.push({ label: check.check, points });
    }
  }

  const criticalBlocked = checks.some(
    (check) => criticalBlockChecks.has(check.check) && check.status === "blocked"
  );

  if (criticalBlocked) {
    score = Math.min(score, 35);
  }

  return {
    readinessScore: Math.max(0, Math.min(100, score)),
    scoreBreakdown
  };
}

function computeOverallStatus(checks: TemplatesProductionCheck[]): TemplatesProductionStatus {
  const blocked = checks.some(
    (check) =>
      (criticalBlockChecks.has(check.check) && check.status === "blocked") ||
      (check.status === "blocked" && check.severity === "critical")
  );

  if (blocked) return "blocked";
  if (checks.some((check) => check.status === "needs_attention")) return "needs_attention";
  return "certified";
}

function collectEmptyStates(checks: TemplatesProductionCheck[]) {
  return checks
    .filter((check) => check.check === "production_installs_empty")
    .map((check) => check.message);
}

export async function runTemplatesProductionCertification(): Promise<TemplatesProductionCertification> {
  await requireSuperAdmin();

  const [
    registryChecks,
    versionChecks,
    packageChecks,
    assetChecks,
    installChecks,
    assignmentChecks,
    isolationChecks,
    updateChecks,
    rollbackChecks,
    marketplaceChecks,
    resellerChecks,
    analyticsChecks,
    renderingChecks
  ] = await Promise.all([
    checkTemplateRegistry(),
    checkTemplateVersions(),
    checkTemplatePackages(),
    checkTemplateAssets(),
    checkTemplateInstallRuntime(),
    checkStoreAssignments(),
    checkStoreIsolation(),
    checkUpdateRuntime(),
    checkRollbackRuntime(),
    checkMarketplaceRuntime(),
    checkResellerRuntime(),
    checkAnalyticsRuntime(),
    checkLiveRenderingBinding()
  ]);

  const baseChecks = [
    ...registryChecks,
    ...versionChecks,
    ...packageChecks,
    ...assetChecks,
    ...installChecks,
    ...assignmentChecks,
    ...isolationChecks,
    ...updateChecks,
    ...rollbackChecks,
    ...marketplaceChecks,
    ...resellerChecks,
    ...analyticsChecks,
    ...renderingChecks
  ];

  const securityChecks = buildSecurityIsolationChecks(baseChecks);

  const checks = [...baseChecks, ...securityChecks];

  const { readinessScore, scoreBreakdown } = computeReadinessScore(checks);
  const overallStatus = computeOverallStatus(checks);

  return {
    assignmentStatus: statusFromChecks(checks, [
      "store_assignments_present",
      "store_assignments_empty",
      "failed_store_assignments",
      "assignment_runtime_broken"
    ]),
    certifiedAt: new Date().toISOString(),
    checks,
    emptyStates: collectEmptyStates(checks),
    installStatus: statusFromChecks(checks, [
      "production_installs_present",
      "production_installs_empty",
      "failed_template_installs",
      "install_runtime_broken"
    ]),
    isolationStatus: statusFromChecks(checks, [
      "store_isolation_safe",
      "isolation_runtime_broken",
      "isolation_snapshot_exposure"
    ]),
    liveRenderingStatus: statusFromChecks(checks, [
      "live_rendering_binding_safe",
      "live_rendering_binding_empty",
      "live_rendering_binding_broken"
    ]),
    marketplaceStatus: statusFromChecks(checks, [
      "marketplace_runtime_available",
      "marketplace_listings_empty",
      "marketplace_approval_stats"
    ]),
    overallStatus,
    packageStatus: statusFromChecks(checks, [
      "template_packages_available",
      "template_packages_empty",
      "package_runtime_broken",
      "template_package_stats"
    ]),
    readinessScore,
    registryStatus: statusFromChecks(checks, [
      "template_registry_available",
      "template_registry_missing",
      "template_registry_stats",
      "published_versions_available",
      "published_version_missing",
      "active_template_publish_gap"
    ]),
    resellerStatus: statusFromChecks(checks, [
      "reseller_runtime_available",
      "reseller_access_empty"
    ]),
    scoreBreakdown,
    securityStatus: statusFromChecks(checks, [
      "no_customer_private_data_exposed",
      "no_secrets_exposed",
      "no_private_asset_paths_exposed",
      "no_cross_store_rendering",
      "cross_store_mutation_risk",
      "no_destructive_runtime_actions",
      "super_admin_only_actions"
    ])
  };
}
