import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  getStoreInstancePreview,
  storeInstanceMigrationMessage
} from "@/lib/store-instances";

export const dynamic = "force-dynamic";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function StoreInstancePreviewPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const preview = await getStoreInstancePreview(slug);

  if (!preview) {
    return (
      <div className="grid gap-6">
        <PageHeader
          description="The cloned store instance tables are not available yet."
          title="Store Instance Preview"
        />
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{storeInstanceMigrationMessage()}</p>
        </Card>
      </div>
    );
  }

  const { branding, categories, domains, instance, products } = preview;
  const homepage = asRecord(branding?.homepage_content);
  const seo = asRecord(branding?.seo);
  const footer = asRecord(branding?.footer_settings);
  const contact = asRecord(branding?.contact_settings);
  const cta = asRecord(branding?.cta);
  const heroTitle = text(homepage.heroTitle, instance.store_name);
  const heroSubtitle = text(
    homepage.heroSubtitle,
    "A cloned SHASTORE AI store instance prepared from the purchased reseller template."
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Private reseller preview rendered from cloned store instance records, not the public storefront engine."
        title={instance.store_name}
      />
      <section
        className="overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_24px_80px_-55px_rgba(15,23,42,0.9)] lg:p-8"
        style={{
          background: `linear-gradient(135deg, ${branding?.primary_color ?? "#0f172a"}, ${
            branding?.secondary_color ?? "#2563eb"
          })`
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
              Real Store Instance
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] lg:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {heroSubtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">
                {text(cta.text, "Shop this store")}
              </span>
              <span className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white">
                /store/{instance.internal_slug}
              </span>
            </div>
          </div>
          <Card className="bg-white/95 p-5 text-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Instance Status
            </p>
            <p className="mt-3 text-2xl font-black capitalize text-ink">{instance.status}</p>
            <p className="mt-1 text-sm font-semibold text-muted">Visibility: {instance.visibility}</p>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Source template
            </p>
            <p className="mt-1 text-sm font-bold text-ink">
              {instance.source_template_key ?? "Unknown"}
            </p>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Cloned Categories
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                  key={category.id}
                >
                  {category.name}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Cloned Products
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {products.map((product) => (
                <article className="rounded-3xl border border-slate-200 bg-white p-4" key={product.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{product.name}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {product.category ?? "General"}
                      </p>
                    </div>
                    <p className="font-black text-ink">{product.price_label ?? "Custom"}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {product.short_description}
                  </p>
                  <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {product.image_placeholder ?? "Cloned product visual"}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 self-start">
          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              SEO & Contact
            </p>
            <p className="mt-3 font-black text-ink">{text(seo.title, instance.store_name)}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              {text(seo.description, "No SEO description cloned.")}
            </p>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-muted">
              <p>Support: {text(contact.supportEmail, "Not configured")}</p>
              <p>Phone: {text(contact.phone, "Not configured")}</p>
              <p>WhatsApp: {text(contact.whatsapp, "Not configured")}</p>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Footer & Domain
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              {text(footer.storeDescription, "Footer settings cloned for this store instance.")}
            </p>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-muted">
              <p>Requested domain: {domains?.requested_domain ?? "Not requested"}</p>
              <p>Connected domain: {domains?.connected_domain ?? "Not connected"}</p>
              <p>DNS: {domains?.dns_status ?? "not_configured"}</p>
              <p>SSL: {domains?.ssl_status ?? "not_configured"}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
