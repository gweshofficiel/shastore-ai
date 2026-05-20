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

export function FashionEditorialTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#f6f0e8] text-zinc-950">
      <StoreHeader
        accentClassName="text-zinc-500"
        className="border-zinc-950/10 bg-[#f6f0e8]/82 text-zinc-950"
        ctaClassName="bg-zinc-950 text-white shadow-[0_20px_55px_-30px_rgba(24,24,27,0.9)]"
        logoClassName="h-11 w-11 rounded-none"
        store={store}
      />
      <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.55fr_1.1fr_0.55fr] lg:items-center">
            <div className="border-y border-zinc-950/15 py-8">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
                Editorial store
              </p>
              <p className="mt-6 text-sm leading-7 text-zinc-600">
                {heroSubtitle(
                  store,
                  "A fashion-first storefront with magazine rhythm and direct WhatsApp conversion."
                )}
              </p>
            </div>
            <div className="text-center">
              <h1 className="text-6xl font-black uppercase leading-[0.85] tracking-[-0.08em] sm:text-8xl lg:text-9xl">
                {heroTitle(store)}
              </h1>
              <div className="mt-8 flex justify-center gap-3">
                <a
                  className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-7 text-sm font-black text-white transition hover:-translate-y-1"
                  href="#products"
                >
                  Shop edit
                </a>
                <WhatsAppButton
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-950 px-7 text-sm font-black transition hover:-translate-y-1 hover:bg-zinc-950 hover:text-white"
                  store={store}
                >
                  Contact stylist
                </WhatsAppButton>
              </div>
            </div>
            <StoreImage
              alt={heroProduct.name}
              className="aspect-[3/4] w-full rounded-t-full object-cover shadow-[0_35px_100px_-70px_rgba(24,24,27,0.8)]"
              fallbackClassName="aspect-[3/4] rounded-t-full bg-zinc-200 text-zinc-500"
              label={heroProduct.name}
              src={heroProduct.imageUrl}
            />
          </div>
        </div>
      </section>
      <section className="px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            description="Large editorial category cards with runway-style spacing."
            eyebrow="Seasonal edits"
            title="Shop the story"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {categories.slice(0, 3).map((category, index) => (
              <article
                className={index === 1 ? "md:pt-16" : ""}
                key={category.id}
              >
                <div className="group overflow-hidden rounded-[2.5rem] bg-white p-3 shadow-xl shadow-zinc-300/40">
                  <StoreImage
                    alt={category.name}
                    className="aspect-[3/4] w-full rounded-[2rem] object-cover transition duration-500 group-hover:scale-[1.04]"
                    fallbackClassName="aspect-[3/4] rounded-[2rem] bg-zinc-100 text-zinc-500"
                    label={category.name}
                    src={category.imageUrl}
                  />
                </div>
                <h3 className="mt-5 text-3xl font-black uppercase tracking-[-0.05em]">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {category.description || "Discover the collection."}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <div className="border-b border-zinc-950 pb-5">
            <SectionIntro eyebrow="Shop now" title="Product runway" />
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article className="group" key={product.id}>
                <div className="overflow-hidden rounded-[2rem] bg-white p-3 shadow-sm">
                  <StoreImage
                    alt={product.name}
                    className="aspect-[3/4] w-full rounded-[1.5rem] object-cover transition duration-500 group-hover:scale-[1.04]"
                    fallbackClassName="aspect-[3/4] rounded-[1.5rem] bg-zinc-100 text-zinc-500"
                    label={product.name}
                    src={product.imageUrl}
                  />
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black uppercase tracking-[-0.03em]">{product.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
                      {product.description || "Ask the store for fit, stock, and delivery."}
                    </p>
                  </div>
                  <PriceTag className="bg-zinc-950 text-white">{product.price || store.currency}</PriceTag>
                </div>
                <WhatsAppButton
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-zinc-950 text-xs font-black uppercase tracking-[0.16em] transition hover:bg-zinc-950 hover:text-white"
                  store={store}
                  text={`Hi, I want ${product.name}`}
                >
                  Order
                </WhatsAppButton>
              </article>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="border-t border-zinc-950/10 bg-[#f6f0e8]" store={store} />
    </main>
  );
}
