export type AICostDateRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type AICostFilters = {
  assetType?: string | null;
  dateRange?: AICostDateRange | null;
  provider?: string | null;
  status?: string | null;
  storeId?: string | null;
};

export type AICostCoverageStatus = "connected" | "not_connected" | "partial";

export type AICostSummary = {
  averageCostPerJob: number;
  costDataCoveragePercent: number;
  costDataCoverageStatus: AICostCoverageStatus;
  estimatedFailedJobCost: number;
  estimatedSuccessfulJobCost: number;
  estimatedTotalCost: number;
  jobsWithCostData: number;
  totalJobs: number;
};

export type AICostBreakdownRow = {
  averageCostPerJob: number;
  estimatedCost: number;
  jobsWithCostData: number;
  key: string;
  label: string;
  totalJobs: number;
};

export type AIHighestCostJob = {
  assetType: string;
  createdAt: string | null;
  estimatedCost: number;
  jobId: string;
  provider: string;
  status: string;
  storeId: string | null;
  storeName: string;
  userId: string | null;
};

export type AICostAnalyticsSnapshot = {
  assetTypes: string[];
  costDataConnected: boolean;
  emptyStateMessage: string | null;
  generatedAt: string;
  highestCostJobs: AIHighestCostJob[];
  providers: string[];
  statusOptions: string[];
  stores: Array<{ id: string; name: string }>;
  summary: AICostSummary;
  usageByAssetType: AICostBreakdownRow[];
  usageByProvider: AICostBreakdownRow[];
  usageByStore: AICostBreakdownRow[];
  usageByUser: AICostBreakdownRow[];
};
