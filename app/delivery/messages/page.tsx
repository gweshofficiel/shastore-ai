import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import {
  archiveDeliveryConversationAction,
  markDeliveryMessagesReadAction,
  sendDeliveryReplyAction
} from "@/lib/delivery/communication-actions";
import { getDeliveryMessages } from "@/lib/delivery/communication-data";
import { requireDeliveryAccess } from "@/lib/delivery/access";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function senderLabel(value: string) {
  if (value === "owner") {
    return "Store Owner";
  }

  if (value === "system") {
    return "System";
  }

  return "Delivery";
}

function statusMessage(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  const messages: Record<string, string> = {
    "archive-failed": "Conversation could not be archived.",
    "conversation-archived": "Conversation archived.",
    "message-failed": "Message could not be sent.",
    "message-invalid": "Enter a message before sending.",
    "message-sent": "Message sent.",
    "messages-read": "Messages marked read."
  };

  return status ? messages[status] ?? null : null;
}

export default async function DeliveryMessagesPage({
  searchParams
}: {
  searchParams?: Promise<{ delivery?: string | string[] }>;
}) {
  const query = await searchParams;
  const { agent } = await requireDeliveryAccess();
  const messages = agent
    ? await getDeliveryMessages({
        agentId: agent.agentId,
        storeId: agent.storeId,
        workspaceId: agent.workspaceId
      })
    : [];
  const pageMessage = statusMessage(query?.delivery);
  const unreadCount = messages.filter((message) => message.status === "unread" && message.senderType !== "delivery").length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery messages
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Communication Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Owner to delivery and system to delivery messages for assigned operations.
                </p>
              </div>
              <span className="rounded-full bg-emerald-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                {unreadCount} unread
              </span>
            </div>
          </section>

          {pageMessage ? (
            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
              {pageMessage}
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Inbox
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
                    Conversation
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={markDeliveryMessagesReadAction}>
                    <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                      Mark read
                    </button>
                  </form>
                  <form action={archiveDeliveryConversationAction}>
                    <button className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                      Archive conversation
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {messages.length ? messages.map((item) => (
                  <article className={`rounded-2xl border p-4 ${
                    item.senderType === "delivery"
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-slate-100 bg-slate-50"
                  }`} key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">{senderLabel(item.senderType)}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.message}</p>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    No messages yet.
                  </div>
                )}
              </div>
            </div>

            <form action={sendDeliveryReplyAction} className="h-fit rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Reply
              </p>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-emerald-950">
                <span>Message</span>
                <textarea
                  className="min-h-36 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  name="message"
                  placeholder="Reply to the store owner."
                  required
                />
              </label>
              <button className="mt-4 h-11 rounded-2xl bg-emerald-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white" type="submit">
                Send reply
              </button>
              <div className="mt-5 rounded-2xl bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Future hooks
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
                  Push notifications, email, WhatsApp, SMS, mobile app notifications, and real-time updates are prepared as future channels.
                </p>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
