import {
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { AccountIdCard } from "@/components/account/account-id-card";
import {
  accountProfileUnavailableMessage,
  getOrCreateAccountProfile
} from "@/lib/account-profiles";
import { getAdminAnalytics, getAdminOverview, getAdminPlatformHealth } from "@/lib/admin/data";

export default async function AdminOverviewPage() {
  const [overview, analytics, health, account] = await Promise.all([
    getAdminOverview(),
    getAdminAnalytics(),
    getAdminPlatformHealth(),
    getOrCreateAccountProfile("admin")
  ]);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform owner control center for users, projects, commerce, subscriptions, and conversion health."
        title="Admin control center"
      />
      <AccountIdCard account={account} unavailableMessage={accountProfileUnavailableMessage()} />
      <AdminStatGrid
        stats={[
          { label: "Total users", value: overview.users },
          { label: "Total stores", value: overview.stores },
          { label: "Landing pages", value: overview.landings },
          { label: "Orders", value: overview.orders },
          { label: "Customers", value: overview.customers },
          { label: "Revenue estimate", value: formatAdminMoney(overview.revenueEstimate) },
          { label: "Visitors", value: overview.visitors },
          { label: "Conversion rate", value: `${analytics.conversionRate}%` },
          { label: "Platform health", value: health.label }
        ]}
      />
      <AdminTable headers={["Signal", "Value", "Context"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Conversion rate</td>
          <td className="px-5 py-4 text-slate-600">{analytics.conversionRate}%</td>
          <td className="px-5 py-4 text-slate-500">
            Based on platform page views and conversion events.
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">WhatsApp clicks</td>
          <td className="px-5 py-4 text-slate-600">{analytics.whatsappClicks}</td>
          <td className="px-5 py-4 text-slate-500">
            Captured from public landing and store CTAs.
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Top product</td>
          <td className="px-5 py-4 text-slate-600">
            {analytics.topProducts[0]?.label ?? "No product data"}
          </td>
          <td className="px-5 py-4 text-slate-500">
            Product views and order product snapshots.
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Platform health</td>
          <td className="px-5 py-4 text-slate-600">{health.label}</td>
          <td className="px-5 py-4 text-slate-500">
            {health.failedMonitoringEvents} failed monitoring events, {health.openSupportTickets} open support tickets, and {health.recentSecurityEvents} recent security events.
          </td>
        </tr>
      </AdminTable>
    </div>
  );
}
