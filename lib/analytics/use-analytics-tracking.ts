"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/actions";
import type { AnalyticsEventType, AnalyticsSource } from "@/lib/analytics/types";

function getOrCreateVisitorId() {
  const key = "shastore-analytics-visitor-id";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export function useAnalyticsTracking(source: AnalyticsSource) {
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [, startTransition] = useTransition();

  const track = useCallback(
    (
      eventType: AnalyticsEventType,
      input: {
        productId?: string | null;
        productName?: string | null;
        metadata?: Record<string, string | number | boolean | null>;
      } = {}
    ) => {
      if (!visitorId || !sessionId) {
        return;
      }

      startTransition(() => {
        void trackAnalyticsEvent({
          eventType,
          metadata: input.metadata,
          path: window.location.pathname,
          productId: input.productId,
          productName: input.productName,
          referrer: document.referrer || null,
          sessionId,
          sourceSlug: source.sourceSlug,
          sourceType: source.sourceType,
          userAgent: window.navigator.userAgent,
          visitorId
        });
      });
    },
    [sessionId, source.sourceSlug, source.sourceType, visitorId]
  );

  useEffect(() => {
    const nextVisitorId = getOrCreateVisitorId();
    const nextSessionId = crypto.randomUUID();
    setVisitorId(nextVisitorId);
    setSessionId(nextSessionId);

    startTransition(() => {
      void trackAnalyticsEvent({
        eventType: "visitor_session",
        path: window.location.pathname,
        referrer: document.referrer || null,
        sessionId: nextSessionId,
        sourceSlug: source.sourceSlug,
        sourceType: source.sourceType,
        userAgent: window.navigator.userAgent,
        visitorId: nextVisitorId
      });
      void trackAnalyticsEvent({
        eventType: "page_view",
        path: window.location.pathname,
        referrer: document.referrer || null,
        sessionId: nextSessionId,
        sourceSlug: source.sourceSlug,
        sourceType: source.sourceType,
        userAgent: window.navigator.userAgent,
        visitorId: nextVisitorId
      });
    });
  }, [source.sourceSlug, source.sourceType]);

  return {
    sessionId,
    track,
    visitorId
  };
}
