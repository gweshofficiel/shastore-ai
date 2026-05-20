import { ProductionLandingTemplate } from "@/templates/production-engine";
import type { PublishedLanding } from "@/types/landing";

export function GadgetTemplate({ landing }: { landing: PublishedLanding }) {
  return <ProductionLandingTemplate landing={landing} templateId="gadget" />;
}
