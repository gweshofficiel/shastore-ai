import { DeliverySidebar } from "@/components/delivery/delivery-sidebar";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryComplianceData } from "@/lib/delivery/compliance-data";

export const dynamic = "force-dynamic";

const checklistLabels = {
  assignedRegionConfirmed: "Assigned region confirmed",
  licenseUploadedPlaceholder: "License uploaded placeholder",
  noActiveViolations: "No active violations",
  ownerApproved: "Owner approved",
  phoneVerified: "Phone verified",
  profileCompleted: "Profile completed",
  vehicleInformationCompleted: "Vehicle information completed"
} as const;

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function statusClass(value: string) {
  if (value === "eligible" || value === "verified") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "not_eligible" || value === "rejected" || value === "expired" || value === "suspended" || value === "blocked") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function badgeClass(value: string) {
  if (value === "Verified") {
    return "bg-emerald-950 text-white";
  }

  if (value === "Suspended" || value === "Not Eligible") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default async function DeliveryCompliancePage() {
  const { agent } = await requireDeliveryAccess();
  const compliance = await getDeliveryComplianceData(agent);
  const checklistEntries = Object.entries(compliance.checklist) as Array<[
    keyof typeof checklistLabels,
    boolean
  ]>;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_38%,#f1f5f9_100%)]">
      <DeliverySidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Delivery compliance
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Verification & Eligibility Center
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Your identity, phone, vehicle, license, store approval, and operational eligibility status for sensitive delivery workflows.
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${badgeClass(compliance.badge)}`}>
                {compliance.badge}
              </span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Verification Status" value={statusLabel(compliance.verificationStatus)} />
            <MetricCard label="Eligibility Status" value={statusLabel(compliance.eligibilityStatus)} />
            <MetricCard label="Checklist" value={`${compliance.checklistCompleted}/${compliance.checklistTotal}`} />
            <MetricCard label="Active Violations" value={compliance.violationSummary.active.toLocaleString()} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Verification sections
              </p>
              <div className="mt-4 grid gap-3">
                {compliance.sections.map((section) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4" key={section.label}>
                    <p className="font-black text-slate-950">{section.label}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(section.status)}`}>
                      {statusLabel(section.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                Compliance checklist
              </p>
              <div className="mt-4 grid gap-3">
                {checklistEntries.map(([key, checked]) => (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4" key={key}>
                    <p className="text-sm font-black text-slate-950">{checklistLabels[key]}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${checked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {checked ? "Complete" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Delivery eligibility result
              </p>
              <p className="mt-3 text-3xl font-black capitalize tracking-[-0.04em] text-slate-950">
                {statusLabel(compliance.eligibilityStatus)}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                {compliance.isAssignmentEligible
                  ? "This delivery profile is not blocked from assignment by compliance status."
                  : "Delivery agent is not eligible for new assignments."}
              </p>
            </div>

            <div className="rounded-[2rem] border border-red-100 bg-red-50 p-5 lg:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">
                Violations foundation
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                <MetricCard label="Total" value={compliance.violationSummary.total.toLocaleString()} />
                <MetricCard label="Active" value={compliance.violationSummary.active.toLocaleString()} />
                <MetricCard label="Critical" value={compliance.violationSummary.critical.toLocaleString()} />
                <MetricCard label="Incidents" value={compliance.violationSummary.incidentHistory.toLocaleString()} />
                <MetricCard label="Risk" value={compliance.violationSummary.riskLevel} />
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-red-900">
                Violation types prepared: late delivery, failed proof, COD dispute, customer complaint, owner complaint, and policy issue.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Future hooks prepared
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
              Document upload, Admin review, Auto eligibility calculation, Violation scoring, Temporary suspension, and Reactivation workflow.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black capitalize text-slate-950">{value}</p>
    </article>
  );
}
