import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreAuditAction =
  | "ai_visual.job_cancelled"
  | "ai_visual.job_completed"
  | "ai_visual.job_failed"
  | "ai_visual.job_processed"
  | "ai_visual.job_queued"
  | "ai_visual.job_retried"
  | "ai_visual.visual_approved"
  | "ai_visual.visual_disabled"
  | "ai_visual.visual_regenerated"
  | "ai_visual.visual_rejected"
  | "domain_connected"
  | "domain_order_draft_prepared"
  | "domain_primary_routing_prepared"
  | "domain_registration_workflow_prepared"
  | "ownership_transfer_blocked"
  | "ownership_transfer_completed"
  | "ownership_transfer_requested"
  | "store_created"
  | "store_locked_by_plan"
  | "store_published"
  | "store_unpublished"
  | "store_updated";

type AuditMetadata = Record<string, unknown>;

const sensitiveKeyPattern = /email|password|secret|token|key|credential|phone/i;

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
    return sanitizeMetadata(value as AuditMetadata);
  }

  return String(value).slice(0, 120);
}

function sanitizeMetadata(metadata: AuditMetadata = {}) {
  const safe: AuditMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    safe[key.slice(0, 80)] = sanitizeMetadataValue(value);
  }

  return safe;
}

export async function recordStoreAuditLog({
  action,
  actorUserId,
  metadata = {},
  storeId,
  supabase
}: {
  action: StoreAuditAction;
  actorUserId: string | null;
  metadata?: AuditMetadata;
  storeId: string;
  supabase?: SupabaseClient;
}) {
  const client = createAdminClient() ?? supabase;

  if (!client) {
    console.warn("[store-audit] audit client unavailable", { action, storeId });
    return;
  }

  const { error } = await client.from("store_audit_logs" as never).insert({
    action,
    actor_user_id: actorUserId,
    metadata: sanitizeMetadata(metadata),
    store_id: storeId
  } as never);

  if (error) {
    console.warn("[store-audit] audit insert failed", {
      action,
      code: error.code,
      message: error.message,
      storeId
    });
    return;
  }

  console.info("[store-audit] audit event recorded", {
    action,
    storeId
  });
}

export async function recordStoreAuditLogSafe(input: {
  action: StoreAuditAction;
  actorUserId: string | null;
  metadata?: AuditMetadata;
  storeId?: string | null;
  supabase?: SupabaseClient;
}) {
  if (!input.storeId) {
    console.warn("[store-audit] audit skipped without store id", {
      action: input.action
    });
    return;
  }

  try {
    await recordStoreAuditLog({
      action: input.action,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
      storeId: input.storeId,
      supabase: input.supabase
    });
  } catch (error) {
    console.warn("[store-audit] audit write failed safely", {
      action: input.action,
      message: error instanceof Error ? error.message : String(error),
      storeId: input.storeId
    });
  }
}
