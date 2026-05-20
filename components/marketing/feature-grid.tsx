import { Card } from "@/components/ui/card";

const features = [
  "Upload product images and details",
  "Generate focused marketing copy",
  "Pick a reusable landing template",
  "Publish instantly with a clean slug",
  "Send buyers to WhatsApp CTA",
  "Manage pages from a simple dashboard"
];

export function FeatureGrid() {
  return (
    <section className="bg-canvas py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
            Built for fast sellers
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Everything needed to publish without a complicated production stack.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card className="min-h-32" key={feature}>
              <div className="mb-5 h-10 w-10 rounded-2xl bg-slate-100" />
              <h3 className="text-lg font-bold text-ink">{feature}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Simple, maintainable workflows designed for template-based
                ecommerce landing pages.
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
