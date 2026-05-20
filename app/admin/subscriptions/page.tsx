import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { overrideUserPlan } from "@/lib/billing/admin-actions";
import { billingPlans } from "@/lib/billing/plans";
import { getAdminSubscriptions } from "@/lib/admin/data";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await getAdminSubscriptions();
  const paidUsers = subscriptions.filter((subscription) => subscription.planId !== "free").length;
  const agencyUsers = subscriptions.filter((subscription) => subscription.planId === "agency").length;
  const totalOrders = subscriptions.reduce(
    (total, subscription) => total + subscription.ordersUsed,
    0
  );

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Owner-only subscription controls, usage monitoring, revenue signals, and manual plan overrides."
        title="Subscriptions"
      />
      <AdminStatGrid
        stats={[
          { label: "Users", value: subscriptions.length },
          { label: "Paid users", value: paidUsers },
          { label: "Agency users", value: agencyUsers },
          { label: "Orders tracked", value: totalOrders }
        ]}
      />
      <AdminTable
        empty={!subscriptions.length ? "No subscriptions or users found." : null}
        headers={[
          "User",
          "Plan",
          "Status",
          "Landings",
          "Stores",
          "Domains",
          "Orders",
          "Manual override"
        ]}
      >
        {subscriptions.map((subscription) => (
          <tr key={subscription.userId}>
            <td className="px-5 py-4 font-bold text-slate-950">{subscription.email}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{subscription.plan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge>{subscription.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">
              {subscription.landingsUsed} / {subscription.landingLimit}
            </td>
            <td className="px-5 py-4 text-slate-600">
              {subscription.storesUsed} / {subscription.storeLimit}
            </td>
            <td className="px-5 py-4 text-slate-600">
              {subscription.domainsUsed} / {subscription.domainLimit}
            </td>
            <td className="px-5 py-4 text-slate-600">{subscription.ordersUsed}</td>
            <td className="px-5 py-4">
              <form action={overrideUserPlan} className="flex min-w-64 gap-2">
                <input name="userId" type="hidden" value={subscription.userId} />
                <select
                  className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                  defaultValue={subscription.planId}
                  name="planId"
                >
                  {billingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                <button className="h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white">
                  Save
                </button>
              </form>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
