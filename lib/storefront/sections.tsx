import type { ReactNode } from "react";
import Link from "next/link";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { PublicStoreFooter } from "@/components/storefront/public-store-footer";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
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

export type StoreSectionType =
  | "hero"
  | "navbar"
  | "banner"
  | "product_grid"
  | "featured_products"
  | "categories"
  | "rich_text"
  | "image"
  | "CTA"
  | "cta"
  | "testimonials"
  | "FAQ"
  | "faq"
  | "footer"
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
  "product_grid",
  "featured_products",
  "categories",
  "rich_text",
  "image",
  "CTA",
  "cta",
  "testimonials",
  "FAQ",
  "faq",
  "footer",
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
  return resolveStorefrontTemplateConfig({
    fontStyle: context.preview.fontStyle,
    layoutStyle: context.preview.layoutStyle,
    templateId: context.preview.templateId,
    themeColor: context.preview.themeColor,
    themeSettings: context.preview.themeSettings
  });
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

function whatsappProductHref(whatsappNumber: string | null, storeTitle: string, productTitle: string) {
  const number = whatsappNumber?.replace(/\D/g, "");

  if (!number) {
    return null;
  }

  const text = encodeURIComponent(`Hi, I want to order ${productTitle} from ${storeTitle}.`);
  return `https://wa.me/${number}?text=${text}`;
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

function ProductGridSection({ context }: { context: StoreTenantContext; section?: StoreSection }) {
  const config = templateConfig(context);
  const products = context.preview.products
    .filter((product) => isPublicProductStatus(product.status))
    .slice(0, config.key === "electronics-starter" ? 8 : 6);
  const theme = context.preview.themeSettings;
  const productSections = buildPublicProductSections({
    categories: context.preview.categories,
    products
  });

  return (
    <section
      className={`${sectionPaddingClass(context)} ${config.key === "electronics-starter" ? "bg-slate-950" : "bg-[var(--store-background)]"}`}
      id="products"
    >
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-black uppercase tracking-[0.22em]"
            style={{ color: context.theme.colorPalette.accent }}
          >
            {config.label}
          </p>
          <h2
            className={`mt-2 font-black tracking-[-0.04em] ${config.key === "electronics-starter" ? "text-white" : "text-ink"} ${config.typography.scale === "large" ? "text-4xl" : "text-3xl"}`}
            style={headingStyle()}
          >
            {config.sections.productsTitle}
          </h2>
        </div>
        <p
          className={`max-w-xl text-sm font-semibold leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}
        >
          {config.sections.productsDescription}
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
            const whatsappHref = whatsappProductHref(
              context.preview.store.whatsappNumber,
              context.preview.store.title,
              product.title
            );
            const galleryImages = productGalleryUrls(product.gallery);
            const primaryImage = productPrimaryImage(product);
            const currency = product.currency || context.preview.store.currency;

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
                  href={publicProductHref(context.preview.store.slug, product)}
                >
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
                    {product.description || "No description has been added for this product yet."}
                  </p>
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
                    <AddToCartButton
                      currency={currency}
                      product={product}
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                    <WishlistButton
                      currency={currency}
                      product={product}
                      slug={context.preview.store.slug}
                      storeId={context.preview.store.id}
                    />
                    <Link
                      className={`inline-flex h-11 items-center justify-center px-4 text-sm font-black transition ${cardRadiusClass(context)} ${
                        config.key === "electronics-starter"
                          ? "border border-cyan-400/20 bg-slate-950 text-cyan-100 hover:border-cyan-300"
                          : "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      href={publicProductHref(context.preview.store.slug, product)}
                    >
                      View product details
                    </Link>
                    {whatsappHref ? (
                      <a
                        className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-black text-white transition"
                        href={whatsappHref}
                        rel="noreferrer"
                        style={{ backgroundColor: theme.accentColor }}
                        target="_blank"
                      >
                        Order on WhatsApp
                      </a>
                    ) : (
                      <button
                        className="h-11 rounded-full bg-slate-100 px-4 text-sm font-black text-slate-400"
                        disabled
                        type="button"
                      >
                        WhatsApp unavailable
                      </button>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400"
                        disabled
                        type="button"
                      >
                        Pay by Card
                      </button>
                      <button
                        className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400"
                        disabled
                        type="button"
                      >
                        PayPal
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`rounded-[2rem] border border-dashed p-10 text-center ${
            config.key === "electronics-starter"
              ? "border-cyan-400/20 bg-slate-900 text-cyan-50"
              : "border-slate-300 bg-white text-ink"
          }`}
        >
          <h3 className="text-2xl font-black tracking-[-0.03em]">
            No products available yet
          </h3>
          <p className={`mx-auto mt-3 max-w-xl text-sm leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}>
            This published store does not have active products yet.
          </p>
        </div>
      )}
      </div>
    </section>
  );
}

function NavbarSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const theme = context.preview.themeSettings;
  const config = templateConfig(context);
  const logoUrl = context.theme.logo.url || theme.logoUrl || null;

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
          <a href="#products">Products</a>
          <a href="#categories">Categories</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="flex flex-wrap gap-2">
          <WishlistNavLink
            currency={context.preview.store.currency}
            slug={context.preview.store.slug}
            storeId={context.preview.store.id}
          />
          <CartNavLink
            currency={context.preview.store.currency}
            slug={context.preview.store.slug}
            storeId={context.preview.store.id}
          />
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
          template.layout.hero === "technical-grid"
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
        {template.layout.hero === "technical-grid" ? (
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

function CategoriesSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const categories = context.preview.categories.slice(0, 8);

  if (!categories.length) {
    return null;
  }

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
          {config.sections.categoriesTitle}
        </h2>
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
                  className="aspect-[4/3]"
                  style={{
                    background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}16, ${context.theme.colorPalette.secondary}24)`
                  }}
                />
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
      </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 3) : [];
  const testimonials = items.length
    ? items
    : [
        { quote: "Fast ordering and a clean shopping experience.", name: "Happy customer" },
        { quote: "The catalog is simple to browse on mobile.", name: "Store shopper" }
      ];

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-background)]`}>
      <div className="mx-auto max-w-7xl">
      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>
        Testimonials
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
        {config.sections.testimonialsTitle}
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {testimonials.map((item, index) => (
          <figure
            className={`border bg-white p-6 ${cardRadiusClass(context)} ${
              config.key === "electronics-starter" ? "border-cyan-400/20 bg-slate-900" : "border-slate-200"
            }`}
            key={index}
          >
            <blockquote className="text-sm font-semibold leading-7 text-muted">
              “{textValue(item.quote, "Great store experience.")}”
            </blockquote>
            <figcaption className={`mt-4 text-sm font-black ${config.key === "electronics-starter" ? "text-cyan-100" : "text-ink"}`}>
              {textValue(item.name, "Customer")}
            </figcaption>
          </figure>
        ))}
      </div>
      </div>
    </section>
  );
}

function FaqSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = templateConfig(context);
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 5) : [];
  const faqs = items.length
    ? items
    : [
        { answer: "Orders can be submitted through the store cart or WhatsApp when available.", question: "How do I order?" },
        { answer: "Products and checkout options are managed by the store owner.", question: "Are products updated live?" }
      ];

  return (
    <section className={`${sectionPaddingClass(context)} bg-[var(--store-surface)]`}>
      <div className="mx-auto max-w-7xl">
      <div id="faq">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: context.theme.colorPalette.accent }}>FAQ</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink" style={headingStyle()}>
          {config.sections.faqTitle}
        </h2>
        <div className="mt-6 grid gap-3">
          {faqs.map((item, index) => (
            <details
              className={`border bg-white p-5 ${config.key === "electronics-starter" ? "rounded-xl border-cyan-400/20 bg-slate-900" : "rounded-[1.5rem] border-slate-200"}`}
              key={index}
            >
              <summary className={`cursor-pointer text-sm font-black ${config.key === "electronics-starter" ? "text-cyan-100" : "text-ink"}`}>
                {textValue(item.question, "Question")}
              </summary>
              <p className={`mt-3 text-sm leading-6 ${config.key === "electronics-starter" ? "text-slate-300" : "text-muted"}`}>
                {textValue(item.answer, "Answer coming soon.")}
              </p>
            </details>
          ))}
        </div>
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

function FooterSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const theme = context.preview.themeSettings;

  return (
    <PublicStoreFooter
      copyrightText={theme.copyrightText}
      footerBackgroundColor={theme.footerBackgroundColor}
      footerTextColor={theme.footerTextColor}
      pages={context.preview.pages}
      storeSlug={context.store_slug}
      storeTitle={context.settings.title}
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
  (props: { context: StoreTenantContext; section: StoreSection }) => ReactNode
> = {
  CTA: CtaSection,
  FAQ: FaqSection,
  banner: GenericContentSection,
  categories: CategoriesSection,
  cta: CtaSection,
  faq: FaqSection,
  featured_products: ProductGridSection,
  footer: FooterSection,
  hero: HeroSection,
  image: GenericContentSection,
  navbar: NavbarSection,
  newsletter: GenericContentSection,
  product_grid: ProductGridSection,
  rich_text: GenericContentSection,
  testimonials: TestimonialsSection
};

export function SectionRenderer({
  context,
  section
}: {
  context: StoreTenantContext;
  section: StoreSection;
}) {
  const Renderer = sectionRegistry[section.section_type] ?? MissingSectionRenderer;

  if (section.section_type === "spacer") {
    return <div aria-hidden="true" className="h-8 sm:h-12" />;
  }

  return <Renderer context={context} section={section} />;
}

export async function DynamicSectionLoader({
  context,
  fallback
}: {
  context: StoreTenantContext;
  fallback: ReactNode;
}) {
  const layout = await resolveSectionLayout(context);
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
        {fallback}
      </>
    );
  }

  return (
    <>
      {previewScript}
      {layout.sections.map((section) => (
        <SectionRenderer context={context} key={section.id} section={section} />
      ))}
    </>
  );
}
