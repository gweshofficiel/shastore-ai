import {
  PriceTag,
  StoreImage,
  StoreLogo,
  WhatsAppButton,
  cn,
  heroSubtitle,
  heroTitle,
  type StoreTemplateProps
} from "@/components/store/templates/shared";
import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";

const demoProducts: StorefrontProduct[] = [
  {
    id: "aurora-watch",
    categoryId: "aurora-tech",
    name: "Premium Watch Series S",
    description: "Sapphire display, brushed steel case, and an all-day wellness suite.",
    price: "$429",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-headphones",
    categoryId: "aurora-tech",
    name: "Wireless Headphones",
    description: "Studio-grade silence with sculpted aluminum and soft leather cups.",
    price: "$289",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-camera",
    categoryId: "aurora-tech",
    name: "Digital Camera Pro",
    description: "Compact creator camera with cinematic color and 4K capture.",
    price: "$1,249",
    imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-handbag",
    categoryId: "aurora-fashion",
    name: "Luxury Handbag",
    description: "Structured Italian-inspired silhouette with polished gold hardware.",
    price: "$520",
    imageUrl: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-perfume",
    categoryId: "aurora-beauty",
    name: "Premium Perfume",
    description: "Amber, oud, and rose notes bottled for evening rituals.",
    price: "$168",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-coat",
    categoryId: "aurora-fashion",
    name: "Fashion Coat",
    description: "Tailored wool blend with clean shoulders and satin lining.",
    price: "$390",
    imageUrl: "https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-chair",
    categoryId: "aurora-home",
    name: "Modern Chair",
    description: "Sculptural lounge chair with textured fabric and walnut legs.",
    price: "$640",
    imageUrl: "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: "aurora-shoes",
    categoryId: "aurora-sport",
    name: "Running Shoes",
    description: "Performance knit upper with premium cushioning and city-ready styling.",
    price: "$188",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85"
  }
];

const demoCategories: StorefrontCategory[] = [
  {
    id: "aurora-tech",
    name: "Signature Tech",
    description: "Premium devices, audio, and creator tools.",
    imageUrl: "https://images.unsplash.com/photo-1491933382434-500287f9b54b?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "aurora-fashion",
    name: "Luxury Fashion",
    description: "Editorial accessories, outerwear, and statement pieces.",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "aurora-beauty",
    name: "Beauty Rituals",
    description: "Perfume, glow essentials, and gifting edits.",
    imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "aurora-home",
    name: "Modern Living",
    description: "Furniture and objects for refined rooms.",
    imageUrl: "https://images.unsplash.com/photo-1493663284031-b7e3aaa4cab7?auto=format&fit=crop&w=1200&q=85"
  }
];

const trustItems = [
  ["Secure payments", "Encrypted checkout-ready experience"],
  ["Fast delivery", "Premium shipping communication"],
  ["Easy returns", "Customer-friendly post-purchase support"],
  ["Customer support", "Concierge help for every order"]
];

const testimonials = [
  ["A luxury experience from the first click.", "Maya R.", "Verified buyer"],
  ["The product cards made every item feel premium.", "Omar K.", "Boutique owner"],
  ["Clean, fast, and exactly the kind of store we wanted.", "Lina S.", "Repeat customer"]
];

function productsForStore(storeProducts: StorefrontProduct[]) {
  return storeProducts.length ? storeProducts : demoProducts;
}

function categoriesForStore(storeCategories: StorefrontCategory[]) {
  return storeCategories.length ? storeCategories : demoCategories;
}

function productCategory(categories: StorefrontCategory[], product: StorefrontProduct) {
  return categories.find((category) => category.id === product.categoryId)?.name ?? "Premium edit";
}

