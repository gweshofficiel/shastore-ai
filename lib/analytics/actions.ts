"use server";

import { createClient } from "@/lib/supabase/server";
import type { AnalyticsPayload } from "@/lib/analytics/types";

export async function trackAnalyticsEvent(input: AnalyticsPayload) {
  const supabase = await createClient();

  try {
    await supabase.rpc("track_analytics_event" as never, {
      p_source_type: input.sourceType,
      p_source_slug: input.sourceSlug,
      p_event_type: input.eventType,
      p_visitor_id: input.visitorId ?? null,
      p_session_id: input.sessionId ?? null,
      p_product_id: input.productId ?? null,
      p_product_name: input.productName ?? null,
      p_referrer: input.referrer ?? null,
      p_path: input.path ?? null,
      p_user_agent: input.userAgent ?? null,
      p_metadata: input.metadata ?? {}
    } as never);
  } catch {
    // Analytics must never block storefront rendering or checkout.
  }
}
