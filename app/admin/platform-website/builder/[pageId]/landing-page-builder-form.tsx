"use client";

import Link from "next/link";
import {
  createPlatformPageBlock,
  deleteDraftPlatformPageBlock,
  duplicatePlatformPageBlock,
  hidePlatformPageBlock,
  publishPlatformPageBlock,
  reorderPlatformPageBlocks,
  showPlatformPageBlock,
  updatePlatformPageBlock
} from "@/lib/admin/platform-website-actions";
import { AdminBadge } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import type { PlatformPageBlockRecord, PlatformPageBlockType } from "@/src/lib/platform-website/platform-blocks-runtime";

type BuilderPage = {
  id: string;
  routePath: string;
  slug: string;
  title: string;
};

const blockTypes: PlatformPageBlockType[] = ["hero", "features", "pricing", "cta", "faq", "testimonials", "stats", "footer", "custom"];
const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const textareaClass = "min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function jsonText(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
}

function jsonArrayText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function toneForStatus(status: string) {
  if (status === "published") {
    return "green" as const;
  }

  if (status === "hidden") {
    return "red" as const;
  }

  return "amber" as const;
}

function Field({
  children,
  help,
  label
}: {
  children: React.ReactNode;
  help?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      {children}
      {help ? <span className="text-xs font-semibold leading-5 text-slate-500">{help}</span> : null}
    </label>
  );
}

function HiddenFields({
  block,
  page
}: {
  block?: PlatformPageBlockRecord;
  page: BuilderPage;
}) {
  return (
    <>
      <input name="pageId" type="hidden" value={page.id} />
      <input name="slug" type="hidden" value={page.slug} />
      <input name="title" type="hidden" value={page.title} />
      {block ? <input name="blockId" type="hidden" value={block.id} /> : null}
    </>
  );
}

function BlockFields({ block }: { block?: PlatformPageBlockRecord }) {
  const settings = block?.settings ?? {};

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Type">
          <select className={inputClass} name="blockType" defaultValue={block?.blockType ?? "hero"}>
            {blockTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} name="blockStatus" defaultValue={block?.status ?? "draft"}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
          </select>
        </Field>
        <Field label="Sort order">
          <input className={inputClass} name="sortOrder" type="number" defaultValue={block?.sortOrder ?? 0} />
        </Field>
        <Field label="Title">
          <input className={inputClass} maxLength={180} name="blockTitle" type="text" defaultValue={block?.title ?? ""} />
        </Field>
      </div>

      <Field label="Subtitle">
        <textarea className={textareaClass} maxLength={500} name="blockSubtitle" defaultValue={block?.subtitle ?? ""} />
      </Field>

      <Field help="Safe JSON object. Rich strings are sanitized before storage." label="Content JSON">
        <textarea className={`${textareaClass} min-h-40 font-mono text-xs`} name="content" defaultValue={jsonText(block?.content ?? {})} />
      </Field>

      <Field help="Optional generic settings JSON object." label="Settings JSON">
        <textarea className={`${textareaClass} font-mono text-xs`} name="settings" defaultValue={jsonText(settings)} />
      </Field>

      <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Block-specific settings</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Hero primary CTA label">
            <input className={inputClass} name="primaryCtaLabel" type="text" defaultValue={text(settings.primary_cta_label)} />
          </Field>
          <Field label="Hero primary CTA URL">
            <input className={inputClass} name="primaryCtaUrl" type="text" defaultValue={text(settings.primary_cta_url)} />
          </Field>
          <Field label="Hero secondary CTA label">
            <input className={inputClass} name="secondaryCtaLabel" type="text" defaultValue={text(settings.secondary_cta_label)} />
          </Field>
          <Field label="Hero secondary CTA URL">
            <input className={inputClass} name="secondaryCtaUrl" type="text" defaultValue={text(settings.secondary_cta_url)} />
          </Field>
          <Field label="CTA button label">
            <input className={inputClass} name="buttonLabel" type="text" defaultValue={text(settings.button_label)} />
          </Field>
          <Field label="CTA button URL">
            <input className={inputClass} name="buttonUrl" type="text" defaultValue={text(settings.button_url)} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field help="JSON array for feature cards." label="Features items">
            <textarea className={`${textareaClass} font-mono text-xs`} name="items" defaultValue={jsonArrayText(settings.items)} />
          </Field>
          <Field help="JSON array for pricing plan references." label="Pricing plan refs">
            <textarea className={`${textareaClass} font-mono text-xs`} name="planRefs" defaultValue={jsonArrayText(settings.plan_refs)} />
          </Field>
          <Field help="JSON array for static pricing items." label="Pricing static items">
            <textarea className={`${textareaClass} font-mono text-xs`} name="staticItems" defaultValue={jsonArrayText(settings.static_items)} />
          </Field>
          <Field help="JSON array for FAQ questions." label="FAQ questions">
            <textarea className={`${textareaClass} font-mono text-xs`} name="questions" defaultValue={jsonArrayText(settings.questions)} />
          </Field>
          <Field help="JSON array for testimonial quotes." label="Testimonials quotes">
            <textarea className={`${textareaClass} font-mono text-xs`} name="quotes" defaultValue={jsonArrayText(settings.quotes)} />
          </Field>
          <Field help="JSON array for stats metrics." label="Stats metrics">
            <textarea className={`${textareaClass} font-mono text-xs`} name="metrics" defaultValue={jsonArrayText(settings.metrics)} />
          </Field>
          <Field help="JSON array for footer links." label="Footer links">
            <textarea className={`${textareaClass} font-mono text-xs`} name="links" defaultValue={jsonArrayText(settings.links)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ block }: { block: PlatformPageBlockRecord }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{block.blockType}</p>
        <AdminBadge tone={toneForStatus(block.status)}>{block.status}</AdminBadge>
      </div>
      <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">{block.title || "Untitled block"}</h3>
      {block.subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{block.subtitle}</p> : null}
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Order {block.sortOrder}</p>
    </article>
  );
}

