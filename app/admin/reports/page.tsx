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

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">RP-3 Store Reports</span>
          <AdminBadge tone={toneForStatus(control.storeReports.status)}>{control.storeReports.status}</AdminBadge>
          <span className="text-xs text-slate-600">{control.storeReports.rangeLabel}</span>
        </div>

        {control.storeReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.storeReports.errorMessage}
          </p>
        ) : null}

        {control.storeReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No store source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total stores", value: control.storeReports.metrics.totalStores },
            { label: "Active stores", value: control.storeReports.metrics.activeStores },
            { label: "Inactive stores", value: control.storeReports.metrics.inactiveStores },
            { label: "Suspended stores", value: control.storeReports.metrics.suspendedStores },
            { label: "Newly created", value: control.storeReports.metrics.newlyCreatedStores },
            { label: "With domains", value: control.storeReports.metrics.storesWithDomains },
            { label: "With owners", value: control.storeReports.metrics.storesWithOwners }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.storeReports.summary}
          {control.storeReports.lastUpdatedAt
            ? ` · Last store activity ${control.storeReports.lastUpdatedAt}`
            : " · No store activity timestamps recorded"}
        </p>

        {control.storeReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.storeReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Store status", "Count", "Availability"]}>
          {control.storeReports.storesByStatus.length ? (
            control.storeReports.storesByStatus.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No store status breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Owner plan", "Store count", "Availability"]}>
          {control.storeReports.storesByPlan.length ? (
            control.storeReports.storesByPlan.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No store plan breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">RP-4 User Reports</span>
          <AdminBadge tone={toneForStatus(control.userReports.status)}>{control.userReports.status}</AdminBadge>
          <span className="text-xs text-slate-600">{control.userReports.rangeLabel}</span>
        </div>

        {control.userReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.userReports.errorMessage}
          </p>
        ) : null}

        {control.userReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No user source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total users", value: control.userReports.metrics.totalUsers },
            { label: "Active users", value: control.userReports.metrics.activeUsers },
            {
              label: "Suspended/disabled",
              value: control.userReports.metrics.suspendedDisabledUsers
            },
            { label: "Newly registered", value: control.userReports.metrics.newlyRegisteredUsers },
            { label: "Owners", value: control.userReports.metrics.ownersCount },
            { label: "Resellers", value: control.userReports.metrics.resellersCount },
            { label: "Customers", value: control.userReports.metrics.customersCount },
            { label: "Team members", value: control.userReports.metrics.teamMembersCount }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.userReports.summary}
          {control.userReports.lastUpdatedAt
            ? ` · Last user activity ${control.userReports.lastUpdatedAt}`
            : " · No user activity timestamps recorded"}
        </p>

        {control.userReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.userReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["User role / account type", "Count", "Availability"]}>
          {control.userReports.usersByRole.length ? (
            control.userReports.usersByRole.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No user role breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-5 Subscription Reports
          </span>
          <AdminBadge tone={toneForStatus(control.subscriptionReports.status)}>
            {control.subscriptionReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.subscriptionReports.rangeLabel}</span>
        </div>

        {control.subscriptionReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.subscriptionReports.errorMessage}
          </p>
        ) : null}

        {control.subscriptionReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No subscription source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total subscriptions", value: control.subscriptionReports.metrics.totalSubscriptions },
            { label: "Active subscriptions", value: control.subscriptionReports.metrics.activeSubscriptions },
            { label: "Free subscriptions", value: control.subscriptionReports.metrics.freeSubscriptions },
            { label: "Paid subscriptions", value: control.subscriptionReports.metrics.paidSubscriptions },
            { label: "Trial subscriptions", value: control.subscriptionReports.metrics.trialSubscriptions },
            {
              label: "Newly activated",
              value: control.subscriptionReports.metrics.newlyActivatedSubscriptions
            },
            {
              label: "Cancelled/expired",
              value: control.subscriptionReports.metrics.cancelledExpiredSubscriptions
            }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.subscriptionReports.summary}
          {control.subscriptionReports.lastUpdatedAt
            ? ` · Last subscription activity ${control.subscriptionReports.lastUpdatedAt}`
            : " · No subscription activity timestamps recorded"}
        </p>

        {control.subscriptionReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.subscriptionReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Plan", "Count", "Availability"]}>
          {control.subscriptionReports.subscriptionsByPlan.length ? (
            control.subscriptionReports.subscriptionsByPlan.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No subscription plan breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Status", "Count", "Availability"]}>
          {control.subscriptionReports.subscriptionsByStatus.length ? (
            control.subscriptionReports.subscriptionsByStatus.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No subscription status breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Provider", "Count", "Availability"]}>
          {control.subscriptionReports.subscriptionsByProvider.length ? (
            control.subscriptionReports.subscriptionsByProvider.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No subscription provider breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-6 Payment Reports
          </span>
          <AdminBadge tone={toneForStatus(control.paymentReports.status)}>
            {control.paymentReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.paymentReports.rangeLabel}</span>
        </div>

        {control.paymentReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.paymentReports.errorMessage}
          </p>
        ) : null}

        {control.paymentReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No payment source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total payments", value: control.paymentReports.metrics.totalPayments },
            { label: "Successful payments", value: control.paymentReports.metrics.successfulPayments },
            { label: "Failed payments", value: control.paymentReports.metrics.failedPayments },
            { label: "Pending payments", value: control.paymentReports.metrics.pendingPayments },
            { label: "Cancelled payments", value: control.paymentReports.metrics.cancelledPayments },
            { label: "Refunded payments", value: control.paymentReports.metrics.refundedPayments },
            {
              label: "Payment volume",
              value: formatAdminMoney(control.paymentReports.metrics.paymentVolume)
            }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.paymentReports.summary}
          {control.paymentReports.lastUpdatedAt
            ? ` · Last payment activity ${control.paymentReports.lastUpdatedAt}`
            : " · No payment activity timestamps recorded"}
        </p>

        {control.paymentReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.paymentReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Latest activity", "Source", "Provider", "Status", "Amount", "Availability"]}>
          {control.paymentReports.latestPaymentActivity.length ? (
            control.paymentReports.latestPaymentActivity.map((item) => (
              <tr key={`${item.activityAt}-${item.source}-${item.provider}-${item.status}`}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.activityAt}</td>
                <td className="px-5 py-4 text-slate-600">{item.source}</td>
                <td className="px-5 py-4 text-slate-600">{item.provider}</td>
                <td className="px-5 py-4 text-slate-600">{item.status}</td>
                <td className="px-5 py-4 text-slate-600">{item.amountLabel}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No latest payment activity is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Provider", "Payments", "Successful", "Failed", "Volume", "Availability"]}>
          {control.paymentReports.paymentsByProvider.length ? (
            control.paymentReports.paymentsByProvider.map((item) => (
              <tr key={item.provider}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.provider}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4 text-slate-600">{item.successfulPayments}</td>
                <td className="px-5 py-4 text-slate-600">{item.failedPayments}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(item.paymentVolume)}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No payment provider breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Currency", "Payments", "Volume", "Availability"]}>
          {control.paymentReports.paymentsByCurrency.length ? (
            control.paymentReports.paymentsByCurrency.map((item) => (
              <tr key={item.currency}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.currency}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4 text-slate-600">{formatAdminMoney(item.paymentVolume)}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={4}>
                No payment currency breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Payment status", "Count", "Availability"]}>
          {control.paymentReports.paymentsByStatus.length ? (
            control.paymentReports.paymentsByStatus.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No payment status breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">RP-7 AI Reports</span>
          <AdminBadge tone={toneForStatus(control.aiReports.status)}>{control.aiReports.status}</AdminBadge>
          <span className="text-xs text-slate-600">{control.aiReports.rangeLabel}</span>
        </div>

        {control.aiReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.aiReports.errorMessage}
          </p>
        ) : null}

        {control.aiReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No AI source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total AI requests", value: control.aiReports.metrics.totalAIRequests },
            { label: "Successful AI requests", value: control.aiReports.metrics.successfulAIRequests },
            { label: "Failed AI requests", value: control.aiReports.metrics.failedAIRequests },
            { label: "Blocked or unsafe attempts", value: control.aiReports.metrics.blockedOrUnsafeAttempts },
            { label: "Credits usage", value: control.aiReports.metrics.creditsUsage },
            {
              label: "Estimated cost",
              value: formatAdminMoney(control.aiReports.metrics.estimatedCost)
            }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.aiReports.summary}
          {control.aiReports.lastUpdatedAt
            ? ` · Last AI activity ${control.aiReports.lastUpdatedAt}`
            : " · No AI activity timestamps recorded"}
        </p>

        {control.aiReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.aiReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Latest activity", "Feature", "Provider", "Scope", "Status", "Availability"]}>
          {control.aiReports.latestAIActivity.length ? (
            control.aiReports.latestAIActivity.map((item) => (
              <tr key={`${item.activityAt}-${item.feature}-${item.provider}-${item.scopeLabel}`}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.activityAt}</td>
                <td className="px-5 py-4 text-slate-600">{item.feature}</td>
                <td className="px-5 py-4 text-slate-600">{item.provider}</td>
                <td className="px-5 py-4 text-slate-600">{item.scopeLabel}</td>
                <td className="px-5 py-4 text-slate-600">{item.status}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No latest AI activity is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["AI feature", "Count", "Availability"]}>
          {control.aiReports.usageByFeature.length ? (
            control.aiReports.usageByFeature.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No AI feature breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Workspace or store", "Count", "Availability"]}>
          {control.aiReports.usageByWorkspaceOrStore.length ? (
            control.aiReports.usageByWorkspaceOrStore.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No workspace or store AI breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["User role", "Count", "Availability"]}>
          {control.aiReports.usageByUserRole.length ? (
            control.aiReports.usageByUserRole.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No user role AI breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-8 Domain & Email Reports
          </span>
          <AdminBadge tone={toneForStatus(control.domainEmailReports.status)}>
            {control.domainEmailReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.domainEmailReports.rangeLabel}</span>
        </div>

        {control.domainEmailReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.domainEmailReports.errorMessage}
          </p>
        ) : null}

        {control.domainEmailReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No domain or email source data is available for this range yet. Planned indicators remain safe and
            read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total domains", value: control.domainEmailReports.metrics.totalDomains },
            { label: "Active domains", value: control.domainEmailReports.metrics.activeDomains },
            { label: "Pending domains", value: control.domainEmailReports.metrics.pendingDomains },
            { label: "Failed domains", value: control.domainEmailReports.metrics.failedDomains },
            { label: "Total email services", value: control.domainEmailReports.metrics.totalEmailServices },
            { label: "Active email services", value: control.domainEmailReports.metrics.activeEmailServices },
            { label: "Pending email services", value: control.domainEmailReports.metrics.pendingEmailServices }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.domainEmailReports.summary}
          {control.domainEmailReports.lastUpdatedAt
            ? ` · Last domain or email activity ${control.domainEmailReports.lastUpdatedAt}`
            : " · No domain or email activity timestamps recorded"}
        </p>

        {control.domainEmailReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.domainEmailReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Latest domain activity", "Scope", "Provider", "Domain", "Status", "Availability"]}>
          {control.domainEmailReports.latestDomainActivity.length ? (
            control.domainEmailReports.latestDomainActivity.map((item) => (
              <tr key={`${item.activityAt}-${item.scopeLabel}-${item.label}-${item.status}`}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.activityAt}</td>
                <td className="px-5 py-4 text-slate-600">{item.scopeLabel}</td>
                <td className="px-5 py-4 text-slate-600">{item.provider}</td>
                <td className="px-5 py-4 text-slate-600">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.status}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No latest domain activity is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Latest email activity", "Scope", "Provider", "Mailbox", "Status", "Availability"]}>
          {control.domainEmailReports.latestEmailActivity.length ? (
            control.domainEmailReports.latestEmailActivity.map((item) => (
              <tr key={`${item.activityAt}-${item.scopeLabel}-${item.label}-${item.status}`}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.activityAt}</td>
                <td className="px-5 py-4 text-slate-600">{item.scopeLabel}</td>
                <td className="px-5 py-4 text-slate-600">{item.provider}</td>
                <td className="px-5 py-4 text-slate-600">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.status}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={6}>
                No latest email activity is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Domain status", "Count", "Availability"]}>
          {control.domainEmailReports.domainsByStatus.length ? (
            control.domainEmailReports.domainsByStatus.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No domain status breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Domain extension", "Count", "Availability"]}>
          {control.domainEmailReports.domainsByExtension.length ? (
            control.domainEmailReports.domainsByExtension.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No domain extension breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Domain provider", "Count", "Availability"]}>
          {control.domainEmailReports.domainsByProvider.length ? (
            control.domainEmailReports.domainsByProvider.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No domain provider breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-9 Marketplace Reports
          </span>
          <AdminBadge tone={toneForStatus(control.marketplaceReports.status)}>
            {control.marketplaceReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.marketplaceReports.rangeLabel}</span>
        </div>

        {control.marketplaceReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.marketplaceReports.errorMessage}
          </p>
        ) : null}

        {control.marketplaceReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No marketplace source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            {
              label: "Total marketplace items",
              value: control.marketplaceReports.metrics.totalMarketplaceItems
            },
            { label: "Approved items", value: control.marketplaceReports.metrics.approvedItems },
            { label: "Pending review items", value: control.marketplaceReports.metrics.pendingReviewItems },
            { label: "Draft items", value: control.marketplaceReports.metrics.draftItems },
            { label: "Rejected items", value: control.marketplaceReports.metrics.rejectedItems },
            { label: "Archived items", value: control.marketplaceReports.metrics.archivedItems },
            { label: "Creators", value: control.marketplaceReports.metrics.creatorsCount },
            { label: "Live installs", value: control.marketplaceReports.metrics.liveInstalls },
            {
              label: "Payments processed",
              value: control.marketplaceReports.metrics.marketplacePaymentsProcessed
            }
          ]}
        />

        <p className="text-xs text-slate-500">
          {control.marketplaceReports.summary}
          {control.marketplaceReports.lastUpdatedAt
            ? ` · Last marketplace activity ${control.marketplaceReports.lastUpdatedAt}`
            : " · No marketplace activity timestamps recorded"}
        </p>

        {control.marketplaceReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
            {control.marketplaceReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <AdminTable headers={["Latest activity", "Type", "Item", "Status", "Availability"]}>
          {control.marketplaceReports.latestMarketplaceActivity.length ? (
            control.marketplaceReports.latestMarketplaceActivity.map((item) => (
              <tr key={`${item.activityAt}-${item.activityType}-${item.itemLabel}-${item.status}`}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.activityAt}</td>
                <td className="px-5 py-4 text-slate-600">{item.activityType}</td>
                <td className="px-5 py-4 text-slate-600">{item.itemLabel}</td>
                <td className="px-5 py-4 text-slate-600">{item.status}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={5}>
                No latest marketplace activity is available for this range yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Marketplace category", "Count", "Availability"]}>
          {control.marketplaceReports.itemsByCategory.length ? (
            control.marketplaceReports.itemsByCategory.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No marketplace category breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>

        <AdminTable headers={["Item status", "Count", "Availability"]}>
          {control.marketplaceReports.itemsByStatus.length ? (
            control.marketplaceReports.itemsByStatus.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-4 text-slate-600" colSpan={3}>
                No marketplace status breakdown is available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-10 Security Reports
          </span>
          <AdminBadge tone={toneForStatus(control.securityReports.status)}>
            {control.securityReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.securityReports.rangeLabel}</span>
        </div>

        {control.securityReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.securityReports.errorMessage}
          </p>
        ) : null}

        {control.securityReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No security audit or monitoring source data is available for this range yet. Planned indicators remain
            safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total security events", value: control.securityReports.metrics.totalSecurityEvents },
            { label: "Audit events", value: control.securityReports.metrics.auditEventsCount },
            { label: "Failed login attempts", value: control.securityReports.metrics.failedLoginAttempts },
            { label: "Successful login events", value: control.securityReports.metrics.successfulLoginEvents },
            { label: "Role changes", value: control.securityReports.metrics.roleChangesCount },
            { label: "Permission changes", value: control.securityReports.metrics.permissionChangesCount },
            { label: "Admin activity", value: control.securityReports.metrics.adminActivityCount },
            { label: "Blocked or denied actions", value: control.securityReports.metrics.blockedOrDeniedActions },
            { label: "RLS denied access", value: control.securityReports.metrics.rlsDeniedAccessEvents }
          ]}
        />

        <p className="text-sm text-slate-600">
          {control.securityReports.summary}
          {control.securityReports.lastUpdatedAt
            ? ` · Last security activity ${control.securityReports.lastUpdatedAt}`
            : ` · ${control.securityReports.lastGeneratedState}`}
        </p>

        {control.securityReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
            {control.securityReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminTable headers={["Latest security activity", "Severity", "Category", "Summary"]}>
            {control.securityReports.latestSecurityActivity.length ? (
              control.securityReports.latestSecurityActivity.map((item) => (
                <tr key={`${item.activityAt}-${item.activityType}`}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{item.activityType}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.activityAt}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={item.severity === "critical" || item.severity === "high" ? "red" : "blue"}>
                      {item.severity}
                    </AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.category}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{item.summary}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-4 text-slate-600" colSpan={4}>
                  No latest security activity is available for this range yet.
                </td>
              </tr>
            )}
          </AdminTable>

          <div className="grid gap-4">
            <AdminTable headers={["Severity", "Count", "Availability"]}>
              {control.securityReports.eventsBySeverity.map((item) => (
                <tr key={item.label}>
                  <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                  <td className="px-5 py-4 text-slate-600">{item.count}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                      {item.dataAvailability}
                    </AdminBadge>
                  </td>
                </tr>
              ))}
            </AdminTable>

            <AdminTable headers={["Category", "Count", "Availability"]}>
              {control.securityReports.eventsByCategory.map((item) => (
                <tr key={item.label}>
                  <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                  <td className="px-5 py-4 text-slate-600">{item.count}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                      {item.dataAvailability}
                    </AdminBadge>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            RP-11 Operations Reports
          </span>
          <AdminBadge tone={toneForStatus(control.operationsReports.status)}>
            {control.operationsReports.status}
          </AdminBadge>
          <span className="text-xs text-slate-600">{control.operationsReports.rangeLabel}</span>
        </div>

        {control.operationsReports.errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {control.operationsReports.errorMessage}
          </p>
        ) : null}

        {control.operationsReports.loadingState === "empty" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No operations source data is available for this range yet. Planned indicators remain safe and read-only.
          </p>
        ) : null}

        <AdminStatGrid
          stats={[
            { label: "Total orders", value: control.operationsReports.metrics.totalOrders },
            { label: "Pending orders", value: control.operationsReports.metrics.pendingOrders },
            { label: "Fulfilled orders", value: control.operationsReports.metrics.fulfilledOrders },
            { label: "Cancelled orders", value: control.operationsReports.metrics.cancelledOrders },
            { label: "Delivery assignments", value: control.operationsReports.metrics.deliveryAssignments },
            { label: "Active deliveries", value: control.operationsReports.metrics.activeDeliveries },
            { label: "Completed deliveries", value: control.operationsReports.metrics.completedDeliveries },
            { label: "Failed deliveries", value: control.operationsReports.metrics.failedDeliveries },
            { label: "Tracking events", value: control.operationsReports.metrics.trackingEvents },
            { label: "Return requests", value: control.operationsReports.metrics.returnRequests },
            { label: "Operational issues", value: control.operationsReports.metrics.operationalIssues }
          ]}
        />

        <p className="text-sm text-slate-600">
          {control.operationsReports.summary}
          {control.operationsReports.lastUpdatedAt
            ? ` · Last operations activity ${control.operationsReports.lastUpdatedAt}`
            : ` · ${control.operationsReports.lastGeneratedState}`}
        </p>

        {control.operationsReports.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
            {control.operationsReports.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminTable headers={["Latest operations activity", "Category", "Status", "Summary"]}>
            {control.operationsReports.latestOperationsActivity.length ? (
              control.operationsReports.latestOperationsActivity.map((item) => (
                <tr key={`${item.activityAt}-${item.activityType}`}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{item.activityType}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.activityAt}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.category}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={item.status === "failed" || item.status === "open" ? "red" : "blue"}>
                      {item.status}
                    </AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{item.summary}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-4 text-slate-600" colSpan={4}>
                  No latest operations activity is available for this range yet.
                </td>
              </tr>
            )}
          </AdminTable>

          <AdminTable headers={["Issue category", "Count", "Availability"]}>
            {control.operationsReports.issuesByCategory.map((item) => (
              <tr key={item.label}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
                <td className="px-5 py-4 text-slate-600">{item.count}</td>
                <td className="px-5 py-4">
                  <AdminBadge tone={item.dataAvailability === "available" ? "green" : "blue"}>
                    {item.dataAvailability}
                  </AdminBadge>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
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
