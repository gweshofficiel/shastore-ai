import {
  AdminBadge,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import type { PlatformThemeProductionCertification } from "@/src/lib/platform-theme/platform-theme-production-certification";

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

export function PlatformThemeProductionCertificationPanel({
  certification
}: {
  certification: PlatformThemeProductionCertification;
}) {
  return (
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="theme-production-certification">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Theme Production Certification</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Platform theme production binding certification</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Read-only verification that published platform theme values control the live SHASTORE platform UI. No auto-publish, public content changes, or customer store modifications are performed.
        </p>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Overall status", value: optionLabel(certification.overallStatus) },
          { label: "Readiness score", value: `${certification.readinessScore}/100` },
          { label: "Live binding", value: optionLabel(certification.liveBindingStatus) },
          { label: "Public website", value: optionLabel(certification.publicWebsiteStatus) },
          { label: "Admin shell", value: optionLabel(certification.adminShellStatus) },
          { label: "Storefront isolation", value: optionLabel(certification.storefrontIsolationStatus) }
        ]}
      />

      <AdminStatGrid
        stats={[
          { label: "Asset status", value: optionLabel(certification.assetStatus) },
          { label: "Fallback status", value: optionLabel(certification.fallbackStatus) },
          { label: "Security status", value: optionLabel(certification.securityStatus) },
          { label: "Total checks", value: certification.checks.length },
          { label: "Certified checks", value: certification.checks.filter((check) => check.status === "certified").length },
          { label: "Blocked checks", value: certification.checks.filter((check) => check.status === "blocked").length }
        ]}
      />

      <p className="text-sm font-semibold text-slate-500">
        Certified at {formatAdminDate(certification.certifiedAt)}. Overall production status:{" "}
        <AdminBadge tone={productionTone(certification.overallStatus)}>{certification.overallStatus}</AdminBadge>
      </p>

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

      <AdminTable
        empty={!certification.checks.length ? "No production certification checks were recorded." : null}
        headers={["Check name", "Status", "Severity", "Message", "Suggested action"]}
      >
        {certification.checks.map((check) => (
          <tr key={`${check.checkName}-${check.message}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{optionLabel(check.checkName)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={productionTone(check.status)}>{check.status}</AdminBadge>
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
