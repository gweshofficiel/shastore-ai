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

function supportFlagTone(value: boolean) {
  return value ? ("green" as const) : ("slate" as const);
}

export default async function AdminSupportPage() {
  await getAdminAccess();
  const control = await getAdminSupportControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Support runtime registry and read-only ticket review. SP-1 registry metadata loads without ticket mutation, assignment, notification dispatch, or provider calls."
        title="Support"
      />

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

      <AdminStatGrid
        stats={[
          { label: "Tickets", value: control.stats.tickets },
          { label: "Open tickets", value: control.stats.openTickets },
          { label: "Monitoring events", value: control.stats.monitoringEvents },
          { label: "Error events", value: control.stats.errorEvents }
        ]}
      />

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {control.tickets.length ? (
            control.tickets.map((ticket) => (
              <div className="grid gap-4 p-5" key={ticket.id}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg font-black text-slate-950">
                      Ticket {ticket.ticket_number}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Created {formatDate(ticket.created_at)} - Last update {formatDate(ticket.updated_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className="h-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      {ticket.priority}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 md:grid-cols-2">
                  <p>Workspace: {ticket.workspace_id ?? "Not provided"}</p>
                  <p>Store: {ticket.store_id ?? "Not provided"}</p>
                  <p>User: {ticket.user_id ?? "Not provided"}</p>
                  <p>Monitoring event: {ticket.event_id ?? "Not provided"}</p>
                </div>

                <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-slate-950">
                    Full technical snapshot
                  </summary>
                  <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-white p-4 text-xs leading-5 text-slate-700">
                    {JSON.stringify(ticket.technical_snapshot ?? {}, null, 2)}
                  </pre>
                </details>

                <p className="rounded-2xl bg-white p-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Status management reserved for the next support operations phase
                </p>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm font-semibold text-slate-500">
              No support tickets yet.
            </p>
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
