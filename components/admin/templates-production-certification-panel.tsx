import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { TemplatesProductionCertification } from "@/src/lib/templates/templates-production-certification";

function productionTone(status: string) {
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

export function TemplatesProductionCertificationPanel({
  certification
}: {
  certification: TemplatesProductionCertification;
}) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="templates-production-certification">
      <AdminHeader
        description="Read-only production certification for TM-1 through TM-23 template runtime systems. No installs, updates, rollbacks, store mutations, or marketplace purchases are performed."
        title="Templates Production Certification"
      />

      <AdminStatGrid
        stats={[
          { label: "Overall status", value: optionLabel(certification.overallStatus) },
          { label: "Readiness score", value: `${certification.readinessScore}/100` },
          { label: "Registry status", value: optionLabel(certification.registryStatus) },
          { label: "Package status", value: optionLabel(certification.packageStatus) },
          { label: "Install status", value: optionLabel(certification.installStatus) },
          { label: "Assignment status", value: optionLabel(certification.assignmentStatus) }
        ]}
      />

      <AdminStatGrid
        stats={[
          { label: "Isolation status", value: optionLabel(certification.isolationStatus) },
          { label: "Live rendering", value: optionLabel(certification.liveRenderingStatus) },
          { label: "Marketplace status", value: optionLabel(certification.marketplaceStatus) },
          { label: "Reseller status", value: optionLabel(certification.resellerStatus) },
          { label: "Security status", value: optionLabel(certification.securityStatus) },
          { label: "Total checks", value: certification.checks.length }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Certified at {formatAdminDate(certification.certifiedAt)}. Overall production status:{" "}
        <AdminBadge tone={productionTone(certification.overallStatus)}>{certification.overallStatus}</AdminBadge>
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

      {certification.scoreBreakdown.length ? (
        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Readiness score deductions</h3>
          <ul className="grid gap-2 text-sm text-slate-600">
            {certification.scoreBreakdown.map((item) => (
              <li key={item.label}>
                -{item.points} {optionLabel(item.label)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdminTable headers={["Check", "Status", "Severity", "Message", "Suggested action"]}>
        {certification.checks.map((check, index) => (
          <tr key={`${check.check}-${check.message}-${index}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(check.check)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={productionTone(check.status)}>{optionLabel(check.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={severityTone(check.severity)}>{check.severity}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{check.message}</td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{check.suggestedAction}</td>
          </tr>
        ))}
      </AdminTable>
    </section>
  );
}
