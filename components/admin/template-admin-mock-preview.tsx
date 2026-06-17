import type { TemplatePreviewModel } from "@/src/lib/templates/template-preview-runtime";

function triStateLabel(value: boolean | "unknown") {
  if (value === true) return "Ready";
  if (value === false) return "Not ready";
  return "Unknown";
}

function MockProductCard({ index, templateName }: { index: number; templateName: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="aspect-[4/5] rounded-xl bg-[linear-gradient(135deg,#e2e8f0,#cbd5e1)]" />
      <p className="text-xs font-bold text-slate-900">Mock product {index}</p>
      <p className="text-[10px] font-semibold text-slate-500">{templateName} package metadata</p>
      <p className="text-xs font-black text-slate-950">$00.00</p>
    </div>
  );
}

export function TemplateAdminMockPreview({ model }: { model: TemplatePreviewModel }) {
  const { contents, packageName } = model.package;
  const heroGradient = model.screenshots[0]?.gradient ?? "linear-gradient(135deg,#0f172a,#2563eb 52%,#020617)";

  return (
    <div className="grid gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Safe mock storefront layout — metadata only
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            No customer store data, no installer execution, no storefront mutations.
          </p>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-950">{model.name}</p>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span>Home</span>
              {contents.products_count > 0 ? <span>Shop</span> : null}
              {contents.pages_count > 0 ? <span>Pages</span> : null}
              {contents.blog_posts_count > 0 ? <span>Blog</span> : null}
              {contents.faq_count > 0 ? <span>FAQ</span> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-4 lg:p-6">
          <section
            className="grid min-h-44 place-items-center rounded-[1.75rem] p-6 text-center text-white"
            style={{ background: heroGradient }}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{model.industry}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{model.name}</h2>
              <p className="mt-2 text-sm font-semibold text-white/80">{packageName} mock hero</p>
            </div>
          </section>

          {contents.categories_count > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.min(contents.categories_count, 8) }).map((_, index) => (
                  <span
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700"
                    key={`category-${index + 1}`}
                  >
                    Category {index + 1}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {contents.products_count > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Products ({contents.products_count})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: Math.min(contents.products_count, 8) }).map((_, index) => (
                  <MockProductCard index={index + 1} key={`product-${index + 1}`} templateName={model.name} />
                ))}
              </div>
            </section>
          ) : null}

          {contents.pages_count > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Pages ({contents.pages_count})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: Math.min(contents.pages_count, 4) }).map((_, index) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={`page-${index + 1}`}>
                    <p className="text-sm font-bold text-slate-950">Mock page {index + 1}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Package metadata placeholder content.</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {contents.blog_posts_count > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Blog ({contents.blog_posts_count})
              </h3>
              <div className="grid gap-2">
                {Array.from({ length: Math.min(contents.blog_posts_count, 3) }).map((_, index) => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4" key={`blog-${index + 1}`}>
                    <p className="text-sm font-bold text-slate-950">Mock blog post {index + 1}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Generated from package blog count only.</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {contents.faq_count > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">FAQ ({contents.faq_count})</h3>
              <div className="grid gap-2">
                {Array.from({ length: Math.min(contents.faq_count, 4) }).map((_, index) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" key={`faq-${index + 1}`}>
                    <p className="text-sm font-bold text-slate-950">Mock question {index + 1}?</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Mock answer from package metadata.</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Checkout mock</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Checkout readiness: {triStateLabel(contents.checkout_ready)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Navigation: {triStateLabel(contents.navigation_ready)} · Theme: {triStateLabel(contents.theme_ready)}
            </p>
          </section>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {model.screenshots.map((screenshot) => (
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white" key={screenshot.label}>
            <div
              className="min-h-36 bg-cover bg-center"
              style={
                screenshot.imageUrl
                  ? { backgroundImage: `linear-gradient(135deg,rgba(15,23,42,.35),rgba(15,23,42,.08)),url(${screenshot.imageUrl})` }
                  : { background: screenshot.gradient }
              }
            />
            <div className="px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{screenshot.label}</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                {screenshot.imageUrl ? "Registry screenshot metadata" : "Gradient placeholder"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
