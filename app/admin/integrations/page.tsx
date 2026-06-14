import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import {
  checkAllIntegrationProviders,
  checkIntegrationProvider,
  clearIntegrationReview,
  markRotationRequiredAction,
  markIntegrationUnderReview,
  markIntegrationErrorResolvedAction,
  markSecretRotatedAction,
  reopenIntegrationErrorAction,
  runAllProviderDiagnosticsAction,
  syncIntegrationProviderStatusAction,
  testIntegrationConnectionAction,
  updateSecretRotationNoteAction,
  viewIntegrationLogs,
  viewIntegrationSetupChecklist
} from "@/lib/admin/integration-actions";
import { getAdminAccess } from "@/lib/admin-access";
import { getAdminIntegrationsControl } from "@/lib/admin/data";
import {
  listIntegrationErrors,
  type IntegrationErrorStatus
} from "@/lib/integrations/error-center";
import {
  listIntegrationAuditLogs,
  type IntegrationAuditStatus
} from "@/lib/integrations/audit-log";
import { listSecretRotationRecords } from "@/lib/integrations/secret-rotation";
import {
  getProviderUsageSummary,
  type ProviderUsageCategory,
  type ProviderUsageRange
} from "@/lib/integrations/provider-usage-analytics";
import {
  getWebhookStats,
  listWebhookEvents,
  type WebhookEventStatus
} from "@/lib/integrations/webhook-monitoring";

function toneForStatus(status: string) {
  if (["configured", "connected", "enabled", "healthy", "live", "masked_configured", "processed"].includes(status)) {
    return "green" as const;
  }

  if (["failed", "missing", "missing_config", "disabled"].includes(status)) {
    return "red" as const;
  }

  if (["ignored", "not_checked", "placeholder", "received", "skipped", "no_secret_required"].includes(status)) {
    return "blue" as const;
  }

  return "amber" as const;
}

function firstParam(value: string | string[] | undefined, fallback = "all") {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function safeSummaryText(value: Record<string, unknown> | null) {
  if (!value || !Object.keys(value).length) {
    return "No summary";
  }

  return JSON.stringify(value).slice(0, 300);
}

function diagnosticMessage(value: Record<string, unknown>) {
  const safeMessage = typeof value.safeMessage === "string" ? value.safeMessage : "";
  const diagnosticStatus = typeof value.diagnosticStatus === "string" ? value.diagnosticStatus : "";

  return {
    safeMessage: safeMessage || "No diagnostic message recorded.",
    status: diagnosticStatus || "not_checked"
  };
}

const auditStatuses: Array<IntegrationAuditStatus | "all"> = [
  "all",
  "started",
  "success",
  "failed",
  "skipped",
  "blocked"
];
const errorStatuses: Array<IntegrationErrorStatus | "all"> = [
  "all",
  "failed",
  "degraded",
  "blocked"
];
const webhookStatuses: Array<WebhookEventStatus | "all"> = [
  "all",
  "received",
  "processed",
  "failed",
  "ignored",
  "retry_pending"
];
const usageRanges: Array<{ label: string; value: ProviderUsageRange }> = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "All time", value: "all_time" }
];
const healthSortOptions = [
  "provider",
  "health_status",
  "last_check",
  "response_time",
  "consecutive_failures"
] as const;

type HealthSortKey = (typeof healthSortOptions)[number];

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function safeHealthSort(value: string): HealthSortKey {
  return healthSortOptions.includes(value as HealthSortKey) ? (value as HealthSortKey) : "health_status";
}

