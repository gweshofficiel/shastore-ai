import {
  PriceTag,
  SectionIntro,
  StoreFooter,
  StoreHeader,
  StoreImage,
  WhatsAppButton,
  getCategories,
  getFeaturedProducts,
  heroSubtitle,
  heroTitle,
  type StoreTemplateProps
} from "@/components/store/templates/shared";

export function ModernGradientTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#10111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.28),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(236,72,153,0.24),transparent_28%),linear-gradient(135deg,#10111f,#1e1b4b_55%,#111827)]" />
      <StoreHeader
        accentClassName="text-violet-200/70"
        className="border-white/10 bg-[#10111f]/70 text-white"
        ctaClassName="bg-white text-slate-950 shadow-[0_24px_70px_-35px_rgba(255,255,255,0.8)]"
        logoClassName="h-11 w-11 rounded-2xl"
        store={store}
        textClassName="text-white"
      />
      <section className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-white/70 backdrop-blur">
              Modern commerce
            </p>
            <h1 className="mt-6 max-w-4xl text-6xl font-black tracking-[-0.075em] sm:text-7xl lg:text-8xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              {heroSubtitle(
                store,
                "A polished gradient storefront with cinematic sections, premium product cards, and direct WhatsApp conversion."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-slate-950 transition hover:-translate-y-1" href="#products">
                Explore products
              </a>
              <WhatsAppButton className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-400 to-pink-400 px-7 text-sm font-black text-white shadow-[0_18px_55px_-25px_rgba(236,72,153,0.8)] transition hover:-translate-y-1" store={store}>
                Chat to order
              </WhatsAppButton>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <article className="rounded-[2.75rem] border border-white/10 bg-white/10 p-3 shadow-2xl shadow-black/30 backdrop-blur">
              <StoreImage alt={heroProduct.name} className="aspect-[4/5] w-full rounded-[2.2rem] object-cover" fallbackClassName="aspect-[4/5] rounded-[2.2rem] bg-white/10 text-white" label={heroProduct.name} src={heroProduct.imageUrl} />
              <div className="p-4">
                <h2 className="text-xl font-black tracking-[-0.04em]">{heroProduct.name}</h2>
                <PriceTag className="mt-3 inline-flex bg-white text-slate-950">{heroProduct.price || store.currency}</PriceTag>
              </div>
            </article>
            <div className="grid gap-4">
              {categories.slice(0, 2).map((category) => (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.075] p-5 backdrop-blur" key={category.id}>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">Category</p>
                  <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">{category.description || "Curated products."}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="relative px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl rounded-[3rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur lg:p-8">
          <SectionIntro dark align="center" eyebrow="Collections" title="Gradient category worlds" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {categories.slice(0, 4).map((category) => (
              <article className="overflow-hidden rounded-[2rem] bg-white/10 p-3 transition hover:-translate-y-1" key={category.id}>
                <StoreImage alt={category.name} className="aspect-[4/3] w-full rounded-[1.5rem] object-cover" fallbackClassName="aspect-[4/3] rounded-[1.5rem] bg-white/10 text-white" label={category.name} src={category.imageUrl} />
                <h3 className="p-4 font-black tracking-[-0.03em]">{category.name}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro dark eyebrow="Catalog" title="Premium product cards" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article className="group rounded-[2.25rem] border border-white/10 bg-white/[0.075] p-3 backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.11]" key={product.id}>
                <StoreImage alt={product.name} className="aspect-square w-full rounded-[1.75rem] object-cover" fallbackClassName="aspect-square rounded-[1.75rem] bg-white/10 text-white" label={product.name} src={product.imageUrl} />
                <div className="p-4">
                  <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">{product.description || "Ask the store for details."}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="font-black">{product.price || store.currency}</p>
                    <WhatsAppButton className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-pink-200" store={store} text={`Hi, I want ${product.name}`}>
                      Order
                    </WhatsAppButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="relative border-t border-white/10 bg-black/20 text-white" store={store} />
    </main>
  );
}
