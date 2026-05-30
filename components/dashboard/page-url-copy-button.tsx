"use client";

import { useState } from "react";

export function PageUrlCopyButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:border-slate-400"
      onClick={copyUrl}
      type="button"
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}
