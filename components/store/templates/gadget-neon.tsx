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

export function GadgetNeonTemplate({ store }: StoreTemplateProps) {
  const products = getFeaturedProducts(store, 8);
  const categories = getCategories(store);
  const heroProduct = products[0];

  return (
    <main className="min-h-screen bg-[#050612] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.24),transparent_28%),radial-gradient(circle_at_84%_10%,rgba(217,70,239,0.24),transparent_32%)]" />
      <StoreHeader
        accentClassName="text-cyan-300"
        className="border-cyan-300/15 bg-[#050612]/75 text-white"
        ctaClassName="bg-cyan-300 text-slate-950 shadow-[0_0_38px_rgba(34,211,238,0.35)]"
        logoClassName="h-11 w-11 rounded-xl"
        store={store}
        textClassName="text-white"
      />
      <section className="relative px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Next-gen drop
            </p>
            <h1 className="mt-6 text-6xl font-black tracking-[-0.075em] sm:text-7xl lg:text-8xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-50/65">
              {heroSubtitle(
                store,
                "A high-energy storefront for gadgets, accessories, and launches that deserve a neon product stage."
              )}
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {["Fast chat", "Live catalog", "Direct order"].map((item) => (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center" key={item}>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-slate-950 transition hover:-translate-y-1"
                href="#products"
              >
                Explore tech
              </a>
              <WhatsAppButton
                className="inline-flex h-12 items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-7 text-sm font-black text-fuchsia-100 transition hover:-translate-y-1"
                store={store}
              >
                Order device
              </WhatsAppButton>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-6 rounded-full bg-cyan-400/20 blur-3xl" />
            <article className="relative overflow-hidden rounded-[3rem] border border-cyan-300/20 bg-white/[0.055] p-4 shadow-[0_0_90px_rgba(34,211,238,0.18)] backdrop-blur-xl">
              <StoreImage
                alt={heroProduct.name}
                className="aspect-square w-full rounded-[2.35rem] object-cover"
                fallbackClassName="aspect-square rounded-[2.35rem] bg-[linear-gradient(135deg,#111827,#172554,#581c87)] text-cyan-200"
                label={heroProduct.name}
                src={heroProduct.imageUrl}
              />
              <div className="mt-4 rounded-[2rem] border border-white/10 bg-black/25 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-black tracking-[-0.05em]">{heroProduct.name}</h2>
                  <PriceTag className="bg-cyan-300 text-slate-950">
                    {heroProduct.price || store.currency}
                  </PriceTag>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="relative px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            dark
            description="Neon category tiles create a launchpad-style browsing experience for technical collections."
            eyebrow="Systems"
            title="Browse product zones"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 4).map((category) => (
              <article
                className="group rounded-[2rem] border border-cyan-300/15 bg-white/[0.055] p-4 transition hover:-translate-y-1 hover:border-cyan-300/40"
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
                  fallbackClassName="aspect-[4/3] rounded-[1.5rem] bg-cyan-300/10 text-cyan-200"
                  label={category.name}
                  src={category.imageUrl}
                />
                <h3 className="mt-4 text-lg font-black tracking-[-0.03em]">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50/55">
                  {category.description || "Explore the latest products in this zone."}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="relative px-4 py-16 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto max-w-7xl">
          <SectionIntro dark eyebrow="Hardware" title="Featured tech" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article
                className="group overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.055] p-3 transition hover:-translate-y-1 hover:shadow-[0_0_65px_rgba(34,211,238,0.16)]"
                key={product.id}
              >
                <StoreImage
                  alt={product.name}
                  className="aspect-square w-full rounded-[1.75rem] object-cover"
                  fallbackClassName="aspect-square rounded-[1.75rem] bg-white/5 text-cyan-200"
                  label={product.name}
                  src={product.imageUrl}
                />
                <div className="p-4">
                  <h3 className="font-black tracking-[-0.03em]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">
                    {product.description || "Ask for specs, warranty, and availability."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="font-black text-cyan-200">{product.price || store.currency}</p>
                    <WhatsAppButton
                      className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-fuchsia-300"
                      store={store}
                      text={`Hi, I want ${product.name}`}
                    >
                      Ping
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
