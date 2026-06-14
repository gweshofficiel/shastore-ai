import type { AIQueueDateRange } from "@/src/lib/ai/queue/ai-queue-types";

export type OpenAIProductionDateRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type OpenAIProductionStatus = "critical" | "degraded" | "healthy" | "unknown";

export type OpenAIProductionIncidentType =
  | "credit_mismatch"
  | "export_failure_spike"
  | "high_failure_rate"
  | "repeated_provider_errors"
  | "stale_queue"
  | "storage_failure_spike"
  | "stuck_running_jobs";

export type OpenAIProductionIncidentSeverity = "critical" | "high" | "medium";

export type OpenAIProductionIncident = {
  detectedAt: string;
  evidence: Record<string, number | string | null>;
  message: string;
  severity: OpenAIProductionIncidentSeverity;
  type: OpenAIProductionIncidentType;
};

export type OpenAIProductionMetrics = {
  assetsGenerated: number;
  assetsStored: number;
  averageDurationMs: number | null;
  completedJobs: number;
  creditFailures: number;
  creditsCharged: number;
  creditsRefunded: number;
  creditsReserved: number;
  exportFailures: number;
  exportsReady: number;
  failedJobs: number;
  failureRate: number;
  p95DurationMs: number | null;
  queuedJobs: number;
  runningJobs: number;
  staleJobs: number;
  storageFailures: number;
  successRate: number;
  totalOpenAIJobs: number;
};

export type OpenAIProductionRecentJobFailure = {
  assetType: string | null;
  errorMessage: string | null;
  jobId: string;
  observedAt: string | null;
  status: string;
  storeId: string | null;
};

export type OpenAIProductionStorageFailure = {
  assetType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  jobId: string;
  observedAt: string;
  status: string;
  storeId: string | null;
};

export type OpenAIProductionMonitoringSnapshot = {
  dateRange: OpenAIProductionDateRange;
  generatedAt: string;
  incidents: OpenAIProductionIncident[];
  metrics: OpenAIProductionMetrics;
  queueDateRange: AIQueueDateRange;
  recentFailedJobs: OpenAIProductionRecentJobFailure[];
  recentStorageFailures: OpenAIProductionStorageFailure[];
  status: OpenAIProductionStatus;
};
