import { MarketingNavbar } from "@/components/marketing/navbar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const plans = [
  {
    name: "Starter",
    price: "$19",
    description: "For testing products and launching fast."
  },
  {
    name: "Growth",
    price: "$49",
    description: "For sellers publishing multiple landing pages."
  }
];

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
              Start lean, publish premium product pages, and upgrade when you
              need more templates and landing pages.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <Card className="p-8" key={plan.name}>
                <h2 className="text-2xl font-black text-ink">{plan.name}</h2>
                <p className="mt-3 text-muted">{plan.description}</p>
                <div className="mt-8 flex items-end gap-1">
                  <span className="text-5xl font-black tracking-tight">
                    {plan.price}
                  </span>
                  <span className="pb-2 text-muted">/mo</span>
                </div>
                <ul className="mt-8 grid gap-3 text-sm text-muted">
                  <li>AI marketing copy generation</li>
                  <li>Reusable landing page templates</li>
                  <li>WhatsApp CTA support</li>
                  <li>Stripe billing ready</li>
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
