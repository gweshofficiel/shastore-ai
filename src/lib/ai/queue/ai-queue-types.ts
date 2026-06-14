export type AIQueueJobStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "queued"
  | "retry_pending"
  | "running"
  | "timeout";

export type AIQueueStaleState = "fresh" | "stale_queue" | "stale_running";

export type AIQueueDateRange = "24h" | "7d" | "30d" | "all";

export type AIQueueFilters = {
  assetType?: string | null;
  dateRange?: AIQueueDateRange | null;
  provider?: string | null;
  status?: AIQueueJobStatus | "all" | null;
  storeId?: string | null;
};

export type AIQueueJob = {
  assetType: string | null;
  completedAt: string | null;
  createdAt: string | null;
  durationMs: number | null;
  durationText: string;
  errorMessage: string | null;
  jobId: string;
  provider: string;
  source: "ai_generation_queue" | "ai_generation_result" | "store_visual_queue";
  staleState: AIQueueStaleState;
  startedAt: string | null;
  status: AIQueueJobStatus;
  storeId: string | null;
  storeName: string;
  userId: string | null;
};

export type AIQueueSummary = {
  averageProcessingTimeMs: number | null;
  averageProcessingTimeText: string;
  cancelled: number;
  completed: number;
  failed: number;
  oldestQueuedJob: string | null;
  queued: number;
  retryPending: number;
  running: number;
  timeout: number;
  totalJobs: number;
};

export type AIQueueMonitoringSnapshot = {
  generatedAt: string;
  jobs: AIQueueJob[];
  summary: AIQueueSummary;
};
