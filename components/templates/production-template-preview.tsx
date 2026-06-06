import Link from "next/link";
import { SelectTemplateLink } from "@/components/templates/select-template-link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  templateLibraryBadges,
  templatePackageForRecord,
  templatePreviewSummary
} from "@/lib/storefront/template-preview-summary";
import type { StoreTemplateRecord } from "@/lib/storefront/template-library";

type PreviewDevice = "desktop" | "mobile" | "tablet";

function metricLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function templateVisualStyle(template: StoreTemplateRecord) {
  return {
    background: template.preview_image
      ? `linear-gradient(135deg,rgba(15,23,42,.62),rgba(15,23,42,.16)),url(${template.preview_image}) center/cover`
      : template.preview_gradient ?? "linear-gradient(135deg,#0f172a,#2563eb 52%,#020617)"
  };
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-700">
      {children}
    </span>
  );
}

function TemplateVisual({ template }: { template: StoreTemplateRecord }) {
  return (
    <div
      className="relative grid min-h-48 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-inner"
      style={templateVisualStyle(template)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
          {template.category}
        </span>
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-900">
          {template.template_type}
        </span>
      </div>
      <div className="mt-14 max-w-sm self-end">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
          {template.industry}
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
          {template.name}
        </h3>
      </div>
    </div>
  );
}

export function ProductionTemplateLibraryCard({
  createHref,
  isSelected = false,
  previewHref,
  template
}: {
  createHref: string;
  isSelected?: boolean;
  previewHref: string;
  template: StoreTemplateRecord;
}) {
  const templatePackage = templatePackageForRecord(template);
  const summary = templatePreviewSummary(template, templatePackage);
  const badges = templateLibraryBadges(template, summary);

  return (
    <Card className={`grid gap-4 overflow-hidden p-4 ${isSelected ? "ring-2 ring-slate-950" : ""}`}>
      <TemplateVisual template={template} />
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {template.category} / {template.category_key}
            </p>
            <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">
              {template.name}
            </h3>
          </div>
          {summary.hasPackage ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-700">
              Package v{summary.packageVersion}
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-muted">
          {template.preview_summary ?? template.description ?? "Storefront template"}
        </p>
        {badges.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-slate-400">Demo products</p>
          <p className="mt-1 text-sm font-black text-ink">{summary.productCount || "Pending"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-slate-400">Demo categories</p>
          <p className="mt-1 text-sm font-black text-ink">{summary.categoryCount || "Pending"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={previewHref} variant="secondary">
          Preview
        </ButtonLink>
        <SelectTemplateLink href={createHref}>
          Select template
        </SelectTemplateLink>
      </div>
    </Card>
  );
}

function PackageSummaryGrid({ template }: { template: StoreTemplateRecord }) {
  const templatePackage = templatePackageForRecord(template);
  const summary = templatePreviewSummary(template, templatePackage);
  const items = [
    ["Products", summary.productCount],
    ["Categories", summary.categoryCount],
    ["Pages", summary.customPageCount],
    ["Blog", summary.blogArticleCount],
    ["FAQ", summary.faqCount],
    ["Legal", summary.legalPageCount],
    ["Reviews", summary.reviewCount],
    ["AI slots", summary.aiVisualSlotCount]
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={label}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
            {value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProductGridPreview({ template }: { template: StoreTemplateRecord }) {
  const templatePackage = templatePackageForRecord(template);
  const products = templatePackage?.products?.slice(0, 6) ?? [];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Product grid preview
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
            {products.length ? metricLabel(products.length, "demo product") : "Product grid ready"}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          Shared product runtime
        </span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products.length ? products : [0, 1, 2]).map((product, index) => {
          const isRecord = typeof product === "object";
          const name = isRecord ? product.name : `Product slot ${index + 1}`;
          const category = isRecord ? product.categoryKey ?? "catalog" : "catalog";
          const price = isRecord ? product.price : "Price ready";

          return (
            <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50" key={name}>
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 via-white to-slate-200" />
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{category}</p>
                <h3 className="mt-2 text-base font-black text-ink">{name}</h3>
                <p className="mt-3 text-sm font-black text-ink">{price}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CategoryPreview({ template }: { template: StoreTemplateRecord }) {
  const templatePackage = templatePackageForRecord(template);
  const categories = templatePackage?.categories?.slice(0, 6) ?? [];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        Category preview
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
        {categories.length ? metricLabel(categories.length, "demo category", "demo categories") : "Category layout ready"}
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(categories.length ? categories : [0, 1, 2]).map((category, index) => {
          const isRecord = typeof category === "object";
          const name = isRecord ? category.name : `Category slot ${index + 1}`;
          const description = isRecord ? category.description : "Future package category slot.";

          return (
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4" key={name}>
              <div className="h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" />
              <h3 className="mt-4 text-base font-black text-ink">{name}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HomepagePreview({ template }: { template: StoreTemplateRecord }) {
  const templatePackage = templatePackageForRecord(template);
  const summary = templatePreviewSummary(template, templatePackage);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="p-4">
        <TemplateVisual template={template} />
      </div>
      <div className="grid gap-4 p-5 pt-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Homepage preview
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
            {template.name}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            {template.preview_summary ?? template.description}
          </p>
        </div>
        <div className="grid gap-2 text-sm font-bold text-slate-600">
          <span className="rounded-2xl bg-slate-50 px-4 py-3">
            {metricLabel(summary.homepageSectionCount, "homepage section")}
          </span>
          <span className="rounded-2xl bg-slate-50 px-4 py-3">
            {summary.hasAIVisualSupport ? "AI visual slots supported" : "AI visual slots pending"}
          </span>
        </div>
      </div>
    </section>
  );
}

function MobilePreviewFrame({ template }: { template: StoreTemplateRecord }) {
  const templatePackage = templatePackageForRecord(template);
  const firstProducts = templatePackage?.products?.slice(0, 3) ?? [];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-slate-100 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        Mobile preview
      </p>
      <div className="mx-auto mt-4 w-[240px] overflow-hidden rounded-[2rem] border border-slate-300 bg-white shadow-xl">
        <div className="p-3">
          <div className="h-28 rounded-[1.5rem]" style={templateVisualStyle(template)} />
          <div className="mt-3 grid gap-2">
            {(firstProducts.length ? firstProducts : [0, 1, 2]).map((product, index) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={typeof product === "object" ? product.name : index}>
                <div className="h-2 w-20 rounded-full bg-slate-200" />
                <div className="mt-2 h-2 w-28 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductionTemplatePreview({
  backHref,
  createHref,
  device = "desktop",
  template
}: {
  backHref: string;
  createHref: string;
  device?: PreviewDevice;
  template: StoreTemplateRecord;
}) {
  const templatePackage = templatePackageForRecord(template);
  const summary = templatePreviewSummary(template, templatePackage);
  const badges = templateLibraryBadges(template, summary);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-black text-muted transition hover:text-ink" href={backHref}>
            Back to templates
          </Link>
          <div className="flex flex-wrap gap-2">
            {(["desktop", "tablet", "mobile"] as const).map((item) => (
              <Link
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                  item === device ? "bg-slate-950 text-white" : "bg-white text-muted"
                }`}
                href={`?device=${item}`}
                key={item}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

        <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {template.category} / {template.industry}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
              {template.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted">
              {template.preview_summary ?? template.description}
            </p>
            {badges.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {badges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
              </div>
            ) : null}
          </div>
          <ButtonLink href={createHref}>Select template</ButtonLink>
        </section>

        <PackageSummaryGrid template={template} />

        <div className={device === "mobile" ? "mx-auto grid w-full max-w-sm gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"}>
          <div className="grid gap-5">
            <HomepagePreview template={template} />
            <ProductGridPreview template={template} />
            <CategoryPreview template={template} />
          </div>
          <MobilePreviewFrame template={template} />
        </div>

        <Card className="border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-black text-blue-900">
            Package summary behavior
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
            Counts come from the shared template package registry when a package exists. Templates without a package still show the same preview structure with pending counts and blueprint-driven AI visual support.
          </p>
        </Card>
      </div>
    </main>
  );
}
