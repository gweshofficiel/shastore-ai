"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { savePlatformPageEditorDraft, type PlatformPageEditorActionState } from "@/lib/admin/platform-website-actions";
import { AdminBadge } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";

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

export function PlatformPageEditorForm({ page }: { page: EditorPage }) {
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
