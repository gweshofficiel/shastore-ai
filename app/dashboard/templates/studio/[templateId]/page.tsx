import { notFound } from "next/navigation";
import { TemplateStudio } from "@/components/templates/template-studio";
import { getSavedTemplateDraft } from "@/lib/template-studio/actions";
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

  const savedDraft = await getSavedTemplateDraft(template.id);

  return (
    <TemplateStudio
      actionPath={`/dashboard/templates/studio/${template.id}`}
      backPath="/dashboard/templates"
      initialCustomization={savedDraft?.customization}
      initialStatus={savedDraft?.status}
      lastSavedAt={savedDraft?.updatedAt}
      template={template}
      variant="seller"
    />
  );
}
