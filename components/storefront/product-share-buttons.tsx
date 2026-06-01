"use client";

import { useEffect, useMemo, useState } from "react";

type ProductShareButtonsProps = {
  productTitle: string;
};

function shareButtonClass(extra = "") {
  return `inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-muted transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink ${extra}`;
}

export function ProductShareButtons({ productTitle }: ProductShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const shareText = productTitle ? `Check out ${productTitle}` : "Check out this product";

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const links = useMemo(() => {
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedText = encodeURIComponent(`${shareText}${currentUrl ? ` ${currentUrl}` : ""}`);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}`
    };
  }, [currentUrl, shareText]);

  async function copyLink() {
    if (!currentUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = currentUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Share product
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Send this product page to someone else.
          </p>
        </div>
        {copied ? (
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Link copied
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={shareButtonClass()} onClick={copyLink} type="button">
          Copy link
        </button>
        <a className={shareButtonClass()} href={links.whatsapp} rel="noreferrer" target="_blank">
          WhatsApp
        </a>
        <a className={shareButtonClass()} href={links.facebook} rel="noreferrer" target="_blank">
          Facebook
        </a>
        <a className={shareButtonClass()} href={links.twitter} rel="noreferrer" target="_blank">
          X/Twitter
        </a>
      </div>
    </div>
  );
}
