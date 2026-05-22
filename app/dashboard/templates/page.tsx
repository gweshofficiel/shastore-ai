import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { applyTemplateToStore } from "@/lib/template-application-actions";
import { mapTemplateToBuilderDraft, getTemplateLibrary } from "@/lib/storefront/template-library";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ClaimedStoreRow = {
  access_role?: string | null;
  id: string;
  internal_slug?: string | null;
  store_name?: string | null;
};

const statusMessages: Record<string, string> = {
  applied: "Template applied to the selected store draft. Published storefront remains unchanged.",
  "apply-failed": "Template application failed and rollback was attempted.",
  "draft-created": "Template draft was created.",
  "draft-failed": "Template draft could not be created.",
  "invalid-template": "Template schema is incomplete and cannot be applied.",
  "missing-selection": "Choose a store and template before applying.",
  "not-authorized": "You can only apply templates to stores you own or manage.",
  "sections-failed": "Template sections could not be applied.",
  "template-missing": "Template was not found.",
  "theme-applied": "Template theme was applied to the draft workspace.",
  "theme-failed": "Template theme could not be applied."
};

function appliedTemplateId(editorState: unknown) {
  if (!editorState || typeof editorState !== "object" || Array.isArray(editorState)) {
    return "";
  }

  const value = (editorState as Record<string, unknown>).templateId;
  return typeof value === "string" ? value : "";
}

async function getClaimedStores() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "get_claimed_store_instances_for_current_user" as never
  );

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as ClaimedStoreRow[]).filter(
    (store) => !store.access_role || store.access_role === "owner" || store.access_role === "admin"
  );
}

async function getAppliedTemplateForStore(storeId: string) {
  if (!storeId) {
    return "";
  }

  const supabase = await createClient();
  const { data: pageData } = await supabase
    .from("builder_pages" as never)
    .select("id")
    .eq("store_instance_id", storeId)
    .eq("page_key", "home")
    .maybeSingle();
  const pageId = pageData ? (pageData as { id?: string }).id : "";

  if (!pageId) {
    return "";
  }

  const { data: draftData } = await supabase
    .from("builder_drafts" as never)
    .select("editor_state")
    .eq("builder_page_id", pageId)
    .maybeSingle();

  return appliedTemplateId((draftData as { editor_state?: unknown } | null)?.editor_state);
}

export default async function TemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; storeId?: string; templateApply?: string; templateId?: string }>;
}) {
  const params = await searchParams;
  const stores = await getClaimedStores();
  const selectedStoreId =
    stores.find((store) => store.id === params.storeId)?.id ?? stores[0]?.id ?? "";
  const selectedCategory = params.category ?? "all";
  const library = await getTemplateLibrary();
  const appliedTemplate = await getAppliedTemplateForStore(selectedStoreId);
  const templates =
    selectedCategory === "all"
      ? library.templates
      : library.templates.filter((template) => template.niche_category === selectedCategory);
  const activeStore = stores.find((store) => store.id === selectedStoreId);
  const message = params.templateApply ? statusMessages[params.templateApply] : "";

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Choose a ready-made store template, preview the draft schema, and apply it safely to a buyer-owned store draft without publishing."
        title="Template Library"
      />

      {message ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 text-sm font-semibold text-muted shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)]">
          {message}
        </div>
      ) : null}

      <Card className="grid gap-5 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Apply target
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
            Select buyer-owned store
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Templates apply only to builder drafts. Published layouts remain active
            until the owner explicitly publishes a future builder version.
          </p>
        </div>
        {stores.length ? (
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
              defaultValue={selectedStoreId}
              name="storeId"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name ?? store.internal_slug ?? store.id}
                </option>
              ))}
            </select>
            {selectedCategory !== "all" ? (
              <input name="category" type="hidden" value={selectedCategory} />
            ) : null}
            <Button type="submit" variant="secondary">
              Select store
            </Button>
          </form>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
            Claim a buyer store before applying templates.
          </p>
        )}
        {activeStore ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Applied template state
            </p>
            <p className="mt-2 text-sm font-black text-ink">
              {appliedTemplate
                ? `Draft currently references ${appliedTemplate}.`
                : "No template application recorded in this store draft yet."}
            </p>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3 rounded-[2rem] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Category filters
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
              selectedCategory === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            href={selectedStoreId ? `/dashboard/templates?storeId=${selectedStoreId}` : "/dashboard/templates"}
          >
            All
          </a>
          {library.categories.map((category) => (
            <a
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                selectedCategory === category.category_key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={`/dashboard/templates?category=${category.category_key}${
                selectedStoreId ? `&storeId=${selectedStoreId}` : ""
              }`}
              key={category.category_key}
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const draft = mapTemplateToBuilderDraft(template);
          const isApplied = appliedTemplate === template.id;

          return (
            <Card className="overflow-hidden p-0" key={template.id}>
              <div className="p-4">
                <div
                  className="min-h-48 rounded-[1.75rem] p-4 text-white shadow-inner"
                  style={{
                    background:
                      template.preview_gradient ??
                      "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)"
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
                      {template.niche_category}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-900">
                      {draft.sections.length} sections
                    </span>
                  </div>
                  <div className="mt-12 max-w-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                      Preview before apply
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                      {template.name}
                    </h3>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-5 pt-1">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                      {template.name}
                    </h2>
                    {isApplied ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Applied draft
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {template.preview_summary ?? template.description}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {["Desktop", "Tablet", "Mobile"].map((mode) => (
                    <div
                      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted"
                      key={mode}
                    >
                      {mode}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Builder draft preview
                  </p>
                  <p className="mt-2 text-sm font-semibold text-muted">
                    Applies {draft.sections.length} editable section
                    {draft.sections.length === 1 ? "" : "s"}, theme config, and branding config to draft only.
                  </p>
                </div>
                <details className="rounded-2xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-ink">
                    Confirm apply template
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <p className="text-sm leading-6 text-muted">
                      This replaces the selected store draft sections and draft theme
                      settings. It does not publish the storefront or overwrite the
                      active published layout.
                    </p>
                    <form action={applyTemplateToStore}>
                      <input name="storeId" type="hidden" value={selectedStoreId} />
                      <input name="templateId" type="hidden" value={template.id} />
                      <Button disabled={!selectedStoreId} type="submit">
                        Apply template to draft
                      </Button>
                    </form>
                  </div>
                </details>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["AI customize template", "Preview placeholder"].map((label) => (
                    <div
                      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.16em] text-muted"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
