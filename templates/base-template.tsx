import {
  FaqSection,
  ProductImage,
  StickyWhatsappButton
} from "@/templates/template-parts";
import { getWhatsappHref } from "@/templates/engine";
import type { PublishedLanding } from "@/types/landing";

type TemplateTheme = {
  page: string;
  heroCard: string;
  eyebrow: string;
  heading: string;
  text: string;
  muted: string;
  surface: string;
  section: string;
  accent: string;
};

export const templateThemes = {
  minimal: {
    page: "bg-white text-slate-950",
    heroCard: "bg-slate-50",
    eyebrow: "text-slate-400",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    surface: "bg-white border border-slate-200 shadow-sm",
    section: "bg-slate-50",
    accent: "bg-slate-950"
  },
  luxury: {
    page: "bg-[#f8f5ef] text-stone-950",
    heroCard: "bg-white shadow-2xl shadow-stone-200",
    eyebrow: "text-amber-700",
    heading: "text-stone-950",
    text: "text-stone-700",
    muted: "text-stone-500",
    surface: "bg-white border border-stone-200 shadow-sm",
    section: "bg-white",
    accent: "bg-stone-950"
  },
  beauty: {
    page: "bg-[#fffaf8] text-slate-950",
    heroCard: "bg-white shadow-2xl shadow-rose-100",
    eyebrow: "text-rose-400",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    surface: "bg-white border border-rose-100 shadow-sm",
    section: "bg-white/70",
    accent: "bg-rose-100"
  },
  gadget: {
    page: "bg-slate-950 text-white",
    heroCard: "bg-white/5 border border-white/10 shadow-2xl shadow-black/40",
    eyebrow: "text-slate-400",
    heading: "text-white",
    text: "text-slate-300",
    muted: "text-slate-400",
    surface: "bg-white/5 border border-white/10",
    section: "bg-slate-900",
    accent: "bg-white/10"
  },
  fashion: {
    page: "bg-[#fbfaf7] text-zinc-950",
    heroCard: "bg-white shadow-2xl shadow-zinc-200",
    eyebrow: "text-zinc-500",
    heading: "text-zinc-950",
    text: "text-zinc-700",
    muted: "text-zinc-500",
    surface: "bg-white border border-zinc-200 shadow-sm",
    section: "bg-zinc-50",
    accent: "bg-zinc-950"
  },
  saas: {
    page: "bg-white text-slate-950",
    heroCard: "bg-gradient-to-br from-slate-50 to-blue-50 shadow-2xl shadow-blue-100",
    eyebrow: "text-blue-600",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    surface: "bg-white border border-slate-200 shadow-sm",
    section: "bg-slate-50",
    accent: "bg-blue-600"
  },
  "local-business": {
    page: "bg-[#fffdf8] text-slate-950",
    heroCard: "bg-white shadow-2xl shadow-orange-100",
    eyebrow: "text-orange-600",
    heading: "text-slate-950",
    text: "text-slate-700",
    muted: "text-slate-500",
    surface: "bg-white border border-orange-100 shadow-sm",
    section: "bg-orange-50",
    accent: "bg-orange-500"
  }
} satisfies Record<string, TemplateTheme>;

