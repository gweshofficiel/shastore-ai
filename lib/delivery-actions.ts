"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDeliveryNotification, createDeliverySystemMessage } from "@/lib/delivery/communication-data";
import { findAuthUserIdByEmail, linkDeliveryAgentToAuthUser } from "@/lib/delivery/data";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type OrderSource = "orders" | "store_orders";
type DeliveryStatus = "assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed";
type AssignmentStatus = "assigned" | "accepted" | "picked_up" | "delivered" | "returned";

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

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function orderReference(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function cityFromAddress(address: string | null | undefined) {
  if (!address) {
    return null;
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-2) ?? parts.at(-1) ?? null;
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
    .select(
      "id, store_id, store_instance_id, workspace_id, delivery_agent_id, delivery_status, customer_name, customer_phone, customer_address, total, total_amount"
    )
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
    customer_address?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    store_id?: string | null;
    store_instance_id?: string | null;
    total?: number | string | null;
    total_amount?: number | string | null;
    workspace_id?: string | null;
  };

  return {
    customer_address: row.customer_address ?? null,
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    delivery_agent_id: row.delivery_agent_id ?? null,
    delivery_status: row.delivery_status ?? null,
    id: row.id,
    store_id: row.store_id ?? row.store_instance_id ?? null,
    tableName,
    total: row.total_amount ?? row.total ?? 0,
    workspace_id: row.workspace_id ?? workspaceId
  };
}

