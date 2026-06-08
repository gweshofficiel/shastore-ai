"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertDeliveryPerformanceSnapshot } from "@/lib/delivery/performance-data";
import { createAdminClient } from "@/lib/supabase/admin";

type OrderSource = "orders" | "store_orders";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanRating(value: FormDataEntryValue | null) {
  const rating = Number.parseInt(cleanText(value, 20), 10);
  return [1, 2, 3, 4, 5].includes(rating) ? rating : null;
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = cleanText(value, 400);
  return returnTo.startsWith("/store/") ? returnTo : "/";
}

function redirectWithRatingStatus(returnTo: string, status: string): never {
  const [path, rawQuery = ""] = returnTo.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("deliveryRating", status);
  redirect(`${path}?${params.toString()}`);
}

export async function submitDeliveryRatingAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const source = cleanText(formData.get("source"), 40) as OrderSource;
  const phone = cleanText(formData.get("phone"), 80);
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const rating = cleanRating(formData.get("rating"));
  const comment = cleanText(formData.get("comment"), 1000);

  if (!orderId || (source !== "orders" && source !== "store_orders") || !phone || !rating) {
    redirectWithRatingStatus(returnTo, "invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirectWithRatingStatus(returnTo, "not-configured");
  }

  const tableName = source === "orders" ? "orders" : "store_orders";
  const { data: order, error: orderError } = await admin
    .from(tableName as never)
    .select("id, workspace_id, store_id, store_instance_id, customer_phone, delivery_status")
    .eq("id" as never, orderId as never)
    .maybeSingle();

  if (orderError || !order) {
    redirectWithRatingStatus(returnTo, "not-authorized");
  }

  const orderRow = order as unknown as {
    customer_phone?: string | null;
    delivery_status?: string | null;
    id: string;
    store_id?: string | null;
    store_instance_id?: string | null;
    workspace_id?: string | null;
  };
  const normalizedPhone = phone.replace(/\D/g, "");
  const orderPhone = (orderRow.customer_phone ?? "").replace(/\D/g, "");

  if (!normalizedPhone || normalizedPhone !== orderPhone) {
    redirectWithRatingStatus(returnTo, "not-authorized");
  }

  const storeId = orderRow.store_id ?? orderRow.store_instance_id;
  const workspaceId = orderRow.workspace_id;

  if (!storeId || !workspaceId) {
    redirectWithRatingStatus(returnTo, "not-authorized");
  }

  const { data: assignment } = await admin
    .from("delivery_assignments" as never)
    .select("id, delivery_agent_id, status")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("order_source" as never, source as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();
  const assignmentRow = assignment as { delivery_agent_id?: string | null; id?: string | null; status?: string | null } | null;

  if (!assignmentRow?.delivery_agent_id || assignmentRow.status !== "delivered") {
    redirectWithRatingStatus(returnTo, "not-delivered");
  }

  const { data: existingRating } = await admin
    .from("delivery_ratings" as never)
    .select("id")
    .eq("delivery_agent_id" as never, assignmentRow.delivery_agent_id as never)
    .eq("order_source" as never, source as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();
  const eventType = existingRating ? "delivery_rating_updated" : "delivery_rating_created";
  const { error } = await admin.from("delivery_ratings" as never).upsert(
    {
      comment: comment || null,
      customer_phone: phone,
      delivery_agent_id: assignmentRow.delivery_agent_id,
      metadata: {
        source: "public_order_tracking"
      },
      order_id: orderId,
      order_source: source,
      rating,
      store_id: storeId,
      workspace_id: workspaceId
    } as never,
    { onConflict: "delivery_agent_id,order_source,order_id" } as never
  );

  if (error) {
    redirectWithRatingStatus(returnTo, "failed");
  }

  await Promise.all([
    admin.from("monitoring_events" as never).insert({
      entity_id: orderId,
      entity_type: "delivery_ratings",
      event_status: "info",
      event_type: eventType,
      metadata: {
        delivery_agent_id: assignmentRow.delivery_agent_id,
        rating,
        source: "public_order_tracking"
      },
      store_id: storeId,
      user_id: null,
      workspace_id: workspaceId
    } as never),
    upsertDeliveryPerformanceSnapshot({
      agentId: assignmentRow.delivery_agent_id,
      storeId,
      workspaceId
    })
  ]);

  revalidatePath(returnTo);
  revalidatePath("/delivery/dashboard/performance");
  revalidatePath("/dashboard/delivery-agents");
  redirectWithRatingStatus(returnTo, existingRating ? "updated" : "submitted");
}
