import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-slate-100 to-white" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
        <div className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-muted shadow-sm">
            <Sparkles className="h-4 w-4 text-ink" />
            AI copy. Production templates. Instant pages.
          </div>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Launch premium product landing pages in minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            SHASTORE AI turns product images and details into polished ecommerce
            landing pages using reusable templates and focused AI-generated copy.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register">Create your first page</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              View pricing
            </ButtonLink>
          </div>
        </div>
        <div className="rounded-[2rem] border border-line bg-canvas p-3 shadow-soft">
          <div className="rounded-[1.5rem] border border-line bg-white p-5">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6">
              <div className="ml-auto h-10 w-28 rounded-full bg-ink" />
              <div className="mt-24 max-w-sm rounded-2xl bg-white/90 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                  Template Preview
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">
                  Sell the product, not the setup.
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Upload, generate copy, choose a template, publish, and share
                  a checkout-ready WhatsApp landing page.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Images", "AI Copy", "Publish"].map((item) => (
                <div
                  className="rounded-2xl border border-line bg-white p-4 text-sm font-semibold"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
