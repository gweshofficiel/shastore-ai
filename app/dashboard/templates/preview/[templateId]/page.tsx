import { notFound } from "next/navigation";
import { DemoStorePreview } from "@/components/templates/demo-store-preview";
import { getStoreTemplate } from "@/lib/template-studio/library";

export default async function SellerTemplatePreviewPage({
  params
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = getStoreTemplate(templateId);

  if (!template) {
    notFound();
  }

  return <DemoStorePreview backHref="/dashboard/templates" template={template} />;
}
