import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminBadge, AdminHeader } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import { previewThemeVersion } from "@/src/lib/platform-theme/platform-theme-rollback";
import {
  buildThemePreviewMetadata,
  getPublishedThemePreview,
  getThemeDraftPreview,
  type PlatformThemePreview,
  type PlatformThemePreviewMode
} from "@/src/lib/platform-theme/platform-theme-preview-runtime";
import {
  platformLocales,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  searchParams?: Promise<{ locale?: string; mode?: string; versionId?: string }>;
};

type PreviewDisplay = Pick<
  PlatformThemePreview,
  "accentColor" | "cssVariables" | "faviconUrl" | "localeTheme" | "logoUrl" | "primaryColor" | "secondaryColor" | "typography"
> & {
  sourceVersionNumber?: number;
};

const sampleHeroCopy: Record<PlatformLocale, { cta: string; headline: string; subtitle: string; tagline: string }> = {
  ar: {
    cta: "ابدأ مجانًا",
    headline: "أطلق متاجرك بعلامة منصة واحدة.",
    subtitle: "معاينة عامة للمنصة فقط. لا تؤثر على واجهات المتاجر.",
    tagline: "منصة SHASTORE"
  },
  en: {
    cta: "Start free",
    headline: "Launch stores with one platform brand.",
    subtitle: "Platform-only public page sample. Storefronts and customer stores are not affected.",
    tagline: "SHASTORE platform"
  },
  fr: {
    cta: "Commencer gratuitement",
    headline: "Lancez des boutiques avec une seule marque plateforme.",
    subtitle: "Aperçu public plateforme uniquement. Les vitrines client ne sont pas modifiées.",
    tagline: "Plateforme SHASTORE"
  }
};

const sampleNavCopy: Record<PlatformLocale, { login: string; pricing: string }> = {
  ar: { login: "تسجيل الدخول", pricing: "الأسعار" },
  en: { login: "Login", pricing: "Pricing" },
  fr: { login: "Connexion", pricing: "Tarifs" }
};

function safeMode(mode: string | undefined): PlatformThemePreviewMode {
  return mode === "published" ? "published" : "draft";
}

function safeLocale(locale: string | undefined): PlatformLocale {
  return platformLocales.includes(locale as PlatformLocale) ? locale as PlatformLocale : "en";
}

async function loadPreview(
  mode: PlatformThemePreviewMode,
  locale: PlatformLocale,
  versionId?: string
): Promise<PreviewDisplay> {
  if (versionId) {
    const versionPreview = await previewThemeVersion(versionId, locale);

    return {
      accentColor: versionPreview.accentColor,
      cssVariables: versionPreview.cssVariables,
      faviconUrl: versionPreview.faviconUrl,
      localeTheme: versionPreview.localeTheme,
      logoUrl: versionPreview.logoUrl,
      primaryColor: versionPreview.primaryColor,
      secondaryColor: versionPreview.secondaryColor,
      sourceVersionNumber: versionPreview.sourceVersionNumber,
      typography: versionPreview.typography
    };
  }

  return loadThemePreview(mode, locale);
}

async function loadThemePreview(mode: PlatformThemePreviewMode, locale: PlatformLocale): Promise<PreviewDisplay> {
  const preview = mode === "published" ? await getPublishedThemePreview(locale) : await getThemeDraftPreview(locale);

  return preview;
}

export async function generateMetadata({ searchParams }: PreviewPageProps): Promise<Metadata> {
  const params = await searchParams;

  if (params?.versionId) {
    return {
      description: "Admin-only preview of a platform theme version snapshot. Does not change public website or storefronts.",
      title: "Platform Theme Version Preview"
    };
  }

  return buildThemePreviewMetadata(params?.mode, params?.locale);
}

function previewStyle(preview: PreviewDisplay): CSSProperties {
  return {
    ...preview.cssVariables,
    fontFamily: preview.typography
  };
}