function dateSortValue(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

export default async function AdminIntegrationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return (
      <div className="grid gap-6 lg:gap-8">
        <AdminHeader
          description="Integration runtime health is restricted to Super Admin users."
          title="Platform Integrations Center"
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
          Super Admin access is required to view or run integration health checks.
        </div>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const auditProvider = firstParam(params.auditProvider);
  const auditCategory = firstParam(params.auditCategory);
  const auditStatus = firstParam(params.auditStatus) as IntegrationAuditStatus | "all";
  const errorProvider = firstParam(params.errorProvider);
  const errorCategory = firstParam(params.errorCategory);
  const errorStatus = firstParam(params.errorStatus) as IntegrationErrorStatus | "all";
  const errorFrom = firstParam(params.errorFrom, "");
  const errorTo = firstParam(params.errorTo, "");
  const unresolvedOnly = firstParam(params.unresolvedOnly, "true") !== "false";
  const webhookProvider = firstParam(params.webhookProvider);
  const webhookStatus = firstParam(params.webhookStatus) as WebhookEventStatus | "all";
  const webhookEventType = firstParam(params.webhookEventType);
  const webhookWindow = firstParam(params.webhookWindow, "7d") as "24h" | "7d" | "all";
  const webhookFailedOnly = firstParam(params.webhookFailedOnly, "false") === "true";
  const usageRange = firstParam(params.usageRange, "last_7_days") as ProviderUsageRange;
  const usageProvider = firstParam(params.usageProvider);
  const usageCategory = firstParam(params.usageCategory) as ProviderUsageCategory | "all";
  const healthSort = safeHealthSort(firstParam(params.healthSort, "health_status"));
  const [
    control,
    auditLogs,
    integrationErrors,
    secretRotationRecords,
    webhookEvents,
    webhookStats,
    providerUsage,
    failedAuditLogs,
    unresolvedIntegrationErrors,
    failedWebhookEvents
  ] = await Promise.all([
    getAdminIntegrationsControl(),
    listIntegrationAuditLogs({
      category: auditCategory,
      providerKey: auditProvider,
      status: auditStatus
    }),
    listIntegrationErrors({
      category: errorCategory,
      from: errorFrom,
      providerKey: errorProvider,
      status: errorStatus,
      to: errorTo,
      unresolvedOnly
    }),
    listSecretRotationRecords(),
    listWebhookEvents({
      eventType: webhookEventType,
      failedOnly: webhookFailedOnly,
      providerKey: webhookProvider,
      status: webhookStatus,
      window: webhookWindow
    }),
    getWebhookStats(),
    getProviderUsageSummary(usageRange),
    listIntegrationAuditLogs({ status: "failed" }),
    listIntegrationErrors({ unresolvedOnly: true }),
    listWebhookEvents({ status: "failed", window: "7d" })
  ]);
  const rotationRequiredByProvider = new Map<string, number>();
  const webhookEventTypes = [...new Set(webhookEvents.map((event) => event.eventType))].sort();
  const usageCategories = [...new Set(providerUsage.providers.map((provider) => provider.category))].sort();
  const filteredUsageProviders = providerUsage.providers
    .filter((provider) => usageProvider === "all" || provider.providerKey === usageProvider)
    .filter((provider) => usageCategory === "all" || provider.category === usageCategory);
  const filteredFailureBreakdown = providerUsage.failureBreakdown
    .filter((failure) => usageProvider === "all" || failure.providerKey === usageProvider);
  const healthCounts = {
    degraded: control.integrations.filter((integration) => ["degraded", "needs_review", "warning"].includes(integration.healthStatus)).length,
    failed: control.integrations.filter((integration) => integration.healthStatus === "failed").length,
    healthy: control.integrations.filter((integration) => integration.healthStatus === "healthy").length,
    missingConfig: control.integrations.filter((integration) => integration.healthStatus === "missing_config").length,
    placeholder: control.integrations.filter((integration) => integration.healthStatus === "placeholder").length,
    total: control.integrations.length
  };
  const sortedHealthIntegrations = [...control.integrations].sort((left, right) => {
    if (healthSort === "provider") {
      return left.name.localeCompare(right.name);
    }

    if (healthSort === "last_check") {
      return dateSortValue(right.lastChecked) - dateSortValue(left.lastChecked);
    }

    if (healthSort === "response_time") {
      return (right.responseTimeMs ?? -1) - (left.responseTimeMs ?? -1);
    }

    if (healthSort === "consecutive_failures") {
      return right.consecutiveFailures - left.consecutiveFailures;
    }

    return String(left.healthStatus).localeCompare(String(right.healthStatus)) || left.name.localeCompare(right.name);
  });
  const secretRotationWarnings = secretRotationRecords.filter((record) => record.rotationRequired);
  const recentCriticalEvents = [
    ...failedAuditLogs.map((log) => ({
      event: log.operation,
      provider: log.providerName,
      severity: "failed",
      timestamp: log.createdAt
    })),
    ...unresolvedIntegrationErrors.map((error) => ({
      event: error.operation || error.errorCode || "integration_error",
      provider: error.providerName,
      severity: error.status,
      timestamp: error.createdAt
    })),
    ...failedWebhookEvents.map((event) => ({
      event: event.eventType,
      provider: event.providerKey,
      severity: "failed_webhook",
      timestamp: event.createdAt
    }))
  ]
    .sort((left, right) => dateSortValue(right.timestamp) - dateSortValue(left.timestamp))
    .slice(0, 12);
  const certificationItems = [
    {
      name: "Health Engine",
      ready: healthCounts.failed === 0 && healthCounts.degraded === 0
    },
    {
      name: "Audit Logs",
      ready: failedAuditLogs.length === 0
    },
    {
      name: "Error Center",
      ready: unresolvedIntegrationErrors.length === 0
    },
    {
      name: "Diagnostics",
      ready: control.integrations.every((integration) => !["failed", "missing_config"].includes(diagnosticMessage(integration.lastSafeResponseSummary).status))
    },
    {
      name: "Secret Rotation",
      ready: secretRotationWarnings.length === 0
    },
    {
      name: "Webhooks",
      ready: webhookStats.failed === 0 && webhookStats.retryPending === 0
    },
    {
      name: "Usage Analytics",
      ready: providerUsage.failureRate === 0
    }
  ];

  for (const record of secretRotationRecords) {
    if (record.rotationRequired) {
      rotationRequiredByProvider.set(
        record.providerKey,
        (rotationRequiredByProvider.get(record.providerKey) ?? 0) + 1
      );
    }
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Central Super Admin status layer for external service integrations. Manual checks are safe runtime wrappers that do not mutate providers, trigger billing, or expose secrets."
        title="Platform Integrations Center"
      />

      <form action={checkAllIntegrationProviders}>
        <button
          className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
          type="submit"
        >
          Check all providers
        </button>
      </form>

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

      <section className="grid gap-4" id="operations-dashboard">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
              Unified Integration Operations Dashboard
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Runtime operations overview
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Consolidates health, audit logs, error center, diagnostics, secret rotation, webhooks, and usage analytics without duplicating provider workflows or exposing secrets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={checkAllIntegrationProviders}>
              <button className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                Check all providers
              </button>
            </form>
            <a className="grid h-10 place-items-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" href="#integration-error-center">
              Open Error Center
            </a>
            <a className="grid h-10 place-items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" href="#webhook-monitoring-center">
              Open Webhook Center
            </a>
            <a className="grid h-10 place-items-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700" href="#secret-rotation-center">
              Open Secret Rotation
            </a>
            <a className="grid h-10 place-items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700" href="#integration-audit-logs">
              Open Audit Logs
            </a>
          </div>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Total Providers", value: healthCounts.total },
            { label: "Healthy Providers", value: healthCounts.healthy },
            { label: "Degraded Providers", value: healthCounts.degraded },
            { label: "Failed Providers", value: healthCounts.failed },
            { label: "Missing Config Providers", value: healthCounts.missingConfig },
            { label: "Placeholder Providers", value: healthCounts.placeholder }
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Operations Health Summary</h3>
              <form method="get">
                <select
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                  defaultValue={healthSort}
                  name="healthSort"
                >
                  <option value="health_status">Sort by health</option>
                  <option value="provider">Sort by provider</option>
                  <option value="last_check">Sort by last check</option>
                  <option value="response_time">Sort by response time</option>
                  <option value="consecutive_failures">Sort by failures</option>
                </select>
                <button className="ml-2 h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                  Sort
                </button>
              </form>
            </div>
            <AdminTable headers={["Provider", "Health", "Last check", "Response", "Failures"]}>
              {sortedHealthIntegrations.map((integration) => (
                <tr key={`health-${integration.key}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{integration.name}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.healthStatus)}>{integration.healthStatus}</AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(integration.lastChecked)}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {integration.responseTimeMs === null ? "n/a" : `${integration.responseTimeMs} ms`}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{integration.consecutiveFailures}</td>
                </tr>
              ))}
            </AdminTable>
          </section>

          <section className="grid gap-3">
            <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Recent Critical Events</h3>
            <AdminTable
              empty={!recentCriticalEvents.length ? "No recent critical integration events found." : null}
              headers={["Provider", "Event", "Severity", "Timestamp"]}
            >
              {recentCriticalEvents.map((event) => (
                <tr key={`${event.provider}-${event.event}-${event.timestamp}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{event.provider}</td>
                  <td className="px-5 py-4 text-slate-600">{event.event}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(event.severity)}>{event.severity}</AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.timestamp)}</td>
                </tr>
              ))}
            </AdminTable>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="grid gap-3">
            <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Secret Rotation Warnings</h3>
            <AdminTable
              empty={!secretRotationWarnings.length ? "No providers currently require secret rotation." : null}
              headers={["Provider", "Secret", "Next due"]}
            >
              {secretRotationWarnings.slice(0, 10).map((record) => (
                <tr key={`warning-${record.providerKey}-${record.secretKeyName}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{record.providerName}</td>
                  <td className="px-5 py-4 font-mono text-xs font-black text-slate-700">{record.secretKeyName}</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(record.nextRotationDueAt)}</td>
                </tr>
              ))}
            </AdminTable>
          </section>

          <section className="grid gap-3">
            <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Webhook Health Summary</h3>
            <AdminStatGrid
              stats={[
                { label: "Total events", value: webhookStats.total },
                { label: "Processed", value: webhookStats.processed },
                { label: "Failed", value: webhookStats.failed },
                { label: "Retry pending", value: webhookStats.retryPending }
              ]}
            />
          </section>

          <section className="grid gap-3">
            <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Provider Usage Summary</h3>
            <AdminStatGrid
              stats={[
                { label: "Operations", value: providerUsage.totalOperations },
                { label: "Failures", value: providerUsage.failedOperations },
                { label: "Failure rate", value: formatPercent(providerUsage.failureRate) },
                {
                  label: "Avg response",
                  value: providerUsage.averageResponseTimeMs === null ? "n/a" : `${providerUsage.averageResponseTimeMs} ms`
                }
              ]}
            />
          </section>
        </div>

        <section className="grid gap-3">
          <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950">Integration Runtime Certification</h3>
          <AdminTable headers={["Runtime section", "Status"]}>
            {certificationItems.map((item) => (
              <tr key={item.name}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.ready ? "green" : "amber"}>
                    {item.ready ? "Ready" : "Needs Attention"}
                  </AdminBadge>
                </td>
              </tr>
            ))}
          </AdminTable>
        </section>
      </section>

      <section className="grid gap-4" id="provider-usage-analytics">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-400">
              Provider Usage Analytics
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Integration operations by provider
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
              Aggregated from integration health states, audit logs, webhook monitoring records, billing events, and monitoring events. No raw payloads or secrets are displayed.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-3" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Range
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={providerUsage.range}
                name="usageRange"
              >
                {usageRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageProvider}
                name="usageProvider"
              >
                <option value="all">All providers</option>
                {providerUsage.providers.map((provider) => (
                  <option key={provider.providerKey} value={provider.providerKey}>
                    {provider.providerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Category
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={usageCategory}
                name="usageCategory"
              >
                <option value="all">All categories</option>
                {usageCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-violet-200 bg-violet-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-violet-700 sm:col-span-3"
              type="submit"
            >
              Apply usage filters
            </button>
          </form>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Total Provider Operations", value: providerUsage.totalOperations },
            { label: "Successful Operations", value: providerUsage.successfulOperations },
            { label: "Failed Operations", value: providerUsage.failedOperations },
            { label: "Failure Rate", value: formatPercent(providerUsage.failureRate) },
            { label: "Webhook Events", value: providerUsage.webhookEvents },
            {
              label: "Average Response Time",
              value: providerUsage.averageResponseTimeMs === null ? "n/a" : `${providerUsage.averageResponseTimeMs} ms`
            }
          ]}
        />

        <AdminTable
          empty={!filteredUsageProviders.length ? "No provider usage metrics match the current filters." : null}
          headers={[
            "Provider",
            "Category",
            "Operations",
            "Success",
            "Failed",
            "Failure rate",
            "Avg response",
            "Last success",
            "Last failure"
          ]}
        >
          {filteredUsageProviders.map((provider) => (
            <tr key={provider.providerKey}>
              <td className="px-5 py-4 font-bold text-slate-950">{provider.providerName}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(provider.category)}>{provider.category}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {provider.totalOperations}
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Webhooks: {provider.webhookEvents} · Health: {provider.healthChecks} · Diagnostics: {provider.diagnosticsRuns}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">{provider.successfulOperations}</td>
              <td className="px-5 py-4 text-slate-600">{provider.failedOperations}</td>
              <td className="px-5 py-4 text-slate-600">{formatPercent(provider.failureRate)}</td>
              <td className="px-5 py-4 text-slate-600">
                {provider.averageResponseTimeMs === null ? "n/a" : `${provider.averageResponseTimeMs} ms`}
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(provider.lastSuccess)}</td>
              <td className="px-5 py-4 text-slate-600">
                {formatAdminDate(provider.lastFailure)}
                {provider.consecutiveFailures ? (
                  <p className="mt-2 text-xs font-semibold text-red-500">
                    Consecutive failures: {provider.consecutiveFailures}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminTable
          empty={!filteredFailureBreakdown.length ? "No provider failures match the current filters." : null}
          headers={["Provider", "Error code", "Count", "Last seen"]}
        >
          {filteredFailureBreakdown.map((failure) => (
            <tr key={`${failure.providerKey}:${failure.errorCode}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{failure.providerName}</td>
              <td className="px-5 py-4 text-slate-600">{failure.errorCode}</td>
              <td className="px-5 py-4 text-slate-600">{failure.count}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(failure.lastSeen)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

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
                "Last success",
                "Last failure",
                "Response time",
                "Consecutive failures",
                "Health",
                "Diagnostic",
                "Last safe error",
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
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(integration.lastSuccessAt)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(integration.lastFailureAt)}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {integration.responseTimeMs === null ? "Not checked" : `${integration.responseTimeMs} ms`}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{integration.consecutiveFailures}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.healthStatus)}>{integration.healthStatus}</AdminBadge>
                    {rotationRequiredByProvider.has(integration.key) ? (
                      <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                        Secret rotation required
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <AdminBadge tone={toneForStatus(diagnosticMessage(integration.lastSafeResponseSummary).status)}>
                      {diagnosticMessage(integration.lastSafeResponseSummary).status}
                    </AdminBadge>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {diagnosticMessage(integration.lastSafeResponseSummary).safeMessage}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {integration.lastErrorMessage ?? "No safe error recorded"}
                    {integration.lastErrorCode ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Code: {integration.lastErrorCode}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={toneForStatus(integration.secretStatus)}>{integration.secretStatus}</AdminBadge>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Values are never displayed. Only masked configured/missing state is shown.
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="grid min-w-56 gap-2">
                      <form action={checkIntegrationProvider}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                          Check provider
                        </button>
                      </form>
                      <form action={testIntegrationConnectionAction}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <button className="h-9 w-full rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-indigo-700" type="submit">
                          Test connection
                        </button>
                      </form>
                      <form action={syncIntegrationProviderStatusAction}>
                        <input name="integrationKey" type="hidden" value={integration.key} />
                        <button className="h-9 w-full rounded-full border border-cyan-200 bg-cyan-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-cyan-700" type="submit">
                          Sync provider status
                        </button>
                      </form>
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

      <section className="grid gap-4" id="webhook-monitoring-center">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
              Webhook Monitoring Center
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Provider webhook events
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Safe monitoring records only. Full raw payloads, signatures, tokens, and secrets are never stored or displayed.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-3" method="get">
            <input name="webhookFailedOnly" type="hidden" value="false" />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={webhookProvider}
                name="webhookProvider"
              >
                <option value="all">All providers</option>
                {control.integrations.map((integration) => (
                  <option key={integration.key} value={integration.key}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={webhookStatus}
                name="webhookStatus"
              >
                {webhookStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Event type
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={webhookEventType}
                name="webhookEventType"
              >
                <option value="all">All event types</option>
                {webhookEventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Window
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={webhookWindow}
                name="webhookWindow"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="all">All records</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <input
                className="h-4 w-4 rounded border-slate-300"
                defaultChecked={webhookFailedOnly}
                name="webhookFailedOnly"
                type="checkbox"
                value="true"
              />
              Failed only
            </label>
            <button
              className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
              type="submit"
            >
              Apply webhook filters
            </button>
          </form>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Total webhooks", value: webhookStats.total },
            { label: "Processed", value: webhookStats.processed },
            { label: "Failed", value: webhookStats.failed },
            { label: "Retry pending", value: webhookStats.retryPending },
            { label: "Ignored", value: webhookStats.ignored }
          ]}
        />

        <AdminTable
          empty={!webhookEvents.length ? "No webhook monitoring events match the current filters." : null}
          headers={[
            "Provider",
            "Event type",
            "Status",
            "HTTP",
            "Attempts",
            "Last attempt",
            "Processed",
            "Error",
            "Related",
            "Safe summary"
          ]}
        >
          {webhookEvents.map((event) => (
            <tr key={event.id}>
              <td className="px-5 py-4 font-bold text-slate-950">{event.providerKey}</td>
              <td className="px-5 py-4 text-slate-600">{event.eventType}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(event.status)}>{event.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{event.httpStatus ?? "n/a"}</td>
              <td className="px-5 py-4 text-slate-600">{event.attempts}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.lastAttemptAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.processedAt)}</td>
              <td className="px-5 py-4 text-slate-600">
                {event.errorMessage ?? "None"}
                {event.errorCode ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Code: {event.errorCode}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-4 text-slate-600">
                {event.relatedEntityType ?? "None"}
                {event.relatedEntityId ? (
                  <p className="mt-2 break-all text-xs font-semibold text-slate-500">
                    {event.relatedEntityId}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-4 break-all text-slate-600">{safeSummaryText(event.safePayloadSummary)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4" id="secret-rotation-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Super Admin metadata only</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">Secret Rotation Center</h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
            Tracks rotation metadata for named integration secret keys only. This page never reads, displays, edits, or rotates actual environment variable values.
          </p>
        </div>
        <AdminTable
          empty={!secretRotationRecords.length ? "No integration secret key names are registered in the catalog." : null}
          headers={[
            "Provider",
            "Secret key name",
            "Category",
            "Status",
            "Last rotated",
            "Next due",
            "Rotation required",
            "Note",
            "Actions"
          ]}
        >
          {secretRotationRecords.map((record) => (
            <tr key={`${record.providerKey}:${record.secretKeyName}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{record.providerName}</td>
              <td className="px-5 py-4 font-mono text-xs font-black text-slate-700">{record.secretKeyName}</td>
              <td className="px-5 py-4 text-slate-600">{record.secretCategory}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(record.status)}>{record.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(record.lastRotatedAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(record.nextRotationDueAt)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={record.rotationRequired ? "amber" : "green"}>
                  {record.rotationRequired ? "required" : "not_required"}
                </AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{record.rotationNote ?? "No note"}</td>
              <td className="px-5 py-4">
                <div className="grid min-w-72 gap-3">
                  <form action={markSecretRotatedAction} className="grid gap-2 rounded-2xl border border-green-100 bg-green-50 p-3">
                    <input name="providerKey" type="hidden" value={record.providerKey} />
                    <input name="secretKeyName" type="hidden" value={record.secretKeyName} />
                    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-green-700">
                      Next due
                      <input
                        className="h-9 rounded-xl border border-green-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700"
                        name="nextRotationDueAt"
                        type="date"
                      />
                    </label>
                    <input
                      className="h-9 rounded-xl border border-green-200 bg-white px-3 text-sm font-semibold text-slate-700"
                      maxLength={500}
                      name="rotationNote"
                      placeholder="Optional safe note"
                    />
                    <button className="h-9 rounded-full bg-green-600 px-3 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                      Mark as rotated
                    </button>
                  </form>
                  <form action={markRotationRequiredAction} className="grid gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <input name="providerKey" type="hidden" value={record.providerKey} />
                    <input name="secretKeyName" type="hidden" value={record.secretKeyName} />
                    <input
                      className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-slate-700"
                      maxLength={500}
                      name="rotationNote"
                      placeholder="Why rotation is required"
                    />
                    <button className="h-9 rounded-full bg-amber-500 px-3 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                      Mark rotation required
                    </button>
                  </form>
                  <form action={updateSecretRotationNoteAction} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <input name="providerKey" type="hidden" value={record.providerKey} />
                    <input name="secretKeyName" type="hidden" value={record.secretKeyName} />
                    <input
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                      defaultValue={record.rotationNote ?? ""}
                      maxLength={500}
                      name="rotationNote"
                      placeholder="Safe metadata note only"
                    />
                    <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                      Add rotation note
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4" id="integration-error-center">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Integration Error Center
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Provider errors needing review
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Built from failed integration audit logs and current degraded/failed health states. No provider API calls or retries run from this section.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-3" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorProvider}
                name="errorProvider"
              >
                <option value="all">All providers</option>
                {control.integrations.map((integration) => (
                  <option key={integration.key} value={integration.key}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Category
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorCategory}
                name="errorCategory"
              >
                <option value="all">All categories</option>
                {control.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorStatus}
                name="errorStatus"
              >
                {errorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              From
              <input
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorFrom}
                name="errorFrom"
                type="date"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              To
              <input
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={errorTo}
                name="errorTo"
                type="date"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <input name="unresolvedOnly" type="hidden" value="false" />
              <input
                className="h-4 w-4 rounded border-slate-300"
                defaultChecked={unresolvedOnly}
                name="unresolvedOnly"
                type="checkbox"
                value="true"
              />
              Unresolved only
            </label>
            <button
              className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700 sm:col-span-3"
              type="submit"
            >
              Apply error filters
            </button>
          </form>
        </div>

        <AdminTable
          empty={!integrationErrors.length ? "No integration errors match the current filters." : null}
          headers={[
            "Provider",
            "Category",
            "Operation",
            "Status",
            "Error",
            "Related",
            "Created",
            "Resolved",
            "Actions"
          ]}
        >
          {integrationErrors.map((error) => (
            <tr key={`${error.source}-${error.errorId}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{error.providerName}</td>
              <td className="px-5 py-4 text-slate-600">{error.category}</td>
              <td className="px-5 py-4 text-slate-600">{error.operation}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(error.status)}>{error.status}</AdminBadge>
                <p className="mt-2 text-xs font-semibold text-slate-500">{error.source.replace(/_/g, " ")}</p>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {error.errorCode ?? "No code"}
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  {error.errorMessage ?? "No safe error message"}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {error.storeId ? `Store: ${error.storeId}` : "No store"}
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {error.relatedEntityType && error.relatedEntityId
                    ? `${error.relatedEntityType}: ${error.relatedEntityId}`
                    : "No related entity"}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(error.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">
                {error.resolvedAt ? formatAdminDate(error.resolvedAt) : "Unresolved"}
                {error.resolutionNote ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">{error.resolutionNote}</p>
                ) : null}
              </td>
              <td className="px-5 py-4">
                <div className="grid min-w-56 gap-2">
                  {error.source === "health_state" ? (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                      Health state errors resolve after a future healthy check.
                    </p>
                  ) : error.resolvedAt ? (
                    <form action={reopenIntegrationErrorAction}>
                      <input name="errorId" type="hidden" value={error.errorId} />
                      <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                        Reopen
                      </button>
                    </form>
                  ) : (
                    <form action={markIntegrationErrorResolvedAction} className="grid gap-2">
                      <input name="errorId" type="hidden" value={error.errorId} />
                      <input
                        className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                        name="resolutionNote"
                        placeholder="Resolution note"
                        type="text"
                      />
                      <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                        Mark resolved
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4" id="integration-audit-logs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Integration Audit Logs
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Provider operation audit trail
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Safe summaries only. No API keys, tokens, webhook secrets, or raw provider responses are stored or displayed.
            </p>
          </div>
          <form className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-3" method="get">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Provider
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditProvider}
                name="auditProvider"
              >
                <option value="all">All providers</option>
                {control.integrations.map((integration) => (
                  <option key={integration.key} value={integration.key}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Category
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditCategory}
                name="auditCategory"
              >
                <option value="all">All categories</option>
                {control.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Status
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700"
                defaultValue={auditStatus}
                name="auditStatus"
              >
                {auditStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700 sm:col-span-3"
              type="submit"
            >
              Apply audit filters
            </button>
          </form>
        </div>

        <AdminTable
          empty={!auditLogs.length ? "No integration audit logs match the current filters." : null}
          headers={[
            "Time",
            "Provider",
            "Category",
            "Operation",
            "Status",
            "Error code",
            "Safe summary"
          ]}
        >
          {auditLogs.map((log) => (
            <tr key={log.id}>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(log.createdAt)}</td>
              <td className="px-5 py-4 font-bold text-slate-950">{log.providerName}</td>
              <td className="px-5 py-4 text-slate-600">{log.category}</td>
              <td className="px-5 py-4 text-slate-600">{log.operation}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(log.status)}>{log.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{log.errorCode ?? "None"}</td>
              <td className="px-5 py-4 break-all text-slate-600">{safeSummaryText(log.safeSummary)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              {hook === "Test connection" || hook === "Sync provider status" ? (
                <form action={runAllProviderDiagnosticsAction}>
                  <button
                    className="h-8 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                    type="submit"
                  >
                    Run safe diagnostics
                  </button>
                </form>
              ) : (
                <button
                  className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                  disabled
                  type="button"
                >
                  Reserved placeholder
                </button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
