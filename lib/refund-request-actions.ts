"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type OrderSource = "orders" | "store_orders";
type RefundStatus = "requested" | "approved" | "rejected" | "processed" | "closed";

const refundsPath = "/dashboard/refunds";
const refundStatuses = new Set<RefundStatus>(["requested", "approved", "rejected", "processed", "closed"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function parseAmount(value: FormDataEntryValue | null) {
  const parsed = Number(cleanText(value, 40).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const candidate = cleanText(value, 500);
  return candidate.startsWith("/store/") || candidate.startsWith("/dashboard/refunds") ? candidate : refundsPath;
}

function redirectWith(path: string, key: "refunds" | "refundStatus", status: string): never {
  const [basePath, rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set(key, status);
  redirect(`${basePath}?${params.toString()}`);
}

async function recordRefundEvent({
  actorUserId,
  eventType,
  message,
  newValue,
  orderId,
  previousValue,
  source,
  storeId,
  supabase,
  workspaceId
}: {
  actorUserId?: string | null;
  eventType: "refund_request_created" | "refund_status_changed";
  message: string;
  newValue?: string | null;
  orderId: string;
  previousValue?: string | null;
  source: OrderSource;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const { error } = await supabase.from("order_events" as never).insert({
    actor_user_id: actorUserId ?? null,
    event_type: eventType,
    message,
    metadata: {},
    new_value: newValue ?? null,
    order_id: orderId,
    order_source: source,
    previous_value: previousValue ?? null,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[refunds] order event skipped", {
      code: error.code,
      eventType,
      message: error.message,
      orderId,
      source
    });
  }
}

async function loadVerifiedOrderForCustomer({
  orderId,
  phone,
  source
}: {
  orderId: string;
  phone: string;
  source: OrderSource;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const tableName = source === "orders" ? "orders" : "store_orders";
  const { data, error } = await admin
    .from(tableName as never)
    .select("id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, total_amount")
    .eq("id" as never, orderId as never)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    id: string;
    store_id?: string | null;
    store_instance_id?: string | null;
    total?: number | string | null;
    total_amount?: number | string | null;
    workspace_id?: string | null;
  };

  if (normalizePhone(row.customer_phone) !== normalizePhone(phone)) {
    return null;
  }

  const storeId = row.store_id ?? row.store_instance_id ?? null;

  if (!storeId || !row.workspace_id) {
    return null;
  }

  const { data: link } = await admin
    .from("customer_order_links" as never)
    .select("customer_id")
    .eq("order_source" as never, source as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();
  const linkRow = link as { customer_id?: string | null } | null;

  return {
    admin,
    customer_email: row.customer_email ?? null,
    customer_id: linkRow?.customer_id ?? null,
    customer_name: row.customer_name ?? "Customer",
    customer_phone: row.customer_phone ?? phone,
    id: row.id,
    order_total: Number(row.total_amount ?? row.total ?? 0),
    store_id: storeId,
    workspace_id: row.workspace_id
  };
}

export async function requestOrderRefundAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const phone = cleanText(formData.get("phone"), 80);
  const source = cleanText(formData.get("source"), 40) as OrderSource;
  const reason = cleanText(formData.get("reason"), 240);
  const amountRequested = parseAmount(formData.get("amountRequested"));
  const notes = cleanText(formData.get("notes"), 1000);
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!orderId || !phone || !reason || amountRequested === null || amountRequested <= 0 || (source !== "orders" && source !== "store_orders")) {
    redirectWith(returnTo, "refunds", "invalid");
  }

  const order = await loadVerifiedOrderForCustomer({ orderId, phone, source });

  if (!order) {
    redirectWith(returnTo, "refunds", "not-authorized");
  }

  const { data: existing } = await order.admin
    .from("store_refund_requests" as never)
    .select("id")
    .eq("store_id" as never, order.store_id as never)
    .eq("order_source" as never, source as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();

  if (existing) {
    redirectWith(returnTo, "refunds", "duplicate");
  }

  const { error } = await order.admin.from("store_refund_requests" as never).insert({
    amount_requested: amountRequested,
    customer_email: order.customer_email,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    notes: notes || null,
    order_id: orderId,
    order_source: source,
    reason,
    status: "requested",
    store_id: order.store_id,
    workspace_id: order.workspace_id
  } as never);

  if (error) {
    console.error("[refunds] customer request failed", {
      code: error.code,
      message: error.message,
      orderId,
      source
    });
    redirectWith(returnTo, "refunds", "failed");
  }

  await recordRefundEvent({
    eventType: "refund_request_created",
    message: `Customer requested a manual refund for ${amountRequested.toFixed(2)}: ${reason}.`,
    newValue: "requested",
    orderId,
    source,
    storeId: order.store_id,
    supabase: order.admin,
    workspaceId: order.workspace_id
  });

  revalidatePath(returnTo);
  redirectWith(returnTo, "refunds", "requested");
}

export async function updateRefundRequestStatusAction(formData: FormData) {
  const requestId = cleanText(formData.get("requestId"), 80);
  const status = cleanText(formData.get("status"), 40) as RefundStatus;
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!requestId || !storeId || !refundStatuses.has(status)) {
    redirectWith(refundsPath, "refundStatus", "invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: refundsPath
  });
  const { data: request, error: lookupError } = await context.supabase
    .from("store_refund_requests" as never)
    .select("id, workspace_id, store_id, order_source, order_id, status")
    .eq("id" as never, requestId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (lookupError || !request) {
    redirectWith(`${refundsPath}?storeId=${encodeURIComponent(storeId)}`, "refundStatus", "not-authorized");
  }

  const row = request as unknown as {
    order_id: string;
    order_source: OrderSource;
    status: string;
    store_id: string;
    workspace_id: string;
  };

  const { error } = await context.supabase
    .from("store_refund_requests" as never)
    .update({ status } as never)
    .eq("id" as never, requestId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never);

  if (error) {
    console.error("[refunds] status update failed", {
      code: error.code,
      message: error.message,
      requestId,
      status
    });
    redirectWith(`${refundsPath}?storeId=${encodeURIComponent(storeId)}`, "refundStatus", "failed");
  }

  if (row.status !== status) {
    await recordRefundEvent({
      actorUserId: context.user.id,
      eventType: "refund_status_changed",
      message: `Refund request status changed from ${row.status} to ${status}.`,
      newValue: status,
      orderId: row.order_id,
      previousValue: row.status,
      source: row.order_source,
      storeId: row.store_id,
      supabase: context.supabase,
      workspaceId: row.workspace_id
    });
  }

  revalidatePath(refundsPath);
  revalidatePath(`/dashboard/orders/${row.order_id}`);
  redirectWith(`${refundsPath}?storeId=${encodeURIComponent(storeId)}`, "refundStatus", "updated");
}
