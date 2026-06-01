import type { Metadata } from "next";
import Link from "next/link";
import {
  StorefrontTenantContextScript,
  StorefrontThemeTokens
} from "@/lib/storefront/context";
import { CompareButton, CompareNavLink } from "@/components/storefront/product-compare";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductQuickView } from "@/components/storefront/product-quick-view";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
import { StorefrontHydration } from "@/components/storefront/storefront-hydration";
import {
  buildPublicProductSections,
  isPublicCategoryTitle
} from "@/lib/storefront/catalog-sections";
import { PublicStoreFooter } from "@/components/storefront/public-store-footer";
import { DynamicSectionLoader } from "@/lib/storefront/sections";
import {
  getCurrentStoreContext,
  resolveTenantStore
} from "@/lib/tenant/context";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct
} from "@/lib/public-storefront-preview";

export const dynamic = "force-dynamic";

function StoreUnavailablePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          Store unavailable
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">
          This store is not publicly available.
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          The store may still be in draft, unpublished, private, or temporarily restricted.
        </p>
      </div>
    </main>
  );
}

function formatProductPrice(price: number | string | null, priceLabel: string | null, currency: string) {
  if (priceLabel) {
    return priceLabel;
  }

  if (price === null || price === undefined || price === "") {
    return "Price coming soon";
  }

  const numericPrice = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numericPrice)) {
    return String(price);
  }

  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(numericPrice);
}

function whatsappStoreHref(whatsappNumber: string | null, storeTitle: string) {
  const number = whatsappNumber?.replace(/\D/g, "");

  if (!number) {
    return null;
  }

  const text = encodeURIComponent(`Hi, I need support from ${storeTitle}.`);
  return `https://wa.me/${number}?text=${text}`;
}

function phoneHref(phone: string | null) {
  const number = phone?.replace(/[^\d+]/g, "");
  return number ? `tel:${number}` : null;
}

function productGalleryUrls(gallery: unknown[]) {
  return gallery
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return item;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.url === "string"
          ? record.url
          : typeof record.publicUrl === "string"
            ? record.publicUrl
            : null;
      }

      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function publicProductHref(
  storeSlug: string,
  product: { id: string; slug?: string | null }
) {
  return `/store/${storeSlug}/product/${encodeURIComponent(product.slug || product.id)}`;
}

type DiscoverySearchParams = {
  availability?: string;
  category?: string;
  collection?: string;
  maxPrice?: string;
  minPrice?: string;
  q?: string;
  sort?: string;
};

