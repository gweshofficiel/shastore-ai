import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { aiVisualUsageFromStoreData } from "@/lib/storefront/ai-visual-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AICostAnalyticsSnapshot,
  AICostBreakdownRow,
  AICostCoverageStatus,
  AICostDateRange,
  AICostFilters,
  AICostSummary,
  AIHighestCostJob
} from "@/src/lib/ai/costs/ai-cost-types";

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

type CostJob = {
  assetType: string;
  costSource: string | null;
  createdAt: string | null;
  estimatedCost: number | null;
  jobId: string;
  provider: string;
  status: string;
  storeId: string | null;
  storeName: string;
  userId: string | null;
};

const MAX_COST_ROWS = 1000;
const HIGHEST_COST_JOB_LIMIT = 10;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI cost analytics.");
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

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function dateRangeStart(range: AICostDateRange | null | undefined) {
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
    .limit(MAX_COST_ROWS);

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

function providerPlanCost(value: unknown) {
  const providerPlan = isRecord(value) ? value : {};

  return numberValue(providerPlan.estimatedCostUsd ?? providerPlan.estimatedCost ?? providerPlan.costEstimate);
}

function resultCostEstimate(value: unknown) {
  if (!isRecord(value)) {
    return numberValue(value);
  }

  return numberValue(value.totalUsd ?? value.estimatedUsd ?? value.total ?? value.estimatedCost ?? value.cost);
}

function jobsFromStores(rows: unknown[]): CostJob[] {
  const jobs: CostJob[] = [];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const queue = aiVisualQueueFromStoreData(row.store_data);
    const usage = aiVisualUsageFromStoreData(row.store_data);
    const rowStoreId = text(row.id);

    for (const job of Object.values(queue.jobs)) {
      const usageEvent = usage.events[job.requestId];
      const usageCost = numberValue(usageEvent?.estimatedCost);
      const planCost = providerPlanCost(job.providerPlan);
      const estimatedCost = usageCost ?? planCost;

      jobs.push({
        assetType: text(usageEvent?.assetType, text(job.kind, text(job.slot, "ai_visual"))),
        costSource: usageCost ? "ai_visual_usage.estimatedCost" : planCost ? "providerPlan.estimatedCost" : null,
        createdAt: dateText(usageEvent?.createdAt) ?? dateText(job.createdAt) ?? dateText(row.created_at),
        estimatedCost,
        jobId: text(job.jobId, text(job.requestId, `${rowStoreId}:ai_visual_job`)),
        provider: text(usageEvent?.provider, text(job.provider, "ai_visual_provider")),
        status: normalizeStatus(text(usageEvent?.status, text(job.status, "queued"))),
        storeId: text(job.storeId, rowStoreId) || null,
        storeName: storeName(row),
        userId: nullableText(job.requestedByUserId, 80) ?? nullableText(row.owner_user_id, 80) ?? nullableText(row.user_id, 80)
      });
    }
  }

  return jobs;
}

function jobsFromQueue(rows: unknown[], storeById: Map<string, Record<string, unknown>>): CostJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);

      return {
        assetType: "store_generation",
        costSource: null,
        createdAt: dateText(row.created_at),
        estimatedCost: null,
        jobId: text(row.job_id, text(row.id, "ai_generation_queue")),
        provider: "workflow_placeholder",
        status: normalizeStatus(text(row.queue_status, text(row.workflow_state, "queued"))),
        storeId: storeId || null,
        storeName: storeName(store, "AI workflow"),
        userId: nullableText(row.owner_user_id, 80)
      };
    });
}

function jobsFromResults(rows: unknown[], storeById: Map<string, Record<string, unknown>>): CostJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);
      const estimatedCost = resultCostEstimate(row.cost_estimate);

      return {
        assetType: "legacy_ai_generation_result",
        costSource: estimatedCost ? "ai_generation_results.cost_estimate" : null,
        createdAt: dateText(row.created_at),
        estimatedCost,
        jobId: text(row.id, "ai_generation_result"),
        provider: "ai_result_placeholder",
        status: normalizeStatus(text(row.result_status, "unknown")),
        storeId: storeId || null,
        storeName: storeName(store, "AI result"),
        userId: nullableText(row.owner_user_id, 80)
      };
    });
}

