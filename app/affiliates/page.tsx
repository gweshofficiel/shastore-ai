import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/affiliates");
}

export default function AffiliatesPage() {
  return renderPublicPlatformPage("/affiliates");
}
