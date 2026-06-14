import {
  assertOpenAIJobTransition,
  normalizeOpenAIJobStatus,
  type OpenAIJobStatus
} from "@/src/lib/ai/runtime/openai-job-status";

export type OpenAIJobProvider = "openai" | "openai-image";

export type OpenAIJobRecord = {
  asset_type: string | null;
  completed_at: string | null;
  cost_estimate: number | null;
  created_at: string;
  error_summary: string | null;
  job_id: string;
  model: string | null;
  owner_id: string | null;
  provider: OpenAIJobProvider;
  started_at: string | null;
  status: OpenAIJobStatus;
  store_id: string | null;
};

export type CreateOpenAIJobInput = {
  asset_type?: string | null;
  completed_at?: string | null;
  cost_estimate?: number | null;
  created_at?: string | null;
  error_summary?: string | null;
  job_id: string;
  model?: string | null;
  owner_id?: string | null;
  provider?: OpenAIJobProvider | string | null;
  started_at?: string | null;
  status?: OpenAIJobStatus | string | null;
  store_id?: string | null;
};

export type OpenAIJobTransitionOptions = {
  at?: string | null;
  error_summary?: string | null;
};

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\b(api[-_]?key|token|secret|password|authorization|private[-_]?key)\s*[:=]\s*[^,\s]+/gi
];

function nowIso() {
  return new Date().toISOString();
}

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function nullableText(value: unknown, maxLength = 240) {
  const cleaned = text(value, maxLength);

  return cleaned || null;
}

function safeProvider(value: CreateOpenAIJobInput["provider"]): OpenAIJobProvider {
  return value === "openai-image" ? "openai-image" : "openai";
}

function safeCost(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10000) / 10000 : null;
}

function safeIso(value: unknown) {
  const cleaned = text(value, 80);

  return Number.isFinite(Date.parse(cleaned)) ? cleaned : null;
}

export function sanitizeOpenAIJobError(value: unknown) {
  let cleaned = text(value, 500);

  for (const pattern of secretPatterns) {
    cleaned = cleaned.replace(pattern, "$1[redacted]");
  }

  return cleaned || null;
}

export function createJob(input: CreateOpenAIJobInput): OpenAIJobRecord {
  return {
    asset_type: nullableText(input.asset_type, 120),
    completed_at: safeIso(input.completed_at),
    cost_estimate: safeCost(input.cost_estimate),
    created_at: safeIso(input.created_at) ?? nowIso(),
    error_summary: sanitizeOpenAIJobError(input.error_summary),
    job_id: text(input.job_id, 160) || `openai-job-${Date.now()}`,
    model: nullableText(input.model, 120),
    owner_id: nullableText(input.owner_id, 120),
    provider: safeProvider(input.provider),
    started_at: safeIso(input.started_at),
    status: normalizeOpenAIJobStatus(input.status ?? "queued"),
    store_id: nullableText(input.store_id, 120)
  };
}

function transitionJob(
  job: OpenAIJobRecord,
  status: OpenAIJobStatus,
  options: OpenAIJobTransitionOptions = {}
): OpenAIJobRecord {
  assertOpenAIJobTransition(job.status, status);

  const at = safeIso(options.at) ?? nowIso();

  return {
    ...job,
    completed_at: status === "completed" || status === "failed" || status === "cancelled" || status === "timeout"
      ? at
      : job.completed_at,
    error_summary: options.error_summary === undefined
      ? job.error_summary
      : sanitizeOpenAIJobError(options.error_summary),
    started_at: status === "running" ? (job.started_at ?? at) : job.started_at,
    status
  };
}

export function startJob(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "running", options);
}

export function completeJob(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "completed", {
    ...options,
    error_summary: null
  });
}

export function failJob(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "failed", options);
}

export function cancelJob(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "cancelled", options);
}

export function markTimeout(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "timeout", options);
}

export function markRetryPending(job: OpenAIJobRecord, options: OpenAIJobTransitionOptions = {}) {
  return transitionJob(job, "retry_pending", options);
}
