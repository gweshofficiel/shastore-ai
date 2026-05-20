import type { AiLandingCopy, ProductInput } from "@/types/landing";

type TemplateProps = {
  product: ProductInput;
  copy: AiLandingCopy;
};

export function CleanCommerceTemplate({ product, copy }: TemplateProps) {
  const whatsappHref = `https://wa.me/${product.whatsappNumber.replace(/\D/g, "")}`;

  return (
    <main className="bg-white">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
            {product.productName}
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-ink">
            {copy.headline}
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">{copy.subheadline}</p>
          <p className="mt-5 text-base leading-7 text-slate-700">
            {copy.productCopy}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-white"
              href={whatsappHref}
              style={{ backgroundColor: product.brandColor }}
            >
              {copy.ctaText}
            </a>
            <span className="text-2xl font-black text-ink">
              {product.productPrice}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <div className="aspect-square w-full rounded-[2rem] bg-canvas p-5 shadow-soft">
            <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-line bg-white text-center text-muted">
              {product.heroImage ? "Product image" : "{{hero_image}}"}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-canvas py-16">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {copy.benefits.map((benefit) => (
            <div className="rounded-2xl border border-line bg-white p-6" key={benefit}>
              <p className="font-semibold text-ink">{benefit}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
