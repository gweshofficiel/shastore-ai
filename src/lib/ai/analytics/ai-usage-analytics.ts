import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AIUsageAnalyticsSnapshot,
  AIUsageBreakdownRow,
  AIUsageDateRange,
  AIUsageFilters,
  AIUsageStatusBreakdownRow,
  AIUsageSummary
} from "@/src/lib/ai/analytics/ai-usage-types";

type QueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

type SelectTable = {
  select: (columns: string) => {
    limit: (limit: number) => QueryResult;
  };
};

type AdminClient = {
  from: (table: string) => unknown;
};

type UsageJob = {
  assetType: string;
  createdAt: string | null;
  generatedAsset: boolean;
  jobId: string;
  provider: string;
  publishedAsset: boolean;
  status: string;
  storeId: string | null;
  storeName: string;
  userId: string | null;
};

const MAX_ANALYTICS_ROWS = 1000;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI usage analytics.");
  }
}

function table(client: AdminClient, tableName: string) {
  return client.from(tableName) as SelectTable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 500)
    : fallback;
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = text(value).slice(0, maxLength);

  return cleaned || null;
}

function dateText(value: unknown) {
  const cleaned = text(value, "");

  return Number.isFinite(Date.parse(cleaned)) ? cleaned : null;
}

function timestamp(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function normalizeStatus(value: string) {
  const status = value.toLowerCase();

  if (["completed", "succeeded", "ready", "success"].includes(status)) {
    return "completed";
  }

  if (status === "cancelled" || status === "canceled") {
    return "cancelled";
  }

  if (status === "failed" || status.includes("error")) {
    return "failed";
  }

  if (["active", "running", "processing", "generating", "validating", "planning", "saving_draft", "mapping_to_builder", "generating_schema"].includes(status)) {
    return "running";
  }

  if (status === "timeout" || status.includes("timeout")) {
    return "timeout";
  }

  if (["queued", "waiting", "pending", "paused"].includes(status)) {
    return "queued";
  }

  return status || "unknown";
}

function dateRangeStart(range: AIUsageDateRange | null | undefined) {
  if (!range || range === "all_time") {
    return null;
  }

  const now = new Date();

  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  const days = range === "last_7_days" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

async function safeRead(client: AdminClient, tableName: string, columns: string) {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .limit(MAX_ANALYTICS_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

function storeName(row: Record<string, unknown> | undefined, fallback = "Unknown store") {
  if (!row) {
    return fallback;
  }

  return text(row.store_name, text(row.name, text(row.slug, fallback)));
}

function jobsFromStores(rows: unknown[]): UsageJob[] {
  const jobs: UsageJob[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const queue = aiVisualQueueFromStoreData(row.store_data);
    const rowStoreId = text(row.id);

    for (const job of Object.values(queue.jobs)) {
      const result: Record<string, unknown> = isRecord(job.result) ? job.result : {};
      const asset: Record<string, unknown> = isRecord(result.asset) ? result.asset : {};
      const generatedAsset = Boolean(result.asset);
      const publishedAsset = Boolean(text(result.publicUrl) || text(asset.publicUrl));

      jobs.push({
        assetType: text(job.kind, text(job.slot, "ai_visual")),
        createdAt: dateText(job.createdAt) ?? dateText(row.created_at),
        generatedAsset,
        jobId: text(job.jobId, text(job.requestId, `${rowStoreId}:ai_visual_job`)),
        provider: text(job.provider, "ai_visual_provider"),
        publishedAsset,
        status: normalizeStatus(text(job.status, "queued")),
        storeId: text(job.storeId, rowStoreId) || null,
        storeName: storeName(row),
        userId: nullableText(job.requestedByUserId, 80) ?? nullableText(row.owner_user_id, 80) ?? nullableText(row.user_id, 80)
      });
    }
  }

  return jobs;
}

function jobsFromQueue(rows: unknown[], storeById: Map<string, Record<string, unknown>>): UsageJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);

      return {
        assetType: "store_generation",
        createdAt: dateText(row.created_at),
        generatedAsset: normalizeStatus(text(row.queue_status, text(row.workflow_state))) === "completed",
        jobId: text(row.job_id, text(row.id, "ai_generation_queue")),
        provider: "workflow_placeholder",
        publishedAsset: false,
        status: normalizeStatus(text(row.queue_status, text(row.workflow_state, "queued"))),
        storeId: storeId || null,
        storeName: storeName(store, "AI workflow"),
        userId: nullableText(row.owner_user_id, 80)
      };
    });
}

function jobsFromResults(rows: unknown[], storeById: Map<string, Record<string, unknown>>): UsageJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);
      const status = normalizeStatus(text(row.result_status, "unknown"));

      return {
        assetType: "legacy_ai_generation_result",
        createdAt: dateText(row.created_at),
        generatedAsset: status === "completed",
        jobId: text(row.id, "ai_generation_result"),
        provider: "ai_result_placeholder",
        publishedAsset: false,
        status,
        storeId: storeId || null,
        storeName: storeName(store, "AI result"),
        userId: nullableText(row.owner_user_id, 80)
      };
    });
}

