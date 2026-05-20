import { getWhatsappHref } from "@/templates/engine";
import type {
  AiLandingCopy,
  LandingThemeSettings,
  PaymentMethod,
  TemplateId
} from "@/types/landing";

type LivePreviewProps = {
  productName: string;
  shortDescription: string;
  longDescription: string;
  price: string;
  comparePrice: string;
  ctaText: string;
  whatsappNumber: string;
  brandColor: string;
  templateId: TemplateId;
  copy: AiLandingCopy | null;
  paymentMethods: PaymentMethod[];
  heroPreview?: string | null;
  previewMode?: "desktop" | "mobile";
  themeSettings?: LandingThemeSettings;
};

const templateLabels: Record<TemplateId, string> = {
  minimal: "Minimal",
  luxury: "Luxury",
  beauty: "Beauty",
  gadget: "Gadget",
  fashion: "Fashion",
  saas: "SaaS",
  "local-business": "Local Business"
};

export function LivePreview({
  productName,
  shortDescription,
  longDescription,
  price,
  comparePrice,
  ctaText,
  whatsappNumber,
  brandColor,
  templateId,
  copy,
  paymentMethods,
  heroPreview,
  previewMode = "desktop",
  themeSettings
}: LivePreviewProps) {
  const headline =
    themeSettings?.heroTitle || copy?.headline || productName || "Your premium product";
  const subheadline =
    copy?.subheadline ||
    shortDescription ||
    "A clean, conversion-focused landing page preview updates as you type.";
  const benefits = copy?.benefits?.length
    ? copy.benefits.slice(0, 3)
    : ["Premium design", "Fast ordering", "Mobile-first layout"];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Live preview
          </p>
          <p className="mt-1 text-sm font-bold text-ink">
            {templateLabels[templateId]} · {previewMode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {themeSettings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Logo"
              className="h-7 w-7 rounded-full object-cover"
              src={themeSettings.logoUrl}
            />
          ) : null}
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: themeSettings?.primaryColor || brandColor }}
          />
        </div>
      </div>
      <div className="p-5">
        <div
          className={`mx-auto rounded-[1.75rem] bg-gradient-to-br from-slate-50 to-white p-5 ${
            previewMode === "mobile" ? "max-w-[360px]" : ""
          }`}
          style={{ backgroundColor: themeSettings?.secondaryColor || undefined }}
        >
          {themeSettings?.announcementText ? (
            <div
              className="mb-4 rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-[0.16em] text-white"
              style={{ backgroundColor: themeSettings.primaryColor }}
            >
              {themeSettings.announcementText}
            </div>
          ) : null}
          <div className={`grid gap-5 ${previewMode === "desktop" ? "lg:grid-cols-[1fr_0.8fr]" : ""}`}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {productName || "Product name"}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
                {headline}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">{subheadline}</p>
              {longDescription ? (
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">
                  {longDescription}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  className="inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-black text-white"
                  href={getWhatsappHref(whatsappNumber)}
                  style={{ backgroundColor: themeSettings?.primaryColor || brandColor }}
                >
                  {themeSettings?.ctaText || ctaText || copy?.ctaText || "Order now"}
                </a>
                <div>
                  <p className="text-xl font-black text-ink">
                    {price || "Price"}
                  </p>
                  {comparePrice ? (
                    <p className="text-xs font-bold text-slate-400 line-through">
                      {comparePrice}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {heroPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={productName}
                className="min-h-56 w-full rounded-[1.5rem] object-cover"
                src={heroPreview}
              />
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white text-sm font-semibold text-slate-400">
                Product image
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map((benefit) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-3" key={benefit}>
              <p className="text-sm font-bold text-ink">{benefit}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <span
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
              key={method}
            >
              {method}
            </span>
          ))}
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-slate-400">
          {themeSettings?.footerText || "Powered by SHASTORE AI"}
        </p>
      </div>
    </div>
  );
}
