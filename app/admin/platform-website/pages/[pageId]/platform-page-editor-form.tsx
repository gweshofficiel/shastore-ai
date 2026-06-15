"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPlatformPageBlock,
  hidePlatformPageBlock,
  publishPlatformPageBlock,
  reorderPlatformPageBlocks,
  managePlatformSeoDraft,
  savePlatformPageEditorDraft,
  updatePlatformPageBlock,
  type PlatformPageEditorActionState,
  type PlatformSeoGeneratorActionState
} from "@/lib/admin/platform-website-actions";
import { AdminBadge } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import type { PlatformPageBlockRecord, PlatformPageBlockType } from "@/src/lib/platform-website/platform-blocks-runtime";

type EditorPage = {
  body: Record<string, unknown>;
  canonicalPath: string | null;
  contentStatus: string;
  headline: string | null;
  id: string;
  openGraph: Record<string, unknown>;
  pageType: string;
  routePath: string;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: string;
  subtitle: string | null;
  title: string;
  translations: Record<"ar" | "en" | "fr", Record<string, unknown>>;
  updatedAt: string | null;
};

const initialState: PlatformPageEditorActionState = {
  message: "",
  status: "idle"
};
const initialSeoState: PlatformSeoGeneratorActionState = {
  draft: null,
  message: "",
  status: "idle"
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function jsonText(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
}

function translationContent(page: EditorPage, language: "ar" | "en" | "fr") {
  return text(page.translations[language]?.content);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-11 rounded-full bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving draft..." : "Save draft"}
    </button>
  );
}

