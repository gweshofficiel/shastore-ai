import "server-only";

import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import { getOpenAICreditRuntimeSnapshot } from "@/src/lib/ai/credits/openai-credit-service";
import { getAIErrorCenterSnapshot } from "@/src/lib/ai/errors/error-service";
import { getAIQueueMonitoringSnapshot } from "@/src/lib/ai/queue/ai-queue-monitoring";
import type { AIQueueDateRange, AIQueueJob } from "@/src/lib/ai/queue/ai-queue-types";
import { getOpenAIAssetRuntimeSnapshot } from "@/src/lib/ai/assets/openai-asset-persistence";
import type { OpenAIAssetRecord } from "@/src/lib/ai/assets/openai-asset-types";
import { sanitizeOpenAIJobError } from "@/src/lib/ai/runtime/openai-job-model";
import type {
  OpenAIProductionDateRange,
  OpenAIProductionIncident,
  OpenAIProductionMonitoringSnapshot,
  OpenAIProductionStatus
} from "@/src/lib/ai/production/openai-production-types";

const productionDateRanges: OpenAIProductionDateRange[] = ["today", "last_7_days", "last_30_days", "all_time"];

function isOpenAIProvider(provider: string | null | undefined) {
  const normalized = provider?.toLowerCase() ?? "";

  return normalized === "openai" || normalized === "openai-image" || normalized.includes("openai");
}

function queueDateRange(range: OpenAIProductionDateRange): AIQueueDateRange {
  if (range === "today") {
    return "24h";
  }

  if (range === "last_7_days") {
    return "7d";
  }

  if (range === "last_30_days") {
    return "30d";
  }

  return "all";
}

function safeDateRange(value: unknown): OpenAIProductionDateRange {
  return productionDateRanges.includes(value as OpenAIProductionDateRange)
    ? (value as OpenAIProductionDateRange)
    : "today";
}

function timestamp(value: string | null | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);

  return sorted[index] ?? null;
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : null;
}

function observedAt(job: AIQueueJob) {
  return job.completedAt ?? job.startedAt ?? job.createdAt;
}

function latestFailures(jobs: AIQueueJob[]) {
  return jobs
    .filter((job) => job.status === "failed" || job.status === "timeout" || job.staleState !== "fresh")
    .sort((left, right) => timestamp(observedAt(right)) - timestamp(observedAt(left)))
    .slice(0, 10)
    .map((job) => ({
      assetType: job.assetType,
      errorMessage: sanitizeOpenAIJobError(job.errorMessage),
      jobId: job.jobId,
      observedAt: observedAt(job),
      status: job.staleState !== "fresh" ? job.staleState : job.status,
      storeId: job.storeId
    }));
}

function storageFailures(assets: OpenAIAssetRecord[]) {
  return assets
    .filter((asset) => asset.storageStatus === "failed" || asset.status === "storage_failed")
    .sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt))
    .slice(0, 10)
    .map((asset) => ({
      assetType: asset.assetType,
      errorCode: asset.errorCode,
      errorMessage: sanitizeOpenAIJobError(asset.safeErrorMessage),
      jobId: asset.jobId,
      observedAt: asset.createdAt,
      status: asset.status,
      storeId: asset.storeId
    }));
}

function incidentStatus(incidents: OpenAIProductionIncident[]): OpenAIProductionStatus {
  if (!incidents.length) {
    return "healthy";
  }

  if (incidents.some((incident) => incident.severity === "critical")) {
    return "critical";
  }

  return "degraded";
}

