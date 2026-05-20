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

export function MinimalCleanTemplate({ store }: StoreTemplateProps) {
  const categories = getCategories(store);
  const products = getFeaturedProducts(store, 9);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#fbfbf8] text-slate-950">
      <StoreHeader
        accentClassName="text-slate-400"
        className="border-slate-200/80 bg-[#fbfbf8]/85 text-slate-950"
        ctaClassName="bg-slate-950 text-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.9)]"
        logoClassName="h-10 w-10 rounded-full"
        store={store}
      />
      <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                Clean catalog
              </p>
              <h1 className="mt-5 text-6xl font-black tracking-[-0.08em] sm:text-7xl lg:text-8xl">
                {heroTitle(store)}
              </h1>
            </div>
            <div className="max-w-2xl lg:ml-auto">
              <p className="text-lg leading-8 text-slate-600">
                {heroSubtitle(
                  store,
                  "A calm, premium storefront with clear categories, focused products, and direct WhatsApp ordering."
                )}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-950 px-6 text-sm font-black transition hover:bg-slate-950 hover:text-white"
                  href="#products"
                >
                  View products
                </a>
                <WhatsAppButton
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white transition hover:-translate-y-0.5"
                  store={store}
                >
                  Order now
                </WhatsAppButton>
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <StoreImage
              alt={heroProduct.name}
              className="aspect-[16/10] w-full rounded-[2.5rem] object-cover shadow-[0_35px_100px_-70px_rgba(15,23,42,0.6)]"
              fallbackClassName="aspect-[16/10] rounded-[2.5rem] bg-slate-100 text-slate-500"
              label={heroProduct.name}
              src={heroProduct.imageUrl}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {categories.slice(0, 2).map((category) => (
                <article
                  className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/70"
                  key={category.id}
                >
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                    Category
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">
                    {category.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {category.description || "Simple discovery for this collection."}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            description="A measured, grid-based category system that lets every collection breathe."
            eyebrow="Collections"
            title="Browse with clarity"
          />
          <div className="mt-8 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <article className="bg-white p-6 transition hover:bg-slate-50" key={category.id}>
                <StoreImage
                  alt={category.name}
                  className="aspect-[4/3] w-full rounded-[1.4rem] object-cover"
                  fallbackClassName="aspect-[4/3] rounded-[1.4rem] bg-slate-100 text-slate-500"
                  label={category.name}
                  src={category.imageUrl}
                />
                <h3 className="mt-5 text-lg font-black tracking-[-0.03em]">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {category.description || "Curated products for easy shopping."}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-14 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro align="center" eyebrow="Products" title="Focused product selection" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article
                className="group rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-55px_rgba(15,23,42,0.7)]"
                key={product.id}
              >
                <StoreImage
                  alt={product.name}
                  className="aspect-square w-full rounded-[1.5rem] object-cover"
                  fallbackClassName="aspect-square rounded-[1.5rem] bg-slate-100 text-slate-500"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-black tracking-[-0.035em]">{product.name}</h3>
                    <PriceTag className="bg-slate-100 text-slate-950">
                      {product.price || store.currency}
                    </PriceTag>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                    {product.description || "Message the store for details and availability."}
                  </p>
                  <WhatsAppButton
                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800"
                    store={store}
                    text={`Hi, I want ${product.name}`}
                  >
                    Order on WhatsApp
                  </WhatsAppButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-slate-950 p-8 text-white lg:p-12">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                Direct commerce
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
                Ready to order from {store.name}?
              </h2>
            </div>
            <WhatsAppButton
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-slate-950 transition hover:-translate-y-1"
              store={store}
            >
              Start WhatsApp order
            </WhatsAppButton>
          </div>
        </div>
      </section>
      <StoreFooter className="border-t border-slate-200 bg-[#fbfbf8]" store={store} />
    </main>
  );
}
