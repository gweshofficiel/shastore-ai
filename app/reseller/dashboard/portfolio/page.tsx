import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  archivePortfolioItemPlaceholder,
  createPortfolioItemPlaceholder,
  editPortfolioItemPlaceholder,
  hidePortfolioItemPlaceholder,
  openPortfolioPreviewPlaceholder,
  publishPortfolioItemPlaceholder
} from "@/lib/reseller-showcase/portfolio-actions";
import {
  getResellerPortfolioData,
  type ResellerPortfolioItem,
  type ResellerPortfolioStatus
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

type PortfolioPageProps = {
  searchParams: Promise<{ saved?: string }>;
};

function statusClass(status: ResellerPortfolioStatus) {
  if (status === "published") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "under_review") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "hidden" || status === "archived") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-blue-100 text-blue-700";
}

function PortfolioHiddenFields({ item }: { item: ResellerPortfolioItem | null }) {
  return (
    <>
      <input name="returnTo" type="hidden" value="/reseller/dashboard/portfolio" />
      <input name="portfolioReference" type="hidden" value={item?.id ?? "portfolio-placeholder"} />
      <input name="title" type="hidden" value={item?.title ?? "Portfolio item placeholder"} />
      <input name="portfolioType" type="hidden" value={item?.type ?? "completed_store_design"} />
      <input name="categoryNiche" type="hidden" value={item?.categoryNiche ?? "Niche placeholder"} />
      <input name="description" type="hidden" value={item?.description ?? "Showcase-only portfolio placeholder."} />
      <input name="toolsServicesUsed" type="hidden" value={(item?.toolsServicesUsed ?? ["Store design"]).join(", ")} />
      <input name="previewUrl" type="hidden" value={item?.previewUrl ?? "#"} />
    </>
  );
}

function PortfolioActions({ item }: { item: ResellerPortfolioItem | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={editPortfolioItemPlaceholder}>
        <PortfolioHiddenFields item={item} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          Edit
        </button>
      </form>
      <form action={publishPortfolioItemPlaceholder}>
        <PortfolioHiddenFields item={item} />
        <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Publish
        </button>
      </form>
      <form action={hidePortfolioItemPlaceholder}>
        <PortfolioHiddenFields item={item} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Hide
        </button>
      </form>
      <form action={archivePortfolioItemPlaceholder}>
        <PortfolioHiddenFields item={item} />
        <button className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Archive
        </button>
      </form>
      <form action={openPortfolioPreviewPlaceholder}>
        <PortfolioHiddenFields item={item} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Open preview
        </button>
      </form>
    </div>
  );
}

export default async function ResellerPortfolioPage({ searchParams }: PortfolioPageProps) {
  const [query, data] = await Promise.all([searchParams, getResellerPortfolioData()]);
  const selected = data.selectedItem;

  return (
    <>
      <PageHeader
        description="Showcase previous work, template examples, case studies, and trusted portfolio items without creating sales or payment flows."
        title="Portfolio Showcase"
      />

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Portfolio placeholder action recorded.</p>
        </Card>
      ) : null}

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create portfolio item placeholder</p>
        <form action={createPortfolioItemPlaceholder} className="mt-5 grid gap-3 lg:grid-cols-2">
          <input name="returnTo" type="hidden" value="/reseller/dashboard/portfolio" />
          <input className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="title" placeholder="Portfolio title" />
          <select className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="portfolioType">
            {data.types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="categoryNiche" placeholder="Category / niche" />
          <input className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" name="previewUrl" placeholder="Safe preview URL placeholder" />
          <textarea className="min-h-24 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 lg:col-span-2" name="description" placeholder="Description. Do not include private client or buyer data." />
          <input className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-ink outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 lg:col-span-2" name="toolsServicesUsed" placeholder="Tools/services used, comma separated" />
          <button className="h-11 w-fit rounded-full bg-ink px-5 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
            Create placeholder
          </button>
        </form>
      </Card>

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Portfolio types</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.types.map((type) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={type.value}>
              {type.label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Portfolio statuses</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.statuses.map((status) => (
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${statusClass(status)}`} key={status}>
              {status}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Portfolio items</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            {data.items.length ? (
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category/niche</th>
                    <th className="px-4 py-3">Preview image</th>
                    <th className="px-4 py-3">Preview link</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-black text-ink">{item.title}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.type}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.categoryNiche}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.previewImagePlaceholder}</td>
                      <td className="px-4 py-4">
                        {item.previewUrl && item.previewUrl !== "#" ? (
                          <Link className="font-bold text-blue-700 underline-offset-4 hover:underline" href={item.previewUrl}>
                            Preview
                          </Link>
                        ) : (
                          <span className="font-semibold text-muted">Preview placeholder</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">{item.createdAt ?? "Not tracked"}</td>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Portfolio details</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            {selected?.title ?? "No portfolio item selected"}
          </h2>
          <div className="mt-5 grid gap-3">
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Description: {selected?.description ?? "No description yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Niche: {selected?.categoryNiche ?? "No niche yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Tools/services used: {(selected?.toolsServicesUsed ?? ["No tools yet."]).join(", ")}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Before/after: {selected?.beforeAfterPlaceholder ?? "Before/after placeholder not available."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Preview URL: {selected?.previewUrl ?? "No preview URL yet."}
            </p>
            <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              Public visibility: {selected?.publicVisibility ?? "Private dashboard only."}
            </p>
          </div>
          <div className="mt-5">
            <PortfolioActions item={selected} />
          </div>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Privacy and showcase-only safety</p>
        <p className="mt-3 text-sm font-semibold leading-7 text-amber-900">
          Portfolio items are showcase content only. Do not include private client data, unpublished stores,
          buyer data, order records, payment details, ownership transfer notes, wallet, payout, withdrawal,
          commission, or fake sale information.
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
