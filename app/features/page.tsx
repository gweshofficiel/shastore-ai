import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/features");
}

export default function FeaturesPage() {
  return renderPublicPlatformPage("/features");
}
