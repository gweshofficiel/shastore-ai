import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ResellerInventoryCard } from "@/components/reseller-showcase/dashboard-panels";
import { getResellerInventoryData } from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function ResellerSubscriptionPage() {
  const inventory = await getResellerInventoryData();

  return (
    <>
      <PageHeader
        description="Reseller subscription inventory limits for ready store listings. SHASTORE earns from reseller subscriptions only."
        title="Reseller Subscription"
      />
      <ResellerInventoryCard inventory={inventory} variant="full" />
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Plan limits foundation
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {inventory.planLimits.map((plan) => (
            <div
              className={`rounded-3xl border p-5 ${
                plan.name === inventory.currentPlan
                  ? "border-violet-200 bg-violet-50"
                  : "border-slate-200 bg-slate-50"
              }`}
              key={plan.name}
            >
              <p className="text-sm font-black text-ink">{plan.name}</p>
              <p className="mt-3 text-3xl font-black text-ink">{plan.allowedStoreListings}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                listings allowed
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">{plan.note}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
          Subscription safety
        </p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          This phase does not add wallets, payouts, withdrawals, or fake sales. Future external buyer
          sales can consume inventory, while reseller money stays outside SHASTORE payout logic.
        </p>
      </Card>
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {inventory.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
