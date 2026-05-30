import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueStoreEmailEventSafe } from "@/lib/store-email-queue";
import type { Json } from "@/types/database";

type LifecycleEventType = "customer_welcome" | "review_reminder" | "thank_you";

type ConfirmedOrderLifecycleInput = {
  customerEmail?: string | null;
  customerName?: string | null;
  orderId: string;
  orderSource: string;
  storeId: string;
  totalAmount?: number | null;
  workspaceId: string;
};

type StoreCustomerRow = {
  email?: string | null;
  id: string;
  name?: string | null;
  total_orders?: number | null;
};

type LifecycleProcessInput = {
  limit?: number;
  storeId?: string | null;
  workspaceId: string;
};

type LifecycleProcessResult = {
  processed: number;
  queued: number;
  skipped: number;
};

type LifecycleSettings = {
  enable_customer_welcome?: boolean | null;
  enable_review_reminder?: boolean | null;
  enable_thank_you?: boolean | null;
};

type LifecycleEventRow = {
  customer_name?: string | null;
  event_type: LifecycleEventType;
  id: string;
  metadata?: Record<string, unknown> | null;
  order_id: string;
  recipient?: string | null;
  store_id: string;
  workspace_id: string;
};

function cleanEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

function orderReference(orderId: string) {
  return orderId.slice(0, 8);
}

function lifecycleEnabled(settings: LifecycleSettings | null, eventType: LifecycleEventType) {
  if (eventType === "customer_welcome") {
    return settings?.enable_customer_welcome === true;
  }

  if (eventType === "thank_you") {
    return settings?.enable_thank_you !== false;
  }

  return settings?.enable_review_reminder !== false;
}

