import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  getResellerVerificationData,
  type ResellerVerificationItem,
  type ResellerVerificationStatus
} from "@/lib/reseller-showcase/data";
import {
  resubmitVerificationPlaceholder,
  startVerificationPlaceholder,
  submitVerificationPlaceholder,
  viewVerificationRequirements
} from "@/lib/reseller-showcase/verification-actions";

export const dynamic = "force-dynamic";

type VerificationPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerVerificationStatus) {
  if (status === "verified") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected" || status === "expired") {
    return "bg-red-100 text-red-700";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function VerificationHiddenFields({
  item,
  profileSlug
}: {
  item: ResellerVerificationItem;
  profileSlug: string | null;
}) {
  return (
    <>
      <input name="profileSlug" type="hidden" value={profileSlug ?? ""} />
      <input name="verificationKind" type="hidden" value={item.kind} />
    </>
  );
}

function VerificationActions({
  item,
  profileSlug
}: {
  item: ResellerVerificationItem;
  profileSlug: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={viewVerificationRequirements}>
        <VerificationHiddenFields item={item} profileSlug={profileSlug} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View requirements
        </button>
      </form>
      <form action={startVerificationPlaceholder}>
        <VerificationHiddenFields item={item} profileSlug={profileSlug} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Start placeholder
        </button>
      </form>
      <form action={submitVerificationPlaceholder}>
        <VerificationHiddenFields item={item} profileSlug={profileSlug} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Submit placeholder
        </button>
      </form>
      <form action={resubmitVerificationPlaceholder}>
        <VerificationHiddenFields item={item} profileSlug={profileSlug} />
        <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
          Resubmit placeholder
        </button>
      </form>
    </div>
  );
}

export default async function ResellerVerificationPage({ searchParams }: VerificationPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerVerificationData()]);

  return (
    <>
      <PageHeader
        description="Manage reseller verification foundations for email, phone, identity, and business trust. No real KYC provider or document upload is connected yet."
        title="Verification Center"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Verification placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Overall status</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.overallStatus}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Verified checks</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.verifiedCount}/4</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Public exposure</p>
          <p className="mt-3 text-3xl font-black text-ink">Badges only</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">KYC provider</p>
          <p className="mt-3 text-3xl font-black text-ink">Not connected</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {data.items.map((item) => (
          <Card className="p-6 lg:p-8" key={item.kind}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  {item.kind} verification
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">{item.title}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">{item.description}</p>
            <div className="mt-4 grid gap-2">
              {item.requirements.map((requirement) => (
                <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600" key={requirement}>
                  {requirement}
                </p>
              ))}
            </div>
            <div className="mt-5">
              <VerificationActions item={item} profileSlug={data.profile?.slug ?? null} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Public profiles show only verification badges and statuses. Private identity documents,
          business documents, phone numbers, and email addresses are never displayed publicly by this foundation.
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
