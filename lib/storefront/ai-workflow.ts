import { createClient } from "@/lib/supabase/server";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";

export type AIWorkflowState =
  | "queued"
  | "validating"
  | "planning"
  | "generating_schema"
  | "mapping_to_builder"
  | "saving_draft"
  | "completed"
  | "failed"
  | "cancelled";

export type AIQueueStatus = "waiting" | "active" | "blocked" | "completed" | "failed" | "cancelled";

export type AIWorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";

export type AIWorkflowStepKey =
  | "validate_request"
  | "plan_generation"
  | "generate_schema"
  | "map_to_builder"
  | "save_builder_draft";

export type AIWorkflowStep = {
  error_message: string | null;
  id: string;
  metadata: Record<string, unknown>;
  step_key: AIWorkflowStepKey;
  step_order: number;
  step_status: AIWorkflowStepStatus;
};

export type AIWorkflowLog = {
  id: string;
  log_level: "debug" | "info" | "warning" | "error";
  message: string;
};

export type AIWorkflowStatus = {
  activeStep: AIWorkflowStep | null;
  logs: AIWorkflowLog[];
  queue: {
    id: string;
    queue_status: AIQueueStatus;
    workflow_state: AIWorkflowState;
  } | null;
  steps: AIWorkflowStep[];
};

export const aiWorkflowSteps: Array<{
  key: AIWorkflowStepKey;
  order: number;
  state: AIWorkflowState;
}> = [
  { key: "validate_request", order: 10, state: "validating" },
  { key: "plan_generation", order: 20, state: "planning" },
  { key: "generate_schema", order: 30, state: "generating_schema" },
  { key: "map_to_builder", order: 40, state: "mapping_to_builder" },
  { key: "save_builder_draft", order: 50, state: "saving_draft" }
];

const terminalStates = new Set<AIWorkflowState>(["completed", "failed", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function queueStatusForState(state: AIWorkflowState): AIQueueStatus {
  if (state === "completed") {
    return "completed";
  }

  if (state === "failed") {
    return "failed";
  }

  if (state === "cancelled") {
    return "cancelled";
  }

  return state === "queued" ? "waiting" : "active";
}

async function readQueueAuditContext(queueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_generation_queue" as never)
    .select("id, generation_id, job_id, owner_user_id, store_instance_id, workflow_state, queue_status")
    .eq("id", queueId)
    .maybeSingle();

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as {
    generation_id?: string | null;
    id?: string | null;
    job_id?: string | null;
    owner_user_id?: string | null;
    queue_status?: string | null;
    store_instance_id?: string | null;
    workflow_state?: string | null;
  };
}

function normalizeStep(value: unknown): AIWorkflowStep | null {
  if (!isRecord(value)) {
    return null;
  }

  const stepKey = typeof value.step_key === "string" ? value.step_key : "";
  const supportedStep = aiWorkflowSteps.find((step) => step.key === stepKey);

  if (!supportedStep || typeof value.id !== "string") {
    return null;
  }

  const stepStatus =
    value.step_status === "running" ||
    value.step_status === "completed" ||
    value.step_status === "failed" ||
    value.step_status === "skipped" ||
    value.step_status === "cancelled"
      ? value.step_status
      : "pending";

  return {
    error_message: typeof value.error_message === "string" ? value.error_message : null,
    id: value.id,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    step_key: supportedStep.key,
    step_order: typeof value.step_order === "number" ? value.step_order : supportedStep.order,
    step_status: stepStatus
  };
}

function normalizeLog(value: unknown): AIWorkflowLog | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.message !== "string") {
    return null;
  }

  return {
    id: value.id,
    log_level:
      value.log_level === "debug" ||
      value.log_level === "warning" ||
      value.log_level === "error"
        ? value.log_level
        : "info",
    message: value.message
  };
}

export async function enqueueAIStoreGeneration({
  generationId,
  jobId,
  metadata = {},
  ownerUserId,
  storeInstanceId
}: {
  generationId: string;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
  ownerUserId: string;
  storeInstanceId: string;
}) {
  const supabase = await createClient();
  const { data: queueData, error: queueError } = await supabase
    .from("ai_generation_queue" as never)
    .insert({
      generation_id: generationId,
      job_id: jobId ?? null,
      metadata,
      owner_user_id: ownerUserId,
      queue_status: "waiting",
      store_instance_id: storeInstanceId,
      workflow_state: "queued"
    } as never)
    .select("id")
    .single();

  if (queueError || !queueData) {
    return { error: queueError?.message ?? "Unable to enqueue AI workflow.", queueId: null };
  }

  const queueId = (queueData as { id: string }).id;
  const stepRows = aiWorkflowSteps.map((step) => ({
    generation_id: generationId,
    metadata: {},
    owner_user_id: ownerUserId,
    queue_id: queueId,
    step_key: step.key,
    step_order: step.order,
    step_status: "pending",
    store_instance_id: storeInstanceId
  }));

  const { error: stepsError } = await supabase.from("ai_generation_steps" as never).insert(stepRows as never);

  if (stepsError) {
    return { error: stepsError.message, queueId };
  }

  await supabase.from("ai_generation_logs" as never).insert({
    generation_id: generationId,
    log_level: "info",
    message: "AI generation workflow queued.",
    owner_user_id: ownerUserId,
    queue_id: queueId,
    store_instance_id: storeInstanceId
  } as never);

  await recordAiAuditLog({
    assetType: "store_generation",
    eventType: "ai_job_queued",
    jobId: jobId ?? queueId,
    providerKey: "workflow_placeholder",
    safeSummary: {
      generationId,
      queueId,
      workflowState: "queued"
    },
    status: "success",
    storeId: storeInstanceId,
    userId: ownerUserId
  });

  return { error: null, queueId };
}

