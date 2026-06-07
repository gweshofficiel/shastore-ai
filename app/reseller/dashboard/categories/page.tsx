import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  editResellerCategoryDescriptionPlaceholder,
  enableResellerCategoryPlaceholder,
  hideResellerCategoryPlaceholder,
  reorderResellerCategoriesPlaceholder
} from "@/lib/reseller-showcase/category-actions";
import {
  getResellerCategoriesData,
  type ResellerCategory,
  type ResellerCategoryVisibility
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type CategoriesPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function visibilityClass(visibility: ResellerCategoryVisibility) {
  if (visibility === "public") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (visibility === "private") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-200 text-slate-700";
}

function CategoryHiddenFields({ category }: { category: ResellerCategory }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/categories" />
      <input name="categoryName" type="hidden" value={category.name} />
      <input name="categorySlug" type="hidden" value={category.slug} />
      <input name="description" type="hidden" value={category.description} />
    </>
  );
}

function CategoryActions({ category }: { category: ResellerCategory }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={enableResellerCategoryPlaceholder}>
        <CategoryHiddenFields category={category} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Enable
        </button>
      </form>
      <form action={hideResellerCategoryPlaceholder}>
        <CategoryHiddenFields category={category} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Hide
        </button>
      </form>
      <form action={reorderResellerCategoriesPlaceholder}>
        <CategoryHiddenFields category={category} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Reorder
        </button>
      </form>
    </div>
  );
}

export default async function ResellerCategoriesPage({ searchParams }: CategoriesPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerCategoriesData()]);

  return (
    <>
      <PageHeader
        description="Organize reseller store listings, templates, portfolio items, and showcase sections by discovery category."
        title="Category Management"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Category placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Categories</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.categories.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Public</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.publicCategories.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Listing uses</p>
          <p className="mt-3 text-3xl font-black text-ink">
            {data.categories.reduce((total, category) => total + category.usedByListingsCount, 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Template + portfolio uses</p>
          <p className="mt-3 text-3xl font-black text-ink">
            {data.categories.reduce(
              (total, category) => total + category.usedByTemplatesCount + category.usedByPortfolioCount,
              0
            )}
          </p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Assignment behavior</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Store listings use their existing category field.",
            "Templates use the category metadata on their showcase listing.",
            "Portfolio items use their category/niche field.",
            "Showcase sections can use these categories as future discovery metadata."
          ].map((note) => (
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted" key={note}>
              {note}
            </p>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reseller marketplace categories</p>
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
          {data.categories.length ? (
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Icon</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Listings</th>
                  <th className="px-4 py-3">Templates</th>
                  <th className="px-4 py-3">Portfolio</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.categories.map((category) => (
                  <tr key={category.slug}>
                    <td className="px-4 py-4 font-black text-ink">{category.name}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{category.slug}</td>
                    <td className="px-4 py-4 font-semibold leading-6 text-muted">{category.description}</td>
                    <td className="px-4 py-4 font-semibold text-muted">{category.iconPlaceholder}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${visibilityClass(category.visibility)}`}>
                        {category.visibility}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black text-ink">{category.usedByListingsCount}</td>
                    <td className="px-4 py-4 font-black text-ink">{category.usedByTemplatesCount}</td>
                    <td className="px-4 py-4 font-black text-ink">{category.usedByPortfolioCount}</td>
                    <td className="px-4 py-4">
                      <CategoryActions category={category} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="bg-slate-50 p-5 text-sm font-semibold leading-6 text-muted">{data.emptyState}</p>
          )}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Edit description placeholder</p>
        <form action={editResellerCategoryDescriptionPlaceholder} className="mt-5 grid gap-3 lg:grid-cols-[1fr_2fr_auto]">
          <input name="returnTo" type="hidden" value="/reseller/dashboard/categories" />
          <select className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="categorySlug">
            {data.categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
          <input className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="description" placeholder="Category description placeholder" />
          <button className="h-12 rounded-full bg-ink px-5 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
            Save placeholder
          </button>
        </form>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and discovery safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Categories are organization and discovery metadata only. Hidden/private categories are not shown on
          the public reseller profile, and no order, payment, buyer charge, ownership transfer, wallet, payout,
          withdrawal, commission, or fake sale flow is added.
        </p>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
