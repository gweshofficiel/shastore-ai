export type AIErrorGroup =
  | "MODERATION_ERROR"
  | "PROVIDER_ERROR"
  | "STORAGE_ERROR"
  | "TIMEOUT_ERROR"
  | "UNKNOWN_ERROR"
  | "VALIDATION_ERROR";

export type AIErrorSeverity = "critical" | "high" | "low" | "medium";

export type AIErrorSignal = {
  assetType: string | null;
  errorCode: string | null;
  errorGroup: AIErrorGroup;
  errorMessage: string | null;
  jobId: string | null;
  observedAt: string;
  provider: string | null;
  storeId: string | null;
};

export type AIErrorCenterItem = {
  assetType: string | null;
  errorCode: string | null;
  errorGroup: AIErrorGroup;
  errorMessage: string | null;
  firstSeenAt: string;
  id: string;
  jobId: string | null;
  lastSeenAt: string;
  occurrences: number;
  provider: string | null;
  severity: AIErrorSeverity;
  storeId: string | null;
};

export type AIErrorFilters = {
  dateRange?: "24h" | "7d" | "30d" | "all" | null;
  errorGroup?: AIErrorGroup | "all" | null;
  provider?: string | null;
  severity?: AIErrorSeverity | "all" | null;
  storeId?: string | null;
};

export type PersistedAIErrorEvent = AIErrorCenterItem & {
  aggregationKey: string;
};
