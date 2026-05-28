import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueStoreEmailEventSafe } from "@/lib/store-email-queue";

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

function cleanEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

function orderReference(orderId: string) {
  return orderId.slice(0, 8);
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
  eventType,
  orderId,
  processedAt,
  scheduledFor,
  storeId,
  workspaceId
}: {
  customerId?: string | null;
  eventType: LifecycleEventType;
  orderId: string;
  processedAt?: string | null;
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
      event_type: eventType,
      order_id: orderId,
      processed_at: processedAt ?? null,
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
    const resolvedCustomerName = customer?.name ?? customerName ?? "Customer";
    const now = new Date();
    const metadata = {
      customerName: resolvedCustomerName,
      orderReference: orderReference(orderId),
      orderSource,
      totalAmount
    };

    const thankYouEventId = await createLifecycleEvent({
      customerId: customer?.id ?? null,
      eventType: "thank_you",
      orderId,
      processedAt: now.toISOString(),
      scheduledFor: now.toISOString(),
      storeId,
      workspaceId
    });

    if (thankYouEventId) {
      await queueStoreEmailEventSafe({
        metadata,
        recipient,
        storeId,
        templateKey: "thank_you",
        workspaceId
      });
    }

    if (
      customer &&
      (customer.total_orders ?? 0) <= 1 &&
      !(await hasExistingWelcome({ customerId: customer.id, storeId, workspaceId }))
    ) {
      const welcomeEventId = await createLifecycleEvent({
        customerId: customer.id,
        eventType: "customer_welcome",
        orderId,
        processedAt: now.toISOString(),
        scheduledFor: now.toISOString(),
        storeId,
        workspaceId
      });

      if (welcomeEventId) {
        await queueStoreEmailEventSafe({
          metadata,
          recipient,
          storeId,
          templateKey: "customer_welcome",
          workspaceId
        });
      }
    }

    await createLifecycleEvent({
      customerId: customer?.id ?? null,
      eventType: "review_reminder",
      orderId,
      scheduledFor: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      storeId,
      workspaceId
    });

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
    .select("id, workspace_id, store_id, customer_id, order_id, event_type, scheduled_for, store_customers(name, email)")
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

  const events = (data ?? []) as unknown as Array<{
    id: string;
    event_type: LifecycleEventType;
    order_id: string;
    store_customers?: { email?: string | null; name?: string | null } | null;
    store_id: string;
    workspace_id: string;
  }>;

  for (const event of events) {
    result.processed += 1;

    const queued = await queueStoreEmailEventSafe({
      metadata: {
        customerName: event.store_customers?.name ?? "Customer",
        orderReference: orderReference(event.order_id)
      },
      recipient: event.store_customers?.email ?? null,
      storeId: event.store_id,
      templateKey: event.event_type,
      workspaceId: event.workspace_id
    });

    if (!queued) {
      result.skipped += 1;
      continue;
    }

    await admin
      .from("customer_lifecycle_events" as never)
      .update({ processed_at: new Date().toISOString() } as never)
      .eq("id" as never, event.id as never)
      .is("processed_at" as never, null);

    result.queued += 1;
  }

  revalidatePath("/dashboard/email");
  return result;
}
