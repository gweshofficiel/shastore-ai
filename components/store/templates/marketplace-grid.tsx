import {
  PriceTag,
  SectionIntro,
  StoreFooter,
  StoreHeader,
  StoreImage,
  WhatsAppButton,
  getCategories,
  getCategoryName,
  getFeaturedProducts,
  heroSubtitle,
  heroTitle,
  type StoreTemplateProps
} from "@/components/store/templates/shared";

export function MarketplaceGridTemplate({ store }: StoreTemplateProps) {
  const categories = getCategories(store);
  const products = getFeaturedProducts(store, 12);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <StoreHeader
        accentClassName="text-blue-500"
        className="border-slate-200 bg-white/85 text-slate-950"
        ctaClassName="bg-blue-600 text-white shadow-[0_18px_55px_-30px_rgba(37,99,235,0.9)]"
        logoClassName="h-10 w-10 rounded-xl"
        store={store}
      />
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-500">
              Marketplace
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-[-0.065em] sm:text-6xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {heroSubtitle(
                store,
                "Multi-category shopping with fast discovery, product cards, and direct WhatsApp checkout."
              )}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-2xl font-black">{categories.length}</p>
                <p className="text-xs font-bold text-slate-500">Categories</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-2xl font-black">{products.length}</p>
                <p className="text-xs font-bold text-slate-500">Products</p>
              </div>
            </div>
            <WhatsAppButton
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white transition hover:-translate-y-1"
              store={store}
            >
              Start order
            </WhatsAppButton>
          </aside>
          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-3">
              {categories.slice(0, 3).map((category) => (
                <a
                  className="group overflow-hidden rounded-[2rem] bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/60"
                  href="#products"
                  key={category.id}
                >
                  <StoreImage
                    alt={category.name}
                    className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
                    fallbackClassName="aspect-[4/3] rounded-[1.5rem] bg-blue-50 text-blue-500"
                    label={category.name}
                    src={category.imageUrl}
                  />
                  <div className="p-4">
                    <h2 className="font-black tracking-[-0.03em]">{category.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{category.description || "Shop now"}</p>
                  </div>
                </a>
              ))}
            </div>
            <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200" id="products">
              <div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-end sm:justify-between">
                <SectionIntro eyebrow="Live catalog" title="All products" />
                <p className="text-sm font-black text-slate-400">{store.currency}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <article
                    className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-3 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-slate-200"
                    key={product.id}
                  >
                    <StoreImage
                      alt={product.name}
                      className="aspect-square w-full rounded-[1.3rem] object-cover"
                      fallbackClassName="aspect-square rounded-[1.3rem] bg-white text-slate-500"
                      label={product.name}
                      src={product.imageUrl}
                    />
                    <div className="p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
                        {getCategoryName(store, product.categoryId)}
                      </p>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                        <PriceTag className="bg-white text-slate-950 ring-1 ring-slate-200">
                          {product.price || store.currency}
                        </PriceTag>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {product.description || "Fast WhatsApp order available."}
                      </p>
                      <WhatsAppButton
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white transition hover:bg-blue-600"
                        store={store}
                        text={`Hi, I want ${product.name}`}
                      >
                        Add via WhatsApp
                      </WhatsAppButton>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-slate-950 p-6 text-white lg:p-8">
          <div className="grid gap-4 md:grid-cols-4">
            {categories.slice(0, 4).map((category) => (
              <div className="rounded-2xl bg-white/10 p-5" key={category.id}>
                <p className="text-lg font-black">{category.name}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {category.description || "Browse collection"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="border-t border-slate-200 bg-white" store={store} />
    </main>
  );
}
