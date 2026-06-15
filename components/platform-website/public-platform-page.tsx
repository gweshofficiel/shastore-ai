import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { ButtonLink } from "@/components/ui/button";
import {
  resolvePlatformPageRoute,
  type PublicPlatformPage
} from "@/src/lib/platform-website/public-page-resolver";
import {
  buildPlatformPageMetadata,
  unpublishedPlatformPageMetadata
} from "@/src/lib/platform-website/platform-seo-runtime";
import { getPlatformPageTranslation } from "@/src/lib/platform-website/platform-translations-runtime";

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

export function PublicPlatformPageView({ page }: { page: PublicPlatformPage }) {
  const sections = bodySections(page.body);
  const direction = "direction" in page && page.direction === "rtl" ? "rtl" : "ltr";
  const locale = "locale" in page && typeof page.locale === "string" ? page.locale : "en";

  return (
    <div dir={direction} lang={locale}>
      <MarketingNavbar />
      <main className="bg-canvas">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
            SHASTORE AI
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-6xl">
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
      </main>
    </div>
  );
}

export async function generatePublicPlatformPageMetadata(path: string, locale?: string): Promise<Metadata> {
  const page = await resolvePlatformPageRoute(path);

  if (!page) {
    return unpublishedPlatformPageMetadata();
  }

  return buildPlatformPageMetadata(locale ? getPlatformPageTranslation(page, locale) : page);
}

export async function renderPublicPlatformPage(path: string, locale?: string) {
  const page = await resolvePlatformPageRoute(path);

  if (!page) {
    notFound();
  }

  return <PublicPlatformPageView page={locale ? getPlatformPageTranslation(page, locale) : page} />;
}