export async function getAIWorkflowStatus(queueId: string): Promise<AIWorkflowStatus> {
  const supabase = await createClient();
  const { data: queueData } = await supabase
    .from("ai_generation_queue" as never)
    .select("id, workflow_state, queue_status")
    .eq("id", queueId)
    .maybeSingle();

  if (!queueData) {
    return { activeStep: null, logs: [], queue: null, steps: [] };
  }

  const { data: stepsData } = await supabase
    .from("ai_generation_steps" as never)
    .select("id, step_key, step_order, step_status, error_message, metadata")
    .eq("queue_id", queueId)
    .order("step_order", { ascending: true });
  const { data: logsData } = await supabase
    .from("ai_generation_logs" as never)
    .select("id, log_level, message")
    .eq("queue_id", queueId)
    .order("created_at", { ascending: false })
    .limit(10);
  const steps = Array.isArray(stepsData)
    ? stepsData.map(normalizeStep).filter((step): step is AIWorkflowStep => Boolean(step))
    : [];

  return {
    activeStep: steps.find((step) => step.step_status === "running") ?? steps.find((step) => step.step_status === "pending") ?? null,
    logs: Array.isArray(logsData)
      ? logsData.map(normalizeLog).filter((log): log is AIWorkflowLog => Boolean(log))
      : [],
    queue: {
      id: (queueData as { id: string }).id,
      queue_status: ((queueData as { queue_status?: AIQueueStatus }).queue_status ?? "waiting"),
      workflow_state: ((queueData as { workflow_state?: AIWorkflowState }).workflow_state ?? "queued")
    },
    steps
  };
}

export async function updateAIWorkflowStep({
  errorMessage,
  metadata = {},
  queueId,
  status,
  stepKey
}: {
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  queueId: string;
  status: AIWorkflowStepStatus;
  stepKey: AIWorkflowStepKey;
}) {
  const supabase = await createClient();
  const step = aiWorkflowSteps.find((candidate) => candidate.key === stepKey);
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    error_message: errorMessage ?? null,
    metadata,
    step_status: status
  };

  if (status === "running") {
    updatePayload.started_at = now;
  }

  if (status === "completed" || status === "failed" || status === "cancelled" || status === "skipped") {
    updatePayload.completed_at = now;
  }

  const { error } = await supabase
    .from("ai_generation_steps" as never)
    .update(updatePayload as never)
    .eq("queue_id", queueId)
    .eq("step_key", stepKey);

  if (!error && step && status === "running") {
    await supabase
      .from("ai_generation_queue" as never)
      .update({
        queue_status: queueStatusForState(step.state),
        workflow_state: step.state
      } as never)
      .eq("id", queueId);
  }

  return { error: error?.message ?? null };
}

export async function markAIWorkflowFailed(queueId: string, errorMessage: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_generation_queue" as never)
    .update({
      error_message: errorMessage,
      failed_at: new Date().toISOString(),
      queue_status: "failed",
      workflow_state: "failed"
    } as never)
    .eq("id", queueId);

  if (!error) {
    const context = await readQueueAuditContext(queueId);

    await recordAiAuditLog({
      assetType: "store_generation",
      errorCode: "ai_workflow_failed",
      errorMessage,
      eventType: "ai_job_failed",
      jobId: context?.job_id ?? queueId,
      providerKey: "workflow_placeholder",
      safeSummary: {
        generationId: context?.generation_id ?? null,
        queueId,
        workflowState: "failed"
      },
      status: "failed",
      storeId: context?.store_instance_id ?? null,
      userId: context?.owner_user_id ?? null
    });
  }

  return { error: error?.message ?? null };
}

export async function markAIWorkflowCompleted(queueId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_generation_queue" as never)
    .update({
      completed_at: new Date().toISOString(),
      queue_status: "completed",
      workflow_state: "completed"
    } as never)
    .eq("id", queueId);

  if (!error) {
    const context = await readQueueAuditContext(queueId);

    await recordAiAuditLog({
      assetType: "store_generation",
      eventType: "ai_job_completed",
      jobId: context?.job_id ?? queueId,
      providerKey: "workflow_placeholder",
      safeSummary: {
        generationId: context?.generation_id ?? null,
        queueId,
        workflowState: "completed"
      },
      status: "success",
      storeId: context?.store_instance_id ?? null,
      userId: context?.owner_user_id ?? null
    });
  }

  return { error: error?.message ?? null };
}

export async function cancelAIWorkflow(queueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_generation_queue" as never)
    .select("workflow_state")
    .eq("id", queueId)
    .maybeSingle();
  const state = (data as { workflow_state?: AIWorkflowState } | null)?.workflow_state ?? "queued";

  if (terminalStates.has(state)) {
    return { error: null };
  }

  const { error } = await supabase
    .from("ai_generation_queue" as never)
    .update({
      cancelled_at: new Date().toISOString(),
      queue_status: "cancelled",
      workflow_state: "cancelled"
    } as never)
    .eq("id", queueId);

  if (!error) {
    const context = await readQueueAuditContext(queueId);

    await recordAiAuditLog({
      assetType: "store_generation",
      eventType: "ai_job_cancelled",
      jobId: context?.job_id ?? queueId,
      providerKey: "workflow_placeholder",
      safeSummary: {
        generationId: context?.generation_id ?? null,
        queueId,
        workflowState: "cancelled"
      },
      status: "skipped",
      storeId: context?.store_instance_id ?? null,
      userId: context?.owner_user_id ?? null
    });
  }

  return { error: error?.message ?? null };
}

export function workflowStatusLabel(value: unknown) {
  return typeof value === "string" && value.trim() ? value.replace(/_/g, " ") : "queued";
}
