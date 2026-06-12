import { AdminBadge, AdminHeader, AdminTable, formatAdminMoney } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import { getAdminAccess } from "@/lib/admin-access";
import { saveSubscriptionPlanPricing } from "@/lib/admin/billing-plan-actions";
import { getAdminManagedBillingPlans } from "@/lib/billing/managed-plans";

export const dynamic = "force-dynamic";

function inputClassName() {
  return "h-10 w-28 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-slate-400";
}

export default async function AdminBillingSettingsPage() {
  const [access, plans] = await Promise.all([
    getAdminAccess(),
    getAdminManagedBillingPlans()
  ]);
  const canEdit = access.internalRole === "super_admin";
  const editablePlans = plans.filter((plan) => plan.id === "starter" || plan.id === "pro" || plan.id === "agency");

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin pricing controls for platform subscription plans. Changes are read at runtime by billing cards and NOWPayments checkout, so price tests do not require code changes."
        title="Billing Settings"
      />

      {!canEdit ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold leading-6 text-amber-800">
            Only Super Admin can edit subscription pricing. You can view the current catalog.
          </p>
        </Card>
      ) : null}

      <form action={saveSubscriptionPlanPricing}>
        <AdminTable
          empty={!editablePlans.length ? "No editable subscription plans found." : null}
          headers={["Plan", "Monthly", "Yearly", "Status", "Runtime", "Save"]}
        >
          {editablePlans.map((plan, index) => (
            <tr key={plan.id}>
              <td className="px-5 py-4">
                <div className="grid gap-1">
                  <span className="font-bold text-slate-950">{plan.name}</span>
                  <span className="text-xs font-semibold text-slate-500">{plan.id}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  USD
                  <input
                    className={inputClassName()}
                    defaultValue={plan.priceCents / 100}
                    disabled={!canEdit}
                    min="0"
                    name={`${plan.id}_monthly_price`}
                    step="0.01"
                    type="number"
                  />
                </label>
              </td>
              <td className="px-5 py-4">
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  USD
                  <input
                    className={inputClassName()}
                    defaultValue={plan.yearlyPrice}
                    disabled={!canEdit}
                    min="0"
                    name={`${plan.id}_yearly_price`}
                    step="0.01"
                    type="number"
                  />
                </label>
              </td>
              <td className="px-5 py-4">
                <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <input
                    className="h-4 w-4 rounded border-slate-300"
                    defaultChecked={plan.active}
                    disabled={!canEdit}
                    name="activePlanId"
                    type="checkbox"
                    value={plan.id}
                  />
                  Enabled
                </label>
              </td>
              <td className="px-5 py-4">
                <div className="grid gap-2">
                  <AdminBadge tone={plan.active ? "green" : "amber"}>
                    {plan.active ? "active" : "disabled"}
                  </AdminBadge>
                  <span className="text-xs font-semibold text-slate-500">
                    Billing page: {formatAdminMoney(plan.priceCents / 100)}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4">
                {index === 0 ? (
                  <button
                    className="h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white disabled:bg-slate-300"
                    disabled={!canEdit}
                    type="submit"
                  >
                    Save changes
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">Saved together</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      </form>

      <Card className="p-5 text-sm font-semibold leading-6 text-slate-500">
        Stripe checkout continues to use the configured platform Stripe price IDs. NOWPayments
        invoices use the runtime monthly price shown here.
      </Card>
    </div>
  );
}
