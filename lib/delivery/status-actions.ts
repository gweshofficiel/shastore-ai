"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import type { DeliveryAssignmentStatus } from "@/lib/delivery/data";
import { createAdminClient } from "@/lib/supabase/admin";

const assignedOrdersPath = "/delivery/dashboard/orders";
const deliveryStatuses = new Set<DeliveryAssignmentStatus>([
  "assigned",
  "accepted",
  "picked_up",
  "delivered",
  "returned"
]);

const allowedTransitions: Record<DeliveryAssignmentStatus, DeliveryAssignmentStatus[]> = {
  accepted: ["picked_up"],
  assigned: ["accepted"],
  delivered: [],
  picked_up: ["delivered", "returned"],
  returned: []
};

type AssignmentRow = {
  delivery_agent_id: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  status: DeliveryAssignmentStatus;
  store_id: string;
  workspace_id: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStatus(value: FormDataEntryValue | null): DeliveryAssignmentStatus | null {
  const status = cleanText(value, 40) as DeliveryAssignmentStatus;
  return deliveryStatuses.has(status) ? status : null;
}

function statusLabel(status: DeliveryAssignmentStatus) {
  const labels: Record<DeliveryAssignmentStatus, string> = {
    accepted: "accepted",
    assigned: "assigned",
    delivered: "delivered",
    picked_up: "picked up",
    returned: "returned"
  };

  return labels[status];
}

function legacyOrderStatusForAssignment(status: DeliveryAssignmentStatus) {
  if (status === "picked_up") {
    return "picked_up";
  }

  if (status === "delivered") {
    return "delivered";
  }

  if (status === "returned") {
    return "failed";
  }

  return null;
}

function legacyTimestampForAssignment(status: DeliveryAssignmentStatus) {
  if (status === "picked_up") {
    return "delivery_picked_up_at";
  }

  if (status === "delivered") {
    return "delivery_delivered_at";
  }

  if (status === "returned") {
    return "delivery_failed_at";
  }

  return null;
}

function deliveryStatusRedirect(status: string): never {
  redirect(`${assignedOrdersPath}?delivery=${encodeURIComponent(status)}`);
}

async function recordDeliveryStatusEvent({
  actorUserId,
  assignment,
  newStatus,
  oldStatus
}: {
  actorUserId: string;
  assignment: AssignmentRow;
  newStatus: DeliveryAssignmentStatus;
  oldStatus: DeliveryAssignmentStatus;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("store_delivery_events" as never).insert({
    actor_user_id: actorUserId,
    delivery_agent_id: assignment.delivery_agent_id,
    event_type: "delivery_status_changed",
    message: `Delivery ${statusLabel(newStatus)} order.`,
    metadata: {
      agentId: assignment.delivery_agent_id,
      source: "delivery_dashboard",
      timestamp: new Date().toISOString()
    },
    new_value: newStatus,
    order_id: assignment.order_id,
    order_source: assignment.order_source,
    previous_value: oldStatus,
    store_id: assignment.store_id,
    workspace_id: assignment.workspace_id
  } as never);

  if (error) {
    console.warn("[delivery-status] timeline event skipped", {
      assignmentId: assignment.id,
      message: error.message,
      newStatus,
      oldStatus
    });
  }
}

async function syncLegacyOrderDeliveryStatus({
  assignment,
  newStatus,
  timestamp
}: {
  assignment: AssignmentRow;
  newStatus: DeliveryAssignmentStatus;
  timestamp: string;
}) {
  const legacyStatus = legacyOrderStatusForAssignment(newStatus);
  const timestampColumn = legacyTimestampForAssignment(newStatus);

  if (!legacyStatus || !timestampColumn) {
    return;
  }

  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin
    .from(assignment.order_source as never)
    .update({
      delivery_status: legacyStatus,
      [timestampColumn]: timestamp,
      updated_at: timestamp
    } as never)
    .eq("id" as never, assignment.order_id as never)
    .eq("workspace_id" as never, assignment.workspace_id as never);

  if (error) {
    console.warn("[delivery-status] legacy order status sync skipped", {
      assignmentId: assignment.id,
      message: error.message,
      newStatus
    });
  }
}

export async function updateDeliveryAssignmentStatusAction(formData: FormData) {
  const assignmentId = cleanText(formData.get("assignmentId"), 80);
  const newStatus = normalizeStatus(formData.get("status"));

  if (!assignmentId || !newStatus) {
    deliveryStatusRedirect("invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryStatusRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryStatusRedirect("unavailable");
  }

  const { data, error } = await admin
    .from("delivery_assignments" as never)
    .select("id, workspace_id, store_id, order_source, order_id, delivery_agent_id, status, metadata")
    .eq("id" as never, assignmentId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .maybeSingle();

  if (error || !data) {
    deliveryStatusRedirect("not-found");
  }

  const assignment = data as unknown as AssignmentRow;
  const oldStatus = assignment.status;
  const allowedNextStatuses = allowedTransitions[oldStatus] ?? [];

  if (!allowedNextStatuses.includes(newStatus)) {
    deliveryStatusRedirect("invalid-transition");
  }

  const timestamp = new Date().toISOString();
  const metadata = assignment.metadata ?? {};
  const statusHistory = Array.isArray(metadata.status_history) ? metadata.status_history : [];
  const { error: updateError } = await admin
    .from("delivery_assignments" as never)
    .update({
      metadata: {
        ...metadata,
        last_status_change: {
          agent_id: agent.agentId,
          changed_at: timestamp,
          new_status: newStatus,
          old_status: oldStatus
        },
        status_history: [
          ...statusHistory,
          {
            agent_id: agent.agentId,
            changed_at: timestamp,
            new_status: newStatus,
            old_status: oldStatus
          }
        ]
      },
      status: newStatus,
      updated_at: timestamp
    } as never)
    .eq("id" as never, assignment.id as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never);

  if (updateError) {
    console.warn("[delivery-status] assignment update failed", {
      assignmentId,
      message: updateError.message,
      newStatus,
      oldStatus
    });
    deliveryStatusRedirect("failed");
  }

  await Promise.all([
    recordDeliveryStatusEvent({
      actorUserId: user.id,
      assignment,
      newStatus,
      oldStatus
    }),
    syncLegacyOrderDeliveryStatus({
      assignment,
      newStatus,
      timestamp
    })
  ]);

  revalidatePath(assignedOrdersPath);
  revalidatePath("/delivery/dashboard");
  revalidatePath(`/dashboard/orders/${assignment.order_id}`);
  deliveryStatusRedirect("updated");
}
