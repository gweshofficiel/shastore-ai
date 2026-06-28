import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-access";
import { getAdminReportingControl } from "@/lib/admin/data";
import { parseReportFilterQuery } from "@/src/lib/reports/report-filters-runtime";
import {
  buildReportExportRuntimeInput,
  reportExportPayloadToCsv,
  runReportExportSnapshot,
  validateReportExportRequest,
  type ReportExportFormat,
  type ReportExportModuleSnapshots
} from "@/src/lib/reports/report-export-runtime";

export const dynamic = "force-dynamic";

function exportFormat(value: string | null): ReportExportFormat | null {
  return value === "csv" || value === "json" ? value : null;
}

function buildModuleSnapshots(control: Awaited<ReturnType<typeof getAdminReportingControl>>): ReportExportModuleSnapshots {
  return {
    aggregation: {
      generatedAt: control.reportAggregation.generatedAt,
      summary: control.reportAggregation.summary,
      totals: {
        availableReports: control.reportAggregation.totals.availableReports,
        certifiedReports: control.reportAggregation.totals.certifiedReports,
        degradedReports: control.reportAggregation.totals.degradedReports,
        emptyReports: control.reportAggregation.totals.emptyReports,
        partialReports: control.reportAggregation.totals.partialReports,
        plannedReports: control.reportAggregation.totals.plannedReports,
        reportsWithEmptyState: control.reportAggregation.totals.reportsWithEmptyState,
        reportsWithLockedActions: control.reportAggregation.totals.reportsWithLockedActions,
        reportsWithRuntimeData: control.reportAggregation.totals.reportsWithRuntimeData,
        totalRegisteredReports: control.reportAggregation.totals.totalRegisteredReports
      }
    },
    aiReports: {
      breakdowns: [
        ...control.aiReports.usageByFeature.map((item) => ({ ...item })),
        ...control.aiReports.usageByUserRole.map((item) => ({ ...item })),
        ...control.aiReports.usageByWorkspaceOrStore.map((item) => ({ ...item }))
      ],
      errorMessage: control.aiReports.errorMessage,
      generatedAt: control.aiReports.generatedAt,
      loadingState: control.aiReports.loadingState,
      metrics: { ...control.aiReports.metrics },
      rangeLabel: control.aiReports.rangeLabel,
      selectedRange: control.aiReports.selectedRange,
      status: control.aiReports.status,
      summary: control.aiReports.summary,
      warnings: [...control.aiReports.warnings]
    },
    domainEmailReports: {
      breakdowns: [
        ...control.domainEmailReports.domainsByExtension.map((item) => ({ ...item })),
        ...control.domainEmailReports.domainsByProvider.map((item) => ({ ...item })),
        ...control.domainEmailReports.domainsByStatus.map((item) => ({ ...item }))
      ],
      errorMessage: control.domainEmailReports.errorMessage,
      generatedAt: control.domainEmailReports.generatedAt,
      loadingState: control.domainEmailReports.loadingState,
      metrics: { ...control.domainEmailReports.metrics },
      rangeLabel: control.domainEmailReports.rangeLabel,
      selectedRange: control.domainEmailReports.selectedRange,
      status: control.domainEmailReports.status,
      summary: control.domainEmailReports.summary,
      warnings: [...control.domainEmailReports.warnings]
    },
    marketplaceReports: {
      breakdowns: control.marketplaceReports.itemsByStatus.map((item) => ({ ...item })),
      errorMessage: control.marketplaceReports.errorMessage,
      generatedAt: control.marketplaceReports.generatedAt,
      loadingState: control.marketplaceReports.loadingState,
      metrics: { ...control.marketplaceReports.metrics },
      rangeLabel: control.marketplaceReports.rangeLabel,
      selectedRange: control.marketplaceReports.selectedRange,
      status: control.marketplaceReports.status,
      summary: control.marketplaceReports.summary,
      warnings: [...control.marketplaceReports.warnings]
    },
    operationsReports: {
      breakdowns: control.operationsReports.issuesByCategory.map((item) => ({ ...item })),
      errorMessage: control.operationsReports.errorMessage,
      generatedAt: control.operationsReports.generatedAt,
      loadingState: control.operationsReports.loadingState,
      metrics: { ...control.operationsReports.metrics },
      rangeLabel: control.operationsReports.rangeLabel,
      selectedRange: control.operationsReports.selectedRange,
      status: control.operationsReports.status,
      summary: control.operationsReports.summary,
      warnings: [...control.operationsReports.warnings]
    },
    paymentReports: {
      breakdowns: [
        ...control.paymentReports.paymentsByCurrency.map((item) => ({ ...item })),
        ...control.paymentReports.paymentsByProvider.map((item) => ({ ...item })),
        ...control.paymentReports.paymentsByStatus.map((item) => ({ ...item }))
      ],
      errorMessage: control.paymentReports.errorMessage,
      generatedAt: control.paymentReports.generatedAt,
      loadingState: control.paymentReports.loadingState,
      metrics: { ...control.paymentReports.metrics },
      rangeLabel: control.paymentReports.rangeLabel,
      selectedRange: control.paymentReports.selectedRange,
      status: control.paymentReports.status,
      summary: control.paymentReports.summary,
      warnings: [...control.paymentReports.warnings]
    },
    revenueReports: {
      breakdowns: [
        ...control.revenueReports.currencyBreakdown.map((item) => ({ ...item })),
        ...control.revenueReports.providerBreakdown.map((item) => ({ ...item }))
      ],
      errorMessage: control.revenueReports.errorMessage,
      generatedAt: control.revenueReports.generatedAt,
      loadingState: control.revenueReports.loadingState,
      metrics: { ...control.revenueReports.metrics },
      rangeLabel: control.revenueReports.rangeLabel,
      selectedRange: control.revenueReports.selectedRange,
      status: control.revenueReports.status,
      summary: control.revenueReports.summary,
      warnings: [...control.revenueReports.warnings]
    },
    securityReports: {
      breakdowns: [
        ...control.securityReports.eventsByCategory.map((item) => ({ ...item })),
        ...control.securityReports.eventsBySeverity.map((item) => ({ ...item }))
      ],
      errorMessage: control.securityReports.errorMessage,
      generatedAt: control.securityReports.generatedAt,
      loadingState: control.securityReports.loadingState,
      metrics: { ...control.securityReports.metrics },
      rangeLabel: control.securityReports.rangeLabel,
      selectedRange: control.securityReports.selectedRange,
      status: control.securityReports.status,
      summary: control.securityReports.summary,
      warnings: [...control.securityReports.warnings]
    },
    storeReports: {
      breakdowns: [
        ...control.storeReports.storesByPlan.map((item) => ({ ...item })),
        ...control.storeReports.storesByStatus.map((item) => ({ ...item }))
      ],
      errorMessage: control.storeReports.errorMessage,
      generatedAt: control.storeReports.generatedAt,
      loadingState: control.storeReports.loadingState,
      metrics: { ...control.storeReports.metrics },
      rangeLabel: control.storeReports.rangeLabel,
      selectedRange: control.storeReports.selectedRange,
      status: control.storeReports.status,
      summary: control.storeReports.summary,
      warnings: [...control.storeReports.warnings]
    },
    subscriptionReports: {
      breakdowns: [
        ...control.subscriptionReports.subscriptionsByPlan.map((item) => ({ ...item })),
        ...control.subscriptionReports.subscriptionsByStatus.map((item) => ({ ...item }))
      ],
      errorMessage: control.subscriptionReports.errorMessage,
      generatedAt: control.subscriptionReports.generatedAt,
      loadingState: control.subscriptionReports.loadingState,
      metrics: { ...control.subscriptionReports.metrics },
      rangeLabel: control.subscriptionReports.rangeLabel,
      selectedRange: control.subscriptionReports.selectedRange,
      status: control.subscriptionReports.status,
      summary: control.subscriptionReports.summary,
      warnings: [...control.subscriptionReports.warnings]
    },
    userReports: {
      breakdowns: control.userReports.usersByRole.map((item) => ({ ...item })),
      errorMessage: control.userReports.errorMessage,
      generatedAt: control.userReports.generatedAt,
      loadingState: control.userReports.loadingState,
      metrics: { ...control.userReports.metrics },
      rangeLabel: control.userReports.rangeLabel,
      selectedRange: control.userReports.selectedRange,
      status: control.userReports.status,
      summary: control.userReports.summary,
      warnings: [...control.userReports.warnings]
    }
  };
}

