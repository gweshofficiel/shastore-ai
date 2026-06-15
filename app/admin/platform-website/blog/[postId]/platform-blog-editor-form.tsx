"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AdminBadge } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  savePlatformBlogEditorDraft,
  type PlatformBlogEditorActionState
} from "@/lib/admin/platform-website-actions";
import type { PlatformBlogPostRecord } from "@/src/lib/platform-website/blog/platform-blog-service";
import type { PlatformBlogCategoryRecord } from "@/src/lib/platform-website/blog/categories-service";
import type { PlatformBlogTagRecord } from "@/src/lib/platform-website/blog/tags-service";

const initialState: PlatformBlogEditorActionState = {
  message: "",
  status: "idle"
};

const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const textareaClass = "min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function jsonText(value: unknown) {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-11 rounded-full bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : "Save blog post"}
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

export function PlatformBlogEditorForm({
  categories,
  post,
  selectedCategoryIds,
  selectedTagIds,
  tags
}: {
  categories: PlatformBlogCategoryRecord[];
  post: PlatformBlogPostRecord;
  selectedCategoryIds: string[];
  selectedTagIds: string[];
  tags: PlatformBlogTagRecord[];
}) {
  const [state, formAction] = useActionState(savePlatformBlogEditorDraft, initialState);
  const initialSnapshot = useMemo(() => JSON.stringify({
    authorName: post.authorName,
    categoryIds: selectedCategoryIds,
    content: post.content,
    coverImageUrl: post.coverImageUrl ?? "",
    excerpt: post.excerpt,
    seoDescription: post.seoDescription ?? "",
    seoTitle: post.seoTitle ?? "",
    slug: post.slug,
    tagIds: selectedTagIds,
    title: post.title,
    translations: post.translations
  }), [post, selectedCategoryIds, selectedTagIds]);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (snapshot !== initialSnapshot) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warnIfUnsaved);

    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, [initialSnapshot, snapshot]);

  return (
    <Card className="grid gap-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Blog post editor</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Edit platform blog post</h2>
        </div>
        <AdminBadge tone={post.status === "published" ? "green" : post.status === "archived" ? "red" : "amber"}>
          {post.status}
        </AdminBadge>
      </div>

      {state.message ? (
        <div
          className={`rounded-[2rem] border p-4 text-sm font-bold leading-6 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </div>
      ) : null}

      <form
        action={formAction}
        className="grid gap-5"
        onChange={(event) => {
          const formData = new FormData(event.currentTarget);
          setSnapshot(JSON.stringify(Object.fromEntries(formData.entries())));
        }}
      >
        <input name="postId" type="hidden" value={post.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <input className={inputClass} maxLength={180} name="postTitle" required type="text" defaultValue={post.title} />
          </Field>
          <Field help="URL-safe and unique across platform blog posts." label="Slug">
            <input className={inputClass} maxLength={120} name="postSlug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required type="text" defaultValue={post.slug} />
          </Field>
          <Field label="Author name">
            <input className={inputClass} maxLength={120} name="authorName" type="text" defaultValue={post.authorName} />
          </Field>
          <Field label="Cover image URL">
            <input className={inputClass} maxLength={1000} name="coverImageUrl" type="text" defaultValue={post.coverImageUrl ?? ""} />
          </Field>
        </div>

        <Field help="Short safe summary for blog lists and SEO fallback." label="Excerpt">
          <textarea className={textareaClass} maxLength={500} name="excerpt" defaultValue={post.excerpt} />
        </Field>

        <section className="grid gap-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Categories and tags</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Assignments organize platform blog navigation only. Customer store blogs are not affected.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Categories</p>
              {categories.length ? (
                categories.map((category) => (
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" key={category.id}>
                    <input
                      defaultChecked={selectedCategoryIds.includes(category.id)}
                      name="categoryIds"
                      type="checkbox"
                      value={category.id}
                    />
                    {category.name}
                  </label>
                ))
              ) : (
                <p className="text-xs font-semibold text-slate-500">No active categories yet.</p>
              )}
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tags</p>
              {tags.length ? (
                tags.map((tag) => (
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" key={tag.id}>
                    <input
                      defaultChecked={selectedTagIds.includes(tag.id)}
                      name="tagIds"
                      type="checkbox"
                      value={tag.id}
                    />
                    {tag.name}
                  </label>
                ))
              ) : (
                <p className="text-xs font-semibold text-slate-500">No active tags yet.</p>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Field help="Recommended max 70 characters." label="SEO title">
            <input className={inputClass} maxLength={70} name="seoTitle" type="text" defaultValue={post.seoTitle ?? ""} />
          </Field>
          <Field help="Recommended max 160 characters." label="SEO description">
            <input className={inputClass} maxLength={160} name="seoDescription" type="text" defaultValue={post.seoDescription ?? ""} />
          </Field>
        </div>

        <Field help="JSON object only. No scripts or unsafe event handlers are stored." label="Content JSON">
          <textarea className={`${textareaClass} min-h-72 font-mono text-xs`} name="content" defaultValue={jsonText(post.content)} />
        </Field>

        <Field help="JSON object keyed by en/ar/fr. Locale entries can include status, title, excerpt, content, seoTitle, and seoDescription." label="Translations JSON">
          <textarea className={`${textareaClass} min-h-72 font-mono text-xs`} name="translations" defaultValue={jsonText(post.translations)} />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton />
          {snapshot !== initialSnapshot ? (
            <span className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Unsaved changes</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
