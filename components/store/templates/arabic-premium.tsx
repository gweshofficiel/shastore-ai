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

export function ArabicPremiumTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#120d08] text-white" dir="rtl">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(245,158,11,0.22),transparent_30%),radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.08),transparent_28%)]" />
      <StoreHeader
        accentClassName="text-amber-200/70"
        className="border-amber-200/15 bg-[#120d08]/78 text-white"
        ctaClassName="bg-amber-300 text-stone-950 shadow-[0_18px_55px_-30px_rgba(251,191,36,0.9)]"
        logoClassName="h-11 w-11 rounded-2xl"
        store={store}
        textClassName="text-white"
      />
      <section className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="lg:order-2">
            <p className="inline-flex rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-amber-100">
              Premium majlis
            </p>
            <h1 className="mt-6 text-6xl font-black tracking-[-0.07em] sm:text-7xl lg:text-8xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-amber-50/70">
              {heroSubtitle(
                store,
                "An elegant RTL-ready storefront for premium products, refined categories, and direct WhatsApp ordering."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-300 px-7 text-sm font-black text-stone-950 transition hover:-translate-y-1"
                href="#products"
              >
                View collection
              </a>
              <WhatsAppButton
                className="inline-flex h-12 items-center justify-center rounded-full border border-amber-200/30 px-7 text-sm font-black text-amber-100 transition hover:-translate-y-1 hover:bg-white/10"
                store={store}
              >
                WhatsApp order
              </WhatsAppButton>
            </div>
          </div>
          <div className="lg:order-1">
            <div className="relative rounded-[3.2rem] border border-amber-200/15 bg-white/[0.055] p-4 shadow-2xl shadow-black/45 backdrop-blur">
              <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full border border-amber-200/20" />
              <StoreImage
                alt={heroProduct.name}
                className="aspect-[4/5] w-full rounded-[2.55rem] object-cover"
                fallbackClassName="aspect-[4/5] rounded-[2.55rem] bg-[linear-gradient(145deg,#3f2d15,#120d08)] text-amber-100"
                label={heroProduct.name}
                src={heroProduct.imageUrl}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.7rem] bg-amber-300 p-5 text-stone-950">
                  <p className="text-xs font-black uppercase tracking-[0.2em]">Featured</p>
                  <p className="mt-2 text-xl font-black tracking-[-0.04em]">{heroProduct.name}</p>
                </div>
                <div className="rounded-[1.7rem] border border-amber-200/15 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/55">
                    Price
                  </p>
                  <p className="mt-2 text-xl font-black text-amber-100">
                    {heroProduct.price || store.currency}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="relative px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            dark
            description="RTL-optimized category blocks with luxury spacing and warm editorial color."
            eyebrow="Collections"
            title="Curated departments"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {categories.slice(0, 6).map((category) => (
              <article
                className="group rounded-[2.5rem] border border-amber-200/12 bg-white/[0.055] p-4 transition hover:-translate-y-1 hover:bg-white/[0.08]"
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-[4/3] w-full rounded-[2rem] object-cover"
                  fallbackClassName="aspect-[4/3] rounded-[2rem] bg-amber-200/10 text-amber-100"
                  label={category.name}
                  src={category.imageUrl}
                />
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em]">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-amber-50/60">
                  {category.description || "Explore premium products in this department."}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro dark eyebrow="Catalog" title="Signature products" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article
                className="rounded-[2.25rem] border border-amber-200/12 bg-white/[0.055] p-3 transition hover:-translate-y-1 hover:border-amber-200/35"
                key={product.id}
              >
                <StoreImage
                  alt={product.name}
                  className="aspect-[4/5] w-full rounded-[1.75rem] object-cover"
                  fallbackClassName="aspect-[4/5] rounded-[1.75rem] bg-black/25 text-amber-100"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                    <PriceTag className="bg-amber-300 text-stone-950">
                      {product.price || store.currency}
                    </PriceTag>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-amber-50/55">
                    {product.description || "Ask for details and availability."}
                  </p>
                  <WhatsAppButton
                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-black text-stone-950 transition hover:bg-amber-300"
                    store={store}
                    text={`Hi, I want ${product.name}`}
                  >
                    Order
                  </WhatsAppButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="relative border-t border-amber-200/10 bg-black/15 text-white" store={store} />
    </main>
  );
}
