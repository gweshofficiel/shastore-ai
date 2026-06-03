import type { ReactNode } from "react";
import Link from "next/link";
import { CompareButton } from "@/components/storefront/product-compare";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductQuickView } from "@/components/storefront/product-quick-view";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import { RecentlyViewedProducts } from "@/components/storefront/recently-viewed-products";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { PublicStoreFooter } from "@/components/storefront/public-store-footer";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
import { StorefrontCurrencySwitcher } from "@/components/storefront/currency-switcher";
import { StorefrontLanguageSwitcher } from "@/components/storefront/language-switcher";
import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPublicProductSections,
  isPublicCategoryTitle
} from "@/lib/storefront/catalog-sections";
import {
  getVisualBuilderPayload,
  loadVisualEditorState,
  resolveBuilderSections
} from "@/lib/storefront/builder";
import { resolveStorefrontRuntimeSections } from "@/lib/storefront/runtime";
import { resolveStorefrontTemplateConfig } from "@/lib/storefront/theme-registry";
import type { PublicStoreFaq } from "@/lib/store-faq-public";
import type { PublicStoreAboutPage } from "@/lib/store-about-public";
import type { PublicStoreBlogArticle } from "@/lib/store-blog-public";
import type {
  StoreHomepageLayoutConfig,
  StoreHomepageSection,
  StoreHomepageSectionType
} from "@/lib/store-homepage-sections";
import type { StorefrontResolvedNavigation } from "@/lib/storefront/navigation";
import {
  defaultStoreFooterLinkSettings,
  type StoreFooterLinkSettings
} from "@/lib/store-footer-links";

export type StoreSectionType =
  | "hero"
  | "navbar"
  | "banner"
  | "about_preview"
  | "blog_preview"
  | "product_grid"
  | "featured_products"
  | "new_arrivals"
  | "best_sellers"
  | "flash_deals"
  | "recommended_products"
  | "recently_viewed"
  | "featured_categories"
  | "featured_collection"
  | "brands"
  | "trust_badges"
  | "categories"
  | "rich_text"
  | "image"
  | "CTA"
  | "cta"
  | "testimonials"
  | "FAQ"
  | "faq"
  | "faq_preview"
  | "footer"
  | "footer_cta"
  | "newsletter"
  | "spacer"
  | (string & {});

export type StoreSection = {
  id: string;
  store_instance_id: string;
  owner_user_id: string | null;
  section_type: StoreSectionType;
  section_order: number;
  section_enabled: boolean;
  config: Record<string, unknown>;
};

export type StorePageLayout = {
  builderPreview: Record<string, unknown>;
  key: string;
  sections: StoreSection[];
};

const supportedSectionTypes: StoreSectionType[] = [
  "hero",
  "navbar",
  "banner",
  "about_preview",
  "blog_preview",
  "product_grid",
  "featured_products",
  "new_arrivals",
  "best_sellers",
  "flash_deals",
  "recommended_products",
  "recently_viewed",
  "featured_categories",
  "featured_collection",
  "brands",
  "trust_badges",
  "categories",
  "rich_text",
  "image",
  "CTA",
  "cta",
  "testimonials",
  "FAQ",
  "faq",
  "faq_preview",
  "footer",
  "footer_cta",
  "newsletter",
  "spacer"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function templateConfig(context: StoreTenantContext) {
  const base = resolveStorefrontTemplateConfig({
    fontStyle: context.preview.fontStyle,
    layoutStyle: context.preview.layoutStyle,
    templateId: context.preview.templateId,
    themeColor: context.preview.themeColor,
    themeSettings: context.preview.themeSettings
  });
  const style = context.theme.styleConfig;
  const headerStyle = textValue(style.headerStyle, base.layout.navbar);
  const productCardStyle = textValue(style.productCardStyle, base.layout.productCard);

  return {
    ...base,
    colorPalette: {
      ...base.colorPalette,
      ...context.theme.colorPalette
    },
    layout: {
      ...base.layout,
      navbar:
        headerStyle === "boutique" ||
        headerStyle === "utility" ||
        headerStyle === "soft" ||
        headerStyle === "classic"
          ? headerStyle
          : base.layout.navbar,
      productCard:
        productCardStyle === "lookbook" ||
        productCardStyle === "spec-card" ||
        productCardStyle === "glow-card" ||
        productCardStyle === "classic"
          ? productCardStyle
          : base.layout.productCard
    },
    typography: context.theme.typography
  };
}

function sectionPaddingClass(context: StoreTenantContext) {
  const config = templateConfig(context);

  if (config.layout.spacing === "compact") {
    return "px-4 py-7 sm:px-6 lg:px-8";
  }

  if (config.layout.spacing === "spacious") {
    return "px-4 py-14 sm:px-6 lg:px-8 lg:py-20";
  }

  return "px-4 py-10 sm:px-6 lg:px-8";
}

function cardRadiusClass(context: StoreTenantContext) {
  const config = templateConfig(context);
  const cardRadius = textValue(context.theme.styleConfig.cardRadius, "");

  if (cardRadius === "sharp") {
    return "rounded-xl";
  }

  if (cardRadius === "rounded") {
    return "rounded-[1.5rem]";
  }

  if (config.layout.productCard === "spec-card") {
    return "rounded-2xl";
  }

  if (config.layout.productCard === "lookbook") {
    return "rounded-[2.5rem]";
  }

  return "rounded-[var(--store-border-radius)]";
}

function headingStyle() {
  return { fontFamily: "var(--store-font-heading)" };
}

function formatProductPrice(price: number | string | null, priceLabel: string | null, currency: string) {
  if (priceLabel) {
    return priceLabel;
  }

  if (price === null || price === undefined || price === "") {
    return "Price coming soon";
  }

  const numericPrice = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numericPrice)) {
    return String(price);
  }

  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(numericPrice);
}

function productGalleryUrls(gallery: unknown[]) {
  return gallery
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return item;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return textValue(record.url) || textValue(record.publicUrl) || textValue(record.imageUrl);
      }

      return "";
    })
    .filter(Boolean);
}

function productPrimaryImage(product: StoreTenantContext["preview"]["products"][number]) {
  return product.imageUrl || productGalleryUrls(product.gallery)[0] || null;
}

function isPublicProductStatus(status: string | null) {
  return status === "active";
}

function publicProductHref(
  storeSlug: string,
  product: StoreTenantContext["preview"]["products"][number]
) {
  return `/store/${storeSlug}/product/${encodeURIComponent(product.slug || product.id)}`;
}

function PremiumVisualPlaceholder({
  eyebrow,
  title
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex min-h-44 items-end overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/10 p-5 shadow-inner backdrop-blur">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">{eyebrow}</p>
        <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{title}</p>
      </div>
    </div>
  );
}

