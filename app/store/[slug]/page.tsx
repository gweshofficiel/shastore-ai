import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontTenantContextScript } from "@/lib/storefront/context";
import {
  getCurrentStoreContext,
  resolveTenantStore
} from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await resolveTenantStore({ slug, source: "slug" });
  const preview = context?.preview;

  if (!preview) {
    return {
      title: "Store not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const title = preview.store.title;
  const description =
    preview.store.description ||
    `Preview ${preview.store.title}, powered by SHASTORE AI.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: preview.store.title,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    },
    robots: { index: true, follow: true }
  };
}

export default async function PublicStorePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getCurrentStoreContext(slug);
  const preview = context?.preview;

  if (!preview || !context) {
    notFound();
  }

  const { branding, products, store } = preview;
  const heroBackground = `radial-gradient(circle at 20% 10%, ${branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${branding.primaryColor}, #020617)`;

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <StorefrontTenantContextScript context={context} />
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                SHASTORE AI Store
              </p>
              <p className="mt-1 text-sm font-black text-ink">{store.title}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
              Preview
            </span>
          </header>

          <div
            className="overflow-hidden rounded-[2.5rem] px-6 py-16 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] sm:px-10 lg:px-14 lg:py-24"
            style={{ background: heroBackground }}
          >
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">
                Public Storefront
              </p>
              <h1 className="mt-5 text-5xl font-black leading-none tracking-[-0.07em] sm:text-7xl lg:text-8xl">
                {store.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/75 sm:text-lg">
                {store.description ||
                  "A clean SHASTORE AI storefront preview for this claimed store."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950">
                  Browse products
                </span>
                <span className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white/80">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
              Products shown here are published products scoped to this store only.
            </p>
          </div>

          {products.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:border-slate-300"
                  key={product.id}
                >
                  <div
                    className="mb-5 flex aspect-[4/3] items-end rounded-[1.5rem] p-5"
                    style={{
                      background: `linear-gradient(135deg, ${branding.primaryColor}16, ${branding.secondaryColor}24)`
                    }}
                  >
                    <span
                      className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      Product
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                    {product.title}
                  </h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
                    {product.description || "No description has been added for this product yet."}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                    <p className="text-lg font-black text-ink">
                      {product.priceLabel ||
                        (product.price === null || product.price === undefined
                          ? "Price coming soon"
                          : new Intl.NumberFormat("en", {
                              currency: "USD",
                              style: "currency"
                            }).format(Number(product.price)))}
                    </p>
                    {product.sku ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        {product.sku}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
                Products coming soon
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                This store is live, but no products are published yet. Draft products stay
                hidden until the store owner publishes them.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
