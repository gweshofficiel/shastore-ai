"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type OrderSource = "orders" | "store_orders";
type DeliveryStatus = "assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed";

const deliveryAgentsPath = "/dashboard/delivery-agents";
const deliveryStatuses = new Set<DeliveryStatus>([
  "assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "failed"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeEmail(value: FormDataEntryValue | null) {
  const text = cleanText(value, 240).toLowerCase();
  return text.includes("@") ? text : "";
}

function normalizePhone(value: FormDataEntryValue | null) {
  return cleanText(value, 80).replace(/[^0-9+]/g, "");
}

function safeOrderReturnPath(value: FormDataEntryValue | null) {
  const candidate = cleanText(value, 300);
  return candidate.startsWith("/dashboard/orders/") ? candidate : "/dashboard/orders";
}

function deliveryAgentsRedirect(status: string, storeId?: string): never {
  const params = new URLSearchParams({ delivery: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${deliveryAgentsPath}?${params.toString()}`);
}

function orderDeliveryRedirect(returnTo: string, status: string): never {
  const [path, rawQuery = ""] = returnTo.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("orders", status);
  redirect(`${path}?${params.toString()}`);
}

async function ensureStoreAccess(storeId: string) {
  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: deliveryAgentsPath
  });
  const { data: store } = await context.supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (!store) {
    return null;
  }

  return context;
}

async function loadOrderForDelivery({
  orderId,
  source,
  workspaceId,
  supabase
}: {
  orderId: string;
  source: OrderSource;
  workspaceId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
}) {
  const tableName = source === "orders" ? "orders" : "store_orders";
  const { data, error } = await supabase
    .from(tableName as never)
    .select("id, store_id, store_instance_id, workspace_id, delivery_agent_id, delivery_status")
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    delivery_agent_id?: string | null;
    delivery_status?: string | null;
    id: string;
    store_id?: string | null;
    store_instance_id?: string | null;
    workspace_id?: string | null;
  };

  return {
    delivery_agent_id: row.delivery_agent_id ?? null,
    delivery_status: row.delivery_status ?? null,
    id: row.id,
    store_id: row.store_id ?? row.store_instance_id ?? null,
    tableName,
    workspace_id: row.workspace_id ?? workspaceId
  };
}

async function recordDeliveryEvent({
  actorUserId,
  agentId,
  eventType,
  message,
  metadata,
  newValue,
  orderId,
  previousValue,
  source,
  storeId,
  supabase,
  workspaceId
}: {
  actorUserId: string;
  agentId?: string | null;
  eventType: "delivery_assigned" | "delivery_agent_changed" | "delivery_status_changed";
  message: string;
  metadata?: Record<string, unknown>;
  newValue?: string | null;
  orderId: string;
  previousValue?: string | null;
  source: OrderSource;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const { error } = await supabase.from("store_delivery_events" as never).insert({
    actor_user_id: actorUserId,
    delivery_agent_id: agentId ?? null,
    event_type: eventType,
    message,
    metadata: metadata ?? {},
    new_value: newValue ?? null,
    order_id: orderId,
    order_source: source,
    previous_value: previousValue ?? null,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[delivery] timeline event skipped", {
      code: error.code,
      eventType,
      message: error.message,
      orderId,
      source
    });
  }
}

export async function createDeliveryAgentAction(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const name = cleanText(formData.get("name"), 160);
  const phone = cleanText(formData.get("phone"), 80);
  const normalizedPhone = normalizePhone(formData.get("phone"));
  const email = normalizeEmail(formData.get("email"));
  const cityZone = cleanText(formData.get("cityZone"), 160);
  const status = cleanText(formData.get("status"), 40) === "inactive" ? "inactive" : "active";

  if (!storeId || !name || !phone || !normalizedPhone || !cityZone) {
    deliveryAgentsRedirect("invalid", storeId);
  }

  const context = await ensureStoreAccess(storeId);

  if (!context) {
    deliveryAgentsRedirect("access-denied", storeId);
  }

  const { error } = await context.supabase.from("store_delivery_agents" as never).insert({
    city_zone: cityZone,
    email: email || null,
    name,
    normalized_email: email || null,
    normalized_phone: normalizedPhone,
    phone,
    status,
    store_id: storeId,
    workspace_id: context.workspaceId
  } as never);

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      deliveryAgentsRedirect("duplicate", storeId);
    }

    console.error("[delivery] create agent failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    deliveryAgentsRedirect("create-failed", storeId);
  }

  revalidatePath(deliveryAgentsPath);
  deliveryAgentsRedirect("created", storeId);
}

export async function assignOrderDeliveryAgentAction(formData: FormData) {
  const agentId = cleanText(formData.get("deliveryAgentId"), 80);
  const orderId = cleanText(formData.get("orderId"), 80);
  const source = cleanText(formData.get("source"), 40) as OrderSource;
  const returnTo = safeOrderReturnPath(formData.get("returnTo"));

  if (!orderId || (source !== "orders" && source !== "store_orders")) {
    orderDeliveryRedirect(returnTo, "delivery-invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: returnTo
  });
  const order = await loadOrderForDelivery({
    orderId,
    source,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  if (!order?.store_id) {
    orderDeliveryRedirect(returnTo, "delivery-not-authorized");
  }

  let agent: { city_zone?: string | null; id: string; name: string; phone: string; status: string } | null = null;

  if (agentId) {
    const { data, error } = await context.supabase
      .from("store_delivery_agents" as never)
      .select("id, name, phone, city_zone, status")
      .eq("id" as never, agentId as never)
      .eq("workspace_id" as never, context.workspaceId as never)
      .eq("store_id" as never, order.store_id as never)
      .maybeSingle();

    if (error || !data) {
      orderDeliveryRedirect(returnTo, "delivery-agent-invalid");
    }

    agent = data as unknown as { city_zone?: string | null; id: string; name: string; phone: string; status: string };

    if (agent.status !== "active") {
      orderDeliveryRedirect(returnTo, "delivery-agent-inactive");
    }
  }

  const now = new Date().toISOString();
  const updatePayload = agent
    ? {
        delivery_agent_id: agent.id,
        delivery_assigned_at: now,
        delivery_status: "assigned",
        updated_at: now
      }
    : {
        delivery_agent_id: null,
        delivery_status: null,
        updated_at: now
      };
  const { error: updateError } = await context.supabase
    .from(order.tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (updateError) {
    console.error("[delivery] assign order failed", {
      code: updateError.code,
      message: updateError.message,
      orderId,
      source
    });
    orderDeliveryRedirect(returnTo, "delivery-failed");
  }

  await recordDeliveryEvent({
    actorUserId: context.user.id,
    agentId: agent?.id ?? null,
    eventType: order.delivery_agent_id ? "delivery_agent_changed" : "delivery_assigned",
    message: agent ? `Delivery agent assigned to ${agent.name}.` : "Delivery agent assignment cleared.",
    metadata: agent ? { agentName: agent.name, agentPhone: agent.phone, cityZone: agent.city_zone } : {},
    newValue: agent?.id ?? null,
    orderId,
    previousValue: order.delivery_agent_id,
    source,
    storeId: order.store_id,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(returnTo);
  orderDeliveryRedirect(returnTo, "delivery-updated");
}

export async function updateOrderDeliveryStatusAction(formData: FormData) {
  const orderId = cleanText(formData.get("orderId"), 80);
  const source = cleanText(formData.get("source"), 40) as OrderSource;
  const status = cleanText(formData.get("deliveryStatus"), 60) as DeliveryStatus;
  const returnTo = safeOrderReturnPath(formData.get("returnTo"));

  if (!orderId || (source !== "orders" && source !== "store_orders") || !deliveryStatuses.has(status)) {
    orderDeliveryRedirect(returnTo, "delivery-invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: returnTo
  });
  const order = await loadOrderForDelivery({
    orderId,
    source,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  if (!order?.store_id) {
    orderDeliveryRedirect(returnTo, "delivery-not-authorized");
  }

  if (!order.delivery_agent_id) {
    orderDeliveryRedirect(returnTo, "delivery-agent-required");
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, string> = {
    delivery_status: status,
    updated_at: now
  };

  if (status === "assigned") {
    updatePayload.delivery_assigned_at = now;
  }

  if (status === "picked_up") {
    updatePayload.delivery_picked_up_at = now;
  }

  if (status === "out_for_delivery") {
    updatePayload.delivery_out_for_delivery_at = now;
  }

  if (status === "delivered") {
    updatePayload.delivery_delivered_at = now;
  }

  if (status === "failed") {
    updatePayload.delivery_failed_at = now;
  }

  const { error } = await context.supabase
    .from(order.tableName as never)
    .update(updatePayload as never)
    .eq("id" as never, orderId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    console.error("[delivery] status update failed", {
      code: error.code,
      message: error.message,
      orderId,
      source,
      status
    });
    orderDeliveryRedirect(returnTo, "delivery-failed");
  }

  await recordDeliveryEvent({
    actorUserId: context.user.id,
    agentId: order.delivery_agent_id,
    eventType: "delivery_status_changed",
    message: `Delivery status changed from ${order.delivery_status ?? "unassigned"} to ${status}.`,
    newValue: status,
    orderId,
    previousValue: order.delivery_status,
    source,
    storeId: order.store_id,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(returnTo);
  orderDeliveryRedirect(returnTo, "delivery-updated");
}
