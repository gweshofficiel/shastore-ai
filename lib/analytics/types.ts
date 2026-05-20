import type { CommerceAnalyticsEventType, CommerceSourceType } from "@/lib/commerce/types";

export type AnalyticsEventType =
  | "page_view"
  | "visitor_session"
  | "whatsapp_click"
  | "checkout_started"
  | "order_created"
  | "conversion"
  | "product_view";

export type AnalyticsSource = {
  sourceType: CommerceSourceType;
  sourceSlug: string;
};

export type AnalyticsPayload = AnalyticsSource & {
  eventType: AnalyticsEventType | CommerceAnalyticsEventType;
  visitorId?: string;
  sessionId?: string;
  productId?: string | null;
  productName?: string | null;
  referrer?: string | null;
  path?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};