function PremiumSkeletonGrid({
  count = 4,
  label
}: {
  count?: number;
  label: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm" key={`${label}-${index}`}>
          <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
            <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {label}
            </span>
          </div>
          <div className="grid gap-3 p-4">
            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

const flagshipCategoryPlaceholders = [
  "Electronics",
  "Fashion",
  "Beauty",
  "Home & Living",
  "Sports",
  "Books",
  "Toys",
  "Automotive"
];

const flagshipMainNavLinks = [
  { href: "", label: "Home" },
  { href: "#categories", label: "Shop" },
  { href: "#products", label: "Products" },
  { href: "#pages", label: "Pages" },
  { href: "blog", label: "Blog" },
  { href: "about", label: "About Us" },
  { href: "contact", label: "Contact Us" },
  { href: "#deals", label: "Deals" },
  { href: "#top-selling", label: "Top Selling" }
];

function isFlagshipTemplate(context: StoreTenantContext) {
  return templateConfig(context).key === "shastore-flagship-premium";
}

function FlagshipProductPlaceholderCard({ index }: { index: number }) {
  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative flex aspect-[4/3] items-end bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
        <button
          aria-label="Wishlist placeholder"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-slate-500 shadow-sm"
          type="button"
        >
          ♡
        </button>
        <span className="rounded-full bg-white/85 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Image placeholder
        </span>
      </div>
      <div className="grid gap-3 p-4">
        <div>
          <h3 className="text-lg font-black tracking-[-0.03em] text-ink">Premium Product {index + 1}</h3>
          <p className="mt-1 text-sm font-black text-amber-500">★★★★★</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-lg font-black text-ink">$0.00</p>
          <button
            aria-label="Cart placeholder"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white"
            type="button"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function FlagshipProductPlaceholderGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <FlagshipProductPlaceholderCard index={index} key={index} />
      ))}
    </div>
  );
}