async function getLifecycleSettings({
  storeId,
  workspaceId
}: {
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("store_email_settings" as never)
    .select("enable_customer_welcome, enable_thank_you, enable_review_reminder")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  return (data as LifecycleSettings | null) ?? null;
}

async function resolveStoreCustomer({
  customerEmail,
  orderId,
  storeId,
  workspaceId
}: {
  customerEmail?: string | null;
  orderId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const email = cleanEmail(customerEmail);

  if (email) {
    const { data } = await admin
      .from("store_customers" as never)
      .select("id, name, email, total_orders")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("normalized_email" as never, email as never)
      .maybeSingle();

    if (data) {
      return data as StoreCustomerRow;
    }
  }

  const { data } = await admin
    .from("store_customers" as never)
    .select("id, name, email, total_orders")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("last_order_id" as never, orderId as never)
    .maybeSingle();

  return (data as StoreCustomerRow | null) ?? null;
}

async function createLifecycleEvent({
  customerId,
  customerName,
  eventType,
  metadata,
  orderId,
  orderSource,
  recipient,
  scheduledFor,
  storeId,
  workspaceId
}: {
  customerId?: string | null;
  customerName?: string | null;
  eventType: LifecycleEventType;
  metadata?: Record<string, unknown>;
  orderId: string;
  orderSource: string;
  recipient?: string | null;
  scheduledFor: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("customer_lifecycle_events" as never)
    .insert({
      customer_id: customerId ?? null,
      customer_name: customerName ?? null,
      event_type: eventType,
      metadata: (metadata ?? {}) as Json,
      order_id: orderId,
      order_source: orderSource,
      recipient: cleanEmail(recipient),
      scheduled_for: scheduledFor,
      store_id: storeId,
      workspace_id: workspaceId
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code !== "23505") {
      console.warn("[customer-lifecycle-email] event insert failed", {
        code: error.code,
        eventType,
        message: error.message,
        orderId,
        storeId,
        workspaceId
      });
    }

    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function markLifecycleEventProcessed(eventId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin
    .from("customer_lifecycle_events" as never)
    .update({ processed_at: new Date().toISOString() } as never)
    .eq("id" as never, eventId as never)
    .is("processed_at" as never, null);
}

async function queueLifecycleEventNow({
  eventId,
  eventType,
  metadata,
  recipient,
  storeId,
  workspaceId
}: {
  eventId: string;
  eventType: LifecycleEventType;
  metadata: Record<string, unknown>;
  recipient?: string | null;
  storeId: string;
  workspaceId: string;
}) {
  const queued = await queueStoreEmailEventSafe({
    metadata,
    recipient,
    storeId,
    templateKey: eventType,
    workspaceId
  });

  if (queued) {
    await markLifecycleEventProcessed(eventId);
  }

  return queued;
}

async function hasExistingWelcome({
  customerId,
  storeId,
  workspaceId
}: {
  customerId?: string | null;
  storeId: string;
  workspaceId: string;
}) {
  if (!customerId) {
    return false;
  }

  const admin = createAdminClient();

  if (!admin) {
    return true;
  }

  const { data } = await admin
    .from("customer_lifecycle_events" as never)
    .select("id")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("customer_id" as never, customerId as never)
    .eq("event_type" as never, "customer_welcome" as never)
    .maybeSingle();

  return Boolean(data);
}

export async function createCustomerLifecycleEventsForConfirmedOrderSafe({
  customerEmail,
  customerName,
  orderId,
  orderSource,
  storeId,
  totalAmount,
  workspaceId
}: ConfirmedOrderLifecycleInput) {
  try {
    const customer = await resolveStoreCustomer({
      customerEmail,
      orderId,
      storeId,
      workspaceId
    });
    const recipient = customer?.email ?? customerEmail ?? null;
    const cleanRecipient = cleanEmail(recipient);

    if (!cleanRecipient) {
      return;
    }

    const settings = await getLifecycleSettings({ storeId, workspaceId });
    const resolvedCustomerName = customer?.name ?? customerName ?? "Customer";
    const now = new Date();
    const metadata = {
      customerName: resolvedCustomerName,
      orderReference: orderReference(orderId),
      orderSource,
      totalAmount
    };

    if (lifecycleEnabled(settings, "thank_you")) {
      const thankYouEventId = await createLifecycleEvent({
        customerId: customer?.id ?? null,
        customerName: resolvedCustomerName,
        eventType: "thank_you",
        metadata,
        orderId,
        orderSource,
        recipient: cleanRecipient,
        scheduledFor: now.toISOString(),
        storeId,
        workspaceId
      });

      if (thankYouEventId) {
        await queueLifecycleEventNow({
          eventId: thankYouEventId,
          eventType: "thank_you",
          metadata,
          recipient: cleanRecipient,
          storeId,
          workspaceId
        });
      }
    }

    if (
      customer &&
      (customer.total_orders ?? 0) <= 1 &&
      lifecycleEnabled(settings, "customer_welcome") &&
      !(await hasExistingWelcome({ customerId: customer.id, storeId, workspaceId }))
    ) {
      const welcomeEventId = await createLifecycleEvent({
        customerId: customer.id,
        customerName: resolvedCustomerName,
        eventType: "customer_welcome",
        metadata,
        orderId,
        orderSource,
        recipient: cleanRecipient,
        scheduledFor: now.toISOString(),
        storeId,
        workspaceId
      });

      if (welcomeEventId) {
        await queueLifecycleEventNow({
          eventId: welcomeEventId,
          eventType: "customer_welcome",
          metadata,
          recipient: cleanRecipient,
          storeId,
          workspaceId
        });
      }
    }

    if (lifecycleEnabled(settings, "review_reminder")) {
      await createLifecycleEvent({
        customerId: customer?.id ?? null,
        customerName: resolvedCustomerName,
        eventType: "review_reminder",
        metadata,
        orderId,
        orderSource,
        recipient: cleanRecipient,
        scheduledFor: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        storeId,
        workspaceId
      });
    }

    revalidatePath("/dashboard/email");
  } catch (error) {
    console.warn("[customer-lifecycle-email] confirmed order lifecycle failed safely", {
      message: error instanceof Error ? error.message : String(error),
      orderId,
      storeId,
      workspaceId
    });
  }
}

export async function processDueCustomerLifecycleEvents({
  limit = 10,
  storeId,
  workspaceId
}: LifecycleProcessInput): Promise<LifecycleProcessResult> {
  const result = {
    processed: 0,
    queued: 0,
    skipped: 0
  };
  const admin = createAdminClient();

  if (!admin) {
    return result;
  }

  const query = admin
    .from("customer_lifecycle_events" as never)
    .select("id, workspace_id, store_id, order_id, event_type, recipient, customer_name, metadata")
    .eq("workspace_id" as never, workspaceId as never)
    .is("processed_at" as never, null)
    .lte("scheduled_for" as never, new Date().toISOString())
    .order("scheduled_for" as never, { ascending: true } as never)
    .limit(Math.max(1, Math.min(limit, 50)));

  if (storeId) {
    query.eq("store_id" as never, storeId as never);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[customer-lifecycle-email] due lifecycle lookup failed", {
      code: error.code,
      message: error.message,
      storeId,
      workspaceId
    });
    return result;
  }

  const events = (data ?? []) as unknown as LifecycleEventRow[];
  const settingsCache = new Map<string, LifecycleSettings | null>();

  for (const event of events) {
    result.processed += 1;
    const recipient = cleanEmail(event.recipient);
    const cacheKey = `${event.workspace_id}:${event.store_id}`;
    let settings = settingsCache.get(cacheKey);

    if (!settingsCache.has(cacheKey)) {
      settings = await getLifecycleSettings({
        storeId: event.store_id,
        workspaceId: event.workspace_id
      });
      settingsCache.set(cacheKey, settings ?? null);
    }

    if (!recipient || !lifecycleEnabled(settings ?? null, event.event_type)) {
      await markLifecycleEventProcessed(event.id);
      result.skipped += 1;
      continue;
    }

    const queued = await queueLifecycleEventNow({
      eventId: event.id,
      eventType: event.event_type,
      metadata: {
        ...(event.metadata ?? {}),
        customerName: event.customer_name ?? event.metadata?.customerName ?? "Customer",
        orderReference: event.metadata?.orderReference ?? orderReference(event.order_id)
      },
      recipient,
      storeId: event.store_id,
      workspaceId: event.workspace_id
    });

    if (!queued) {
      result.skipped += 1;
      continue;
    }

    result.queued += 1;
  }

  revalidatePath("/dashboard/email");
  return result;
}
