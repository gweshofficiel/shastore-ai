import type { AIErrorCenterSnapshot } from "@/src/lib/ai/errors/error-service";
import type { AIHealthSnapshot } from "@/src/lib/ai/health/health-types";
import type { OpenAIAssetRuntimeSnapshot } from "@/src/lib/ai/assets/openai-asset-types";
import type { OpenAICreditRuntimeSnapshot } from "@/src/lib/ai/credits/openai-credit-types";
import type { OpenAIObservabilitySnapshot } from "@/src/lib/ai/runtime/openai-observability";
import type { OpenAIProductionMonitoringSnapshot } from "@/src/lib/ai/production/openai-production-types";

export type OpenAIProductionCertificationStatus = "blocked" | "needs_attention" | "ready";

export type OpenAIProductionChecklistKey =
  | "asset_persistence_ready"
  | "credits_deduction_ready"
  | "credits_refund_ready"
  | "credits_reservation_ready"
  | "error_handling_ready"
  | "executor_ready"
  | "export_runtime_ready"
  | "job_lifecycle_ready"
  | "monitoring_ready"
  | "security_masking_ready";

export type OpenAIProductionChecklistItem = {
  key: OpenAIProductionChecklistKey;
  label: string;
  message: string;
  status: OpenAIProductionCertificationStatus;
};

export type OpenAIProductionBlockerSeverity = "critical" | "high" | "medium";

export type OpenAIProductionBlocker = {
  message: string;
  provider: string | null;
  relatedJobId: string | null;
  relatedStoreId: string | null;
  severity: OpenAIProductionBlockerSeverity;
  suggestedAction: string;
  type: string;
};

export type OpenAIProductionSecurityReview = {
  checkedItems: string[];
  passed: boolean;
  result: string;
};

export type OpenAIProductionCertificationSnapshot = {
  blockers: OpenAIProductionBlocker[];
  checklist: OpenAIProductionChecklistItem[];
  generatedAt: string;
  noProductionJobsMessage: string | null;
  readinessScore: number;
  securityReview: OpenAIProductionSecurityReview;
  status: OpenAIProductionCertificationStatus;
};

export type BuildOpenAIProductionCertificationInput = {
  assetSnapshot: OpenAIAssetRuntimeSnapshot;
  creditSnapshot: OpenAICreditRuntimeSnapshot;
  errorSnapshot: AIErrorCenterSnapshot;
  healthSnapshot: AIHealthSnapshot;
  monitoringSnapshot: OpenAIProductionMonitoringSnapshot;
  observabilitySnapshot: OpenAIObservabilitySnapshot;
};
