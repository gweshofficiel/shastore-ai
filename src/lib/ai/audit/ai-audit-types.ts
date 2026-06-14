export type AiAuditEventType =
  | "ai_diagnostic_failed"
  | "ai_diagnostic_skipped"
  | "ai_diagnostic_started"
  | "ai_diagnostic_success"
  | "ai_asset_created"
  | "ai_asset_published"
  | "ai_asset_review_cleared"
  | "ai_asset_review_marked"
  | "ai_job_cancelled"
  | "ai_job_completed"
  | "ai_job_failed"
  | "ai_job_queued"
  | "ai_job_requested"
  | "ai_job_started";

export type AiAuditStatus = "blocked" | "failed" | "skipped" | "started" | "success";

export type AiAuditLog = {
  assetType: string | null;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  eventType: AiAuditEventType;
  id: string;
  jobId: string | null;
  providerKey: string | null;
  safeSummary: Record<string, unknown> | null;
  status: AiAuditStatus;
  storeId: string | null;
  userId: string | null;
  workspaceId: string | null;
};

export type AiAuditLogFilters = {
  assetType?: string | null;
  eventType?: AiAuditEventType | "all" | null;
  providerKey?: string | null;
  status?: AiAuditStatus | "all" | null;
};

export type RecordAiAuditLogInput = {
  assetType?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType: AiAuditEventType;
  jobId?: string | null;
  providerKey?: string | null;
  safeSummary?: Record<string, unknown> | null;
  status: AiAuditStatus;
  storeId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
};
