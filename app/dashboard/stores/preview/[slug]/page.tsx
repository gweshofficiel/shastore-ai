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

export default async function BuyerStoreInstancePreviewPage({
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
          title="Store Preview"
        />
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{storeInstanceMigrationMessage()}</p>
        </Card>
      </div>
    );
  }

  const { branding, categories, domains, instance, products } = preview;
  const settings = preview.settings;
  const managedBranding = preview.managedBranding;
  const homepage = asRecord(branding?.homepage_content);
  const footer = asRecord(branding?.footer_settings);
  const cta = asRecord(branding?.cta);
  const brandingAssets = asRecord(managedBranding?.branding_assets);
  const storeName = text(settings?.store_name, instance.store_name);
  const storeDescription = text(
    settings?.store_description,
    text(homepage.heroSubtitle, "Your claimed SHASTORE AI store preview.")
  );
  const primaryColor = text(managedBranding?.primary_color, branding?.primary_color ?? "#0f172a");
  const secondaryColor = text(
    managedBranding?.secondary_color,
    branding?.secondary_color ?? "#2563eb"
  );
  const logoUrl = text(settings?.store_logo_url, text(brandingAssets.logoUrl));
  const customCss = text(managedBranding?.custom_css);

  return (
    <div className="grid gap-6">
      {customCss ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}
      <PageHeader
        description={text(settings?.seo_description, "Buyer dashboard preview rendered from your claimed store instance records.")}
        title={text(settings?.seo_title, storeName)}
      />
      <section
        className="rounded-[2rem] p-6 text-white lg:p-8"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`${storeName} logo`} className="mb-5 h-14 w-14 rounded-2xl object-cover" src={logoUrl} />
        ) : null}
        <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
          Claimed Store
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.06em]">
          {text(homepage.heroTitle, storeName)}
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/75">
          {storeDescription}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">
            {text(cta.text, "Shop this store")}
          </span>
          <span className="rounded-full border border-white/20 px-5 py-3 text-sm font-black">
            {instance.status}
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Products
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {products.map((product) => (
              <article className="rounded-3xl border border-slate-200 bg-white p-4" key={product.id}>
                <p className="font-black text-ink">{product.name}</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {product.category ?? "General"} | {product.price_label ?? "Custom"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {product.short_description}
                </p>
              </article>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 self-start">
          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Categories
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
              Domain & Footer
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              {text(footer.storeDescription, "Footer settings cloned for this store.")}
            </p>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-muted">
              <p>Support email: {settings?.support_email ?? "Not configured"}</p>
              <p>Support phone: {settings?.store_phone ?? "Not configured"}</p>
              <p>Requested domain: {domains?.requested_domain ?? "Not requested"}</p>
              <p>DNS: {domains?.dns_status ?? "not_configured"}</p>
              <p>SSL: {domains?.ssl_status ?? "not_configured"}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
