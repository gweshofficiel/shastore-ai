import {
  createAIStoreGenerationRequest,
  mapAISchemaToBuilderDraft,
  normalizeGeneratedStoreSchema,
  prepareStoreGenerationPrompt,
  type AIStoreGenerationInput,
  type GeneratedStoreSchema
} from "@/lib/storefront/ai-generation";
import {
  aiWorkflowSteps,
  markAIWorkflowCompleted,
  markAIWorkflowFailed,
  updateAIWorkflowStep,
  type AIWorkflowStepKey
} from "@/lib/storefront/ai-workflow";
import { createClient } from "@/lib/supabase/server";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";

export type SimulatedAIQueueItem = {
  attempts: number;
  generation_id: string;
  id: string;
  job_id: string | null;
  max_attempts: number;
  owner_user_id: string;
  store_instance_id: string;
};

export type SimulatedAIWorkerResult = {
  error: string | null;
  generationId: string | null;
  queueId: string | null;
  schema: GeneratedStoreSchema | null;
  status: "idle" | "locked" | "completed" | "failed";
};

const simulatedWorkerId = "shastore-ai-simulated-worker";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeQueueItem(value: unknown): SimulatedAIQueueItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const queueId = textValue(value.id);
  const generationId = textValue(value.generation_id);
  const storeInstanceId = textValue(value.store_instance_id);
  const ownerUserId = textValue(value.owner_user_id);

  if (!queueId || !generationId || !storeInstanceId || !ownerUserId) {
    return null;
  }

  return {
    attempts: typeof value.attempts === "number" ? value.attempts : 0,
    generation_id: generationId,
    id: queueId,
    job_id: textValue(value.job_id, "") || null,
    max_attempts: typeof value.max_attempts === "number" ? value.max_attempts : 3,
    owner_user_id: ownerUserId,
    store_instance_id: storeInstanceId
  };
}

export function createSimulatedGeneratedStoreSchema(
  input: Partial<AIStoreGenerationInput>
): GeneratedStoreSchema {
  const request = createAIStoreGenerationRequest(input);

  return normalizeGeneratedStoreSchema({
    branding: {
      accentColor: "#f59e0b",
      logoPrompt: `${request.niche} wordmark for a ${request.brandStyle} ecommerce store`,
      primaryColor: "#0f172a",
      secondaryColor: "#2563eb",
      tone: request.brandStyle
    },
    sections: [
      {
        id: "ai-hero",
        order: 10,
        props: {
          eyebrow: "Simulated AI concept",
          heading: `${request.niche} store concept`,
          subheading: `A ${request.brandStyle} ${request.storeType} storefront for ${request.targetAudience}.`
        },
        type: "hero"
      },
      {
        id: "ai-featured-products",
        order: 20,
        props: {
          heading: "Featured collection",
          layout: request.layoutIntent
        },
        type: "product_grid"
      },
      {
        id: "ai-brand-story",
        order: 30,
        props: {
          body: "Placeholder copy prepared by the simulated worker. Real provider copy will be added later.",
          heading: "Why shoppers choose this store"
        },
        type: "rich_text"
      }
    ],
    store: {
      description: `Simulated ${request.brandStyle} storefront plan for ${request.niche}.`,
      language: request.language,
      niche: request.niche,
      title: `${request.niche} Store`,
      type: request.storeType
    }
  });
}

export async function pickQueuedAIJob(): Promise<SimulatedAIQueueItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_generation_queue" as never)
    .select("id, generation_id, job_id, store_instance_id, owner_user_id, attempts, max_attempts")
    .eq("workflow_state", "queued")
    .eq("queue_status", "waiting")
    .lte("scheduled_for", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return normalizeQueueItem(data);
}

export async function lockAIQueuedJob(queue: SimulatedAIQueueItem) {
  const supabase = await createClient();
  const attempts = queue.attempts + 1;
  const { data, error } = await supabase
    .from("ai_generation_queue" as never)
    .update({
      attempts,
      locked_at: new Date().toISOString(),
      locked_by: simulatedWorkerId,
      metadata: {
        simulated: true,
        workerId: simulatedWorkerId
      },
      queue_status: "active"
    } as never)
    .eq("id", queue.id)
    .eq("queue_status", "waiting")
    .eq("workflow_state", "queued")
    .select("id")
    .maybeSingle();

  const locked = Boolean(data);

  if (!error && locked) {
    await recordAiAuditLog({
      assetType: "store_generation",
      eventType: "ai_job_started",
      jobId: queue.job_id ?? queue.id,
      providerKey: "workflow_placeholder",
      safeSummary: {
        attempts,
        generationId: queue.generation_id,
        queueId: queue.id,
        worker: "simulated"
      },
      status: "started",
      storeId: queue.store_instance_id,
      userId: queue.owner_user_id
    });
  }

  return { error: error?.message ?? null, locked, attempts };
}

