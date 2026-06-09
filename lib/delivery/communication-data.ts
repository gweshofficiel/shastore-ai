import { createAdminClient } from "@/lib/supabase/admin";

export type DeliveryNotificationCategory =
  | "new_assignment"
  | "assignment_updated"
  | "status_change"
  | "return_request"
  | "return_approved"
  | "reschedule_request"
  | "cod_collection_pending"
  | "cod_settled"
  | "performance_update"
  | "system_notice";

export type DeliveryNotificationStatus = "unread" | "read" | "archived";
export type DeliveryMessageStatus = "unread" | "read" | "archived";
export type DeliverySenderType = "owner" | "delivery" | "system";

export type DeliveryNotificationItem = {
  category: DeliveryNotificationCategory;
  createdAt: string;
  id: string;
  message: string;
  orderId: string | null;
  orderSource: "orders" | "store_orders" | null;
  status: DeliveryNotificationStatus;
  title: string;
};

export type DeliveryMessageItem = {
  createdAt: string;
  id: string;
  message: string;
  orderId: string | null;
  orderSource: "orders" | "store_orders" | null;
  senderType: DeliverySenderType;
  status: DeliveryMessageStatus;
};

type NotificationRow = {
  category: DeliveryNotificationCategory;
  created_at: string;
  id: string;
  message: string;
  order_id?: string | null;
  order_source?: "orders" | "store_orders" | null;
  status: DeliveryNotificationStatus;
  title: string;
};

type MessageRow = {
  created_at: string;
  id: string;
  message: string;
  order_id?: string | null;
  order_source?: "orders" | "store_orders" | null;
  sender_type: DeliverySenderType;
  status: DeliveryMessageStatus;
};

function toNotification(row: NotificationRow): DeliveryNotificationItem {
  return {
    category: row.category,
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    orderId: row.order_id ?? null,
    orderSource: row.order_source ?? null,
    status: row.status,
    title: row.title
  };
}

function toMessage(row: MessageRow): DeliveryMessageItem {
  return {
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    orderId: row.order_id ?? null,
    orderSource: row.order_source ?? null,
    senderType: row.sender_type,
    status: row.status
  };
}

export async function createDeliveryNotification({
  agentId,
  category,
  message,
  orderId,
  orderSource,
  storeId,
  title,
  workspaceId,
  metadata = {}
}: {
  agentId: string;
  category: DeliveryNotificationCategory;
  message: string;
  orderId?: string | null;
  orderSource?: "orders" | "store_orders" | null;
  storeId: string;
  title: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("delivery_notifications" as never).insert({
    category,
    delivery_agent_id: agentId,
    message,
    metadata,
    order_id: orderId ?? null,
    order_source: orderSource ?? null,
    status: "unread",
    store_id: storeId,
    title,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[delivery-communication] notification skipped", {
      agentId,
      category,
      message: error.message
    });
  }
}

export async function createDeliverySystemMessage({
  agentId,
  message,
  orderId,
  orderSource,
  storeId,
  workspaceId,
  metadata = {}
}: {
  agentId: string;
  message: string;
  orderId?: string | null;
  orderSource?: "orders" | "store_orders" | null;
  storeId: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { error } = await admin.from("delivery_messages" as never).insert({
    conversation_type: "system_delivery",
    delivery_agent_id: agentId,
    message,
    metadata,
    order_id: orderId ?? null,
    order_source: orderSource ?? null,
    sender_type: "system",
    status: "unread",
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[delivery-communication] system message skipped", {
      agentId,
      message: error.message
    });
  }
}

export async function getDeliveryCommunicationSummary({
  agentId,
  storeId,
  workspaceId
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      recentMessages: [] as DeliveryMessageItem[],
      recentNotifications: [] as DeliveryNotificationItem[],
      unreadMessages: 0,
      unreadNotifications: 0
    };
  }

  const [notificationsResult, messagesResult, unreadNotificationsResult, unreadMessagesResult] = await Promise.all([
    admin
      .from("delivery_notifications" as never)
      .select("id, category, title, message, status, order_id, order_source, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never)
      .neq("status" as never, "archived" as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(5),
    admin
      .from("delivery_messages" as never)
      .select("id, sender_type, message, status, order_id, order_source, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never)
      .neq("status" as never, "archived" as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(5),
    admin
      .from("delivery_notifications" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never)
      .eq("status" as never, "unread" as never),
    admin
      .from("delivery_messages" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, storeId as never)
      .eq("delivery_agent_id" as never, agentId as never)
      .eq("status" as never, "unread" as never)
      .neq("sender_type" as never, "delivery" as never)
  ]);

  return {
    recentMessages: ((messagesResult.data ?? []) as unknown as MessageRow[]).map(toMessage),
    recentNotifications: ((notificationsResult.data ?? []) as unknown as NotificationRow[]).map(toNotification),
    unreadMessages: unreadMessagesResult.count ?? 0,
    unreadNotifications: unreadNotificationsResult.count ?? 0
  };
}

export async function getDeliveryNotifications({
  agentId,
  storeId,
  workspaceId
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [] as DeliveryNotificationItem[];
  }

  const { data } = await admin
    .from("delivery_notifications" as never)
    .select("id, category, title, message, status, order_id, order_source, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .neq("status" as never, "archived" as never)
    .order("created_at" as never, { ascending: false } as never);

  return ((data ?? []) as unknown as NotificationRow[]).map(toNotification);
}

export async function getDeliveryMessages({
  agentId,
  storeId,
  workspaceId
}: {
  agentId: string;
  storeId: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return [] as DeliveryMessageItem[];
  }

  const { data } = await admin
    .from("delivery_messages" as never)
    .select("id, sender_type, message, status, order_id, order_source, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("delivery_agent_id" as never, agentId as never)
    .neq("status" as never, "archived" as never)
    .order("created_at" as never, { ascending: false } as never);

  return ((data ?? []) as unknown as MessageRow[]).map(toMessage);
}
