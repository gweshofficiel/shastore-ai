import { PageHeader } from "@/components/dashboard/page-header";
import { LandingBuilder } from "@/components/dashboard/landing-builder";
import { publishLandingPage } from "@/lib/landing-actions";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewLandingPage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; error?: string }>;
}) {
  const query = await searchParams;
  const limitError = query.error === "limit-reached" ? query.detail : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Create a product landing page, generate AI marketing copy, select a template, and publish instantly."
        title="Create landing page"
      />
      {limitError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-amber-800">{limitError}</p>
            <ButtonLink href="/dashboard/billing">Upgrade plan</ButtonLink>
          </div>
        </Card>
      ) : null}
      <LandingBuilder publishLandingPage={publishLandingPage} />
    </div>
  );
}
