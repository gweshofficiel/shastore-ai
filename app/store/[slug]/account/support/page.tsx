import type { Metadata } from "next";
import {
  AccountLookupForm,
  CustomerAccountShell,
  EmptyAccountCard,
  StatusPill
} from "@/components/storefront/customer-account-shell";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import {
  createCustomerSupportTicketAction,
  replyCustomerSupportTicketAction
} from "@/lib/store-support-actions";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SupportPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    phone?: string;
    support?: string;
    ticketId?: string;
  }>;
};

type TicketRow = {
  category: string;
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  id: string;
  priority: string;
  status: string;
  subject: string;
  ticket_number: string;
  updated_at: string;
};

type MessageRow = {
  created_at: string;
  id: string;
  message: string;
  sender_type: "customer" | "staff";
  ticket_id: string;
};

const categories = [
  "Order Issue",
  "Delivery Issue",
  "Refund Request",
  "Return Request",
  "Product Question",
  "Technical Issue",
  "Other"
];
const priorities = ["Low", "Medium", "High", "Urgent"];

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    assigned: "Ticket assigned.",
    closed: "Ticket closed.",
    created: "Support ticket created.",
    failed: "Support ticket could not be created.",
    invalid: "Complete all required support fields.",
    "not-authorized": "We could not verify that ticket for this phone number.",
    "reply-failed": "Reply could not be sent.",
    replied: "Reply sent.",
    unavailable: "Support tickets are not configured yet."
  };

  return status ? messages[status] ?? null : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

async function loadCustomerSupport({
  phone,
  storeId,
  ticketId,
  workspaceId
}: {
  phone: string;
  storeId: string;
  ticketId?: string;
  workspaceId: string | null;
}) {
  const admin = createAdminClient();

  if (!admin || !phone) {
    return { messages: [] as MessageRow[], selectedTicket: null as TicketRow | null, tickets: [] as TicketRow[] };
  }

  let query = admin
    .from("store_support_tickets" as never)
    .select("id, ticket_number, customer_name, customer_phone, customer_email, subject, category, priority, status, created_at, updated_at")
    .eq("store_id" as never, storeId as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(100);

  if (workspaceId) {
    query = query.eq("workspace_id" as never, workspaceId as never);
  }

  const { data } = await query;
  const normalizedPhone = normalizePhone(phone);
  const tickets = ((data ?? []) as unknown as TicketRow[]).filter(
    (ticket) => normalizePhone(ticket.customer_phone) === normalizedPhone
  );
  const selectedTicket = tickets.find((ticket) => ticket.id === ticketId) ?? tickets[0] ?? null;

  if (!selectedTicket) {
    return { messages: [] as MessageRow[], selectedTicket: null, tickets };
  }

  const { data: messagesData } = await admin
    .from("store_support_ticket_messages" as never)
    .select("id, ticket_id, sender_type, message, created_at")
    .eq("store_id" as never, storeId as never)
    .eq("ticket_id" as never, selectedTicket.id as never)
    .order("created_at" as never, { ascending: true } as never);

  return {
    messages: (messagesData ?? []) as unknown as MessageRow[],
    selectedTicket,
    tickets
  };
}

export async function generateMetadata({ params }: SupportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Support | ${preview.store.title}` : "Support not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerSupportPage({ params, searchParams }: SupportPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This support portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({ storeId: preview.store.id, supabase: admin })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <Unavailable title="This storefront is temporarily unavailable." />;
  }

  const { messages, selectedTicket, tickets } = await loadCustomerSupport({
    phone,
    storeId: preview.store.id,
    ticketId: query.ticketId,
    workspaceId: preview.store.workspaceId
  });
  const message = statusMessage(query.support);
  const returnTo = `/store/${preview.store.slug}/account/support?phone=${encodeURIComponent(phone)}${selectedTicket ? `&ticketId=${encodeURIComponent(selectedTicket.id)}` : ""}`;

  return (
    <CustomerAccountShell
      active="support"
      currency={preview.store.currency}
      description="Open support tickets, reply to store staff, and track support conversations for this store."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Support"
    >
      {message ? (
        <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6">
          {!phone ? (
            <EmptyAccountCard title="Enter your phone number" text="Use the same phone number from checkout to view and create support tickets." />
          ) : (
            <>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Ticket thread</p>
                {selectedTicket ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">{selectedTicket.subject}</h2>
                        <p className="mt-1 text-sm font-bold text-muted">#{selectedTicket.ticket_number} · {formatDate(selectedTicket.updated_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill label={selectedTicket.status} />
                        <StatusPill label={selectedTicket.priority} />
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {messages.map((item) => (
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
                              {item.sender_type === "customer" ? "You" : "Store staff"}
                            </p>
                            <p className="text-xs font-bold text-slate-400">{formatDate(item.created_at)}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">{item.message}</p>
                        </div>
                      ))}
                    </div>
                    <form action={replyCustomerSupportTicketAction} className="mt-5 grid gap-3">
                      <input name="phone" type="hidden" value={phone} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <input name="ticketId" type="hidden" value={selectedTicket.id} />
                      <textarea
                        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        name="message"
                        placeholder="Write your reply..."
                        required
                      />
                      <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
                        Send reply
                      </button>
                    </form>
                  </>
                ) : (
                  <EmptyAccountCard title="No tickets yet" text="Create your first support ticket using the form on the right." />
                )}
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Your tickets</p>
                <div className="mt-4 grid gap-3">
                  {tickets.length ? tickets.map((ticket) => (
                    <a
                      className={`rounded-2xl border p-4 transition hover:border-slate-300 ${
                        selectedTicket?.id === ticket.id ? "border-ink bg-slate-50" : "border-slate-200 bg-white"
                      }`}
                      href={`/store/${preview.store.slug}/account/support?phone=${encodeURIComponent(phone)}&ticketId=${encodeURIComponent(ticket.id)}`}
                      key={ticket.id}
                    >
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">#{ticket.ticket_number}</p>
                      <p className="mt-1 font-black text-ink">{ticket.subject}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill label={ticket.status} />
                        <StatusPill label={ticket.category} />
                      </div>
                    </a>
                  )) : (
                    <p className="text-sm font-semibold text-muted">No support tickets yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="grid h-fit gap-6">
          <AccountLookupForm phone={phone} />
          {phone ? (
            <form action={createCustomerSupportTicketAction} className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <input name="phone" type="hidden" value={phone} />
              <input name="slug" type="hidden" value={preview.store.slug} />
              <input name="storeId" type="hidden" value={preview.store.id} />
              <input name="workspaceId" type="hidden" value={preview.store.workspaceId ?? ""} />
              <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Create ticket</h2>
              <TextInput label="Name" name="name" placeholder="Your name" required />
              <TextInput label="Email optional" name="email" placeholder="you@example.com" type="email" />
              <TextInput label="Subject" name="subject" placeholder="How can we help?" required />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Category</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" name="category" required>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Priority</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="Medium" name="priority" required>
                  {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Message</span>
                <textarea className="min-h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="message" placeholder="Describe the issue..." required />
              </label>
              <button className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800" type="submit">
                Create ticket
              </button>
            </form>
          ) : null}
        </aside>
      </section>
    </CustomerAccountShell>
  );
}

function TextInput({
  label,
  name,
  placeholder,
  required,
  type = "text"
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function Unavailable({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">{title}</h1>
      </div>
    </main>
  );
}
