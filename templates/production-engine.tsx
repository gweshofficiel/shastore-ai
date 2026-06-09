import type { ReactNode } from "react";
import {
  FaqSection,
  ProductImage,
  StickyWhatsappButton
} from "@/templates/template-parts";
import { getWhatsappHref } from "@/templates/engine";
import type { PublishedLanding, TemplateId } from "@/types/landing";

type TemplateVariant = {
  id: TemplateId;
  page: string;
  hero: "split" | "editorial" | "device" | "lookbook" | "minimal" | "local";
  eyebrow: string;
  heading: string;
  body: string;
  muted: string;
  surface: string;
  section: string;
  accent: string;
  cta: string;
  font: string;
  showcaseTitle: string;
};

const variants: Record<TemplateId, TemplateVariant> = {
  beauty: {
    id: "beauty",
    page: "bg-[#fff8f8] text-rose-950",
    hero: "split",
    eyebrow: "text-rose-500",
    heading: "font-serif text-rose-950",
    body: "text-rose-950/75",
    muted: "text-rose-900/55",
    surface: "border border-rose-100 bg-white/90 shadow-xl shadow-rose-100/70",
    section: "bg-white/70",
    accent: "bg-rose-100",
    cta: "rounded-full shadow-xl shadow-rose-200/80",
    font: "font-sans",
    showcaseTitle: "Glow-focused product ritual"
  },
  fashion: {
    id: "fashion",
    page: "bg-[#fbfaf7] text-zinc-950",
    hero: "lookbook",
    eyebrow: "text-zinc-500",
    heading: "font-serif text-zinc-950",
    body: "text-zinc-700",
    muted: "text-zinc-500",
    surface: "border border-zinc-200 bg-white shadow-sm",
    section: "bg-zinc-50",
    accent: "bg-zinc-950",
    cta: "rounded-none uppercase tracking-[0.18em]",
    font: "font-sans",
    showcaseTitle: "Styled for the next drop"
  },
  gadget: {
    id: "gadget",
    page: "bg-slate-950 text-white",
    hero: "device",
    eyebrow: "text-cyan-300",
    heading: "font-mono text-white",
    body: "text-slate-300",
    muted: "text-slate-400",
    surface: "border border-white/10 bg-white/5 shadow-2xl shadow-black/30",
    section: "bg-slate-900",
    accent: "bg-cyan-400",
    cta: "rounded-xl shadow-xl shadow-cyan-500/20",
    font: "font-sans",
    showcaseTitle: "Built for specs, proof, and fast action"
  },
  luxury: {
    id: "luxury",
    page: "bg-[#f8f1e7] text-stone-950",
    hero: "editorial",
    eyebrow: "text-amber-800",
    heading: "font-serif text-stone-950",
    body: "text-stone-700",
    muted: "text-stone-500",
    surface: "border border-stone-200 bg-white shadow-xl shadow-stone-200/60",
    section: "bg-white/70",
    accent: "bg-stone-950",
    cta: "rounded-full shadow-xl shadow-stone-300/70",
    font: "font-serif",
    showcaseTitle: "An elevated buying experience"
  },
  minimal: {
    id: "minimal",
    page: "bg-white text-slate-950",
    hero: "minimal",
    eyebrow: "text-slate-400",
    heading: "font-sans text-slate-950",
    body: "text-slate-700",
    muted: "text-slate-500",
    surface: "border border-slate-200 bg-white shadow-sm",
    section: "bg-slate-50",
    accent: "bg-slate-950",
    cta: "rounded-full shadow-lg shadow-slate-300/60",
    font: "font-sans",
    showcaseTitle: "Everything essential, nothing distracting"
  },
  "local-business": {
    id: "local-business",
    page: "bg-[#fffdf8] text-slate-950",
    hero: "local",
    eyebrow: "text-orange-600",
    heading: "font-sans text-slate-950",
    body: "text-slate-700",
    muted: "text-slate-500",
    surface: "border border-orange-100 bg-white shadow-xl shadow-orange-100/60",
    section: "bg-orange-50",
    accent: "bg-orange-500",
    cta: "rounded-2xl shadow-xl shadow-orange-200/70",
    font: "font-sans",
    showcaseTitle: "Made for local trust and quick contact"
  },
  saas: {
    id: "saas",
    page: "bg-white text-slate-950",
    hero: "minimal",
    eyebrow: "text-blue-600",
    heading: "font-sans text-slate-950",
    body: "text-slate-700",
    muted: "text-slate-500",
    surface: "border border-blue-100 bg-white shadow-sm",
    section: "bg-blue-50",
    accent: "bg-blue-600",
    cta: "rounded-full shadow-lg shadow-blue-200/70",
    font: "font-sans",
    showcaseTitle: "Clear value for digital offers"
  }
};

function getVariant(templateId: TemplateId) {
  return variants[templateId] ?? variants.minimal;
}

function getAccentColor(landing: PublishedLanding) {
  return landing.themeSettings?.primaryColor || landing.brandColor;
}

