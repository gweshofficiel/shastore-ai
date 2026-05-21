import { notFound } from "next/navigation";
import { TemplateStudio } from "@/components/templates/template-studio";
import { getSavedTemplateDraft } from "@/lib/template-studio/actions";
import { getStoreTemplate } from "@/lib/template-studio/library";

export default async function ResellerTemplateStudioPage({
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
      actionPath={`/reseller/dashboard/templates/studio/${template.id}`}
      backPath="/reseller/dashboard/templates"
      initialCustomization={savedDraft?.customization}
      initialStatus={savedDraft?.status}
      lastSavedAt={savedDraft?.updatedAt}
      template={template}
      variant="reseller"
    />
  );
}