function detectIncidents({
  chargedCredits,
  completedJobs,
  creditFailures,
  exportFailures,
  exportsReady,
  failedJobs,
  failureRate,
  providerErrorCount,
  queuedJobs,
  runningJobs,
  staleQueueJobs,
  staleRunningJobs,
  storageFailureCount,
  storedAssets,
  totalAssets,
  totalOpenAIJobs
}: {
  chargedCredits: number;
  completedJobs: number;
  creditFailures: number;
  exportFailures: number;
  exportsReady: number;
  failedJobs: number;
  failureRate: number;
  providerErrorCount: number;
  queuedJobs: number;
  runningJobs: number;
  staleQueueJobs: number;
  staleRunningJobs: number;
  storageFailureCount: number;
  storedAssets: number;
  totalAssets: number;
  totalOpenAIJobs: number;
}) {
  const detectedAt = new Date().toISOString();
  const incidents: OpenAIProductionIncident[] = [];
  const assetTotal = Math.max(totalAssets, storedAssets + storageFailureCount);
  const exportTotal = exportsReady + exportFailures;

  if (totalOpenAIJobs >= 5 && failureRate >= 25) {
    incidents.push({
      detectedAt,
      evidence: { failedJobs, failureRate, totalOpenAIJobs },
      message: "OpenAI job failure rate is above the production threshold.",
      severity: failureRate >= 50 ? "critical" : "high",
      type: "high_failure_rate"
    });
  }

  if (staleQueueJobs > 0) {
    incidents.push({
      detectedAt,
      evidence: { queuedJobs, staleQueueJobs },
      message: "OpenAI queue contains jobs older than the stale queue threshold.",
      severity: staleQueueJobs >= 3 ? "high" : "medium",
      type: "stale_queue"
    });
  }

  if (staleRunningJobs > 0) {
    incidents.push({
      detectedAt,
      evidence: { runningJobs, staleRunningJobs },
      message: "OpenAI jobs appear stuck in running state.",
      severity: staleRunningJobs >= 2 ? "critical" : "high",
      type: "stuck_running_jobs"
    });
  }

  if (assetTotal >= 3 && rate(storageFailureCount, assetTotal) >= 20) {
    incidents.push({
      detectedAt,
      evidence: { assetTotal, storageFailureRate: rate(storageFailureCount, assetTotal), storageFailureCount },
      message: "OpenAI asset storage failures are above the production threshold.",
      severity: storageFailureCount >= 3 ? "critical" : "high",
      type: "storage_failure_spike"
    });
  }

  if ((queuedJobs + runningJobs) === 0 && chargedCredits > 0 && completedJobs === 0) {
    incidents.push({
      detectedAt,
      evidence: { chargedCredits, completedJobs, queuedJobs, runningJobs },
      message: "OpenAI credit charges exist without completed jobs in the selected window.",
      severity: "high",
      type: "credit_mismatch"
    });
  }

  if (creditFailures >= 3) {
    incidents.push({
      detectedAt,
      evidence: { creditFailures },
      message: "OpenAI credit runtime has repeated failed or blocked operations.",
      severity: "high",
      type: "credit_mismatch"
    });
  }

  if (providerErrorCount >= 3) {
    incidents.push({
      detectedAt,
      evidence: { providerErrorCount },
      message: "OpenAI provider errors are repeating in the error center.",
      severity: providerErrorCount >= 5 ? "critical" : "high",
      type: "repeated_provider_errors"
    });
  }

  if (exportTotal >= 3 && rate(exportFailures, exportTotal) >= 20) {
    incidents.push({
      detectedAt,
      evidence: { exportFailureRate: rate(exportFailures, exportTotal), exportFailures, exportTotal },
      message: "OpenAI export preparation failures are above the production threshold.",
      severity: exportFailures >= 3 ? "critical" : "high",
      type: "export_failure_spike"
    });
  }

  return incidents;
}

async function recordMonitoringAudit(snapshot: OpenAIProductionMonitoringSnapshot) {
  await recordAiAuditLog({
    eventType: "openai_production_monitoring_loaded",
    providerKey: "openai",
    safeSummary: {
      dateRange: snapshot.dateRange,
      incidentCount: snapshot.incidents.length,
      status: snapshot.status,
      totalOpenAIJobs: snapshot.metrics.totalOpenAIJobs
    },
    status: snapshot.status === "critical" ? "failed" : "success"
  });

  for (const incident of snapshot.incidents.slice(0, 10)) {
    await recordAiAuditLog({
      errorCode: incident.type,
      errorMessage: incident.message,
      eventType: "openai_incident_detected",
      providerKey: "openai",
      safeSummary: {
        dateRange: snapshot.dateRange,
        evidence: incident.evidence,
        incidentType: incident.type,
        severity: incident.severity
      },
      status: incident.severity === "critical" ? "failed" : "blocked"
    });
  }
}

