import { MarketingNavbar } from "@/components/marketing/navbar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { billingPlans } from "@/lib/billing/plans";

const plans = billingPlans.filter((plan) => ["free", "pro", "agency"].includes(plan.id));

export default function PricingPage() {
  return (
    <>
      <MarketingNavbar />
      <main className="bg-canvas py-20">
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
              Pricing
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-6xl">
              Simple plans for simple launches.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
              Start lean, launch a store, and upgrade when you need more stores,
              custom domains, and full branding.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card className="p-8" key={plan.id}>
                <h2 className="text-2xl font-black text-ink">{plan.name}</h2>
                <p className="mt-3 text-muted">{plan.description}</p>
                <div className="mt-8 flex items-end gap-1">
                  <span className="text-5xl font-black tracking-tight">
                    {plan.price}
                  </span>
                  <span className="pb-2 text-muted">/mo</span>
                </div>
                <ul className="mt-8 grid gap-3 text-sm text-muted">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <ButtonLink className="mt-8 w-full" href="/register">
                  Start with {plan.name}
                </ButtonLink>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
