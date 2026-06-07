import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  addConversationNotePlaceholder,
  archiveConversationPlaceholder,
  linkConversationLeadPlaceholder,
  markConversationReadPlaceholder,
  replyConversationPlaceholder
} from "@/lib/reseller-showcase/message-actions";
import {
  getResellerMessagesData,
  type ResellerConversation,
  type ResellerConversationStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type MessagesPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerConversationStatus) {
  if (status === "unread") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "read") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "archived") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-blue-100 text-blue-700";
}

function ConversationHiddenFields({ conversation }: { conversation: ResellerConversation | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/messages" />
      <input name="conversationReference" type="hidden" value={conversation?.id ?? "conversation-placeholder"} />
      <input name="relatedItem" type="hidden" value={conversation?.relatedItem ?? "Related item placeholder"} />
      <input name="relatedLead" type="hidden" value={conversation?.relatedLead ?? "Lead placeholder"} />
      <input name="itemType" type="hidden" value={conversation?.itemType ?? "custom request"} />
    </>
  );
}

function ConversationActions({ conversation }: { conversation: ResellerConversation | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markConversationReadPlaceholder}>
        <ConversationHiddenFields conversation={conversation} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Mark as read
        </button>
      </form>
      <form action={archiveConversationPlaceholder}>
        <ConversationHiddenFields conversation={conversation} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Archive
        </button>
      </form>
      <form action={linkConversationLeadPlaceholder}>
        <ConversationHiddenFields conversation={conversation} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Link to lead
        </button>
      </form>
    </div>
  );
}

export default async function ResellerMessagesPage({ searchParams }: MessagesPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerMessagesData()]);
  const selected = data.selectedConversation;

  return (
    <>
      <PageHeader
        description="Private reseller conversation foundation for leads, listings, templates, and custom requests. No real-time chat or external messages are sent yet."
        title="Messaging Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Message placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {data.inbox.map((item) => (
          <Card className="p-5" key={item.key}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-3xl font-black text-ink">{item.count}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Conversation list</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.conversations.length ? (
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Related item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Preview</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Unread</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.conversations.map((conversation) => (
                    <tr key={conversation.id}>
                      <td className="px-4 py-4">
                        <p className="font-black text-ink">{conversation.buyerDisplayName}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{conversation.contactMasked}</p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{conversation.relatedItem}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{conversation.itemType}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{conversation.lastMessagePreview}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(conversation.status)}`}>
                          {conversation.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-ink">{conversation.unreadCount}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{conversation.createdAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{conversation.lastActivity ?? "Not tracked"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">{data.emptyState}</p>
            )}
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Conversation detail</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.buyerDisplayName ?? "No conversation selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Related lead: {selected?.relatedLead ?? "No related lead yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Related listing/template: {selected?.relatedItem ?? "No related item yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Internal notes: {selected?.internalNotes ?? "No internal notes yet."}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-black text-ink">Safe message timeline</p>
            <div className="mt-3 grid gap-2">
              {(selected?.timeline ?? ["No messages yet.", "Future real-time chat and buyer forms will appear here."]).map((event) => (
                <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted" key={event}>
                  {event}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <ConversationActions conversation={selected} />
          </div>

          <form action={addConversationNotePlaceholder} className="mt-4 grid gap-3">
            <ConversationHiddenFields conversation={selected} />
            <textarea
              className="min-h-24 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="note"
              placeholder="Add internal note placeholder. This is private to the reseller dashboard foundation."
            />
            <button className="h-10 w-fit rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
              Add internal note
            </button>
          </form>

          <form action={replyConversationPlaceholder} className="mt-4 grid gap-3">
            <ConversationHiddenFields conversation={selected} />
            <textarea
              className="min-h-24 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="reply"
              placeholder="Reply placeholder only. No email, SMS, WhatsApp, or real-time chat is sent."
            />
            <button className="h-10 w-fit rounded-full bg-violet-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
              Reply placeholder
            </button>
          </form>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Conversations are private dashboard-only placeholders. Buyer email and phone remain masked,
          no public messages are shown, no external email/SMS/WhatsApp is sent, and no order,
          ownership transfer, wallet, payout, withdrawal, commission, or fake sale is created.
        </p>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
