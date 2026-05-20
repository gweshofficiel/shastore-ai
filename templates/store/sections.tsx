import type { StorefrontData, StoreTemplateTheme } from "@/types/storefront";

function whatsappHref(number: string | null) {
  return number ? `https://wa.me/${number.replace(/\D/g, "")}` : "#";
}

export function StoreHeader({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur ${theme.header}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {store.logoImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={store.name} className="h-10 w-10 rounded-2xl object-cover" src={store.logoImageUrl} />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black text-white"
              style={{ backgroundColor: store.brandColor }}
            >
              {store.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className={`text-sm font-black ${theme.heading}`}>{store.name}</span>
        </div>
        <nav className="hidden items-center gap-5 text-sm font-bold md:flex">
          <a className={theme.muted} href="#categories">Categories</a>
          <a className={theme.muted} href="#products">Products</a>
          <a className={theme.muted} href="#contact">Contact</a>
        </nav>
      </div>
    </header>
  );
}

export function StoreHero({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  const heroProduct = store.products[0];

  return (
    <section className={`px-4 py-14 sm:px-6 lg:px-8 lg:py-20 ${theme.hero}`}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.25em] ${theme.muted}`}>
            Multi-category storefront
          </p>
          <h1 className={`mt-4 text-5xl font-black tracking-[-0.05em] sm:text-6xl ${theme.heading}`}>
            {store.name}
          </h1>
          <p className={`mt-5 max-w-2xl text-lg leading-8 ${theme.text}`}>
            {store.description || "Explore curated categories, featured products, and order directly through WhatsApp."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className={`inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black ${theme.button}`} href="#products">
              Shop products
            </a>
            <a
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black text-white"
              href={whatsappHref(store.whatsappNumber)}
              style={{ backgroundColor: store.brandColor }}
            >
              Order on WhatsApp
            </a>
          </div>
        </div>
        <div className={`rounded-[2.5rem] p-4 ${theme.surface}`}>
          {heroProduct?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={heroProduct.name} className="min-h-80 w-full rounded-[2rem] object-cover" src={heroProduct.imageUrl} />
          ) : (
            <div className={`flex min-h-80 items-center justify-center rounded-[2rem] ${theme.mutedSurface}`}>
              <div className="text-center">
                <p className={`text-sm font-black uppercase tracking-[0.22em] ${theme.muted}`}>Featured</p>
                <p className={`mt-3 text-2xl font-black ${theme.heading}`}>
                  {heroProduct?.name || "Featured product"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function StoreCategories({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8" id="categories">
      <div className="mx-auto max-w-7xl">
        <h2 className={`text-3xl font-black tracking-[-0.03em] ${theme.heading}`}>Shop by category</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(store.categories.length ? store.categories : [{ id: "placeholder", name: "Featured", description: "Curated products", imageUrl: null }]).map((category) => (
            <div className={`overflow-hidden rounded-[2rem] ${theme.surface}`} key={category.id}>
              {category.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={category.name} className="aspect-[4/3] w-full object-cover" src={category.imageUrl} />
              ) : (
                <div className={`aspect-[4/3] ${theme.mutedSurface}`} />
              )}
              <div className="p-5">
                <p className={`font-black ${theme.heading}`}>{category.name}</p>
                <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{category.description || "Explore this collection."}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StoreProductGrid({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8" id="products">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${theme.muted}`}>Catalog</p>
            <h2 className={`mt-2 text-3xl font-black tracking-[-0.03em] ${theme.heading}`}>Featured products</h2>
          </div>
          <p className={`text-sm font-bold ${theme.muted}`}>{store.currency}</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(store.products.length ? store.products : [{ id: "placeholder", name: "Product preview", description: "Add products in the dashboard.", price: store.currency, imageUrl: null, categoryId: null }]).map((product) => (
            <article className={`overflow-hidden rounded-[2rem] ${theme.productCard}`} key={product.id}>
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={product.name} className="aspect-square w-full object-cover" src={product.imageUrl} />
              ) : (
                <div className={`aspect-square ${theme.mutedSurface}`} />
              )}
              <div className="p-5">
                <h3 className={`font-black ${theme.heading}`}>{product.name}</h3>
                <p className={`mt-2 line-clamp-2 text-sm leading-6 ${theme.muted}`}>{product.description || "Product details coming soon."}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className={`font-black ${theme.heading}`}>{product.price || store.currency}</p>
                  <a className="rounded-full px-3 py-2 text-xs font-black text-white" href={whatsappHref(store.whatsappNumber)} style={{ backgroundColor: store.brandColor }}>
                    WhatsApp
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StoreTestimonials({ theme }: { theme: StoreTemplateTheme }) {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className={`mx-auto grid max-w-7xl gap-4 rounded-[2rem] p-6 md:grid-cols-3 lg:p-8 ${theme.surface}`}>
        {["Fast ordering", "Curated catalog", "WhatsApp support"].map((item) => (
          <div className={`rounded-3xl p-5 ${theme.mutedSurface}`} key={item}>
            <p className={`text-lg font-black ${theme.heading}`}>{item}</p>
            <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>A premium shopping experience built for direct customer conversations.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StoreCtaBanner({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8" id="contact">
      <div className={`mx-auto max-w-5xl rounded-[2rem] p-8 text-center ${theme.surface}`}>
        <h2 className={`text-3xl font-black tracking-[-0.03em] ${theme.heading}`}>Ready to order?</h2>
        <p className={`mx-auto mt-3 max-w-2xl text-sm leading-6 ${theme.muted}`}>
          Message us on WhatsApp to ask questions, confirm availability, and place your order.
        </p>
        <a className="mt-6 inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black text-white" href={whatsappHref(store.whatsappNumber)} style={{ backgroundColor: store.brandColor }}>
          Order on WhatsApp
        </a>
      </div>
    </section>
  );
}

export function StoreFooter({
  store,
  theme
}: {
  store: StorefrontData;
  theme: StoreTemplateTheme;
}) {
  return (
    <footer className={`px-4 py-8 sm:px-6 lg:px-8 ${theme.header}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm font-bold sm:flex-row sm:items-center sm:justify-between">
        <p className={theme.heading}>{store.name}</p>
        <p className={theme.muted}>Powered by SHASTORE AI</p>
      </div>
    </footer>
  );
}
