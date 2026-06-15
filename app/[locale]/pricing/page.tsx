import { notFound } from "next/navigation";
import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocalePricingPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocalePricingPageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformPageMetadata("/pricing", locale);
}

export default async function LocalePricingPage({ params }: LocalePricingPageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformPage("/pricing", locale);
}
