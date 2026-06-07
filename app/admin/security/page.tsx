import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminAdvancedSecurityControl } from "@/lib/admin/data";
import {
  clearSecurityEventRisk,
  exportSecurityPlaceholder,
  markSecurityEventHighRisk,
  markSecurityEventReviewed,
  suspendStoreShortcutPlaceholder,
  suspendUserShortcutPlaceholder
} from "@/lib/admin/security-actions";

function toneForStatus(status: string) {
  if (["low", "monitoring", "recorded", "reviewed"].includes(status)) {
    return "green" as const;
  }

  if (["critical", "failed"].includes(status)) {
    return "red" as const;
  }

  if (["blocked", "high", "medium", "review", "watching"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function EventHiddenFields({
  event
}: {
  event: Awaited<ReturnType<typeof getAdminAdvancedSecurityControl>>["events"][number];
}) {
  return (
    <>
      <input name="eventId" type="hidden" value={event.id} />
      <input name="eventType" type="hidden" value={event.eventType} />
      <input name="userId" type="hidden" value={event.userId ?? ""} />
      <input name="storeId" type="hidden" value={event.storeId ?? ""} />
    </>
  );
}

export default async function AdminSecurityPage() {
  const control = await getAdminAdvancedSecurityControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Advanced Super Admin monitoring for audit logs, login activity, IP/device signals, abuse, fraud placeholders, rate limits, and risk scoring. This extends existing security logs without duplicating audit storage or exposing secrets."
        title="Advanced Security Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Login events", value: control.overview.totalLoginEvents },
          { label: "Failed logins", value: control.overview.failedLogins },
          { label: "Suspicious events", value: control.overview.suspiciousEvents },
          { label: "Denied access", value: control.overview.deniedAccessEvents },
          { label: "Rate limits", value: control.overview.rateLimitEvents },
          { label: "High-risk users", value: control.overview.highRiskUsers },
          { label: "High-risk stores", value: control.overview.highRiskStores }
        ]}
      />

      <AdminTable headers={["Security section", "Status", "Notes"]}>
        {control.sections.map((section) => (
          <tr key={section.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{section.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{section.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Risk level", "Count", "Behavior"]}>
        {control.riskScores.map((risk) => (
          <tr key={risk.level}>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(risk.level)}>{risk.level}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{risk.count}</td>
            <td className="px-5 py-4 text-slate-600">{risk.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.events.length ? "No security audit events recorded yet." : null}
        headers={["Event type", "User", "Store", "IP", "Device/browser", "Severity", "Created", "Status", "Safe actions"]}
      >
        {control.events.map((event) => (
          <tr key={event.id}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{event.eventType}</span>
                <span className="max-w-xs text-xs font-semibold text-slate-500">{event.summary}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{event.userId ?? "anonymous"}</td>
            <td className="px-5 py-4 text-slate-600">{event.storeId ?? "n/a"}</td>
            <td className="px-5 py-4 text-slate-600">{event.ipMasked}</td>
            <td className="px-5 py-4 text-slate-600">
              <p>{event.device}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{event.browser}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(event.severity)}>{event.severity}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.createdAt)}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(event.status)}>{event.status}</AdminBadge></td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markSecurityEventReviewed}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Mark reviewed
                  </button>
                </form>
                <form action={markSecurityEventHighRisk}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Mark high risk
                  </button>
                </form>
                <form action={clearSecurityEventRisk}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Clear risk
                  </button>
                </form>
                <form action={suspendUserShortcutPlaceholder}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    User suspend shortcut
                  </button>
                </form>
                <form action={suspendStoreShortcutPlaceholder}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Store suspend shortcut
                  </button>
                </form>
                <form action={exportSecurityPlaceholder}>
                  <EventHiddenFields event={event} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Export placeholder
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
