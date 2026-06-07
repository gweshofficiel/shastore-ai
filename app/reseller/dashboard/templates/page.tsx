import { PageHeader } from "@/components/dashboard/page-header";
import {
  ResellerStatusAlerts,
  ResellerTemplateInventoryCard
} from "@/components/reseller-showcase/dashboard-panels";
import { StoreTemplateCard } from "@/components/templates/store-template-card";
import { getResellerTemplateInventoryData } from "@/lib/reseller-showcase/data";
import { storeTemplateCategories, storeTemplates } from "@/lib/template-studio/library";

export const dynamic = "force-dynamic";

export default async function ResellerTemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, inventory] = await Promise.all([
    searchParams,
    getResellerTemplateInventoryData()
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Select a ready-made store template, customize it for a client in Studio, then prepare reseller showcase or marketplace publishing placeholders."
        title="Template Library"
      />
      <ResellerStatusAlerts query={query} />
      <ResellerTemplateInventoryCard inventory={inventory} variant="full" />
      <div className="grid gap-3 rounded-[2rem] border border-violet-100 bg-white/80 p-5 shadow-[0_18px_60px_-48px_rgba(76,29,149,0.45)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">
          Reseller Categories
        </p>
        <div className="flex flex-wrap gap-2">
          {storeTemplateCategories.map((category) => (
            <span
              className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-black text-violet-700"
              key={category.key}
            >
              {category.name}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {storeTemplates.map((template) => (
          <StoreTemplateCard
            basePath="/reseller/dashboard/templates"
            key={template.id}
            template={template}
          />
        ))}
      </div>
    </div>
  );
}
