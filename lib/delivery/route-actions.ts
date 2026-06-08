"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const ownerDeliveryPath = "/dashboard/delivery-agents";
const deliveryDashboardPath = "/delivery/dashboard";

type AvailabilityStatus = "online" | "offline" | "busy";

const availabilityStatuses = new Set<AvailabilityStatus>(["online", "offline", "busy"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanCapacity(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(cleanText(value, 20), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 500) : null;
}

function cleanZoneIds(formData: FormData) {
  return formData
    .getAll("assignedZoneIds")
    .map((value) => cleanText(value, 80))
    .filter(Boolean);
}

function normalizeAvailability(value: FormDataEntryValue | null): AvailabilityStatus | null {
  const status = cleanText(value, 40) as AvailabilityStatus;
  return availabilityStatuses.has(status) ? status : null;
}

function ownerDeliveryRedirect(status: string, storeId?: string): never {
  const params = new URLSearchParams({ delivery: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${ownerDeliveryPath}?${params.toString()}`);
}

function deliveryAvailabilityRedirect(status: string): never {
  redirect(`${deliveryDashboardPath}?delivery=${encodeURIComponent(status)}`);
}

async function ensureStoreAccess(storeId: string) {
  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: ownerDeliveryPath
  });
  const { data: store } = await context.supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  return store ? context : null;
}

async function recordRouteAudit({
  action,
  entityId,
  metadata,
  storeId,
  userId,
  workspaceId
}: {
  action: string;
  entityId: string;
  metadata: Record<string, unknown>;
  storeId: string;
  userId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: entityId,
    entity_type: "delivery_route_capacity",
    event_status: "info",
    event_type: action,
    metadata: {
      ...metadata,
      source: "delivery_route_capacity"
    },
    store_id: storeId,
    user_id: userId,
    workspace_id: workspaceId
  } as never);
}

export async function createDeliveryZoneAction(formData: FormData) {
  const storeId = cleanText(formData.get("storeId"), 80);
  const name = cleanText(formData.get("name"), 160);
  const city = cleanText(formData.get("city"), 120);
  const region = cleanText(formData.get("region"), 120);
  const isActive = cleanText(formData.get("isActive"), 20) !== "false";

  if (!storeId || !name) {
    ownerDeliveryRedirect("zone-invalid", storeId);
  }

  const context = await ensureStoreAccess(storeId);

  if (!context) {
    ownerDeliveryRedirect("access-denied", storeId);
  }

  const { data, error } = await context.supabase
    .from("delivery_zones" as never)
    .insert({
      city: city || null,
      is_active: isActive,
      name,
      region: region || null,
      store_id: storeId,
      workspace_id: context.workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505" || error?.message.toLowerCase().includes("duplicate")) {
      ownerDeliveryRedirect("zone-duplicate", storeId);
    }

    ownerDeliveryRedirect("zone-failed", storeId);
  }

  const zoneId = (data as { id: string }).id;
  await recordRouteAudit({
    action: "delivery_zone_created",
    entityId: zoneId,
    metadata: {
      city,
      is_active: isActive,
      name,
      region
    },
    storeId,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  revalidatePath(ownerDeliveryPath);
  ownerDeliveryRedirect("zone-created", storeId);
}

export async function updateDeliveryAgentCapacityAction(formData: FormData) {
  const agentId = cleanText(formData.get("agentId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const capacityLimit = cleanCapacity(formData.get("capacityLimit"));
  const availabilityStatus = normalizeAvailability(formData.get("availabilityStatus"));
  const assignedZoneIds = cleanZoneIds(formData);

  if (!agentId || !storeId || capacityLimit === null || !availabilityStatus) {
    ownerDeliveryRedirect("capacity-invalid", storeId);
  }

  const context = await ensureStoreAccess(storeId);

  if (!context) {
    ownerDeliveryRedirect("access-denied", storeId);
  }

  const { data: zones } = assignedZoneIds.length
    ? await context.supabase
        .from("delivery_zones" as never)
        .select("id")
        .eq("workspace_id" as never, context.workspaceId as never)
        .eq("store_id" as never, storeId as never)
        .in("id" as never, assignedZoneIds as never)
    : { data: [] };
  const safeZoneIds = new Set(((zones ?? []) as unknown as Array<{ id: string }>).map((zone) => zone.id));
  const scopedZoneIds = assignedZoneIds.filter((id) => safeZoneIds.has(id));

  if (assignedZoneIds.length !== scopedZoneIds.length) {
    ownerDeliveryRedirect("zone-invalid", storeId);
  }

  const { count } = await context.supabase
    .from("delivery_assignments" as never)
    .select("id", { count: "exact", head: true } as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .in("status" as never, ["assigned", "accepted", "picked_up"] as never);
  const activeOrders = count ?? 0;
  const { error } = await context.supabase
    .from("store_delivery_agents" as never)
    .update({
      assigned_zone_ids: scopedZoneIds,
      availability_status: availabilityStatus,
      capacity_limit: capacityLimit,
      current_active_orders: activeOrders,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, agentId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never);

  if (error) {
    ownerDeliveryRedirect("capacity-failed", storeId);
  }

  await recordRouteAudit({
    action: "delivery_capacity_updated",
    entityId: agentId,
    metadata: {
      active_orders: activeOrders,
      assigned_zone_ids: scopedZoneIds,
      availability_status: availabilityStatus,
      capacity_limit: capacityLimit
    },
    storeId,
    userId: context.user.id,
    workspaceId: context.workspaceId
  });

  revalidatePath(ownerDeliveryPath);
  revalidatePath(deliveryDashboardPath);
  ownerDeliveryRedirect("capacity-updated", storeId);
}

export async function updateDeliveryAvailabilityAction(formData: FormData) {
  const availabilityStatus = normalizeAvailability(formData.get("availabilityStatus"));

  if (!availabilityStatus) {
    deliveryAvailabilityRedirect("availability-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryAvailabilityRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryAvailabilityRedirect("unavailable");
  }

  const { count } = await admin
    .from("delivery_assignments" as never)
    .select("id", { count: "exact", head: true } as never)
    .eq("workspace_id" as never, agent.workspaceId as never)
    .eq("store_id" as never, agent.storeId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .in("status" as never, ["assigned", "accepted", "picked_up"] as never);
  const activeOrders = count ?? 0;
  const { error } = await admin
    .from("store_delivery_agents" as never)
    .update({
      availability_status: availabilityStatus,
      current_active_orders: activeOrders,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never);

  if (error) {
    deliveryAvailabilityRedirect("availability-failed");
  }

  await recordRouteAudit({
    action: "delivery_availability_changed",
    entityId: agent.agentId,
    metadata: {
      active_orders: activeOrders,
      availability_status: availabilityStatus
    },
    storeId: agent.storeId,
    userId: user.id,
    workspaceId: agent.workspaceId
  });

  revalidatePath(deliveryDashboardPath);
  revalidatePath(ownerDeliveryPath);
  deliveryAvailabilityRedirect("availability-updated");
}
