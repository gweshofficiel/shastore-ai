import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import {
  createPlatformSupportTicketConversationMessageAction,
  updatePlatformSupportTicketAssignmentAction,
  updatePlatformSupportTicketStatusAction
} from "@/lib/admin/support-actions";
import { getAdminAccess } from "@/lib/admin-access";
import { getAdminSupportControl } from "@/lib/admin/data";
import {
  supportDashboardRuntimeStatusBadgeTone,
  supportDashboardRuntimeStatusLabel,
  type SupportDashboardRuntimeStatus
} from "@/src/lib/support/support-dashboard-runtime";
import type { SupportTicketDetailState } from "@/src/lib/support/support-ticket-details-runtime";
import { buildSupportTicketDetailHref } from "@/src/lib/support/support-ticket-details-runtime";
import {
  supportTicketCanonicalStatusBadgeTone,
  supportTicketCanonicalStatusLabel,
  supportTicketStatusTransitionMessage,
  type SupportTicketCanonicalStatus,
  type SupportTicketStatusTransitionResultCode
} from "@/src/lib/support/support-ticket-status-runtime";
import {
  supportMonitoringEventSeverityBadgeTone,
  supportMonitoringEventSeverityLabel,
  type SupportMonitoringEventSeverity
} from "@/src/lib/support/support-monitoring-events-runtime";
import {
  supportErrorEventSeverityBadgeTone,
  supportErrorEventSeverityLabel,
  type SupportErrorEventSeverity
} from "@/src/lib/support/support-error-events-runtime";
import {
  supportEventTimelineSeverityBadgeTone,
  supportEventTimelineSeverityLabel,
  type SupportEventTimelineSeverity
} from "@/src/lib/support/support-event-timeline-runtime";
import {
  supportSearchRuntimeStatusBadgeTone
} from "@/src/lib/support/support-search-runtime";
import {
  supportFiltersRuntimeStatusBadgeTone
} from "@/src/lib/support/support-filters-runtime";
import {
  supportTicketAssignmentResultMessage,
  type SupportTicketAssignmentResultCode
} from "@/src/lib/support/support-ticket-assignment-runtime";
import {
  supportTicketConversationAuthorRoleLabel,
  supportTicketConversationResultMessage,
  supportTicketConversationVisibilityLabel,
  type SupportTicketConversationResultCode
} from "@/src/lib/support/support-ticket-conversation-runtime";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "in_progress" || status === "pending" || status === "in_review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function toneForTicketStatusRuntimeStatus(status: string) {
  if (status === "status_runtime_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForStatusTransitionResult(result: string) {
  if (result === "success" || result === "unchanged") {
    return "green" as const;
  }

  if (result === "unauthorized" || result === "invalid" || result === "not_found" || result === "error") {
    return "red" as const;
  }

  return "slate" as const;
}

function toneForRegistryStatus(status: string) {
  if (status === "registry_ready" || status === "production_ready" || status === "ready") {
    return "green" as const;
  }

  if (status === "architectural" || status === "registered" || status === "needs_attention") {
    return "amber" as const;
  }

  if (status === "planned") {
    return "blue" as const;
  }

  return "slate" as const;
}

function supportFlagLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function toneForTicketsRuntimeStatus(status: string) {
  if (status === "tickets_runtime_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function TicketsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Assign", "Update Status", "Close", "Reopen"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No ticket action is executed during SP-3 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function toneForDashboardStatus(status: string) {
  if (status === "dashboard_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function supportFlagTone(value: boolean) {
  return value ? ("green" as const) : ("slate" as const);
}

function toneForTicketDetailsRuntimeStatus(status: string) {
  if (status === "ticket_details_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForTicketDetailState(state: SupportTicketDetailState) {
  if (state === "available") {
    return "green" as const;
  }

  if (state === "error" || state === "not_found") {
    return "red" as const;
  }

  return "slate" as const;
}

function MonitoringEventsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Acknowledge", "Resolve", "Export"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No monitoring action is executed during SP-8 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function toneForMonitoringEventsRuntimeStatus(status: string) {
  if (status === "monitoring_events_runtime_ready") {
    return "green" as const;
  }

  if (status === "unauthorized") {
    return "red" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function ErrorEventsSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Acknowledge", "Resolve", "Export"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No error action is executed during SP-9 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function toneForErrorEventsRuntimeStatus(status: string) {
  if (status === "error_events_runtime_ready") {
    return "green" as const;
  }

  if (status === "unauthorized") {
    return "red" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function EventTimelineSafeControls() {
  return (
    <div className="flex min-w-52 flex-wrap gap-2">
      {["Inspect", "Export"].map((label) => (
        <button
          key={label}
          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
          disabled
          title="Read-only placeholder. No timeline action is executed during SP-10 page load."
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function toneForEventTimelineRuntimeStatus(status: string) {
  if (status === "event_timeline_runtime_ready") {
    return "green" as const;
  }

  if (status === "unauthorized") {
    return "red" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForTicketConversationRuntimeStatus(status: string) {
  if (status === "conversation_runtime_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForConversationTransitionResult(result: string) {
  return toneForStatusTransitionResult(result);
}

function toneForTicketAssignmentRuntimeStatus(status: string) {
  if (status === "assignment_runtime_ready") {
    return "green" as const;
  }

  if (status === "needs_attention" || status === "load_error") {
    return "amber" as const;
  }

  return "slate" as const;
}

function toneForAssignmentTransitionResult(result: string) {
  return toneForStatusTransitionResult(result);
}

function activityTone(activityType: string) {
  if (activityType === "error") {
    return "red" as const;
  }

  if (activityType === "ticket") {
    return "blue" as const;
  }

  return "slate" as const;
}

export default async function AdminSupportPage({
  searchParams
}: {
  searchParams: Promise<{
    agent?: string;
    assignmentResult?: string;
    category?: string;
    conversationResult?: string;
    eventSeverity?: string;
    eventSource?: string;
    eventStatus?: string;
    eventType?: string;
    from?: string;
    priority?: string;
    q?: string;
    status?: string;
    statusResult?: string;
    store?: string;
    ticket?: string;
    to?: string;
    user?: string;
    workspace?: string;
  }>;
}) {
  await getAdminAccess();
  const query = await searchParams;
  const statusResult = query.statusResult?.trim() || null;
  const assignmentResult = query.assignmentResult?.trim() || null;
  const conversationResult = query.conversationResult?.trim() || null;
  const control = await getAdminSupportControl({
    filterQuery: query,
    searchQuery: query.q ?? null,
    ticketId: query.ticket ?? null
  });
  const activeFilters = control.supportFiltersRuntime.query;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Support dashboard runtime powered by the SP-1 registry. Dashboard cards and sections load from read-only ticket and monitoring aggregates without mutation, assignment, or provider calls."
        title="Support"
      />

      {statusResult ? (
        <Card
          className={
            statusResult === "success" || statusResult === "unchanged"
              ? "border-emerald-200 bg-emerald-50 p-5"
              : statusResult === "unauthorized" || statusResult === "error" || statusResult === "not_found"
                ? "border-red-200 bg-red-50 p-5"
                : "border-amber-200 bg-amber-50 p-5"
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <AdminBadge tone={toneForStatusTransitionResult(statusResult)}>{statusResult}</AdminBadge>
            <p className="text-sm font-semibold text-slate-800">
              {supportTicketStatusTransitionMessage(statusResult as SupportTicketStatusTransitionResultCode)}
            </p>
          </div>
        </Card>
      ) : null}

      {assignmentResult ? (
        <Card
          className={
            assignmentResult === "success" || assignmentResult === "unchanged"
              ? "border-emerald-200 bg-emerald-50 p-5"
              : assignmentResult === "unauthorized" || assignmentResult === "error" || assignmentResult === "not_found"
                ? "border-red-200 bg-red-50 p-5"
                : "border-amber-200 bg-amber-50 p-5"
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <AdminBadge tone={toneForAssignmentTransitionResult(assignmentResult)}>{assignmentResult}</AdminBadge>
            <p className="text-sm font-semibold text-slate-800">
              {supportTicketAssignmentResultMessage(assignmentResult as SupportTicketAssignmentResultCode)}
            </p>
          </div>
        </Card>
      ) : null}

      {conversationResult ? (
        <Card
          className={
            conversationResult === "success"
              ? "border-emerald-200 bg-emerald-50 p-5"
              : conversationResult === "unauthorized" || conversationResult === "error" || conversationResult === "not_found"
                ? "border-red-200 bg-red-50 p-5"
                : "border-amber-200 bg-amber-50 p-5"
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <AdminBadge tone={toneForConversationTransitionResult(conversationResult)}>{conversationResult}</AdminBadge>
            <p className="text-sm font-semibold text-slate-800">
              {supportTicketConversationResultMessage(conversationResult as SupportTicketConversationResultCode)}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Support dashboard</span>
        <AdminBadge tone={toneForDashboardStatus(control.dashboard.status)}>{control.dashboard.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.dashboard.summary}</span>
      </div>

      <AdminStatGrid stats={control.dashboardStats} />

      {control.dashboardSections.map((section) => (
        <AdminTable
          key={section.key}
          empty={`No ${section.title.toLowerCase()} modules registered.`}
          headers={[
            `${section.title} module`,
            "Category",
            "Runtime status",
            "Visibility",
            "Monitoring",
            "Audit",
            "Health",
            "Description"
          ]}
        >
          {section.items.map((item) => (
            <tr key={item.key}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.title}</td>
              <td className="px-5 py-4 text-slate-600">{item.category}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportDashboardRuntimeStatusBadgeTone(item.runtimeStatus as SupportDashboardRuntimeStatus)}>
                  {supportDashboardRuntimeStatusLabel(item.runtimeStatus as SupportDashboardRuntimeStatus)}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{item.visibility}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportFlagTone(item.monitoringSupport)}>{supportFlagLabel(item.monitoringSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportFlagTone(item.auditSupport)}>{supportFlagLabel(item.auditSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={supportFlagTone(item.healthSupport)}>{supportFlagLabel(item.healthSupport)}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{item.description}</td>
            </tr>
          ))}
        </AdminTable>
      ))}

      <AdminTable
        empty="No recent support activity recorded yet."
        headers={["Activity", "Type", "Status", "Created", "Safe summary"]}
      >
        {control.recentActivity.map((activity) => (
          <tr key={activity.activityKey}>
            <td className="px-5 py-4 font-bold text-slate-950">{activity.title}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={activityTone(activity.activityType)}>{activity.activityType}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{activity.status}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(activity.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{activity.safeSummary}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty="No ticket records yet."
        headers={["Ticket", "Subject", "Status", "Priority", "Created", "Updated"]}
      >
        {control.latestTickets.map((ticket) => (
          <tr key={ticket.recordKey}>
            <td className="px-5 py-4 font-bold text-slate-950">{ticket.ticketNumber}</td>
            <td className="px-5 py-4 text-slate-600">{ticket.subject}</td>
            <td className="px-5 py-4 text-slate-600">
              <AdminBadge tone={supportTicketCanonicalStatusBadgeTone(ticket.status as SupportTicketCanonicalStatus)}>
                {supportTicketCanonicalStatusLabel(ticket.status as SupportTicketCanonicalStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{ticket.priority}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(ticket.createdAt)}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(ticket.updatedAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty="No monitoring records yet."
        headers={["Event", "Status", "Entity", "Created", "Safe summary"]}
      >
        {control.latestMonitoringRecords.map((record) => (
          <tr key={record.recordKey}>
            <td className="px-5 py-4 font-bold text-slate-950">{record.eventType}</td>
            <td className="px-5 py-4 text-slate-600">{record.eventStatus}</td>
            <td className="px-5 py-4 text-slate-600">{record.entityType}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(record.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{record.safeSummary}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty="No error records yet."
        headers={["Error event", "Status", "Entity", "Created", "Safe summary"]}
      >
        {control.latestErrorRecords.map((record) => (
          <tr key={record.recordKey}>
            <td className="px-5 py-4 font-bold text-slate-950">{record.eventType}</td>
            <td className="px-5 py-4 text-slate-600">{record.eventStatus}</td>
            <td className="px-5 py-4 text-slate-600">{record.entityType}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(record.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{record.safeSummary}</td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Tickets runtime</span>
        <AdminBadge tone={toneForTicketsRuntimeStatus(control.ticketsRuntime.status)}>
          {control.ticketsRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.ticketsRuntime.summary}</span>
      </div>

      {control.ticketsRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.ticketsRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Total tickets", value: String(control.ticketsRuntime.totalTickets) },
          { label: "Open", value: String(control.ticketsRuntime.openTickets) },
          { label: "In review", value: String(control.ticketsRuntime.inReviewTickets) },
          { label: "Urgent", value: String(control.ticketsRuntime.urgentTickets) }
        ]}
      />

      {control.ticketsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">
              {group.itemCount} ticket{group.itemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ))}

      <AdminTable
        empty="No support tickets yet. Ticket records appear here when created through the platform support flow."
        headers={[
          "Ticket ID",
          "Subject",
          "Status",
          "Priority",
          "Category",
          "Created",
          "Last updated",
          "Assigned agent",
          "Related scope",
          "Safe controls"
        ]}
      >
        {control.filteredTicketsRuntimeItems.map((ticket) => (
          <tr
            className={control.selectedTicketId === ticket.ticketId ? "bg-blue-50/60" : undefined}
            key={ticket.ticketKey}
          >
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <Link
                  className="font-bold text-blue-700 hover:text-blue-900"
                  href={buildSupportTicketDetailHref(ticket.ticketId)}
                >
                  {ticket.ticketNumber}
                </Link>
                <span className="text-xs text-slate-500">{ticket.ticketId}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{ticket.subject}</td>
            <td className="px-5 py-4">
              <AdminBadge
                tone={supportTicketCanonicalStatusBadgeTone(ticket.status as SupportTicketCanonicalStatus)}
              >
                {supportTicketCanonicalStatusLabel(ticket.status as SupportTicketCanonicalStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{ticket.priority}</td>
            <td className="px-5 py-4 text-slate-600">{ticket.category}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(ticket.createdAt)}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(ticket.lastUpdatedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{ticket.assignedAgentLabel}</td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1 text-xs">
                <span>Workspace: {ticket.relatedWorkspaceId ?? "n/a"}</span>
                <span>Store: {ticket.relatedStoreId ?? "n/a"}</span>
                <span>User: {ticket.relatedUserId ?? "n/a"}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <TicketsSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ticket details runtime</span>
        <AdminBadge tone={toneForTicketDetailsRuntimeStatus(control.ticketDetailsRuntime.status)}>
          {control.ticketDetailsRuntime.status}
        </AdminBadge>
        <AdminBadge tone={toneForTicketDetailState(control.ticketDetailsRuntime.detailState)}>
          {control.ticketDetailsRuntime.detailState}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.ticketDetailsRuntime.summary}</span>
      </div>

      {control.ticketDetailsRuntime.loadingState === "unselected" ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-600">
            Select a ticket from the Tickets runtime table to view read-only ticket details. No status, assignment, or
            conversation actions run during SP-4 page load.
          </p>
        </Card>
      ) : null}

      {control.ticketDetailsRuntime.detailState === "not_found" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            Ticket not found. The selected ticket ID does not match an existing support ticket record.
          </p>
          {control.selectedTicketId ? (
            <p className="mt-2 text-xs font-semibold text-red-700">Requested ticket: {control.selectedTicketId}</p>
          ) : null}
        </Card>
      ) : null}

      {control.ticketDetailsRuntime.detailState === "error" || control.ticketDetailsRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">
            {control.ticketDetailsRuntime.loadError ?? "Ticket details could not be loaded safely."}
          </p>
        </Card>
      ) : null}

      {control.ticketDetail ? (
        <Card className="grid gap-5 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ticket details</p>
              <h3 className="text-xl font-black text-slate-950">Ticket {control.ticketDetail.ticketNumber}</h3>
              <p className="text-sm text-slate-500">{control.ticketDetail.ticketId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminBadge
                tone={supportTicketCanonicalStatusBadgeTone(
                  control.ticketDetail.status as SupportTicketCanonicalStatus
                )}
              >
                {supportTicketCanonicalStatusLabel(control.ticketDetail.status as SupportTicketCanonicalStatus)}
              </AdminBadge>
              <AdminBadge tone="slate">{control.ticketDetail.priority}</AdminBadge>
              <AdminBadge tone="slate">{control.ticketDetail.category}</AdminBadge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Subject</span>
              <p className="text-sm font-semibold text-slate-900">{control.ticketDetail.subject}</p>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Assigned agent</span>
              <p className="text-sm font-semibold text-slate-900">{control.ticketDetail.assignedAgentLabel}</p>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Created</span>
              <p className="text-sm text-slate-700">{formatAdminDate(control.ticketDetail.createdAt)}</p>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Last updated</span>
              <p className="text-sm text-slate-700">{formatAdminDate(control.ticketDetail.lastUpdatedAt)}</p>
            </div>
          </div>

          <div className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Description</span>
            <p className="text-sm leading-6 text-slate-700">{control.ticketDetail.description}</p>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-3">
            <p>
              <span className="font-bold text-slate-900">Workspace:</span>{" "}
              {control.ticketDetail.relatedWorkspaceId ?? "Not provided"}
            </p>
            <p>
              <span className="font-bold text-slate-900">Store:</span>{" "}
              {control.ticketDetail.relatedStoreId ?? "Not provided"}
            </p>
            <p>
              <span className="font-bold text-slate-900">User:</span>{" "}
              {control.ticketDetail.relatedUserId ?? "Not provided"}
            </p>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ticket conversation</span>
              <AdminBadge tone={toneForTicketConversationRuntimeStatus(control.ticketConversationRuntime.status)}>
                {control.ticketConversationRuntime.status}
              </AdminBadge>
              <AdminBadge tone={control.ticketConversationRuntime.creationFoundation === "available" ? "green" : "slate"}>
                {control.ticketConversationRuntime.creationFoundation}
              </AdminBadge>
              <span className="text-xs text-slate-500">{control.ticketConversationRuntime.messageCount} messages</span>
            </div>

            {control.ticketConversationRuntime.loadError ? (
              <Card className="border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">{control.ticketConversationRuntime.loadError}</p>
              </Card>
            ) : null}

            {control.ticketConversationRuntime.emptyMessage ? (
              <p className="text-sm text-slate-600">{control.ticketConversationRuntime.emptyMessage}</p>
            ) : null}

            {control.ticketConversationMessages.length ? (
              <div className="grid gap-3">
                {control.ticketConversationMessages.map((message) => (
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4" key={message.messageKey}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-950">{message.author}</span>
                      <AdminBadge tone="slate">
                        {supportTicketConversationAuthorRoleLabel(message.authorRole)}
                      </AdminBadge>
                      <AdminBadge tone="blue">
                        {supportTicketConversationVisibilityLabel(message.visibility)}
                      </AdminBadge>
                      {message.attachmentsIndicator === "available" ? (
                        <AdminBadge tone="amber">Attachments</AdminBadge>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      Message {message.messageId} · {formatAdminDate(message.createdAt)}
                    </p>
                    <p className="text-sm leading-6 text-slate-700">{message.messageBody}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {control.ticketConversationRuntime.canCreateMessage ? (
              <form action={createPlatformSupportTicketConversationMessageAction} className="grid gap-3">
                <input name="ticketId" type="hidden" value={control.ticketDetail.ticketId} />
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Add message
                  <textarea
                    className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    maxLength={4000}
                    name="messageBody"
                    placeholder="Write a Super Admin support note or reply. No message is sent automatically on page load."
                    required
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Visibility
                  <select
                    className="h-10 max-w-xs rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    defaultValue="internal"
                    name="visibility"
                  >
                    <option value="internal">Internal</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </label>
                <button
                  className="h-10 w-fit rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                  type="submit"
                >
                  Add message
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                Conversation message creation is read-only for this account. Only Super Admin may add messages through
                explicit form submission.
              </p>
            )}
          </div>

          {control.ticketDetail.relatedMonitoringEventState === "not_linked" ? (
            <p className="text-sm text-slate-500">No related monitoring or error event is linked to this ticket.</p>
          ) : null}

          {control.ticketDetail.relatedMonitoringEventState === "not_found" ? (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Linked monitoring event not found for event ID {control.ticketDetail.eventId ?? "unknown"}.
              </p>
            </Card>
          ) : null}

          {control.ticketDetail.relatedMonitoringEvent ? (
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Related monitoring event
                </span>
                <AdminBadge tone={control.ticketDetail.relatedMonitoringEvent.isErrorEvent ? "red" : "slate"}>
                  {control.ticketDetail.relatedMonitoringEvent.isErrorEvent ? "error event" : "monitoring event"}
                </AdminBadge>
              </div>
              <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-bold text-slate-900">Event type:</span>{" "}
                  {control.ticketDetail.relatedMonitoringEvent.eventType}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Status:</span>{" "}
                  {control.ticketDetail.relatedMonitoringEvent.eventStatus}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Entity:</span>{" "}
                  {control.ticketDetail.relatedMonitoringEvent.entityType}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Created:</span>{" "}
                  {formatAdminDate(control.ticketDetail.relatedMonitoringEvent.createdAt)}
                </p>
                <p className="md:col-span-2">
                  <span className="font-bold text-slate-900">Event ID:</span>{" "}
                  {control.ticketDetail.relatedMonitoringEvent.eventId}
                </p>
              </div>
              <p className="text-sm text-slate-600">{control.ticketDetail.relatedMonitoringEvent.safeSummary}</p>
            </div>
          ) : null}

          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Notifications remain reserved for later support phases
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ticket status runtime</span>
        <AdminBadge tone={toneForTicketStatusRuntimeStatus(control.ticketStatusRuntime.status)}>
          {control.ticketStatusRuntime.status}
        </AdminBadge>
        <AdminBadge tone={control.ticketStatusRuntime.transitionFoundation === "available" ? "green" : "slate"}>
          {control.ticketStatusRuntime.transitionFoundation}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.ticketStatusRuntime.summary}</span>
      </div>

      {control.ticketStatusRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.ticketStatusRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={control.ticketStatusRuntime.allowedStatuses.map((status) => ({
          label: supportTicketCanonicalStatusLabel(status as SupportTicketCanonicalStatus),
          value: status
        }))}
      />

      {control.selectedTicketStatus ? (
        <Card className="grid gap-4 p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-black text-slate-950">Selected ticket status</span>
            <AdminBadge
              tone={supportTicketCanonicalStatusBadgeTone(
                control.selectedTicketStatus.canonicalStatus as SupportTicketCanonicalStatus
              )}
            >
              {supportTicketCanonicalStatusLabel(
                control.selectedTicketStatus.canonicalStatus as SupportTicketCanonicalStatus
              )}
            </AdminBadge>
            <span className="text-xs text-slate-500">Storage: {control.selectedTicketStatus.storageStatus}</span>
          </div>

          <p className="text-sm text-slate-600">{control.selectedTicketStatus.transitionNote}</p>

          {control.selectedTicketStatus.canMutateStatus && control.selectedTicketStatus.allowedTransitions.length ? (
            <form action={updatePlatformSupportTicketStatusAction} className="flex flex-wrap items-end gap-3">
              <input name="ticketId" type="hidden" value={control.selectedTicketStatus.ticketId} />
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Transition to
                <select
                  className="h-10 min-w-48 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  defaultValue={control.selectedTicketStatus.allowedTransitions[0]}
                  name="status"
                  required
                >
                  {control.selectedTicketStatus.allowedTransitions.map((status) => (
                    <option key={status} value={status}>
                      {supportTicketCanonicalStatusLabel(status as SupportTicketCanonicalStatus)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                type="submit"
              >
                Update status
              </button>
            </form>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Status transitions are read-only for this account or no further transitions are available from the
              current status.
            </p>
          )}
        </Card>
      ) : (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-600">
            Select a ticket to inspect its current status and available transitions. Status never changes automatically
            during page load.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ticket assignment runtime</span>
        <AdminBadge tone={toneForTicketAssignmentRuntimeStatus(control.ticketAssignmentRuntime.status)}>
          {control.ticketAssignmentRuntime.status}
        </AdminBadge>
        <AdminBadge tone={control.ticketAssignmentRuntime.transitionFoundation === "available" ? "green" : "slate"}>
          {control.ticketAssignmentRuntime.transitionFoundation}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.ticketAssignmentRuntime.summary}</span>
      </div>

      {control.ticketAssignmentRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.ticketAssignmentRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Eligible agents", value: String(control.ticketAssignmentRuntime.eligibleAgentCount) },
          {
            label: "Assignment column",
            value: control.ticketAssignmentRuntime.assignmentColumnDetected ? "detected" : "missing"
          },
          {
            label: "Selected assignment",
            value: control.selectedTicketAssignment?.assignmentState ?? "unselected"
          },
          {
            label: "Foundation",
            value: control.ticketAssignmentRuntime.transitionFoundation
          }
        ]}
      />

      <AdminTable
        empty="No eligible support agents found. Active internal team members with support_agent or admin role appear here."
        headers={["Agent", "Email", "Role", "Status", "User ID"]}
      >
        {control.eligibleSupportAgents.map((agent) => (
          <tr key={agent.agentKey}>
            <td className="px-5 py-4 font-bold text-slate-950">{agent.displayName}</td>
            <td className="px-5 py-4 text-slate-600">{agent.email}</td>
            <td className="px-5 py-4 text-slate-600">{agent.role}</td>
            <td className="px-5 py-4">
              <AdminBadge tone="green">{agent.status}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-500">{agent.userId}</td>
          </tr>
        ))}
      </AdminTable>

      {control.selectedTicketAssignment ? (
        <Card className="grid gap-4 p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-black text-slate-950">Selected ticket assignment</span>
            <AdminBadge tone={control.selectedTicketAssignment.assignmentState === "assigned" ? "green" : "slate"}>
              {control.selectedTicketAssignment.assignmentState}
            </AdminBadge>
            <span className="text-sm text-slate-700">{control.selectedTicketAssignment.assignedAgentLabel}</span>
          </div>

          <p className="text-sm text-slate-600">{control.selectedTicketAssignment.transitionNote}</p>

          {control.selectedTicketAssignment.canMutateAssignment && control.eligibleSupportAgents.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <form action={updatePlatformSupportTicketAssignmentAction} className="flex flex-wrap items-end gap-3">
                <input name="ticketId" type="hidden" value={control.selectedTicketAssignment.ticketId} />
                <label className="grid flex-1 gap-1 text-xs font-semibold text-slate-600">
                  Assign to agent
                  <select
                    className="h-10 min-w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    defaultValue={control.selectedTicketAssignment.assignedAgentId ?? ""}
                    name="assignedUserId"
                    required
                  >
                    <option disabled value="">
                      Select support agent
                    </option>
                    {control.eligibleSupportAgents.map((agent) => (
                      <option key={agent.agentKey} value={agent.userId}>
                        {agent.displayName} ({agent.role})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                  type="submit"
                >
                  Assign ticket
                </button>
              </form>

              {control.selectedTicketAssignment.assignedAgentId ? (
                <form action={updatePlatformSupportTicketAssignmentAction} className="flex items-end gap-3">
                  <input name="ticketId" type="hidden" value={control.selectedTicketAssignment.ticketId} />
                  <input name="unassign" type="hidden" value="true" />
                  <button
                    className="h-10 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-800"
                    type="submit"
                  >
                    Unassign ticket
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Ticket assignment is read-only for this account, no eligible agents are available, or no ticket is
              selected.
            </p>
          )}
        </Card>
      ) : (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-600">
            Select a ticket to view assignment state and assign or unassign a support agent. Assignment never changes
            automatically during page load.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Monitoring events runtime</span>
        <AdminBadge tone={toneForMonitoringEventsRuntimeStatus(control.monitoringEventsRuntime.status)}>
          {control.monitoringEventsRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.monitoringEventsRuntime.summary}</span>
      </div>

      {control.monitoringEventsRuntime.status === "unauthorized" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            You are not authorized to view Support monitoring events with the current account.
          </p>
        </Card>
      ) : null}

      {control.monitoringEventsRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.monitoringEventsRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Total events", value: String(control.monitoringEventsRuntime.totalEvents) },
          { label: "Critical", value: String(control.monitoringEventsRuntime.criticalEvents) },
          { label: "Warning", value: String(control.monitoringEventsRuntime.warningEvents) },
          {
            label: "Table",
            value: control.monitoringEventsRuntime.tableDetected ? "detected" : "missing"
          }
        ]}
      />

      {control.monitoringEventsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">
              {group.itemCount} event{group.itemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ))}

      <AdminTable
        empty="No monitoring events recorded yet. Events appear here when platform monitoring records them safely."
        headers={[
          "Event ID",
          "Event type",
          "Severity",
          "Source",
          "Status",
          "Related ticket",
          "Related scope",
          "Created",
          "Last updated",
          "Safe controls"
        ]}
      >
        {control.filteredMonitoringEventsRuntimeItems.map((event) => (
          <tr key={event.eventKey}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{event.eventId}</span>
                <span className="text-xs text-slate-500">{event.entityType}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.eventType}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportMonitoringEventSeverityBadgeTone(event.severity as SupportMonitoringEventSeverity)}>
                {supportMonitoringEventSeverityLabel(event.severity as SupportMonitoringEventSeverity)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.source}</td>
            <td className="px-5 py-4 text-slate-600">{event.status}</td>
            <td className="px-5 py-4 text-slate-600">
              {event.relatedTicketState === "available" ? (
                <div className="grid gap-1">
                  <span>{event.relatedTicketNumber}</span>
                  <span className="text-xs text-slate-500">{event.relatedTicketId}</span>
                </div>
              ) : (
                "Not linked"
              )}
            </td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1 text-xs">
                <span>Workspace: {event.relatedWorkspaceId ?? "n/a"}</span>
                <span>Store: {event.relatedStoreId ?? "n/a"}</span>
                <span>User: {event.relatedUserId ?? "n/a"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(event.createdAt)}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(event.lastUpdatedAt)}</td>
            <td className="px-5 py-4">
              <MonitoringEventsSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Error events runtime</span>
        <AdminBadge tone={toneForErrorEventsRuntimeStatus(control.errorEventsRuntime.status)}>
          {control.errorEventsRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.errorEventsRuntime.summary}</span>
      </div>

      {control.errorEventsRuntime.status === "unauthorized" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            You are not authorized to view Support error events with the current account.
          </p>
        </Card>
      ) : null}

      {control.errorEventsRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.errorEventsRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Total errors", value: String(control.errorEventsRuntime.totalEvents) },
          { label: "Critical", value: String(control.errorEventsRuntime.criticalEvents) },
          { label: "Warning", value: String(control.errorEventsRuntime.warningEvents) },
          {
            label: "Table",
            value: control.errorEventsRuntime.tableDetected ? "detected" : "missing"
          }
        ]}
      />

      {control.errorEventsRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">
              {group.itemCount} error{group.itemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ))}

      <AdminTable
        empty="No error events recorded yet. Failed monitoring events appear here when platform signals record them safely."
        headers={[
          "Error ID",
          "Error type",
          "Severity",
          "Source",
          "Status",
          "Error message summary",
          "Related ticket",
          "Related scope",
          "Created",
          "Last updated",
          "Safe controls"
        ]}
      >
        {control.filteredErrorEventsRuntimeItems.map((event) => (
          <tr key={event.errorKey}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{event.errorId}</span>
                <span className="text-xs text-slate-500">{event.entityType}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.errorType}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportErrorEventSeverityBadgeTone(event.severity as SupportErrorEventSeverity)}>
                {supportErrorEventSeverityLabel(event.severity as SupportErrorEventSeverity)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.source}</td>
            <td className="px-5 py-4 text-slate-600">{event.status}</td>
            <td className="px-5 py-4 text-slate-600">{event.errorMessageSummary}</td>
            <td className="px-5 py-4 text-slate-600">
              {event.relatedTicketState === "available" ? (
                <div className="grid gap-1">
                  <span>{event.relatedTicketNumber}</span>
                  <span className="text-xs text-slate-500">{event.relatedTicketId}</span>
                </div>
              ) : (
                "Not linked"
              )}
            </td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1 text-xs">
                <span>Workspace: {event.relatedWorkspaceId ?? "n/a"}</span>
                <span>Store: {event.relatedStoreId ?? "n/a"}</span>
                <span>User: {event.relatedUserId ?? "n/a"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(event.createdAt)}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(event.lastUpdatedAt)}</td>
            <td className="px-5 py-4">
              <ErrorEventsSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Event timeline runtime</span>
        <AdminBadge tone={toneForEventTimelineRuntimeStatus(control.eventTimelineRuntime.status)}>
          {control.eventTimelineRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.eventTimelineRuntime.summary}</span>
      </div>

      {control.eventTimelineRuntime.status === "unauthorized" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            You are not authorized to view the Support event timeline with the current account.
          </p>
        </Card>
      ) : null}

      {control.eventTimelineRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.eventTimelineRuntime.loadError}</p>
        </Card>
      ) : null}

      <AdminStatGrid
        stats={[
          { label: "Total items", value: String(control.eventTimelineRuntime.totalItems) },
          { label: "Tickets", value: String(control.eventTimelineRuntime.ticketEventCount) },
          { label: "Monitoring", value: String(control.eventTimelineRuntime.monitoringEventCount) },
          { label: "Errors", value: String(control.eventTimelineRuntime.errorEventCount) },
          { label: "Status changes", value: String(control.eventTimelineRuntime.statusChangeCount) },
          { label: "Assignments", value: String(control.eventTimelineRuntime.assignmentChangeCount) },
          { label: "Conversation", value: String(control.eventTimelineRuntime.conversationActivityCount) }
        ]}
      />

      {control.eventTimelineRuntimeGroups.map((group) => (
        <div key={group.groupKey} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{group.title}</span>
            <span className="text-xs text-slate-500">
              {group.itemCount} item{group.itemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ))}

      <AdminTable
        empty="No timeline events recorded yet. Ticket, monitoring, and conversation activity appears here when platform records exist."
        headers={[
          "Timeline item ID",
          "Event type",
          "Source",
          "Severity",
          "Status",
          "Related ticket",
          "Related scope",
          "Actor",
          "Created",
          "Safe controls"
        ]}
      >
        {control.filteredEventTimelineRuntimeItems.map((item) => (
          <tr key={item.timelineItemKey}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{item.timelineItemId}</span>
                <span className="text-xs text-slate-500">{item.safeSummary}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{item.eventTypeLabel}</td>
            <td className="px-5 py-4 text-slate-600">{item.source}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportEventTimelineSeverityBadgeTone(item.severity as SupportEventTimelineSeverity | null)}>
                {supportEventTimelineSeverityLabel(item.severity as SupportEventTimelineSeverity | null)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{item.status ?? "n/a"}</td>
            <td className="px-5 py-4 text-slate-600">
              {item.relatedTicketState === "available" ? (
                <div className="grid gap-1">
                  <span>{item.relatedTicketNumber}</span>
                  <span className="text-xs text-slate-500">{item.relatedTicketId}</span>
                </div>
              ) : (
                "Not linked"
              )}
            </td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1 text-xs">
                <span>Workspace: {item.relatedWorkspaceId ?? "n/a"}</span>
                <span>Store: {item.relatedStoreId ?? "n/a"}</span>
                <span>User: {item.relatedUserId ?? "n/a"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{item.actorLabel ?? "n/a"}</td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(item.createdAt)}</td>
            <td className="px-5 py-4">
              <EventTimelineSafeControls />
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Support filters runtime</span>
        <AdminBadge tone={supportFiltersRuntimeStatusBadgeTone(control.supportFiltersRuntime.status)}>
          {control.supportFiltersRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.supportFiltersRuntime.summary}</span>
      </div>

      {control.supportFiltersRuntime.status === "unauthorized" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            You are not authorized to apply Support filters with the current account.
          </p>
        </Card>
      ) : null}

      {control.supportFiltersRuntime.emptyMessage ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-600">{control.supportFiltersRuntime.emptyMessage}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          href={control.supportFiltersRuntime.resetHref}
        >
          Reset filters
        </Link>
        <span className="text-xs text-slate-500">
          {control.supportFiltersRuntime.appliedFilterCount > 0
            ? `${control.supportFiltersRuntime.filteredCounts.tickets}/${control.supportFiltersRuntime.totalCounts.tickets} tickets visible`
            : "Submit filters to narrow tickets, monitoring, error, and timeline views"}
        </span>
      </div>

      <form action="/admin/support" className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5" method="get">
        {control.selectedTicketId ? <input name="ticket" type="hidden" value={control.selectedTicketId} /> : null}
        {control.supportSearchRuntime.query.q ? (
          <input name="q" type="hidden" value={control.supportSearchRuntime.query.q} />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Ticket status
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.status ?? ""}
              list="support-filter-statuses"
              name="status"
              placeholder="open, in_progress, resolved"
            />
            <datalist id="support-filter-statuses">
              {control.supportFiltersRuntime.filterOptions.statuses.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Ticket priority
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.priority ?? ""}
              list="support-filter-priorities"
              name="priority"
              placeholder="normal, high, urgent"
            />
            <datalist id="support-filter-priorities">
              {control.supportFiltersRuntime.filterOptions.priorities.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Ticket category
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.category ?? ""}
              list="support-filter-categories"
              name="category"
              placeholder="platform support, store related"
            />
            <datalist id="support-filter-categories">
              {control.supportFiltersRuntime.filterOptions.categories.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Assigned agent
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.agent ?? ""}
              list="support-filter-agents"
              name="agent"
              placeholder="Agent ID or label"
            />
            <datalist id="support-filter-agents">
              {control.supportFiltersRuntime.filterOptions.agents.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Event type
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.eventType ?? ""}
              list="support-filter-event-types"
              name="eventType"
              placeholder="support_ticket_status_changed"
            />
            <datalist id="support-filter-event-types">
              {control.supportFiltersRuntime.filterOptions.eventTypes.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Event severity
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.eventSeverity ?? ""}
              list="support-filter-severities"
              name="eventSeverity"
              placeholder="critical, warning, info"
            />
            <datalist id="support-filter-severities">
              {control.supportFiltersRuntime.filterOptions.eventSeverities.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Event source
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.eventSource ?? ""}
              list="support-filter-sources"
              name="eventSource"
              placeholder="Support Platform"
            />
            <datalist id="support-filter-sources">
              {control.supportFiltersRuntime.filterOptions.eventSources.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Event status
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.eventStatus ?? ""}
              list="support-filter-event-statuses"
              name="eventStatus"
              placeholder="failed, success, recorded"
            />
            <datalist id="support-filter-event-statuses">
              {control.supportFiltersRuntime.filterOptions.eventStatuses.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Date from
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.from ?? ""}
              name="from"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Date to
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.to ?? ""}
              name="to"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Related workspace
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.workspace ?? ""}
              name="workspace"
              placeholder="Workspace ID"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Related store
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.store ?? ""}
              name="store"
              placeholder="Store ID"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Related user
            <input
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              defaultValue={activeFilters.user ?? ""}
              name="user"
              placeholder="User ID"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
            type="submit"
          >
            Apply filters
          </button>
          <span className="text-xs text-slate-500">
            Filters apply to tickets, monitoring events, error events, timeline, and search results.
          </span>
        </div>
      </form>

      {control.supportFiltersRuntime.activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {control.supportFiltersRuntime.activeFilters.map((filter) => (
            <span
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
              key={`${filter.dimension}-${filter.value}`}
            >
              {filter.label}: {filter.value}
            </span>
          ))}
        </div>
      ) : null}

      {control.supportFiltersRuntime.appliedFilterCount > 0 ? (
        <AdminStatGrid
          stats={[
            { label: "Filtered tickets", value: String(control.supportFiltersRuntime.filteredCounts.tickets) },
            { label: "Filtered monitoring", value: String(control.supportFiltersRuntime.filteredCounts.monitoringEvents) },
            { label: "Filtered errors", value: String(control.supportFiltersRuntime.filteredCounts.errorEvents) },
            { label: "Filtered timeline", value: String(control.supportFiltersRuntime.filteredCounts.eventTimeline) },
            {
              label: "Filtered search",
              value: String(control.supportFiltersRuntime.filteredCounts.searchResults)
            }
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Support search runtime</span>
        <AdminBadge tone={supportSearchRuntimeStatusBadgeTone(control.supportSearchRuntime.status)}>
          {control.supportSearchRuntime.status}
        </AdminBadge>
        <span className="text-sm text-slate-600">{control.supportSearchRuntime.summary}</span>
      </div>

      {control.supportSearchRuntime.status === "unauthorized" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            You are not authorized to search Support records with the current account.
          </p>
        </Card>
      ) : null}

      {control.supportSearchRuntime.loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">{control.supportSearchRuntime.loadError}</p>
        </Card>
      ) : null}

      {control.supportSearchRuntime.emptyMessage ? (
        <Card className="border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-600">{control.supportSearchRuntime.emptyMessage}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          href={control.supportSearchRuntime.resetHref}
        >
          Reset search
        </Link>
        <span className="text-xs text-slate-500">
          {control.supportSearchRuntime.query.q
            ? `${control.supportSearchRuntime.matchedResultCount}/${control.supportSearchRuntime.totalCandidateCount} records matched`
            : "Submit a keyword to search tickets, events, and timeline records"}
        </span>
      </div>

      <form action="/admin/support" className="flex flex-wrap items-end gap-2" method="get">
        {control.selectedTicketId ? (
          <input name="ticket" type="hidden" value={control.selectedTicketId} />
        ) : null}
        {activeFilters.status ? <input name="status" type="hidden" value={activeFilters.status} /> : null}
        {activeFilters.priority ? <input name="priority" type="hidden" value={activeFilters.priority} /> : null}
        {activeFilters.category ? <input name="category" type="hidden" value={activeFilters.category} /> : null}
        {activeFilters.agent ? <input name="agent" type="hidden" value={activeFilters.agent} /> : null}
        {activeFilters.eventType ? <input name="eventType" type="hidden" value={activeFilters.eventType} /> : null}
        {activeFilters.eventSeverity ? (
          <input name="eventSeverity" type="hidden" value={activeFilters.eventSeverity} />
        ) : null}
        {activeFilters.eventSource ? <input name="eventSource" type="hidden" value={activeFilters.eventSource} /> : null}
        {activeFilters.eventStatus ? <input name="eventStatus" type="hidden" value={activeFilters.eventStatus} /> : null}
        {activeFilters.from ? <input name="from" type="hidden" value={activeFilters.from} /> : null}
        {activeFilters.to ? <input name="to" type="hidden" value={activeFilters.to} /> : null}
        {activeFilters.workspace ? <input name="workspace" type="hidden" value={activeFilters.workspace} /> : null}
        {activeFilters.store ? <input name="store" type="hidden" value={activeFilters.store} /> : null}
        {activeFilters.user ? <input name="user" type="hidden" value={activeFilters.user} /> : null}
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Search keyword
          <input
            className="h-10 min-w-64 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
            defaultValue={control.supportSearchRuntime.query.q ?? ""}
            name="q"
            placeholder="Ticket ID, subject, status, event type, severity, source, scope"
            type="search"
          />
        </label>
        <button
          className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
          type="submit"
        >
          Apply search
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Search runs only after explicit submit. No queries execute while the keyword field is empty.
      </p>

      {control.supportSearchRuntime.searchableFields.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {control.supportSearchRuntime.searchableFields.map((field) => (
            <span
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
              key={field}
            >
              {field}
            </span>
          ))}
        </div>
      ) : null}

      {control.supportSearchRuntime.query.q ? (
        <AdminStatGrid
          stats={[
            { label: "Matched results", value: String(control.filteredSearchResults.length) },
            { label: "Candidates scanned", value: String(control.supportSearchRuntime.totalCandidateCount) },
            {
              label: "Tickets table",
              value: control.supportSearchRuntime.tablesDetected.supportTickets ? "detected" : "missing"
            },
            {
              label: "Messages table",
              value: control.supportSearchRuntime.tablesDetected.supportTicketMessages ? "detected" : "missing"
            },
            {
              label: "Monitoring table",
              value: control.supportSearchRuntime.tablesDetected.monitoringEvents ? "detected" : "missing"
            }
          ]}
        />
      ) : null}

      {control.supportSearchRuntime.query.q ? (
        <AdminTable
          empty="No Support records match the active search keyword."
          headers={[
            "Record ID",
            "Category",
            "Title",
            "Severity",
            "Status",
            "Source",
            "Matched fields",
            "Related ticket",
            "Related scope",
            "Created"
          ]}
        >
          {control.searchResults.map((result) => (
            <tr key={result.recordKey}>
              <td className="px-5 py-4">
                <div className="grid gap-1">
                  <span className="font-bold text-slate-950">{result.recordId}</span>
                  <span className="text-xs text-slate-500">{result.safeSummary}</span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-600">{result.categoryLabel}</td>
              <td className="px-5 py-4 text-slate-600">
                {result.relatedTicketId ? (
                  <Link
                    className="font-semibold text-blue-700 hover:text-blue-900"
                    href={buildSupportTicketDetailHref(result.relatedTicketId)}
                  >
                    {result.resultTitle}
                  </Link>
                ) : (
                  result.resultTitle
                )}
              </td>
              <td className="px-5 py-4 text-slate-600">{result.severity ?? "n/a"}</td>
              <td className="px-5 py-4 text-slate-600">{result.status ?? "n/a"}</td>
              <td className="px-5 py-4 text-slate-600">{result.source ?? "n/a"}</td>
              <td className="px-5 py-4 text-slate-500">
                <div className="flex flex-wrap gap-1">
                  {result.matchedFields.map((field) => (
                    <span
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                      key={`${result.recordKey}-${field}`}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {result.relatedTicketId ? (
                  <div className="grid gap-1">
                    <Link
                      className="font-semibold text-blue-700 hover:text-blue-900"
                      href={buildSupportTicketDetailHref(result.relatedTicketId)}
                    >
                      {result.relatedTicketNumber}
                    </Link>
                    <span className="text-xs text-slate-500">{result.relatedTicketId}</span>
                  </div>
                ) : (
                  "Not linked"
                )}
              </td>
              <td className="px-5 py-4 text-slate-500">
                <div className="grid gap-1 text-xs">
                  <span>Workspace: {result.relatedWorkspaceId ?? "n/a"}</span>
                  <span>Store: {result.relatedStoreId ?? "n/a"}</span>
                  <span>User: {result.relatedUserId ?? "n/a"}</span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-500">
                {result.createdAt ? formatAdminDate(result.createdAt) : "n/a"}
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Support registry</span>
        <AdminBadge tone={toneForRegistryStatus(control.registry.status)}>{control.registry.status}</AdminBadge>
        <span className="text-sm text-slate-600">{control.registry.summary}</span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Registry entries", value: String(control.registry.totalEntries) },
          { label: "Categories", value: String(control.categories.length) },
          { label: "Production ready", value: String(control.components.filter((item) => item.productionReady).length) },
          { label: "Future hooks", value: String(control.futureHooks.length) }
        ]}
      />

      {control.categories.map((category) => (
        <div key={category.name} className="flex flex-wrap items-center gap-3 px-1">
          <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{category.name}</span>
          <AdminBadge tone={toneForRegistryStatus(category.status)}>{category.status}</AdminBadge>
          <span className="text-xs text-slate-500">{category.entryCount} entries</span>
        </div>
      ))}

      <AdminTable
        headers={[
          "Component",
          "Category",
          "Phase",
          "Runtime",
          "Status",
          "Visibility",
          "Monitoring",
          "Audit",
          "Health",
          "Description"
        ]}
      >
        {control.components.map((component) => (
          <tr key={component.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{component.title}</td>
            <td className="px-5 py-4 text-slate-600">{component.category}</td>
            <td className="px-5 py-4 text-slate-600">{component.roadmapPhase}</td>
            <td className="px-5 py-4 text-slate-600">{component.runtimeType}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForRegistryStatus(component.implementationStatus)}>
                {component.implementationStatus}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{component.visibility}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportFlagTone(component.monitoringSupport)}>
                {supportFlagLabel(component.monitoringSupport)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportFlagTone(component.auditSupport)}>{supportFlagLabel(component.auditSupport)}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={supportFlagTone(component.healthSupport)}>{supportFlagLabel(component.healthSupport)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{component.description}</td>
          </tr>
        ))}
      </AdminTable>

      {control.loadError ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">{control.loadError}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {control.filteredTicketsRuntimeItems.length ? (
            control.filteredTicketsRuntimeItems.map((ticket) => (
              <div className="grid gap-4 p-5" key={ticket.ticketKey}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg font-black text-slate-950">
                      <Link className="hover:text-blue-700" href={buildSupportTicketDetailHref(ticket.ticketId)}>
                        Ticket {ticket.ticketNumber}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{ticket.subject}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Created {formatDate(ticket.createdAt)} - Last update {formatDate(ticket.lastUpdatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <span
                      className={`h-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(ticket.status)}`}
                    >
                      {supportTicketCanonicalStatusLabel(ticket.status as SupportTicketCanonicalStatus)}
                    </span>
                    <span className="h-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      {ticket.priority}
                    </span>
                    <span className="h-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      {ticket.category}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 md:grid-cols-2">
                  <p>Workspace: {ticket.relatedWorkspaceId ?? "Not provided"}</p>
                  <p>Store: {ticket.relatedStoreId ?? "Not provided"}</p>
                  <p>User: {ticket.relatedUserId ?? "Not provided"}</p>
                  <p>Assigned agent: {ticket.assignedAgentLabel}</p>
                  <p>Monitoring event: {ticket.eventId ?? "Not provided"}</p>
                </div>

                <p className="text-sm text-slate-600">{ticket.safeSummary}</p>

                <p className="rounded-2xl bg-white p-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Status management reserved for the next support operations phase
                </p>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm font-semibold text-slate-500">No support tickets yet.</p>
          )}
        </div>
      </Card>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