function filterJobs(jobs: UsageJob[], filters: AIUsageFilters) {
  const start = dateRangeStart(filters.dateRange);

  return jobs
    .filter((job) => !filters.provider || filters.provider === "all" || job.provider === filters.provider)
    .filter((job) => !filters.storeId || filters.storeId === "all" || job.storeId === filters.storeId)
    .filter((job) => !filters.assetType || filters.assetType === "all" || job.assetType === filters.assetType)
    .filter((job) => !filters.status || filters.status === "all" || job.status === filters.status)
    .filter((job) => {
      if (!start) {
        return true;
      }

      const createdAt = timestamp(job.createdAt);
      return createdAt > 0 && createdAt >= start;
    });
}

function summaryForJobs(jobs: UsageJob[], auditRows: unknown[]): AIUsageSummary {
  const successfulJobs = jobs.filter((job) => job.status === "completed").length;
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "timeout").length;
  const cancelledJobs = jobs.filter((job) => job.status === "cancelled").length;
  const reviewedAssetsCount = auditRows
    .filter(isRecord)
    .filter((row) => ["ai_asset_review_marked", "ai_asset_review_cleared"].includes(text(row.event_type)))
    .length;
  const publishedAuditCount = auditRows
    .filter(isRecord)
    .filter((row) => text(row.event_type) === "ai_asset_published")
    .length;

  return {
    cancelledJobs,
    failedJobs,
    failureRate: rate(failedJobs, jobs.length),
    generatedAssetsCount: jobs.filter((job) => job.generatedAsset).length,
    publishedAssetsCount: jobs.filter((job) => job.publishedAsset).length + publishedAuditCount,
    reviewedAssetsCount,
    successfulJobs,
    successRate: rate(successfulJobs, jobs.length),
    totalAiJobs: jobs.length,
    uniqueStoresUsingAi: new Set(jobs.map((job) => job.storeId).filter(Boolean)).size,
    uniqueUsersUsingAi: new Set(jobs.map((job) => job.userId).filter(Boolean)).size
  };
}

function breakdown(
  jobs: UsageJob[],
  keyForJob: (job: UsageJob) => string | null,
  labelForKey: (key: string) => string = (key) => key
): AIUsageBreakdownRow[] {
  const rows = new Map<string, AIUsageBreakdownRow>();

  for (const job of jobs) {
    const key = keyForJob(job) || "unknown";
    const current = rows.get(key) ?? {
      cancelledJobs: 0,
      failedJobs: 0,
      generatedAssets: 0,
      key,
      label: labelForKey(key),
      successRate: 0,
      successfulJobs: 0,
      totalJobs: 0
    };

    current.totalJobs += 1;
    current.successfulJobs += job.status === "completed" ? 1 : 0;
    current.failedJobs += job.status === "failed" || job.status === "timeout" ? 1 : 0;
    current.cancelledJobs += job.status === "cancelled" ? 1 : 0;
    current.generatedAssets += job.generatedAsset ? 1 : 0;
    current.successRate = rate(current.successfulJobs, current.totalJobs);
    rows.set(key, current);
  }

  return [...rows.values()]
    .sort((left, right) => right.totalJobs - left.totalJobs)
    .slice(0, 25);
}

function statusBreakdown(jobs: UsageJob[]): AIUsageStatusBreakdownRow[] {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
    .sort((left, right) => right.count - left.count);
}

export async function getAIUsageAnalyticsSnapshot(filters: AIUsageFilters = {}): Promise<AIUsageAnalyticsSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    const emptySummary = summaryForJobs([], []);

    return {
      assetTypes: [],
      generatedAt: new Date().toISOString(),
      providers: [],
      stores: [],
      summary: emptySummary,
      usageByAssetType: [],
      usageByProvider: [],
      usageByStatus: [],
      usageByStore: []
    };
  }

  const [stores, queueRows, resultRows, auditRows] = await Promise.all([
    safeRead(admin, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeRead(admin, "ai_generation_queue", "id, job_id, store_instance_id, owner_user_id, workflow_state, queue_status, created_at"),
    safeRead(admin, "ai_generation_results", "id, store_instance_id, owner_user_id, result_status, created_at, updated_at"),
    safeRead(admin, "ai_audit_logs", "event_type, provider_key, store_id, asset_type, status, created_at")
  ]);
  const storeById = new Map(
    stores
      .filter(isRecord)
      .map((store) => [text(store.id), store])
  );
  const allJobs = [
    ...jobsFromStores(stores),
    ...jobsFromQueue(queueRows, storeById),
    ...jobsFromResults(resultRows, storeById)
  ];
  const filteredJobs = filterJobs(allJobs, filters);
  const storesForFilters = [...new Map(
    allJobs
      .filter((job) => job.storeId)
      .map((job) => [job.storeId as string, { id: job.storeId as string, name: job.storeName }])
  ).values()].sort((left, right) => left.name.localeCompare(right.name));

  return {
    assetTypes: [...new Set(allJobs.map((job) => job.assetType).filter(Boolean))].sort(),
    generatedAt: new Date().toISOString(),
    providers: [...new Set(allJobs.map((job) => job.provider).filter(Boolean))].sort(),
    stores: storesForFilters,
    summary: summaryForJobs(filteredJobs, auditRows),
    usageByAssetType: breakdown(filteredJobs, (job) => job.assetType),
    usageByProvider: breakdown(filteredJobs, (job) => job.provider),
    usageByStatus: statusBreakdown(filteredJobs),
    usageByStore: breakdown(filteredJobs, (job) => job.storeId, (key) => storesForFilters.find((store) => store.id === key)?.name ?? key)
  };
}
