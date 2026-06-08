import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  editSearchSeoPlaceholder,
  improveSearchMetadataPlaceholder,
  markSearchOptimizedPlaceholder,
  previewMarketplaceSnippetPlaceholder
} from "@/lib/reseller-showcase/search-optimization-actions";
import {
  getResellerSearchOptimizationData,
  type ResellerSearchOptimizationItem
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type SearchOptimizationPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function scoreClass(score: number) {
  if (score >= 80) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (score >= 50) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-red-100 text-red-700";
}

function SearchHiddenFields({ item }: { item: ResellerSearchOptimizationItem }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/search-optimization" />
      <input name="itemReference" type="hidden" value={item.id} />
      <input name="itemType" type="hidden" value={item.itemType} />
      <input name="marketplaceTitle" type="hidden" value={item.marketplaceTitle} />
      <input name="keywordsTags" type="hidden" value={item.keywordsTags.join(", ")} />
    </>
  );
}

function SearchActions({ item }: { item: ResellerSearchOptimizationItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={editSearchSeoPlaceholder}>
        <SearchHiddenFields item={item} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Edit SEO
        </button>
      </form>
      <form action={improveSearchMetadataPlaceholder}>
        <SearchHiddenFields item={item} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Improve
        </button>
      </form>
      <form action={previewMarketplaceSnippetPlaceholder}>
        <SearchHiddenFields item={item} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Preview
        </button>
      </form>
      <form action={markSearchOptimizedPlaceholder}>
        <SearchHiddenFields item={item} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Mark optimized
        </button>
      </form>
    </div>
  );
}

export default async function ResellerSearchOptimizationPage({
  searchParams
}: SearchOptimizationPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerSearchOptimizationData()]);
  const selected = data.selectedItem;

  return (
    <>
      <PageHeader
        description="Prepare reseller profile, listings, templates, portfolio, and categories for future marketplace discovery without real ranking or paid ads."
        title="Marketplace Search Optimization"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Search optimization placeholder action recorded.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Items</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.totalItems}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Average score</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.averageScore}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Optimized</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.optimizedItems}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Metadata warnings</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.missingMetadataWarnings}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Hidden warnings</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.hiddenWarnings}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SEO/discovery fields</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Marketplace title",
            "Short description",
            "Keywords/tags",
            "Niche/category",
            "Target audience",
            "Country/language targeting",
            "Visibility status",
            "Preview snippet"
          ].map((field) => (
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-ink" key={field}>
              {field}
            </p>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Item optimization table</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.items.length ? (
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Item name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Missing improvements</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((item) => (
                    <tr key={`${item.itemType}-${item.id}`}>
                      <td className="px-4 py-4 font-black text-ink">{item.itemName}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.itemType}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.category}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.visibilityStatus}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${scoreClass(item.optimizationScore)}`}>
                          {item.optimizationScore}%
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">
                        {item.missingImprovements.length ? item.missingImprovements.join(", ") : "None"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.lastUpdated ?? "Not tracked"}</td>
                      <td className="px-4 py-4">
                        <SearchActions item={item} />
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Marketplace snippet preview</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.marketplaceTitle ?? "No item selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Short description: {selected?.shortDescription ?? "No description yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Keywords/tags: {(selected?.keywordsTags.length ? selected.keywordsTags : ["No tags yet."]).join(", ")}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Target audience: {selected?.targetAudience ?? "Target audience placeholder"}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Country/language: {selected?.countryLanguageTargeting ?? "Country/language targeting placeholder"}
            </p>
            <p className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
              {selected?.previewSnippet ?? "Marketplace snippet placeholder"}
            </p>
          </div>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Public visibility safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Public profile visibility still follows existing public marketplace, category, and portfolio filters.
          Hidden/private items remain hidden, and optimized metadata does not create paid boosting, fake traffic,
          fake sales, wallets, payouts, withdrawals, commissions, orders, buyer charges, or ownership transfers.
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
