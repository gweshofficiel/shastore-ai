import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type MonitoringEventStatus = "failed" | "info" | "pending" | "success" | "warning";

export type MonitoringEventInput = {
  entityId?: string | null;
  entityType: string;
  eventStatus?: MonitoringEventStatus;
  eventType: string;
  metadata?: Record<string, unknown>;
  storeId?: string | null;
  supabase?: SupabaseClient | null;
  userId?: string | null;
  workspaceId?: string | null;
};

const sensitiveKeyPattern = /email|password|secret|token|key|credential|phone|address/i;

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 240);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeMetadataValue);
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>);
  }

  return String(value).slice(0, 120);
}

function sanitizeMetadata(metadata: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    safe[key.slice(0, 80)] = sanitizeMetadataValue(value);
  }

  return safe;
}

function firstMetadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      return metadata[key];
    }
  }

  return null;
}

function normalizeMonitoringMetadata(
  metadata: Record<string, unknown>,
  eventStatus: MonitoringEventStatus
) {
  if (eventStatus !== "failed") {
    return metadata;
  }

  const errorCode = firstMetadataValue(metadata, ["error_code", "code"]);
  const errorMessage = firstMetadataValue(metadata, ["error_message", "message"]);
  const errorDetails = firstMetadataValue(metadata, ["error_details", "details"]);
  const errorHint = firstMetadataValue(metadata, ["error_hint", "hint"]);

  return {
    ...metadata,
    error_code: errorCode,
    error_details: errorDetails,
    error_hint: errorHint,
    error_message: errorMessage,
    raw_error: metadata.raw_error ?? {
      code: errorCode,
      details: errorDetails,
      hint: errorHint,
      message: errorMessage
    }
  };
}

function maybeUuid(value: string | null | undefined) {
  const text = value?.trim() || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

export async function recordMonitoringEvent({
  entityId,
  entityType,
  eventStatus = "success",
  eventType,
  metadata = {},
  storeId,
  supabase,
  userId,
  workspaceId
}: MonitoringEventInput) {
  const client = createAdminClient() ?? supabase;

  if (!client) {
    console.warn("[monitoring] event skipped; client unavailable", {
      entityType,
      eventType,
      storeId,
      workspaceId
    });
    return;
  }

  const { error } = await client.from("monitoring_events" as never).insert({
    entity_id: maybeUuid(entityId),
    entity_type: entityType.slice(0, 120),
    event_status: eventStatus,
    event_type: eventType.slice(0, 160),
    metadata: sanitizeMetadata(normalizeMonitoringMetadata(metadata, eventStatus)),
    store_id: maybeUuid(storeId),
    user_id: maybeUuid(userId),
    workspace_id: maybeUuid(workspaceId)
  } as never);

  if (error) {
    console.warn("[monitoring] event insert failed", {
      code: error.code,
      entityType,
      eventType,
      message: error.message,
      storeId,
      workspaceId
    });
  }
}

export async function recordMonitoringEventSafe(input: MonitoringEventInput) {
  try {
    await recordMonitoringEvent(input);
  } catch (error) {
    console.warn("[monitoring] event write failed safely", {
      entityType: input.entityType,
      eventType: input.eventType,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
