"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createDeliveryNotification } from "@/lib/delivery/communication-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const assignedOrdersPath = "/delivery/dashboard/orders";
const returnsPath = "/dashboard/returns";

type DeliveryReturnReason =
  | "customer_refused"
  | "customer_unreachable"
  | "wrong_address"
  | "reschedule_requested";

type DeliveryReturnStatus =
  | DeliveryReturnReason
  | "return_in_progress"
  | "returned_to_store"
  | "return_completed";

type AssignmentRow = {
  delivery_agent_id: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  status: string;
  store_id: string;
  workspace_id: string;
};

type DeliveryReturnRow = {
  assignment_id: string;
  delivery_agent_id: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  reason: DeliveryReturnReason;
  status: DeliveryReturnStatus;
  store_id: string;
  workspace_id: string;
};

const returnReasons = new Set<DeliveryReturnReason>([
  "customer_refused",
  "customer_unreachable",
  "wrong_address",
  "reschedule_requested"
]);

const ownerStatuses = new Set<DeliveryReturnStatus>([
  "reschedule_requested",
  "return_in_progress",
  "returned_to_store",
  "return_completed"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeReason(value: FormDataEntryValue | null): DeliveryReturnReason | null {
  const reason = cleanText(value, 80) as DeliveryReturnReason;
  return returnReasons.has(reason) ? reason : null;
}

function normalizeOwnerStatus(value: FormDataEntryValue | null): DeliveryReturnStatus | null {
  const status = cleanText(value, 80) as DeliveryReturnStatus;
  return ownerStatuses.has(status) ? status : null;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const text = cleanText(value, 80);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deliveryReturnRedirect(status: string): never {
  redirect(`${assignedOrdersPath}?delivery=${encodeURIComponent(status)}`);
}

function ownerReturnRedirect(status: string): never {
  redirect(`${returnsPath}?returnStatus=${encodeURIComponent(status)}`);
}

function reasonLabel(reason: DeliveryReturnReason) {
  const labels: Record<DeliveryReturnReason, string> = {
    customer_refused: "Customer refused",
    customer_unreachable: "Customer unreachable",
    reschedule_requested: "Reschedule requested",
    wrong_address: "Wrong address"
  };

  return labels[reason];
}

function eventTypeForReason(reason: DeliveryReturnReason) {
  if (reason === "customer_refused") {
    return "customer_refused";
  }

  if (reason === "wrong_address") {
    return "wrong_address";
  }

  if (reason === "reschedule_requested") {
    return "reschedule_requested";
  }

  return "delivery_failed";
}

function eventTypeForStatus(status: DeliveryReturnStatus) {
  if (status === "returned_to_store") {
    return "returned_to_store";
  }

  if (status === "return_completed") {
    return "return_completed";
  }

  if (status === "reschedule_requested") {
    return "reschedule_approved";
  }

  return "return_started";
}

async function recordReturnEvent({
  actorUserId,
  deliveryReturn,
  eventType,
  message,
  newValue,
  previousValue
}: {
  actorUserId: string;
  deliveryReturn: Pick<
    DeliveryReturnRow,
    "delivery_agent_id" | "id" | "order_id" | "order_source" | "store_id" | "workspace_id"
  >;
  eventType:
    | "delivery_failed"
    | "customer_refused"
    | "wrong_address"
    | "return_started"
    | "returned_to_store"
    | "return_completed"
    | "reschedule_requested"
    | "reschedule_approved";
  message: string;
  newValue: string;
  previousValue: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("store_delivery_events" as never).insert({
    actor_user_id: actorUserId,
    delivery_agent_id: deliveryReturn.delivery_agent_id,
    event_type: eventType,
    message,
    metadata: {
      returnId: deliveryReturn.id,
      source: "delivery_returns"
    },
    new_value: newValue,
    order_id: deliveryReturn.order_id,
    order_source: deliveryReturn.order_source,
    previous_value: previousValue,
    store_id: deliveryReturn.store_id,
    workspace_id: deliveryReturn.workspace_id
  } as never);

  if (error) {
    console.warn("[delivery-returns] timeline event skipped", {
      eventType,
      message: error.message,
      returnId: deliveryReturn.id
    });
  }
}

async function syncOrderFailed({
  assignment,
  reason,
  timestamp
}: {
  assignment: AssignmentRow;
  reason: DeliveryReturnReason;
  timestamp: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin
    .from(assignment.order_source as never)
    .update({
      delivery_failed_at: timestamp,
      delivery_notes: reasonLabel(reason),
      delivery_status: "failed",
      updated_at: timestamp
    } as never)
    .eq("id" as never, assignment.order_id as never)
    .eq("workspace_id" as never, assignment.workspace_id as never);

  if (error) {
    console.warn("[delivery-returns] legacy order failed sync skipped", {
      assignmentId: assignment.id,
      message: error.message
    });
  }
}

export async function reportFailedDeliveryAction(formData: FormData) {
  const assignmentId = cleanText(formData.get("assignmentId"), 80);
  const reason = normalizeReason(formData.get("reason"));
  const notes = cleanText(formData.get("notes"), 500);
  const requestedDate = parseOptionalDate(formData.get("requestedDeliveryDate"));

  if (!assignmentId || !reason) {
    deliveryReturnRedirect("return-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryReturnRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryReturnRedirect("unavailable");
  }

  const { data, error } = await admin
    .from("delivery_assignments" as never)
    .select("id, workspace_id, store_id, order_source, order_id, delivery_agent_id, status, metadata")
    .eq("id" as never, assignmentId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .maybeSingle();

  if (error || !data) {
    deliveryReturnRedirect("return-not-found");
  }

  const assignment = data as unknown as AssignmentRow;

  if (assignment.status === "delivered" || assignment.status === "returned") {
    deliveryReturnRedirect("return-status-invalid");
  }

  const timestamp = new Date().toISOString();
  const initialStatus: DeliveryReturnStatus =
    reason === "reschedule_requested" ? "reschedule_requested" : "return_in_progress";
  const { data: upserted, error: upsertError } = await admin
    .from("delivery_returns" as never)
    .upsert(
      {
        assignment_id: assignment.id,
        delivery_agent_id: assignment.delivery_agent_id,
        metadata: {
          history: [
            {
              agent_id: agent.agentId,
              reason,
              status: initialStatus,
              timestamp
            }
          ],
          source: "delivery_dashboard"
        },
        notes: notes || null,
        order_id: assignment.order_id,
        order_source: assignment.order_source,
        reason,
        requested_delivery_date_placeholder: requestedDate,
        status: initialStatus,
        store_id: assignment.store_id,
        updated_at: timestamp,
        workspace_id: assignment.workspace_id
      } as never,
      { onConflict: "assignment_id" } as never
    )
    .select("id, workspace_id, store_id, order_id, order_source, assignment_id, delivery_agent_id, reason, status, metadata")
    .single();

  if (upsertError || !upserted) {
    console.warn("[delivery-returns] report failed delivery failed", {
      assignmentId,
      message: upsertError?.message
    });
    deliveryReturnRedirect("return-failed");
  }

  const metadata = assignment.metadata ?? {};
  const statusHistory = Array.isArray(metadata.status_history) ? metadata.status_history : [];
  await admin
    .from("delivery_assignments" as never)
    .update({
      metadata: {
        ...metadata,
        last_status_change: {
          agent_id: agent.agentId,
          changed_at: timestamp,
          new_status: "returned",
          old_status: assignment.status,
          reason
        },
        status_history: [
          ...statusHistory,
          {
            agent_id: agent.agentId,
            changed_at: timestamp,
            new_status: "returned",
            old_status: assignment.status,
            reason
          }
        ]
      },
      status: "returned",
      updated_at: timestamp
    } as never)
    .eq("id" as never, assignment.id as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never);

  const deliveryReturn = upserted as unknown as DeliveryReturnRow;
  await Promise.all([
    recordReturnEvent({
      actorUserId: user.id,
      deliveryReturn,
      eventType: eventTypeForReason(reason),
      message: reason === "reschedule_requested" ? "Reschedule delivery requested." : `Delivery failed: ${reasonLabel(reason)}.`,
      newValue: initialStatus,
      previousValue: assignment.status
    }),
    reason === "reschedule_requested"
      ? Promise.resolve()
      : recordReturnEvent({
          actorUserId: user.id,
          deliveryReturn,
          eventType: "return_started",
          message: "Return started.",
          newValue: "return_in_progress",
          previousValue: assignment.status
        }),
    syncOrderFailed({
      assignment,
      reason,
      timestamp
    })
  ]);

  revalidatePath(assignedOrdersPath);
  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/orders/${assignment.order_id}`);
  deliveryReturnRedirect("return-reported");
}

export async function updateDeliveryReturnStatusAction(formData: FormData) {
  const returnId = cleanText(formData.get("returnId"), 80);
  const status = normalizeOwnerStatus(formData.get("status"));
  const approvedDate = parseOptionalDate(formData.get("approvedDeliveryDate"));

  if (!returnId || !status) {
    ownerReturnRedirect("invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: returnsPath
  });
  const { data, error } = await context.supabase
    .from("delivery_returns" as never)
    .select("id, workspace_id, store_id, order_id, order_source, assignment_id, delivery_agent_id, reason, status, metadata")
    .eq("id" as never, returnId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    ownerReturnRedirect("not-authorized");
  }

  const current = data as unknown as DeliveryReturnRow;
  const timestamp = new Date().toISOString();
  const metadata = current.metadata ?? {};
  const history = Array.isArray(metadata.history) ? metadata.history : [];
  const { error: updateError } = await context.supabase
    .from("delivery_returns" as never)
    .update({
      approved_delivery_date_placeholder: approvedDate,
      metadata: {
        ...metadata,
        history: [
          ...history,
          {
            actor_user_id: context.user.id,
            status,
            timestamp
          }
        ],
        last_status_change: {
          actor_user_id: context.user.id,
          new_status: status,
          old_status: current.status,
          timestamp
        }
      },
      status,
      updated_at: timestamp
    } as never)
    .eq("id" as never, current.id as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (updateError) {
    ownerReturnRedirect("failed");
  }

  await recordReturnEvent({
    actorUserId: context.user.id,
    deliveryReturn: current,
    eventType: eventTypeForStatus(status),
    message:
      status === "reschedule_requested"
        ? "Reschedule delivery approved."
        : status === "return_completed"
          ? "Return completed."
          : status === "returned_to_store"
            ? "Returned to store."
            : "Return status updated.",
    newValue: status,
    previousValue: current.status
  });

  await createDeliveryNotification({
    agentId: current.delivery_agent_id,
    category: status === "reschedule_requested" ? "return_approved" : "return_request",
    message:
      status === "reschedule_requested"
        ? "Your reschedule request was approved by the store owner."
        : `Return status updated to ${status.replaceAll("_", " ")}.`,
    orderId: current.order_id,
    orderSource: current.order_source,
    storeId: current.store_id,
    title: status === "reschedule_requested" ? "Reschedule approved" : "Return updated",
    workspaceId: current.workspace_id,
    metadata: {
      returnId: current.id,
      status
    }
  });

  revalidatePath(returnsPath);
  revalidatePath(`/dashboard/orders/${current.order_id}`);
  ownerReturnRedirect("updated");
}
