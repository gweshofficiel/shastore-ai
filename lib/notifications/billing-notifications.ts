import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBillingNotificationEmailSafe } from "@/lib/notifications/email-provider";

export type BillingNotificationType =
  | "grace_period_started"
  | "payment_failed"
  | "payment_recovered"
  | "subscription_activated"
  | "subscription_canceled"
  | "subscription_canceled_at_period_end"
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
  subscription_activated: {
    title: "Subscription activated",
    message: "Your SHASTORE AI subscription is active and paid features are available."
  },
  subscription_canceled: {
    title: "Subscription canceled",
    message:
      "Your subscription has ended. Your data remains safe, but paid access is locked until you reactivate."
  },
  subscription_canceled_at_period_end: {
    title: "Subscription scheduled to cancel",
    message:
      "Your subscription is scheduled to cancel at period end. Access continues until the current period ends."
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
    console.warn("[billing-notification-error] duplicate lookup skipped", {
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
  title,
  type,
  userId
}: {
  message?: string;
  metadata?: NotificationMetadata;
  providerEventId?: string | null;
  title?: string;
  type: BillingNotificationType;
  userId: string | null | undefined;
}) {
  if (!userId) {
    console.warn("[notification-insert] skipped without user", {
      failureReason: "missing_user_id",
      type
    });
    return false;
  }

  const client = createAdminClient();

  if (!client) {
    console.warn("[notification-insert] skipped without service client", {
      failureReason: "missing_supabase_service_role",
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      type,
      userId
    });
    return false;
  }

  if (await notificationAlreadyExists(client, userId, type, providerEventId)) {
    console.log("[notification-insert] duplicate ignored", { providerEventId, type, userId });
    return false;
  }

  const copy = notificationCopy[type];
  const safeMetadata = sanitizeMetadata({
    ...metadata,
    emailReady: true,
    providerEventId: providerEventId ?? null
  });
  const insertPayload = {
    message: message ?? copy.message,
    metadata: safeMetadata,
    title: title ?? copy.title,
    type,
    user_id: userId
  };

  console.log("[notification-insert] attempting insert", {
    payload: insertPayload,
    providerEventId: providerEventId ?? null,
    type,
    userId
  });

  const { data, error } = await client
    .from("notifications" as never)
    .insert(insertPayload as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[notification-insert] insert failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      type,
      userId
    });
    return false;
  }

  console.log("[notification-insert] insert succeeded", {
    notificationId: (data as { id?: string } | null)?.id ?? null,
    type,
    userId
  });

  await sendBillingNotificationEmailSafe({
    metadata: safeMetadata,
    type,
    userId
  });

  return true;
}