function filterJobs(jobs: CostJob[], filters: AICostFilters) {
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

function jobsWithCost(jobs: CostJob[]) {
  return jobs.filter((job) => typeof job.estimatedCost === "number" && job.estimatedCost > 0);
}

function summaryForJobs(jobs: CostJob[]): AICostSummary {
  const costedJobs = jobsWithCost(jobs);
  const estimatedTotalCost = costedJobs.reduce((total, job) => total + (job.estimatedCost ?? 0), 0);
  const estimatedSuccessfulJobCost = costedJobs
    .filter((job) => job.status === "completed")
    .reduce((total, job) => total + (job.estimatedCost ?? 0), 0);
  const estimatedFailedJobCost = costedJobs
    .filter((job) => job.status === "failed" || job.status === "timeout")
    .reduce((total, job) => total + (job.estimatedCost ?? 0), 0);
  const coveragePercent = jobs.length ? Math.round((costedJobs.length / jobs.length) * 1000) / 10 : 0;
  const costDataCoverageStatus: AICostCoverageStatus =
    costedJobs.length === 0 ? "not_connected" : costedJobs.length === jobs.length ? "connected" : "partial";

  return {
    averageCostPerJob: costedJobs.length ? roundMoney(estimatedTotalCost / costedJobs.length) : 0,
    costDataCoveragePercent: coveragePercent,
    costDataCoverageStatus,
    estimatedFailedJobCost: roundMoney(estimatedFailedJobCost),
    estimatedSuccessfulJobCost: roundMoney(estimatedSuccessfulJobCost),
    estimatedTotalCost: roundMoney(estimatedTotalCost),
    jobsWithCostData: costedJobs.length,
    totalJobs: jobs.length
  };
}

function breakdown(
  jobs: CostJob[],
  keyForJob: (job: CostJob) => string | null,
  labelForKey: (key: string) => string = (key) => key
): AICostBreakdownRow[] {
  const rows = new Map<string, AICostBreakdownRow>();

  for (const job of jobs) {
    const key = keyForJob(job) || "unknown";
    const current = rows.get(key) ?? {
      averageCostPerJob: 0,
      estimatedCost: 0,
      jobsWithCostData: 0,
      key,
      label: labelForKey(key),
      totalJobs: 0
    };

    current.totalJobs += 1;

    if (job.estimatedCost) {
      current.jobsWithCostData += 1;
      current.estimatedCost += job.estimatedCost;
    }

    current.estimatedCost = roundMoney(current.estimatedCost);
    current.averageCostPerJob = current.jobsWithCostData
      ? roundMoney(current.estimatedCost / current.jobsWithCostData)
      : 0;
    rows.set(key, current);
  }

  return [...rows.values()]
    .sort((left, right) => right.estimatedCost - left.estimatedCost || right.totalJobs - left.totalJobs)
    .slice(0, 25);
}

function highestCostJobs(jobs: CostJob[]): AIHighestCostJob[] {
  return jobsWithCost(jobs)
    .sort((left, right) => (right.estimatedCost ?? 0) - (left.estimatedCost ?? 0))
    .slice(0, HIGHEST_COST_JOB_LIMIT)
    .map((job) => ({
      assetType: job.assetType,
      createdAt: job.createdAt,
      estimatedCost: roundMoney(job.estimatedCost ?? 0),
      jobId: job.jobId,
      provider: job.provider,
      status: job.status,
      storeId: job.storeId,
      storeName: job.storeName,
      userId: job.userId
    }));
}

export async function getAICostAnalyticsSnapshot(filters: AICostFilters = {}): Promise<AICostAnalyticsSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    const summary = summaryForJobs([]);

    return {
      assetTypes: [],
      costDataConnected: false,
      emptyStateMessage: "Cost tracking is not connected yet.",
      generatedAt: new Date().toISOString(),
      highestCostJobs: [],
      providers: [],
      statusOptions: [],
      stores: [],
      summary,
      usageByAssetType: [],
      usageByProvider: [],
      usageByStore: [],
      usageByUser: []
    };
  }

  const [stores, queueRows, resultRows] = await Promise.all([
    safeRead(admin, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeRead(admin, "ai_generation_queue", "id, job_id, store_instance_id, owner_user_id, workflow_state, queue_status, created_at"),
    safeRead(admin, "ai_generation_results", "id, store_instance_id, owner_user_id, result_status, cost_estimate, metadata, created_at, updated_at")
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
  const summary = summaryForJobs(filteredJobs);
  const storesForFilters = [...new Map(
    allJobs
      .filter((job) => job.storeId)
      .map((job) => [job.storeId as string, { id: job.storeId as string, name: job.storeName }])
  ).values()].sort((left, right) => left.name.localeCompare(right.name));

  return {
    assetTypes: [...new Set(allJobs.map((job) => job.assetType).filter(Boolean))].sort(),
    costDataConnected: summary.jobsWithCostData > 0,
    emptyStateMessage: summary.jobsWithCostData > 0 ? null : "Cost tracking is not connected yet.",
    generatedAt: new Date().toISOString(),
    highestCostJobs: highestCostJobs(filteredJobs),
    providers: [...new Set(allJobs.map((job) => job.provider).filter(Boolean))].sort(),
    statusOptions: [...new Set(allJobs.map((job) => job.status).filter(Boolean))].sort(),
    stores: storesForFilters,
    summary,
    usageByAssetType: breakdown(filteredJobs, (job) => job.assetType),
    usageByProvider: breakdown(filteredJobs, (job) => job.provider),
    usageByStore: breakdown(filteredJobs, (job) => job.storeId, (key) => storesForFilters.find((store) => store.id === key)?.name ?? key),
    usageByUser: breakdown(filteredJobs, (job) => job.userId, (key) => key)
  };
}
