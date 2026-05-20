import {
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminAnalytics } from "@/lib/admin/data";

export default async function AdminAnalyticsPage() {
  const analytics = await getAdminAnalytics();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform analytics across stores, landing pages, products, orders, visitors, and conversions."
        title="Platform analytics"
      />
      <AdminStatGrid
        stats={[
          { label: "Total visitors", value: analytics.visitors },
          { label: "Total orders", value: analytics.orders },
          { label: "Conversion rate", value: `${analytics.conversionRate}%` },
          { label: "Revenue estimate", value: formatAdminMoney(analytics.revenueEstimate) },
          { label: "WhatsApp clicks", value: analytics.whatsappClicks },
          { label: "Conversions", value: analytics.conversions }
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminTable headers={["Top stores", "Views"]}>
          {analytics.topStores.map((item) => (
            <tr key={item.label}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{item.count}</td>
            </tr>
          ))}
        </AdminTable>
        <AdminTable headers={["Top landing pages", "Views"]}>
          {analytics.topLandings.map((item) => (
            <tr key={item.label}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{item.count}</td>
            </tr>
          ))}
        </AdminTable>
        <AdminTable headers={["Top products", "Signals"]}>
          {analytics.topProducts.map((item) => (
            <tr key={item.label}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{item.count}</td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
