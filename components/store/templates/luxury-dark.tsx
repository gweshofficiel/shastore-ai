import {
  PriceTag,
  SectionIntro,
  StoreFooter,
  StoreHeader,
  StoreImage,
  StoreLogo,
  WhatsAppButton,
  cn,
  getCategories,
  getFeaturedProducts,
  getHeroProduct,
  heroSubtitle,
  heroTitle,
  type StoreTemplateProps
} from "@/components/store/templates/shared";

export function LuxuryDarkTemplate({ store }: StoreTemplateProps) {
  const heroProduct = getHeroProduct(store);
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);

  return (
    <main className="min-h-screen bg-[#090806] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(245,197,107,0.18),transparent_30%),radial-gradient(circle_at_88%_6%,rgba(255,255,255,0.08),transparent_24%)]" />
      <StoreHeader
        accentClassName="text-amber-200/70"
        className="border-amber-200/10 bg-[#090806]/75 text-white"
        ctaClassName="bg-amber-200 text-stone-950 shadow-[0_18px_45px_-22px_rgba(251,191,36,0.9)]"
        logoClassName="h-11 w-11 rounded-2xl"
        store={store}
        textClassName="text-white"
      />
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-amber-200/20 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-amber-100/70 backdrop-blur">
              Private catalog
            </div>
            <h1 className="mt-6 max-w-4xl text-6xl font-black tracking-[-0.075em] text-white sm:text-7xl lg:text-8xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
              {heroSubtitle(
                store,
                "A curated luxury storefront for premium collections, direct conversations, and fast WhatsApp ordering."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-stone-950 shadow-[0_24px_70px_-32px_rgba(255,255,255,0.8)] transition hover:-translate-y-1"
                href="#products"
              >
                Explore collection
              </a>
              <WhatsAppButton
                className="inline-flex h-12 items-center justify-center rounded-full border border-amber-200/30 px-7 text-sm font-black text-amber-100 transition hover:-translate-y-1 hover:bg-amber-200 hover:text-stone-950"
                store={store}
                text={`Hi, I want to shop ${store.name}`}
              >
                Concierge order
              </WhatsAppButton>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[3rem] bg-amber-200/10 blur-3xl" />
            <article className="relative overflow-hidden rounded-[3rem] border border-amber-200/15 bg-white/[0.06] p-4 shadow-2xl shadow-black/50 backdrop-blur">
              <StoreImage
                alt={heroProduct.name}
                className="aspect-[4/5] w-full rounded-[2.35rem] object-cover"
                fallbackClassName="aspect-[4/5] rounded-[2.35rem] bg-[linear-gradient(135deg,#2f2416,#0f0d0a)] text-amber-100"
                label={heroProduct.name}
                src={heroProduct.imageUrl}
              />
              <div className="absolute bottom-8 left-8 right-8 rounded-[2rem] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/60">
                  Featured
                </p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <h2 className="text-2xl font-black tracking-[-0.04em]">{heroProduct.name}</h2>
                  <PriceTag className="bg-amber-200 text-stone-950">
                    {heroProduct.price || store.currency}
                  </PriceTag>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="relative px-4 py-12 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            dark
            description="Browse refined departments designed to make discovery feel calm, selective, and personal."
            eyebrow="Departments"
            title="Shop by atmosphere"
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {categories.slice(0, 3).map((category, index) => (
              <article
                className={cn(
                  "group overflow-hidden rounded-[2.5rem] border border-amber-100/10 bg-white/[0.055] p-3 shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1",
                  index === 0 && "md:col-span-2"
                )}
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-[16/10] w-full rounded-[2rem] object-cover transition duration-500 group-hover:scale-[1.03]"
                  fallbackClassName="aspect-[16/10] rounded-[2rem] bg-white/5 text-amber-100"
                  label={category.name}
                  src={category.imageUrl}
                />
                <div className="p-4">
                  <h3 className="text-xl font-black tracking-[-0.03em]">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    {category.description || "Premium picks selected for this collection."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro dark eyebrow="Catalog" title="Featured pieces" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article
                className="group overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.055] p-3 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08]"
                key={product.id}
              >
                <StoreImage
                  alt={product.name}
                  className="aspect-[4/5] w-full rounded-[1.75rem] object-cover transition duration-500 group-hover:scale-[1.04]"
                  fallbackClassName="aspect-[4/5] rounded-[1.75rem] bg-stone-900 text-amber-100"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-4">
                  <h3 className="text-lg font-black tracking-[-0.03em]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-400">
                    {product.description || "Ask for availability, details, and delivery."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="font-black text-amber-100">{product.price || store.currency}</p>
                    <WhatsAppButton
                      className="rounded-full bg-white px-4 py-2 text-xs font-black text-stone-950 transition hover:bg-amber-200"
                      store={store}
                      text={`Hi, I want ${product.name}`}
                    >
                      Order
                    </WhatsAppButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto max-w-5xl rounded-[3rem] border border-amber-100/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(245,158,11,0.12))] p-8 text-center shadow-2xl shadow-black/35 backdrop-blur lg:p-12">
          <StoreLogo className="mx-auto h-16 w-16 rounded-3xl text-lg" store={store} />
          <h2 className="mt-6 text-4xl font-black tracking-[-0.05em]">Order with concierge care.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-stone-300">
            Message the store to reserve items, ask for details, or complete a premium WhatsApp order.
          </p>
          <WhatsAppButton
            className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-amber-200 px-8 text-sm font-black text-stone-950 transition hover:-translate-y-1"
            store={store}
          >
            Message on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
      <StoreFooter className="relative border-t border-white/10 bg-black/20 text-white" store={store} />
    </main>
  );
}
