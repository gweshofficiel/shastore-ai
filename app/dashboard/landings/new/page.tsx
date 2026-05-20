import { PageHeader } from "@/components/dashboard/page-header";
import { LandingBuilder } from "@/components/dashboard/landing-builder";
import { publishLandingPage } from "@/lib/landing-actions";

export const dynamic = "force-dynamic";

export default function NewLandingPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        description="Create a product landing page, generate AI marketing copy, select a template, and publish instantly."
        title="Create landing page"
      />
      <LandingBuilder publishLandingPage={publishLandingPage} />
    </div>
  );
}
