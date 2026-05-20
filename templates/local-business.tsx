import { ProductionLandingTemplate } from "@/templates/production-engine";
import type { PublishedLanding } from "@/types/landing";

export function LocalBusinessTemplate({ landing }: { landing: PublishedLanding }) {
  return <ProductionLandingTemplate landing={landing} templateId="local-business" />;
}