export function LandingPageBuilderForm({
  blocks,
  page
}: {
  blocks: PlatformPageBlockRecord[];
  page: BuilderPage;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-6">
        <Card className="grid gap-5 p-5 lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Add block</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">New landing block</h2>
          </div>
          <form action={createPlatformPageBlock} className="grid gap-4">
            <HiddenFields page={page} />
            <BlockFields />
            <button className="h-11 rounded-full bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
              Add draft block
            </button>
          </form>
        </Card>

        {blocks.length ? (
          <Card className="grid gap-5 p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Reorder</p>
            <form action={reorderPlatformPageBlocks} className="grid gap-4">
              <HiddenFields page={page} />
              <div className="grid gap-3 md:grid-cols-2">
                {blocks.map((block) => (
                  <Field key={`reorder-${block.id}`} label={block.title || block.blockType}>
                    <input className={inputClass} name={`blockOrder:${block.id}`} type="number" defaultValue={block.sortOrder} />
                  </Field>
                ))}
              </div>
              <button className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700" type="submit">
                Save full block order
              </button>
            </form>
          </Card>
        ) : null}

        {blocks.map((block) => (
          <Card className="grid gap-5 p-5 lg:p-6" key={block.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{block.blockType}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{block.title || "Untitled block"}</h2>
              </div>
              <AdminBadge tone={toneForStatus(block.status)}>{block.status}</AdminBadge>
            </div>

            <form action={updatePlatformPageBlock} className="grid gap-4">
              <HiddenFields block={block} page={page} />
              <BlockFields block={block} />
              <div className="flex flex-wrap gap-2">
                <button className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                  Save block
                </button>
                <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" formAction={publishPlatformPageBlock} type="submit">
                  Publish
                </button>
                {block.status === "hidden" ? (
                  <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" formAction={showPlatformPageBlock} type="submit">
                    Show as draft
                  </button>
                ) : (
                  <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" formAction={hidePlatformPageBlock} type="submit">
                    Hide
                  </button>
                )}
                <button className="h-9 rounded-full border border-purple-200 bg-purple-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700" formAction={duplicatePlatformPageBlock} type="submit">
                  Duplicate
                </button>
                {block.status === "draft" ? (
                  <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" formAction={deleteDraftPlatformPageBlock} type="submit">
                    Delete draft
                  </button>
                ) : null}
              </div>
            </form>
          </Card>
        ))}
      </div>

      <aside className="grid gap-4 self-start xl:sticky xl:top-6">
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Admin preview</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{page.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Preview shows current admin block order, including draft and hidden blocks. Public pages still render published blocks only.
          </p>
          <div className="mt-5 grid gap-3">
            {blocks.length ? blocks.map((block) => <PreviewBlock block={block} key={`preview-${block.id}`} />) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                No blocks yet. Existing body content remains the public fallback.
              </p>
            )}
          </div>
        </Card>

        <Card className="grid gap-3 p-5 text-sm leading-6 text-slate-500 lg:p-6">
          <p><span className="font-black text-slate-800">Slug:</span> {page.slug}</p>
          <p><span className="font-black text-slate-800">Route:</span> {page.routePath}</p>
          <Link
            className="mt-2 inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href={`/admin/platform-website/pages/${page.id}`}
          >
            Edit page content
          </Link>
        </Card>
      </aside>
    </div>
  );
}
