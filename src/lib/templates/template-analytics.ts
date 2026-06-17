import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { listTemplates } from "@/src/lib/templates/template-registry";
import { listMarketplaceListings } from "@/src/lib/templates/template-marketplace-runtime";
import { listResellerTemplates } from "@/src/lib/templates/reseller-template-runtime";
import { listStoreTemplateAssignments } from "@/src/lib/templates/store-template-assignment";
import { listTemplateInstalls } from "@/src/lib/templates/template-install-runtime";
import { listTemplateRollbackJobs } from "@/src/lib/templates/template-rollback-runtime";
import { listTemplateUpdateJobs } from "@/src/lib/templates/template-update-runtime";

export type TemplateAnalyticsRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type TemplateAnalyticsOverview = {
  activeTemplates: number;
  archivedTemplates: number;
  officialTemplates: number;
  range: TemplateAnalyticsRange;
  recommendedTemplates: number;
  totalTemplates: number;
};

export type TemplateUsageStats = {
  activeAssignments: number;
  completedInstalls: number;
  failedInstalls: number;
  inactiveAssignments: number;
  range: TemplateAnalyticsRange;
  totalInstalls: number;
};

export type TemplateInstallStats = {
  cancelledInstalls: number;
  completedInstalls: number;
  failedInstalls: number;
  preparedInstalls: number;
  range: TemplateAnalyticsRange;
  totalInstalls: number;
};

export type TemplateAssignmentStats = {
  activeAssignments: number;
  assignedAssignments: number;
  failedAssignments: number;
  inactiveAssignments: number;
  range: TemplateAnalyticsRange;
  totalAssignments: number;
  unassignedAssignments: number;
};

export type TemplateUpdateStats = {
  cancelledUpdates: number;
  completedUpdates: number;
  failedUpdates: number;
  preparedUpdates: number;
  range: TemplateAnalyticsRange;
  totalUpdates: number;
};

export type TemplateRollbackStats = {
  cancelledRollbacks: number;
  completedRollbacks: number;
  failedRollbacks: number;
  preparedRollbacks: number;
  range: TemplateAnalyticsRange;
  totalRollbacks: number;
};

export type TemplateMarketplaceAnalyticsStats = {
  approvedListings: number;
  changesRequestedListings: number;
  draftListings: number;
  featuredListings: number;
  pendingApprovals: number;
  publishedListings: number;
  range: TemplateAnalyticsRange;
  rejectedListings: number;
  totalListings: number;
};

export type TemplateResellerAnalyticsStats = {
  activeAssignments: number;
  assignedTemplates: number;
  inheritedAssignments: number;
  marketplaceAssignments: number;
  range: TemplateAnalyticsRange;
  revokedAssignments: number;
  suspendedAssignments: number;
  totalAssignments: number;
};

export type TemplateTopTemplateMetric = {
  count: number;
  templateId: string;
  templateName: string;
};

export type TemplateTopTemplates = {
  mostAssigned: TemplateTopTemplateMetric[];
  mostInstalled: TemplateTopTemplateMetric[];
  mostListedMarketplace: TemplateTopTemplateMetric[];
  mostResellerAssigned: TemplateTopTemplateMetric[];
  mostUpdated: TemplateTopTemplateMetric[];
  range: TemplateAnalyticsRange;
};

export type TemplateAnalyticsDashboard = {
  assignmentStats: TemplateAssignmentStats;
  installStats: TemplateInstallStats;
  marketplaceStats: TemplateMarketplaceAnalyticsStats;
  overview: TemplateAnalyticsOverview;
  range: TemplateAnalyticsRange;
  resellerStats: TemplateResellerAnalyticsStats;
  rollbackStats: TemplateRollbackStats;
  topTemplates: TemplateTopTemplates;
  updateStats: TemplateUpdateStats;
  usageStats: TemplateUsageStats;
};

const listLimit = 500;

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

