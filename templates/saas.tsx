import { BaseLandingTemplate, templateThemes } from "@/templates/base-template";
import type { PublishedLanding } from "@/types/landing";

export function SaaSTemplate({ landing }: { landing: PublishedLanding }) {
  return <BaseLandingTemplate landing={landing} theme={templateThemes.saas} />;
}
