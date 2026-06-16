import {
  AdminBadge,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { PlatformThemeCertificationResult } from "@/src/lib/platform-theme/platform-theme-certification";

function certificationTone(status: string) {
  if (status === "ready") return "green" as const;
  if (status === "needs_attention") return "amber" as const;
  return "red" as const;
}

function blockerTone(severity: string) {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "medium") return "amber" as const;
  return "blue" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function PlatformThemeCertificationPanel({ certification }: { certification: PlatformThemeCertificationResult }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-certification">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Certification</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform Theme Runtime Certification</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only certification review for PT-1 through PT-21 platform theme systems. No auto-fix, publish, or public content changes are performed from this section.
        </p>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Readiness score", value: `${certification.readinessScore}/100` },
          { label: "Ready checks", value: certification.summary.readyChecks },
          { label: "Needs attention", value: certification.summary.needsAttentionChecks },
          { label: "Blocked checks", value: certification.summary.blockedChecks },
          { label: "Blockers", value: certification.blockers.length },
          { label: "Security review", value: certification.securityReviewPassed ? "Passed" : "Review" }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Certified at {formatAdminDate(certification.certifiedAt)}. {certification.summary.readyChecks} of {certification.summary.totalChecks} checks are ready.
      </p>

      {certification.emptyStates.length ? (
        <div className="grid gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          {certification.emptyStates.map((message) => (
            <p key={message} className="text-sm font-semibold text-amber-800">
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Certification checklist</h3>
        <div className="grid gap-2 lg:grid-cols-2">
          {certification.checklist.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-bold text-slate-950">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.note}</p>
              </div>
              <AdminBadge tone={certificationTone(item.status)}>{optionLabel(item.status)}</AdminBadge>
            </div>
          ))}
        </div>
      </div>

      {certification.scoreBreakdown.length ? (
        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Readiness score deductions</h3>
          <ul className="grid gap-2 text-sm text-slate-600">
            {certification.scoreBreakdown.map((item) => (
              <li key={item.label}>
                -{item.points} {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Final security review</h3>
        <div className="grid gap-2">
          {certification.securityReview.map((item) => (
            <div key={item.category} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-bold text-slate-950">{item.category}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.message}</p>
              </div>
              <AdminBadge tone={item.passed ? "green" : "red"}>{item.passed ? "passed" : "failed"}</AdminBadge>
            </div>
          ))}
        </div>
      </div>

      <AdminTable
        empty={!certification.blockers.length ? "No certification blockers detected." : null}
        headers={["Blocker type", "Severity", "Message", "Suggested action", "Related resource"]}
      >
        {certification.blockers.map((blocker) => (
          <tr key={`${blocker.blockerType}-${blocker.message}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(blocker.blockerType)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={blockerTone(blocker.severity)}>{blocker.severity}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{blocker.message}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{blocker.suggestedAction}</td>
            <td className="px-5 py-4 text-slate-600">{blocker.relatedResource ?? "Not linked"}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