export async function getOpenAIProductionMonitoringSnapshot({
  audit = true,
  dateRange
}: {
  audit?: boolean;
  dateRange?: OpenAIProductionDateRange | null;
} = {}): Promise<OpenAIProductionMonitoringSnapshot> {
  const safeRange = safeDateRange(dateRange);
  const queueRange = queueDateRange(safeRange);
  const [
    queueSnapshot,
    errorSnapshot,
    creditSnapshot,
    assetSnapshot
  ] = await Promise.all([
    getAIQueueMonitoringSnapshot({
      dateRange: queueRange,
      provider: "openai-image"
    }),
    getAIErrorCenterSnapshot({
      dateRange: queueRange,
      errorGroup: "all",
      provider: "openai-image",
      severity: "all",
      storeId: "all"
    }),
    getOpenAICreditRuntimeSnapshot(),
    getOpenAIAssetRuntimeSnapshot()
  ]);
  const openAIJobs = queueSnapshot.jobs.filter((job) => isOpenAIProvider(job.provider));
  const durations = openAIJobs
    .map((job) => job.durationMs)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const completedJobs = openAIJobs.filter((job) => job.status === "completed").length;
  const failedJobs = openAIJobs.filter((job) => job.status === "failed" || job.status === "timeout" || job.staleState !== "fresh").length;
  const queuedJobs = openAIJobs.filter((job) => job.status === "queued" || job.status === "retry_pending").length;
  const runningJobs = openAIJobs.filter((job) => job.status === "running").length;
  const staleQueueJobs = openAIJobs.filter((job) => job.staleState === "stale_queue").length;
  const staleRunningJobs = openAIJobs.filter((job) => job.staleState === "stale_running").length;
  const staleJobs = staleQueueJobs + staleRunningJobs;
  const providerErrors = errorSnapshot.errors.filter((error) =>
    isOpenAIProvider(error.provider) && (error.errorGroup === "PROVIDER_ERROR" || error.errorCode?.toLowerCase().includes("provider"))
  );
  const metrics = {
    assetsGenerated: assetSnapshot.generatedAssets,
    assetsStored: assetSnapshot.storedAssets,
    averageDurationMs: average(durations),
    completedJobs,
    creditFailures: creditSnapshot.failedOperations,
    creditsCharged: creditSnapshot.chargedCredits,
    creditsRefunded: creditSnapshot.refundedCredits,
    creditsReserved: creditSnapshot.reservedCredits,
    exportFailures: assetSnapshot.exportFailed,
    exportsReady: assetSnapshot.exportReady,
    failedJobs,
    failureRate: rate(failedJobs, openAIJobs.length),
    p95DurationMs: percentile(durations, 95),
    queuedJobs,
    runningJobs,
    staleJobs,
    storageFailures: assetSnapshot.storageFailures,
    successRate: rate(completedJobs, openAIJobs.length),
    totalOpenAIJobs: openAIJobs.length
  };
  const incidents = detectIncidents({
    chargedCredits: metrics.creditsCharged,
    completedJobs,
    creditFailures: metrics.creditFailures,
    exportFailures: metrics.exportFailures,
    exportsReady: metrics.exportsReady,
    failedJobs,
    failureRate: metrics.failureRate,
    providerErrorCount: providerErrors.reduce((total, error) => total + Math.max(1, error.occurrences), 0),
    queuedJobs,
    runningJobs,
    staleQueueJobs,
    staleRunningJobs,
    storageFailureCount: metrics.storageFailures,
    storedAssets: metrics.assetsStored,
    totalAssets: assetSnapshot.totalAssets,
    totalOpenAIJobs: metrics.totalOpenAIJobs
  });
  const snapshot: OpenAIProductionMonitoringSnapshot = {
    dateRange: safeRange,
    generatedAt: new Date().toISOString(),
    incidents,
    metrics,
    queueDateRange: queueRange,
    recentFailedJobs: latestFailures(openAIJobs),
    recentStorageFailures: storageFailures(assetSnapshot.recentAssets),
    status: openAIJobs.length || creditSnapshot.totalEntries || assetSnapshot.totalAssets
      ? incidentStatus(incidents)
      : "unknown"
  };

  if (audit) {
    await recordMonitoringAudit(snapshot);
  }

  return snapshot;
}
