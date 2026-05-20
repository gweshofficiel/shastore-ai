import type { ReactNode } from "react";
import { CommerceCheckoutLayer } from "@/components/commerce/checkout-layer";
import { BeautyTemplate } from "@/templates/beauty";
import { FashionTemplate } from "@/templates/fashion";
import { GadgetTemplate } from "@/templates/gadget";
import { LocalBusinessTemplate } from "@/templates/local-business";
import { LuxuryTemplate } from "@/templates/luxury";
import { MinimalProductTemplate } from "@/templates/minimal-product";
import { SaaSTemplate } from "@/templates/saas";
import type { CheckoutSource } from "@/lib/commerce/checkout";
import type { PublishedLanding } from "@/types/landing";

export function LandingTemplateRenderer({
  landing
}: {
  landing: PublishedLanding;
}) {
  const checkoutSource: CheckoutSource = {
    sourceType: "landing",
    sourceId: landing.id,
    sourceSlug: landing.slug,
    title: landing.productName,
    currency: "USD",
    whatsappNumber: landing.whatsappNumber,
    paymentMethods: landing.paymentMethods?.length
      ? landing.paymentMethods
      : ["whatsapp"],
    items: [
      {
        id: landing.id,
        name: landing.productName,
        price: landing.productPrice,
        imageUrl: landing.heroImage
      }
    ]
  };
  const theme = landing.themeSettings;
  let template: ReactNode;

  switch (landing.templateId) {
    case "minimal":
      template = <MinimalProductTemplate landing={landing} />;
      break;
    case "luxury":
      template = <LuxuryTemplate landing={landing} />;
      break;
    case "beauty":
      template = <BeautyTemplate landing={landing} />;
      break;
    case "gadget":
      template = <GadgetTemplate landing={landing} />;
      break;
    case "fashion":
      template = <FashionTemplate landing={landing} />;
      break;
    case "saas":
      template = <SaaSTemplate landing={landing} />;
      break;
    case "local-business":
      template = <LocalBusinessTemplate landing={landing} />;
      break;
    default:
      template = <MinimalProductTemplate landing={landing} />;
  }

  return (
    <CommerceCheckoutLayer source={checkoutSource}>
      <div style={{ backgroundColor: theme?.secondaryColor || undefined }}>
        {theme?.announcementText ? (
          <div
            className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-white"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {theme.announcementText}
          </div>
        ) : null}
        {theme?.logoUrl ? (
          <div className="absolute left-4 top-14 z-40 sm:left-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${landing.productName} logo`}
              className="h-12 w-12 rounded-full border border-white/60 bg-white object-cover shadow-lg"
              src={theme.logoUrl}
            />
          </div>
        ) : null}
        {template}
        <footer className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
          {theme?.footerText || "Powered by SHASTORE AI"}
        </footer>
      </div>
    </CommerceCheckoutLayer>
  );
}
