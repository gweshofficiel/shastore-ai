import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminReportingControl } from "@/lib/admin/data";
import {
  exportReportPlaceholder,
  markReportReviewed,
  scheduleReportPlaceholder,
  viewReportPlaceholder
} from "@/lib/admin/report-actions";

function toneForStatus(status: string) {
  if (status === "ready" || status === "registry_ready") {
    return "green" as const;
  }

  if (status === "review" || status === "needs_attention") {
    return "amber" as const;
  }

  if (status === "planned" || status === "inactive" || status === "placeholder") {
    return "blue" as const;
  }

  return "slate" as const;
}

function toneForCertificationState(state: string) {
  if (state === "certified" || state === "not_applicable") {
    return "green" as const;
  }

  if (state === "needs_attention") {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForVisibility(visibility: string) {
  if (visibility === "owner") {
    return "green" as const;
  }

  if (visibility === "super_admin") {
    return "blue" as const;
  }

  return "slate" as const;
}

function ReportHiddenFields({
  report
}: {
  report: Awaited<ReturnType<typeof getAdminReportingControl>>["reports"][number];
}) {
  return (
    <>
      <input name="reportId" type="hidden" value={report.reportId} />
      <input name="reportName" type="hidden" value={report.name} />
      <input name="category" type="hidden" value={report.category} />
    </>
  );
}

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const query = await searchParams;
  const control = await getAdminReportingControl(query.range as never);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global Super Admin reporting across existing users, stores, subscriptions, revenue, AI, domains, payments, marketplace, security, and operations data. No Store Owner reports, analytics systems, or billing systems are rewritten here."
        title="Reporting Center"
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Reports registry</span>
        <AdminBadge tone={toneForStatus(control.registry.status)}>{control.registry.status}</AdminBadge>
        <span className="text-xs text-slate-600">
          {control.registry.summary} · {control.registry.totalEntries} roadmap entries
        </span>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Revenue estimate", value: formatAdminMoney(control.overview.totalRevenueEstimate) },
          { label: "Active stores", value: control.overview.activeStores },
          { label: "Active users", value: control.overview.activeUsers },
          { label: "Paid subscriptions", value: control.overview.paidSubscriptions },
          { label: "Failed payments", value: control.overview.failedPayments },
          { label: "AI usage", value: control.overview.aiUsage },
          { label: "Domain orders", value: control.overview.domainOrders },
          { label: "Support tickets", value: control.overview.supportTickets },
          { label: "Security events", value: control.overview.securityEvents }
        ]}
      />

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-4">
        {control.dateFilters.map((filter) => (
          <Link
            className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
              filter.active
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
            href={filter.href}
            key={filter.value}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <AdminTable headers={["Report category", "Status", "Description"]}>
        {control.categories.map((category) => (
          <tr key={category.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{category.name}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(category.status)}>{category.status}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{category.description}</td>
          </tr>
        ))}
      </AdminTable>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">RP-2 Revenue Reports</span>
          <AdminBadge tone={toneForStatus(control.revenueReports.status)}>{control.revenueReports.status}</AdminBadge>
          <span className="text-xs text-slate-600">{control.revenueReports.rangeLabel}</span>
        </div>

        {control.revenueReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.revenueReports.errorMessage}
          </p>
        ) : null}

        {control.revenueReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No revenue source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total revenue", value: formatAdminMoney(control.revenueReports.metrics.totalRevenue) },
            {
              label: "Subscription revenue",
              value: formatAdminMoney(control.revenueReports.metrics.subscriptionRevenue)
            },
            {
              label: "Commerce order revenue",
              value: formatAdminMoney(control.revenueReports.metrics.commerceOrderRevenue)
            },
            { label: "Successful payments", value: control.revenueReports.metrics.successfulPayments },
            { label: "Failed payments", value: control.revenueReports.metrics.failedPayments },
            {
              label: "Refunded/cancelled",
              value: control.revenueReports.metrics.refundedOrCancelledPayments
            }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.revenueReports.summary}
          {control.revenueReports.lastUpdatedAt
            ? ` · Last source activity ${control.revenueReports.lastUpdatedAt}`
            : " · No in-range source activity recorded"}
        </p>

        {control.revenueReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.revenueReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Provider", "Revenue", "Successful", "Failed", "Refunded/cancelled", "Availability"]}>
          {control.revenueReports.providerBreakdown.length ? (
            control.revenueReports.providerBreakdown.map((provider) => (
              <tr key={provider.provider}>
                <td className="px-5 py-4 font-bold text-slate-950">{provider.provider}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(provider.revenueAmount)}</td>
                <td className="px-5 py-4 text-slate-600">{provider.successfulPayments}</td>
                <td className="px-5 py-4 text-slate-600">{provider.failedPayments}</td>
                <td className="px-5 py-4 text-slate-600">{provider.refundedOrCancelledPayments}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={provider.dataAvailability === "available" ? "green" : "blue"}>
                    {provider.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No provider revenue breakdown is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Currency", "Commerce revenue", "Invoice revenue", "Total revenue", "Availability"]}>
          {control.revenueReports.currencyBreakdown.length ? (
            control.revenueReports.currencyBreakdown.map((currency) => (
              <tr key={currency.currency}>
                <td className="px-5 py-4 font-bold text-slate-950">{currency.currency}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(currency.commerceOrderRevenue)}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(currency.invoiceRevenue)}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(currency.totalRevenue)}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={currency.dataAvailability === "available" ? "green" : "blue"}>
                    {currency.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={5}>
                No currency breakdown is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <AdminTable
        headers={[
          "Report",
          "Category",
          "Status",
          "Visibility",
          "Last generated",
          "Export",
          "Safe actions",
          "Data source",
          "Future hooks",
          "Certification"
        ]}
      >
        {control.reports.map((report) => (
          <tr key={report.reportKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{report.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {report.roadmapPhase} · {report.reportKey}
              </p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone="blue">{report.category}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(report.status)}>{report.status}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForVisibility(report.visibility)}>{report.visibility}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{report.lastGenerated}</td>
            <td className="px-5 py-4 text-slate-600">{report.exportPlaceholder}</td>
            <td className="px-5 py-4">
              {report.supportsSafeActions ? (
                <div className="grid min-w-52 gap-2">
                  <p className="text-xs text-slate-500">{report.safeActionsLabel}</p>
                  <form action={viewReportPlaceholder}>
                    <ReportHiddenFields report={report} />
                    <button
                      className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                      type="submit"
                    >
                      View report
                    </button>
                  </form>
                  <form action={markReportReviewed}>
                    <ReportHiddenFields report={report} />
                    <button
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                      type="submit"
                    >
                      Mark reviewed
                    </button>
                  </form>
                  <form action={exportReportPlaceholder}>
                    <ReportHiddenFields report={report} />
                    <button
                      className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
                      type="submit"
                    >
                      Export placeholder
                    </button>
                  </form>
                  <form action={scheduleReportPlaceholder}>
                    <ReportHiddenFields report={report} />
                    <button
                      className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                      type="submit"
                    >
                      Schedule placeholder
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid gap-2">
                  <p className="text-xs text-slate-600">{report.safeActionsLabel}</p>
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Read-only
                  </button>
                </div>
              )}
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">{report.dataSourceDescription}</td>
            <td className="px-5 py-4">
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                {report.futureHooks.map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForCertificationState(report.certificationState)}>
                {report.certificationState}
              </AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Aggregated data sources", "Count"]}>
        {control.sources.map((source) => (
          <tr key={source}>
            <td className="px-5 py-4 text-slate-600">{source}</td>
            <td className="px-5 py-4 text-slate-600">
              {control.reports.filter((report) => report.dataSourceDescription === source).length} registry entries
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Aggregated future hooks", "Status"]}>
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