function cleanQueryValue(value: string | undefined, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numericFilterValue(value: string | undefined) {
  const parsed = Number(cleanQueryValue(value, 30));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function productPriceValue(product: PublicStorefrontProduct) {
  if (typeof product.price === "number") {
    return Number.isFinite(product.price) ? product.price : null;
  }

  if (typeof product.price === "string" && product.price.trim()) {
    const parsed = Number(product.price);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function productSearchText(product: PublicStorefrontProduct) {
  return [
    product.title,
    product.description,
    product.sku,
    ...product.variants.flatMap((variant) => [variant.name, variant.sku])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesCategoryOrCollection(
  product: PublicStorefrontProduct,
  categories: PublicStorefrontCategory[],
  filterValue: string
) {
  if (!filterValue) {
    return true;
  }

  const category = categories.find(
    (item) => item.id === filterValue || item.slug === filterValue || item.name.toLowerCase() === filterValue.toLowerCase()
  );
  const categoryName = category?.name ?? filterValue;

  return product.categoryId === category?.id || product.categoryName === categoryName;
}

function isProductInStock(product: PublicStorefrontProduct) {
  if (!product.trackInventory) {
    return true;
  }

  if (typeof product.stockQuantity === "number") {
    return product.stockQuantity > 0;
  }

  return product.variants.some((variant) => typeof variant.stockQuantity === "number" && variant.stockQuantity > 0);
}

function sortDiscoveryProducts(products: PublicStorefrontProduct[], sort: string) {
  return [...products].sort((left, right) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const leftPrice = productPriceValue(left) ?? Number.MAX_SAFE_INTEGER;
      const rightPrice = productPriceValue(right) ?? Number.MAX_SAFE_INTEGER;
      return sort === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
    }

    if (sort === "name-asc") {
      return left.title.localeCompare(right.title);
    }

    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function resolveProductDiscovery({
  categories,
  products,
  searchParams
}: {
  categories: PublicStorefrontCategory[];
  products: PublicStorefrontProduct[];
  searchParams: DiscoverySearchParams;
}) {
  const query = cleanQueryValue(searchParams.q, 120).toLowerCase();
  const categoryFilter = cleanQueryValue(searchParams.category, 100);
  const collectionFilter = cleanQueryValue(searchParams.collection, 100);
  const categoryOrCollection = categoryFilter || collectionFilter;
  const minPrice = numericFilterValue(searchParams.minPrice);
  const maxPrice = numericFilterValue(searchParams.maxPrice);
  const availability = cleanQueryValue(searchParams.availability, 30);
  const sort = cleanQueryValue(searchParams.sort, 30) || "newest";
  const filtered = products.filter((product) => {
    const price = productPriceValue(product);

    if (query && !productSearchText(product).includes(query)) {
      return false;
    }

    if (!matchesCategoryOrCollection(product, categories, categoryOrCollection)) {
      return false;
    }

    if (minPrice !== null && (price === null || price < minPrice)) {
      return false;
    }

    if (maxPrice !== null && (price === null || price > maxPrice)) {
      return false;
    }

    if (availability === "in_stock" && !isProductInStock(product)) {
      return false;
    }

    return true;
  });

  return {
    active: Boolean(query || categoryOrCollection || minPrice !== null || maxPrice !== null || availability || sort !== "newest"),
    availability,
    categoryOrCollection,
    maxPrice,
    minPrice,
    products: sortDiscoveryProducts(filtered, sort),
    query,
    sort
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await resolveTenantStore({ slug, source: "slug" });
  const preview = context?.preview;

  if (!preview) {
    return {
      title: "Store not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const admin = createAdminClient();

  if (admin) {
    const storefrontAccess = await getPublicStorefrontAccess({
      storeId: preview.store.id,
      supabase: admin
    });

    if (!storefrontAccess.allowed) {
      return {
        title: "Store unavailable | SHASTORE AI",
        robots: { follow: false, index: false }
      };
    }
  }

  const title = preview.store.seoTitle || preview.store.title;
  const description =
    preview.store.seoDescription ||
    preview.store.description ||
    `Preview ${preview.store.title}, powered by SHASTORE AI.`;
  const ogTitle = preview.store.ogTitle || title;
  const ogDescription = preview.store.ogDescription || description;

  return {
    alternates: preview.store.canonicalUrl ? { canonical: preview.store.canonicalUrl } : undefined,
    title,
    keywords: preview.store.seoKeywords || undefined,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: preview.store.ogImageUrl ? [{ url: preview.store.ogImageUrl }] : undefined,
      siteName: preview.store.title,
      type: "website"
    },
    twitter: {
      card: preview.store.ogImageUrl ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription
    },
    robots: { index: !preview.store.noindex, follow: !preview.store.noindex }
  };
}

export default async function PublicStorePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<DiscoverySearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const context = await getCurrentStoreContext(slug);
  const preview = context?.preview;

  if (!preview || !context) {
    return <StoreUnavailablePage />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <StoreUnavailablePage />;
  }

  const discovery = resolveProductDiscovery({
    categories: preview.categories,
    products: preview.products,
    searchParams: query
  });
  const filteredPreview = {
    ...preview,
    products: discovery.products
  };
  const filteredContext = {
    ...context,
    preview: filteredPreview
  };
  const { branding, store } = filteredPreview;
  const products = discovery.products;
  const theme = preview.themeSettings;
  const productSections = buildPublicProductSections({
    categories: filteredPreview.categories,
    products
  });
  const supportEmail = store.supportEmail?.trim() || null;
  const supportPhoneHref = phoneHref(store.supportPhone);
  const contactWhatsappHref = whatsappStoreHref(store.whatsappNumber, store.title);
  const socialLinks = Object.entries(store.socialLinks).filter(([, href]) => href);
  const headerLinks = preview.navigation.header;
  const hasContactData = Boolean(
    store.whatsappNumber ||
      supportEmail ||
      store.supportPhone ||
      store.businessAddress ||
      store.businessHours ||
      socialLinks.length
  );
  const hasDeliveryData = Boolean(
    store.deliveryEnabled ||
      store.pickupEnabled ||
      store.deliveryFee !== null ||
      store.freeDeliveryThreshold !== null ||
      store.deliveryNotes
  );
  const heroBackground = theme.bannerImageUrl
    ? `linear-gradient(135deg, ${branding.primaryColor}cc, ${branding.secondaryColor}99), url("${theme.bannerImageUrl}") center/cover`
    : `radial-gradient(circle at 20% 10%, ${branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`;
  const discoveryControls = (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <form className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" method="get">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Product discovery
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Search and filter products
            </h2>
          </div>
          {discovery.active ? (
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
              href={`/store/${store.slug}`}
            >
              Clear filters
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="grid gap-2 text-sm font-semibold text-ink lg:col-span-2">
            <span>Search</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={cleanQueryValue(query.q, 120)}
              name="q"
              placeholder="Name, description, or SKU"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Category / collection</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={discovery.categoryOrCollection}
              name="category"
            >
              <option value="">All products</option>
              {filteredPreview.categories.map((category) => (
                <option key={category.id} value={category.slug || category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Availability</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={discovery.availability}
              name="availability"
            >
              <option value="">Any availability</option>
              <option value="in_stock">In stock</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Min price</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={discovery.minPrice ?? ""}
              min="0"
              name="minPrice"
              placeholder="0"
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Max price</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={discovery.maxPrice ?? ""}
              min="0"
              name="maxPrice"
              placeholder="500"
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Sort</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              defaultValue={discovery.sort}
              name="sort"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
              <option value="name-asc">Name A-Z</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-muted">
            Showing {products.length} of {preview.products.length} store-scoped products.
          </p>
          <button
            className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </form>
    </section>
  );
  const fallbackStorefront = (
    <>
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              {theme.logoUrl ? (
                <img
                  alt={`${store.title} logo`}
                  className="h-10 w-10 rounded-full object-cover"
                  src={theme.logoUrl}
                />
              ) : null}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  SHASTORE AI Store
                </p>
                <p className="mt-1 text-sm font-black text-ink">{store.title}</p>
              </div>
            </div>
            {headerLinks.length ? (
              <nav className="hidden flex-wrap items-center gap-4 text-xs font-black uppercase tracking-[0.16em] text-muted sm:flex">
                {headerLinks.map((link) => (
                  <a className="transition hover:text-ink" href={link.href} key={link.id}>
                    {link.label}
                  </a>
                ))}
              </nav>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                href={`/store/${store.slug}/account`}
              >
                Account
              </Link>
              <CompareNavLink currency={store.currency} slug={store.slug} storeId={store.id} />
              <WishlistNavLink currency={store.currency} slug={store.slug} storeId={store.id} />
              <CartNavLink currency={store.currency} slug={store.slug} storeId={store.id} />
            </div>
          </header>

          <div
            className="overflow-hidden rounded-[2.5rem] px-6 py-16 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] sm:px-10 lg:px-14 lg:py-24"
            style={{ background: heroBackground }}
          >
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">
                Public Storefront
              </p>
              <h1 className="mt-5 text-5xl font-black leading-none tracking-[-0.07em] sm:text-7xl lg:text-8xl">
                {theme.heroTitle || store.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/75 sm:text-lg">
                {theme.heroSubtitle ||
                  store.description ||
                  "A clean SHASTORE AI storefront preview for this claimed store."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950">
                  Browse products
                </span>
                <span className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white/80">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Catalog
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                Featured products
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-muted">
              Products shown here are published products scoped to this store only.
            </p>
          </div>

          {products.length ? (
            <div className="grid gap-8">
              {productSections.map((section) => (
                <div className="grid gap-5" key={section.category.id}>
                  <div className="flex flex-col gap-2 rounded-[2rem] border border-slate-200 bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Category
                    </p>
                    {section.category.slug ? (
                      <Link
                        className="text-2xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600"
                        href={`/store/${store.slug}/category/${encodeURIComponent(section.category.slug)}`}
                      >
                        {section.category.name}
                      </Link>
                    ) : (
                      <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
                        {section.category.name}
                      </h3>
                    )}
                    <p className="text-sm leading-6 text-muted">
                      {section.category.description ||
                        "Browse products in this category."}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {section.products.map((product) => {
                const galleryUrls = productGalleryUrls(product.gallery);
                const primaryImage = product.imageUrl || galleryUrls[0] || null;
                const currency = product.currency || store.currency;
                const detailsHref = publicProductHref(store.slug, product);

                return (
                  <article
                    className="group flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:border-slate-300"
                    key={product.id}
                  >
                    <Link className="relative block" href={publicProductHref(store.slug, product)}>
                      <ProductBadges className="absolute left-4 top-4 z-10" product={product} />
                      {primaryImage ? (
                        <img
                          alt={product.title}
                          className="aspect-[4/3] w-full object-cover"
                          src={primaryImage}
                        />
                      ) : (
                        <div
                          className="flex aspect-[4/3] items-end p-5"
                          style={{
                            background: `linear-gradient(135deg, ${branding.primaryColor}16, ${branding.secondaryColor}24)`
                          }}
                        >
                          <span
                            className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm"
                            style={{ backgroundColor: branding.primaryColor }}
                          >
                            {isPublicCategoryTitle(product.categoryName)
                              ? product.categoryName
                              : "Product"}
                          </span>
                        </div>
                      )}
                    </Link>
                    {galleryUrls.length ? (
                      <div className="grid grid-cols-4 gap-2 px-4 pt-4">
                        {galleryUrls.slice(0, 4).map((url) => (
                          <img
                            alt={`${product.title} gallery image`}
                            className="aspect-square rounded-2xl object-cover"
                            key={url}
                            src={url}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-1 flex-col p-5">
                      {isPublicCategoryTitle(product.categoryName) ? (
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          {product.categoryName}
                        </p>
                      ) : null}
                      <Link href={publicProductHref(store.slug, product)}>
                        <h3 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                          {product.title}
                        </h3>
                      </Link>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
                        {product.description || "No description has been added for this product yet."}
                      </p>
                      <ProductSalesProof compact product={product} />
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                        <div className="flex flex-wrap items-end gap-2">
                          <p className="text-lg font-black text-ink">
                            {formatProductPrice(product.price, product.priceLabel, currency)}
                          </p>
                          {product.compareAtPrice ? (
                            <p className="text-sm font-bold text-slate-400 line-through">
                              {formatProductPrice(product.compareAtPrice, null, currency)}
                            </p>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                            {currency}
                          </span>
                        </div>
                        {product.sku ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {product.sku}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5 grid gap-2">
                        <ProductQuickView
                          currency={currency}
                          detailsHref={detailsHref}
                          product={product}
                          slug={store.slug}
                          storeId={store.id}
                        />
                        <CompareButton
                          currency={currency}
                          product={product}
                          slug={store.slug}
                          storeId={store.id}
                        />
                        <AddToCartButton
                          currency={currency}
                          detailsHref={detailsHref}
                          product={product}
                          showBuyNow
                          showViewDetails
                          slug={store.slug}
                          storeId={store.id}
                        />
                        <WishlistButton
                          currency={currency}
                          product={product}
                          slug={store.slug}
                          storeId={store.id}
                        />
                      </div>
                    </div>
                  </article>
                );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
                {preview.products.length ? "No products found." : "No products available yet"}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                {preview.products.length
                  ? "Try adjusting the search, filters, or price range."
                  : "This store is live, but there are no active public products yet."}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );

  return (
    <main
      className="min-h-screen text-ink"
      style={{
        backgroundColor: context.theme.colorPalette.background,
        color: context.theme.colorPalette.text,
        fontFamily: "var(--store-font-body)"
      }}
    >
      <StorefrontThemeTokens context={context} />
      <StorefrontTenantContextScript context={context} />
      <StorefrontHydration
        layoutKey={context.theme.layout_key}
        slug={store.slug}
        templateId={preview.templateId}
      />
      {discoveryControls}
      {discovery.active && preview.products.length > 0 && products.length === 0 ? (
        <section className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              No products found.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
              Try adjusting the search, filters, or price range.
            </p>
          </div>
        </section>
      ) : null}
      <DynamicSectionLoader context={filteredContext} fallback={fallbackStorefront} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.8)] lg:grid-cols-[minmax(0,1fr)_1.2fr] lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Delivery and pickup
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
              Fulfillment options
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              Delivery settings are managed by the store owner. Checkout fees remain informational until fulfillment is enabled.
            </p>
          </div>
          {hasDeliveryData ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ContactCard
                label="Delivery"
                value={store.deliveryEnabled ? "Available" : "Not enabled yet"}
              />
              <ContactCard
                label="Pickup"
                value={store.pickupEnabled ? "Available" : "Not enabled yet"}
              />
              <ContactCard
                label="Delivery fee"
                value={
                  store.deliveryFee !== null
                    ? formatProductPrice(store.deliveryFee, null, store.currency)
                    : "Not configured yet"
                }
              />
              <ContactCard
                label="Free delivery threshold"
                value={
                  store.freeDeliveryThreshold !== null
                    ? formatProductPrice(store.freeDeliveryThreshold, null, store.currency)
                    : "Not configured yet"
                }
              />
              <div className="sm:col-span-2">
                <ContactCard label="Delivery notes" value={store.deliveryNotes} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-sm font-black text-ink">Delivery details are not configured yet.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                The store owner can add delivery, pickup, fees, and fulfillment notes from the dashboard.
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.8)] lg:grid-cols-[minmax(0,1fr)_1.2fr] lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Contact and support
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
              Need help with this store?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              Contact details are managed by the store owner and shown only when configured.
            </p>
            {contactWhatsappHref ? (
              <a
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                href={contactWhatsappHref}
                rel="noreferrer"
                target="_blank"
              >
                Contact on WhatsApp
              </a>
            ) : null}
          </div>
          {hasContactData ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ContactCard
                href={contactWhatsappHref}
                label="WhatsApp"
                value={store.whatsappNumber}
              />
              <ContactCard
                href={supportEmail ? `mailto:${supportEmail}` : null}
                label="Support email"
                value={supportEmail}
              />
              <ContactCard
                href={supportPhoneHref}
                label="Support phone"
                value={store.supportPhone}
              />
              <ContactCard label="Business address" value={store.businessAddress} />
              <ContactCard label="Business hours" value={store.businessHours} />
              {socialLinks.map(([label, href]) => (
                <ContactCard
                  href={href}
                  key={label}
                  label={label === "x" ? "X" : label.charAt(0).toUpperCase() + label.slice(1)}
                  value={href}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-sm font-black text-ink">Contact details are not configured yet.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                The store owner can add WhatsApp, email, phone, address, and hours from the dashboard.
              </p>
            </div>
          )}
        </div>
      </section>
      <PublicStoreFooter
        copyrightText={theme.copyrightText}
        footerBackgroundColor={theme.footerBackgroundColor}
        footerTextColor={theme.footerTextColor}
        navigationLinks={preview.navigation.footer}
        pages={preview.pages}
        storeSlug={store.slug}
        storeTitle={store.title}
      />
    </main>
  );
}

function ContactCard({
  href,
  label,
  value
}: {
  href?: string | null;
  label: string;
  value?: string | null;
}) {
  const content = value || "Not configured yet";

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      {href && value ? (
        <a className="mt-2 block break-words text-sm font-black text-ink transition hover:text-slate-600" href={href}>
          {content}
        </a>
      ) : (
        <p className="mt-2 whitespace-pre-line break-words text-sm font-bold text-muted">{content}</p>
      )}
    </div>
  );
}
