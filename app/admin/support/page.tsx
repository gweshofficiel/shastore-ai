import { Card } from "@/components/ui/card";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

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

export default async function AdminSupportPage() {
  await getAdminAccess();
  const admin = createAdminClient();
  const { data, error } = admin
    ? await admin
        .from("support_tickets" as never)
        .select("id, workspace_id, store_id, user_id, event_id, ticket_number, status, priority, subject, message, technical_snapshot, created_at, updated_at")
        .order("created_at" as never, { ascending: false } as never)
        .limit(200)
    : { data: [], error: new Error("Admin client unavailable") };
  const tickets = ((data ?? []) as unknown as SupportTicketRow[]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          Platform Support
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950">
          Support Tickets
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
          Review support escalations created from Monitoring events with full internal technical snapshots.
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            Support tickets could not be loaded.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {tickets.length ? (
            tickets.map((ticket) => (
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
                  Status management placeholder
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
    </div>
  );
}