async function writeSimulationLog(
  queue: SimulatedAIQueueItem,
  message: string,
  level: "info" | "warning" | "error" = "info"
) {
  const supabase = await createClient();
  await supabase.from("ai_generation_logs" as never).insert({
    generation_id: queue.generation_id,
    log_level: level,
    message,
    metadata: {
      simulated: true,
      workerId: simulatedWorkerId
    },
    owner_user_id: queue.owner_user_id,
    queue_id: queue.id,
    store_instance_id: queue.store_instance_id
  } as never);
}

async function completeStep(queueId: string, stepKey: AIWorkflowStepKey) {
  await updateAIWorkflowStep({
    metadata: {
      simulated: true,
      workerId: simulatedWorkerId
    },
    queueId,
    status: "running",
    stepKey
  });
  await updateAIWorkflowStep({
    metadata: {
      simulated: true,
      workerId: simulatedWorkerId
    },
    queueId,
    status: "completed",
    stepKey
  });
}

async function saveSimulatedResult(queue: SimulatedAIQueueItem, schema: GeneratedStoreSchema) {
  const supabase = await createClient();
  const builderDraft = mapAISchemaToBuilderDraft(schema);
  const promptPreview = prepareStoreGenerationPrompt(
    createAIStoreGenerationRequest({
      brandStyle: schema.branding.tone,
      language: schema.store.language,
      layoutIntent: "conversion",
      niche: schema.store.niche,
      storeType: schema.store.type,
      targetAudience: "Online shoppers"
    })
  );

  const { error: generationError } = await supabase
    .from("ai_store_generations" as never)
    .update({
      generated_branding_schema: schema.branding,
      generated_layout_schema: builderDraft,
      generated_sections_schema: schema.sections,
      generated_store_schema: schema,
      prompt_preview: promptPreview,
      status: "ready"
    } as never)
    .eq("id", queue.generation_id)
    .eq("store_instance_id", queue.store_instance_id);

  if (generationError) {
    return generationError.message;
  }

  if (queue.job_id) {
    const { error: jobError } = await supabase
      .from("ai_generation_jobs" as never)
      .update({
        finished_at: new Date().toISOString(),
        output_schema: schema,
        status: "succeeded"
      } as never)
      .eq("id", queue.job_id)
      .eq("store_instance_id", queue.store_instance_id);

    if (jobError) {
      return jobError.message;
    }
  }

  return null;
}

export async function runSimulatedAIGenerationWorkflow(
  queue: SimulatedAIQueueItem
): Promise<SimulatedAIWorkerResult> {
  const lock = await lockAIQueuedJob(queue);

  if (lock.error || !lock.locked) {
    return {
      error: lock.error ?? "Queued workflow was already locked or processed.",
      generationId: queue.generation_id,
      queueId: queue.id,
      schema: null,
      status: "failed"
    };
  }

  try {
    await writeSimulationLog(queue, "Simulated AI worker locked the workflow.");

    for (const step of aiWorkflowSteps) {
      await completeStep(queue.id, step.key);
      await writeSimulationLog(queue, `Completed simulated step: ${step.key}.`);
    }

    const schema = createSimulatedGeneratedStoreSchema({
      brandStyle: "modern",
      language: "en",
      layoutIntent: "conversion",
      niche: "AI generated storefront",
      storeType: "general",
      targetAudience: "Online shoppers"
    });
    const saveError = await saveSimulatedResult(queue, schema);

    if (saveError) {
      await markAIWorkflowFailed(queue.id, saveError);
      await writeSimulationLog(queue, saveError, "error");

      return {
        error: saveError,
        generationId: queue.generation_id,
        queueId: queue.id,
        schema: null,
        status: "failed"
      };
    }

    await markAIWorkflowCompleted(queue.id);
    await writeSimulationLog(queue, "Simulated AI workflow completed.");

    return {
      error: null,
      generationId: queue.generation_id,
      queueId: queue.id,
      schema,
      status: "completed"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulated AI worker failed.";
    await markAIWorkflowFailed(queue.id, message);
    await writeSimulationLog(queue, message, "error");

    return {
      error: message,
      generationId: queue.generation_id,
      queueId: queue.id,
      schema: null,
      status: "failed"
    };
  }
}

export async function processNextAIGenerationJob(): Promise<SimulatedAIWorkerResult> {
  const queue = await pickQueuedAIJob();

  if (!queue) {
    return {
      error: null,
      generationId: null,
      queueId: null,
      schema: null,
      status: "idle"
    };
  }

  if (queue.attempts >= queue.max_attempts) {
    await markAIWorkflowFailed(queue.id, "Maximum simulated retry attempts reached.");

    return {
      error: "Maximum simulated retry attempts reached.",
      generationId: queue.generation_id,
      queueId: queue.id,
      schema: null,
      status: "failed"
    };
  }

  return runSimulatedAIGenerationWorkflow(queue);
}

export function getAIWorkerRetryPlan(queue: Pick<SimulatedAIQueueItem, "attempts" | "max_attempts">) {
  const remainingAttempts = Math.max(queue.max_attempts - queue.attempts, 0);

  return {
    canRetry: remainingAttempts > 0,
    nextDelaySeconds: queue.attempts <= 0 ? 0 : Math.min(60 * 2 ** queue.attempts, 900),
    remainingAttempts
  };
}
