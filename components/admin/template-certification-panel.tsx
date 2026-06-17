import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { TemplateCertificationResult } from "@/src/lib/templates/template-certification";

function certificationTone(status: string) {
  if (status === "certified") return "green" as const;
  if (status === "needs_attention") return "amber" as const;
  return "red" as const;
}

function severityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "medium") return "amber" as const;
  return "blue" as const;
}

function optionLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function TemplateCertificationPanel({ certification }: { certification: TemplateCertificationResult }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="template-certification">
      <AdminHeader
        description="Read-only production certification for TM-1 through TM-21 template runtime systems. No installs, updates, rollbacks, marketplace purchases, or customer store mutations are performed."
        title="Template Runtime Certification"
      />

      <AdminStatGrid
        stats={[
          { label: "Overall status", value: optionLabel(certification.overallStatus) },
          { label: "Readiness score", value: `${certification.readinessScore}/100` },
          { label: "Certified categories", value: certification.summary.certifiedCategories },
          { label: "Needs attention", value: certification.summary.needsAttentionCategories },
          { label: "Blocked categories", value: certification.summary.blockedCategories },
          { label: "Security review", value: certification.securityReviewPassed ? "Passed" : "Review" }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Certified at {formatAdminDate(certification.certifiedAt)}. {certification.summary.certifiedCategories} of{" "}
        {certification.summary.totalCategories} categories are certified.
      </p>

      {certification.blockers.length ? (
        <div className="grid gap-2 rounded-3xl border border-red-200 bg-red-50 p-4">
          {certification.blockers.map((blocker) => (
            <p key={blocker} className="text-sm font-semibold text-red-800">
              {blocker}
            </p>
          ))}
        </div>
      ) : null}

      {certification.warnings.length ? (
        <div className="grid gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          {certification.warnings.map((warning) => (
            <p key={warning} className="text-sm font-semibold text-amber-800">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Certification categories</h3>
        <div className="grid gap-2 lg:grid-cols-2">
          {certification.categories.map((category) => (
            <div
              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              key={category.category}
            >
              <div>
                <p className="font-bold text-slate-950">{optionLabel(category.category)}</p>
                {category.issues.length ? (
                  <ul className="mt-2 grid gap-1 text-sm leading-6 text-red-700">
                    {category.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                {category.warnings.length ? (
                  <ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-700">
                    {category.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                {!category.issues.length && !category.warnings.length ? (
                  <p className="mt-1 text-sm leading-6 text-slate-500">Runtime checks passed.</p>
                ) : null}
              </div>
              <AdminBadge tone={certificationTone(category.status)}>{optionLabel(category.status)}</AdminBadge>
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
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Security audit</h3>
        <div className="grid gap-2">
          {certification.securityReview.map((item) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              key={item.category}
            >
              <div>
                <p className="font-bold text-slate-950">{item.category}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.message}</p>
              </div>
              <AdminBadge tone={item.passed ? "green" : "red"}>{item.passed ? "passed" : "failed"}</AdminBadge>
            </div>
          ))}
        </div>
      </div>

      <AdminTable headers={["Category", "Status", "Severity", "Message", "Suggested action"]}>
        {certification.report.map((item, index) => (
          <tr key={`${item.category}-${item.message}-${index}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(item.category)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={certificationTone(item.status)}>{optionLabel(item.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={severityTone(item.severity)}>{item.severity}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{item.message}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{item.suggestedAction}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