function CtaButton({
  landing,
  variant,
  className = ""
}: {
  landing: PublishedLanding;
  variant: TemplateVariant;
  className?: string;
}) {
  return (
    <a
      className={`inline-flex min-h-12 items-center justify-center px-6 text-sm font-black text-white transition hover:-translate-y-0.5 ${variant.cta} ${className}`}
      href={getWhatsappHref(landing.whatsappNumber)}
      style={{ backgroundColor: getAccentColor(landing) }}
    >
      {landing.copy.ctaText}
    </a>
  );
}

function PriceBlock({
  landing,
  variant,
  align = "left"
}: {
  landing: PublishedLanding;
  variant: TemplateVariant;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className={`text-3xl font-black ${variant.heading}`}>
        {landing.productPrice}
      </p>
      {landing.comparePrice ? (
        <p className={`text-sm font-bold line-through ${variant.muted}`}>
          {landing.comparePrice}
        </p>
      ) : null}
    </div>
  );
}

function TemplateResponsiveShell({
  children,
  landing,
  variant
}: {
  children: ReactNode;
  landing: PublishedLanding;
  variant: TemplateVariant;
}) {
  return (
    <main
      className={`min-h-screen pb-24 ${variant.font} ${variant.page}`}
      style={{ backgroundColor: landing.themeSettings?.secondaryColor || undefined }}
    >
      {children}
      {landing.paymentMethods?.includes("whatsapp") ? (
        <StickyWhatsappButton landing={landing} />
      ) : null}
    </main>
  );
}

