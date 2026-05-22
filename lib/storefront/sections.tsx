import type { ReactNode } from "react";
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
          Products are still loaded through the existing tenant-scoped storefront foundation.
        </p>
      </div>
      {products.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article className="rounded-[2rem] border border-slate-200 bg-white p-5" key={product.id}>
              <h3 className="text-xl font-black tracking-[-0.03em] text-ink">{product.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                {product.description || "No description has been added for this product yet."}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Products coming soon
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
