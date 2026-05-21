import type { ReactElement } from "react";
import { CommerceCheckoutLayer } from "@/components/commerce/checkout-layer";
import type { CheckoutSource } from "@/lib/commerce/checkout";
import { fontClass, fontScaleClass } from "@/lib/store-theme";
import { defaultStoreTemplateId } from "@/lib/store-templates";
import type { StorefrontData } from "@/types/storefront";

type StoreTemplateComponent = (props: { store: StorefrontData }) => ReactElement;

const legacyTemplateMap: Record<string, string> = {
  "minimal-luxury": "luxury-dark",
  "fashion-modern": "fashion-editorial",
  "electronics-dark": "gadget-neon",
  "arabic-luxury": "arabic-premium",
  "tiktok-product-store": "tiktok-product",
  "clean-scandinavian": "scandinavian-light",
  "premium-brand": "modern-gradient"
};

const templateLoaders: Record<string, () => Promise<StoreTemplateComponent>> = {
  "luxury-dark": () =>
    import("@/components/store/templates/luxury-dark").then(
      (module) => module.LuxuryDarkTemplate
    ),
  "minimal-clean": () =>
    import("@/components/store/templates/minimal-clean").then(
      (module) => module.MinimalCleanTemplate
    ),
  "beauty-glow": () =>
    import("@/components/store/templates/beauty-glow").then(
      (module) => module.BeautyGlowTemplate
    ),
  "arabic-premium": () =>
    import("@/components/store/templates/arabic-premium").then(
      (module) => module.ArabicPremiumTemplate
    ),
  "marketplace-grid": () =>
    import("@/components/store/templates/marketplace-grid").then(
      (module) => module.MarketplaceGridTemplate
    ),
  "gadget-neon": () =>
    import("@/components/store/templates/gadget-neon").then(
      (module) => module.GadgetNeonTemplate
    ),
  "fashion-editorial": () =>
    import("@/components/store/templates/fashion-editorial").then(
      (module) => module.FashionEditorialTemplate
    ),
  "tiktok-product": () =>
    import("@/components/store/templates/tiktok-product").then(
      (module) => module.TikTokProductTemplate
    ),
  "modern-gradient": () =>
    import("@/components/store/templates/modern-gradient").then(
      (module) => module.ModernGradientTemplate
    ),
  "scandinavian-light": () =>
    import("@/components/store/templates/scandinavian-light").then(
      (module) => module.ScandinavianLightTemplate
    )
};

export async function StoreTemplateRenderer({
  store
}: {
  store: StorefrontData;
}) {
  const templateId = legacyTemplateMap[store.templateId] ?? store.templateId;
  const fallbackId = legacyTemplateMap[defaultStoreTemplateId] ?? "luxury-dark";
  const loadTemplate = templateLoaders[templateId] ?? templateLoaders[fallbackId];
  const Template = await loadTemplate();
  const checkoutSource: CheckoutSource = {
    sourceType: "store",
    sourceId: store.id,
    sourceSlug: store.slug,
    title: store.name,
    currency: store.currency || "USD",
    whatsappNumber: store.whatsappNumber,
    paymentMethods: ["whatsapp", "cod"],
    items: store.products.length
      ? store.products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price ?? "0",
          imageUrl: product.imageUrl
        }))
      : [
          {
            id: store.id,
            name: store.name,
            price: "0",
            imageUrl: store.logoImageUrl
          }
        ]
  };

  return (
    <CommerceCheckoutLayer source={checkoutSource}>
      <div className={`${fontClass(store.themeSettings.bodyFont)} ${fontScaleClass(store.themeSettings.fontScale)}`}>
        <Template store={store} />
      </div>
    </CommerceCheckoutLayer>
  );
}
