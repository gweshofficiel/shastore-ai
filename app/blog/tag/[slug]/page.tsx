import {
  generatePublicPlatformBlogTagMetadata,
  renderPublicPlatformBlogTag
} from "@/components/platform-website/public-platform-blog";

export const dynamic = "force-dynamic";

type BlogTagPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogTagPageProps) {
  const { slug } = await params;

  return generatePublicPlatformBlogTagMetadata(slug);
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { slug } = await params;

  return renderPublicPlatformBlogTag(slug);
}
