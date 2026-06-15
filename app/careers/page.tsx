import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/careers");
}

export default function CareersPage() {
  return renderPublicPlatformPage("/careers");
}
