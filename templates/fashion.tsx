import { ProductionLandingTemplate } from "@/templates/production-engine";
import type { PublishedLanding } from "@/types/landing";

export function FashionTemplate({ landing }: { landing: PublishedLanding }) {
  return <ProductionLandingTemplate landing={landing} templateId="fashion" />;
}
