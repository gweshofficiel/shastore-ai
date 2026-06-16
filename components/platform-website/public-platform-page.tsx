import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { ButtonLink } from "@/components/ui/button";
import {
  resolvePlatformPageRoute,
  type PublicPlatformPage
} from "@/src/lib/platform-website/public-page-resolver";
import {
  getPublishedPageBlocks,
  translatePlatformPageBlock,
  type PlatformPageBlockRecord
} from "@/src/lib/platform-website/platform-blocks-runtime";
import {
  buildPlatformPageMetadata,
  unpublishedPlatformPageMetadata
} from "@/src/lib/platform-website/platform-seo-runtime";
import { getPlatformPageTranslation } from "@/src/lib/platform-website/platform-translations-runtime";
import { trackPlatformPageView } from "@/src/lib/platform-website/analytics/platform-analytics-service";
import {
  resolvePlatformBranding,
  type PlatformBranding
} from "@/src/lib/platform-theme/public-platform-theme-resolver";
import {
  buildPlatformLocaleThemeAttributes,
  getPlatformLocaleTheme
} from "@/src/lib/platform-theme/platform-locale-theme-runtime";

function text(value: unknown, maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function bodySections(body: Record<string, unknown>) {
  const sections = Array.isArray(body.sections) ? body.sections : [];

  return sections
    .map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return null;
      }

      const value = section as Record<string, unknown>;
      const heading = text(value.heading ?? value.title, 180);
      const content = text(value.text ?? value.content ?? value.body, 3000);

      return heading || content ? { content, heading } : null;
    })
    .filter((section): section is { content: string; heading: string } => Boolean(section));
}

function blockItems(content: Record<string, unknown>) {
  const items = Array.isArray(content.items) ? content.items : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const value = item as Record<string, unknown>;
      const title = text(value.title ?? value.heading ?? value.label, 180);
      const description = text(value.description ?? value.text ?? value.content, 1200);

      return title || description ? { description, title } : null;
    })
    .filter((item): item is { description: string; title: string } => Boolean(item));
}

function PublicPlatformBlock({ block }: { block: PlatformPageBlockRecord }) {
  const items = blockItems(block.content);
  const body = text(block.content.text ?? block.content.body ?? block.content.description, 3000);

  return (
    <section className="border-t border-line bg-white py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{block.blockType}</p>
          {block.title ? (
            <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">{block.title}</h2>
          ) : null}
          {block.subtitle ? (
            <p className="mt-3 text-base leading-8 text-muted">{block.subtitle}</p>
          ) : null}
          {body ? (
            <p className="mt-4 whitespace-pre-line text-base leading-8 text-muted">{body}</p>
          ) : null}
        </div>
        {items.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {items.map((item, index) => (
              <article className="rounded-[2rem] border border-line bg-canvas p-5" key={`${item.title}-${index}`}>
                {item.title ? <h3 className="font-black text-ink">{item.title}</h3> : null}
                {item.description ? <p className="mt-2 text-sm leading-7 text-muted">{item.description}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function platformThemeStyle(branding: PlatformBranding, locale: string): CSSProperties {
  const localeTheme = getPlatformLocaleTheme(locale);

  return {
    ...branding.cssVariables,
    fontFamily: localeTheme.fontFamily
  } as CSSProperties;
}

export function PublicPlatformPageView({
  blocks = [],
  branding,
  page
}: {
  blocks?: PlatformPageBlockRecord[];
  branding: PlatformBranding;
  page: PublicPlatformPage;
}) {
  const sections = bodySections(page.body);
  const locale = "locale" in page && typeof page.locale === "string" ? page.locale : "en";
  const localeThemeAttributes = buildPlatformLocaleThemeAttributes(locale);

  return (
    <div
      className={localeThemeAttributes.className}
      dir={localeThemeAttributes.dir}
      lang={localeThemeAttributes.lang}
      style={platformThemeStyle(branding, locale)}
    >
      <MarketingNavbar logoUrl={branding.logoUrl} />
      <main className="bg-canvas">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted" style={{ color: "var(--platform-secondary)" }}>
            SHASTORE AI
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-6xl" style={{ color: "var(--platform-primary)" }}>
            {page.headline}
          </h1>
          {page.subtitle ? (
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted">
              {page.subtitle}
            </p>
          ) : null}
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/register">Start with SHASTORE AI</ButtonLink>
          </div>
        </section>

        {blocks.length ? (
          blocks.map((block) => (
            <PublicPlatformBlock block={block} key={block.id} />
          ))
        ) : (
          <section className="border-t border-line bg-white py-16">
            <div className="mx-auto grid max-w-4xl gap-6 px-4 sm:px-6 lg:px-8">
              {sections.length ? (
              sections.map((section, index) => (
                <article className="rounded-[2rem] border border-line bg-canvas p-6 shadow-sm" key={`${section.heading}-${index}`}>
                  {section.heading ? (
                    <h2 className="text-2xl font-black tracking-tight text-ink">{section.heading}</h2>
                  ) : null}
                  {section.content ? (
                    <p className="mt-3 whitespace-pre-line text-base leading-8 text-muted">{section.content}</p>
                  ) : null}
                </article>
              ))
              ) : (
                <article className="rounded-[2rem] border border-line bg-canvas p-6 shadow-sm">
                  <h2 className="text-2xl font-black tracking-tight text-ink">{page.title}</h2>
                  <p className="mt-3 text-base leading-8 text-muted">
                    This platform page is live. Content sections are being prepared.
                  </p>
                </article>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export async function generatePublicPlatformPageMetadata(path: string, locale?: string): Promise<Metadata> {
  const page = await resolvePlatformPageRoute(path);

  if (!page) {
    return unpublishedPlatformPageMetadata();
  }

  const metadata = buildPlatformPageMetadata(locale ? getPlatformPageTranslation(page, locale) : page);
  const branding = await resolvePlatformBranding();

  return branding.faviconUrl
    ? {
        ...metadata,
        icons: {
          icon: [{ url: branding.faviconUrl }]
        }
      }
    : metadata;
}

export async function renderPublicPlatformPage(path: string, locale?: string) {
  const page = await resolvePlatformPageRoute(path);

  if (!page) {
    notFound();
  }

  const blocks = (await getPublishedPageBlocks(page.id)).map((block) => translatePlatformPageBlock(block, locale));
  const requestHeaders = await headers();
  await trackPlatformPageView({
    contentId: page.id,
    locale,
    path,
    referrer: requestHeaders.get("referer"),
    routePath: page.routePath,
    title: page.title
  });

  const branding = await resolvePlatformBranding();

  return (
    <PublicPlatformPageView
      blocks={blocks}
      branding={branding}
      page={locale ? getPlatformPageTranslation(page, locale) : page}
    />
  );
}
