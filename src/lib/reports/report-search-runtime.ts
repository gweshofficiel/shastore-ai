import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import {
  buildReportFilterableReports,
  buildReportingCenterHref,
  type ReportFilterableReport,
  type ReportFilterQuery
} from "@/src/lib/reports/report-filters-runtime";
import type { ReportRuntimeSafeAction } from "@/src/lib/reports/report-safe-actions-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";
import type { ReportRuntimeVisibility } from "@/src/lib/reports/report-visibility-runtime";

export type ReportSearchSource = "report_search_runtime";

export type ReportSearchRuntimeState = "empty" | "ready" | "unavailable";

export type ReportSearchQuery = {
  q: string | null;
};

export type ReportSearchableReport = ReportFilterableReport & {
  dataSourceDescription: string;
  futureHooksText: string;
};

export type ReportSearchSnapshot = {
  emptyMessage: string | null;
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  matchedReportCount: number;
  matchedReportKeys: string[];
  matchedReports: ReportSearchableReport[];
  query: ReportSearchQuery;
  readOnly: true;
  resetHref: string;
  searchableFields: string[];
  source: ReportSearchSource;
  status: ReportSearchRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totalReportCount: number;
  warnings: string[];
};

export const REPORT_SEARCH_SOURCE = "report_search_runtime" as const;

export const REPORT_SEARCHABLE_FIELD_LABELS = [
  "Report key",
  "Report title",
  "Report category",
  "Report status",
  "Report visibility",
  "Certification state",
  "Data source description",
  "Future hooks",
  "Safe action state"
] as const;

export function sanitizeReportSearchKeyword(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  const safe = normalized.replace(/[^a-z0-9 _-]/g, "").slice(0, 48);
  return safe || null;
}

export function emptyReportSearchQuery(): ReportSearchQuery {
  return { q: null };
}

export function parseReportSearchQuery(input: Record<string, string | undefined>): ReportSearchQuery {
  return {
    q: sanitizeReportSearchKeyword(input.q)
  };
}

export function reportSearchQueryFromFilters(filters: ReportFilterQuery): ReportSearchQuery {
  return { q: filters.q };
}

export function buildReportSearchResetHref(input: {
  filters: ReportFilterQuery;
  range: string;
  view?: string | null;
}) {
  return buildReportingCenterHref({
    filters: { ...input.filters, q: null },
    range: input.range,
    view: input.view ?? null
  });
}

function normalizeSearchComparable(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildReportSearchHaystack(report: ReportSearchableReport) {
  return [
    report.reportKey,
    report.name,
    report.category,
    report.runtimeStatus,
    report.runtimeVisibility,
    report.certificationState,
    report.dataSourceDescription,
    report.futureHooksText,
    report.runtimeSafeAction,
    report.registryStatus,
    report.roadmapPhase,
    report.dataAvailability,
    report.reportType
  ]
    .map((value) => normalizeSearchComparable(String(value ?? "")))
    .filter(Boolean)
    .join(" ");
}

export function matchesReportSearch(report: ReportSearchableReport, keyword: string | null) {
  if (!keyword) {
    return true;
  }

  const haystack = buildReportSearchHaystack(report);
  return haystack.includes(keyword);
}

export type ReportSearchRuntimeInput = {
  filters: ReportFilterQuery;
  range: string;
  reports: ReportSearchableReport[];
  view?: string | null;
};

export function runReportSearchSnapshot(input: ReportSearchRuntimeInput): ReportSearchSnapshot {
  const keyword = input.filters.q;
  const matchedReports = keyword
    ? input.reports.filter((report) => matchesReportSearch(report, keyword))
    : [...input.reports];
  const warnings: string[] = [];
  const emptyMessage =
    keyword && input.reports.length > 0 && matchedReports.length === 0
      ? "No reports match the active search keyword. Reset search to restore the full registry list."
      : null;
  const status: ReportSearchRuntimeState =
    input.reports.length === 0 ? "unavailable" : keyword && matchedReports.length === 0 ? "empty" : "ready";

  if (keyword) {
    warnings.push("Search terms are applied in URL query state only. Nothing is persisted to the database.");
  }

  warnings.push("Reporting Center search remains Super Admin only on page load.");
  warnings.push("Search scans registry metadata and runtime resolver outputs only. No external providers are called.");

  const generatedAt = new Date().toISOString();

  return {
    emptyMessage,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: keyword
      ? `Generated ${generatedAt} · ${matchedReports.length}/${input.reports.length} reports matched`
      : `Generated ${generatedAt} · search inactive`,
    matchedReportCount: matchedReports.length,
    matchedReportKeys: matchedReports.map((report) => report.reportKey),
    matchedReports,
    query: { q: keyword },
    readOnly: true,
    resetHref: buildReportSearchResetHref({
      filters: input.filters,
      range: input.range,
      view: input.view ?? null
    }),
    searchableFields: [...REPORT_SEARCHABLE_FIELD_LABELS],
    source: REPORT_SEARCH_SOURCE,
    status,
    summary: keyword
      ? [`status ${status}`, `${matchedReports.length}/${input.reports.length} matched`, `keyword "${keyword}"`].join(
          "; "
        )
      : [`status ${status}`, "search inactive"].join("; "),
    superAdminReportsOnly: true,
    totalReportCount: input.reports.length,
    warnings
  };
}

export async function mapReportSearchRuntimeToAdminFields(input: ReportSearchRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      emptyMessage: "Report search requires Super Admin access.",
      errorMessage: "Super Admin access is required for Report Search runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Search unavailable",
      matchedReportCount: 0,
      matchedReportKeys: [],
      matchedReports: [],
      query: emptyReportSearchQuery(),
      readOnly: true as const,
      resetHref: buildReportSearchResetHref({
        filters: input.filters,
        range: input.range,
        view: input.view ?? null
      }),
      searchableFields: [...REPORT_SEARCHABLE_FIELD_LABELS],
      status: "unavailable" as const,
      summary: "Report Search requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totalReportCount: 0,
      warnings: ["Super Admin access is required for Report Search runtime."]
    };
  }

  const snapshot = runReportSearchSnapshot(input);

  return {
    emptyMessage: snapshot.emptyMessage,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    matchedReportCount: snapshot.matchedReportCount,
    matchedReportKeys: snapshot.matchedReportKeys,
    matchedReports: snapshot.matchedReports,
    query: snapshot.query,
    readOnly: true as const,
    resetHref: snapshot.resetHref,
    searchableFields: snapshot.searchableFields,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totalReportCount: snapshot.totalReportCount,
    warnings: snapshot.warnings
  };
}

export function buildReportSearchableReports(input: {
  adapterLoadingStateByReportKey: Record<string, "empty" | "error" | "loaded" | undefined>;
  reports: Array<{
    category: string;
    certificationState: string;
    dataSourceDescription: string;
    futureHooks: readonly string[] | string[];
    name: string;
    reportKey: string;
    roadmapPhase: string;
    runtimeSafeAction: ReportRuntimeSafeAction;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: ReportRuntimeVisibility;
    status: string;
  }>;
}): ReportSearchableReport[] {
  const filterable = buildReportFilterableReports({
    adapterLoadingStateByReportKey: input.adapterLoadingStateByReportKey,
    reports: input.reports
  });

  return filterable.map((report, index) => {
    const source = input.reports[index];

    return {
      ...report,
      dataSourceDescription: source?.dataSourceDescription ?? "",
      futureHooksText: (source?.futureHooks ?? [])
        .map((hook) => hook.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, ""))
        .filter(Boolean)
        .join(" ")
    };
  });
}
