import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import type { ReportRuntimeSafeAction } from "@/src/lib/reports/report-safe-actions-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";
import type { ReportRuntimeVisibility } from "@/src/lib/reports/report-visibility-runtime";

export type ReportFiltersSource = "report_filters_runtime";

export type ReportFilterAvailability =
  | "empty"
  | "error"
  | "loaded"
  | "planned"
  | "unavailable";

export type ReportFilterType = "certification" | "module" | "platform" | "registry";

export type ReportFiltersRuntimeState = "empty" | "ready" | "unavailable";

export type ReportFilterQuery = {
  action: string | null;
  availability: string | null;
  category: string | null;
  certification: string | null;
  q: string | null;
  status: string | null;
  type: string | null;
  visibility: string | null;
};

export type ReportFilterActiveItem = {
  dimension:
    | "action"
    | "availability"
    | "category"
    | "certification"
    | "q"
    | "status"
    | "type"
    | "visibility";
  label: string;
  value: string;
};

export type ReportFilterOptions = {
  actions: string[];
  availabilities: string[];
  categories: string[];
  certifications: string[];
  statuses: string[];
  types: string[];
  visibilities: string[];
};

export type ReportFilterableReport = {
  category: string;
  certificationState: string;
  dataAvailability: ReportFilterAvailability;
  name: string;
  registryStatus: string;
  reportKey: string;
  reportType: ReportFilterType;
  roadmapPhase: string;
  runtimeSafeAction: ReportRuntimeSafeAction;
  runtimeStatus: ReportRuntimeStatus;
  runtimeVisibility: ReportRuntimeVisibility;
};

export type ReportFilteredAggregation = {
  availableReports: number;
  byCategory: Array<{ count: number; label: string }>;
  byRuntimeStatus: Array<{ count: number; label: string }>;
  byRuntimeVisibility: Array<{ count: number; label: string }>;
  emptyReports: number;
  plannedReports: number;
  reportsWithLockedActions: number;
  reportsWithRuntimeData: number;
  totalRegisteredReports: number;
};

export type ReportFiltersSnapshot = {
  activeFilters: ReportFilterActiveItem[];
  appliedFilterCount: number;
  emptyMessage: string | null;
  errorMessage: string | null;
  filteredAggregation: ReportFilteredAggregation;
  filteredReportKeys: string[];
  filteredReports: ReportFilterableReport[];
  filterOptions: ReportFilterOptions;
  generatedAt: string;
  lastGeneratedState: string;
  query: ReportFilterQuery;
  readOnly: true;
  resetHref: string;
  source: ReportFiltersSource;
  status: ReportFiltersRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totalReportCount: number;
  warnings: string[];
};

export const REPORT_FILTERS_SOURCE = "report_filters_runtime" as const;

const FILTER_QUERY_KEYS = [
  "category",
  "status",
  "visibility",
  "certification",
  "action",
  "availability",
  "type",
  "q"
] as const;

const RUNTIME_MODULE_REPORT_KEYS = new Set([
  "rp-2-revenue-reports",
  "rp-3-store-reports",
  "rp-4-user-reports",
  "rp-5-subscription-reports",
  "rp-6-payment-reports",
  "rp-7-ai-reports",
  "rp-8-domain-email-reports",
  "rp-9-marketplace-reports",
  "rp-10-security-reports",
  "rp-11-operations-reports"
]);

function sanitizeFilterToken(value: unknown, maxLength = 64) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  const safe = normalized
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    .trim();
  return safe || null;
}

function normalizeFilterComparable(value: string) {
  return sanitizeFilterToken(value, 120) ?? "";
}

export function reportFilterComparableValue(value: string) {
  return normalizeFilterComparable(value);
}

function sanitizeSearchKeyword(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  const safe = normalized.replace(/[^a-z0-9 _-]/g, "").slice(0, 48);
  return safe || null;
}