function FlagshipSectionHeader({
  eyebrow,
  subtitle,
  title
}: {
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {title}
        </h2>
      </div>
      {subtitle ? <p className="max-w-xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
    </div>
  );
}

function FlagshipFlashDealsPlaceholder() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" id="deals">
      <FlagshipProductPlaceholderGrid count={6} />
      <aside className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_-60px_rgba(15,23,42,0.95)]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Flash deals</p>
        <h3 className="mt-3 text-3xl font-black tracking-[-0.05em]" style={headingStyle()}>
          Premium deal placeholder
        </h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/70">
          Countdown placeholder for limited-time offers.
        </p>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {["DD", "HH", "MM", "SS"].map((label) => (
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center" key={label}>
              <p className="text-2xl font-black">00</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/50">{label}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FlagshipNewArrivalsPlaceholder() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {["New season edit", "Premium essentials", "Trending now"].map((title) => (
        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm" key={title}>
          <div className="flex min-h-48 items-end bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5">
            <span className="rounded-full bg-white/85 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Promo image placeholder
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">Promotional card placeholder</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function normalizeSection(value: unknown, context: StoreTenantContext): StoreSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const sectionType = textValue(value.section_type) as StoreSectionType;

  if (!supportedSectionTypes.includes(sectionType)) {
    return null;
  }

  return {
    config: isRecord(value.config) ? value.config : {},
    id: textValue(value.id),
    owner_user_id: typeof value.owner_user_id === "string" ? value.owner_user_id : null,
    section_enabled:
      typeof value.section_enabled === "boolean" ? value.section_enabled : true,
    section_order: numberValue(value.section_order),
    section_type: sectionType,
    store_instance_id: context.store_instance_id
  };
}

export async function loadStoreSections(context: StoreTenantContext): Promise<StoreSection[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from("store_sections" as never)
    .select("*")
    .eq("store_instance_id", context.store_instance_id)
    .eq("section_enabled", true)
    .order("section_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((section) => normalizeSection(section, context))
    .filter((section): section is StoreSection => Boolean(section));
}

function hasProductSection(sections: StoreSection[]) {
  return sections.some((section) =>
    ["featured_products", "product_grid"].includes(section.section_type.toLowerCase())
  );
}

function withLiveProductSection(context: StoreTenantContext, sections: StoreSection[]) {
  if (hasProductSection(sections)) {
    return sections;
  }

  const maxOrder = sections.reduce(
    (current, section) => Math.max(current, section.section_order),
    0
  );

  return [
    ...sections,
    {
      config: {},
      id: "runtime-live-featured-products",
      owner_user_id: context.owner_user_id,
      section_enabled: true,
      section_order: maxOrder + 10,
      section_type: "featured_products",
      store_instance_id: context.store_instance_id
    }
  ].sort((left, right) => left.section_order - right.section_order);
}

function homepageSectionRendererType(sectionType: StoreHomepageSectionType): StoreSectionType {
  const sectionTypes: Record<StoreHomepageSectionType, StoreSectionType> = {
    about_preview: "about_preview",
    best_sellers: "best_sellers",
    blog_preview: "blog_preview",
    brands: "brands",
    faq_preview: "faq_preview",
    featured_categories: "featured_categories",
    featured_collection: "featured_collection",
    featured_products: "featured_products",
    flash_deals: "flash_deals",
    footer_cta: "footer_cta",
    hero: "hero",
    new_arrivals: "new_arrivals",
    newsletter: "newsletter",
    recommended_products: "recommended_products",
    recently_viewed: "recently_viewed",
    trust_badges: "trust_badges",
    testimonials: "testimonials"
  };

  return sectionTypes[sectionType];
}

function resolveHomepageManagedSections(
  context: StoreTenantContext,
  homepageSections: StoreHomepageSection[]
): StoreSection[] {
  const navbar: StoreSection = {
    config: {},
    id: "homepage-runtime-navbar",
    owner_user_id: context.owner_user_id,
    section_enabled: true,
    section_order: -100,
    section_type: "navbar",
    store_instance_id: context.store_instance_id
  };
  const sections = homepageSections
    .filter((section) => section.enabled === true)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map<StoreSection>((section) => ({
      config: {
        ...section.settings,
        body: section.subtitle ?? undefined,
        subtitle: section.subtitle ?? undefined,
        title: section.title ?? undefined
      },
      id: `homepage-${section.sectionType}`,
      owner_user_id: context.owner_user_id,
      section_enabled: true,
      section_order: section.sortOrder,
      section_type: homepageSectionRendererType(section.sectionType),
      store_instance_id: context.store_instance_id
    }));

  return [navbar, ...sections];
}

export async function resolveSectionLayout(context: StoreTenantContext): Promise<StorePageLayout> {
  const builderState = await loadVisualEditorState(context);
  const builderSections = resolveBuilderSections(builderState, context);
  const builderPreview = getVisualBuilderPayload(builderState);

  if (builderSections.length) {
    return {
      builderPreview,
      key: `${context.theme.layout_key}:builder`,
      sections: withLiveProductSection(context, builderSections)
    };
  }

  const sections = await loadStoreSections(context);

  if (sections.length) {
    return {
      builderPreview,
      key: `${context.theme.layout_key}:saved`,
      sections: withLiveProductSection(context, sections)
    };
  }

  return {
    builderPreview,
    key: `${context.theme.layout_key}:runtime`,
    sections: await resolveStorefrontRuntimeSections(context)
  };
}

export function resolveSectionRenderer(section: StoreSection) {
  return section.section_type;
}

function SectionShell({
  children,
  muted = false
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={`px-4 py-10 sm:px-6 lg:px-8 ${muted ? "bg-slate-50" : "bg-white"}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

function numericProductPrice(price: number | string | null) {
  const numericPrice = typeof price === "number" ? price : Number(price ?? NaN);
  return Number.isFinite(numericPrice) ? numericPrice : null;
}

function productSectionProducts(context: StoreTenantContext, section?: StoreSection) {
  const products = context.preview.products.filter((product) => isPublicProductStatus(product.status));
  const type = section?.section_type ?? "featured_products";

  if (type === "new_arrivals") {
    return [...products]
      .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
      .slice(0, 8);
  }

  if (type === "best_sellers") {
    return [...products]
      .sort((left, right) => right.salesCount - left.salesCount)
      .slice(0, 8);
  }

  if (type === "flash_deals") {
    return products
      .filter((product) => {
        const compareAt = numericProductPrice(product.compareAtPrice);
        const price = numericProductPrice(product.price);
        return compareAt !== null && price !== null && compareAt > price;
      })
      .slice(0, 8);
  }

  if (type === "recommended_products") {
    return [...products]
      .sort((left, right) => (right.salesCount * 2 + (right.recentlyPurchasedAt ? 1 : 0)) - (left.salesCount * 2 + (left.recentlyPurchasedAt ? 1 : 0)))
      .slice(0, 8);
  }

  return products.slice(0, 6);
}

function ProductGridSection({ context, section }: { context: StoreTenantContext; section?: StoreSection }) {
  const config = templateConfig(context);
  const products = productSectionProducts(context, section).slice(0, config.key === "electronics-starter" ? 8 : 6);
  const title = textValue(section?.config.title, config.sections.productsTitle);
  const subtitle = textValue(section?.config.subtitle, config.sections.productsDescription);
  const eyebrow = section?.section_type === "new_arrivals"
    ? "New arrivals"
    : section?.section_type === "best_sellers"
      ? "Best sellers"
      : section?.section_type === "flash_deals"
        ? "Flash deals"
        : section?.section_type === "recommended_products"
          ? "Recommended"
          : config.label;
  const productSections = buildPublicProductSections({
    categories: context.preview.categories,
    products
  });

  return (
    <section
      className={`${sectionPaddingClass(context)} ${config.key === "electronics-starter" ? "bg-slate-950" : "bg-[var(--store-background)]"}`}
      id={section?.section_type === "flash_deals" ? "deals" : section?.section_type === "best_sellers" ? "top-selling" : "products"}
    >
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-black uppercase tracking-[0.22em]"
            style={{ color: context.theme.colorPalette.accent }}
          >
            {eyebrow}
          </p>
          <h2
            className={`mt-2 font-black tracking-[-0.04em] ${config.key === "electronics-starter" ? "text-white" : "text-ink"} ${config.typography.scale === "large" ? "text-4xl" : "text-3xl"}`}
            style={headingStyle()}
          >
            {title}
          </h2>
        </div>
        <p
          className={`max-w-xl text-sm font-semibold leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}
        >
          {subtitle}
        </p>
      </div>
      {products.length ? (
        <div className="grid gap-8">
          {productSections.map((section) => (
            <div className="grid gap-5" key={section.category.id}>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Category
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                  {section.category.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {section.category.description || "Browse products in this category."}
                </p>
              </div>
              <div
                className={`grid gap-5 ${
                  config.layout.mobileDensity === "dense"
                    ? "grid-cols-2 lg:grid-cols-4"
                    : "sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {section.products.map((product) => {
            const galleryImages = productGalleryUrls(product.gallery);
            const primaryImage = productPrimaryImage(product);
            const currency = product.currency || context.preview.store.currency;
            const detailsHref = publicProductHref(context.preview.store.slug, product);

            return (
              <article
                className={`overflow-hidden border transition hover:-translate-y-1 ${
                  config.layout.productCard === "spec-card"
                    ? "border-cyan-400/20 bg-slate-900 text-slate-100 shadow-[0_18px_70px_-50px_rgba(34,211,238,0.7)]"
                    : config.layout.productCard === "glow-card"
                      ? "border-pink-100 bg-white shadow-[0_24px_80px_-60px_rgba(236,72,153,0.9)]"
                      : config.layout.productCard === "lookbook"
                        ? "border-rose-100 bg-white shadow-[0_30px_90px_-70px_rgba(159,18,57,0.85)]"
                        : "border-slate-200 bg-white"
                } ${cardRadiusClass(context)}`}
                key={product.id}
              >
                <Link
                  className="relative block"
                  href={publicProductHref(context.preview.store.slug, product)}
                >
                  <ProductBadges className="absolute left-3 top-3 z-10" product={product} />
                  {primaryImage ? (
                    <img
                      alt={product.title}
                      className={`w-full object-cover ${config.layout.productCard === "lookbook" ? "aspect-[3/4]" : "aspect-[4/3]"}`}
                      src={primaryImage}
                    />
                  ) : (
                    <div
                      className={`flex items-end p-4 ${config.layout.productCard === "lookbook" ? "aspect-[3/4]" : "aspect-[4/3]"} bg-slate-100`}
                      style={{
                        background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}16, ${context.theme.colorPalette.secondary}24)`
                      }}
                    >
                      <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
                        Image coming soon
                      </span>
                    </div>
                  )}
                </Link>
                {galleryImages.length ? (
                  <div className={`grid gap-2 px-4 pt-4 ${config.key === "fashion-starter" ? "grid-cols-4" : "grid-cols-3"}`}>
                    {galleryImages.slice(0, config.key === "electronics-starter" ? 3 : 4).map((url) => (
                      <img
                        alt={`${product.title} gallery image`}
                        className={`aspect-square object-cover ${config.layout.productCard === "spec-card" ? "rounded-xl border border-cyan-400/20" : "rounded-2xl"}`}
                        key={url}
                        src={url}
                      />
                    ))}
                  </div>
                ) : null}
                <div className={config.layout.productCard === "spec-card" ? "p-4" : "p-5"}>
                  {isPublicCategoryTitle(product.categoryName) ? (
                        <p
                          className="mb-2 text-xs font-black uppercase tracking-[0.18em]"
                          style={{ color: context.theme.colorPalette.accent }}
                        >
                      {product.categoryName}
                    </p>
                  ) : null}
                  <Link
                    href={publicProductHref(context.preview.store.slug, product)}
                  >
                    <h3
                      className={`font-black tracking-[-0.03em] transition ${
                        config.key === "electronics-starter" ? "text-white hover:text-cyan-200" : "text-ink hover:text-slate-600"
                      } ${config.layout.productCard === "spec-card" ? "text-lg" : "text-xl"}`}
                      style={headingStyle()}
                    >
                      {product.title}
                    </h3>
                  </Link>
                  <p className={`mt-3 text-sm leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}>
                    {product.description || "Premium product information placeholder."}
                  </p>
                  <ProductSalesProof compact product={product} />
                  <ProductStockUrgency className="mt-3" compact product={product} />
                  <div
                    className={`mt-5 flex flex-wrap items-end gap-2 border-t pt-5 ${
                      config.key === "electronics-starter" ? "border-cyan-400/10 text-cyan-100" : "border-slate-100 text-ink"
                    }`}
                  >
                    <p className="text-lg font-black">
                      {formatProductPrice(product.price, product.priceLabel, currency)}
                    </p>
                    {product.compareAtPrice ? (
                      <p className={`text-sm font-bold line-through ${config.key === "electronics-starter" ? "text-slate-500" : "text-slate-400"}`}>
                        {formatProductPrice(product.compareAtPrice, null, currency)}
                      </p>
                    ) : null}
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${config.key === "electronics-starter" ? "bg-cyan-400/10 text-cyan-100" : "bg-slate-100 text-slate-500"}`}>
                      {currency}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-2">
                    <ProductQuickView
                      currency={currency}
                      detailsHref={detailsHref}
                      product={product}
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                    <CompareButton
                      currency={currency}
                      product={product}
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                    <AddToCartButton
                      currency={currency}
                      detailsHref={detailsHref}
                      product={product}
                      showBuyNow
                      showViewDetails
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                    <WishlistButton
                      currency={currency}
                      product={product}
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                  </div>
                </div>
              </article>
            );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : config.key === "shastore-flagship-premium" && section?.section_type === "flash_deals" ? (
        <FlagshipFlashDealsPlaceholder />
      ) : config.key === "shastore-flagship-premium" && section?.section_type === "new_arrivals" ? (
        <FlagshipNewArrivalsPlaceholder />
      ) : config.key === "shastore-flagship-premium" ? (
        <FlagshipProductPlaceholderGrid count={6} />
      ) : (
        <PremiumSkeletonGrid count={config.layout.mobileDensity === "dense" ? 8 : 6} label="Product image placeholder" />
      )}
      </div>
    </section>
  );
}

type SectionRenderProps = {
  context: StoreTenantContext;
  footerLinkSettings?: StoreFooterLinkSettings;
  hasPublishedAbout?: boolean;
  hasPublishedBlogArticles?: boolean;
  hasPublishedFaqs?: boolean;
  headerNavigation?: StorefrontResolvedNavigation;
  publishedAbout?: PublicStoreAboutPage | null;
  publishedArticles?: PublicStoreBlogArticle[];
  publishedFaqs?: PublicStoreFaq[];
  section: StoreSection;
};

type StorefrontNavLink = {
  href: string;
  label: string;
};

function navKey(link: StorefrontNavLink) {
  return `${link.href.trim().toLowerCase()}|${link.label.trim().toLowerCase()}`;
}

function uniqueStorefrontNavLinks(links: StorefrontNavLink[]) {
  const seenHrefs = new Set<string>();
  const seenLabels = new Set<string>();
  const unique: StorefrontNavLink[] = [];

  for (const link of links) {
    const href = link.href.trim();
    const label = link.label.trim();
    const hrefKey = href.toLowerCase();
    const labelKey = label.toLowerCase();

    if (!href || !label || seenHrefs.has(hrefKey) || seenLabels.has(labelKey)) {
      continue;
    }

    seenHrefs.add(hrefKey);
    seenLabels.add(labelKey);
    unique.push({ href, label });
  }

  return unique;
}

function FlagshipNavbarSection({ context, headerNavigation }: SectionRenderProps) {
  const slug = context.preview.store.slug;
  const categories = context.preview.categories.slice(0, 8);
  const categoryItems = categories.length
    ? categories.map((category) => ({
        href: `/store/${slug}/category/${encodeURIComponent(category.slug || category.id)}`,
        label: category.name
      }))
    : flagshipCategoryPlaceholders.map((label) => ({ href: "#categories", label }));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="bg-slate-950 px-4 py-2 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em]">
          <div className="flex flex-wrap gap-4 text-white/80">
            <span>Free shipping on premium orders</span>
            <span>30-day returns</span>
            <span>Premium support</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StorefrontLanguageSwitcher settings={context.preview.store.languageSettings} />
            <StorefrontCurrencySwitcher settings={context.preview.store.currencySettings} />
            <Link className="text-white/80 transition hover:text-white" href={`/store/${slug}/track`}>
              Track order
            </Link>
            <Link className="text-white/80 transition hover:text-white" href={`/store/${slug}/faq`}>
              Help center
            </Link>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)_auto] lg:items-center">
          <Link className="flex min-w-0 items-center gap-3" href={`/store/${slug}`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-amber-300">
              S
            </span>
            <span>
              <span className="block text-lg font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
                SHASTORE Flagship
              </span>
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Premium Store
              </span>
            </span>
          </Link>
          <form action={`/store/${slug}`} className="flex overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-inner">
            <details className="relative hidden border-r border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600 md:block">
              <summary className="cursor-pointer list-none">All categories</summary>
              <div className="absolute left-0 top-12 z-40 grid min-w-64 gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
                {categoryItems.map((item) => (
                  <Link className="rounded-xl px-3 py-2 transition hover:bg-slate-100" href={item.href} key={item.label}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
            <input
              className="min-h-12 flex-1 bg-transparent px-5 text-sm font-semibold text-ink outline-none"
              name="q"
              placeholder="Search premium products, brands, and categories"
            />
            <button className="bg-slate-950 px-6 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
              Search
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {headerNavigation?.accountEnabled ?? true ? (
              <Link className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted" href={`/store/${slug}/account`}>
                Account
              </Link>
            ) : null}
            {headerNavigation?.wishlistEnabled ?? true ? (
              <WishlistNavLink currency={context.preview.store.currency} slug={slug} storeId={context.preview.store.id} />
            ) : null}
            {headerNavigation?.cartEnabled ?? true ? (
              <CartNavLink currency={context.preview.store.currency} slug={slug} storeId={context.preview.store.id} />
            ) : null}
          </div>
        </div>
      </div>
      <nav className="border-t border-slate-100 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full bg-slate-950 px-4 py-2 text-white">All categories</summary>
            <div className="absolute left-0 top-10 z-40 grid min-w-64 gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
              {categoryItems.map((item) => (
                <Link className="rounded-xl px-3 py-2 transition hover:bg-slate-100" href={item.href} key={item.label}>
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          {flagshipMainNavLinks.map((link) => (
            <Link href={link.href.startsWith("#") ? link.href : `/store/${slug}${link.href ? `/${link.href}` : ""}`} key={link.label}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function NavbarSection({
  context,
  hasPublishedAbout = false,
  hasPublishedBlogArticles = false,
  hasPublishedFaqs = false,
  headerNavigation,
  section
}: SectionRenderProps) {
  const theme = context.preview.themeSettings;
  const config = templateConfig(context);
  const logoUrl = context.theme.logo.url || theme.logoUrl || null;
  const headerLinks = context.preview.navigation.header;
  const aboutHref = `/store/${context.preview.store.slug}/about`;
  const blogHref = `/store/${context.preview.store.slug}/blog`;
  const faqHref = `/store/${context.preview.store.slug}/faq`;
  const contactHref = `/store/${context.preview.store.slug}/contact`;
  const primaryLinks = headerNavigation
    ? uniqueStorefrontNavLinks(headerNavigation.links)
    : uniqueStorefrontNavLinks([
        ...(headerLinks.length
          ? headerLinks.map((link) => ({ href: link.href, label: link.label }))
          : [
              { href: "#products", label: "Products" },
              { href: "#categories", label: "Categories" }
            ]),
        ...(hasPublishedAbout ? [{ href: aboutHref, label: "About" }] : []),
        ...(hasPublishedFaqs ? [{ href: faqHref, label: "FAQ" }] : []),
        { href: contactHref, label: "Contact" },
        ...(hasPublishedBlogArticles ? [{ href: blogHref, label: "Blog" }] : [])
      ]);

  if (config.key === "shastore-flagship-premium") {
    return <FlagshipNavbarSection context={context} headerNavigation={headerNavigation} section={section} />;
  }

  return (
    <section
      className={`px-4 sm:px-6 lg:px-8 ${config.layout.navbar === "utility" ? "py-3" : "py-5"} ${theme.stickyHeader ? "sticky top-0 z-30 backdrop-blur" : ""}`}
      style={{
        backgroundColor:
          config.layout.navbar === "utility"
            ? "rgba(2,6,23,0.92)"
            : `${context.theme.colorPalette.surface}ee`
      }}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 border px-5 py-3 shadow-sm ${
          config.layout.navbar === "utility"
            ? "rounded-2xl border-cyan-400/20 bg-slate-900/80"
            : config.layout.navbar === "boutique"
              ? "rounded-full border-rose-100 bg-white/85"
              : config.layout.navbar === "soft"
                ? "rounded-[2rem] border-pink-100 bg-white/85"
                : "rounded-full border-slate-200 bg-white/80"
        }`}
      >
        <Link className="flex min-w-0 items-center gap-3" href={`/store/${context.preview.store.slug}`}>
          {logoUrl ? (
            <img
              alt={context.theme.logo.alt || context.settings.title}
              className="h-10 w-10 rounded-full object-cover"
              src={logoUrl}
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
              style={{ backgroundColor: context.theme.colorPalette.primary }}
            >
              {context.settings.title.slice(0, 1)}
            </span>
          )}
          <span
            className={`truncate text-sm font-black ${config.layout.navbar === "utility" ? "text-white" : "text-ink"}`}
            style={headingStyle()}
          >
            {context.settings.title}
          </span>
        </Link>
        <nav
          className={`hidden items-center gap-4 text-xs font-black uppercase tracking-[0.16em] sm:flex ${
            config.layout.navbar === "utility" ? "text-cyan-100" : "text-muted"
          }`}
        >
          {context.preview.categories.length ? (
            <details className="relative">
              <summary className="cursor-pointer list-none">Categories</summary>
              <div className="absolute left-0 top-8 z-40 grid min-w-56 gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
                {context.preview.categories.slice(0, 8).map((category) => (
                  <Link
                    className="rounded-xl px-3 py-2 transition hover:bg-slate-100"
                    href={`/store/${context.preview.store.slug}/category/${encodeURIComponent(category.slug || category.id)}`}
                    key={category.id}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <details className="relative">
              <summary className="cursor-pointer list-none">Categories</summary>
              <div className="absolute left-0 top-8 z-40 grid min-w-64 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-xl">
                {[0, 1, 2].map((item) => (
                  <div className="grid gap-2 rounded-xl bg-slate-50 p-3" key={item}>
                    <div className="h-3 w-28 rounded-full bg-slate-200" />
                    <div className="h-2 w-20 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </details>
          )}
          {primaryLinks.map((link) => (
            <Link href={link.href} key={navKey(link)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={`/store/${context.preview.store.slug}`} className="hidden min-w-44 lg:block">
          <input
            className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-ink outline-none"
            name="q"
            placeholder="Search products"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <StorefrontLanguageSwitcher settings={context.preview.store.languageSettings} />
          <StorefrontCurrencySwitcher settings={context.preview.store.currencySettings} />
          {headerNavigation?.accountEnabled ?? true ? (
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
              href={`/store/${context.preview.store.slug}/account`}
            >
              Account
            </Link>
          ) : null}
          {headerNavigation?.wishlistEnabled ?? true ? (
            <WishlistNavLink
              currency={context.preview.store.currency}
              slug={context.preview.store.slug}
              storeId={context.preview.store.id}
            />
          ) : null}
          {headerNavigation?.cartEnabled ?? true ? (
            <CartNavLink
              currency={context.preview.store.currency}
              slug={context.preview.store.slug}
              storeId={context.preview.store.id}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HeroSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = section.config;
  const template = templateConfig(context);
  const theme = context.preview.themeSettings;
  const title = textValue(config.title, theme.heroTitle || context.settings.title);
  const body = textValue(config.body, theme.heroSubtitle || (context.settings.description ?? ""));
  const background =
    theme.heroBackground === "image" && theme.bannerImageUrl
      ? `linear-gradient(135deg, ${context.theme.colorPalette.primary}cc, ${context.theme.colorPalette.secondary}99), url("${theme.bannerImageUrl}") center/cover`
      : `radial-gradient(circle at 20% 10%, ${context.theme.colorPalette.accent}33, transparent 30%), linear-gradient(135deg, ${context.theme.colorPalette.primary}, ${context.theme.colorPalette.secondary})`;

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
      <div
        className={`overflow-hidden rounded-[var(--store-border-radius)] text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] ${
          template.key === "shastore-flagship-premium"
            ? "grid gap-0 bg-slate-950 lg:grid-cols-[1fr_0.85fr]"
            : template.layout.hero === "technical-grid"
            ? "grid gap-0 border border-cyan-400/20 bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]"
            : template.layout.hero === "editorial-split"
              ? "grid gap-0 bg-white lg:grid-cols-[0.9fr_1.1fr]"
              : "px-6 py-16 sm:px-10 lg:px-14 lg:py-24"
        }`}
        style={{ background }}
      >
        <div
          className={`max-w-3xl ${
            template.layout.hero === "technical-grid" || template.layout.hero === "editorial-split"
              ? "p-8 sm:p-10 lg:p-14"
              : ""
          }`}
        >
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            {template.sections.heroEyebrow}
          </p>
          <h1
            className={`mt-5 font-black tracking-[-0.07em] ${
              template.layout.mobileDensity === "dense" ? "text-4xl sm:text-6xl" : "text-5xl sm:text-7xl lg:text-8xl"
            }`}
            style={headingStyle()}
          >
            {title}
          </h1>
          {body ? <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/75">{body}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950" href="#products">
              Browse products
            </a>
            <a className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white/80" href="#categories">
              View categories
            </a>
          </div>
        </div>
        {template.key === "shastore-flagship-premium" ? (
          <div className="grid content-center gap-4 border-t border-white/10 bg-white/10 p-8 lg:border-l lg:border-t-0">
            <PremiumVisualPlaceholder eyebrow="Hero image placeholder" title="Premium storefront visual" />
            <div className="grid grid-cols-3 gap-3">
              {["Category", "Product", "Brand"].map((item) => (
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-xs font-black uppercase tracking-[0.14em] text-white/70" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : template.layout.hero === "technical-grid" ? (
          <div className="grid content-center gap-4 border-t border-cyan-400/20 bg-slate-900/70 p-8 lg:border-l lg:border-t-0">
            {["Fast checkout", "Live catalog", "Mobile ready"].map((item) => (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4" key={item}>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{item}</p>
                <div className="mt-3 h-2 rounded-full bg-cyan-400/30" />
              </div>
            ))}
          </div>
        ) : template.layout.hero === "editorial-split" ? (
          <div className="min-h-80 bg-white/10 p-6 lg:p-10">
            <div className="flex h-full items-end rounded-[2rem] bg-white/20 p-6 ring-1 ring-white/20">
              <p className="text-2xl font-black tracking-[-0.05em] text-white/90" style={headingStyle()}>
                New season edit
              </p>
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}

function CategoriesSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const categories = context.preview.categories.slice(0, 8);
  const title = textValue(section.config.title, config.sections.categoriesTitle);
  const subtitle = textValue(section.config.subtitle);

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-surface)]`}>
      <div className="mx-auto max-w-7xl">
      <div id="categories">
        <p
          className="text-xs font-black uppercase tracking-[0.22em]"
          style={{ color: context.theme.colorPalette.accent }}
        >
          Categories
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {title}
        </h2>
        {subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
        {categories.length ? (
          <div
            className={`mt-6 grid gap-4 ${
              config.layout.mobileDensity === "dense" ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {categories.map((category) => (
              <Link
                className={`overflow-hidden border bg-white shadow-sm ${cardRadiusClass(context)} ${
                  config.key === "electronics-starter"
                    ? "border-cyan-400/20 bg-slate-900 text-white"
                    : config.key === "beauty-starter"
                      ? "border-pink-100"
                      : "border-slate-200"
                } transition hover:-translate-y-0.5 hover:shadow-lg`}
                href={`/store/${context.preview.store.slug}/category/${encodeURIComponent(category.slug || category.id)}`}
                key={category.id}
              >
                {category.imageUrl ? (
                  <img alt={category.name} className="aspect-[4/3] w-full object-cover" src={category.imageUrl} />
                ) : (
                  <div
                    className="flex aspect-[4/3] items-end p-4"
                    style={{
                      background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}16, ${context.theme.colorPalette.secondary}24)`
                    }}
                  >
                    <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      Category image placeholder
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <h3
                    className={`text-lg font-black tracking-[-0.03em] ${config.key === "electronics-starter" ? "text-white" : "text-ink"}`}
                    style={headingStyle()}
                  >
                    {category.name}
                  </h3>
                  <p className={`mt-2 text-sm leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}>
                    {category.description || "Explore products in this collection."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : config.key === "shastore-flagship-premium" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {flagshipCategoryPlaceholders.map((name) => (
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm" key={name}>
                <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
                  <span className="rounded-full bg-white/85 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Category image placeholder
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black tracking-[-0.03em] text-ink" style={headingStyle()}>
                    {name}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-muted">Item count placeholder</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <PremiumSkeletonGrid label="Category image placeholder" />
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 3) : [];
  const title = textValue(section.config.title, config.sections.testimonialsTitle);
  const subtitle = textValue(section.config.subtitle);
  const testimonials = items;

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
        Testimonials
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
        {title}
      </h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {testimonials.length ? (
          testimonials.map((item, index) => (
            <figure
              className={`border bg-white p-6 ${cardRadiusClass(context)} ${
                config.key === "electronics-starter" ? "border-cyan-400/20 bg-slate-900" : "border-slate-200"
              }`}
              key={index}
            >
              <blockquote className="text-sm font-semibold leading-7 text-muted">
                “{textValue(item.quote, "Customer testimonial")}”
              </blockquote>
              <figcaption className={`mt-4 text-sm font-black ${config.key === "electronics-starter" ? "text-cyan-100" : "text-ink"}`}>
                {textValue(item.name, "Customer")}
              </figcaption>
            </figure>
          ))
        ) : config.key === "shastore-flagship-premium" ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["10K+", "Customer placeholder"],
              ["500+", "Brand placeholder"],
              ["24/7", "Support placeholder"],
              ["4.9", "Rating placeholder"]
            ].map(([value, label]) => (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm" key={label}>
                <p className="text-4xl font-black tracking-[-0.05em] text-ink" style={headingStyle()}>{value}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <figure className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm" key={item}>
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="mt-5 grid gap-2">
                  <div className="h-3 rounded-full bg-slate-100" />
                  <div className="h-3 w-4/5 rounded-full bg-slate-100" />
                </div>
                <figcaption className="mt-5 text-sm font-black text-ink">Testimonial placeholder</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

function FaqSection({ context, publishedFaqs = [], section }: SectionRenderProps) {
  const config = templateConfig(context);
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 5) : [];
  const title = textValue(section.config.title, config.sections.faqTitle);
  const subtitle = textValue(section.config.subtitle);
  const managedFaqs = publishedFaqs.slice(0, 8).map((faq) => ({
    answer: faq.answer,
    id: faq.id,
    question: faq.question
  }));
  const faqs = managedFaqs.length ? managedFaqs : items;

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-surface)]`}>
      <div className="mx-auto max-w-7xl">
      <div id="faq">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>FAQ</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {title}
        </h2>
        {subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
        <div className="mt-6 grid gap-3">
          {faqs.length ? (
            faqs.map((item, index) => (
              <details
                className={`border bg-white p-5 ${config.key === "electronics-starter" ? "rounded-xl border-cyan-400/20 bg-slate-900" : "rounded-[1.5rem] border-slate-200"}`}
                key={typeof item.id === "string" ? item.id : index}
              >
                <summary className={`cursor-pointer text-sm font-black ${config.key === "electronics-starter" ? "text-cyan-100" : "text-ink"}`}>
                  {textValue(item.question, "Question")}
                </summary>
                <p className={`mt-3 text-sm leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}>
                  {textValue(item.answer, "Answer coming soon.")}
                </p>
              </details>
            ))
          ) : (
            <div className="grid gap-3">
              {["Shipping question placeholder", "Return question placeholder", "Payment question placeholder"].map((item) => (
                <details className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={item}>
                  <summary className="cursor-pointer text-sm font-black text-ink">{item}</summary>
                  <div className="mt-3 grid gap-2">
                    <div className="h-3 rounded-full bg-slate-100" />
                    <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}

function FaqPreviewSection(props: SectionRenderProps) {
  return <FaqSection {...props} />;
}

function AboutPreviewSection({ context, publishedAbout, section }: SectionRenderProps) {
  if (!publishedAbout) {
    return null;
  }

  const title = textValue(section.config.title, publishedAbout.title);
  const subtitle = textValue(
    section.config.subtitle,
    publishedAbout.subtitle || publishedAbout.companyStory || ""
  );

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 rounded-[var(--store-border-radius)] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
              About
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-3 line-clamp-5 text-sm font-semibold leading-7 text-muted">
                {subtitle}
              </p>
            ) : null}
            <Link
              className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              href={`/store/${context.preview.store.slug}/about`}
            >
              Read more
            </Link>
          </div>
          {publishedAbout.coverImageUrl ? (
            <img
              alt={publishedAbout.title}
              className="aspect-[4/3] w-full rounded-[2rem] object-cover"
              src={publishedAbout.coverImageUrl}
            />
          ) : (
            <div
              className="flex min-h-64 items-end rounded-[2rem] p-6"
              style={{
                background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}18, ${context.theme.colorPalette.secondary}28)`
              }}
            >
              <p className="text-2xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
                {context.settings.title}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BlogPreviewSection({ context, publishedArticles = [], section }: SectionRenderProps) {
  const articles = publishedArticles.slice(0, 3);
  const title = textValue(section.config.title, "Latest articles");
  const subtitle = textValue(section.config.subtitle, "Read the newest updates from this store.");

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-surface)]`}>
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[var(--store-border-radius)] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
                Blog / Articles
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
              href={`/store/${context.preview.store.slug}/blog`}
            >
              View all articles
            </Link>
          </div>
          {articles.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {articles.map((article) => (
                <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4" key={article.id}>
                  <Link href={`/store/${context.preview.store.slug}/blog/${article.slug}`}>
                    <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                      {article.title}
                    </h3>
                  </Link>
                  {article.excerpt ? (
                    <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-muted">
                      {article.excerpt}
                    </p>
                  ) : null}
                  <Link
                    className="mt-4 inline-flex text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:text-ink"
                    href={`/store/${context.preview.store.slug}/blog/${article.slug}`}
                  >
                    Read article
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50" key={item}>
                  <div className="flex aspect-[16/10] items-end bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
                    <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Blog cover placeholder
                    </span>
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                    <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedCollectionSection({ context, section }: SectionRenderProps) {
  const categories = context.preview.categories;
  const category = categories[0] ?? null;
  const products = context.preview.products
    .filter((product) => category && (product.categoryId === category.id || product.categoryName === category.name))
    .filter((product) => isPublicProductStatus(product.status))
    .slice(0, 4);
  const title = textValue(section.config.title, category?.name ?? "Featured collection");
  const subtitle = textValue(section.config.subtitle, category?.description || "Explore this premium collection area.");

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
              Featured collection
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
              {title}
            </h2>
            {subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p> : null}
          </div>
          {category ? (
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
              href={`/store/${context.preview.store.slug}/category/${encodeURIComponent(category.slug || category.id)}`}
            >
              View collection
            </Link>
          ) : null}
        </div>
        {products.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => {
              const primaryImage = productPrimaryImage(product);

              return (
                <Link
                  className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  href={publicProductHref(context.preview.store.slug, product)}
                  key={product.id}
                >
                  {primaryImage ? (
                    <img alt={product.title} className="aspect-[4/3] w-full object-cover" src={primaryImage} />
                  ) : (
                    <div
                      className="aspect-[4/3]"
                      style={{
                        background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}16, ${context.theme.colorPalette.secondary}24)`
                      }}
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-base font-black tracking-[-0.02em] text-ink">
                      {product.title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <PremiumSkeletonGrid label="Product image placeholder" />
          </div>
        )}
      </div>
    </section>
  );
}

function RecentlyViewedSection({ context, section }: SectionRenderProps) {
  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
        <RecentlyViewedProducts
          currency={context.preview.store.currency}
          products={context.preview.products}
          slug={context.preview.store.slug}
          storeId={context.preview.store.id}
          title={textValue(section.config.title, "Recently viewed")}
          trackCurrentProduct={false}
        />
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Recently viewed
          </p>
          <div className="mt-5">
            <PremiumSkeletonGrid label="Product image placeholder" />
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandsSection({ context, section }: SectionRenderProps) {
  const categories = context.preview.categories.slice(0, 8);
  const isFlagship = isFlagshipTemplate(context);
  const title = textValue(section.config.title, isFlagship ? "Top Brands" : "Brands and collections");
  const subtitle = textValue(section.config.subtitle, "Browse the store through category-led brand entry points.");

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-surface)]`}>
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
          Brands
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p>
        {categories.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:shadow-lg"
                href={`/store/${context.preview.store.slug}/category/${encodeURIComponent(category.slug || category.id)}`}
                key={category.id}
              >
                {category.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" key={item}>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Brand
                </div>
                <p className="mt-4 text-sm font-black text-ink">Brand logo placeholder</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TrustBadgesSection({ context, section }: SectionRenderProps) {
  const store = context.preview.store;
  const config = templateConfig(context);
  const badges = config.key === "shastore-flagship-premium"
    ? [
        { body: "Shipping promise placeholder", title: "Free Shipping" },
        { body: "Return policy placeholder", title: "30-Day Returns" },
        { body: "Payment security placeholder", title: "Secure Payment" },
        { body: "Premium support placeholder", title: "24/7 Support" }
      ]
    : [
        {
          body: store.deliveryEnabled || store.pickupEnabled
            ? "Delivery and pickup settings are managed by the store owner."
            : "Delivery promise placeholder for this store.",
          title: "Delivery ready"
        },
        {
          body: store.supportEmail || store.supportPhone || store.whatsappNumber
            ? "Support channels are connected for this store."
            : "Customer support placeholder for this store.",
          title: "Customer support"
        },
        {
          body: "Checkout uses the store's active payment and order settings.",
          title: "Secure checkout"
        },
        {
          body: "Language and currency tools are available for localized shopping.",
          title: "Localized shopping"
        }
      ];
  const title = textValue(section.config.title, "Why shop here");
  const subtitle = textValue(section.config.subtitle, "Trust signals powered by store settings.");

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
          Trust
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">{subtitle}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={badge.title}>
              <h3 className="text-base font-black text-ink">{badge.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{badge.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const title = textValue(section.config.title, config.sections.ctaTitle || `Ready to shop ${context.settings.title}?`);
  const body = textValue(
    section.config.body,
    config.sections.ctaBody || context.settings.description || "Browse the latest products and place your order."
  );

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
      <div
        className={`${cardRadiusClass(context)} p-8 text-white sm:p-10`}
        style={{ background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}, ${context.theme.colorPalette.secondary})` }}
      >
        <h2 className="text-3xl font-black tracking-[-0.04em]" style={headingStyle()}>{title}</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/75">{body}</p>
        <a className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950" href="#products">
          {context.preview.themeSettings.ctaText || "Shop now"}
        </a>
      </div>
      </div>
    </section>
  );
}

function NewsletterSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const title = textValue(section.config.title, "Join the newsletter");
  const body = textValue(section.config.body, "Newsletter placeholder for future customer updates and premium offers.");

  if (config.key !== "shastore-flagship-premium") {
    return <GenericContentSection context={context} section={section} />;
  }

  return (
    <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Newsletter</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]" style={headingStyle()}>
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/65">{body}</p>
        </div>
        <form className="flex overflow-hidden rounded-full border border-white/10 bg-white text-slate-950">
          <input
            className="min-h-12 flex-1 px-5 text-sm font-semibold outline-none"
            placeholder="Email address placeholder"
            type="email"
          />
          <button className="bg-amber-400 px-6 text-xs font-black uppercase tracking-[0.16em]" type="button">
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}

function FooterSection({
  context,
  footerLinkSettings = defaultStoreFooterLinkSettings,
  hasPublishedAbout = false,
  hasPublishedBlogArticles = false,
  hasPublishedFaqs = false
}: SectionRenderProps) {
  const theme = context.preview.themeSettings;

  return (
    <PublicStoreFooter
      copyrightText={theme.copyrightText}
      footerBackgroundColor={theme.footerBackgroundColor}
      footerLinkSettings={footerLinkSettings}
      footerStyle={String(context.theme.styleConfig.footerStyle || theme.footerStyle)}
      footerTextColor={theme.footerTextColor}
      currencySettings={context.preview.store.currencySettings}
      hasPublishedBlogArticles={hasPublishedBlogArticles}
      hasPublishedFaqs={hasPublishedFaqs}
      languageSettings={context.preview.store.languageSettings}
      navigationLinks={context.preview.navigation.footer}
      pages={context.preview.pages}
      socialLinks={context.preview.store.socialLinks}
      storeSlug={context.store_slug}
      storeTitle={context.settings.title}
      premiumSkeleton={templateConfig(context).key === "shastore-flagship-premium"}
    />
  );
}

function GenericContentSection({
  context,
  section
}: {
  context: StoreTenantContext;
  section: StoreSection;
}) {
  const config = section.config;
  const title = textValue(config.title, context.settings.title);
  const body = textValue(config.body, context.settings.description ?? "");

  return (
    <SectionShell muted={section.section_type === "banner" || section.section_type === "newsletter"}>
      <div className="rounded-[var(--store-border-radius)] border border-slate-200 bg-white p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          {resolveSectionRenderer(section).replace("_", " ")}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">{title}</h2>
        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{body}</p> : null}
      </div>
    </SectionShell>
  );
}

function MissingSectionRenderer({ section }: { context: StoreTenantContext; section: StoreSection }) {
  return (
    <SectionShell muted>
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-black text-ink">Unsupported storefront section</p>
        <p className="mt-2 text-xs font-semibold text-muted">
          The section type &quot;{section.section_type}&quot; is not available yet, so this safe placeholder is shown.
        </p>
      </div>
    </SectionShell>
  );
}

const sectionRegistry: Record<
  string,
  (props: SectionRenderProps) => ReactNode
> = {
  CTA: CtaSection,
  FAQ: FaqSection,
  about_preview: AboutPreviewSection,
  banner: GenericContentSection,
  best_sellers: ProductGridSection,
  blog_preview: BlogPreviewSection,
  brands: BrandsSection,
  categories: CategoriesSection,
  cta: CtaSection,
  faq: FaqSection,
  faq_preview: FaqPreviewSection,
  featured_categories: CategoriesSection,
  featured_collection: FeaturedCollectionSection,
  featured_products: ProductGridSection,
  flash_deals: ProductGridSection,
  footer: FooterSection,
  footer_cta: CtaSection,
  hero: HeroSection,
  image: GenericContentSection,
  navbar: NavbarSection,
  new_arrivals: ProductGridSection,
  newsletter: NewsletterSection,
  product_grid: ProductGridSection,
  recommended_products: ProductGridSection,
  recently_viewed: RecentlyViewedSection,
  rich_text: GenericContentSection,
  testimonials: TestimonialsSection,
  trust_badges: TrustBadgesSection
};

export function SectionRenderer({
  context,
  footerLinkSettings = defaultStoreFooterLinkSettings,
  hasPublishedAbout = false,
  hasPublishedBlogArticles = false,
  hasPublishedFaqs = false,
  headerNavigation,
  publishedAbout = null,
  publishedArticles = [],
  publishedFaqs = [],
  section
}: {
  context: StoreTenantContext;
  footerLinkSettings?: StoreFooterLinkSettings;
  hasPublishedAbout?: boolean;
  hasPublishedBlogArticles?: boolean;
  hasPublishedFaqs?: boolean;
  headerNavigation?: StorefrontResolvedNavigation;
  publishedAbout?: PublicStoreAboutPage | null;
  publishedArticles?: PublicStoreBlogArticle[];
  publishedFaqs?: PublicStoreFaq[];
  section: StoreSection;
}) {
  const Renderer = sectionRegistry[section.section_type] ?? MissingSectionRenderer;

  if (section.section_type === "spacer") {
    return <div aria-hidden="true" className="h-8 sm:h-12" />;
  }

  return (
    <Renderer
      context={context}
      footerLinkSettings={footerLinkSettings}
      hasPublishedAbout={hasPublishedAbout}
      hasPublishedBlogArticles={hasPublishedBlogArticles}
      hasPublishedFaqs={hasPublishedFaqs}
      headerNavigation={headerNavigation}
      publishedAbout={publishedAbout}
      publishedArticles={publishedArticles}
      publishedFaqs={publishedFaqs}
      section={section}
    />
  );
}

export async function DynamicSectionLoader({
  context,
  fallback,
  footerLinkSettings = defaultStoreFooterLinkSettings,
  hasPublishedAbout = false,
  hasPublishedBlogArticles = false,
  hasPublishedFaqs = false,
  headerNavigation,
  homepageLayout,
  publishedAbout = null,
  publishedArticles = [],
  publishedFaqs = []
}: {
  context: StoreTenantContext;
  fallback: ReactNode;
  footerLinkSettings?: StoreFooterLinkSettings;
  hasPublishedAbout?: boolean;
  hasPublishedBlogArticles?: boolean;
  hasPublishedFaqs?: boolean;
  headerNavigation?: StorefrontResolvedNavigation;
  homepageLayout?: StoreHomepageLayoutConfig;
  publishedAbout?: PublicStoreAboutPage | null;
  publishedArticles?: PublicStoreBlogArticle[];
  publishedFaqs?: PublicStoreFaq[];
}) {
  const layout = homepageLayout?.configured
    ? {
        builderPreview: {},
        key: `${context.theme.layout_key}:homepage`,
        sections: resolveHomepageManagedSections(context, homepageLayout.sections)
      }
    : await resolveSectionLayout(context);
  const previewScript = (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(layout.builderPreview).replace(/</g, "\\u003c")
      }}
      id="shastore-builder-preview-state"
      type="application/json"
    />
  );

  if (!layout.sections.length) {
    return (
      <>
        {previewScript}
        {homepageLayout?.configured ? null : fallback}
      </>
    );
  }

  return (
    <>
      {previewScript}
      {layout.sections.map((section) => (
        <SectionRenderer
          context={context}
          footerLinkSettings={footerLinkSettings}
          hasPublishedAbout={hasPublishedAbout}
          hasPublishedBlogArticles={hasPublishedBlogArticles}
          hasPublishedFaqs={hasPublishedFaqs}
          headerNavigation={headerNavigation}
          key={section.id}
          publishedAbout={publishedAbout}
          publishedArticles={publishedArticles}
          publishedFaqs={publishedFaqs}
          section={section}
        />
      ))}
    </>
  );
}
