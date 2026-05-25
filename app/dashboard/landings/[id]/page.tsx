import { notFound } from "next/navigation";
import { LandingBuilder } from "@/components/dashboard/landing-builder";
import { PageHeader } from "@/components/dashboard/page-header";
import { normalizeLandingThemeSettings } from "@/lib/landing-theme";
import { updateLandingPage } from "@/lib/landing-actions";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import type { AiLandingCopy, PaymentMethod, TemplateId } from "@/types/landing";

export const dynamic = "force-dynamic";

type EditLandingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeTemplateId(value: string): TemplateId {
  const supported: TemplateId[] = [
    "minimal",
    "luxury",
    "beauty",
    "gadget",
    "fashion",
    "saas",
    "local-business"
  ];

  return supported.includes(value as TemplateId) ? (value as TemplateId) : "minimal";
}

export default async function EditLandingPage({ params }: EditLandingPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;

  const { data: landing } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("id", id)
    .eq("workspace_id" as never, workspaceId as never)
    .single();

  if (!landing) {
    notFound();
  }

  const aiCopy = landing.ai_copy as AiLandingCopy | null;

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Edit product details, landing theme, template, payment methods, SEO, and publishing status."
        title={`Edit ${landing.product_name}`}
      />
      <LandingBuilder
        initialData={{
          id: landing.id,
          aiCopy,
          brandColor: landing.brand_color,
          comparePrice: aiCopy?.comparePrice ?? "",
          ctaText: aiCopy?.themeSettings?.ctaText ?? aiCopy?.ctaText ?? "Order on WhatsApp",
          heroImageUrl: landing.hero_image_url,
          longDescription: aiCopy?.description ?? "",
          paymentMethods: aiCopy?.paymentMethods?.length
            ? aiCopy.paymentMethods
            : (["whatsapp"] as PaymentMethod[]),
          productName: landing.product_name,
          productPrice: landing.product_price,
          seoDescription: aiCopy?.seoDescription ?? "",
          seoTitle: aiCopy?.seoTitle ?? "",
          shortDescription: landing.product_description,
          templateId: normalizeTemplateId(landing.template_id),
          themeSettings: normalizeLandingThemeSettings(aiCopy?.themeSettings),
          whatsappNumber: landing.whatsapp_number
        }}
        mode="edit"
        publishLandingPage={updateLandingPage}
      />
    </div>
  );
}
