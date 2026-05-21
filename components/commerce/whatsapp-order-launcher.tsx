"use client";

import { useEffect } from "react";

export function WhatsAppOrderLauncher({ url }: { url: string }) {
  useEffect(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  return (
    <a
      className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-black text-white transition hover:bg-emerald-700"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      Open WhatsApp order
    </a>
  );
}
