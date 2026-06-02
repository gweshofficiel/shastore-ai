import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

type ActivityMetadata = Record<string, unknown>;

const sensitiveKeyPattern = /password|secret|token|key|credential|phone/i;

function sanitizeValue(value: unknown): unknown {
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
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as ActivityMetadata);
  }

  return String(value).slice(0, 120);
}

function sanitizeMetadata(metadata: ActivityMetadata = {}) {
  const safe: ActivityMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    safe[key.slice(0, 80)] = sanitizeValue(value);
  }

  return safe;
}

export async function recordWorkspaceActivity({
  action,
  actorEmail,
  actorUserId,
  entityId,
  entityType,
  metadata = {},
  storeId = null,
  supabase,
  workspaceId
}: {
  action: string;
  actorEmail?: string | null;
  actorUserId: string | null;
  entityId?: string | null;
  entityType: string;
  metadata?: ActivityMetadata;
  storeId?: string | null;
  supabase?: SupabaseClient;
  workspaceId: string;
}) {
  const client = createAdminClient() ?? supabase;

  if (!client) {
    console.warn("[workspace-activity] client unavailable", { action, workspaceId });
    return;
  }

  const { error } = await client.from("workspace_activity_logs" as never).insert({
    action,
    actor_email: actorEmail ?? null,
    actor_user_id: actorUserId,
    entity_id: entityId ?? null,
    entity_type: entityType,
    metadata: sanitizeMetadata(metadata),
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  if (error) {
    console.warn("[workspace-activity] insert failed", {
      action,
      code: error.code,
      message: error.message,
      workspaceId
    });
  }
}

export async function recordWorkspaceActivitySafe(input: Parameters<typeof recordWorkspaceActivity>[0]) {
  try {
    await recordWorkspaceActivity(input);
  } catch (error) {
    console.warn("[workspace-activity] write failed safely", {
      action: input.action,
      message: error instanceof Error ? error.message : String(error),
      workspaceId: input.workspaceId
    });
  }
}
