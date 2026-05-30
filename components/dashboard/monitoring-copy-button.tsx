"use client";

import { useState } from "react";

export function MonitoringCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400"
      onClick={copyDetails}
      type="button"
    >
      {copied ? "Copied" : "Copy details"}
    </button>
  );
}
