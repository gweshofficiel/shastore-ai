import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { isPlatformAdminEmail } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type SupportTicketRow = {
  created_at: string;
  event_id: string | null;
  id: string;
  message: string | null;
  priority: string;
  status: string;
  store_id: string | null;
  subject: string;
  technical_snapshot?: Record<string, unknown> | null;
  ticket_number: string;
  updated_at: string;
  user_id: string | null;
  workspace_id: string | null;
};

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

export default async function SupportPage() {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_notifications",
    redirectTo: "/dashboard/support"
  });
  const isSuperAdmin = isPlatformAdminEmail(user.email, { allowUnconfigured: false }).isAdmin;
  const client = isSuperAdmin ? createAdminClient() ?? supabase : supabase;
  const selectColumns = isSuperAdmin
    ? "id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, message, technical_snapshot, created_at, updated_at"
    : "id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, message, created_at, updated_at";
  let ticketsQuery = client
    .from("support_tickets" as never)
    .select(selectColumns)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  if (!isSuperAdmin) {
    ticketsQuery = ticketsQuery
      .eq("workspace_id" as never, workspaceId as never)
      .eq("user_id" as never, user.id as never);
  }

  const { data, error } = await ticketsQuery;
  const tickets = ((data ?? []) as unknown as SupportTicketRow[]);

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Track support requests created from Monitoring events."
        title="Support"
      />

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            Support tickets could not be loaded.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            {isSuperAdmin ? "All Support Tickets" : "Your Support Tickets"}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {tickets.length ? (
            tickets.map((ticket) => (
              <div className="grid gap-4 p-5" key={ticket.id}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg font-black text-ink">
                      Ticket #{ticket.ticket_number}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Created {formatDate(ticket.created_at)}
                      {" "}-
                      Last update {formatDate(ticket.updated_at)}
                      {isSuperAdmin && ticket.event_id ? ` - Event ${ticket.event_id.slice(0, 8)}` : ""}
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

                {isSuperAdmin ? (
                  <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-black text-ink">
                      Technical snapshot
                    </summary>
                    <div className="mt-4 grid gap-3 text-sm font-semibold text-muted">
                      <p>Workspace: {ticket.workspace_id ?? "Not provided"}</p>
                      <p>Store: {ticket.store_id ?? "Not provided"}</p>
                      <p>User: {ticket.user_id ?? "Not provided"}</p>
                      <p>Event: {ticket.event_id ?? "Not provided"}</p>
                    </div>
                    <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-white p-4 text-xs leading-5 text-slate-700">
                      {JSON.stringify(ticket.technical_snapshot ?? {}, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))
          ) : (
            <p className="p-5 text-sm font-semibold text-muted">
              No support tickets yet. Failed Monitoring events can be reported from the Monitoring page.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
