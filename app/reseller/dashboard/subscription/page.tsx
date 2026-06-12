import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerInventoryCard,
  ResellerTemplateInventoryCard
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerSubscriptionPlanEngineData,
  type ResellerInventoryPlan
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

const planOrder: ResellerInventoryPlan[] = ["Starter", "Pro", "Agency", "Enterprise"];

function billingPlanIdForResellerPlan(plan: ResellerInventoryPlan) {
  if (plan === "Starter") {
    return "starter";
  }

  if (plan === "Pro") {
    return "pro";
  }

  if (plan === "Agency") {
    return "agency";
  }

  return null;
}

export default async function ResellerSubscriptionPage({
  searchParams
}: {
  searchParams: Promise<{
    billing?: string;
    message?: string;
  }>;
}) {
  const query = await searchParams;
  const planEngine = await getResellerSubscriptionPlanEngineData();
  const inventory = planEngine.inventory;
  const templateInventory = planEngine.templateInventory;
  const currentPlanRank = planOrder.indexOf(planEngine.currentPlan);

  return (
    <>
      <PageHeader
        description="Reseller subscription plan capacity for listings, templates, portfolio, visibility, badges, and marketplace tools. SHASTORE earns from reseller subscriptions only."
        title="Reseller Subscription Plans"
      />
      {query.billing === "success" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Checkout completed. Your reseller plan will update after Stripe sends the platform billing webhook.
          </p>
        </Card>
      ) : null}
      {query.billing === "cancelled" ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-700">
            Checkout canceled. Your current reseller plan is unchanged.
          </p>
        </Card>
      ) : null}
      {query.billing === "error" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-800">
            {query.message ?? "Stripe checkout could not be started for this reseller plan."}
          </p>
        </Card>
      ) : null}
      <Card className="p-6 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Current plan</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">{planEngine.currentPlan}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Billing status: {planEngine.billingStatus} · Renewal: {planEngine.renewalDatePlaceholder}
            </p>
            {planEngine.enforcement.upgradeRequiredMessage ? (
              <p className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                {planEngine.enforcement.upgradeRequiredMessage}
              </p>
            ) : (
              <p className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">
                Current usage fits within the {planEngine.currentPlan} reseller subscription limits.
              </p>
            )}
          </div>
          <div className="grid gap-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Listings used / allowed</p>
              <p className="mt-2 text-2xl font-black text-ink">
                {inventory.usedStoreListings}/{inventory.allowedStoreListings}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Templates used / allowed</p>
              <p className="mt-2 text-2xl font-black text-ink">
                {templateInventory.usedTemplates}/{templateInventory.allowedTemplates}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Portfolio used / allowed</p>
              <p className="mt-2 text-2xl font-black text-ink">
                {planEngine.portfolio.usedPortfolioItems}/{planEngine.portfolio.allowedPortfolioItems}
              </p>
            </div>
          </div>
        </div>
      </Card>
      <ResellerInventoryCard inventory={inventory} variant="full" />
      <ResellerTemplateInventoryCard inventory={templateInventory} variant="full" />
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Reseller plan comparison
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {planEngine.planLimits.map((plan) => {
            const rank = planOrder.indexOf(plan.name);
            const direction = rank > currentPlanRank ? "Upgrade preview" : rank < currentPlanRank ? "Downgrade preview" : "Current plan";
            const billingPlanId = billingPlanIdForResellerPlan(plan.name);

            return (
              <div
                className={`rounded-3xl border p-5 ${
                  plan.name === planEngine.currentPlan
                    ? "border-violet-200 bg-violet-50"
                    : "border-slate-200 bg-slate-50"
                }`}
                key={plan.name}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-ink">{plan.name}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{direction}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {plan.monthlyPricePlaceholder}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-muted">
                  <p>Store listings: {plan.allowedStoreListings}</p>
                  <p>Templates: {plan.allowedTemplates}</p>
                  <p>Portfolio items: {plan.allowedPortfolioItems}</p>
                  <p>Public profile: {plan.publicProfileEnabled ? "Enabled" : "Disabled placeholder"}</p>
                  <p>Visibility: {plan.marketplaceVisibilityLevel}</p>
                  <p>Featured requests: {plan.featuredRequestAvailability}</p>
                  <p>Team members: {plan.teamMembersPlaceholder} placeholder</p>
                  <p>Support: {plan.supportLevelPlaceholder}</p>
                </div>
                {plan.name === planEngine.currentPlan ? (
                  <button className="mt-5 h-10 rounded-full bg-slate-200 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500" disabled type="button">
                    Current plan
                  </button>
                ) : billingPlanId && rank > currentPlanRank ? (
                  <form action="/api/reseller/billing/checkout" className="mt-5" method="POST">
                    <input name="plan" type="hidden" value={billingPlanId} />
                    <button className="h-10 rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                      {direction.replace(" preview", "")}
                    </button>
                  </form>
                ) : billingPlanId ? (
                  <button className="mt-5 h-10 rounded-full bg-slate-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400" disabled type="button">
                    Downgrade placeholder
                  </button>
                ) : (
                  <button className="mt-5 h-10 rounded-full bg-slate-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400" disabled type="button">
                    Enterprise placeholder
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Upgrade preview</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">More marketplace capacity</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{planEngine.upgradeCtaPlaceholder}</p>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Downgrade warning</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">Capacity validation required</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">{planEngine.downgradeWarningPlaceholder}</p>
        </Card>
      </div>
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Plan limit enforcement summary</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { active: planEngine.enforcement.overListingLimit, label: "Over listing limit" },
            { active: planEngine.enforcement.overTemplateLimit, label: "Over template limit" },
            { active: planEngine.enforcement.overPortfolioLimit, label: "Over portfolio limit" },
            {
              active: planEngine.enforcement.subscriptionExpiredPlaceholder,
              label: "Subscription expired placeholder"
            }
          ].map((item) => (
            <div className={`rounded-3xl p-4 ${item.active ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`} key={item.label}>
              <p className="text-xs font-black uppercase tracking-[0.16em]">{item.label}</p>
              <p className="mt-2 text-2xl font-black">{item.active ? "Yes" : "No"}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
          Subscription safety
        </p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          This phase does not add wallets, payouts, withdrawals, commissions, fake sales, real orders,
          buyer charges, or ownership transfers. Resellers keep external sales money outside SHASTORE,
          and SHASTORE earns only from reseller subscriptions.
        </p>
      </Card>
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {planEngine.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
