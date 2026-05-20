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

export function TikTokProductTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 10);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <StoreHeader
        accentClassName="text-pink-500"
        className="border-slate-200 bg-white/86 text-slate-950"
        ctaClassName="bg-slate-950 text-white shadow-[0_18px_55px_-30px_rgba(15,23,42,0.9)]"
        logoClassName="h-11 w-11 rounded-2xl"
        store={store}
      />
      <section className="overflow-hidden bg-[linear-gradient(135deg,#fff,#ecfeff,#fdf2f8)] px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-pink-500 shadow-sm">
              Viral storefront
            </p>
            <h1 className="mt-6 text-6xl font-black tracking-[-0.075em] sm:text-7xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {heroSubtitle(
                store,
                `${store.name} brings fast product discovery, social-proof cards, and one-tap WhatsApp ordering.`
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-7 text-sm font-black text-white transition hover:-translate-y-1" href="#products">
                Shop trending
              </a>
              <WhatsAppButton className="inline-flex h-12 items-center justify-center rounded-full bg-pink-500 px-7 text-sm font-black text-white transition hover:-translate-y-1" store={store}>
                DM on WhatsApp
              </WhatsAppButton>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-cyan-300 blur-3xl" />
            <div className="absolute -right-8 bottom-10 h-32 w-32 rounded-full bg-pink-400 blur-3xl" />
            <article className="relative rounded-[3rem] border-8 border-slate-950 bg-slate-950 p-3 shadow-[0_45px_120px_-60px_rgba(15,23,42,0.95)]">
              <StoreImage
                alt={heroProduct.name}
                className="aspect-[9/16] w-full rounded-[2.1rem] object-cover"
                fallbackClassName="aspect-[9/16] rounded-[2.1rem] bg-[linear-gradient(135deg,#cffafe,#fce7f3)] text-slate-950"
                label={heroProduct.name}
                src={heroProduct.imageUrl}
              />
              <div className="absolute bottom-7 left-7 right-7 rounded-3xl bg-white/90 p-4 backdrop-blur">
                <h2 className="font-black tracking-[-0.03em]">{heroProduct.name}</h2>
                <div className="mt-2 flex items-center justify-between">
                  <PriceTag className="bg-pink-500 text-white">{heroProduct.price || store.currency}</PriceTag>
                  <span className="text-xs font-black text-slate-500">Tap to order</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-3 overflow-x-auto pb-3">
            {categories.map((category) => (
              <a
                className="min-w-[220px] rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                href="#products"
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-video w-full rounded-[1.4rem] object-cover"
                  fallbackClassName="aspect-video rounded-[1.4rem] bg-slate-100 text-slate-500"
                  label={category.name}
                  src={category.imageUrl}
                />
                <p className="mt-4 font-black">{category.name}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-14 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro align="center" eyebrow="Trending now" title="Swipe-worthy products" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {products.map((product) => (
              <article className="group rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-100" key={product.id}>
                <StoreImage
                  alt={product.name}
                  className="aspect-[4/5] w-full rounded-[1.5rem] object-cover"
                  fallbackClassName="aspect-[4/5] rounded-[1.5rem] bg-gradient-to-br from-cyan-50 to-pink-50 text-slate-500"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-3">
                  <h3 className="line-clamp-1 font-black">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                    {product.description || "Quick order, quick reply."}
                  </p>
                  <WhatsAppButton
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white transition hover:bg-pink-500"
                    store={store}
                    text={`Hi, I want ${product.name}`}
                  >
                    {product.price || store.currency}
                  </WhatsAppButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="border-t border-slate-200 bg-white" store={store} />
    </main>
  );
}
