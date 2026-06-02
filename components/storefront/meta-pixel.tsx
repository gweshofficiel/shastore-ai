"use client";

import Script from "next/script";
import { useEffect } from "react";

type MetaPixelPayload = Record<string, string | number | boolean | string[] | null | undefined>;

declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      loaded?: boolean;
      push?: (...args: unknown[]) => void;
      queue?: unknown[];
      version?: string;
    };
    _fbq?: Window["fbq"];
  }
}

function canTrack() {
  return Boolean(typeof window !== "undefined" && typeof window.fbq === "function");
}

export function trackMetaPixelEvent(eventName: string, payload?: MetaPixelPayload, eventId?: string) {
  if (!canTrack()) {
    return;
  }

  if (eventId) {
    window.fbq?.("track", eventName, payload ?? {}, { eventID: eventId });
    return;
  }

  window.fbq?.("track", eventName, payload ?? {});
}

export function MetaPixelScript({
  enabled,
  pixelId
}: {
  enabled: boolean;
  pixelId: string;
}) {
  if (!enabled || !pixelId) {
    return null;
  }

  return (
    <>
      <Script id={`meta-pixel-${pixelId}`} strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          alt=""
          height="1"
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
          style={{ display: "none" }}
          width="1"
        />
      </noscript>
    </>
  );
}

export function MetaPixelViewContent({
  contentId,
  contentName,
  currency,
  enabled,
  pixelId,
  value
}: {
  contentId: string;
  contentName: string;
  currency: string;
  enabled: boolean;
  pixelId: string;
  value?: number | null;
}) {
  useEffect(() => {
    if (!enabled || !pixelId) {
      return;
    }

    trackMetaPixelEvent("ViewContent", {
      content_ids: [contentId],
      content_name: contentName,
      content_type: "product",
      currency,
      value: value ?? undefined
    });
  }, [contentId, contentName, currency, enabled, pixelId, value]);

  return null;
}

export function MetaPixelPurchase({
  contentIds,
  currency,
  enabled,
  orderId,
  pixelId,
  value
}: {
  contentIds: string[];
  currency: string;
  enabled: boolean;
  orderId: string;
  pixelId: string;
  value: number;
}) {
  useEffect(() => {
    if (!enabled || !pixelId || !orderId) {
      return;
    }

    const key = `shastore_meta_purchase_${pixelId}_${orderId}`;

    if (window.localStorage.getItem(key)) {
      return;
    }

    trackMetaPixelEvent("Purchase", {
      content_ids: contentIds,
      content_type: "product",
      currency,
      value
    }, orderId);
    window.localStorage.setItem(key, "1");
  }, [contentIds, currency, enabled, orderId, pixelId, value]);

  return null;
}
