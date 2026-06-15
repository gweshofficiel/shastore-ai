import { notFound } from "next/navigation";
import {
  generatePublicPlatformBlogTagMetadata,
  renderPublicPlatformBlogTag
} from "@/components/platform-website/public-platform-blog";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocaleBlogTagPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: LocaleBlogTagPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformBlogTagMetadata(slug, locale);
}

export default async function LocaleBlogTagPage({ params }: LocaleBlogTagPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformBlogTag(slug, locale);
}