export async function GET(request: NextRequest) {
  const format = exportFormat(request.nextUrl.searchParams.get("format"));
  const reportKey = request.nextUrl.searchParams.get("reportKey")?.trim() ?? null;
  const rangeParam = request.nextUrl.searchParams.get("range");
  const range =
    rangeParam === "today" ||
    rangeParam === "7d" ||
    rangeParam === "30d" ||
    rangeParam === "month" ||
    rangeParam === "year"
      ? rangeParam
      : "30d";
  const filters = parseReportFilterQuery({
    action: request.nextUrl.searchParams.get("action") ?? undefined,
    availability: request.nextUrl.searchParams.get("availability") ?? undefined,
    category: request.nextUrl.searchParams.get("category") ?? undefined,
    certification: request.nextUrl.searchParams.get("certification") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    visibility: request.nextUrl.searchParams.get("visibility") ?? undefined
  });
  const access = await getAdminAccess();
  const control = await getAdminReportingControl(range, { filters, view: reportKey });
  const moduleSnapshots = buildModuleSnapshots(control);
  const registryReports =
    reportKey === "rp-1-reports-registry"
      ? control.reportExport.registryReportsForExport
      : control.reports.map((report) => ({
          category: report.category,
          name: report.name,
          reportKey: report.reportKey,
          roadmapPhase: report.roadmapPhase,
          runtimeStatus: report.runtimeStatus,
          status: report.status
        }));
  const exportSnapshot = runReportExportSnapshot(
    buildReportExportRuntimeInput({
      adapterLoadingStateByReportKey: {
        "rp-2-revenue-reports": control.revenueReports.loadingState,
        "rp-3-store-reports": control.storeReports.loadingState,
        "rp-4-user-reports": control.userReports.loadingState,
        "rp-5-subscription-reports": control.subscriptionReports.loadingState,
        "rp-6-payment-reports": control.paymentReports.loadingState,
        "rp-7-ai-reports": control.aiReports.loadingState,
        "rp-8-domain-email-reports": control.domainEmailReports.loadingState,
        "rp-9-marketplace-reports": control.marketplaceReports.loadingState,
        "rp-10-security-reports": control.securityReports.loadingState,
        "rp-11-operations-reports": control.operationsReports.loadingState
      },
      filters,
      moduleSnapshots,
      registryReports,
      range,
      selectedReportKey: reportKey
    })
  );
  const validation = validateReportExportRequest({
    exportSnapshot,
    format,
    moduleSnapshots,
    range,
    registryReports,
    reportKey,
    superAdmin: access.internalRole === "super_admin"
  });

  if (!validation.available) {
    return NextResponse.json({ error: validation.errorMessage }, { status: validation.status });
  }

  const filename = `report-${reportKey}-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "json") {
    return NextResponse.json(validation.payload, {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  }

  return new NextResponse(reportExportPayloadToCsv(validation.payload, reportKey ?? "report"), {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8"
    }
  });
}
