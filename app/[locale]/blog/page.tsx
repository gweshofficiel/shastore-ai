import { notFound } from "next/navigation";
import {
  generatePublicPlatformBlogIndexMetadata,
  renderPublicPlatformBlogIndex
} from "@/components/platform-website/public-platform-blog";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocaleBlogPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocaleBlogPageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformBlogIndexMetadata(locale);
}

export default async function LocaleBlogPage({ params }: LocaleBlogPageProps) {
  const { locale } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformBlogIndex(locale);
}
