import type { ReactNode } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/public-store-cart";
import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVisualBuilderPayload,
  loadVisualEditorState,
  resolveBuilderSections
} from "@/lib/storefront/builder";
import { resolveStorefrontRuntimeSections } from "@/lib/storefront/runtime";

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

export async function resolveSectionLayout(context: StoreTenantContext): Promise<StorePageLayout> {
  const builderState = await loadVisualEditorState(context);
  const builderSections = resolveBuilderSections(builderState, context);
  const builderPreview = getVisualBuilderPayload(builderState);

  if (builderSections.length) {
    return {
      builderPreview,
      key: `${context.theme.layout_key}:builder`,
      sections: builderSections
    };
  }

  const sections = await loadStoreSections(context);

  if (sections.length) {
    return {
      builderPreview,
      key: `${context.theme.layout_key}:saved`,
      sections
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
  const products = context.preview.products.slice(0, 6);
  const theme = context.preview.themeSettings;
  const categorizedProductIds = new Set<string>();
  const categorySections = context.preview.categories.map((category) => {
    const categoryProducts = products.filter((product) => {
      const matchesCategory =
        product.categoryId === category.id ||
        (!product.categoryId && product.categoryName === category.name);

      if (matchesCategory) {
        categorizedProductIds.add(product.id);
      }

      return matchesCategory;
    });

    return { category, products: categoryProducts };
  });
  const uncategorizedProducts = products.filter((product) => !categorizedProductIds.has(product.id));
  const productSections = categorySections.length
    ? [
        ...categorySections,
        ...(uncategorizedProducts.length
          ? [
              {
                category: {
                  description: "Products that are not assigned to a category yet.",
                  id: "uncategorized",
                  imageUrl: null,
                  name: "More products"
                },
                products: uncategorizedProducts
              }
            ]
          : [])
      ]
    : [
        {
          category: {
            description: "Real products saved in Store Builder are shown here for this published store.",
            id: "featured",
            imageUrl: null,
            name: "Featured products"
          },
          products
        }
      ];

  return (
    <SectionShell muted>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Catalog
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
            Featured products
          </h2>
        </div>
        <p className="max-w-xl text-sm font-semibold leading-6 text-muted">
          Real products saved in Store Builder are shown here for this published store.
        </p>
      </div>
      {products.length || context.preview.categories.length ? (
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
                  {section.category.description ||
                    "Products assigned to this category will appear here."}
                </p>
              </div>
              {section.products.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.products.map((product) => {
            const whatsappHref = whatsappProductHref(
              context.preview.store.whatsappNumber,
              context.preview.store.title,
              product.title
            );

            return (
              <article
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white"
                key={product.id}
              >
                <Link
                  href={`/store/${context.preview.store.slug}/product/${encodeURIComponent(product.id)}`}
                >
                  {product.imageUrl ? (
                    <img
                      alt={product.title}
                      className="aspect-[4/3] w-full object-cover"
                      src={product.imageUrl}
                    />
                  ) : (
                    <div
                      className="aspect-[4/3] bg-slate-100"
                      style={{
                        background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}16, ${context.theme.colorPalette.secondary}24)`
                      }}
                    />
                  )}
                </Link>
                <div className="p-5">
                  {product.categoryName ? (
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      {product.categoryName}
                    </p>
                  ) : null}
                  <Link
                    href={`/store/${context.preview.store.slug}/product/${encodeURIComponent(product.id)}`}
                  >
                    <h3 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {product.description || "No description has been added for this product yet."}
                  </p>
                  <p className="mt-5 border-t border-slate-100 pt-5 text-lg font-black text-ink">
                    {formatProductPrice(
                      product.price,
                      product.priceLabel,
                      context.preview.store.currency
                    )}
                  </p>
                  <div className="mt-5 grid gap-2">
                    <AddToCartButton product={product} slug={context.preview.store.slug} />
                    <Link
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-slate-300 hover:bg-slate-50"
                      href={`/store/${context.preview.store.slug}/product/${encodeURIComponent(product.id)}`}
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
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h4 className="text-xl font-black tracking-[-0.03em] text-ink">
                    No products in this category yet
                  </h4>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No products yet
          </h3>
        </div>
      )}
    </SectionShell>
  );
}

function NavbarSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const theme = context.preview.themeSettings;

  return (
    <section
      className={`px-4 py-5 sm:px-6 lg:px-8 ${theme.stickyHeader ? "sticky top-0 z-30 backdrop-blur" : ""}`}
      style={{ backgroundColor: `${context.theme.colorPalette.surface}ee` }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/80 px-5 py-3 shadow-sm">
        <Link className="flex min-w-0 items-center gap-3" href={`/store/${context.preview.store.slug}`}>
          {context.theme.logo.url ? (
            <img
              alt={context.theme.logo.alt || context.settings.title}
              className="h-10 w-10 rounded-full object-cover"
              src={context.theme.logo.url}
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
              style={{ backgroundColor: context.theme.colorPalette.primary }}
            >
              {context.settings.title.slice(0, 1)}
            </span>
          )}
          <span className="truncate text-sm font-black text-ink">{context.settings.title}</span>
        </Link>
        <nav className="hidden items-center gap-4 text-xs font-black uppercase tracking-[0.16em] text-muted sm:flex">
          <a href="#products">Products</a>
          <a href="#categories">Categories</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link
          className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white"
          href={`/store/${context.preview.store.slug}/cart`}
          style={{ backgroundColor: context.theme.colorPalette.primary }}
        >
          Cart
        </Link>
      </div>
    </section>
  );
}

function HeroSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const config = section.config;
  const theme = context.preview.themeSettings;
  const title = textValue(config.title, theme.heroTitle || context.settings.title);
  const body = textValue(config.body, theme.heroSubtitle || (context.settings.description ?? ""));
  const background =
    theme.heroBackground === "image" && theme.bannerImageUrl
      ? `linear-gradient(135deg, ${context.theme.colorPalette.primary}cc, ${context.theme.colorPalette.secondary}99), url("${theme.bannerImageUrl}") center/cover`
      : `radial-gradient(circle at 20% 10%, ${context.theme.colorPalette.accent}33, transparent 30%), linear-gradient(135deg, ${context.theme.colorPalette.primary}, ${context.theme.colorPalette.secondary})`;

  return (
    <SectionShell muted>
      <div
        className="rounded-[var(--store-border-radius)] px-6 py-16 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] sm:px-10 lg:px-14 lg:py-24"
        style={{ background }}
      >
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            {context.preview.templateId}
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-[-0.07em] sm:text-7xl lg:text-8xl">
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
      </div>
    </SectionShell>
  );
}

function CategoriesSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const categories = context.preview.categories.slice(0, 8);

  if (!categories.length) {
    return null;
  }

  return (
    <SectionShell>
      <div id="categories">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Categories</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Shop by category</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <article
              className="overflow-hidden rounded-[var(--store-border-radius)] border border-slate-200 bg-white shadow-sm"
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
                <h3 className="text-lg font-black tracking-[-0.03em] text-ink">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {category.description || "Explore products in this collection."}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function TestimonialsSection({ section }: { context: StoreTenantContext; section: StoreSection }) {
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 3) : [];
  const testimonials = items.length
    ? items
    : [
        { quote: "Fast ordering and a clean shopping experience.", name: "Happy customer" },
        { quote: "The catalog is simple to browse on mobile.", name: "Store shopper" }
      ];

  return (
    <SectionShell muted>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Testimonials</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">What customers notice</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {testimonials.map((item, index) => (
          <figure className="rounded-[var(--store-border-radius)] border border-slate-200 bg-white p-6" key={index}>
            <blockquote className="text-sm font-semibold leading-7 text-muted">
              “{textValue(item.quote, "Great store experience.")}”
            </blockquote>
            <figcaption className="mt-4 text-sm font-black text-ink">
              {textValue(item.name, "Customer")}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

function FaqSection({ section }: { context: StoreTenantContext; section: StoreSection }) {
  const items = Array.isArray(section.config.items) ? section.config.items.filter(isRecord).slice(0, 5) : [];
  const faqs = items.length
    ? items
    : [
        { answer: "Orders can be submitted through the store cart or WhatsApp when available.", question: "How do I order?" },
        { answer: "Products and checkout options are managed by the store owner.", question: "Are products updated live?" }
      ];

  return (
    <SectionShell>
      <div id="faq">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">FAQ</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Common questions</h2>
        <div className="mt-6 grid gap-3">
          {faqs.map((item, index) => (
            <details className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={index}>
              <summary className="cursor-pointer text-sm font-black text-ink">
                {textValue(item.question, "Question")}
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted">{textValue(item.answer, "Answer coming soon.")}</p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function CtaSection({ context, section }: { context: StoreTenantContext; section: StoreSection }) {
  const title = textValue(section.config.title, `Ready to shop ${context.settings.title}?`);
  const body = textValue(section.config.body, context.settings.description ?? "Browse the latest products and place your order.");

  return (
    <SectionShell muted>
      <div
        className="rounded-[var(--store-border-radius)] p-8 text-white sm:p-10"
        style={{ background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}, ${context.theme.colorPalette.secondary})` }}
      >
        <h2 className="text-3xl font-black tracking-[-0.04em]">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/75">{body}</p>
        <a className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950" href="#products">
          {context.preview.themeSettings.ctaText || "Shop now"}
        </a>
      </div>
    </SectionShell>
  );
}

function FooterSection({ context }: { context: StoreTenantContext; section: StoreSection }) {
  const theme = context.preview.themeSettings;

  return (
    <footer
      className="px-4 py-8 sm:px-6 lg:px-8"
      style={{
        backgroundColor: theme.footerBackgroundColor,
        color: theme.footerTextColor
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-bold">
          {theme.copyrightText || `© ${new Date().getFullYear()} ${context.settings.title}`}
        </p>
        <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">Powered by SHASTORE AI</p>
      </div>
    </footer>
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