function HeroSection({
  landing,
  variant
}: {
  landing: PublishedLanding;
  variant: TemplateVariant;
}) {
  if (variant.hero === "editorial") {
    return (
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
        <div className={`order-2 rounded-[2.5rem] p-4 lg:order-1 ${variant.surface}`}>
          <ProductImage className="min-h-[520px]" landing={landing} />
        </div>
        <div className="order-1 flex flex-col justify-center lg:order-2">
          <p className={`text-sm font-black uppercase tracking-[0.28em] ${variant.eyebrow}`}>
            Limited premium offer
          </p>
          <h1 className={`mt-5 text-5xl font-black tracking-tight sm:text-7xl ${variant.heading}`}>
            {landing.copy.headline}
          </h1>
          <p className={`mt-6 text-lg leading-8 ${variant.body}`}>
            {landing.copy.subheadline}
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CtaButton landing={landing} variant={variant} />
            <PriceBlock landing={landing} variant={variant} />
          </div>
        </div>
      </section>
    );
  }

  if (variant.hero === "device") {
    return (
      <section className="relative overflow-hidden px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute inset-x-0 top-0 h-64 bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col justify-center">
            <p className={`text-xs font-black uppercase tracking-[0.3em] ${variant.eyebrow}`}>
              Performance product
            </p>
            <h1 className={`mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl ${variant.heading}`}>
              {landing.copy.headline}
            </h1>
            <p className={`mt-5 max-w-2xl text-lg leading-8 ${variant.body}`}>
              {landing.copy.subheadline}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {landing.copy.benefits.slice(0, 3).map((benefit) => (
                <div className={`rounded-2xl p-4 ${variant.surface}`} key={benefit}>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-300">
                    Spec
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">{benefit}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <CtaButton landing={landing} variant={variant} />
              <PriceBlock landing={landing} variant={variant} />
            </div>
          </div>
          <div className={`rounded-[2.5rem] p-4 ${variant.surface}`}>
            <ProductImage className="min-h-[500px]" landing={landing} />
          </div>
        </div>
      </section>
    );
  }

  if (variant.hero === "lookbook") {
    return (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8 lg:py-20">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.32em] ${variant.eyebrow}`}>
              New collection
            </p>
            <h1 className={`mt-5 text-5xl font-black leading-none tracking-tight sm:text-7xl ${variant.heading}`}>
              {landing.copy.headline}
            </h1>
          </div>
          <div>
            <p className={`max-w-md text-base leading-7 ${variant.body}`}>
              {landing.copy.subheadline}
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <CtaButton landing={landing} variant={variant} />
              <PriceBlock landing={landing} variant={variant} />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
          <ProductImage className="min-h-[560px] rounded-none" landing={landing} />
          <div className="grid gap-4">
            {(landing.galleryImages?.slice(0, 2) ?? []).map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={landing.productName}
                className="h-full min-h-64 w-full object-cover"
                decoding="async"
                key={image}
                loading="lazy"
                src={image}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant.hero === "local") {
    return (
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-16">
        <div className={`rounded-[2rem] p-6 sm:p-8 ${variant.surface}`}>
          <p className={`text-sm font-black uppercase tracking-[0.24em] ${variant.eyebrow}`}>
            Trusted local offer
          </p>
          <h1 className={`mt-4 text-4xl font-black tracking-tight sm:text-6xl ${variant.heading}`}>
            {landing.copy.headline}
          </h1>
          <p className={`mt-5 text-lg leading-8 ${variant.body}`}>
            {landing.copy.subheadline}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {landing.copy.benefits.slice(0, 4).map((benefit) => (
              <div className="rounded-2xl bg-orange-50 p-4" key={benefit}>
                <p className="text-sm font-black text-slate-950">{benefit}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CtaButton landing={landing} variant={variant} />
            <PriceBlock landing={landing} variant={variant} />
          </div>
        </div>
        <ProductImage className="min-h-[520px]" landing={landing} />
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
      <div className="flex flex-col justify-center">
        <p className={`text-sm font-black uppercase tracking-[0.25em] ${variant.eyebrow}`}>
          {landing.copy.productTitle || landing.productName}
        </p>
        <h1 className={`mt-4 text-5xl font-black tracking-tight sm:text-6xl ${variant.heading}`}>
          {landing.copy.headline}
        </h1>
        <p className={`mt-5 text-lg leading-8 ${variant.body}`}>
          {landing.copy.subheadline}
        </p>
        <p className={`mt-5 text-base leading-7 ${variant.muted}`}>
          {landing.copy.description || landing.productDescription}
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <CtaButton landing={landing} variant={variant} />
          <PriceBlock landing={landing} variant={variant} />
        </div>
      </div>
      <div className={`rounded-[2.5rem] p-4 ${variant.surface}`}>
        <ProductImage landing={landing} />
      </div>
    </section>
  );
}

function SectionRenderer({
  landing,
  type,
  variant
}: {
  landing: PublishedLanding;
  type: "showcase" | "features" | "testimonials" | "faq" | "final-cta";
  variant: TemplateVariant;
}) {
  if (type === "showcase") {
    return (
      <section className={`px-4 py-14 sm:px-6 lg:px-8 ${variant.section}`}>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${variant.eyebrow}`}>
              Product showcase
            </p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight ${variant.heading}`}>
              {variant.showcaseTitle}
            </h2>
            <p className={`mt-3 text-sm leading-6 ${variant.muted}`}>
              {landing.copy.description || landing.productDescription}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {landing.copy.sections.slice(0, 4).map((section) => (
              <div className={`rounded-[2rem] p-6 ${variant.surface}`} key={section.title}>
                <p className={`text-xs font-black uppercase tracking-[0.2em] ${variant.eyebrow}`}>
                  {section.eyebrow}
                </p>
                <h3 className={`mt-3 text-xl font-black ${variant.heading}`}>
                  {section.title}
                </h3>
                <p className={`mt-3 text-sm leading-6 ${variant.muted}`}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "features") {
    return (
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {landing.copy.features.map((feature, index) => (
            <div className={`rounded-[2rem] p-6 ${variant.surface}`} key={feature.title}>
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white"
                style={{ backgroundColor: index === 0 ? getAccentColor(landing) : undefined }}
              >
                {index + 1}
              </div>
              <h2 className={`text-lg font-black ${variant.heading}`}>
                {feature.title}
              </h2>
              <p className={`mt-3 text-sm leading-6 ${variant.muted}`}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (type === "testimonials") {
    return (
      <section className={`px-4 py-16 sm:px-6 lg:px-8 ${variant.section}`}>
        <div className="mx-auto max-w-7xl">
          <h2 className={`text-3xl font-black tracking-tight ${variant.heading}`}>
            Customer proof
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {landing.copy.testimonials.map((testimonial) => (
              <figure className={`rounded-[2rem] p-6 ${variant.surface}`} key={testimonial.quote}>
                <blockquote className={`text-lg font-black leading-8 ${variant.heading}`}>
                  &quot;{testimonial.quote}&quot;
                </blockquote>
                <figcaption className={`mt-4 text-sm font-bold ${variant.muted}`}>
                  {testimonial.author}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === "faq") {
    return <FaqSection landing={landing} />;
  }

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className={`mx-auto max-w-5xl rounded-[2rem] p-8 text-center ${variant.surface}`}>
        <h2 className={`text-3xl font-black tracking-tight ${variant.heading}`}>
          {landing.copy.ctaBlock.title}
        </h2>
        <p className={`mx-auto mt-3 max-w-2xl text-sm leading-6 ${variant.muted}`}>
          {landing.copy.ctaBlock.body}
        </p>
        <CtaButton className="mt-6" landing={landing} variant={variant} />
      </div>
    </section>
  );
}

export function ProductionLandingTemplate({
  landing,
  templateId
}: {
  landing: PublishedLanding;
  templateId: TemplateId;
}) {
  const variant = getVariant(templateId);

  return (
    <TemplateResponsiveShell landing={landing} variant={variant}>
      <HeroSection landing={landing} variant={variant} />
      <SectionRenderer landing={landing} type="showcase" variant={variant} />
      <SectionRenderer landing={landing} type="features" variant={variant} />
      <SectionRenderer landing={landing} type="testimonials" variant={variant} />
      <SectionRenderer landing={landing} type="faq" variant={variant} />
      <SectionRenderer landing={landing} type="final-cta" variant={variant} />
    </TemplateResponsiveShell>
  );
}
