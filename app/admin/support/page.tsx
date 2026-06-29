import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
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
  supportTicketRuntimeStatusBadgeTone,
  supportTicketRuntimeStatusLabel,
  type SupportTicketRuntimeStatus
} from "@/src/lib/support/support-tickets-runtime";

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

  if (status === "in_review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
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
    ticket?: string;
  }>;
}) {
  await getAdminAccess();
  const query = await searchParams;
  const control = await getAdminSupportControl({
    ticketId: query.ticket ?? null
  });

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Support dashboard runtime powered by the SP-1 registry. Dashboard cards and sections load from read-only ticket and monitoring aggregates without mutation, assignment, or provider calls."
        title="Support"
      />

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
            <td className="px-5 py-4 text-slate-600">{ticket.status}</td>
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
        {control.ticketsRuntimeItems.map((ticket) => (
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
              <AdminBadge tone={supportTicketRuntimeStatusBadgeTone(ticket.runtimeStatus as SupportTicketRuntimeStatus)}>
                {supportTicketRuntimeStatusLabel(ticket.runtimeStatus as SupportTicketRuntimeStatus)}
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
                tone={supportTicketRuntimeStatusBadgeTone(
                  control.ticketDetail.runtimeStatus as SupportTicketRuntimeStatus
                )}
              >
                {supportTicketRuntimeStatusLabel(control.ticketDetail.runtimeStatus as SupportTicketRuntimeStatus)}
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
            Status, assignment, conversation, and safe actions remain reserved for later support phases
          </p>
        </Card>
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
          {control.ticketsRuntimeItems.length ? (
            control.ticketsRuntimeItems.map((ticket) => (
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
                      {ticket.status}
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

      <AdminTable
        empty={!control.monitoringEvents.length ? "No monitoring events recorded yet." : null}
        headers={["Event", "Status", "Entity", "Scope", "Created"]}
      >
        {control.monitoringEvents.slice(0, 25).map((event) => (
          <tr key={event.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{event.event_type}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={event.event_status === "failed" ? "red" : "slate"}>
                {event.event_status}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.entity_type}</td>
            <td className="px-5 py-4 text-slate-500">
              <div className="grid gap-1">
                <span>Workspace: {event.workspace_id ?? "n/a"}</span>
                <span>Store: {event.store_id ?? "n/a"}</span>
                <span>User: {event.user_id ?? "anonymous"}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(event.created_at)}</td>
          </tr>
        ))}
      </AdminTable>

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
