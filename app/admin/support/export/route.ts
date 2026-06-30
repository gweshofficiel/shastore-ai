import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-access";
import { getAdminSupportControl } from "@/lib/admin/data";
import { parseSupportFilterQuery } from "@/src/lib/support/support-filters-runtime";
import {
  recordSupportExportAttempt,
  resolveSupportExportAuthorization,
  supportExportPayloadToCsv,
  validateSupportExportRequest,
  type SupportExportFormat,
  type SupportExportRuntimeInput,
  type SupportExportSectionKey
} from "@/src/lib/support/support-export-runtime";
import { resolveSupportVisibilityAuthorization } from "@/src/lib/support/support-visibility-runtime";

export const dynamic = "force-dynamic";

function exportFormat(value: string | null): SupportExportFormat | null {
  return value === "csv" || value === "json" ? value : null;
}

function exportSection(value: string | null): SupportExportSectionKey | null {
  const allowed: SupportExportSectionKey[] = [
    "all",
    "analytics_summary",
    "audit_records",
    "error_events",
    "event_timeline",
    "metrics",
    "monitoring_events",
    "notification_summary",
    "review_records",
    "ticket_assignment_history",
    "ticket_conversation_summary",
    "ticket_details_summary",
    "ticket_status_history",
    "tickets"
  ];

  return value && allowed.includes(value as SupportExportSectionKey) ? (value as SupportExportSectionKey) : null;
}

function buildExportInput(
  control: Awaited<ReturnType<typeof getAdminSupportControl>>,
  filterQuery: ReturnType<typeof parseSupportFilterQuery>,
  searchQuery: string | null,
  selectedTicketId: string | null,
  access: Awaited<ReturnType<typeof getAdminAccess>>
) {
  return {
    analyticsRuntime: control.visibleSupportAnalyticsRuntime,
    authorization: resolveSupportExportAuthorization({ role: access.role }),
    filterQuery,
    filtersApplied: control.supportFiltersRuntime.appliedFilterCount > 0,
    loadError: control.loadError,
    metricsRuntime: control.visibleSupportMetricsRuntime,
    searchQuery,
    selectedTicketDetail: control.visibleTicketDetail,
    selectedTicketId,
    visibilityAuthorization: resolveSupportVisibilityAuthorization({ role: access.role }),
    visibleAuditItems: control.visibleSupportAuditRuntimeItems,
    visibleConversationMessages: control.visibleTicketConversationMessages,
    visibleErrorEvents: control.visibleErrorEventsRuntimeItems,
    visibleEventTimeline: control.visibleEventTimelineRuntimeItems,
    visibleMonitoringEvents: control.visibleMonitoringEventsRuntimeItems,
    visibleNotificationItems: control.visibleSupportNotificationsRuntimeItems,
    visibleReviewItems: control.visibleSupportReviewRuntimeItems,
    visibleTickets: control.visibleTicketsRuntimeItems,
    hiddenRecordCount: control.supportVisibilityRuntime.hiddenRecordCount,
    restrictedRecordCount: control.supportVisibilityRuntime.restrictedRecordCount
  };
}

export async function GET(request: NextRequest) {
  const format = exportFormat(request.nextUrl.searchParams.get("format"));
  const section = exportSection(request.nextUrl.searchParams.get("section"));
  const searchQuery = request.nextUrl.searchParams.get("q")?.trim() || null;
  const selectedTicketId = request.nextUrl.searchParams.get("ticket")?.trim() || null;
  const filterQuery = parseSupportFilterQuery({
    agent: request.nextUrl.searchParams.get("agent") ?? undefined,
    category: request.nextUrl.searchParams.get("category") ?? undefined,
    eventSeverity: request.nextUrl.searchParams.get("eventSeverity") ?? undefined,
    eventSource: request.nextUrl.searchParams.get("eventSource") ?? undefined,
    eventStatus: request.nextUrl.searchParams.get("eventStatus") ?? undefined,
    eventType: request.nextUrl.searchParams.get("eventType") ?? undefined,
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    priority: request.nextUrl.searchParams.get("priority") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    store: request.nextUrl.searchParams.get("store") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
    user: request.nextUrl.searchParams.get("user") ?? undefined,
    workspace: request.nextUrl.searchParams.get("workspace") ?? undefined
  });
  const access = await getAdminAccess();

  if (access.role !== "super_admin") {
    await recordSupportExportAttempt({
      access,
      format: format ?? "json",
      recordCount: 0,
      resultCode: "unauthorized",
      section: section ?? "all"
    }).catch(() => undefined);

    return NextResponse.json({ error: "Support export requires Super Admin authorization." }, { status: 403 });
  }

  const control = await getAdminSupportControl({
    filterQuery: {
      agent: filterQuery.agent ?? undefined,
      category: filterQuery.category ?? undefined,
      eventSeverity: filterQuery.eventSeverity ?? undefined,
      eventSource: filterQuery.eventSource ?? undefined,
      eventStatus: filterQuery.eventStatus ?? undefined,
      eventType: filterQuery.eventType ?? undefined,
      from: filterQuery.from ?? undefined,
      priority: filterQuery.priority ?? undefined,
      status: filterQuery.status ?? undefined,
      store: filterQuery.store ?? undefined,
      to: filterQuery.to ?? undefined,
      user: filterQuery.user ?? undefined,
      workspace: filterQuery.workspace ?? undefined
    },
    searchQuery,
    ticketId: selectedTicketId
  });
  const exportInput = buildExportInput(control, filterQuery, searchQuery, selectedTicketId, access) as SupportExportRuntimeInput;
  const validation = validateSupportExportRequest({
    exportInput,
    format,
    section
  });

  if (!validation.available) {
    await recordSupportExportAttempt({
      access,
      format: format ?? "json",
      recordCount: 0,
      resultCode: validation.resultCode,
      section: section ?? "all"
    }).catch(() => undefined);

    return NextResponse.json({ error: validation.errorMessage }, { status: validation.status });
  }

  await recordSupportExportAttempt({
    access,
    format: format!,
    recordCount: validation.recordCount,
    resultCode: "success",
    section: section ?? "all"
  }).catch(() => undefined);

  const filename = `support-export-${section ?? "all"}-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === "json") {
    return NextResponse.json(validation.payload, {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  }

  return new NextResponse(supportExportPayloadToCsv(validation.payload), {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8"
    }
  });
}
