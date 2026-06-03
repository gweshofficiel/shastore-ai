import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import {
  canCreateStore,
  getCurrentUserSubscriptionAccess
} from "@/lib/billing/access";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";
import { createStoreFromTemplateAction } from "@/lib/store-actions";
import { getTemplateLibrary, type StoreTemplateRecord } from "@/lib/storefront/template-library";

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

export default async function NewStorePage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; device?: string; error?: string; templateId?: string }>;
}) {
  const query = await searchParams;
  const library = await getTemplateLibrary();
  const templates = library.templates;
  const selectedTemplate =
    templates.find((template) => template.id === query.templateId || template.slug === query.templateId) ??
    templates[0] ??
    null;
  const selectedDevice = query.device === "tablet" || query.device === "mobile" ? query.device : "desktop";
  const access = await getCurrentUserSubscriptionAccess();
  const canCreate = access ? canCreateStore(access) : true;
  const storeUpgrade = access
    ? getRecommendedUpgrade({
        blockedResource: "stores",
        currentPlanId: access.plan.id,
        needsUnlimited: access.plan.id === "pro"
      })
    : null;
  const databaseError =
    query.error === "REAL_DATABASE_ERROR"
      ? query.detail ??
        "The store draft could not be saved to the database. Confirm stores RLS migrations are applied."
      : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        title="Create store"
        description="Choose a template first. SHASTORE creates the store automatically, then you manage name, branding, languages, currencies, navigation, theme, domains, and SEO inside Manage Store."
      />

      <div className="grid gap-6">
        {databaseError ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">Database error: {databaseError}</p>
          </Card>
        ) : null}
        <Card className="border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Shopify/Wix style flow: preview a template, apply it, then finish setup inside Manage Store.
          </p>
        </Card>
        {access ? (
          <Card className="border-slate-200 bg-white p-5">
            <div>
              <div>
                <p className="text-sm font-black text-ink">
                  Current plan: {access.plan.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  Stores used: {access.usage.storesUsed} / {formatLimit(access.usage.storeLimit)}
                </p>
              </div>
            </div>
          </Card>
        ) : null}
        {!canCreate && access ? (
          <UpgradeRequiredCard
            blockedAction="Store limit reached"
            currentPlan={access.plan.name}
            reason={storeUpgrade?.reason ?? "Store limit reached on your current plan."}
            recommendedPlan={storeUpgrade?.planName ?? "Pro"}
            recommendedPlanId={storeUpgrade?.planId}
          />
        ) : null}

        {canCreate ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <section className="grid gap-4">
              <Card className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Step 1
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                  Choose a template
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Template selection comes first. Store details are configured later from Manage Store.
                </p>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <TemplateCard
                    device={selectedDevice}
                    isSelected={selectedTemplate?.id === template.id}
                    key={template.id}
                    template={template}
                  />
                ))}
              </div>
            </section>

            <aside className="grid gap-4 self-start xl:sticky xl:top-6">
              <Card className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Step 2
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                  Preview template
                </h2>
                {selectedTemplate ? (
                  <TemplatePreviewPanel device={selectedDevice} template={selectedTemplate} />
                ) : (
                  <p className="mt-3 text-sm font-bold text-muted">No templates are available yet.</p>
                )}
              </Card>

              {selectedTemplate ? (
                <Card className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Step 3 + 4
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                    Apply and create store
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    SHASTORE will create a draft store with this template and open Manage Store.
                  </p>
                  <form action={createStoreFromTemplateAction} className="mt-5">
                    <input name="templateId" type="hidden" value={selectedTemplate.id} />
                    <Button className="w-full" type="submit">
                      Apply template and create store
                    </Button>
                  </form>
                </Card>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TemplateVisual({ template }: { template: StoreTemplateRecord }) {
  return (
    <div
      className="relative flex min-h-48 overflow-hidden rounded-[1.75rem] p-5 text-white"
      style={{
        background: template.preview_gradient ?? "linear-gradient(135deg,#0f172a,#2563eb)"
      }}
    >
      {template.preview_image ? (
        <img
          alt={template.name}
          className="absolute inset-0 h-full w-full object-cover"
          src={template.preview_image}
        />
      ) : null}
      <div className="absolute inset-0 bg-slate-950/35" />
      <div className="relative mt-auto">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
          {template.category_key}
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">{template.name}</h3>
      </div>
    </div>
  );
}

function TemplateCard({
  device,
  isSelected,
  template
}: {
  device: string;
  isSelected: boolean;
  template: StoreTemplateRecord;
}) {
  const previewHref = `/dashboard/stores/new?templateId=${encodeURIComponent(template.id)}&device=${encodeURIComponent(device)}`;

  return (
    <Card className={`grid gap-4 p-4 ${isSelected ? "ring-2 ring-slate-950" : ""}`}>
      <TemplateVisual template={template} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          {template.category_key}
        </p>
        <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">{template.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-muted">
          {template.preview_summary ?? template.description ?? "Storefront template"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-ink transition hover:border-slate-300 hover:bg-slate-50"
          href={previewHref}
        >
          Preview
        </a>
        <form action={createStoreFromTemplateAction}>
          <input name="templateId" type="hidden" value={template.id} />
          <Button type="submit">Apply</Button>
        </form>
      </div>
    </Card>
  );
}

function TemplatePreviewPanel({
  device,
  template
}: {
  device: string;
  template: StoreTemplateRecord;
}) {
  const widths: Record<string, string> = {
    desktop: "w-full",
    mobile: "mx-auto w-[220px]",
    tablet: "mx-auto w-[320px]"
  };
  const deviceTabs = ["desktop", "tablet", "mobile"];

  return (
    <div className="mt-5 grid gap-4">
      <div className="flex flex-wrap gap-2">
        {deviceTabs.map((item) => (
          <a
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
              item === device ? "bg-slate-950 text-white" : "bg-slate-100 text-muted"
            }`}
            href={`/dashboard/stores/new?templateId=${encodeURIComponent(template.id)}&device=${item}`}
            key={item}
          >
            {item}
          </a>
        ))}
      </div>
      <div className="rounded-[2rem] bg-slate-100 p-4">
        <div className={`${widths[device] ?? widths.desktop} overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl`}>
          <TemplateVisual template={template} />
          <div className="grid gap-3 p-4">
            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            <div className={device === "mobile" ? "grid gap-2" : "grid grid-cols-3 gap-2"}>
              {[0, 1, 2].map((item) => (
                <div className="h-20 rounded-2xl bg-slate-100" key={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold leading-6 text-muted">
        Preview is structural only. Real products, logo, contact, languages, currencies, navigation, theme, domains, and SEO are configured after creation in Manage Store.
      </p>
    </div>
  );
}