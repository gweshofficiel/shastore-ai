import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/blog");
}

export default function BlogPage() {
  return renderPublicPlatformPage("/blog");
}
