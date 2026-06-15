import {
  generatePublicPlatformBlogIndexMetadata,
  renderPublicPlatformBlogIndex
} from "@/components/platform-website/public-platform-blog";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformBlogIndexMetadata();
}

export default function BlogPage() {
  return renderPublicPlatformBlogIndex();
}