export function AuroraProTemplate({ store }: StoreTemplateProps) {
  const products = productsForStore(store.products);
  const categories = categoriesForStore(store.categories);
  const heroProduct = products[0];
  const bestSellers = products.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#16120d]">
      <header className="sticky top-0 z-40 border-b border-[#d6c29b]/25 bg-[#0b0906]/95 text-white backdrop-blur-2xl">
        <div className="border-b border-white/10 bg-[#c6a15b] px-4 py-2 text-center text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#110d07]">
          Premium launch offer - complimentary delivery on selected pieces
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a className="flex min-w-0 items-center gap-3" href="#">
            <StoreLogo
              className="h-12 w-12 rounded-full border border-[#c6a15b]/50 bg-[#c6a15b] text-sm text-[#111]"
              store={store}
              textClassName="text-[#111]"
            />
            <div>
              <p className="truncate text-lg font-black tracking-[-0.04em]">{store.name}</p>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-[#c6a15b]">
                Aurora Pro
              </p>
            </div>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-bold text-white/70 lg:flex">
            <a className="transition hover:text-[#f6d58a]" href="#categories">Categories</a>
            <a className="transition hover:text-[#f6d58a]" href="#best-sellers">Best sellers</a>
            <a className="transition hover:text-[#f6d58a]" href="#journal">Journal</a>
            <a className="transition hover:text-[#f6d58a]" href="#contact">Contact</a>
          </nav>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            {["Search", "Account", "Wishlist", "Cart"].map((item) => (
              <a
                className="hidden rounded-full border border-white/10 px-3 py-2 text-white/70 transition hover:border-[#c6a15b] hover:text-[#f6d58a] sm:inline-flex"
                href={item === "Cart" ? "#best-sellers" : "#"}
                key={item}
              >
                {item}
              </a>
            ))}
            <a className="rounded-full bg-[#c6a15b] px-4 py-2 text-[#111] shadow-[0_16px_48px_-24px_rgba(246,213,138,0.9)]" href="#best-sellers">
              Shop
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#090805] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(198,161,91,0.28),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(255,255,255,0.12),transparent_24%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex rounded-full border border-[#c6a15b]/30 bg-white/5 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#f6d58a] backdrop-blur">
              Luxury collection 2026
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-[-0.07em] text-white sm:text-7xl lg:text-8xl">
              {heroTitle(store)}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
              {heroSubtitle(
                store,
                "A premium commerce experience for curated products, elegant launches, and high-converting luxury collections."
              )}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a15b] px-7 text-sm font-black text-[#111] transition hover:-translate-y-1 hover:bg-[#f6d58a]" href="#best-sellers">
                Shop new arrivals
              </a>
              <WhatsAppButton
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#c6a15b]/40 px-7 text-sm font-black text-[#f6d58a] transition hover:-translate-y-1 hover:bg-[#c6a15b] hover:text-[#111]"
                store={store}
                text={`Hi, I want to shop ${store.name}`}
              >
                Concierge order
              </WhatsAppButton>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ["4.9/5", "Customer rating"],
                ["24h", "Express dispatch"],
                ["8", "Premium edits"]
              ].map(([value, label]) => (
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur" key={label}>
                  <p className="text-2xl font-black text-[#f6d58a]">{value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[3.5rem] bg-[#c6a15b]/20 blur-3xl" />
            <article className="relative overflow-hidden rounded-[3rem] border border-[#c6a15b]/25 bg-white/[0.07] p-4 shadow-2xl shadow-black/50 backdrop-blur">
              <StoreImage
                alt={heroProduct.name}
                className="aspect-[4/5] w-full rounded-[2.4rem] object-cover"
                fallbackClassName="aspect-[4/5] rounded-[2.4rem] bg-[#19140b] text-[#f6d58a]"
                label={heroProduct.name}
                src={heroProduct.imageUrl}
              />
              <div className="absolute bottom-8 left-8 right-8 rounded-[2rem] border border-white/10 bg-black/45 p-5 backdrop-blur-xl">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.26em] text-[#f6d58a]/75">Hero product</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-2xl font-black tracking-[-0.04em]">{heroProduct.name}</h2>
                  <PriceTag className="bg-[#c6a15b] text-[#111]">{heroProduct.price || store.currency}</PriceTag>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8" id="categories">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#a17933]">Curated departments</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[#16120d] sm:text-5xl">Shop by category</h2>
            </div>
            <p className="max-w-md text-sm font-semibold leading-7 text-stone-500">
              Elegant category cards help shoppers enter the collection with confidence.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {categories.slice(0, 4).map((category, index) => (
              <article
                className={cn(
                  "group overflow-hidden rounded-[2rem] border border-stone-200 bg-[#fbf8f0] p-3 shadow-[0_22px_70px_-48px_rgba(20,12,3,0.55)] transition duration-300 hover:-translate-y-1",
                  index === 0 && "md:col-span-2"
                )}
                key={category.id}
              >
                <StoreImage
                  alt={category.name}
                  className="aspect-[16/11] w-full rounded-[1.5rem] object-cover transition duration-500 group-hover:scale-[1.03]"
                  fallbackClassName="aspect-[16/11] rounded-[1.5rem] bg-[#e9dfca] text-[#8a682d]"
                  label={category.name}
                  src={category.imageUrl}
                />
                <div className="p-4">
                  <h3 className="text-xl font-black tracking-[-0.03em]">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{category.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f3ea] px-4 py-16 sm:px-6 lg:px-8" id="best-sellers">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#a17933]">Best sellers</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Premium picks with commercial polish</h2>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((product, index) => (
              <article
                className="group overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-3 shadow-[0_28px_80px_-55px_rgba(20,12,3,0.7)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_-48px_rgba(20,12,3,0.8)]"
                key={product.id}
              >
                <div className="relative overflow-hidden rounded-[1.5rem]">
                  <StoreImage
                    alt={product.name}
                    className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    fallbackClassName="aspect-[4/5] bg-[#ede4d2] text-[#8a682d]"
                    label={product.name}
                    src={product.imageUrl}
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-[#c6a15b] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#111]">
                    {index % 3 === 0 ? "20% off" : "Top rated"}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3 text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#a17933]">
                    <span>{productCategory(categories, product)}</span>
                    <span>5.0 rating</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black tracking-[-0.03em]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">
                    {product.description || "Premium item ready for merchandising."}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{product.price || store.currency}</p>
                      <p className="text-xs font-bold text-stone-400">Ships fast</p>
                    </div>
                    <WhatsAppButton
                      className="rounded-full bg-[#111] px-4 py-2 text-xs font-black text-white transition hover:bg-[#c6a15b] hover:text-[#111]"
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

      <section className="grid gap-4 bg-white px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        {["Private sale: up to 30% on selected luxury pieces", "New season edit: crafted for premium gifting"].map((title, index) => (
          <div className="rounded-[2.5rem] bg-[#0b0906] p-8 text-white shadow-2xl shadow-stone-950/20 lg:p-12" key={title}>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#c6a15b]">Aurora campaign {index + 1}</p>
            <h3 className="mt-5 max-w-xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">{title}</h3>
            <a className="mt-8 inline-flex rounded-full bg-[#c6a15b] px-6 py-3 text-sm font-black text-[#111]" href="#best-sellers">
              Explore promotion
            </a>
          </div>
        ))}
      </section>

      <section className="bg-[#f7f3ea] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          {trustItems.map(([title, body]) => (
            <div className="rounded-[2rem] border border-stone-200 bg-white p-6 text-center shadow-[0_24px_70px_-55px_rgba(20,12,3,0.65)]" key={title}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#c6a15b] text-lg font-black text-[#111]">OK</div>
              <h3 className="mt-4 font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8" id="journal">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#a17933]">Customer reviews</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Loved by premium buyers</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {testimonials.map(([quote, name, role]) => (
              <article className="rounded-[2rem] border border-stone-200 bg-[#fbf8f0] p-6" key={name}>
                <p className="text-sm font-black tracking-[0.16em] text-[#c6a15b]">5.0 rating</p>
                <p className="mt-5 text-xl font-black leading-8 tracking-[-0.03em]">{`"${quote}"`}</p>
                <p className="mt-6 text-sm font-black">{name}</p>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b0906] px-4 py-16 text-white sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[3rem] border border-[#c6a15b]/25 bg-white/[0.06] p-8 backdrop-blur lg:grid-cols-[1fr_0.8fr] lg:p-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#c6a15b]">Newsletter</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Join the private Aurora list.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/60">
              Announce drops, VIP collections, and customer-only promotions with a premium subscription block.
            </p>
          </div>
          <form className="grid gap-3 self-center">
            <input className="h-12 rounded-full border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white outline-none placeholder:text-white/35" placeholder="Email address" type="email" />
            <button className="h-12 rounded-full bg-[#c6a15b] px-6 text-sm font-black text-[#111]" type="button">
              Subscribe
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-[#080705] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <StoreLogo className="h-14 w-14 rounded-full bg-[#c6a15b] text-[#111]" store={store} textClassName="text-[#111]" />
            <p className="mt-4 text-2xl font-black tracking-[-0.04em]">{store.name}</p>
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/55">
              Premium ecommerce presentation for curated products, elegant discovery, and customer confidence.
            </p>
          </div>
          {[
            ["Shop", "New arrivals", "Best sellers", "Gift cards", "Private sale"],
            ["Support", "Contact", "Shipping", "Returns", "Order tracking"],
            ["Company", "About", "Journal", "Instagram", "Legal"]
          ].map(([title, ...links]) => (
            <div key={title}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c6a15b]">{title}</p>
              <div className="mt-4 grid gap-3 text-sm font-bold text-white/60">
                {links.map((link) => <a className="transition hover:text-[#f6d58a]" href="#" key={link}>{link}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
          <p>{store.themeSettings.copyrightText || `Copyright ${new Date().getFullYear()} ${store.name}.`}</p>
          <div className="flex gap-4">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Social</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