function parseRange(value: unknown): TemplateAnalyticsRange {
  const cleaned = text(value, 40);

  if (cleaned === "today") return "today";
  if (cleaned === "last_7_days") return "last_7_days";
  if (cleaned === "last_30_days") return "last_30_days";
  return "all_time";
}

function rangeStartIso(range: TemplateAnalyticsRange) {
  if (range === "all_time") return null;

  const now = new Date();

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  if (range === "last_7_days") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function eventTimestamp(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = text(value, 80);
    if (cleaned) return cleaned;
  }

  return null;
}

function inRange(range: TemplateAnalyticsRange, ...values: Array<string | null | undefined>) {
  if (range === "all_time") return true;

  const timestamp = eventTimestamp(...values);
  const start = rangeStartIso(range);

  if (!timestamp || !start) return false;

  return new Date(timestamp).getTime() >= new Date(start).getTime();
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access template analytics.");
  }

  return access;
}

function topCounts(
  counts: Map<string, number>,
  templateNameById: Map<string, string>,
  limit = 5
): TemplateTopTemplateMetric[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([templateId, count]) => ({
      count,
      templateId,
      templateName: templateNameById.get(templateId) ?? "Template"
    }));
}

function incrementCount(map: Map<string, number>, templateId: string) {
  map.set(templateId, (map.get(templateId) ?? 0) + 1);
}

async function loadScopedRecords(range: TemplateAnalyticsRange) {
  const [templates, installs, assignments, updates, rollbacks, listings, resellerAccess] = await Promise.all([
    listTemplates(),
    listTemplateInstalls(listLimit),
    listStoreTemplateAssignments({ limit: listLimit }),
    listTemplateUpdateJobs({ limit: listLimit }),
    listTemplateRollbackJobs({ limit: listLimit }),
    listMarketplaceListings({ limit: listLimit }),
    listResellerTemplates({ limit: listLimit })
  ]);

  return {
    assignments: assignments.filter((record) => inRange(range, record.assignedAt, record.createdAt, record.updatedAt)),
    installs: installs.filter((record) => inRange(range, record.completedAt, record.createdAt, record.startedAt)),
    listings: listings.filter((record) => inRange(range, record.publishedAt, record.createdAt, record.updatedAt)),
    resellerAccess: resellerAccess.filter((record) => inRange(range, record.assignedAt, record.createdAt, record.updatedAt)),
    rollbacks: rollbacks.filter((record) => inRange(range, record.completedAt, record.createdAt, record.startedAt)),
    templates,
    updates: updates.filter((record) => inRange(range, record.completedAt, record.createdAt, record.startedAt))
  };
}

type ScopedRecords = Awaited<ReturnType<typeof loadScopedRecords>>;

function buildOverview(range: TemplateAnalyticsRange, templates: ScopedRecords["templates"]): TemplateAnalyticsOverview {
  return {
    activeTemplates: templates.filter((template) => template.status === "active").length,
    archivedTemplates: templates.filter((template) => template.status === "archived").length,
    officialTemplates: templates.filter((template) => template.isOfficial).length,
    range,
    recommendedTemplates: templates.filter((template) => template.isRecommended).length,
    totalTemplates: templates.length
  };
}

function buildUsageStats(range: TemplateAnalyticsRange, scoped: ScopedRecords): TemplateUsageStats {
  return {
    activeAssignments: scoped.assignments.filter((record) => record.assignmentStatus === "active").length,
    completedInstalls: scoped.installs.filter((record) => record.status === "completed").length,
    failedInstalls: scoped.installs.filter((record) => record.status === "failed").length,
    inactiveAssignments: scoped.assignments.filter((record) =>
      ["inactive", "unassigned", "failed"].includes(record.assignmentStatus)
    ).length,
    range,
    totalInstalls: scoped.installs.length
  };
}

