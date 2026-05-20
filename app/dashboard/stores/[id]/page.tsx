import { notFound } from "next/navigation";
import { CopyStoreUrlButton } from "@/components/dashboard/copy-store-url-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeStoreThemeSettings } from "@/lib/store-theme";
import {
  publishStoreDraft,
  saveStorePublicationSettings,
  saveStoreThemeSettings,
  unpublishStore
} from "@/lib/store-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicationRow = {
  slug: string;
  url?: string | null;
  status?: string | null;
  visibility?: string | null;
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  favicon_url?: string | null;
  social_image_url?: string | null;
  custom_domain?: string | null;
  subdomain?: string | null;
  hostname?: string | null;
};

export default async function StoreDraftPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    published?: string;
    unpublished?: string;
    error?: string;
    theme?: string;
    publication?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!store) {
    notFound();
  }

  const [{ data: categories }, { data: products }, { data: themeRow }] = await Promise.all([
    supabase
      .from("store_categories")
      .select("id, name, description, image_url, sort_order")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_products")
      .select("id, name, description, price, image_url, category_id, sort_order")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_theme_settings")
      .select("settings")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const themeSettings = normalizeStoreThemeSettings(themeRow?.settings);
  const { data: rawPublication } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", store.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as PublicationRow | null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/stores/new">Create another store</ButtonLink>}
        description="Review the saved Store Mode draft. Public store publishing is not enabled yet."
        title={store.name}
      />
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store draft saved successfully.
          </p>
        </Card>
      ) : null}
      {query.published ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store published successfully.
          </p>
        </Card>
      ) : null}
      {query.unpublished ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-700">
            Store unpublished. Public access is now disabled.
          </p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      {query.theme === "saved" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Store theme settings saved.
          </p>
        </Card>
      ) : null}
      {query.publication === "saved" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Publication and SEO settings saved.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store draft
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {store.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {store.description || "No store description yet."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {publication?.status ?? store.status}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {publication?.visibility ?? "private"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {store.template_id}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              {store.currency}
            </span>
            {store.whatsapp_number ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                WhatsApp connected
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Published{" "}
              {publication?.published_at
                ? new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }).format(new Date(publication.published_at))
                : "not yet"}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard/stores" variant="secondary">
              Back to stores
            </ButtonLink>
            {publication?.status === "published" ? (
              <>
                {publication.visibility !== "private" ? (
                  <>
                    <ButtonLink href={`/store/${publication.slug}`} target="_blank">
                      Open public store
                    </ButtonLink>
                    <CopyStoreUrlButton url={`/store/${publication.slug}`} />
                  </>
                ) : null}
                <form action={unpublishStore}>
                  <input name="storeId" type="hidden" value={store.id} />
                  <Button type="submit" variant="secondary">
                    Unpublish
                  </Button>
                </form>
              </>
            ) : (
              <form action={publishStoreDraft}>
                <input name="storeId" type="hidden" value={store.id} />
                <Button type="submit">
                  {publication?.status === "unpublished" ? "Republish store" : "Publish store"}
                </Button>
              </form>
            )}
            <ButtonLink href="/dashboard/stores/new" variant="secondary">
              New draft
            </ButtonLink>
          </div>
        </Card>
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Live preview snapshot
          </p>
          <div className="mt-5 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <div
              className="mb-4 h-3 w-3 rounded-full"
              style={{ backgroundColor: store.brand_color }}
            />
            <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
              {store.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {store.description || "A premium store homepage draft."}
            </p>
            <div className="mt-5 grid gap-2">
              {(products ?? []).slice(0, 3).map((product) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
                  key={product.id}
                >
                  <p className="text-sm font-bold text-ink">{product.name}</p>
                  <p className="text-xs font-black text-slate-400">
                    {product.price || store.currency}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Publishing and domains
          </p>
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Store publication foundation
          </h2>
          <p className="text-sm leading-6 text-muted">
            Manage SEO, visibility, and future custom domain fields without changing
            the public store route.
          </p>
        </div>
        <form action={saveStorePublicationSettings} className="mt-5 grid gap-5">
          <input name="storeId" type="hidden" value={store.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Visibility</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={publication?.visibility ?? "public"}
                name="visibility"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <Input
              defaultValue={publication?.subdomain ?? ""}
              id="publication-subdomain"
              label="Future subdomain"
              name="subdomain"
              placeholder="my-store"
            />
            <Input
              defaultValue={publication?.custom_domain ?? ""}
              id="publication-custom-domain"
              label="Future custom domain"
              name="customDomain"
              placeholder="shop.example.com"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={publication?.seo_title ?? ""}
              id="publication-seo-title"
              label="SEO title"
              name="seoTitle"
              placeholder={store.name}
            />
            <Input
              defaultValue={publication?.og_title ?? ""}
              id="publication-og-title"
              label="OpenGraph title"
              name="ogTitle"
              placeholder={store.name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea
              defaultValue={publication?.seo_description ?? ""}
              id="publication-seo-description"
              label="SEO description"
              name="seoDescription"
              placeholder={store.description || "Search result description"}
            />
            <Textarea
              defaultValue={publication?.og_description ?? ""}
              id="publication-og-description"
              label="OpenGraph description"
              name="ogDescription"
              placeholder={store.description || "Social preview description"}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={publication?.favicon_url ?? ""}
              id="publication-favicon"
              label="Favicon URL"
              name="faviconUrl"
              placeholder="https://example.com/favicon.png"
            />
            <Input
              defaultValue={publication?.social_image_url ?? ""}
              id="publication-social-image"
              label="Social preview image"
              name="socialImageUrl"
              placeholder="https://example.com/og.jpg"
            />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
            <p className="font-bold text-ink">Publication hostname</p>
            <p className="mt-1">
              {publication?.hostname ||
                "Add a subdomain or custom domain to reserve a future hostname."}
            </p>
            <p className="mt-2">
              DNS provisioning is intentionally not enabled yet. Localhost and
              /store/{publication?.slug ?? "slug"} continue to work normally.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <Button type="submit">Save publication settings</Button>
            {publication?.slug ? (
              <CopyStoreUrlButton url={`/store/${publication.slug}`} />
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Theme customization
          </p>
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Edit saved theme settings
          </h2>
          <p className="text-sm leading-6 text-muted">
            These settings use the existing store theme table and update the public
            storefront after save.
          </p>
        </div>
        <form action={saveStoreThemeSettings} className="mt-5 grid gap-5">
          <input name="storeId" type="hidden" value={store.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.primaryColor}
              id="saved-theme-primary"
              label="Primary color"
              name="themePrimaryColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.secondaryColor}
              id="saved-theme-secondary"
              label="Secondary color"
              name="themeSecondaryColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.accentColor}
              id="saved-theme-accent"
              label="Accent color"
              name="themeAccentColor"
              type="color"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.gradientFrom}
              id="saved-theme-gradient-from"
              label="Gradient from"
              name="themeGradientFrom"
              type="color"
            />
            <Input
              defaultValue={themeSettings.gradientTo}
              id="saved-theme-gradient-to"
              label="Gradient to"
              name="themeGradientTo"
              type="color"
            />
            <Input
              accept="image/*"
              id="saved-theme-logo-upload"
              label="Logo upload"
              name="logoImage"
              type="file"
            />
          </div>
          <Input
            defaultValue={themeSettings.logoUrl}
            id="saved-theme-logo-url"
            label="Logo URL"
            name="themeLogoUrl"
            placeholder="https://example.com/logo.png"
          />
          <Input
            defaultValue={themeSettings.announcementText}
            id="saved-theme-announcement"
            label="Announcement bar"
            name="themeAnnouncementText"
            placeholder="Free delivery this week"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue={themeSettings.heroTitle}
              id="saved-theme-hero-title"
              label="Hero title"
              name="themeHeroTitle"
              placeholder={store.name}
            />
            <Input
              defaultValue={themeSettings.ctaText}
              id="saved-theme-cta"
              label="CTA text"
              name="themeCtaText"
            />
          </div>
          <Textarea
            defaultValue={themeSettings.heroSubtitle}
            id="saved-theme-hero-subtitle"
            label="Hero subtitle"
            name="themeHeroSubtitle"
            placeholder={store.description || "Premium storefront subtitle"}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Button style</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.buttonStyle}
                name="themeButtonStyle"
              >
                <option value="pill">Pill</option>
                <option value="rounded">Rounded</option>
                <option value="sharp">Sharp</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Heading font</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.headingFont}
                name="themeHeadingFont"
              >
                <option value="inter">Modern sans</option>
                <option value="serif">Editorial serif</option>
                <option value="display">Premium display</option>
                <option value="mono">Tech mono</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Font scale</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={themeSettings.fontScale}
                name="themeFontScale"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              defaultValue={themeSettings.footerBackgroundColor}
              id="saved-theme-footer-background"
              label="Footer background"
              name="themeFooterBackgroundColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.footerTextColor}
              id="saved-theme-footer-text"
              label="Footer text"
              name="themeFooterTextColor"
              type="color"
            />
            <Input
              defaultValue={themeSettings.copyrightText}
              id="saved-theme-copyright"
              label="Copyright text"
              name="themeCopyrightText"
              placeholder="© 2026 Your Store"
            />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <Button type="submit">Save theme settings</Button>
            {publication?.status === "published" ? (
              <ButtonLink href={`/store/${publication.slug}`} target="_blank" variant="secondary">
                Preview public store
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 lg:p-6">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Categories
          </h2>
          <div className="mt-5 grid gap-3">
            {(categories ?? []).length ? (
              (categories ?? []).map((category) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={category.id}
                >
                  {category.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={category.name}
                      className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover"
                      src={category.image_url}
                    />
                  ) : (
                    <div className="mb-4 flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Category image
                    </div>
                  )}
                  <p className="font-bold text-ink">{category.name}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {category.description || "No category description."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No categories saved yet.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-5 lg:p-6">
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
            Products
          </h2>
          <div className="mt-5 grid gap-3">
            {(products ?? []).length ? (
              (products ?? []).map((product) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={product.id}
                >
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={product.name}
                      className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover"
                      src={product.image_url}
                    />
                  ) : (
                    <div className="mb-4 flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Product image
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-ink">{product.name}</p>
                    <p className="shrink-0 text-sm font-black text-ink">
                      {product.price || store.currency}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {product.description || "No product description."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">No products saved yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
