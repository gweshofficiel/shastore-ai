import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const projectTypes = [
  {
    title: "Landing Page",
    description:
      "Build a single product landing page with AI copy, image upload, templates, drafts, and publishing.",
    href: "/dashboard/landings/new",
    label: "Start landing",
    meta: "Single product",
    steps: ["Product", "Template", "Publish"]
  },
  {
    title: "Multi-Category Store",
    description:
      "Prepare a store project for categories, products, store templates, and publishing.",
    href: "/dashboard/stores/new",
    label: "Start store",
    meta: "Store Mode",
    steps: ["Categories", "Products", "Storefront"]
  }
];

export default function NewProjectPage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Choose how you want to launch: a focused single-product landing page or a future-ready multi-category store."
        title="New project"
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {projectTypes.map((projectType) => (
          <Card
            className="group grid gap-6 p-6 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_22px_70px_-48px_rgba(15,23,42,0.95)] lg:p-8"
            key={projectType.title}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {projectType.meta}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
                {projectType.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {projectType.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {projectType.steps.map((step, index) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition group-hover:border-slate-300 group-hover:bg-white"
                  key={step}
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm font-bold text-ink">{step}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Project type
              </span>
              <ButtonLink className="shrink-0" href={projectType.href}>
                {projectType.label}
              </ButtonLink>
            </div>
          </Card>
        ))}
      </div>
      <Card className="border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold leading-6 text-muted">
          Landing pages keep using the existing builder and publish flow. Store
          Mode is prepared as a separate path for upcoming ecommerce features.
        </p>
      </Card>
    </div>
  );
}
