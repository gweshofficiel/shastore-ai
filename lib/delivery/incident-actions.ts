"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import type { DeliveryIncidentCategory, DeliveryIncidentPriority, DeliveryIncidentStatus } from "@/lib/delivery/incident-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const deliveryIncidentsPath = "/delivery/incidents";
const ownerDeliveryPath = "/dashboard/delivery-agents";

const incidentCategories = new Set<DeliveryIncidentCategory>([
  "late_delivery",
  "customer_complaint",
  "owner_complaint",
  "cod_dispute",
  "wrong_delivery",
  "missing_item",
  "proof_failure",
  "vehicle_problem",
  "policy_violation",
  "other"
]);
const incidentPriorities = new Set<DeliveryIncidentPriority>(["minor", "medium", "major", "critical"]);
const incidentStatuses = new Set<DeliveryIncidentStatus>([
  "open",
  "under_review",
  "resolved",
  "rejected",
  "escalated",
  "closed"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function deliveryRedirect(status: string): never {
  redirect(`${deliveryIncidentsPath}?delivery=${encodeURIComponent(status)}`);
}

function ownerRedirect(status: string, storeId?: string): never {
  const params = new URLSearchParams({ delivery: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${ownerDeliveryPath}?${params.toString()}`);
}

function incidentEventType(status: DeliveryIncidentStatus, isCreated = false) {
  if (isCreated) {
    return "incident_created";
  }

  if (status === "resolved" || status === "closed") {
    return "incident_resolved";
  }

  if (status === "escalated") {
    return "incident_escalated";
  }

  return "incident_updated";
}

async function recordIncidentEvent({
  actorUserId,
  agentId,
  incidentId,
  message,
  metadata = {},
  newStatus,
  previousStatus,
  storeId,
  workspaceId
}: {
  actorUserId: string | null;
  agentId: string;
  incidentId: string;
  message: string;
  metadata?: Record<string, unknown>;
  newStatus: DeliveryIncidentStatus;
  previousStatus?: DeliveryIncidentStatus | null;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await Promise.all([
    admin.from("delivery_incident_events" as never).insert({
      actor_user_id: actorUserId,
      delivery_agent_id: agentId,
      event_type: incidentEventType(newStatus, !previousStatus),
      incident_id: incidentId,
      message,
      metadata,
      new_status: newStatus,
      previous_status: previousStatus ?? null,
      store_id: storeId,
      workspace_id: workspaceId
    } as never),
    admin.from("monitoring_events" as never).insert({
      entity_id: incidentId,
      entity_type: "delivery_incident",
      event_status: newStatus === "escalated" ? "warning" : "info",
      event_type: incidentEventType(newStatus, !previousStatus),
      metadata: {
        ...metadata,
        delivery_agent_id: agentId,
        new_status: newStatus,
        previous_status: previousStatus ?? null,
        source: "delivery_incidents"
      },
      store_id: storeId,
      user_id: actorUserId,
      workspace_id: workspaceId
    } as never)
  ]);
}

export async function createDeliveryIncidentAction(formData: FormData) {
  const category = cleanText(formData.get("category"), 60) as DeliveryIncidentCategory;
  const priority = cleanText(formData.get("priority"), 40) as DeliveryIncidentPriority;
  const orderId = cleanText(formData.get("orderId"), 80);
  const orderSource = cleanText(formData.get("orderSource"), 40);
  const description = cleanText(formData.get("description"), 1500);

  if (!incidentCategories.has(category) || !incidentPriorities.has(priority) || !description) {
    deliveryRedirect("incident-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryRedirect("unavailable");
  }

  const normalizedOrderSource = orderSource === "orders" || orderSource === "store_orders" ? orderSource : null;
  const { data, error } = await admin
    .from("delivery_incidents" as never)
    .insert({
      category,
      delivery_agent_id: agent.agentId,
      description,
      order_id: orderId || null,
      order_source: normalizedOrderSource,
      priority,
      reported_by: user.id,
      reported_by_type: "delivery",
      status: "open",
      store_id: agent.storeId,
      workspace_id: agent.workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    deliveryRedirect("incident-failed");
  }

  const incidentId = (data as { id: string }).id;
  await recordIncidentEvent({
    actorUserId: user.id,
    agentId: agent.agentId,
    incidentId,
    message: "Delivery incident created by delivery agent.",
    metadata: {
      category,
      priority
    },
    newStatus: "open",
    storeId: agent.storeId,
    workspaceId: agent.workspaceId
  });

  revalidatePath(deliveryIncidentsPath);
  revalidatePath("/delivery/compliance");
  revalidatePath(ownerDeliveryPath);
  deliveryRedirect("incident-created");
}

export async function updateDeliveryIncidentStatusAction(formData: FormData) {
  const incidentId = cleanText(formData.get("incidentId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = cleanText(formData.get("status"), 40) as DeliveryIncidentStatus;

  if (!incidentId || !storeId || !incidentStatuses.has(status)) {
    ownerRedirect("incident-invalid", storeId);
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: ownerDeliveryPath
  });
  const { data: existing } = await context.supabase
    .from("delivery_incidents" as never)
    .select("id, delivery_agent_id, status")
    .eq("id" as never, incidentId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (!existing) {
    ownerRedirect("incident-access-denied", storeId);
  }

  const incident = existing as unknown as {
    delivery_agent_id: string;
    id: string;
    status: DeliveryIncidentStatus;
  };
  const { error } = await context.supabase
    .from("delivery_incidents" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, incidentId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never);

  if (error) {
    ownerRedirect("incident-failed", storeId);
  }

  await recordIncidentEvent({
    actorUserId: context.user.id,
    agentId: incident.delivery_agent_id,
    incidentId,
    message: `Delivery incident status changed to ${status.replaceAll("_", " ")}.`,
    metadata: {
      source: "owner_incident_review"
    },
    newStatus: status,
    previousStatus: incident.status,
    storeId,
    workspaceId: context.workspaceId
  });

  revalidatePath(ownerDeliveryPath);
  revalidatePath(deliveryIncidentsPath);
  revalidatePath("/delivery/compliance");
  ownerRedirect("incident-updated", storeId);
}
