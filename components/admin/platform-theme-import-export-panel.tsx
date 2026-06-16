"use client";

import Link from "next/link";
import {
  importThemeToDraftAction,
  validateThemeImportAction
} from "@/lib/admin/platform-theme-actions";

const importConfirmMessage =
  "Import will replace current draft values only. Published theme will not change until you publish. Continue?";

export function PlatformThemeImportExportPanel() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex h-11 items-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
          href="/admin/platform-theme/export?source=draft"
        >
          Export Draft
        </Link>
        <Link
          className="inline-flex h-11 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
          href="/admin/platform-theme/export?source=published"
        >
          Export Published
        </Link>
      </div>

      <form action={validateThemeImportAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          <span>Validate import file</span>
          <input
            accept="application/json,.json"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
            name="themeImportFile"
            required
            type="file"
          />
        </label>
        <p className="text-xs font-semibold leading-5 text-slate-500">
          Upload a JSON export file to validate schema, supported keys, and safe values before importing.
        </p>
        <button
          className="h-11 w-fit rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
          type="submit"
        >
          Validate Import
        </button>
      </form>

      <form
        action={importThemeToDraftAction}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
        onSubmit={(event) => {
          if (!window.confirm(importConfirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          <span>Import theme to draft</span>
          <input
            accept="application/json,.json"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
            name="themeImportFile"
            required
            type="file"
          />
        </label>
        <p className="text-xs font-semibold leading-5 text-slate-500">
          Import applies values to draft branding only. Publish Branding is required to make imported theme live.
        </p>
        <button
          className="h-11 w-fit rounded-full border border-purple-200 bg-purple-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-purple-700"
          type="submit"
        >
          Import Theme
        </button>
      </form>
    </div>
  );
}
