import Link from "next/link";
import type { StoreTemplate, TemplateCustomizationDefaults } from "@/lib/template-studio/types";

function visualLabel(value: string) {
  return value
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProductVisual({ label, tone }: { label: string; tone: string }) {
  return (
    <div
      className="flex min-h-48 items-end overflow-hidden rounded-[1.75rem] p-4 text-white shadow-inner"
      style={{ background: tone }}
    >
      <div className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
        {visualLabel(label)}
      </div>
    </div>
  );
}

export function TemplateHeroThumbnail({
  customization,
  template
}: {
  customization?: TemplateCustomizationDefaults;
  template: StoreTemplate;
}) {
  const settings = customization ?? template.defaultCustomization;
  const featured = template.demoProducts.filter((product) => product.featured).slice(0, 3);

  return (
    <div
      className="grid min-h-56 overflow-hidden rounded-[1.75rem] p-5 text-white"
      style={{
        background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
          {template.categoryName}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
          demo store
        </span>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/65">
            {settings.storeName}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{settings.heroTitle}</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/75">
            {settings.heroSubtitle}
          </p>
        </div>
        <div className="grid gap-2">
          {featured.map((product) => (
            <div
              className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2 backdrop-blur"
              key={product.name}
            >
              <p className="text-sm font-black">{product.name}</p>
              <p className="text-xs font-bold text-white/70">{product.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoStorePreview({
  backHref,
  customization,
  template
}: {
  backHref?: string;
  customization?: TemplateCustomizationDefaults;
  template: StoreTemplate;
}) {
  const settings = customization ?? template.defaultCustomization;
  const featuredProducts = template.demoProducts.filter((product) => product.featured);
  const firstOffer = template.demoOffers[0];
  const primary = settings.primaryColor;
  const secondary = settings.secondaryColor;
  const paymentIcons = settings.paymentIcons.split(",").map((item) => item.trim()).filter(Boolean);
  const shippingMethods = settings.shippingMethodText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-950">
      <section
        className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.22em] text-white"
        style={{ backgroundColor: primary }}
      >
        Launch offer active: {firstOffer?.title ?? "demo store preview"} | {settings.ctaText}
      </section>

      <section className="bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link className="text-xl font-black tracking-[-0.04em]" href={backHref ?? "/"}>
            {settings.storeName}
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-black text-slate-500">
            {template.demoCategories.slice(0, 5).map((category) => (
              <a className="rounded-full px-3 py-2 hover:bg-slate-100" href={`#${category}`} key={category}>
                {category}
              </a>
            ))}
          </nav>
          <a
            className="inline-flex h-11 items-center rounded-full px-5 text-sm font-black text-white"
            href="#contact"
            style={{ backgroundColor: primary }}
          >
            {settings.ctaText}
          </a>
        </div>
      </section>

      <section
        className="px-4 py-12 text-white sm:px-6 lg:px-8"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-white/65">
              {template.homepageText.eyebrow}
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-[-0.07em] sm:text-6xl lg:text-7xl">
              {settings.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/75">
              {settings.heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950" href="#products">
                {settings.ctaText}
              </a>
              <a className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white" href="#offers">
                View offers
              </a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
            <ProductVisual
              label={featuredProducts[0]?.name ?? template.name}
              tone="linear-gradient(135deg,rgba(255,255,255,.35),rgba(15,23,42,.25))"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {featuredProducts.slice(0, 2).map((product) => (
                <div className="rounded-2xl bg-white p-4 text-slate-950" key={product.name}>
                  <p className="text-sm font-black">{product.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{product.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Shop By Category
              </p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Complete demo catalog</h2>
            </div>
            <p className="text-sm font-bold text-slate-500">
              {template.demoProducts.length} products, pre-filled with rich demo content
            </p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {template.demoCategories.map((category) => (
              <div
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                id={category}
                key={category}
              >
                <p className="font-black">{category}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  {template.demoProducts.filter((product) => product.category === category).length || 1} demo items ready
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8" id="products">
        <div className="mx-auto grid max-w-7xl gap-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Featured Products
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Ready-to-sell product sections</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {template.demoProducts.map((product, index) => {
              const imageLabel =
                product.type === "digital"
                  ? (product.imagePlaceholder ?? product.previewImagePlaceholder)
                  : product.imagePlaceholder;

              return (
                <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)]" key={product.name}>
                  <ProductVisual
                    label={imageLabel}
                    tone={
                      index % 2 === 0
                        ? `linear-gradient(135deg, ${primary}, ${secondary})`
                        : template.previewGradient
                    }
                  />
                  <div className="grid gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          {product.category}
                        </p>
                        <h3 className="mt-2 font-black tracking-[-0.02em]">{product.name}</h3>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {(product.productBadges ?? []).slice(0, 2).map((badge) => (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700" key={badge}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm font-semibold leading-6 text-slate-600">
                      {product.description ?? product.shortDescription}
                    </p>
                    <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
                      <p>SKU: {product.skuPlaceholder}</p>
                      <p>Stock: {product.stockPlaceholder}</p>
                      <p>Variants: {(product.variantsPlaceholder ?? []).slice(0, 3).join(" / ")}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xl font-black">{product.price}</p>
                      <p className="text-xs font-bold text-slate-400">
                        {product.type === "digital"
                          ? product.downloadTypePlaceholder
                          : product.type === "marketplace"
                            ? product.vendorPlaceholder
                            : product.stockPlaceholder}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {template.demoSections.map((section) => (
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6" key={section.title}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {section.eyebrow}
              </p>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{section.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{section.body}</p>
            </div>
          ))}
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white" id="offers">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">
              Demo Offer
            </p>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">
              {firstOffer?.title ?? "Launch offer"}
            </h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/70">
              {firstOffer?.description ?? "Replace this with your store offer."}
            </p>
            <p className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
              Code: {firstOffer?.code ?? "LAUNCH"}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          {[
            "The demo store already feels complete enough to show clients before customization.",
            "Products, categories, offers, and contact sections make the template easy to evaluate.",
            "The Studio preview updates branding and copy while preserving protected category rules."
          ].map((quote, index) => (
            <blockquote className="rounded-[2rem] border border-slate-200 bg-white p-6" key={quote}>
              <p className="text-sm font-semibold leading-7 text-slate-600">
                &ldquo;{quote}&rdquo;
              </p>
              <footer className="mt-4 text-sm font-black text-slate-950">
                Demo customer {index + 1}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">FAQ</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Store policy placeholders</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              ["How fast do orders ship?", settings.shippingMethodText],
              ["What payment methods are shown?", settings.paymentIcons],
              ["Can buyers contact support?", `${settings.supportEmail} | ${settings.whatsapp}`]
            ].map(([question, answer]) => (
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5" key={question}>
                <p className="font-black">{question}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 lg:grid-cols-[1fr_0.8fr] lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Contact
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">Questions before ordering?</h2>
            <div className="mt-4 grid gap-2 text-sm font-semibold leading-7 text-slate-600">
              <p>{settings.storeDescription}</p>
              <p>Email: {settings.supportEmail}</p>
              <p>Phone: {settings.phone}</p>
              <p>WhatsApp: {settings.whatsapp}</p>
              <p>Address: {settings.address}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {Object.entries(settings.socialLinks).map(([label, href]) => (
              <a
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black capitalize text-slate-950"
                href={href}
                key={label}
              >
                {label}: {href}
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <p className="text-2xl font-black tracking-[-0.04em]">{settings.storeName}</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/65">
              {settings.storeDescription}
            </p>
            <p className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">
              {settings.lockedPoweredBy}
            </p>
          </div>
          <div>
            <p className="text-sm font-black">Legal</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-white/65">
              <a href={settings.privacyPolicyLink}>{settings.privacyPolicyText}</a>
              <a href={settings.termsLink}>{settings.termsText}</a>
              <a href={settings.refundPolicyLink}>{settings.refundPolicyText}</a>
              <a href={settings.shippingPolicyLink}>{settings.shippingPolicyText}</a>
            </div>
          </div>
          <div>
            <p className="text-sm font-black">Payments</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentIcons.map((icon) => (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black" key={icon}>
                  {icon}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-black">Shipping</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-white/65">
              {shippingMethods.map((method) => (
                <span key={method}>{method}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs font-bold text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>{settings.copyrightText}</p>
          <p>SEO: {settings.seoTitle}</p>
        </div>
      </footer>
    </main>
  );
}
