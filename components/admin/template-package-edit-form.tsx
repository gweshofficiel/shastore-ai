"use client";

type TemplatePackageEditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  contents: {
    ai_support_enabled: boolean;
    blog_posts_count: number;
    categories_count: number;
    checkout_ready: boolean | "unknown";
    domain_ready: boolean;
    faq_count: number;
    navigation_ready: boolean | "unknown";
    pages_count: number;
    products_count: number;
    theme_ready: boolean | "unknown";
  };
  packageName: string;
  registryId: string;
  templateName: string;
};

function triStateValue(value: boolean | "unknown") {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

export function TemplatePackageEditForm({
  action,
  contents,
  packageName,
  registryId,
  templateName
}: TemplatePackageEditFormProps) {
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Package name
        <input
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
          defaultValue={packageName}
          name="packageName"
          type="text"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Products
          <input
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={contents.products_count}
            min={0}
            name="productsCount"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Categories
          <input
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={contents.categories_count}
            min={0}
            name="categoriesCount"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Pages
          <input
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={contents.pages_count}
            min={0}
            name="pagesCount"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Blog posts
          <input
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={contents.blog_posts_count}
            min={0}
            name="blogPostsCount"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          FAQ
          <input
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            defaultValue={contents.faq_count}
            min={0}
            name="faqCount"
            type="number"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <input defaultChecked={contents.ai_support_enabled} name="aiSupportEnabled" type="checkbox" value="1" />
        AI support enabled
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <input defaultChecked={contents.domain_ready} name="domainReady" type="checkbox" value="1" />
        Domain ready
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Checkout readiness
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
            defaultValue={triStateValue(contents.checkout_ready)}
            name="checkoutReady"
          >
            <option value="unknown">Unknown</option>
            <option value="true">Ready</option>
            <option value="false">Not ready</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Navigation readiness
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
            defaultValue={triStateValue(contents.navigation_ready)}
            name="navigationReady"
          >
            <option value="unknown">Unknown</option>
            <option value="true">Ready</option>
            <option value="false">Not ready</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Theme readiness
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
            defaultValue={triStateValue(contents.theme_ready)}
            name="themeReady"
          >
            <option value="unknown">Unknown</option>
            <option value="true">Ready</option>
            <option value="false">Not ready</option>
          </select>
        </label>
      </div>
      <button
        className="h-9 rounded-full border border-slate-200 bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
        type="submit"
      >
        Save package metadata
      </button>
    </form>
  );
}
