import { notFound } from "next/navigation";
import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformPageMetadata("/", locale);
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformPage("/", locale);
}
