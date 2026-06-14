import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recordStoreAuditLogSafe,
  type StoreAuditAction
} from "@/lib/audit/store-audit";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AiAuditEventType,
  AiAuditStatus
} from "@/src/lib/ai/audit/ai-audit-types";
import type {
  AIVisualGenerationJob,
  AIVisualJobLifecycleStatus
} from "@/lib/storefront/ai-visual-queue";

export type AIVisualAuditAction =
  | "ai_visual.job_cancelled"
  | "ai_visual.job_completed"
  | "ai_visual.job_failed"
  | "ai_visual.job_processed"
  | "ai_visual.job_queued"
  | "ai_visual.job_retried"
  | "ai_visual.visual_approved"
  | "ai_visual.visual_disabled"
  | "ai_visual.visual_regenerated"
  | "ai_visual.visual_rejected";

export type AIVisualAuditLogEntry = {
  actionType: AIVisualAuditAction;
  actorUserId: string | null;
  assetType: string;
  createdAt: string;
  errorMessage: string | null;
  jobId: string;
  provider: string;
  requestId: string;
  status: string;
  storeId: string;
  targetId: string | null;
  targetType: string;
};

const aiVisualAuditActions: AIVisualAuditAction[] = [
  "ai_visual.job_cancelled",
  "ai_visual.job_completed",
  "ai_visual.job_failed",
  "ai_visual.job_processed",
  "ai_visual.job_queued",
  "ai_visual.job_retried",
  "ai_visual.visual_approved",
  "ai_visual.visual_disabled",
  "ai_visual.visual_regenerated",
  "ai_visual.visual_rejected"
];

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
];

function textValue(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeAuditText(value: unknown, maxLength = 500) {
  let text = textValue(value, maxLength);

  for (const pattern of secretPatterns) {
    text = text.replace(pattern, "[redacted]");
  }

  return text || null;
}

function auditMetadataForJob({
  errorMessage,
  job,
  status,
  extraMetadata = {}
}: {
  errorMessage?: string | null;
  extraMetadata?: Record<string, unknown>;
  job: AIVisualGenerationJob;
  status?: AIVisualJobLifecycleStatus | string | null;
}) {
  return {
    assetType: job.kind,
    errorMessage: sanitizeAuditText(errorMessage ?? job.error),
    jobId: job.jobId,
    provider: job.provider,
    requestId: job.requestId,
    status: status ?? job.status,
    targetId: job.attachTarget.entityId ?? null,
    targetType: job.attachTarget.type,
    ...extraMetadata
  };
}

function centralizedEventType(actionType: AIVisualAuditAction): AiAuditEventType | null {
  if (actionType === "ai_visual.job_queued" || actionType === "ai_visual.job_retried") {
    return "ai_job_queued";
  }

  if (actionType === "ai_visual.job_processed") {
    return "ai_job_started";
  }

  if (actionType === "ai_visual.job_completed") {
    return "ai_job_completed";
  }

  if (actionType === "ai_visual.job_failed") {
    return "ai_job_failed";
  }

  if (actionType === "ai_visual.job_cancelled") {
    return "ai_job_cancelled";
  }

  if (actionType === "ai_visual.visual_approved" || actionType === "ai_visual.visual_rejected" || actionType === "ai_visual.visual_disabled") {
    return "ai_asset_review_marked";
  }

  return null;
}

function centralizedStatus(actionType: AIVisualAuditAction, status?: AIVisualJobLifecycleStatus | string | null): AiAuditStatus {
  if (actionType === "ai_visual.job_failed") {
    return "failed";
  }

  if (actionType === "ai_visual.job_processed") {
    return "started";
  }

  if (actionType === "ai_visual.job_cancelled") {
    return "skipped";
  }

  if (status === "failed") {
    return "failed";
  }

  return "success";
}

export async function recordAIVisualAuditLogSafe({
  actionType,
  actorUserId,
  errorMessage,
  extraMetadata,
  job,
  status,
  storeId,
  supabase
}: {
  actionType: AIVisualAuditAction;
  actorUserId: string | null;
  errorMessage?: string | null;
  extraMetadata?: Record<string, unknown>;
  job: AIVisualGenerationJob;
  status?: AIVisualJobLifecycleStatus | string | null;
  storeId?: string | null;
  supabase?: SupabaseClient;
}) {
  const centralizedType = centralizedEventType(actionType);

  if (centralizedType) {
    await recordAiAuditLog({
      assetType: job.kind,
      errorCode: actionType === "ai_visual.job_failed" ? "ai_visual_job_failed" : null,
      errorMessage: sanitizeAuditText(errorMessage ?? job.error),
      eventType: centralizedType,
      jobId: job.jobId,
      providerKey: job.provider,
      safeSummary: {
        actionType,
        requestId: job.requestId,
        status: status ?? job.status,
        targetType: job.attachTarget.type
      },
      status: centralizedStatus(actionType, status ?? job.status),
      storeId: storeId ?? job.storeId,
      userId: actorUserId,
      workspaceId: job.workspaceId
    });
  }

  await recordStoreAuditLogSafe({
    action: actionType as StoreAuditAction,
    actorUserId,
    metadata: auditMetadataForJob({
      errorMessage,
      extraMetadata,
      job,
      status
    }),
    storeId: storeId ?? job.storeId,
    supabase
  });
}

export function aiVisualAuditLogEntryFromRow(row: unknown): AIVisualAuditLogEntry | null {
  if (!isRecord(row)) {
    return null;
  }

  const action = textValue(row.action, 120) as AIVisualAuditAction;

  if (!aiVisualAuditActions.includes(action)) {
    return null;
  }

  const metadata = isRecord(row.metadata) ? row.metadata : {};

  return {
    actionType: action,
    actorUserId: textValue(row.actor_user_id, 120) || null,
    assetType: textValue(metadata.assetType, 120),
    createdAt: textValue(row.created_at, 80) || new Date().toISOString(),
    errorMessage: sanitizeAuditText(metadata.errorMessage),
    jobId: textValue(metadata.jobId, 120),
    provider: textValue(metadata.provider, 80),
    requestId: textValue(metadata.requestId, 240),
    status: textValue(metadata.status, 80),
    storeId: textValue(row.store_id, 120),
    targetId: textValue(metadata.targetId, 160) || null,
    targetType: textValue(metadata.targetType, 80)
  };
}
