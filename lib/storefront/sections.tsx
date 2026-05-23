import type { ReactNode } from "react";
import Link from "next/link";
import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVisualBuilderPayload,
  loadVisualEditorState,
  resolveBuilderSections
} from "@/lib/storefront/builder";

export type StoreSectionType =
  | "hero"
  | "banner"
  | "product_grid"
  | "featured_products"
  | "rich_text"
  | "image"
  | "CTA"
  | "testimonials"
  | "newsletter"
  | "spacer";

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
  "banner",
  "product_grid",
  "featured_products",
  "rich_text",
  "image",
  "CTA",
  "testimonials",
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

  return {
    builderPreview,
    key: context.theme.layout_key,
    sections
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

function ProductGridSection({ context }: { context: StoreTenantContext }) {
  const products = context.preview.products.slice(0, 6);

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
      {products.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
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
                    <Link
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-slate-300 hover:bg-slate-50"
                      href={`/store/${context.preview.store.slug}/product/${encodeURIComponent(product.id)}`}
                    >
                      View product details
                    </Link>
                    {whatsappHref ? (
                      <a
                        className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                        href={whatsappHref}
                        rel="noreferrer"
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
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No products yet
          </h3>
        </div>
      )}
    </SectionShell>
  );
}

export function SectionRenderer({
  context,
  section
}: {
  context: StoreTenantContext;
  section: StoreSection;
}) {
  const config = section.config;
  const title = textValue(config.title, context.settings.title);
  const body = textValue(config.body, context.settings.description ?? "");

  if (section.section_type === "spacer") {
    return <div aria-hidden="true" className="h-8 sm:h-12" />;
  }

  if (section.section_type === "product_grid" || section.section_type === "featured_products") {
    return <ProductGridSection context={context} />;
  }

  if (section.section_type === "hero") {
    return (
      <SectionShell muted>
        <div
          className="rounded-[2.5rem] px-6 py-16 text-white sm:px-10 lg:px-14"
          style={{
            background: `linear-gradient(135deg, ${context.theme.colorPalette.primary}, ${context.theme.colorPalette.secondary})`
          }}
        >
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            Public Storefront
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-[-0.07em] sm:text-7xl">
            {title}
          </h1>
          {body ? <p className="mt-5 max-w-2xl text-white/75">{body}</p> : null}
        </div>
      </SectionShell>
    );
  }

  if (section.section_type === "image") {
    const imageUrl = textValue(config.imageUrl);

    return (
      <SectionShell>
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm font-black text-ink">
            {imageUrl ? `Image section prepared: ${imageUrl}` : "Image section placeholder"}
          </p>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell muted={section.section_type === "banner" || section.section_type === "newsletter"}>
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          {resolveSectionRenderer(section).replace("_", " ")}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">{title}</h2>
        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{body}</p> : null}
      </div>
    </SectionShell>
  );
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