export function emptyReportFilterQuery(): ReportFilterQuery {
  return {
    action: null,
    availability: null,
    category: null,
    certification: null,
    q: null,
    status: null,
    type: null,
    visibility: null
  };
}

export function parseReportFilterQuery(input: Record<string, string | undefined>): ReportFilterQuery {
  return {
    action: sanitizeFilterToken(input.action),
    availability: sanitizeFilterToken(input.availability),
    category: sanitizeFilterToken(input.category, 80),
    certification: sanitizeFilterToken(input.certification),
    q: sanitizeSearchKeyword(input.q),
    status: sanitizeFilterToken(input.status),
    type: sanitizeFilterToken(input.type),
    visibility: sanitizeFilterToken(input.visibility)
  };
}

export function countActiveReportFilters(query: ReportFilterQuery) {
  return FILTER_QUERY_KEYS.filter((key) => Boolean(query[key])).length;
}

export function buildReportFiltersQueryString(
  filters: ReportFilterQuery,
  extras: { range?: string; view?: string | null } = {}
) {
  const params = new URLSearchParams();

  if (extras.range) {
    params.set("range", extras.range);
  }

  if (extras.view) {
    params.set("view", extras.view);
  }

  for (const key of FILTER_QUERY_KEYS) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildReportingCenterHref(input: {
  filters?: ReportFilterQuery;
  range: string;
  view?: string | null;
}) {
  return `/admin/reports${buildReportFiltersQueryString(input.filters ?? emptyReportFilterQuery(), {
    range: input.range,
    view: input.view ?? null
  })}`;
}

export function buildReportFiltersResetHref(range: string, view?: string | null) {
  return buildReportingCenterHref({ filters: emptyReportFilterQuery(), range, view });
}

export function buildReportFilterToggleHref(input: {
  current: ReportFilterQuery;
  dimension: keyof ReportFilterQuery;
  range: string;
  value: string | null;
  view?: string | null;
}) {
  const next = { ...input.current };
  const normalizedValue = input.value
    ? sanitizeFilterToken(input.value, input.dimension === "category" ? 80 : 64)
    : null;
  const currentValue = next[input.dimension];

  if (normalizedValue && currentValue === normalizedValue) {
    next[input.dimension] = null;
  } else {
    next[input.dimension] = normalizedValue;
  }

  return buildReportingCenterHref({
    filters: next,
    range: input.range,
    view: input.view ?? null
  });
}

export function resolveReportFilterType(report: { category: string; reportKey: string }): ReportFilterType {
  if (report.category === "Reports Registry") {
    return "registry";
  }

  if (report.category === "Report Certification") {
    return "certification";
  }

  if (report.category === "Report Platform") {
    return "platform";
  }

  return "module";
}

export function resolveReportFilterAvailability(input: {
  adapterLoadingState?: "empty" | "error" | "loaded";
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportFilterAvailability {
  if (input.adapterLoadingState === "error") {
    return "error";
  }

  if (input.adapterLoadingState === "empty" || input.runtimeStatus === "empty") {
    return "empty";
  }

  if (input.adapterLoadingState === "loaded" && RUNTIME_MODULE_REPORT_KEYS.has(input.reportKey)) {
    return "loaded";
  }

  if (input.runtimeStatus === "planned") {
    return "planned";
  }

  if (input.adapterLoadingState === "loaded") {
    return "loaded";
  }

  return "unavailable";
}

function groupCount(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.trim() || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label: label.replace(/_/g, " ") }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function buildFilterOptions(reports: ReportFilterableReport[]): ReportFilterOptions {
  return {
    actions: [...new Set(reports.map((report) => report.runtimeSafeAction))].sort(),
    availabilities: [...new Set(reports.map((report) => report.dataAvailability))].sort(),
    categories: [...new Set(reports.map((report) => report.category))].sort(),
    certifications: [...new Set(reports.map((report) => report.certificationState))].sort(),
    statuses: [...new Set(reports.map((report) => report.runtimeStatus))].sort(),
    types: [...new Set(reports.map((report) => report.reportType))].sort(),
    visibilities: [...new Set(reports.map((report) => report.runtimeVisibility))].sort()
  };
}

function matchesFilter(report: ReportFilterableReport, query: ReportFilterQuery) {
  if (query.category && normalizeFilterComparable(report.category) !== query.category) {
    return false;
  }

  if (query.status && report.runtimeStatus !== query.status) {
    return false;
  }

  if (query.visibility && report.runtimeVisibility !== query.visibility) {
    return false;
  }

  if (query.certification && normalizeFilterComparable(report.certificationState) !== query.certification) {
    return false;
  }

  if (query.action && report.runtimeSafeAction !== query.action) {
    return false;
  }

  if (query.availability && report.dataAvailability !== query.availability) {
    return false;
  }

  if (query.type && report.reportType !== query.type) {
    return false;
  }

  return true;
}

function buildActiveFilters(query: ReportFilterQuery): ReportFilterActiveItem[] {
  const items: ReportFilterActiveItem[] = [];

  if (query.category) {
    items.push({ dimension: "category", label: "Category", value: query.category });
  }

  if (query.status) {
    items.push({ dimension: "status", label: "Status", value: query.status.replace(/_/g, " ") });
  }

  if (query.visibility) {
    items.push({ dimension: "visibility", label: "Visibility", value: query.visibility.replace(/_/g, " ") });
  }

  if (query.certification) {
    items.push({ dimension: "certification", label: "Certification", value: query.certification.replace(/_/g, " ") });
  }

  if (query.action) {
    items.push({ dimension: "action", label: "Safe action", value: query.action.replace(/_/g, " ") });
  }

  if (query.availability) {
    items.push({ dimension: "availability", label: "Data availability", value: query.availability });
  }

  if (query.type) {
    items.push({ dimension: "type", label: "Report type", value: query.type });
  }

  if (query.q) {
    items.push({ dimension: "q", label: "Search", value: query.q });
  }

  return items;
}

function buildFilteredAggregation(reports: ReportFilterableReport[]): ReportFilteredAggregation {
  const isAvailable = (status: ReportRuntimeStatus) =>
    status === "available" || status === "active" || status === "certified";

  return {
    availableReports: reports.filter((report) => isAvailable(report.runtimeStatus)).length,
    byCategory: groupCount(reports.map((report) => report.category)),
    byRuntimeStatus: groupCount(reports.map((report) => report.runtimeStatus)),
    byRuntimeVisibility: groupCount(reports.map((report) => report.runtimeVisibility)),
    emptyReports: reports.filter((report) => report.runtimeStatus === "empty").length,
    plannedReports: reports.filter((report) => report.runtimeStatus === "planned").length,
    reportsWithLockedActions: reports.filter(
      (report) =>
        report.runtimeSafeAction === "action_locked" ||
        report.runtimeSafeAction === "planned_action" ||
        report.runtimeSafeAction === "view_disabled"
    ).length,
    reportsWithRuntimeData: reports.filter((report) => report.dataAvailability === "loaded").length,
    totalRegisteredReports: reports.length
  };
}

export type ReportFiltersRuntimeInput = {
  query: ReportFilterQuery;
  range: string;
  reports: ReportFilterableReport[];
  view?: string | null;
};

export function runReportFiltersSnapshot(input: ReportFiltersRuntimeInput): ReportFiltersSnapshot {
  const warnings: string[] = [];
  const filteredReports = input.reports.filter((report) => matchesFilter(report, input.query));
  const appliedFilterCount = countActiveReportFilters(input.query);
  const activeFilters = buildActiveFilters(input.query);
  const filteredReportKeys = filteredReports.map((report) => report.reportKey);
  const emptyMessage =
    input.reports.length > 0 && filteredReports.length === 0
      ? "No reports match the active filters. Reset filters to restore the full registry list."
      : null;
  const status: ReportFiltersRuntimeState =
    input.reports.length === 0 ? "unavailable" : filteredReports.length === 0 ? "empty" : "ready";

  if (appliedFilterCount > 0) {
    warnings.push("Filters are applied in URL query state only. Nothing is persisted to the database.");
  }

  warnings.push("Reporting Center filters remain Super Admin only on page load.");

  const generatedAt = new Date().toISOString();

  return {
    activeFilters,
    appliedFilterCount,
    emptyMessage,
    errorMessage: null,
    filteredAggregation: buildFilteredAggregation(filteredReports),
    filteredReportKeys,
    filteredReports,
    filterOptions: buildFilterOptions(input.reports),
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${filteredReports.length}/${input.reports.length} reports visible`,
    query: input.query,
    readOnly: true,
    resetHref: buildReportFiltersResetHref(input.range, input.view ?? null),
    source: REPORT_FILTERS_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${filteredReports.length}/${input.reports.length} visible`,
      `${appliedFilterCount} active filters`
    ].join("; "),
    superAdminReportsOnly: true,
    totalReportCount: input.reports.length,
    warnings
  };
}

export async function mapReportFiltersRuntimeToAdminFields(input: ReportFiltersRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      activeFilters: [],
      appliedFilterCount: 0,
      emptyMessage: "Report filters require Super Admin access.",
      errorMessage: "Super Admin access is required for Report Filters runtime.",
      filteredAggregation: buildFilteredAggregation([]),
      filteredReportKeys: [],
      filteredReports: [],
      filterOptions: {
        actions: [],
        availabilities: [],
        categories: [],
        certifications: [],
        statuses: [],
        types: [],
        visibilities: []
      },
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Filters unavailable",
      query: emptyReportFilterQuery(),
      readOnly: true as const,
      resetHref: buildReportFiltersResetHref(input.range, input.view ?? null),
      status: "unavailable" as const,
      summary: "Report Filters requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totalReportCount: 0,
      warnings: ["Super Admin access is required for Report Filters runtime."]
    };
  }

  const snapshot = runReportFiltersSnapshot(input);

  return {
    activeFilters: snapshot.activeFilters,
    appliedFilterCount: snapshot.appliedFilterCount,
    emptyMessage: snapshot.emptyMessage,
    errorMessage: snapshot.errorMessage,
    filteredAggregation: snapshot.filteredAggregation,
    filteredReportKeys: snapshot.filteredReportKeys,
    filteredReports: snapshot.filteredReports,
    filterOptions: snapshot.filterOptions,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    query: snapshot.query,
    readOnly: true as const,
    resetHref: snapshot.resetHref,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totalReportCount: snapshot.totalReportCount,
    warnings: snapshot.warnings
  };
}

export function buildReportFilterableReports(input: {
  adapterLoadingStateByReportKey: Record<string, "empty" | "error" | "loaded" | undefined>;
  reports: Array<{
    category: string;
    certificationState: string;
    name: string;
    reportKey: string;
    roadmapPhase: string;
    runtimeSafeAction: ReportRuntimeSafeAction;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: ReportRuntimeVisibility;
    status: string;
  }>;
}): ReportFilterableReport[] {
  return input.reports.map((report) => ({
    category: report.category,
    certificationState: report.certificationState,
    dataAvailability: resolveReportFilterAvailability({
      adapterLoadingState: input.adapterLoadingStateByReportKey[report.reportKey],
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus
    }),
    name: report.name,
    registryStatus: report.status,
    reportKey: report.reportKey,
    reportType: resolveReportFilterType(report),
    roadmapPhase: report.roadmapPhase,
    runtimeSafeAction: report.runtimeSafeAction,
    runtimeStatus: report.runtimeStatus,
    runtimeVisibility: report.runtimeVisibility
  }));
}
