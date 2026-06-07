import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import {
  clearIntegrationReview,
  markIntegrationUnderReview,
  viewIntegrationLogs,
  viewIntegrationSetupChecklist
} from "@/lib/admin/integration-actions";
import { getAdminIntegrationsControl } from "@/lib/admin/data";

function toneForStatus(status: string) {
  if (["configured", "enabled", "healthy", "live", "masked_configured"].includes(status)) {
    return "green" as const;
  }

  if (["missing", "missing_config", "disabled"].includes(status)) {
    return "red" as const;
  }

  if (["placeholder", "no_secret_required"].includes(status)) {
    return "blue" as const;
  }

  return "amber" as const;
}

export default async function AdminIntegrationsPage() {
  const control = await getAdminIntegrationsControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Central Super Admin status layer for external service integrations. This page shows only configured, missing, partial, or masked secret status. It does not reveal credentials or call provider APIs."
        title="Platform Integrations Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Integrations", value: control.overview.total },
          { label: "Configured", value: control.overview.configured },
          { label: "Partial", value: control.overview.partial },
          { label: "Missing", value: control.overview.missing },
          { label: "Under review", value: control.overview.underReview },
          { label: "Webhook failures", value: control.overview.webhookFailures },
          { label: "Categories", value: control.categories.length },
          { label: "Secrets exposed", value: 0 }
        ]}
      />

      {control.categories.map((category) => {
        const integrations = control.integrations.filter((integration) => integration.category === category);

        return (
          <section className="grid gap-4" key={category}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Integration category</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">{category}</h2>
            </div>
            <AdminTable
              empty={!integrations.length ? "No integrations in this category." : null}
              headers={[
                "Integration",
                "Category",
                "Enabled",
                "Configuration",
                "Mode",
                "Last checked",
                "Health",
                "Secret status",
                "Actions"
              ]}
            >
              {integrations.map((integration) => (
                <tr key={integration.key}>
                  <td className="px-5 py-4 font-bold text-slate-950">{integration.name}</td>
                  <td className="px-5 py-4 text-slate-600">{integration.category}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.enabledStatus)}>{integration.enabledStatus}</AdminBadge>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.configurationStatus)}>
                      {integration.configurationStatus}
                    </AdminBadge>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.mode)}>{integration.mode}</AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(integration.lastChecked)}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.healthStatus)}>{integration.healthStatus}</AdminBadge>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.secretStatus)}>{integration.secretStatus}</AdminBadge>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Values are never displayed. Only masked configured/missing state is shown.
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="grid min-w-56 gap-2">
                      <form action={markIntegrationUnderReview}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <input name="integrationName" type="hidden" value={integration.name} />
                        <input name="category" type="hidden" value={integration.category} />
                        <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                          Mark review
                        </button>
                      </form>
                      <form action={clearIntegrationReview}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <input name="integrationName" type="hidden" value={integration.name} />
                        <input name="category" type="hidden" value={integration.category} />
                        <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                          Clear review
                        </button>
                      </form>
                      <form action={viewIntegrationLogs}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <input name="integrationName" type="hidden" value={integration.name} />
                        <input name="category" type="hidden" value={integration.category} />
                        <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                          View logs
                        </button>
                      </form>
                      <form action={viewIntegrationSetupChecklist}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <input name="integrationName" type="hidden" value={integration.name} />
                        <input name="category" type="hidden" value={integration.category} />
                        <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                          Setup checklist
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </section>
        );
      })}

      <AdminTable
        empty={!control.webhooks.length ? "No webhook placeholders configured." : null}
        headers={["Webhook", "Provider", "Status", "Recent failures", "Retry"]}
      >
        {control.webhooks.map((webhook) => (
          <tr key={`${webhook.provider}-${webhook.name}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{webhook.name}</td>
            <td className="px-5 py-4 text-slate-600">{webhook.provider}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(webhook.status)}>{webhook.status}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{webhook.recentFailures}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                {webhook.retryStatus.replace(/_/g, " ")}
              </button>
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
