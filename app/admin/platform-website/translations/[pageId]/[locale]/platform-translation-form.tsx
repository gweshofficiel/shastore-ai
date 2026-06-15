"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  markPlatformTranslationNeedsReview,
  markPlatformTranslationReady,
  savePlatformTranslationDraft,
  type PlatformTranslationActionState
} from "@/lib/admin/platform-website-actions";
import { AdminBadge } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import type { PlatformTranslationEditorRecord } from "@/src/lib/platform-website/platform-translation-management";

const initialState: PlatformTranslationActionState = {
  message: "",
  status: "idle"
};

const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const textareaClass = "min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function jsonText(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
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

function SubmitButton({
  children
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-11 rounded-full bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}

function actionMessage(states: PlatformTranslationActionState[]) {
  return states.find((state) => state.status === "error") ?? states.find((state) => state.status === "success") ?? null;
}

export function PlatformTranslationForm({
  translation
}: {
  translation: PlatformTranslationEditorRecord;
}) {
  const [draftState, draftAction] = useActionState(savePlatformTranslationDraft, initialState);
  const [readyState, readyAction] = useActionState(markPlatformTranslationReady, initialState);
  const [reviewState, reviewAction] = useActionState(markPlatformTranslationNeedsReview, initialState);
  const message = actionMessage([draftState, readyState, reviewState]);
  const openGraphTitle = typeof translation.openGraph.title === "string" ? translation.openGraph.title : "";
  const openGraphDescription = typeof translation.openGraph.description === "string" ? translation.openGraph.description : "";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form action={draftAction} className="grid gap-6">
        <input name="locale" type="hidden" value={translation.locale} />
        <input name="pageId" type="hidden" value={translation.pageId} />
        <input name="slug" type="hidden" value={translation.slug} />

        <Card className="grid gap-5 p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Translation editor</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
                {translation.pageTitle} / {translation.locale}
              </h2>
            </div>
            <AdminBadge tone={translation.status === "ready" ? "green" : translation.status === "missing" ? "red" : "amber"}>
              {translation.status}
            </AdminBadge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field help="Required before marking this locale ready." label="Title">
              <input className={inputClass} maxLength={180} name="title" type="text" defaultValue={translation.title ?? ""} />
            </Field>
            <Field label="Headline">
              <input className={inputClass} maxLength={240} name="headline" type="text" defaultValue={translation.headline ?? ""} />
            </Field>
          </div>

          <Field label="Subtitle">
            <textarea className={textareaClass} maxLength={500} name="subtitle" defaultValue={translation.subtitle ?? ""} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Content</p>
          <Field help="Must be a safe JSON object." label="Body JSON">
            <textarea className={`${textareaClass} min-h-72 font-mono text-xs`} name="body" defaultValue={jsonText(translation.body)} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SEO</p>
          <Field help="70 characters maximum." label="SEO title">
            <input className={inputClass} maxLength={70} name="seoTitle" type="text" defaultValue={translation.seoTitle ?? ""} />
          </Field>
          <Field help="160 characters maximum." label="SEO description">
            <textarea className={textareaClass} maxLength={160} name="seoDescription" defaultValue={translation.seoDescription ?? ""} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Open Graph</p>
          <Field label="Open Graph title">
            <input className={inputClass} maxLength={180} name="openGraphTitle" type="text" defaultValue={openGraphTitle} />
          </Field>
          <Field label="Open Graph description">
            <textarea className={textareaClass} maxLength={300} name="openGraphDescription" defaultValue={openGraphDescription} />
          </Field>
        </Card>

        {message ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              message.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            role={message.status === "success" ? "status" : "alert"}
          >
            {message.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <SubmitButton>Save translation draft</SubmitButton>
          <button
            className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700"
            formAction={readyAction}
            type="submit"
          >
            Mark ready
          </button>
          <button
            className="h-11 rounded-full border border-amber-200 bg-amber-50 px-5 text-xs font-black uppercase tracking-[0.16em] text-amber-700"
            formAction={reviewAction}
            type="submit"
          >
            Mark needs review
          </button>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to translation center
          </Link>
        </div>
      </form>

      <aside className="grid gap-4 self-start xl:sticky xl:top-6">
        <Card className="p-5 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Missing fields</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {translation.missingFields.length ? (
              translation.missingFields.map((field) => (
                <AdminBadge key={field} tone="red">{field}</AdminBadge>
              ))
            ) : (
              <AdminBadge tone="green">complete</AdminBadge>
            )}
          </div>
        </Card>

        <Card className="p-5 text-sm leading-6 text-slate-500 lg:p-6">
          <p><span className="font-black text-slate-800">Slug:</span> {translation.slug}</p>
          <p><span className="font-black text-slate-800">Route:</span> {translation.routePath}</p>
          <p><span className="font-black text-slate-800">Updated:</span> {translation.updatedAt ?? "Not set"}</p>
        </Card>
      </aside>
    </div>
  );
}