async function upsertDeliveryAssignment({
  actorUserId,
  agent,
  assignmentStatus = "assigned",
  order,
  orderId,
  source,
  supabase,
  workspaceId
}: {
  actorUserId: string;
  agent: { id: string; name: string } | null;
  assignmentStatus?: AssignmentStatus;
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForDelivery>>>;
  orderId: string;
  source: OrderSource;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  if (!agent) {
    const { error } = await supabase
      .from("delivery_assignments" as never)
      .delete()
      .eq("order_id" as never, orderId as never)
      .eq("order_source" as never, source as never)
      .eq("workspace_id" as never, workspaceId as never);

    if (error) {
      console.warn("[delivery-assignments] assignment clear skipped", {
        code: error.code,
        message: error.message,
        orderId,
        source
      });
    }

    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("delivery_assignments" as never).upsert(
    {
      assigned_at: now,
      assigned_by: actorUserId,
      currency: "USD",
      customer_city: cityFromAddress(order.customer_address),
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_agent_id: agent.id,
      metadata: {
        source: "owner_order_detail",
        sourceOrderTable: order.tableName
      },
      notes: `Assigned to ${agent.name} from owner order detail.`,
      order_amount: numericValue(order.total),
      order_id: orderId,
      order_number: orderReference(orderId),
      order_source: source,
      status: assignmentStatus,
      store_id: order.store_id,
      updated_at: now,
      workspace_id: workspaceId
    } as never,
    { onConflict: "order_source,order_id" } as never
  );

  if (error) {
    console.warn("[delivery-assignments] assignment write skipped", {
      code: error.code,
      message: error.message,
      orderId,
      source
    });
  }
}

async function activeDeliveryOrderCount({
  agentId,
  excludeOrderId,
  storeId,
  supabase,
  workspaceId
}: {
  agentId: string;
  excludeOrderId?: string | null;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  let query = supabase
    .from("delivery_assignments" as never)
    .select("id", { count: "exact", head: true } as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .in("status" as never, ["assigned", "accepted", "picked_up"] as never);

  if (excludeOrderId) {
    query = query.neq("order_id" as never, excludeOrderId as never);
  }

  const { count } = await query;
  return count ?? 0;
}

async function syncAgentActiveOrderSnapshot({
  agentId,
  storeId,
  supabase,
  workspaceId
}: {
  agentId: string | null | undefined;
  storeId: string;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  if (!agentId) {
    return;
  }

  const activeOrders = await activeDeliveryOrderCount({
    agentId,
    storeId,
    supabase,
    workspaceId
  });

  await supabase
    .from("store_delivery_agents" as never)
    .update({
      current_active_orders: activeOrders,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, agentId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never);
}

function assignmentStatusFromDeliveryStatus(status: DeliveryStatus): AssignmentStatus {
  if (status === "picked_up") {
    return "picked_up";
  }

  if (status === "delivered") {
    return "delivered";
  }

  if (status === "failed") {
    return "returned";
  }

  if (status === "out_for_delivery") {
    return "accepted";
  }

  return "assigned";
}

async function updateDeliveryAssignmentStatus({
  orderId,
  source,
  status,
  supabase,
  workspaceId
}: {
  orderId: string;
  source: OrderSource;
  status: AssignmentStatus;
  supabase: Awaited<ReturnType<typeof getWorkspaceDataContext>>["supabase"];
  workspaceId: string;
}) {
  const { error } = await supabase
    .from("delivery_assignments" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("order_id" as never, orderId as never)
    .eq("order_source" as never, source as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (error) {
    console.warn("[delivery-assignments] assignment status sync skipped", {
      message: error.message,
      orderId,
      source,
      status
    });
  }
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

  const { data: createdAgent, error } = await context.supabase
    .from("store_delivery_agents" as never)
    .insert({
      city_zone: cityZone,
      email: email || null,
      name,
      normalized_email: email || null,
      normalized_phone: normalizedPhone,
      phone,
      status,
      store_id: storeId,
      workspace_id: context.workspaceId
    } as never)
    .select("id")
    .single();

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

  const agentId = (createdAgent as { id?: string } | null)?.id;

  if (agentId && email) {
    const authUserId = await findAuthUserIdByEmail(email);

    if (authUserId) {
      await linkDeliveryAgentToAuthUser({ agentId, userId: authUserId });
    }
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

  let agent: {
    availability_status?: string | null;
    capacity_limit?: number | string | null;
    city_zone?: string | null;
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null = null;

  if (agentId) {
    const { data, error } = await context.supabase
      .from("store_delivery_agents" as never)
      .select("id, name, phone, city_zone, status, availability_status, capacity_limit")
      .eq("id" as never, agentId as never)
      .eq("workspace_id" as never, context.workspaceId as never)
      .eq("store_id" as never, order.store_id as never)
      .maybeSingle();

    if (error || !data) {
      orderDeliveryRedirect(returnTo, "delivery-agent-invalid");
    }

    agent = data as unknown as {
      availability_status?: string | null;
      capacity_limit?: number | string | null;
      city_zone?: string | null;
      id: string;
      name: string;
      phone: string;
      status: string;
    };

    if (agent.status !== "active") {
      orderDeliveryRedirect(returnTo, "delivery-agent-inactive");
    }

    const activeOrders = await activeDeliveryOrderCount({
      agentId: agent.id,
      excludeOrderId: orderId,
      storeId: order.store_id,
      supabase: context.supabase,
      workspaceId: context.workspaceId
    });
    const capacityLimit = Math.max(0, Math.trunc(numericValue(agent.capacity_limit ?? 5)));

    if (activeOrders >= capacityLimit) {
      orderDeliveryRedirect(returnTo, "delivery-capacity-full");
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

  await upsertDeliveryAssignment({
    actorUserId: context.user.id,
    agent,
    order,
    orderId,
    source,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  await Promise.all([
    syncAgentActiveOrderSnapshot({
      agentId: agent?.id,
      storeId: order.store_id,
      supabase: context.supabase,
      workspaceId: context.workspaceId
    }),
    syncAgentActiveOrderSnapshot({
      agentId: order.delivery_agent_id,
      storeId: order.store_id,
      supabase: context.supabase,
      workspaceId: context.workspaceId
    })
  ]);

  await recordDeliveryEvent({
    actorUserId: context.user.id,
    agentId: agent?.id ?? null,
    eventType: order.delivery_agent_id ? "delivery_agent_changed" : "delivery_assigned",
    message: agent
      ? `Order ${orderReference(orderId)} assigned to delivery agent ${agent.name}.`
      : `Delivery assignment cleared for order ${orderReference(orderId)}.`,
    metadata: agent
      ? {
          agentName: agent.name,
          agentPhone: agent.phone,
          assignmentStatus: "assigned",
          cityZone: agent.city_zone,
          orderReference: orderReference(orderId)
        }
      : { orderReference: orderReference(orderId) },
    newValue: agent?.id ?? null,
    orderId,
    previousValue: order.delivery_agent_id,
    source,
    storeId: order.store_id,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

  if (agent) {
    await Promise.all([
      createDeliveryNotification({
        agentId: agent.id,
        category: order.delivery_agent_id ? "assignment_updated" : "new_assignment",
        message: `Order ${orderReference(orderId)} has been assigned to you.`,
        orderId,
        orderSource: source,
        storeId: order.store_id,
        title: order.delivery_agent_id ? "Assignment updated" : "New assignment",
        workspaceId: context.workspaceId,
        metadata: {
          assignedBy: context.user.id,
          source: "owner_order_assignment"
        }
      }),
      createDeliverySystemMessage({
        agentId: agent.id,
        message: `System notice: order ${orderReference(orderId)} is assigned to you.`,
        orderId,
        orderSource: source,
        storeId: order.store_id,
        workspaceId: context.workspaceId,
        metadata: {
          source: "owner_order_assignment"
        }
      })
    ]);
  }

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

  await updateDeliveryAssignmentStatus({
    orderId,
    source,
    status: assignmentStatusFromDeliveryStatus(status),
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });

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
