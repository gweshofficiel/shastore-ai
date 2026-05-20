import { getWhatsappHref } from "@/templates/engine";
import type { PublishedLanding } from "@/types/landing";

export function ProductImage({
  landing,
  className
}: {
  landing: PublishedLanding;
  className?: string;
}) {
  if (!landing.heroImage) {
    return (
      <div
        className={`flex min-h-80 items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500 ${className ?? ""}`}
      >
        Product image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={landing.productName}
      className={`h-full min-h-80 w-full rounded-[2rem] object-cover ${className ?? ""}`}
      decoding="async"
      loading="eager"
      src={landing.heroImage}
    />
  );
}

export function StickyWhatsappButton({ landing }: { landing: PublishedLanding }) {
  return (
    <a
      className="fixed bottom-4 left-4 right-4 z-50 inline-flex h-14 items-center justify-center rounded-full px-6 text-sm font-black text-white shadow-2xl sm:left-auto sm:right-6 sm:w-auto"
      href={getWhatsappHref(landing.whatsappNumber)}
      rel="noreferrer"
      style={{ backgroundColor: landing.brandColor }}
      target="_blank"
    >
      {landing.copy.ctaText}
    </a>
  );
}

export function FaqSection({ landing }: { landing: PublishedLanding }) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-black tracking-tight text-slate-950">
          Frequently asked questions
        </h2>
        <div className="mt-8 grid gap-3">
          {landing.copy.faq.map((item) => (
            <details
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              key={item.question}
            >
              <summary className="cursor-pointer list-none text-base font-bold text-slate-950">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
