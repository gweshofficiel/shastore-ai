import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  acceptBuyerRequestPlaceholder,
  archiveBuyerRequestPlaceholder,
  convertBuyerRequestToLeadPlaceholder,
  declineBuyerRequestPlaceholder,
  markBuyerRequestReviewedPlaceholder,
  openBuyerRequestMessagePlaceholder
} from "@/lib/reseller-showcase/request-actions";
import {
  getResellerBuyerRequestsData,
  type ResellerBuyerRequest,
  type ResellerBuyerRequestStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type RequestsPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerBuyerRequestStatus) {
  if (status === "accepted_placeholder") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "declined" || status === "archived") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "in_discussion") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "reviewed") {
    return "bg-violet-100 text-violet-700";
  }

  return "bg-amber-100 text-amber-700";
}

function RequestHiddenFields({ request }: { request: ResellerBuyerRequest | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/requests" />
      <input name="requestReference" type="hidden" value={request?.id ?? "buyer-request-placeholder"} />
      <input name="requestCategory" type="hidden" value={request?.category ?? "custom_store"} />
      <input name="requestedService" type="hidden" value={request?.requestedService ?? "Custom store/template request"} />
      <input name="businessCategory" type="hidden" value={request?.businessCategory ?? "Business category placeholder"} />
      <input name="budgetRange" type="hidden" value={request?.budgetRange ?? "Budget placeholder"} />
      <input name="timeline" type="hidden" value={request?.timeline ?? "Timeline placeholder"} />
    </>
  );
}

function RequestActions({ request }: { request: ResellerBuyerRequest | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markBuyerRequestReviewedPlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Mark reviewed
        </button>
      </form>
      <form action={acceptBuyerRequestPlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Accept placeholder
        </button>
      </form>
      <form action={declineBuyerRequestPlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Decline
        </button>
      </form>
      <form action={archiveBuyerRequestPlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Archive
        </button>
      </form>
      <form action={convertBuyerRequestToLeadPlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Convert to lead
        </button>
      </form>
      <form action={openBuyerRequestMessagePlaceholder}>
        <RequestHiddenFields request={request} />
        <button className="h-9 rounded-full border border-ink/10 bg-ink px-3 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
          Open message
        </button>
      </form>
    </div>
  );
}

export default async function ResellerBuyerRequestsPage({ searchParams }: RequestsPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerBuyerRequestsData()]);
  const selected = data.selectedRequest;

  return (
    <>
      <PageHeader
        description="Private pre-sale buyer requests for custom stores, templates, redesigns, setup help, migrations, and consultations."
        title="Buyer Requests"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Buyer request placeholder action recorded.</p>
        </Card>
      ) : null}

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Request categories</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.categories.map((category) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={category.value}>
              {category.label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Request statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statuses.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Requests table</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.requests.length ? (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Request type</th>
                    <th className="px-4 py-3">Business category</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-4 py-4 font-black text-ink">{request.buyerDisplayName}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{request.category}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{request.businessCategory}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{request.budgetRange}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{request.timeline}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{request.createdAt ?? "Not tracked"}</td>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Request detail</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.requestedService ?? "No request selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Requested service: {selected?.requestedService ?? "No requested service yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Description: {selected?.description ?? "No description yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Preferred niche: {selected?.preferredNiche ?? "No preferred niche yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Budget range: {selected?.budgetRange ?? "No budget range yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Timeline: {selected?.timeline ?? "No timeline yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Related lead: {selected?.relatedLead ?? "No related lead placeholder yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Related conversation: {selected?.relatedConversation ?? "No related conversation placeholder yet."}
            </p>
          </div>
          <div className="mt-5">
            <RequestActions request={selected} />
          </div>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and pre-sale safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Buyer requests are private to the reseller dashboard. Buyer private email/phone is not exposed,
          requests are not public, and this phase does not create real orders, payments, buyer charges,
          ownership transfers, wallets, payouts, withdrawals, commissions, or fake sales.
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
