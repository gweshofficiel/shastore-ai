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

export function ScandinavianLightTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-slate-950">
      <StoreHeader
        accentClassName="text-emerald-700/70"
        className="border-slate-200 bg-[#f7f8f3]/86 text-slate-950"
        ctaClassName="bg-emerald-800 text-white shadow-[0_20px_55px_-32px_rgba(6,95,70,0.9)]"
        logoClassName="h-10 w-10 rounded-2xl"
        store={store}
      />
      <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700/70">
              Calm shopping
            </p>
            <h1 className="mt-5 text-6xl font-black tracking-[-0.075em] sm:text-7xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {heroSubtitle(
                store,
                "A light Scandinavian storefront with quiet spacing, natural surfaces, and simple WhatsApp ordering."
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-800 px-7 text-sm font-black text-white transition hover:-translate-y-1" href="#products">
                Browse goods
              </a>
              <WhatsAppButton className="inline-flex h-12 items-center justify-center rounded-full border border-emerald-800 px-7 text-sm font-black text-emerald-900 transition hover:-translate-y-1 hover:bg-emerald-800 hover:text-white" store={store}>
                WhatsApp
              </WhatsAppButton>
            </div>
          </div>
          <div className="rounded-[3rem] bg-[#e8ede3] p-4">
            <StoreImage alt={heroProduct.name} className="aspect-[16/11] w-full rounded-[2.4rem] object-cover" fallbackClassName="aspect-[16/11] rounded-[2.4rem] bg-white text-emerald-800" label={heroProduct.name} src={heroProduct.imageUrl} />
            <div className="grid gap-3 pt-4 sm:grid-cols-3">
              {categories.slice(0, 3).map((category) => (
                <div className="rounded-[1.5rem] bg-white/80 p-4" key={category.id}>
                  <p className="text-sm font-black">{category.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            description="Soft natural cards and clean typography create a relaxed, premium shopping flow."
            eyebrow="Collections"
            title="Thoughtfully grouped"
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 4).map((category) => (
              <article className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/80" key={category.id}>
                <StoreImage alt={category.name} className="aspect-[4/3] w-full rounded-[1.5rem] object-cover" fallbackClassName="aspect-[4/3] rounded-[1.5rem] bg-[#eef2e8] text-emerald-800" label={category.name} src={category.imageUrl} />
                <h3 className="mt-5 font-black tracking-[-0.03em]">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{category.description || "Explore this edit."}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro align="center" eyebrow="Products" title="Simple, shoppable cards" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article className="rounded-[2rem] bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200" key={product.id}>
                <StoreImage alt={product.name} className="aspect-square w-full rounded-[1.5rem] object-cover" fallbackClassName="aspect-square rounded-[1.5rem] bg-[#eef2e8] text-emerald-800" label={product.name} src={product.imageUrl} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                    <PriceTag className="bg-[#eef2e8] text-emerald-900">{product.price || store.currency}</PriceTag>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{product.description || "Message for availability."}</p>
                  <WhatsAppButton className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-800 text-sm font-black text-white transition hover:bg-emerald-900" store={store} text={`Hi, I want ${product.name}`}>
                    Order
                  </WhatsAppButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <StoreFooter className="border-t border-slate-200 bg-[#f7f8f3]" store={store} />
    </main>
  );
}
