import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StoreTemplate } from "@/lib/template-studio/types";

export function StoreTemplateCard({
  basePath,
  template
}: {
  basePath: string;
  template: StoreTemplate;
}) {
  const featuredProducts = template.demoProducts.filter((product) => product.featured);

  return (
    <Card className="group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-slate-300">
      <div className="p-4">
        <div
          className="min-h-48 rounded-[1.75rem] p-4 text-white shadow-inner"
          style={{ background: template.previewGradient }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
              {template.categoryName}
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-900">
              {template.kind}
            </span>
          </div>
          <div className="mt-12 max-w-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
              {template.homepageText.eyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              {template.homepageText.headline}
            </h3>
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-5 pt-1">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
            {template.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{template.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {template.demoCategories.slice(0, 5).map((category) => (
            <span
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>
        <div className="grid gap-2">
          {featuredProducts.slice(0, 2).map((product) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
              key={product.name}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{product.name}</p>
                <p className="text-xs font-semibold text-muted">{product.category}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-ink">{product.price}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`${basePath}/studio/${template.id}`}>Customize</ButtonLink>
          <ButtonLink href={`${basePath}/preview/${template.id}`} variant="secondary">
            Preview
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