export default async function AdminPlatformThemePreviewPage({ searchParams }: PreviewPageProps) {
  const params = await searchParams;
  const versionId = params?.versionId?.trim() || undefined;
  const mode = safeMode(params?.mode);
  const locale = safeLocale(params?.locale);
  const preview = await loadPreview(mode, locale, versionId);
  const hero = sampleHeroCopy[locale];
  const nav = sampleNavCopy[locale];
  const directionAttributes = {
    className: preview.localeTheme.className,
    dir: preview.localeTheme.direction,
    lang: preview.localeTheme.lang
  };

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description={
          versionId
            ? "Admin-only preview of a saved platform theme version snapshot. This does not apply rollback or change the public website."
            : "Admin-only preview of platform theme drafts and published branding. This route does not change the public website, admin dashboard styling, or customer storefronts."
        }
        title={versionId ? `Platform Theme Version #${preview.sourceVersionNumber ?? ""} Preview` : "Platform Theme Preview"}
      />

      <Card className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {versionId ? (
            <AdminBadge tone="blue">Version #{preview.sourceVersionNumber} preview</AdminBadge>
          ) : (
            <AdminBadge tone={mode === "published" ? "green" : "amber"}>
              {mode === "published" ? "Published preview" : "Draft preview"}
            </AdminBadge>
          )}
          <AdminBadge tone="blue">Admin-only</AdminBadge>
          <AdminBadge tone={preview.localeTheme.isRtl ? "amber" : "green"}>{locale.toUpperCase()}</AdminBadge>
          <AdminBadge tone={preview.localeTheme.isRtl ? "amber" : "green"}>{preview.localeTheme.direction.toUpperCase()}</AdminBadge>
        </div>

        <div className="grid gap-3">
          {!versionId ? (
            <div className="flex flex-wrap gap-2">
              <Link
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                  mode === "draft"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
                href={`/admin/platform-theme/preview?mode=draft&locale=${locale}`}
              >
                Draft
              </Link>
              <Link
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                  mode === "published"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
                href={`/admin/platform-theme/preview?mode=published&locale=${locale}`}
              >
                Published
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {platformLocales.map((item) => (
              <Link
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                  locale === item
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
                href={`/admin/platform-theme/preview?${versionId ? `versionId=${versionId}&locale=${item}` : `mode=${mode}&locale=${item}`}`}
                key={item}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main
          className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 ${directionAttributes.className}`}
          dir={directionAttributes.dir}
          lang={directionAttributes.lang}
          style={previewStyle(preview)}
        >
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {preview.logoUrl ? (
                  <object
                    aria-label="Platform logo preview"
                    className="h-10 w-auto max-w-[160px]"
                    data={preview.logoUrl}
                    type="image/png"
                  >
                    <span className="text-sm font-black" style={{ color: preview.primaryColor }}>
                      SHASTORE AI
                    </span>
                  </object>
                ) : (
                  <span className="text-lg font-black" style={{ color: preview.primaryColor }}>
                    SHASTORE AI
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                <span>{nav.pricing}</span>
                <span>{nav.login}</span>
                <span
                  className="rounded-full px-3 py-2 text-white"
                  style={{ backgroundColor: preview.primaryColor }}
                >
                  {hero.cta}
                </span>
              </div>
            </div>
          </div>

          <section className="bg-white px-6 py-16 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: preview.secondaryColor }}>
              {hero.tagline}
            </p>
            <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] text-slate-950">
              {hero.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">{hero.subtitle}</p>
            <button
              className="mt-8 rounded-full px-6 py-3 text-sm font-black text-white"
              style={{ backgroundColor: preview.accentColor }}
              type="button"
            >
              {hero.cta}
            </button>
          </section>

          <section className="grid gap-4 px-5 py-5 md:grid-cols-3">
            {[
              { title: "Primary card", tone: preview.primaryColor },
              { title: "Secondary card", tone: preview.secondaryColor },
              { title: "Accent card", tone: preview.accentColor }
            ].map((card) => (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={card.title}>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: card.tone }}>
                  {card.title}
                </p>
                <h2 className="mt-3 text-xl font-black text-slate-950">Sample card surface</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Cards use platform theme colors and typography without touching storefront templates.
                </p>
              </article>
            ))}
          </section>

          <div className="bg-slate-950 px-5 py-4 text-sm font-semibold text-white">
            Footer preview placeholder — platform public website only
          </div>
        </main>

        <aside className="grid gap-4 self-start xl:sticky xl:top-6">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Theme metadata</p>
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">
              {versionId ? `Version #${preview.sourceVersionNumber} draft preview` : mode === "published" ? "Published values" : "Draft values"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {preview.localeTheme.previewDescription}
            </p>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
              <p>
                <span className="font-black text-slate-800">Mode:</span> {versionId ? "version snapshot" : mode}
              </p>
              <p>
                <span className="font-black text-slate-800">Locale:</span> {locale}
              </p>
              <p>
                <span className="font-black text-slate-800">Direction:</span> {preview.localeTheme.direction}
              </p>
              <p>
                <span className="font-black text-slate-800">Typography:</span> {preview.typography}
              </p>
            </div>
          </Card>

          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Color swatches</p>
            <div className="mt-4 grid gap-3">
              {[
                { label: "Primary", value: preview.primaryColor },
                { label: "Secondary", value: preview.secondaryColor },
                { label: "Accent", value: preview.accentColor }
              ].map((color) => (
                <div className="flex items-center gap-3" key={color.label}>
                  <span
                    aria-hidden="true"
                    className="h-10 w-10 rounded-2xl border border-slate-200"
                    style={{ backgroundColor: color.value }}
                  />
                  <div>
                    <p className="text-sm font-black text-slate-950">{color.label}</p>
                    <p className="text-xs font-semibold text-slate-500">{color.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Favicon preview</p>
            <div className="mt-4 flex items-center gap-4">
              {preview.faviconUrl ? (
                <object
                  aria-label="Platform favicon preview"
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white p-1"
                  data={preview.faviconUrl}
                  type="image/png"
                >
                  <span className="text-xs font-semibold text-slate-500">Icon</span>
                </object>
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-400">
                  —
                </div>
              )}
              <p className="text-sm font-semibold text-slate-500">
                {preview.faviconUrl ? "Favicon configured" : "No favicon configured"}
              </p>
            </div>
          </Card>

          <Card className="grid gap-3 p-5 text-sm leading-6 text-slate-500 lg:p-6">
            <Link
              className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
              href="/admin/platform-theme"
            >
              Back to theme control
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
