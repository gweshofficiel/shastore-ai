import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import Link from "next/link";
import { getAdminPaymentProviderControl } from "@/lib/admin/data";
import {
  clearPaymentProviderReview,
  markPaymentProviderReviewed,
  markPaymentProviderUnderReview,
  refreshPaymentProviderStatus,
  viewPaymentProviderLogs
} from "@/lib/admin/payment-provider-actions";

function toneForStatus(status: string) {
  if (status === "configured" || status === "enabled" || status === "healthy") {
    return "green" as const;
  }

  if (status === "under_review" || status === "needs_review" || status === "warning" || status === "partial") {
    return "amber" as const;
  }

  if (status === "not_applicable" || status === "placeholder") {
    return "slate" as const;
  }

  return "red" as const;
}

function warningTone(warning: string) {
  if (warning === "provider_not_configured" || warning === "webhook_missing") {
    return "red" as const;
  }

  return "amber" as const;
}

export default async function AdminPaymentProvidersPage() {
  const data = await getAdminPaymentProviderControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Read-only Super Admin monitoring for platform payment providers, store payment adoption, webhooks, and provider setup risks. No charges, refunds, retries, or provider API calls run here."
        title="Payment Providers"
      />

      <AdminStatGrid
        stats={[
          { label: "Total providers", value: data.providers.length },
          { label: "Enabled providers", value: data.providers.filter((provider) => provider.enabledStatus === "enabled").length },
          { label: "Configured providers", value: data.providers.filter((provider) => provider.configurationStatus === "configured").length },
          { label: "Missing configuration", value: data.providers.filter((provider) => provider.configurationStatus === "missing").length },
          { label: "Healthy providers", value: data.providers.filter((provider) => provider.healthStatus === "healthy").length },
          { label: "Failing providers", value: data.providers.filter((provider) => provider.healthStatus !== "healthy").length },
          { label: "Store providers linked", value: data.providers.reduce((total, provider) => total + provider.connectedStoresCount, 0) },
          { label: "Failed webhooks/events", value: data.webhookMonitoring.failedEvents }
        ]}
      />

      <AdminTable
        empty={!data.providers.length ? "No payment providers configured." : null}
        headers={[
          "Provider",
          "Scope",
          "Status",
          "Configuration",
          "Health",
          "Stores",
          "Last checked",
          "Warnings",
          "Actions",
          "Placeholders"
        ]}
      >
        {data.providers.map((provider) => (
          <tr key={provider.key}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{provider.name}</span>
                <span className="text-xs font-semibold text-slate-500">{provider.key}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={provider.scope === "platform_billing" ? "blue" : provider.scope === "store_payments" ? "green" : "slate"}>
                {provider.scope.replace(/_/g, " ")}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={toneForStatus(provider.enabledStatus)}>{provider.enabledStatus}</AdminBadge>
                <AdminBadge tone={provider.environmentMode === "live" ? "green" : provider.environmentMode === "placeholder" ? "slate" : "amber"}>
                  {provider.environmentMode}
                </AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={toneForStatus(provider.configurationStatus)}>{provider.configurationStatus}</AdminBadge>
                <AdminBadge tone={toneForStatus(provider.webhookStatus)}>{provider.webhookStatus}</AdminBadge>
                <p className="text-xs font-semibold text-slate-500">Secrets hidden: presence only.</p>
              </div>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(provider.healthStatus)}>{provider.healthStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{provider.connectedStoresCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(provider.lastCheckedAt)}</td>
            <td className="px-5 py-4">
              <details className="min-w-80 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Safe config details
                </summary>
                <div className="mt-3 grid gap-4 text-sm text-slate-600">
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Configuration presence</p>
                    <div className="mt-2 grid gap-2">
                      {provider.configChecks.map((check) => (
                        <p className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2" key={`${provider.key}-${check.label}`}>
                          <span>{check.label}</span>
                          <AdminBadge tone={toneForStatus(check.status)}>{check.status}</AdminBadge>
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Runtime status</p>
                    <p className="mt-2">Scope: {provider.scope.replace(/_/g, " ")}</p>
                    <p>Connected/configured stores: {provider.connectedStoresCount}</p>
                    <p>Last event: {provider.lastEvent ?? "not available"}</p>
                    <p>Last checked: {formatAdminDate(provider.lastCheckedAt)}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Safe links</p>
                    {provider.docsUrl ? (
                      <a className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={provider.docsUrl} rel="noreferrer" target="_blank">
                        Open provider docs
                      </a>
                    ) : (
                      <p className="mt-2">Provider docs/config link not available.</p>
                    )}
                    <Link className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href="/admin/billing/payment-providers">
                      Open config page
                    </Link>
                  </section>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="flex min-w-64 flex-wrap gap-2">
                {provider.warnings.length ? (
                  provider.warnings.map((warning) => (
                    <AdminBadge key={warning} tone={warningTone(warning)}>
                      {warning.replace(/_/g, " ")}
                    </AdminBadge>
                  ))
                ) : (
                  <AdminBadge tone="green">clear</AdminBadge>
                )}
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-56 gap-2">
                <form action={refreshPaymentProviderStatus}>
                  <input name="providerKey" type="hidden" value={provider.key} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Refresh status
                  </button>
                </form>
                <form action={markPaymentProviderReviewed}>
                  <input name="providerKey" type="hidden" value={provider.key} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Mark reviewed
                  </button>
                </form>
                <form action={markPaymentProviderUnderReview}>
                  <input name="providerKey" type="hidden" value={provider.key} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Mark review
                  </button>
                </form>
                <form action={clearPaymentProviderReview}>
                  <input name="providerKey" type="hidden" value={provider.key} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Clear review
                  </button>
                </form>
                <form action={viewPaymentProviderLogs}>
                  <input name="providerKey" type="hidden" value={provider.key} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    View logs
                  </button>
                </form>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-56 gap-2">
                {[
                  "Enable provider placeholder",
                  "Disable provider placeholder",
                  "Test provider connection",
                  "Sync Stripe account",
                  "Sync NOWPayments status",
                  "Sync PayPal status",
                  "Retry webhook",
                  "Export provider report"
                ].map((label) => (
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    key={`${provider.key}-${label}`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!data.paymentSetupRisks.length ? "Every listed store has at least one detected payment method or connected provider." : null}
        headers={["Store", "Owner", "Risk", "Slug"]}
      >
        {data.paymentSetupRisks.map((risk) => (
          <tr key={risk.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{risk.name}</td>
            <td className="px-5 py-4 text-slate-600">{risk.ownerEmail}</td>
            <td className="px-5 py-4"><AdminBadge tone="amber">{risk.reason}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{risk.slug ?? "No slug"}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!data.webhookMonitoring.recentEvents.length ? "No payment or webhook events found yet." : null}
        headers={["Provider", "Event", "Status", "Created", "Retry"]}
      >
        {data.webhookMonitoring.recentEvents.map((event) => (
          <tr key={`${event.provider}-${event.eventType}-${event.createdAt}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{event.provider}</td>
            <td className="px-5 py-4 text-slate-600">{event.eventType}</td>
            <td className="px-5 py-4"><AdminBadge tone={event.eventStatus === "failed" ? "red" : "green"}>{event.eventStatus}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.createdAt)}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Retry placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