export function BaseLandingTemplate({
  landing,
  theme
}: {
  landing: PublishedLanding;
  theme: TemplateTheme;
}) {
  return (
    <main
      className={`min-h-screen pb-24 ${theme.page}`}
      style={{ backgroundColor: landing.themeSettings?.secondaryColor || undefined }}
    >
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <p className={`text-sm font-black uppercase tracking-[0.25em] ${theme.eyebrow}`}>
            {landing.copy.productTitle || landing.productName}
          </p>
          <h1 className={`mt-4 text-5xl font-black tracking-tight sm:text-6xl ${theme.heading}`}>
            {landing.copy.headline}
          </h1>
          <p className={`mt-5 text-lg leading-8 ${theme.text}`}>
            {landing.copy.subheadline}
          </p>
          <p className={`mt-5 text-base leading-7 ${theme.muted}`}>
            {landing.copy.description || landing.productDescription}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black text-white shadow-lg"
              href={getWhatsappHref(landing.whatsappNumber)}
              style={{ backgroundColor: landing.brandColor }}
            >
              {landing.copy.ctaText}
            </a>
            <div>
              <span className={`text-2xl font-black ${theme.heading}`}>
                {landing.productPrice}
              </span>
              {landing.comparePrice ? (
                <p className={`text-sm font-bold line-through ${theme.muted}`}>
                  {landing.comparePrice}
                </p>
              ) : null}
            </div>
          </div>
          {landing.paymentMethods?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {landing.paymentMethods.map((method) => (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${theme.surface}`}
                  key={method}
                >
                  {method}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className={`rounded-[2.5rem] p-4 ${theme.heroCard}`}>
          <ProductImage landing={landing} />
        </div>
      </section>

      {landing.galleryImages?.length ? (
        <section className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
            {landing.galleryImages.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={landing.productName}
                className="aspect-square w-full rounded-[1.5rem] object-cover"
                key={image}
                src={image}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={`px-4 py-14 sm:px-6 lg:px-8 ${theme.section}`}>
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          {landing.copy.benefits.map((benefit) => (
            <div className={`rounded-[2rem] p-6 ${theme.surface}`} key={benefit}>
              <div className={`mb-5 h-10 w-10 rounded-full ${theme.accent}`} />
              <p className={`font-black ${theme.heading}`}>{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {landing.copy.features.map((feature) => (
            <div className={`rounded-[2rem] p-6 ${theme.surface}`} key={feature.title}>
              <h2 className={`text-lg font-black ${theme.heading}`}>
                {feature.title}
              </h2>
              <p className={`mt-3 text-sm leading-6 ${theme.muted}`}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={`px-4 py-16 sm:px-6 lg:px-8 ${theme.section}`}>
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className={`text-sm font-black uppercase tracking-[0.22em] ${theme.eyebrow}`}>
              Landing sections
            </p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight ${theme.heading}`}>
              Built to explain, prove, and convert.
            </h2>
          </div>
          <div className="grid gap-4">
            {landing.copy.sections.map((section) => (
              <div className={`rounded-[2rem] p-6 ${theme.surface}`} key={section.title}>
                <p className={`text-xs font-black uppercase tracking-[0.2em] ${theme.eyebrow}`}>
                  {section.eyebrow}
                </p>
                <h3 className={`mt-3 text-2xl font-black ${theme.heading}`}>
                  {section.title}
                </h3>
                <p className={`mt-3 text-sm leading-6 ${theme.muted}`}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {landing.copy.testimonials.map((testimonial) => (
            <div className={`rounded-[2rem] p-6 ${theme.surface}`} key={testimonial.quote}>
              <p className={`text-lg font-black leading-8 ${theme.heading}`}>
                “{testimonial.quote}”
              </p>
              <p className={`mt-4 text-sm font-bold ${theme.muted}`}>
                {testimonial.author}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={`px-4 py-16 sm:px-6 lg:px-8 ${theme.section}`}>
        <div className={`mx-auto max-w-4xl rounded-[2rem] p-8 text-center ${theme.surface}`}>
          <p className={`text-sm font-black uppercase tracking-[0.22em] ${theme.eyebrow}`}>
            {landing.copy.pricing.label}
          </p>
          <p className={`mt-3 text-5xl font-black tracking-tight ${theme.heading}`}>
            {landing.copy.pricing.price || landing.productPrice}
          </p>
          <p className={`mt-3 text-sm leading-6 ${theme.muted}`}>
            {landing.copy.pricing.note}
          </p>
        </div>
      </section>

      <FaqSection landing={landing} />

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-5xl rounded-[2rem] p-8 text-center ${theme.surface}`}>
          <h2 className={`text-3xl font-black tracking-tight ${theme.heading}`}>
            {landing.copy.ctaBlock.title}
          </h2>
          <p className={`mx-auto mt-3 max-w-2xl text-sm leading-6 ${theme.muted}`}>
            {landing.copy.ctaBlock.body}
          </p>
          <a
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black text-white"
            href={getWhatsappHref(landing.whatsappNumber)}
            style={{ backgroundColor: landing.brandColor }}
          >
            {landing.copy.ctaText}
          </a>
        </div>
      </section>

      {landing.paymentMethods?.includes("whatsapp") ? (
        <StickyWhatsappButton landing={landing} />
      ) : null}
    </main>
  );
}
