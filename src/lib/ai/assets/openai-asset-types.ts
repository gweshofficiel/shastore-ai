export type OpenAIAssetStatus =
  | "export_failed"
  | "export_ready"
  | "generated"
  | "published"
  | "ready_for_review"
  | "storage_failed"
  | "stored";

export type OpenAIAssetStorageStatus =
  | "failed"
  | "not_applicable"
  | "pending"
  | "stored"
  | "unknown";

export type OpenAIAssetExportStatus =
  | "export_failed"
  | "export_ready"
  | "not_prepared";

export type OpenAIAssetRecord = {
  assetType: string | null;
  contentType: string | null;
  createdAt: string;
  errorCode: string | null;
  exportPreparedAt: string | null;
  exportStatus: OpenAIAssetExportStatus;
  height: number | null;
  id: string;
  jobId: string;
  providerKey: "openai";
  safeErrorMessage: string | null;
  status: OpenAIAssetStatus;
  storageProvider: string | null;
  storageStatus: OpenAIAssetStorageStatus;
  storeId: string | null;
  targetId: string | null;
  targetType: string | null;
  slot: string | null;
  userId: string | null;
  width: number | null;
  workspaceId: string | null;
};

export type OpenAIAssetPersistenceResult = {
  asset: OpenAIAssetRecord | null;
  error: string | null;
  ok: boolean;
  status: OpenAIAssetStatus | "skipped";
};

export type OpenAIAssetRuntimeSnapshot = {
  exportFailed: number;
  exportReady: number;
  generatedAssets: number;
  generatedAt: string;
  recentAssets: OpenAIAssetRecord[];
  storageFailures: number;
  storedAssets: number;
  totalAssets: number;
};
