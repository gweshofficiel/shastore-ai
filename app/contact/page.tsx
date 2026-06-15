import {
  generatePublicPlatformPageMetadata,
  renderPublicPlatformPage
} from "@/components/platform-website/public-platform-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePublicPlatformPageMetadata("/contact");
}

export default function ContactPage() {
  return renderPublicPlatformPage("/contact");
}
