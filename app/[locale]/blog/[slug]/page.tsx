import { notFound } from "next/navigation";
import {
  generatePublicPlatformBlogPostMetadata,
  renderPublicPlatformBlogPost
} from "@/components/platform-website/public-platform-blog";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export const dynamic = "force-dynamic";

type LocaleBlogPostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: LocaleBlogPostPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    return {};
  }

  return generatePublicPlatformBlogPostMetadata(slug, locale);
}

export default async function LocaleBlogPostPage({ params }: LocaleBlogPostPageProps) {
  const { locale, slug } = await params;

  if (!isPlatformLocale(locale)) {
    notFound();
  }

  return renderPublicPlatformBlogPost(slug, locale);
}