function SeoSubmitButton({
  children
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      name="seoIntent"
      type="submit"
      value="generate"
    >
      {pending ? "Working..." : children}
    </button>
  );
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

const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const textareaClass = "min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const blockTypes: PlatformPageBlockType[] = ["hero", "features", "pricing", "cta", "faq", "testimonials", "stats", "footer", "custom"];

function toneForBlockStatus(status: string) {
  if (status === "published") {
    return "green" as const;
  }

  if (status === "hidden") {
    return "red" as const;
  }

  return "amber" as const;
}

function seoScore(input: {
  canonicalPath: string | null;
  openGraph: Record<string, unknown>;
  seoDescription: string | null;
  seoTitle: string | null;
}) {
  const missing = [
    !text(input.seoTitle),
    !text(input.seoDescription),
    !text(input.canonicalPath),
    !text(input.openGraph.title),
    !text(input.openGraph.description)
  ].filter(Boolean).length;

  if (missing === 0) {
    return "Ready";
  }

  return missing >= 3 ? "Missing SEO" : "Needs Improvement";
}

function toneForSeoScore(score: string) {
  if (score === "Ready") {
    return "green" as const;
  }

  if (score === "Missing SEO") {
    return "red" as const;
  }

  return "amber" as const;
}

function BlockHiddenFields({ page }: { page: EditorPage }) {
  return (
    <>
      <input name="pageId" type="hidden" value={page.id} />
      <input name="slug" type="hidden" value={page.slug} />
      <input name="title" type="hidden" value={page.title} />
    </>
  );
}

function BlockEditorFields({ block }: { block?: PlatformPageBlockRecord }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Block type">
          <select className={inputClass} name="blockType" defaultValue={block?.blockType ?? "custom"}>
            {blockTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
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
      <Field help="Must be a JSON object. Optional `translations.en/ar/fr` can override block title, subtitle, content, or settings." label="Content JSON">
        <textarea className={`${textareaClass} font-mono text-xs`} name="content" defaultValue={jsonText(block?.content ?? {})} />
      </Field>
      <Field help="Must be a JSON object for layout/display settings only." label="Settings JSON">
        <textarea className={`${textareaClass} min-h-20 font-mono text-xs`} name="settings" defaultValue={jsonText(block?.settings ?? {})} />
      </Field>
    </div>
  );
}

function PlatformPageBlocksManager({
  blocks,
  page
}: {
  blocks: PlatformPageBlockRecord[];
  page: EditorPage;
}) {
  return (
    <Card className="grid gap-5 p-5 lg:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Landing blocks</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Structured page blocks</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Blocks are platform-only. Public pages render published blocks by sort order and fall back to body JSON when no published blocks exist.
        </p>
      </div>

      <form action={createPlatformPageBlock} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4">
        <BlockHiddenFields page={page} />
        <BlockEditorFields />
        <button className="mt-4 h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
          Add block
        </button>
      </form>

      {blocks.length ? (
        <form action={reorderPlatformPageBlocks} className="rounded-[2rem] border border-blue-100 bg-blue-50 p-4">
          <BlockHiddenFields page={page} />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Reorder blocks</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {blocks.map((block) => (
              <label className="grid gap-2" key={`order-${block.id}`}>
                <span className="text-xs font-bold text-blue-700">{block.title || block.blockType}</span>
                <input className={inputClass} name={`blockOrder:${block.id}`} type="number" defaultValue={block.sortOrder} />
              </label>
            ))}
          </div>
          <button className="mt-4 h-10 rounded-full border border-blue-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700" type="submit">
            Save order
          </button>
        </form>
      ) : null}

      <div className="grid gap-4">
        {blocks.map((block) => (
          <article className="rounded-[2rem] border border-slate-200 bg-white p-4" key={block.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{block.blockType}</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{block.title || "Untitled block"}</h3>
              </div>
              <AdminBadge tone={toneForBlockStatus(block.status)}>{block.status}</AdminBadge>
            </div>

            <form action={updatePlatformPageBlock} className="grid gap-4">
              <BlockHiddenFields page={page} />
              <input name="blockId" type="hidden" value={block.id} />
              <BlockEditorFields block={block} />
              <div className="flex flex-wrap gap-2">
                <button className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                  Save block
                </button>
                <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" formAction={publishPlatformPageBlock} type="submit">
                  Publish block
                </button>
                <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" formAction={hidePlatformPageBlock} type="submit">
                  Hide block
                </button>
              </div>
            </form>
          </article>
        ))}
      </div>
    </Card>
  );
}

function PlatformSeoGenerator({ page }: { page: EditorPage }) {
  const [seoState, seoAction] = useActionState(managePlatformSeoDraft, initialSeoState);
  const currentScore = seoScore({
    canonicalPath: page.canonicalPath,
    openGraph: page.openGraph,
    seoDescription: page.seoDescription,
    seoTitle: page.seoTitle
  });
  const draftJson = seoState.draft ? JSON.stringify(seoState.draft) : "";

  return (
    <Card className="grid gap-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SEO Generator</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Generate SEO draft suggestions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Suggestions are generated from this platform page&apos;s title, headline, subtitle, body, and translations only. Nothing is saved until Apply Draft.
          </p>
        </div>
        <AdminBadge tone={toneForSeoScore(currentScore)}>Current: {currentScore}</AdminBadge>
      </div>

      <form action={seoAction} className="grid gap-4">
        <input name="pageId" type="hidden" value={page.id} />
        <input name="slug" type="hidden" value={page.slug} />
        <input name="title" type="hidden" value={page.title} />
        {draftJson ? <input name="seoDraft" type="hidden" value={draftJson} /> : null}

        <div className="flex flex-wrap gap-2">
          <SeoSubmitButton>Generate Draft</SeoSubmitButton>
          <a
            className={`inline-flex h-10 items-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.16em] ${
              seoState.draft
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
            }`}
            href="#seo-draft-review"
          >
            Review Draft
          </a>
          <button
            className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!seoState.draft}
            name="seoIntent"
            type="submit"
            value="apply"
          >
            Apply Draft
          </button>
          <button
            className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!seoState.draft}
            name="seoIntent"
            type="submit"
            value="discard"
          >
            Discard Draft
          </button>
        </div>

        {seoState.message ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              seoState.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
            role={seoState.status === "error" ? "alert" : "status"}
          >
            {seoState.message}
          </p>
        ) : null}
      </form>

      {seoState.draft ? (
        <div className="grid gap-4" id="seo-draft-review">
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone={toneForSeoScore(seoState.draft.score)}>Draft: {seoState.draft.score}</AdminBadge>
            <AdminBadge tone="blue">Generated draft</AdminBadge>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Base SEO draft</p>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
              <p><span className="font-black text-slate-800">SEO title:</span> {seoState.draft.base.seoTitle}</p>
              <p><span className="font-black text-slate-800">Description:</span> {seoState.draft.base.seoDescription}</p>
              <p><span className="font-black text-slate-800">Canonical:</span> {seoState.draft.base.canonicalPath}</p>
              <p><span className="font-black text-slate-800">OpenGraph title:</span> {seoState.draft.base.openGraphTitle}</p>
              <p><span className="font-black text-slate-800">OpenGraph description:</span> {seoState.draft.base.openGraphDescription}</p>
            </div>
          </div>
          {Object.entries(seoState.draft.locales).length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(seoState.draft.locales).map(([locale, draft]) => (
                <article className="rounded-[2rem] border border-blue-100 bg-blue-50 p-4" key={locale}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{locale}</p>
                  <p className="mt-3 text-sm font-black text-slate-900">{draft?.seoTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{draft?.seoDescription}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function PlatformPageEditorForm({
  blocks,
  page
}: {
  blocks: PlatformPageBlockRecord[];
  page: EditorPage;
}) {
  const [state, formAction] = useActionState(savePlatformPageEditorDraft, initialState);
  const [isDirty, setIsDirty] = useState(false);
  const previewBody = useMemo(() => jsonText(page.body), [page.body]);
  const previewOpenGraphTitle = text(page.openGraph.title);
  const previewOpenGraphDescription = text(page.openGraph.description);
  const previewOpenGraphImageUrl = text(page.openGraph.image_url);

  useEffect(() => {
    if (state.status === "success") {
      setIsDirty(false);
    }
  }, [state.status]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!isDirty) {
      return;
    }

    if (!window.confirm("You have unsaved platform page changes. Leave without saving?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-6">
        <form action={formAction} className="grid gap-6" onChange={() => setIsDirty(true)}>
          <input name="pageId" type="hidden" value={page.id} />
          <input name="slug" type="hidden" value={page.slug} />

        <Card className="grid gap-5 p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Basic content</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{page.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminBadge tone="blue">{page.contentStatus}</AdminBadge>
              <AdminBadge tone={page.status === "published" ? "green" : page.status === "archived" ? "red" : "amber"}>
                {page.status}
              </AdminBadge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field help="Required. This updates the platform page registry title only." label="Title">
              <input className={inputClass} maxLength={180} name="title" required type="text" defaultValue={page.title} />
            </Field>
            <Field label="Headline">
              <input className={inputClass} maxLength={240} name="headline" type="text" defaultValue={page.headline ?? ""} />
            </Field>
          </div>

          <Field label="Subtitle">
            <textarea className={textareaClass} maxLength={500} name="subtitle" defaultValue={page.subtitle ?? ""} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Content</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Body is stored as safe JSON in `platform_pages.body`. Public website rendering is not connected here.
            </p>
          </div>
          <Field help="Must be a JSON object." label="Body JSON">
            <textarea className={`${textareaClass} min-h-72 font-mono text-xs`} name="body" defaultValue={previewBody} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SEO</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field help="70 characters maximum." label="SEO title">
              <input className={inputClass} maxLength={70} name="seoTitle" type="text" defaultValue={page.seoTitle ?? ""} />
            </Field>
            <Field help="Must start with a single `/` and remain relative." label="Canonical path">
              <input className={inputClass} maxLength={240} name="canonicalPath" pattern="/.*" type="text" defaultValue={page.canonicalPath ?? page.routePath} />
            </Field>
          </div>
          <Field help="160 characters maximum." label="SEO description">
            <textarea className={textareaClass} maxLength={160} name="seoDescription" defaultValue={page.seoDescription ?? ""} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Open Graph</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Open Graph title">
              <input className={inputClass} maxLength={180} name="openGraphTitle" type="text" defaultValue={previewOpenGraphTitle} />
            </Field>
            <Field label="Open Graph image URL">
              <input className={inputClass} maxLength={500} name="openGraphImageUrl" type="text" defaultValue={previewOpenGraphImageUrl} />
            </Field>
          </div>
          <Field label="Open Graph description">
            <textarea className={textareaClass} maxLength={300} name="openGraphDescription" defaultValue={previewOpenGraphDescription} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Translations</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Arabic">
              <textarea className={textareaClass} dir="rtl" name="translationAr" defaultValue={translationContent(page, "ar")} />
            </Field>
            <Field label="English">
              <textarea className={textareaClass} name="translationEn" defaultValue={translationContent(page, "en")} />
            </Field>
            <Field label="French">
              <textarea className={textareaClass} name="translationFr" defaultValue={translationContent(page, "fr")} />
            </Field>
          </div>
        </Card>

        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700" role="status">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton />
          <Link
            className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
            onClick={confirmLeave}
          >
            Back to platform pages
          </Link>
        </div>
        </form>

        <PlatformSeoGenerator page={page} />

        <PlatformPageBlocksManager blocks={blocks} page={page} />
      </div>

      <aside className="grid gap-4 self-start xl:sticky xl:top-6">
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Database preview</p>
          <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">{page.headline || page.title}</h3>
          {page.subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{page.subtitle}</p> : null}
          <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
            <p><span className="font-black text-slate-800">Route:</span> {page.routePath}</p>
            <p><span className="font-black text-slate-800">Canonical:</span> {page.canonicalPath || page.routePath}</p>
            <p><span className="font-black text-slate-800">SEO title:</span> {page.seoTitle || "Not set"}</p>
            <p><span className="font-black text-slate-800">SEO description:</span> {page.seoDescription || "Not set"}</p>
            <p><span className="font-black text-slate-800">Open Graph:</span> {previewOpenGraphTitle || "Not set"}</p>
          </div>
        </Card>

        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Stored body JSON</p>
          <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {previewBody}
          </pre>
        </Card>

        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Safety</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            This preview reads the database content loaded for the editor. It does not render or request any public route.
          </p>
        </Card>
      </aside>
    </div>
  );
}
