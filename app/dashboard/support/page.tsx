import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  assignSupportTicketAction,
  replyStaffSupportTicketAction,
  updateSupportTicketStatusAction
} from "@/lib/store-support-actions";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type SupportTicketRow = {
  assigned_user_id: string | null;
  category: string;
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  id: string;
  priority: string;
  status: string;
  store_id: string;
  subject: string;
  ticket_number: string;
  updated_at: string;
};

type TicketMessageRow = {
  created_at: string;
  id: string;
  message: string;
  sender_type: "customer" | "staff";
  sender_user_id: string | null;
  ticket_id: string;
};

type TicketEventRow = {
  actor_type: string;
  created_at: string;
  event_type: string;
  id: string;
  message: string;
  new_value: string | null;
  previous_value: string | null;
  ticket_id: string;
};

type StaffMemberRow = {
  role: string | null;
  status: string | null;
  user_id: string;
};

type SupportData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  events: TicketEventRow[];
  members: StaffMemberRow[];
  messages: TicketMessageRow[];
  selectedTicket: SupportTicketRow | null;
  stores: UserStoreRow[];
  tickets: SupportTicketRow[];
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
  if (status === "Resolved" || status === "Closed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "In Progress" || status === "Waiting Customer") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function supportMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    assigned: "Ticket assignment updated.",
    "assign-failed": "Ticket could not be assigned.",
    "invalid-assignee": "That assignee is not an active workspace member.",
    invalid: "Support ticket action was incomplete.",
    "not-authorized": "You can only manage tickets for your stores.",
    "reply-failed": "Reply could not be sent.",
    replied: "Reply sent.",
    "status-failed": "Ticket status could not be updated.",
    updated: "Ticket status updated."
  };

  return value ? messages[value] ?? null : null;
}

function statusOptions() {
  return ["Open", "In Progress", "Waiting Customer", "Resolved", "Closed"];
}

