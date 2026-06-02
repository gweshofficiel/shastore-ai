"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreMarketingMessageRow } from "@/lib/store-marketing-messages";

type StoreMarketingMessagesProps = {
  messages: StoreMarketingMessageRow[];
  storeId: string;
};

function messageStorageKey(storeId: string, messageId: string, kind: "closed" | "shown") {
  return `shastore_marketing_${kind}_${storeId}_${messageId}`;
}

function isExternalLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function MarketingButton({ href, label }: { href: string | null; label: string | null }) {
  if (!href || !label) {
    return null;
  }

  return (
    <a
      className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
      href={href}
      rel={isExternalLink(href) ? "noreferrer" : undefined}
      target={isExternalLink(href) ? "_blank" : undefined}
    >
      {label}
    </a>
  );
}

export function StoreMarketingMessages({ messages, storeId }: StoreMarketingMessagesProps) {
  const announcements = messages.filter((message) => message.message_type === "announcement_bar");
  const firstPopup = useMemo(
    () => messages.find((message) => message.message_type !== "announcement_bar") ?? null,
    [messages]
  );
  const [visiblePopupId, setVisiblePopupId] = useState<string | null>(null);

  useEffect(() => {
    if (!firstPopup) {
      return;
    }

    const closedKey = messageStorageKey(storeId, firstPopup.id, "closed");
    const shownKey = messageStorageKey(storeId, firstPopup.id, "shown");

    if (window.localStorage.getItem(closedKey) || window.sessionStorage.getItem(shownKey)) {
      return;
    }

    const showPopup = () => {
      if (window.localStorage.getItem(closedKey) || window.sessionStorage.getItem(shownKey)) {
        return;
      }

      window.sessionStorage.setItem(shownKey, "1");
      setVisiblePopupId(firstPopup.id);
    };

    if (firstPopup.message_type === "exit_intent_popup") {
      const onMouseOut = (event: MouseEvent) => {
        if (event.clientY <= 0) {
          showPopup();
        }
      };

      document.addEventListener("mouseout", onMouseOut);
      return () => document.removeEventListener("mouseout", onMouseOut);
    }

    const timer = window.setTimeout(showPopup, 900);

    return () => window.clearTimeout(timer);
  }, [firstPopup, storeId]);

  const visiblePopup = firstPopup && visiblePopupId === firstPopup.id ? firstPopup : null;

  function closePopup() {
    if (visiblePopup) {
      window.localStorage.setItem(messageStorageKey(storeId, visiblePopup.id, "closed"), "1");
    }

    setVisiblePopupId(null);
  }

  return (
    <>
      {announcements.map((announcement) => (
        <div
          className="border-b border-white/20 bg-ink px-4 py-3 text-center text-white"
          key={announcement.id}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em]">{announcement.title}</p>
            <p className="text-sm font-semibold">{announcement.message}</p>
            {announcement.button_link && announcement.button_text ? (
              <a
                className="rounded-full bg-white px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-ink"
                href={announcement.button_link}
                rel={isExternalLink(announcement.button_link) ? "noreferrer" : undefined}
                target={isExternalLink(announcement.button_link) ? "_blank" : undefined}
              >
                {announcement.button_text}
              </a>
            ) : null}
          </div>
        </div>
      ))}

      {visiblePopup ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 text-ink shadow-[0_30px_100px_-40px_rgba(15,23,42,0.9)]">
            <button
              aria-label="Close popup"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-lg font-black text-muted transition hover:bg-slate-200"
              onClick={closePopup}
              type="button"
            >
              x
            </button>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {visiblePopup.message_type.replaceAll("_", " ")}
            </p>
            <h2 className="mt-3 pr-10 text-3xl font-black tracking-[-0.04em] text-ink">{visiblePopup.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">{visiblePopup.message}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <MarketingButton href={visiblePopup.button_link} label={visiblePopup.button_text} />
              <button
                className="inline-flex h-10 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-black text-muted transition hover:bg-slate-200"
                onClick={closePopup}
                type="button"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
