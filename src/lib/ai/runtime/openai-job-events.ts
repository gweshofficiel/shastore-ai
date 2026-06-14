import "server-only";

import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AiAuditEventType,
  AiAuditStatus
} from "@/src/lib/ai/audit/ai-audit-types";
import type { OpenAIJobRecord } from "@/src/lib/ai/runtime/openai-job-model";
import { recordOpenAIObservabilityHook, type OpenAIObservabilityHook } from "@/src/lib/ai/runtime/openai-observability";

export type OpenAIJobLifecycleEvent =
  | "job_created"
  | "job_started"
  | "job_completed"
  | "job_failed"
  | "job_cancelled"
  | "job_timeout"
  | "job_retry_pending";

const auditEventByLifecycleEvent: Record<OpenAIJobLifecycleEvent, AiAuditEventType> = {
  job_cancelled: "ai_job_cancelled",
  job_completed: "ai_job_completed",
  job_created: "ai_job_created",
  job_failed: "ai_job_failed",
  job_retry_pending: "ai_job_retry_pending",
  job_started: "ai_job_started",
  job_timeout: "ai_job_timeout"
};

const auditStatusByLifecycleEvent: Record<OpenAIJobLifecycleEvent, AiAuditStatus> = {
  job_cancelled: "blocked",
  job_completed: "success",
  job_created: "started",
  job_failed: "failed",
  job_retry_pending: "skipped",
  job_started: "started",
  job_timeout: "failed"
};

const observabilityHookByLifecycleEvent: Record<OpenAIJobLifecycleEvent, OpenAIObservabilityHook> = {
  job_cancelled: "job_failed",
  job_completed: "job_completed",
  job_created: "job_created",
  job_failed: "job_failed",
  job_retry_pending: "job_started",
  job_started: "job_started",
  job_timeout: "timeout_detected"
};

function safeLifecycleSummary(job: OpenAIJobRecord, eventType: OpenAIJobLifecycleEvent) {
  return {
    assetType: job.asset_type,
    costEstimatePresent: job.cost_estimate !== null,
    eventType,
    model: job.model,
    provider: job.provider,
    status: job.status,
    timestamps: {
      completedAt: job.completed_at,
      createdAt: job.created_at,
      startedAt: job.started_at
    }
  };
}

export async function recordOpenAIJobLifecycleEvent({
  eventType,
  job,
  workspaceId = null
}: {
  eventType: OpenAIJobLifecycleEvent;
  job: OpenAIJobRecord;
  workspaceId?: string | null;
}) {
  await recordAiAuditLog({
    assetType: job.asset_type,
    errorCode: eventType === "job_failed" || eventType === "job_timeout" ? eventType : null,
    errorMessage: eventType === "job_failed" || eventType === "job_timeout" ? job.error_summary : null,
    eventType: auditEventByLifecycleEvent[eventType],
    jobId: job.job_id,
    providerKey: job.provider,
    safeSummary: safeLifecycleSummary(job, eventType),
    status: auditStatusByLifecycleEvent[eventType],
    storeId: job.store_id,
    userId: job.owner_id,
    workspaceId
  });
  await recordOpenAIObservabilityHook({
    errorCode: eventType === "job_failed" || eventType === "job_timeout" ? eventType : null,
    hook: observabilityHookByLifecycleEvent[eventType],
    job,
    workspaceId
  });
}
