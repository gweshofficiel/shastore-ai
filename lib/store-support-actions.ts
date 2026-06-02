"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type TicketStatus = "Open" | "In Progress" | "Waiting Customer" | "Resolved" | "Closed";
type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
type TicketCategory =
  | "Order Issue"
  | "Delivery Issue"
  | "Refund Request"
  | "Return Request"
  | "Product Question"
  | "Technical Issue"
  | "Other";

const dashboardSupportPath = "/dashboard/support";
const statuses = new Set<TicketStatus>(["Open", "In Progress", "Waiting Customer", "Resolved", "Closed"]);
const priorities = new Set<TicketPriority>(["Low", "Medium", "High", "Urgent"]);
const categories = new Set<TicketCategory>([
  "Order Issue",
  "Delivery Issue",
  "Refund Request",
  "Return Request",
  "Product Question",
  "Technical Issue",
  "Other"
]);

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeEmail(value: FormDataEntryValue | null) {
  const text = cleanText(value, 240).toLowerCase();
  return text.includes("@") ? text : "";
}

function ticketNumber() {
  return `SUP-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function customerSupportPath(slug: string, phone: string, ticketId?: string) {
  const params = new URLSearchParams();

  if (phone) {
    params.set("phone", phone);
  }

  if (ticketId) {
    params.set("ticketId", ticketId);
  }

  return `/store/${slug}/account/support${params.toString() ? `?${params.toString()}` : ""}`;
}

function safeCustomerReturnTo(value: FormDataEntryValue | null) {
  const candidate = cleanText(value, 500);
  return candidate.startsWith("/store/") && candidate.includes("/account/support") ? candidate : "/store";
}

function redirectWith(path: string, key: "support" | "supportStatus", status: string, ticketId?: string): never {
  const [basePath, rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set(key, status);

  if (ticketId) {
    params.set("ticketId", ticketId);
  }

  redirect(`${basePath}?${params.toString()}`);
}

async function recordTicketEvent({
  actorType,
  actorUserId,
  eventType,
  message,
  newValue,
  previousValue,
  storeId,
  supabase,
  ticketId,
  workspaceId
}: {
  actorType: "customer" | "staff" | "system";
  actorUserId?: string | null;
  eventType: "ticket_created" | "ticket_replied" | "status_changed" | "assigned";
  message: string;
  newValue?: string | null;
  previousValue?: string | null;
  storeId: string;
  supabase: SupabaseClient;
  ticketId: string;
  workspaceId: string;
}) {
  const { error } = await supabase.from("store_support_ticket_events" as never).insert({
    actor_type: actorType,
    actor_user_id: actorUserId ?? null,
    event_type: eventType,
    message,
    new_value: newValue ?? null,
    previous_value: previousValue ?? null,
    store_id: storeId,
    ticket_id: ticketId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[store-support] ticket event skipped", {
      code: error.code,
      eventType,
      message: error.message,
      ticketId
    });
  }
}

async function loadStoreCustomer({
  phone,
  storeId,
  supabase,
  workspaceId
}: {
  phone: string;
  storeId: string;
  supabase: SupabaseClient;
  workspaceId: string | null;
}) {
  const normalizedPhone = normalizePhone(phone);

  if (!workspaceId || !normalizedPhone) {
    return null;
  }

  const { data } = await supabase
    .from("store_customers" as never)
    .select("id, name, email, phone")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .eq("normalized_phone" as never, normalizedPhone as never)
    .maybeSingle();

  return data as { email?: string | null; id: string; name?: string | null; phone?: string | null } | null;
}

async function requireCustomerTicket({
  phone,
  ticketId
}: {
  phone: string;
  ticketId: string;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("store_support_tickets" as never)
    .select("id, workspace_id, store_id, customer_phone, status")
    .eq("id" as never, ticketId as never)
    .maybeSingle();
  const ticket = data as {
    customer_phone?: string | null;
    id: string;
    status?: string | null;
    store_id: string;
    workspace_id: string;
  } | null;

  if (!ticket || normalizePhone(ticket.customer_phone) !== normalizePhone(phone)) {
    return null;
  }

  return { admin, ticket };
}

export async function createCustomerSupportTicketAction(formData: FormData) {
  const slug = cleanText(formData.get("slug"), 160).toLowerCase();
  const storeId = cleanText(formData.get("storeId"), 80);
  const workspaceId = cleanText(formData.get("workspaceId"), 80);
  const phone = cleanText(formData.get("phone"), 80);
  const name = cleanText(formData.get("name"), 160) || "Customer";
  const email = normalizeEmail(formData.get("email"));
  const subject = cleanText(formData.get("subject"), 180);
  const category = cleanText(formData.get("category"), 80) as TicketCategory;
  const priority = cleanText(formData.get("priority"), 40) as TicketPriority;
  const message = cleanText(formData.get("message"), 3000);

  if (!slug || !storeId || !workspaceId || !phone || !subject || !message || !categories.has(category) || !priorities.has(priority)) {
    redirectWith(customerSupportPath(slug, phone), "support", "invalid");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirectWith(customerSupportPath(slug, phone), "support", "unavailable");
  }

  const customer = await loadStoreCustomer({
    phone,
    storeId,
    supabase: admin,
    workspaceId
  });
  const { data: ticket, error } = await admin
    .from("store_support_tickets" as never)
    .insert({
      category,
      customer_email: email || customer?.email || null,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? name,
      customer_phone: customer?.phone ?? phone,
      priority,
      status: "Open",
      store_id: storeId,
      subject,
      ticket_number: ticketNumber(),
      workspace_id: workspaceId
    } as never)
    .select("id")
    .single();

  if (error || !ticket) {
    console.error("[store-support] customer ticket create failed", {
      code: error?.code,
      message: error?.message,
      storeId
    });
    redirectWith(customerSupportPath(slug, phone), "support", "failed");
  }

  const ticketRow = ticket as unknown as { id: string };
  const { error: messageError } = await admin.from("store_support_ticket_messages" as never).insert({
    customer_email: email || customer?.email || null,
    customer_name: customer?.name ?? name,
    customer_phone: customer?.phone ?? phone,
    message,
    sender_type: "customer",
    store_id: storeId,
    ticket_id: ticketRow.id,
    workspace_id: workspaceId
  } as never);

  if (messageError) {
    console.warn("[store-support] initial message skipped", {
      message: messageError.message,
      ticketId: ticketRow.id
    });
  }

  await recordTicketEvent({
    actorType: "customer",
    eventType: "ticket_created",
    message: "Customer created support ticket.",
    newValue: "Open",
    storeId,
    supabase: admin,
    ticketId: ticketRow.id,
    workspaceId
  });

  revalidatePath(customerSupportPath(slug, phone, ticketRow.id));
  redirectWith(customerSupportPath(slug, phone, ticketRow.id), "support", "created", ticketRow.id);
}

export async function replyCustomerSupportTicketAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const phone = cleanText(formData.get("phone"), 80);
  const returnTo = safeCustomerReturnTo(formData.get("returnTo"));
  const message = cleanText(formData.get("message"), 3000);

  if (!ticketId || !phone || !message) {
    redirectWith(returnTo, "support", "invalid");
  }

  const access = await requireCustomerTicket({ phone, ticketId });

  if (!access) {
    redirectWith(returnTo, "support", "not-authorized");
  }

  const { admin, ticket } = access;
  const { error } = await admin.from("store_support_ticket_messages" as never).insert({
    customer_phone: phone,
    message,
    sender_type: "customer",
    store_id: ticket.store_id,
    ticket_id: ticket.id,
    workspace_id: ticket.workspace_id
  } as never);

  if (error) {
    redirectWith(returnTo, "support", "reply-failed", ticketId);
  }

  await admin
    .from("store_support_tickets" as never)
    .update({ status: ticket.status === "Closed" ? "Open" : "Open" } as never)
    .eq("id" as never, ticket.id as never);
  await recordTicketEvent({
    actorType: "customer",
    eventType: "ticket_replied",
    message: "Customer replied to support ticket.",
    newValue: "customer_reply",
    storeId: ticket.store_id,
    supabase: admin,
    ticketId: ticket.id,
    workspaceId: ticket.workspace_id
  });

  revalidatePath(returnTo);
  redirectWith(returnTo, "support", "replied", ticketId);
}

async function getStaffContext() {
  const context = await getWorkspaceDataContext({
    permission: "can_view_notifications",
    redirectTo: dashboardSupportPath
  });
  const admin = createAdminClient() ?? context.supabase;

  return { ...context, admin };
}

async function loadStaffTicket({
  storeId,
  ticketId,
  workspaceId,
  supabase
}: {
  storeId: string;
  ticketId: string;
  workspaceId: string;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("store_support_tickets" as never)
    .select("id, workspace_id, store_id, status, assigned_user_id")
    .eq("id" as never, ticketId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .maybeSingle();

  return data as {
    assigned_user_id?: string | null;
    id: string;
    status: string;
    store_id: string;
    workspace_id: string;
  } | null;
}

export async function replyStaffSupportTicketAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const message = cleanText(formData.get("message"), 3000);

  if (!ticketId || !storeId || !message) {
    redirectWith(dashboardSupportPath, "supportStatus", "invalid");
  }

  const context = await getStaffContext();
  const ticket = await loadStaffTicket({
    storeId,
    ticketId,
    supabase: context.admin,
    workspaceId: context.workspaceId
  });

  if (!ticket) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}`, "supportStatus", "not-authorized");
  }

  const { error } = await context.admin.from("store_support_ticket_messages" as never).insert({
    message,
    sender_type: "staff",
    sender_user_id: context.user.id,
    store_id: ticket.store_id,
    ticket_id: ticket.id,
    workspace_id: ticket.workspace_id
  } as never);

  if (error) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "reply-failed");
  }

  await context.admin
    .from("store_support_tickets" as never)
    .update({ status: "Waiting Customer" } as never)
    .eq("id" as never, ticket.id as never);
  await recordTicketEvent({
    actorType: "staff",
    actorUserId: context.user.id,
    eventType: "ticket_replied",
    message: "Staff replied to support ticket.",
    newValue: "staff_reply",
    storeId: ticket.store_id,
    supabase: context.admin,
    ticketId: ticket.id,
    workspaceId: ticket.workspace_id
  });

  revalidatePath(dashboardSupportPath);
  redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "replied");
}

