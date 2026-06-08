"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const assignedOrdersPath = "/delivery/dashboard/orders";
const codCenterPath = "/dashboard/cod";

type AssignmentRow = {
  currency?: string | null;
  delivery_agent_id: string;
  id: string;
  order_amount?: number | string | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  status: string;
  store_id: string;
  workspace_id: string;
};

type CodCollectionRow = {
  amount?: number | string | null;
  assignment_id: string;
  currency?: string | null;
  delivery_agent_id: string;
  id: string;
  order_id: string;
  order_source: "orders" | "store_orders";
  status: string;
  store_id: string;
  workspace_id: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanMoney(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(cleanText(value, 40));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

function deliveryCodRedirect(status: string): never {
  redirect(`${assignedOrdersPath}?delivery=${encodeURIComponent(status)}`);
}

function ownerCodRedirect(status: string): never {
  redirect(`${codCenterPath}?cod=${encodeURIComponent(status)}`);
}

async function recordCodEvent({
  actorUserId,
  collection,
  eventType,
  message,
  newValue,
  previousValue
}: {
  actorUserId: string;
  collection: CodCollectionRow;
  eventType: "cash_collected" | "cash_settled" | "cash_dispute_opened";
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
    delivery_agent_id: collection.delivery_agent_id,
    event_type: eventType,
    message,
    metadata: {
      amount: numericValue(collection.amount),
      collectionId: collection.id,
      currency: collection.currency ?? "USD",
      source: "cod_collection"
    },
    new_value: newValue,
    order_id: collection.order_id,
    order_source: collection.order_source,
    previous_value: previousValue,
    store_id: collection.store_id,
    workspace_id: collection.workspace_id
  } as never);

  if (error) {
    console.warn("[cod-collections] timeline event skipped", {
      collectionId: collection.id,
      eventType,
      message: error.message
    });
  }
}

export async function markCashCollectedAction(formData: FormData) {
  const assignmentId = cleanText(formData.get("assignmentId"), 80);
  const amountInput = cleanMoney(formData.get("amount"));
  const notes = cleanText(formData.get("notes"), 500);

  if (!assignmentId) {
    deliveryCodRedirect("cod-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryCodRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryCodRedirect("unavailable");
  }

  const { data, error } = await admin
    .from("delivery_assignments" as never)
    .select("id, workspace_id, store_id, order_source, order_id, delivery_agent_id, status, order_amount, currency")
    .eq("id" as never, assignmentId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .maybeSingle();

  if (error || !data) {
    deliveryCodRedirect("cod-not-found");
  }

  const assignment = data as unknown as AssignmentRow;

  if (assignment.status !== "delivered") {
    deliveryCodRedirect("cod-delivered-required");
  }

  const amount = amountInput ?? numericValue(assignment.order_amount);
  const collectedAt = new Date().toISOString();
  const { data: existingCollection } = await admin
    .from("cod_collections" as never)
    .select("id, status")
    .eq("assignment_id" as never, assignment.id as never)
    .maybeSingle();

  const previousStatus = (existingCollection as { status?: string } | null)?.status ?? "pending_collection";
  const { data: upserted, error: upsertError } = await admin
    .from("cod_collections" as never)
    .upsert(
      {
        amount,
        assignment_id: assignment.id,
        collected_at: collectedAt,
        currency: assignment.currency ?? "USD",
        delivery_agent_id: assignment.delivery_agent_id,
        metadata: {
          source: "delivery_dashboard"
        },
        notes: notes || null,
        order_id: assignment.order_id,
        order_source: assignment.order_source,
        status: "collected",
        store_id: assignment.store_id,
        updated_at: collectedAt,
        workspace_id: assignment.workspace_id
      } as never,
      { onConflict: "assignment_id" } as never
    )
    .select("id, workspace_id, store_id, order_id, order_source, assignment_id, delivery_agent_id, amount, currency, status")
    .single();

  if (upsertError || !upserted) {
    console.warn("[cod-collections] collection upsert failed", {
      assignmentId: assignment.id,
      message: upsertError?.message
    });
    deliveryCodRedirect("cod-failed");
  }

  await recordCodEvent({
    actorUserId: user.id,
    collection: upserted as unknown as CodCollectionRow,
    eventType: "cash_collected",
    message: "Cash collected by delivery agent.",
    newValue: "collected",
    previousValue: previousStatus
  });

  revalidatePath(assignedOrdersPath);
  revalidatePath("/delivery/dashboard");
  revalidatePath(codCenterPath);
  revalidatePath(`/dashboard/orders/${assignment.order_id}`);
  deliveryCodRedirect("cod-collected");
}

export async function settleCodCollectionAction(formData: FormData) {
  const collectionId = cleanText(formData.get("collectionId"), 80);

  if (!collectionId) {
    ownerCodRedirect("invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: codCenterPath
  });
  const { data, error } = await context.supabase
    .from("cod_collections" as never)
    .select("id, workspace_id, store_id, order_id, order_source, assignment_id, delivery_agent_id, amount, currency, status")
    .eq("id" as never, collectionId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    ownerCodRedirect("not-found");
  }

  const collection = data as unknown as CodCollectionRow;

  if (collection.status !== "collected") {
    ownerCodRedirect("not-collectable");
  }

  const settledAt = new Date().toISOString();
  const { error: updateError } = await context.supabase
    .from("cod_collections" as never)
    .update({
      settled_at: settledAt,
      status: "settled_to_store",
      updated_at: settledAt
    } as never)
    .eq("id" as never, collection.id as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (updateError) {
    ownerCodRedirect("failed");
  }

  await recordCodEvent({
    actorUserId: context.user.id,
    collection,
    eventType: "cash_settled",
    message: "Cash settled to store.",
    newValue: "settled_to_store",
    previousValue: collection.status
  });

  revalidatePath(codCenterPath);
  revalidatePath(`/dashboard/orders/${collection.order_id}`);
  ownerCodRedirect("settled");
}

export async function disputeCodCollectionAction(formData: FormData) {
  const collectionId = cleanText(formData.get("collectionId"), 80);

  if (!collectionId) {
    ownerCodRedirect("invalid");
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: codCenterPath
  });
  const { data, error } = await context.supabase
    .from("cod_collections" as never)
    .select("id, workspace_id, store_id, order_id, order_source, assignment_id, delivery_agent_id, amount, currency, status")
    .eq("id" as never, collectionId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .maybeSingle();

  if (error || !data) {
    ownerCodRedirect("not-found");
  }

  const collection = data as unknown as CodCollectionRow;
  const { error: updateError } = await context.supabase
    .from("cod_collections" as never)
    .update({
      status: "disputed",
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, collection.id as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (updateError) {
    ownerCodRedirect("failed");
  }

  await recordCodEvent({
    actorUserId: context.user.id,
    collection,
    eventType: "cash_dispute_opened",
    message: "Cash collection dispute opened.",
    newValue: "disputed",
    previousValue: collection.status
  });

  revalidatePath(codCenterPath);
  revalidatePath(`/dashboard/orders/${collection.order_id}`);
  ownerCodRedirect("disputed");
}
