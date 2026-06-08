import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  acknowledgeComplianceWarningPlaceholder,
  markComplianceRuleReviewedPlaceholder,
  requestComplianceReviewPlaceholder,
  viewCompliancePolicyPlaceholder
} from "@/lib/reseller-showcase/compliance-actions";
import {
  getResellerComplianceData,
  type ResellerComplianceSection,
  type ResellerComplianceStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type CompliancePageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerComplianceStatus) {
  if (status === "good_standing") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "needs_attention" || status === "warning_placeholder") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "under_review") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-red-100 text-red-700";
}

function ComplianceHiddenFields({ section }: { section: ResellerComplianceSection }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/compliance" />
      <input name="sectionKey" type="hidden" value={section.key} />
      <input name="sectionTitle" type="hidden" value={section.title} />
      <input name="currentStatus" type="hidden" value={section.status} />
    </>
  );
}

function ComplianceActions({ section }: { section: ResellerComplianceSection }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={markComplianceRuleReviewedPlaceholder}>
        <ComplianceHiddenFields section={section} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Mark reviewed
        </button>
      </form>
      <form action={viewCompliancePolicyPlaceholder}>
        <ComplianceHiddenFields section={section} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View policy
        </button>
      </form>
      <form action={acknowledgeComplianceWarningPlaceholder}>
        <ComplianceHiddenFields section={section} />
        <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
          Acknowledge warning
        </button>
      </form>
      <form action={requestComplianceReviewPlaceholder}>
        <ComplianceHiddenFields section={section} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Request review
        </button>
      </form>
    </div>
  );
}

export default async function ResellerCompliancePage({ searchParams }: CompliancePageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerComplianceData()]);

  return (
    <>
      <PageHeader
        description="Private marketplace guidance and compliance tracking for rules, quality policies, buyer protection, delivery requirements, and account standing."
        title="Compliance Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Compliance placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Good standing</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.goodStanding}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Needs attention</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.needsAttention}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Warnings</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.warningPlaceholders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Under review</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.underReview}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Restricted placeholder</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.restrictedPlaceholders}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Account standing</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Current standing</p>
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(data.accountStanding.currentStanding)}`}>
              {data.accountStanding.currentStanding}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Warnings placeholder</p>
            <p className="mt-3 text-2xl font-black text-ink">{data.accountStanding.warningsPlaceholder}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Disputes</p>
            <p className="mt-3 text-2xl font-black text-ink">{data.accountStanding.disputesCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Reviews</p>
            <p className="mt-3 text-sm font-bold leading-6 text-muted">{data.accountStanding.reviewsStatus}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Verification</p>
            <p className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-muted">{data.accountStanding.verificationStatus}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Compliance checklist</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {data.checklist.map((item) => (
            <div className="rounded-3xl border border-slate-200 bg-white p-4" key={item.key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-ink">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted">{item.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${item.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.completed ? "Done" : "Open"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Compliance sections</p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.sections.map((section) => (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5" key={section.key}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{section.key}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{section.title}</h2>
                </div>
                <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(section.status)}`}>
                  {section.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-muted">{section.description}</p>
              <div className="mt-4 grid gap-2">
                {section.requirements.map((requirement) => (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted" key={requirement}>
                    {requirement}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Last reviewed: {section.lastReviewedAt ?? "Not reviewed yet"}
              </p>
              <div className="mt-4">
                <ComplianceActions section={section} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <div className="mt-4 grid gap-2">
          {data.safetyNotes.map((note) => (
            <p className="text-sm font-semibold leading-6 text-amber-900" key={note}>{note}</p>
          ))}
        </div>
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
