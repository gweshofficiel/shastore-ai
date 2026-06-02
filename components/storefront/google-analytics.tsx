"use client";

import Script from "next/script";
import { useEffect } from "react";

type GoogleAnalyticsPayload = Record<string, string | number | boolean | null | undefined | GoogleAnalyticsItem[]>;

type GoogleAnalyticsItem = {
  item_id?: string;
  item_name?: string;
  price?: number;
  quantity?: number;
  variant?: string | null;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function canTrack() {
  return Boolean(typeof window !== "undefined" && typeof window.gtag === "function");
}

export function trackGoogleAnalyticsEvent(eventName: string, payload?: GoogleAnalyticsPayload) {
  if (!canTrack()) {
    return;
  }

  window.gtag?.("event", eventName, payload ?? {});
}

export function GoogleAnalyticsScript({
  enabled,
  measurementId
}: {
  enabled: boolean;
  measurementId: string;
}) {
  if (!enabled || !measurementId) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" />
      <Script id={`ga4-${measurementId}`} strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}

export function GoogleAnalyticsViewItem({
  currency,
  enabled,
  itemId,
  itemName,
  measurementId,
  value
}: {
  currency: string;
  enabled: boolean;
  itemId: string;
  itemName: string;
  measurementId: string;
  value?: number | null;
}) {
  useEffect(() => {
    if (!enabled || !measurementId) {
      return;
    }

    trackGoogleAnalyticsEvent("view_item", {
      currency,
      items: [{ item_id: itemId, item_name: itemName, price: value ?? undefined, quantity: 1 }],
      value: value ?? undefined
    });
  }, [currency, enabled, itemId, itemName, measurementId, value]);

  return null;
}

export function GoogleAnalyticsPurchase({
  currency,
  enabled,
  items,
  measurementId,
  orderId,
  value
}: {
  currency: string;
  enabled: boolean;
  items: GoogleAnalyticsItem[];
  measurementId: string;
  orderId: string;
  value: number;
}) {
  useEffect(() => {
    if (!enabled || !measurementId || !orderId) {
      return;
    }

    const key = `shastore_ga_purchase_${measurementId}_${orderId}`;

    if (window.localStorage.getItem(key)) {
      return;
    }

    trackGoogleAnalyticsEvent("purchase", {
      currency,
      items,
      transaction_id: orderId,
      value
    });
    window.localStorage.setItem(key, "1");
  }, [currency, enabled, items, measurementId, orderId, value]);

  return null;
}
