"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type OrderSource = "orders" | "store_orders";
type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "closed";

const returnsPath = "/dashboard/returns";
const returnStatuses = new Set<ReturnStatus>(["requested", "approved", "rejected", "received", "closed"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const candidate = cleanText(value, 500);
  return candidate.startsWith("/store/") || candidate.startsWith("/dashboard/returns") ? candidate : returnsPath;
}

function redirectWith(path: string, key: "returns" | "returnStatus", status: string): never {
  const [basePath, rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set(key, status);
  redirect(`${basePath}?${params.toString()}`);
}

async function recordReturnEvent({
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
  eventType: "return_request_created" | "return_status_changed";
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
    console.warn("[returns] order event skipped", {
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
    .select("id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email")
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
    workspace_id?: string | null;
  };

  if (normalizePhone(row.customer_phone) !== normalizePhone(phone)) {
    return null;
  }

  const storeId = row.store_id ?? row.store_instance_id ?? null;

  if (!storeId || !row.workspace_id) {
    return null;
  }

  return {
    admin,
    customer_email: row.customer_email ?? null,
    customer_name: row.customer_name ?? "Customer",
    customer_phone: row.customer_phone ?? phone,
    id: row.id,
    store_id: storeId,
    workspace_id: row.workspace_id
  };
}

export async function requestOrderReturnAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const phone = cleanText(formData.get("phone"), 80);
  const source = cleanText(formData.get("source"), 40) as OrderSource;
  const reason = cleanText(formData.get("reason"), 240);
  const notes = cleanText(formData.get("notes"), 1000);
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!orderId || !phone || !reason || (source !== "orders" && source !== "store_orders")) {
    redirectWith(returnTo, "returns", "invalid");
  }

  const order = await loadVerifiedOrderForCustomer({ orderId, phone, source });

  if (!order) {
    redirectWith(returnTo, "returns", "not-authorized");
  }

  const { data: existing } = await order.admin
    .from("store_return_requests" as never)
    .select("id")
    .eq("store_id" as never, order.store_id as never)
    .eq("order_source" as never, source as never)
    .eq("order_id" as never, orderId as never)
    .maybeSingle();

  if (existing) {
    redirectWith(returnTo, "returns", "duplicate");
  }

  const { error } = await order.admin.from("store_return_requests" as never).insert({
    customer_email: order.customer_email,
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
    console.error("[returns] customer request failed", {
      code: error.code,
      message: error.message,
      orderId,
      source
    });
    redirectWith(returnTo, "returns", "failed");
  }

  await recordReturnEvent({
    eventType: "return_request_created",
    message: `Customer requested a return: ${reason}.`,
    newValue: "requested",
    orderId,
    source,
    storeId: order.store_id,
    supabase: order.admin,
    workspaceId: order.workspace_id
  });

  revalidatePath(returnTo);
  redirectWith(returnTo, "returns", "requested");
}

export async function updateReturnRequestStatusAction(formData: FormData) {
  const requestId = cleanText(formData.get("requestId"), 80);
  const status = cleanText(formData.get("status"), 40) as ReturnStatus;
  const storeId = cleanText(formData.get("storeId"), 80);

  if (!requestId || !storeId || !returnStatuses.has(status)) {
    redirectWith(returnsPath, "returnStatus", "invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: returnsPath
  });
  const { data: request, error: lookupError } = await context.supabase
    .from("store_return_requests" as never)
    .select("id, workspace_id, store_id, order_source, order_id, status")
    .eq("id" as never, requestId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (lookupError || !request) {
    redirectWith(`${returnsPath}?storeId=${encodeURIComponent(storeId)}`, "returnStatus", "not-authorized");
  }

  const row = request as unknown as {
    order_id: string;
    order_source: OrderSource;
    status: string;
    store_id: string;
    workspace_id: string;
  };

  const { error } = await context.supabase
    .from("store_return_requests" as never)
    .update({ status } as never)
    .eq("id" as never, requestId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never);

  if (error) {
    console.error("[returns] status update failed", {
      code: error.code,
      message: error.message,
      requestId,
      status
    });
    redirectWith(`${returnsPath}?storeId=${encodeURIComponent(storeId)}`, "returnStatus", "failed");
  }

  if (row.status !== status) {
    await recordReturnEvent({
      actorUserId: context.user.id,
      eventType: "return_status_changed",
      message: `Return status changed from ${row.status} to ${status}.`,
      newValue: status,
      orderId: row.order_id,
      previousValue: row.status,
      source: row.order_source,
      storeId: row.store_id,
      supabase: context.supabase,
      workspaceId: row.workspace_id
    });
  }

  revalidatePath(returnsPath);
  revalidatePath(`/dashboard/orders/${row.order_id}`);
  redirectWith(`${returnsPath}?storeId=${encodeURIComponent(storeId)}`, "returnStatus", "updated");
}
