import { notFound } from "next/navigation";
import { TemplateStudio } from "@/components/templates/template-studio";
import { getStoreTemplate } from "@/lib/template-studio/library";

export default async function SellerTemplateStudioPage({
  params
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = getStoreTemplate(templateId);

  if (!template) {
    notFound();
  }

  return (
    <TemplateStudio
      actionPath={`/dashboard/templates/studio/${template.id}`}
      backPath="/dashboard/templates"
      template={template}
      variant="seller"
    />
  );
}
