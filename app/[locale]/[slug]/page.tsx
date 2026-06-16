import { notFound } from "next/navigation";
import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

const localizedPlatformPages = new Set(["about", "contact", "features", "legal", "reseller"]);

type LocalePlatformPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

function routePath(slug: string) {
  return `/${slug}`;
}

export async function generateMetadata({ params }: LocalePlatformPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale) || !localizedPlatformPages.has(slug)) {
    return {};
  }

  return generatePublicPlatformPageMetadata(routePath(slug), locale);
}

export default async function LocalePlatformPage({ params }: LocalePlatformPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale) || !localizedPlatformPages.has(slug)) {
    notFound();
  }

  return renderPublicPlatformPage(routePath(slug), locale);
}
