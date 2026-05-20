import { PageHeader } from "@/components/dashboard/page-header";
import { TemplateCard } from "@/components/templates/template-card";
import { landingTemplates } from "@/templates/registry";

export default function TemplatesPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        description="Reusable React templates define the page structure. AI generates structured copy that fills approved sections and placeholders."
        title="Templates"
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {landingTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