async function getSupportData({
  selectedStatus,
  selectedStoreId,
  selectedTicketId
}: {
  selectedStatus?: string;
  selectedStoreId?: string;
  selectedTicketId?: string;
}): Promise<SupportData> {
  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_view_notifications",
    redirectTo: "/dashboard/support"
  });

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      events: [],
      members: [],
      messages: [],
      selectedTicket: null,
      stores,
      tickets: []
    };
  }

  let ticketsQuery = supabase
    .from("store_support_tickets" as never)
    .select("id, store_id, assigned_user_id, ticket_number, customer_name, customer_phone, customer_email, subject, category, priority, status, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(100);

  if (selectedStatus && statusOptions().includes(selectedStatus)) {
    ticketsQuery = ticketsQuery.eq("status" as never, selectedStatus as never);
  }

  const [{ data, error }, membersResult] = await Promise.all([
    ticketsQuery,
    supabase
      .from("workspace_members" as never)
      .select("user_id, role, status")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("status" as never, "active" as never)
      .order("created_at" as never, { ascending: true } as never)
  ]);
  const tickets = (data ?? []) as unknown as SupportTicketRow[];
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null;

  if (error) {
    return {
      activeStore,
      error: "Support tickets could not be loaded. Apply the support tickets migration.",
      events: [],
      members: [],
      messages: [],
      selectedTicket: null,
      stores,
      tickets: []
    };
  }

  if (!selectedTicket) {
    return {
      activeStore,
      error: null,
      events: [],
      members: (membersResult.data ?? []) as unknown as StaffMemberRow[],
      messages: [],
      selectedTicket: null,
      stores,
      tickets
    };
  }

  const [messagesResult, eventsResult] = await Promise.all([
    supabase
      .from("store_support_ticket_messages" as never)
      .select("id, ticket_id, sender_type, sender_user_id, message, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .eq("ticket_id" as never, selectedTicket.id as never)
      .order("created_at" as never, { ascending: true } as never),
    supabase
      .from("store_support_ticket_events" as never)
      .select("id, ticket_id, actor_type, event_type, previous_value, new_value, message, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .eq("ticket_id" as never, selectedTicket.id as never)
      .order("created_at" as never, { ascending: false } as never)
  ]);

  return {
    activeStore,
    error: null,
    events: (eventsResult.data ?? []) as unknown as TicketEventRow[],
    members: (membersResult.data ?? []) as unknown as StaffMemberRow[],
    messages: (messagesResult.data ?? []) as unknown as TicketMessageRow[],
    selectedTicket,
    stores,
    tickets
  };
}

export default async function SupportPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    storeId?: string;
    supportStatus?: string;
    ticketId?: string;
  }>;
}) {
  const query = await searchParams;
  const { activeStore, error, events, members, messages, selectedTicket, stores, tickets } = await getSupportData({
    selectedStatus: query.status,
    selectedStoreId: query.storeId,
    selectedTicketId: query.ticketId
  });
  const message = supportMessage(query.supportStatus);
  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "Waiting Customer").length;
  const urgentCount = tickets.filter((ticket) => ticket.priority === "Urgent").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Review customer support tickets, reply to conversations, assign staff, and update ticket status."
        title="Support Tickets"
      />

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">
            {error}
          </p>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tickets" value={tickets.length.toLocaleString()} />
        <MetricCard label="Open" value={openCount.toLocaleString()} />
        <MetricCard label="Waiting customer" value={waitingCount.toLocaleString()} />
        <MetricCard label="Urgent" value={urgentCount.toLocaleString()} />
      </section>

      <Card className="p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Store</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStore?.id ?? ""} name="storeId">
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Status</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={query.status ?? ""} name="status">
              <option value="">All statuses</option>
              {statusOptions().map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Filter tickets</Button>
        </form>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Queue</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore ? activeStore.name : "No store selected"}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {tickets.length ? tickets.map((ticket) => (
              <a
                className={`block p-5 transition hover:bg-slate-50 ${
                  selectedTicket?.id === ticket.id ? "bg-slate-50" : "bg-white"
                }`}
                href={`/dashboard/support?storeId=${encodeURIComponent(ticket.store_id)}&ticketId=${encodeURIComponent(ticket.id)}${query.status ? `&status=${encodeURIComponent(query.status)}` : ""}`}
                key={ticket.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">#{ticket.ticket_number}</p>
                    <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-ink">{ticket.subject}</h3>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {ticket.customer_name ?? "Customer"} · {ticket.category}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">Updated {formatDate(ticket.updated_at)}</p>
                </div>
                  <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">{ticket.priority}</span>
                  {ticket.assigned_user_id ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      Assigned
                    </span>
                  ) : null}
                </div>
              </a>
            )) : (
              <p className="p-5 text-sm font-semibold text-muted">No customer support tickets match this filter.</p>
            )}
          </div>
        </Card>

        <div className="grid gap-6">
          {selectedTicket ? (
            <>
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">#{selectedTicket.ticket_number}</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{selectedTicket.subject}</h2>
                    <p className="mt-2 text-sm font-semibold text-muted">
                      {selectedTicket.customer_name ?? "Customer"} · {selectedTicket.customer_phone ?? "No phone"}{selectedTicket.customer_email ? ` · ${selectedTicket.customer_email}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">Created {formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </span>
                    <span className="h-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <form action={updateSupportTicketStatusAction} className="grid gap-2 rounded-2xl bg-slate-50 p-4">
                    <input name="storeId" type="hidden" value={selectedTicket.store_id} />
                    <input name="ticketId" type="hidden" value={selectedTicket.id} />
                    <label className="grid gap-2 text-sm font-semibold text-ink">
                      <span>Status</span>
                      <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={selectedTicket.status} name="status">
                        {statusOptions().map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <button className="h-10 rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                      Change status
                    </button>
                  </form>

                  <form action={assignSupportTicketAction} className="grid gap-2 rounded-2xl bg-slate-50 p-4">
                    <input name="storeId" type="hidden" value={selectedTicket.store_id} />
                    <input name="ticketId" type="hidden" value={selectedTicket.id} />
                    <label className="grid gap-2 text-sm font-semibold text-ink">
                      <span>Assign ticket</span>
                      <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={selectedTicket.assigned_user_id ?? ""} name="assignedUserId">
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.role ?? "staff"} · {member.user_id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="h-10 rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                      Assign
                    </button>
                  </form>
                </div>
              </Card>

              <Card className="p-6">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Conversation</p>
                <div className="mt-5 grid gap-3">
                  {messages.length ? messages.map((item) => (
                    <div
                      className={`rounded-2xl border p-4 ${
                        item.sender_type === "customer"
                          ? "border-blue-100 bg-blue-50"
                          : "border-emerald-100 bg-emerald-50"
                      }`}
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          {item.sender_type === "customer" ? "Customer" : "Staff"}
                        </p>
                        <p className="text-xs font-bold text-slate-400">{formatDate(item.created_at)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">{item.message}</p>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-muted">No messages yet.</p>
                  )}
                </div>
                <form action={replyStaffSupportTicketAction} className="mt-5 grid gap-3">
                  <input name="storeId" type="hidden" value={selectedTicket.store_id} />
                  <input name="ticketId" type="hidden" value={selectedTicket.id} />
                  <textarea
                    className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="message"
                    placeholder="Reply to the customer..."
                    required
                  />
                  <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
                    Send staff reply
                  </button>
                </form>
              </Card>

              <Card className="p-6">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Timeline</p>
                <div className="mt-4 grid gap-3">
                  {events.length ? events.map((event) => (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4" key={event.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-ink">{event.message}</p>
                        <p className="text-xs font-bold text-slate-400">{formatDate(event.created_at)}</p>
                      </div>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        {event.event_type.replaceAll("_", " ")} · {event.actor_type}
                        {event.previous_value || event.new_value ? ` · ${event.previous_value ?? "none"} → ${event.new_value ?? "none"}` : ""}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-muted">No ticket timeline events yet.</p>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No ticket selected</h2>
              <p className="mt-2 text-sm font-semibold text-muted">Customer support tickets will appear here when created from the customer account portal.</p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}