function buildInstallStats(range: TemplateAnalyticsRange, installs: ScopedRecords["installs"]): TemplateInstallStats {
  return {
    cancelledInstalls: installs.filter((record) => record.status === "cancelled").length,
    completedInstalls: installs.filter((record) => record.status === "completed").length,
    failedInstalls: installs.filter((record) => record.status === "failed").length,
    preparedInstalls: installs.filter((record) => record.status === "prepared").length,
    range,
    totalInstalls: installs.length
  };
}

function buildAssignmentStats(
  range: TemplateAnalyticsRange,
  assignments: ScopedRecords["assignments"]
): TemplateAssignmentStats {
  return {
    activeAssignments: assignments.filter((record) => record.assignmentStatus === "active").length,
    assignedAssignments: assignments.filter((record) => record.assignmentStatus === "assigned").length,
    failedAssignments: assignments.filter((record) => record.assignmentStatus === "failed").length,
    inactiveAssignments: assignments.filter((record) => record.assignmentStatus === "inactive").length,
    range,
    totalAssignments: assignments.length,
    unassignedAssignments: assignments.filter((record) => record.assignmentStatus === "unassigned").length
  };
}

function buildUpdateStats(range: TemplateAnalyticsRange, updates: ScopedRecords["updates"]): TemplateUpdateStats {
  return {
    cancelledUpdates: updates.filter((record) => record.status === "cancelled").length,
    completedUpdates: updates.filter((record) => record.status === "completed").length,
    failedUpdates: updates.filter((record) => record.status === "failed").length,
    preparedUpdates: updates.filter((record) => record.status === "prepared").length,
    range,
    totalUpdates: updates.length
  };
}

function buildRollbackStats(range: TemplateAnalyticsRange, rollbacks: ScopedRecords["rollbacks"]): TemplateRollbackStats {
  return {
    cancelledRollbacks: rollbacks.filter((record) => record.status === "cancelled").length,
    completedRollbacks: rollbacks.filter((record) => record.status === "completed").length,
    failedRollbacks: rollbacks.filter((record) => record.status === "failed").length,
    preparedRollbacks: rollbacks.filter((record) => record.status === "prepared").length,
    range,
    totalRollbacks: rollbacks.length
  };
}

function buildMarketplaceStats(
  range: TemplateAnalyticsRange,
  listings: ScopedRecords["listings"]
): TemplateMarketplaceAnalyticsStats {
  return {
    approvedListings: listings.filter((listing) => listing.approvalStatus === "approved").length,
    changesRequestedListings: listings.filter((listing) => listing.approvalStatus === "changes_requested").length,
    draftListings: listings.filter((listing) => listing.listingStatus === "draft").length,
    featuredListings: listings.filter((listing) => listing.featured).length,
    pendingApprovals: listings.filter((listing) => listing.approvalStatus === "pending_review").length,
    publishedListings: listings.filter((listing) => listing.listingStatus === "published").length,
    range,
    rejectedListings: listings.filter((listing) => listing.approvalStatus === "rejected").length,
    totalListings: listings.length
  };
}

function buildResellerStats(
  range: TemplateAnalyticsRange,
  resellerAccess: ScopedRecords["resellerAccess"]
): TemplateResellerAnalyticsStats {
  return {
    activeAssignments: resellerAccess.filter((record) => record.accessStatus === "active").length,
    assignedTemplates: new Set(resellerAccess.map((record) => record.templateId)).size,
    inheritedAssignments: resellerAccess.filter((record) => record.accessType === "inherited").length,
    marketplaceAssignments: resellerAccess.filter((record) => record.accessType === "marketplace").length,
    range,
    revokedAssignments: resellerAccess.filter((record) => record.accessStatus === "revoked").length,
    suspendedAssignments: resellerAccess.filter((record) => record.accessStatus === "suspended").length,
    totalAssignments: resellerAccess.length
  };
}

