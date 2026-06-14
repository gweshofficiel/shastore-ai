export type AIUsageDateRange = "all_time" | "last_30_days" | "last_7_days" | "today";

export type AIUsageFilters = {
  assetType?: string | null;
  dateRange?: AIUsageDateRange | null;
  provider?: string | null;
  status?: string | null;
  storeId?: string | null;
};

export type AIUsageSummary = {
  cancelledJobs: number;
  failedJobs: number;
  failureRate: number;
  generatedAssetsCount: number;
  publishedAssetsCount: number;
  reviewedAssetsCount: number;
  successfulJobs: number;
  successRate: number;
  totalAiJobs: number;
  uniqueStoresUsingAi: number;
  uniqueUsersUsingAi: number;
};

export type AIUsageBreakdownRow = {
  cancelledJobs: number;
  failedJobs: number;
  generatedAssets: number;
  key: string;
  label: string;
  successRate: number;
  successfulJobs: number;
  totalJobs: number;
};

export type AIUsageStatusBreakdownRow = {
  count: number;
  status: string;
};

export type AIUsageAnalyticsSnapshot = {
  assetTypes: string[];
  generatedAt: string;
  providers: string[];
  stores: Array<{ id: string; name: string }>;
  summary: AIUsageSummary;
  usageByAssetType: AIUsageBreakdownRow[];
  usageByProvider: AIUsageBreakdownRow[];
  usageByStatus: AIUsageStatusBreakdownRow[];
  usageByStore: AIUsageBreakdownRow[];
};
