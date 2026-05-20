import {
  PriceTag,
  SectionIntro,
  StoreFooter,
  StoreHeader,
  StoreImage,
  StoreLogo,
  WhatsAppButton,
  getCategories,
  getFeaturedProducts,
  heroSubtitle,
  heroTitle,
  type StoreTemplateProps
} from "@/components/store/templates/shared";

export function BeautyGlowTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7fb] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(244,114,182,0.2),transparent_28%),radial-gradient(circle_at_90%_12%,rgba(251,207,232,0.55),transparent_30%)]" />
      <StoreHeader
        accentClassName="text-rose-400"
        className="border-rose-100 bg-[#fff7fb]/80 text-slate-950"
        ctaClassName="bg-rose-500 text-white shadow-[0_20px_55px_-30px_rgba(244,63,94,0.9)]"
        logoClassName="h-11 w-11 rounded-[1.25rem]"
        store={store}
      />
      <section className="relative px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-rose-500 shadow-sm ring-1 ring-rose-100 backdrop-blur">
              Beauty glow
            </p>
            <h1 className="mt-6 text-6xl font-black tracking-[-0.075em] sm:text-7xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {heroSubtitle(
                store,
                "A polished beauty storefront with glowing product moments, gentle color, and WhatsApp-assisted shopping."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-7 text-sm font-black text-white transition hover:-translate-y-1"
                href="#products"
              >
                Shop the glow
              </a>
              <WhatsAppButton
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-rose-600 shadow-xl shadow-rose-100 transition hover:-translate-y-1"
                store={store}
              >
                Ask a specialist
              </WhatsAppButton>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-8 top-8 h-40 w-40 rounded-full bg-rose-300/40 blur-3xl" />
            <div className="absolute -bottom-8 right-6 h-48 w-48 rounded-full bg-fuchsia-200/60 blur-3xl" />
            <div className="relative grid gap-4 sm:grid-cols-[0.8fr_1.2fr] sm:items-end">
              <div className="hidden rounded-[2rem] border border-white/80 bg-white/60 p-5 shadow-2xl shadow-rose-100 backdrop-blur sm:block">
                <StoreLogo className="h-14 w-14 rounded-2xl" store={store} />
                <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-rose-400">
                  Curated
                </p>
                <p className="mt-2 text-2xl font-black tracking-[-0.05em]">{categories.length}+ rituals</p>
              </div>
              <article className="overflow-hidden rounded-[3rem] border border-white/90 bg-white/65 p-4 shadow-[0_45px_120px_-70px_rgba(244,63,94,0.75)] backdrop-blur">
                <StoreImage
                  alt={heroProduct.name}
                  className="aspect-[4/5] w-full rounded-[2.35rem] object-cover"
                  fallbackClassName="aspect-[4/5] rounded-[2.35rem] bg-gradient-to-br from-rose-100 to-fuchsia-100 text-rose-500"
                  label={heroProduct.name}
                  src={heroProduct.imageUrl}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-2xl font-black tracking-[-0.05em]">{heroProduct.name}</h2>
                    <PriceTag className="bg-rose-100 text-rose-700">
                      {heroProduct.price || store.currency}
                    </PriceTag>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
      <section className="relative px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            align="center"
            description="Category cards use soft shadows, glowing imagery, and airy spacing for a premium beauty rhythm."
            eyebrow="Rituals"
            title="Shop by beauty mood"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 6).map((category) => (
              <article
                className="group overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/70 p-3 shadow-xl shadow-rose-100/70 backdrop-blur transition duration-300 hover:-translate-y-1"
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-[5/4] w-full rounded-[2rem] object-cover transition duration-500 group-hover:scale-[1.04]"
                  fallbackClassName="aspect-[5/4] rounded-[2rem] bg-gradient-to-br from-rose-100 to-white text-rose-500"
                  label={category.name}
                  src={category.imageUrl}
                />
                <div className="p-5">
                  <h3 className="text-xl font-black tracking-[-0.04em]">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {category.description || "A curated glow edit for this collection."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl rounded-[3rem] bg-white/60 p-4 shadow-2xl shadow-rose-100/80 backdrop-blur sm:p-8">
          <SectionIntro eyebrow="Best sellers" title="Glow-ready products" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article
                className="group rounded-[2.25rem] bg-white p-3 shadow-sm ring-1 ring-rose-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-100"
                key={product.id}
              >
                <StoreImage
                  alt={product.name}
                  className="aspect-square w-full rounded-[1.8rem] object-cover"
                  fallbackClassName="aspect-square rounded-[1.8rem] bg-rose-50 text-rose-400"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-4">
                  <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                    {product.description || "Message for shade, size, and availability."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="font-black text-rose-600">{product.price || store.currency}</p>
                    <WhatsAppButton
                      className="rounded-full bg-rose-500 px-4 py-2 text-xs font-black text-white transition hover:bg-rose-600"
                      store={store}
                      text={`Hi, I want ${product.name}`}
                    >
                      Buy
                    </WhatsAppButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto max-w-5xl rounded-[3rem] bg-gradient-to-br from-rose-500 to-fuchsia-500 p-8 text-center text-white shadow-[0_40px_110px_-70px_rgba(244,63,94,1)] lg:p-12">
          <h2 className="text-4xl font-black tracking-[-0.05em]">Build your cart with a beauty assistant.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/80">
            Confirm products, ask recommendations, and place a direct order through WhatsApp.
          </p>
          <WhatsAppButton
            className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-black text-rose-600 transition hover:-translate-y-1"
            store={store}
          >
            Message on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
      <StoreFooter className="relative border-t border-rose-100 bg-[#fff7fb]" store={store} />
    </main>
  );
}