function buildTopTemplates(
  range: TemplateAnalyticsRange,
  scoped: ScopedRecords,
  templateNameById: Map<string, string>
): TemplateTopTemplates {
  const installed = new Map<string, number>();
  const assigned = new Map<string, number>();
  const updated = new Map<string, number>();
  const listed = new Map<string, number>();
  const resellerAssigned = new Map<string, number>();

  for (const record of scoped.installs) {
    incrementCount(installed, record.templateId);
  }

  for (const record of scoped.assignments) {
    incrementCount(assigned, record.templateId);
  }

  for (const record of scoped.updates) {
    incrementCount(updated, record.templateId);
  }

  for (const record of scoped.listings) {
    incrementCount(listed, record.templateId);
  }

  for (const record of scoped.resellerAccess) {
    incrementCount(resellerAssigned, record.templateId);
  }

  return {
    mostAssigned: topCounts(assigned, templateNameById),
    mostInstalled: topCounts(installed, templateNameById),
    mostListedMarketplace: topCounts(listed, templateNameById),
    mostResellerAssigned: topCounts(resellerAssigned, templateNameById),
    mostUpdated: topCounts(updated, templateNameById),
    range
  };
}

export async function getTemplateAnalyticsOverview(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateAnalyticsOverview> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { templates } = await loadScopedRecords(parsedRange);

  return buildOverview(parsedRange, templates);
}

export async function getTemplateUsageStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateUsageStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const scoped = await loadScopedRecords(parsedRange);

  return buildUsageStats(parsedRange, scoped);
}

export async function getTemplateInstallStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateInstallStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { installs } = await loadScopedRecords(parsedRange);

  return buildInstallStats(parsedRange, installs);
}

export async function getTemplateAssignmentStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateAssignmentStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { assignments } = await loadScopedRecords(parsedRange);

  return buildAssignmentStats(parsedRange, assignments);
}

export async function getTemplateUpdateStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateUpdateStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { updates } = await loadScopedRecords(parsedRange);

  return buildUpdateStats(parsedRange, updates);
}

export async function getTemplateRollbackStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateRollbackStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { rollbacks } = await loadScopedRecords(parsedRange);

  return buildRollbackStats(parsedRange, rollbacks);
}

export async function getTemplateMarketplaceStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateMarketplaceAnalyticsStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { listings } = await loadScopedRecords(parsedRange);

  return buildMarketplaceStats(parsedRange, listings);
}

export async function getTemplateResellerStats(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateResellerAnalyticsStats> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const { resellerAccess } = await loadScopedRecords(parsedRange);

  return buildResellerStats(parsedRange, resellerAccess);
}

export async function getTopTemplates(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateTopTemplates> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const scoped = await loadScopedRecords(parsedRange);
  const templateNameById = new Map(scoped.templates.map((template) => [template.id, template.name]));

  return buildTopTemplates(parsedRange, scoped, templateNameById);
}

export async function getTemplateAnalyticsDashboard(
  range: TemplateAnalyticsRange = "all_time"
): Promise<TemplateAnalyticsDashboard> {
  await requireSuperAdmin();

  const parsedRange = parseRange(range);
  const scoped = await loadScopedRecords(parsedRange);
  const templateNameById = new Map(scoped.templates.map((template) => [template.id, template.name]));

  return {
    assignmentStats: buildAssignmentStats(parsedRange, scoped.assignments),
    installStats: buildInstallStats(parsedRange, scoped.installs),
    marketplaceStats: buildMarketplaceStats(parsedRange, scoped.listings),
    overview: buildOverview(parsedRange, scoped.templates),
    range: parsedRange,
    resellerStats: buildResellerStats(parsedRange, scoped.resellerAccess),
    rollbackStats: buildRollbackStats(parsedRange, scoped.rollbacks),
    topTemplates: buildTopTemplates(parsedRange, scoped, templateNameById),
    updateStats: buildUpdateStats(parsedRange, scoped.updates),
    usageStats: buildUsageStats(parsedRange, scoped)
  };
}

export function parseTemplateAnalyticsRange(value: unknown): TemplateAnalyticsRange {
  return parseRange(value);
}