export async function updateSupportTicketStatusAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const status = cleanText(formData.get("status"), 80) as TicketStatus;

  if (!ticketId || !storeId || !statuses.has(status)) {
    redirectWith(dashboardSupportPath, "supportStatus", "invalid");
  }

  const context = await getStaffContext();
  const ticket = await loadStaffTicket({
    storeId,
    ticketId,
    supabase: context.admin,
    workspaceId: context.workspaceId
  });

  if (!ticket) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}`, "supportStatus", "not-authorized");
  }

  const { error } = await context.admin
    .from("store_support_tickets" as never)
    .update({ status } as never)
    .eq("id" as never, ticket.id as never);

  if (error) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "status-failed");
  }

  if (ticket.status !== status) {
    await recordTicketEvent({
      actorType: "staff",
      actorUserId: context.user.id,
      eventType: "status_changed",
      message: `Ticket status changed from ${ticket.status} to ${status}.`,
      newValue: status,
      previousValue: ticket.status,
      storeId: ticket.store_id,
      supabase: context.admin,
      ticketId: ticket.id,
      workspaceId: ticket.workspace_id
    });
  }

  revalidatePath(dashboardSupportPath);
  redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "updated");
}

export async function assignSupportTicketAction(formData: FormData) {
  const ticketId = cleanText(formData.get("ticketId"), 80);
  const storeId = cleanText(formData.get("storeId"), 80);
  const assignedUserId = cleanText(formData.get("assignedUserId"), 80);

  if (!ticketId || !storeId) {
    redirectWith(dashboardSupportPath, "supportStatus", "invalid");
  }

  const context = await getStaffContext();
  const ticket = await loadStaffTicket({
    storeId,
    ticketId,
    supabase: context.admin,
    workspaceId: context.workspaceId
  });

  if (!ticket) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}`, "supportStatus", "not-authorized");
  }

  if (assignedUserId) {
    const { data: member } = await context.admin
      .from("workspace_members" as never)
      .select("user_id, status")
      .eq("workspace_id" as never, context.workspaceId as never)
      .eq("user_id" as never, assignedUserId as never)
      .maybeSingle();
    const memberRow = member as { status?: string | null; user_id?: string | null } | null;

    if (!memberRow || memberRow.status !== "active") {
      redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "invalid-assignee");
    }
  }

  const { error } = await context.admin
    .from("store_support_tickets" as never)
    .update({
      assigned_user_id: assignedUserId || null,
      status: ticket.status === "Open" ? "In Progress" : ticket.status
    } as never)
    .eq("id" as never, ticket.id as never);

  if (error) {
    redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "assign-failed");
  }

  await recordTicketEvent({
    actorType: "staff",
    actorUserId: context.user.id,
    eventType: "assigned",
    message: assignedUserId ? "Ticket assigned to staff member." : "Ticket assignment cleared.",
    newValue: assignedUserId || null,
    previousValue: ticket.assigned_user_id ?? null,
    storeId: ticket.store_id,
    supabase: context.admin,
    ticketId: ticket.id,
    workspaceId: ticket.workspace_id
  });

  revalidatePath(dashboardSupportPath);
  redirectWith(`${dashboardSupportPath}?storeId=${encodeURIComponent(storeId)}&ticketId=${encodeURIComponent(ticketId)}`, "supportStatus", "assigned");
}
