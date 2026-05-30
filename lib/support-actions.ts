"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceDataContext } from "@/lib/workspaces/data-access";

type MonitoringEventSnapshot = {
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  event_status: string;
  event_type: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  store_id: string | null;
  user_id: string | null;
  workspace_id: string | null;
};

const supportTicketPath = "/dashboard/support";
const monitoringPath = "/dashboard/monitoring";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sensitiveKeyPattern = /api[_-]?key|credential|password|secret|service[_-]?role|token/i;

function cleanText(value: FormDataEntryValue | null, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeTicketNumber() {
  return `SUP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function sanitizeSnapshotValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 1000);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(sanitizeSnapshotValue);
  }

  if (typeof value === "object") {
    return sanitizeSnapshot(value as Record<string, unknown>);
  }

  return String(value).slice(0, 240);
}

function sanitizeSnapshot(snapshot: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(snapshot)) {
    safe[key.slice(0, 120)] = sensitiveKeyPattern.test(key)
      ? "[hidden]"
      : sanitizeSnapshotValue(value);
  }

  return safe;
}

function friendlySubject(event: MonitoringEventSnapshot) {
  const label = event.event_type
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return `Support request for ${label}`;
}

export async function createSupportTicketFromMonitoringEvent(formData: FormData) {
  const eventId = cleanText(formData.get("eventId"), 80);
  const returnTo = cleanText(formData.get("returnTo"), 120) || monitoringPath;

  if (!uuidPattern.test(eventId)) {
    redirect(`${returnTo}?supportError=invalid-event`);
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "view_analytics",
    redirectTo: monitoringPath
  });

  const { data: event, error: eventError } = await supabase
    .from("monitoring_events" as never)
    .select("id, workspace_id, store_id, user_id, event_type, event_status, entity_type, entity_id, metadata, created_at")
    .eq("id" as never, eventId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (eventError || !event) {
    console.warn("[support] monitoring event not available for ticket", {
      eventId,
      message: eventError?.message,
      userId: user.id,
      workspaceId
    });
    redirect(`${returnTo}?supportError=event-not-found`);
  }

  const monitoringEvent = event as unknown as MonitoringEventSnapshot;
  const ticketNumber = safeTicketNumber();
  const snapshot = sanitizeSnapshot({
    event: monitoringEvent,
    reportedBy: {
      userId: user.id,
      workspaceId
    },
    source: "monitoring_report"
  });
  const insertPayload = {
    event_id: monitoringEvent.id,
    message: "Store owner reported this monitoring event from the dashboard.",
    priority: monitoringEvent.event_status === "failed" ? "high" : "normal",
    status: "open",
    store_id: monitoringEvent.store_id,
    subject: friendlySubject(monitoringEvent),
    technical_snapshot: snapshot,
    ticket_number: ticketNumber,
    user_id: user.id,
    workspace_id: workspaceId
  };
  const client = createAdminClient() ?? supabase;
  const { error } = await client.from("support_tickets" as never).insert(insertPayload as never);

  if (error) {
    console.error("[support] ticket create failed", {
      code: error.code,
      details: error.details,
      eventId,
      hint: error.hint,
      message: error.message,
      userId: user.id,
      workspaceId
    });
    redirect(`${returnTo}?supportError=create-failed`);
  }

  revalidatePath(supportTicketPath);
  revalidatePath(monitoringPath);
  redirect(`${returnTo}?supportTicket=${encodeURIComponent(ticketNumber)}`);
}
