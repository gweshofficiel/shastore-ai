import { notFound } from "next/navigation";
import {
  generatePublicPlatformBlogCategoryMetadata,
  renderPublicPlatformBlogCategory
} from "@/components/platform-website/public-platform-blog";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocaleBlogCategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: LocaleBlogCategoryPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformBlogCategoryMetadata(slug, locale);
}

export default async function LocaleBlogCategoryPage({ params }: LocaleBlogCategoryPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformBlogCategory(slug, locale);
}
