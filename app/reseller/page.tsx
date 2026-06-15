import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/reseller");
}

export default function ResellerIndexPage() {
  return renderPublicPlatformPage("/reseller");
}
