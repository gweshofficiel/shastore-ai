import {
  generatePublicPlatformBlogCategoryMetadata,
  renderPublicPlatformBlogCategory
} from "@/components/platform-website/public-platform-blog";

export const dynamic = "force-dynamic";

type BlogCategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogCategoryPageProps) {
  const { slug } = await params;

  return generatePublicPlatformBlogCategoryMetadata(slug);
}

export default async function BlogCategoryPage({ params }: BlogCategoryPageProps) {
  const { slug } = await params;

  return renderPublicPlatformBlogCategory(slug);
}
