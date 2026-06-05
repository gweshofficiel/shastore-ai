import { notFound } from "next/navigation";
import { ProductionTemplatePreview } from "@/components/templates/production-template-preview";
import { getProductionStoreTemplate } from "@/lib/storefront/template-library";

export default async function PublicTemplatePreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const { templateId } = await params;
  const query = await searchParams;
  const template = await getProductionStoreTemplate(templateId);
  const device = query.device === "mobile" || query.device === "tablet" ? query.device : "desktop";

  if (!template || (template.id !== templateId && template.slug !== templateId)) {
    notFound();
  }

  return (
    <ProductionTemplatePreview
      backHref="/"
      createHref={`/dashboard/stores/new?templateId=${encodeURIComponent(template.id)}&device=${device}`}
      device={device}
      template={template}
    />
  );
}
