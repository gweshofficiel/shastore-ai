import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingNotificationType =
  | "grace_period_started"
  | "payment_failed"
  | "payment_recovered"
  | "subscription_canceled"
  | "subscription_reactivated"
  | "subscription_restricted";

type NotificationMetadata = Record<string, unknown>;

const notificationCopy: Record<
  BillingNotificationType,
  { message: string; title: string }
> = {
  grace_period_started: {
    title: "Payment recovery grace period started",
    message:
      "Your storefronts remain online during grace period, but protected billing actions are paused until payment is recovered."
  },
  payment_failed: {
    title: "Payment failed",
    message:
      "Stripe could not collect your latest subscription payment. Update billing to avoid access restrictions."
  },
  payment_recovered: {
    title: "Payment recovered",
    message: "Your payment succeeded and protected SHASTORE AI billing access has been restored."
  },
  subscription_canceled: {
    title: "Subscription canceled",
    message:
      "Your subscription has ended. Your data remains safe, but paid access is locked until you reactivate."
  },
  subscription_reactivated: {
    title: "Subscription reactivated",
    message: "Your subscription is active again and paid features are available."
  },
  subscription_restricted: {
    title: "Subscription restricted",
    message:
      "Paid actions are restricted until billing is resolved. Your stores, products, and orders remain safe."
  }
};

const sensitiveKeyPattern = /email|password|secret|token|key|credential|phone|customer/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 240);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as NotificationMetadata);
  }

  return String(value).slice(0, 120);
}

function sanitizeMetadata(metadata: NotificationMetadata = {}) {
  const safe: NotificationMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    safe[key.slice(0, 80)] = sanitizeValue(value);
  }

  return safe;
}

async function notificationAlreadyExists(
  supabase: SupabaseClient,
  userId: string,
  type: BillingNotificationType,
  providerEventId?: string | null
) {
  if (!providerEventId) {
    return false;
  }

  const { data, error } = await supabase
    .from("notifications" as never)
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .contains("metadata", { providerEventId } as never)
    .limit(1);

  if (error) {
    console.warn("[billing-notification] duplicate lookup skipped", {
      message: error.message,
      type,
      userId
    });
    return false;
  }

  return Boolean((data ?? []).length);
}

export async function createBillingNotification({
  message,
  metadata = {},
  providerEventId,
  supabase,
  title,
  type,
  userId
}: {
  message?: string;
  metadata?: NotificationMetadata;
  providerEventId?: string | null;
  supabase?: SupabaseClient;
  title?: string;
  type: BillingNotificationType;
  userId: string | null | undefined;
}) {
  if (!userId) {
    console.warn("[billing-notification] skipped without user", { type });
    return;
  }

  const client = createAdminClient() ?? supabase;

  if (!client) {
    console.warn("[billing-notification] skipped without service client", { type, userId });
    return;
  }

  if (await notificationAlreadyExists(client, userId, type, providerEventId)) {
    console.info("[billing-notification] duplicate ignored", { type, userId });
    return;
  }

  const copy = notificationCopy[type];
  const safeMetadata = sanitizeMetadata({
    ...metadata,
    emailReady: true,
    providerEventId: providerEventId ?? null
  });
  const { error } = await client.from("notifications" as never).insert({
    message: message ?? copy.message,
    metadata: safeMetadata,
    title: title ?? copy.title,
    type,
    user_id: userId
  } as never);

  if (error) {
    console.warn("[billing-notification] insert failed", {
      message: error.message,
      type,
      userId
    });
    return;
  }

  console.info("[billing-notification] created", {
    emailReady: true,
    type,
    userId
  });
}
