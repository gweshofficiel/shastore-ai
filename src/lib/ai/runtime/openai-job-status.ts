export const openAIJobStatuses = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "retry_pending"
] as const;

export type OpenAIJobStatus = (typeof openAIJobStatuses)[number];

export type OpenAIJobTransition = {
  from: OpenAIJobStatus;
  to: OpenAIJobStatus;
};

const terminalStatuses = new Set<OpenAIJobStatus>([
  "completed",
  "failed",
  "cancelled",
  "timeout"
]);

const allowedTransitions: Record<OpenAIJobStatus, OpenAIJobStatus[]> = {
  cancelled: [],
  completed: [],
  failed: [],
  queued: ["running", "completed", "failed", "cancelled", "timeout", "retry_pending"],
  retry_pending: ["queued", "running", "failed", "cancelled", "timeout"],
  running: ["completed", "failed", "cancelled", "timeout", "retry_pending"],
  timeout: []
};

export function isOpenAIJobStatus(value: unknown): value is OpenAIJobStatus {
  return openAIJobStatuses.includes(value as OpenAIJobStatus);
}

export function isTerminalOpenAIJobStatus(status: OpenAIJobStatus) {
  return terminalStatuses.has(status);
}

export function canTransitionOpenAIJob(from: OpenAIJobStatus, to: OpenAIJobStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export function assertOpenAIJobTransition(from: OpenAIJobStatus, to: OpenAIJobStatus) {
  if (!canTransitionOpenAIJob(from, to)) {
    throw new Error(`Invalid OpenAI job transition: ${from} -> ${to}.`);
  }
}

export function normalizeOpenAIJobStatus(value: unknown): OpenAIJobStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (isOpenAIJobStatus(status)) {
    return status;
  }

  if (["pending", "waiting", "paused", "prepared", "requested"].includes(status)) {
    return "queued";
  }

  if (["active", "generating", "processing", "started", "validating"].includes(status)) {
    return "running";
  }

  if (["success", "succeeded", "ready"].includes(status)) {
    return "completed";
  }

  if (status === "canceled") {
    return "cancelled";
  }

  if (status.includes("timeout") || status.includes("stale")) {
    return "timeout";
  }

  if (status.includes("retry")) {
    return "retry_pending";
  }

  if (status.includes("fail") || status.includes("error")) {
    return "failed";
  }

  return "queued";
}
