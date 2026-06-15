import {
  generatePublicPlatformBlogPostMetadata,
  renderPublicPlatformBlogPost
} from "@/components/platform-website/public-platform-blog";

export const dynamic = "force-dynamic";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug } = await params;

  return generatePublicPlatformBlogPostMetadata(slug);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  return renderPublicPlatformBlogPost(slug);
}
