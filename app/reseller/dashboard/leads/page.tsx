import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  addLeadNotePlaceholder,
  archiveLeadPlaceholder,
  markLeadContactedPlaceholder,
  markLeadLostPlaceholder,
  markLeadNegotiatingPlaceholder
} from "@/lib/reseller-showcase/lead-actions";
import {
  getResellerLeadsData,
  type ResellerLead,
  type ResellerLeadStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerLeadStatus) {
  if (status === "won_placeholder") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "lost" || status === "archived") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "negotiating") {
    return "bg-violet-100 text-violet-700";
  }

  if (status === "contacted") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

function LeadHiddenFields({ lead }: { lead: ResellerLead | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/leads" />
      <input name="leadReference" type="hidden" value={lead?.id ?? "lead-placeholder"} />
      <input name="interestedItem" type="hidden" value={lead?.interestedItem ?? "Lead interest placeholder"} />
      <input name="itemType" type="hidden" value={lead?.itemType ?? "custom request"} />
      <input name="leadSource" type="hidden" value={lead?.source ?? "public_profile_contact"} />
    </>
  );
}

function LeadActions({ lead }: { lead: ResellerLead | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markLeadContactedPlaceholder}>
        <LeadHiddenFields lead={lead} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Mark contacted
        </button>
      </form>
      <form action={markLeadNegotiatingPlaceholder}>
        <LeadHiddenFields lead={lead} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Mark negotiating
        </button>
      </form>
      <form action={markLeadLostPlaceholder}>
        <LeadHiddenFields lead={lead} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Mark lost
        </button>
      </form>
      <form action={archiveLeadPlaceholder}>
        <LeadHiddenFields lead={lead} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Archive
        </button>
      </form>
    </div>
  );
}

export default async function ResellerLeadsPage({ searchParams }: LeadsPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerLeadsData()]);

  return (
    <>
      <PageHeader
        description="Track pre-sale buyer interest separately from reseller orders, ownership transfers, wallets, payouts, and commissions."
        title="Lead Management"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Lead placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total leads</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.totalLeads}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.activeLeads}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Won placeholder</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.wonPlaceholders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Lost</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.lostLeads}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Archived</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.archivedLeads}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Lead statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statusFoundation.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Leads table</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.leads.length ? (
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Interested item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-4 py-4 font-black text-ink">{lead.leadName}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.contactMasked}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.interestedItem}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.itemType}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.source}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.createdAt ?? "Not tracked"}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{lead.lastActivity ?? "Not tracked"}</td>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Lead details</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {data.selectedLead?.leadName ?? "No lead selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Requested store/template: {data.selectedLead?.requestedItem ?? "No requested item yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Notes: {data.selectedLead?.notes ?? "No notes yet. Notes are placeholder-only in this phase."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Next action: {data.selectedLead?.nextAction ?? "Follow up placeholder."}
            </p>
          </div>
          <div className="mt-5">
            <p className="text-sm font-black text-ink">Activity timeline placeholder</p>
            <div className="mt-3 grid gap-2">
              {(data.selectedLead?.timeline ?? ["No activity yet.", "Future messaging and conversion events will appear here."]).map((event) => (
                <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted" key={event}>
                  {event}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <LeadActions lead={data.selectedLead} />
          </div>
          <form action={addLeadNotePlaceholder} className="mt-4 grid gap-3">
            <LeadHiddenFields lead={data.selectedLead} />
            <textarea
              className="min-h-24 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="note"
              placeholder="Add note placeholder. This records reseller intent only."
            />
            <button className="h-10 w-fit rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
              Add note placeholder
            </button>
          </form>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Lead source foundation</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {data.sourceFoundation.map((source) => (
            <div className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-ink" key={source.value}>
              {source.label}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Lead contacts are masked. Full buyer email, phone, private data, orders, ownership transfers,
          wallets, payouts, withdrawals, commissions, and fake sales are not created or displayed.
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
