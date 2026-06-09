"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeliveryAccess } from "@/lib/delivery/access";
import { createDeliveryNotification } from "@/lib/delivery/communication-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

const ownerDeliveryPath = "/dashboard/delivery-agents";
const deliveryNotificationsPath = "/delivery/notifications";
const deliveryMessagesPath = "/delivery/messages";

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function ownerRedirect(status: string, storeId?: string): never {
  const params = new URLSearchParams({ delivery: status });

  if (storeId) {
    params.set("storeId", storeId);
  }

  redirect(`${ownerDeliveryPath}?${params.toString()}`);
}

function deliveryNotificationRedirect(status: string): never {
  redirect(`${deliveryNotificationsPath}?delivery=${encodeURIComponent(status)}`);
}

function deliveryMessageRedirect(status: string): never {
  redirect(`${deliveryMessagesPath}?delivery=${encodeURIComponent(status)}`);
}

async function recordCommunicationAudit({
  action,
  agentId,
  entityId,
  metadata,
  storeId,
  userId,
  workspaceId
}: {
  action: string;
  agentId: string;
  entityId: string;
  metadata: Record<string, unknown>;
  storeId: string;
  userId: string | null;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: entityId,
    entity_type: "delivery_communication",
    event_status: "info",
    event_type: action,
    metadata: {
      ...metadata,
      delivery_agent_id: agentId,
      source: "delivery_communication"
    },
    store_id: storeId,
    user_id: userId,
    workspace_id: workspaceId
  } as never);
}

export async function sendOwnerDeliveryMessageAction(formData: FormData) {
  const agentId = cleanText(formData.get("agentId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const message = cleanText(formData.get("message"), 1000);

  if (!agentId || !storeId || !message) {
    ownerRedirect("message-invalid", storeId);
  }

  const context = await getWorkspaceDataContext({
    permission: "manage_orders",
    redirectTo: ownerDeliveryPath
  });
  const { data: agent } = await context.supabase
    .from("store_delivery_agents" as never)
    .select("id")
    .eq("id" as never, agentId as never)
    .eq("workspace_id" as never, context.workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  if (!agent) {
    ownerRedirect("message-access-denied", storeId);
  }

  const { data, error } = await context.supabase
    .from("delivery_messages" as never)
    .insert({
      conversation_type: "owner_delivery",
      delivery_agent_id: agentId,
      message,
      sender_type: "owner",
      sender_user_id: context.user.id,
      status: "unread",
      store_id: storeId,
      workspace_id: context.workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    ownerRedirect("message-failed", storeId);
  }

  await Promise.all([
    createDeliveryNotification({
      agentId,
      category: "system_notice",
      message: "Your store owner sent you a delivery message.",
      storeId,
      title: "New owner message",
      workspaceId: context.workspaceId,
      metadata: {
        messageId: (data as { id: string }).id
      }
    }),
    recordCommunicationAudit({
      action: "delivery_message_sent",
      agentId,
      entityId: (data as { id: string }).id,
      metadata: {
        sender_type: "owner"
      },
      storeId,
      userId: context.user.id,
      workspaceId: context.workspaceId
    })
  ]);

  revalidatePath(ownerDeliveryPath);
  revalidatePath(deliveryMessagesPath);
  revalidatePath(deliveryNotificationsPath);
  ownerRedirect("message-sent", storeId);
}

export async function sendDeliveryReplyAction(formData: FormData) {
  const message = cleanText(formData.get("message"), 1000);

  if (!message) {
    deliveryMessageRedirect("message-invalid");
  }

  const { agent, user } = await requireDeliveryAccess();

  if (!agent) {
    deliveryMessageRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryMessageRedirect("unavailable");
  }

  const { data, error } = await admin
    .from("delivery_messages" as never)
    .insert({
      conversation_type: "owner_delivery",
      delivery_agent_id: agent.agentId,
      message,
      sender_type: "delivery",
      sender_user_id: user.id,
      status: "unread",
      store_id: agent.storeId,
      workspace_id: agent.workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    deliveryMessageRedirect("message-failed");
  }

  await recordCommunicationAudit({
    action: "delivery_message_sent",
    agentId: agent.agentId,
    entityId: (data as { id: string }).id,
    metadata: {
      sender_type: "delivery"
    },
    storeId: agent.storeId,
    userId: user.id,
    workspaceId: agent.workspaceId
  });

  revalidatePath(deliveryMessagesPath);
  revalidatePath(ownerDeliveryPath);
  deliveryMessageRedirect("message-sent");
}

export async function updateDeliveryNotificationStatusAction(formData: FormData) {
  const notificationId = cleanText(formData.get("notificationId"), 80);
  const status = cleanText(formData.get("status"), 20);

  if (!notificationId || (status !== "read" && status !== "archived")) {
    deliveryNotificationRedirect("notification-invalid");
  }

  const { agent } = await requireDeliveryAccess();

  if (!agent) {
    deliveryNotificationRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryNotificationRedirect("unavailable");
  }

  const { error } = await admin
    .from("delivery_notifications" as never)
    .update({
      status,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, notificationId as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never);

  if (error) {
    deliveryNotificationRedirect("notification-failed");
  }

  revalidatePath(deliveryNotificationsPath);
  revalidatePath("/delivery/dashboard");
  deliveryNotificationRedirect(status === "read" ? "notification-read" : "notification-archived");
}

export async function archiveDeliveryConversationAction() {
  const { agent } = await requireDeliveryAccess();

  if (!agent) {
    deliveryMessageRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryMessageRedirect("unavailable");
  }

  const { error } = await admin
    .from("delivery_messages" as never)
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    } as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .neq("status" as never, "archived" as never);

  if (error) {
    deliveryMessageRedirect("archive-failed");
  }

  revalidatePath(deliveryMessagesPath);
  deliveryMessageRedirect("conversation-archived");
}

export async function markDeliveryMessagesReadAction() {
  const { agent } = await requireDeliveryAccess();

  if (!agent) {
    deliveryMessageRedirect("access-denied");
  }

  const admin = createAdminClient();

  if (!admin) {
    deliveryMessageRedirect("unavailable");
  }

  await admin
    .from("delivery_messages" as never)
    .update({
      status: "read",
      updated_at: new Date().toISOString()
    } as never)
    .eq("delivery_agent_id" as never, agent.agentId as never)
    .eq("store_id" as never, agent.storeId as never)
    .neq("sender_type" as never, "delivery" as never)
    .eq("status" as never, "unread" as never);

  revalidatePath(deliveryMessagesPath);
  deliveryMessageRedirect("messages-read");
}
