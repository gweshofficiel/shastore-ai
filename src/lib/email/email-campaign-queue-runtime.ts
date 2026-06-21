import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import { resolveEmailProviderStatusSafe } from "@/src/lib/email/email-provider-runtime";
import {
  parseEmailQueueRuntimeStateSafe,
  type EmailQueueLogSnapshot
} from "@/src/lib/email/email-queue-runtime";

type EmailCampaignQueueRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  name?: string | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
  status?: string | null;
};

export type EmailCampaignQueueLogSnapshot = EmailQueueLogSnapshot & {
  subject?: string | null;
  template_key?: string | null;
};

export type StoreMarketingMessageSnapshot = {
  created_at?: string | null;
  status?: string | null;
  type?: string | null;
  updated_at?: string | null;
};

export type EmailCampaignQueueReadinessState =
  | "cancelled"
  | "failed"
  | "needs_review"
  | "paused"
  | "processing"
  | "queue_ready"
  | "queued"
  | "retry_pending"
  | "sent"
  | "unknown";

export type EmailCampaignQueueScopeRecord = {
  campaignScopeLabel: string;
  campaignScopeSlug: string;
  cancelledCount: number;
  failedCount: number;
  lastActivityLabel: string;
  metadataSummary: string;
  pausedCount: number;
  processingCount: number;
  queuedCount: number;
  queueReadinessState: EmailCampaignQueueReadinessState;
  queueReadinessStateLabel: string;
  retryPendingCount: number;
  sentCount: number;
};

export type EmailCampaignQueueRuntimeSummary = {
  campaignCancelledCount: number;
  campaignFailedCount: number;
  campaignQueuedCount: number;
  campaignRetryPendingCount: number;
  campaignSentCount: number;
  lastActivityLabel: string;
  metadataSummary: string;
  pausedCount: number;
  processingCount: number;
  queueReadinessState: EmailCampaignQueueReadinessState;
  queueReadinessStateLabel: string;
  totalCount: number;
  unknownCount: number;
};

export type EmailCampaignQueueRuntimeStats = {
  cancelledCampaignQueueItems: number;
  failedCampaignQueueItems: number;
  needsReviewCampaignQueueItems: number;
  pausedCampaignQueueItems: number;
  processingCampaignQueueItems: number;
  queueReadyCampaignQueueItems: number;
  queuedCampaignQueueItems: number;
  retryPendingCampaignQueueItems: number;
  sentCampaignQueueItems: number;
  totalCampaignQueueItems: number;
  unknownCampaignQueueItems: number;
};

export const EMAIL_CAMPAIGN_QUEUE_READINESS_STATES: readonly EmailCampaignQueueReadinessState[] = [
  "queue_ready",
  "queued",
  "processing",
  "paused",
  "sent",
  "failed",
  "retry_pending",
  "cancelled",
  "needs_review",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailCampaignQueueReadinessState, string> = {
  cancelled: "Campaign queue cancelled",
  failed: "Campaign queue failed entries",
  needs_review: "Campaign queue needs review",
  paused: "Campaign queue paused",
  processing: "Campaign queue processing",
  queue_ready: "Campaign queue ready",
  queued: "Campaign queue entries pending",
  retry_pending: "Campaign queue retry pending",
  sent: "Campaign queue sent entries",
  unknown: "Unknown campaign queue readiness"
};

const readinessStateDescriptions: Record<EmailCampaignQueueReadinessState, string> = {
  cancelled:
    "Cancelled campaign queue entries shown from read-only foundation data. No campaign queue execution connected.",
  failed:
    "Failed campaign queue entries shown from read-only foundation data. No campaign sending or retry execution connected.",
  needs_review:
    "Campaign queue foundation requires admin review. No campaign queue execution, sending, or processing connected.",
  paused:
    "Paused campaign queue entries shown from read-only foundation data. No campaign queue processing connected.",
  processing:
    "Processing campaign queue entries shown from read-only foundation data. No campaign queue worker connected.",
  queue_ready:
    "Campaign queue readiness foundation looks complete. No campaign queue execution, sending, or mass sending connected.",
  queued:
    "Queued campaign entries shown from read-only foundation data. No campaign queue execution connected.",
  retry_pending:
    "Retry pending campaign queue entries shown from read-only foundation data. No retry execution connected.",
  sent: "Sent campaign queue entries shown from read-only foundation data. No campaign sending connected from Email Center page load.",
  unknown: "Campaign queue readiness could not be resolved safely."
};

type CampaignQueueCounts = {
  cancelledCount: number;
  failedCount: number;
  pausedCount: number;
  processingCount: number;
  queuedCount: number;
  retryPendingCount: number;
  sentCount: number;
  unknownCount: number;
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyCounts(): CampaignQueueCounts {
  return {
    cancelledCount: 0,
    failedCount: 0,
    pausedCount: 0,
    processingCount: 0,
    queuedCount: 0,
    retryPendingCount: 0,
    sentCount: 0,
    unknownCount: 0
  };
}

function sumCounts(left: CampaignQueueCounts, right: CampaignQueueCounts): CampaignQueueCounts {
  return {
    cancelledCount: left.cancelledCount + right.cancelledCount,
    failedCount: left.failedCount + right.failedCount,
    pausedCount: left.pausedCount + right.pausedCount,
    processingCount: left.processingCount + right.processingCount,
    queuedCount: left.queuedCount + right.queuedCount,
    retryPendingCount: left.retryPendingCount + right.retryPendingCount,
    sentCount: left.sentCount + right.sentCount,
    unknownCount: left.unknownCount + right.unknownCount
  };
}

function totalFromCounts(counts: CampaignQueueCounts) {
  return (
    counts.queuedCount +
    counts.sentCount +
    counts.failedCount +
    counts.retryPendingCount +
    counts.cancelledCount +
    counts.processingCount +
    counts.pausedCount +
    counts.unknownCount
  );
}

function resolvePlatformProviderReady() {
  const resendStatus = resolveEmailProviderStatusSafe("resend");
  return resendStatus.configurationStatus === "configured" && resendStatus.healthStatus === "healthy";
}

export function getEmailCampaignQueueReadinessStateLabel(state: EmailCampaignQueueReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailCampaignQueueReadinessStateDescription(state: EmailCampaignQueueReadinessState) {
  return readinessStateDescriptions[state];
}

export function isCampaignEmailLogSafe(log: EmailCampaignQueueLogSnapshot) {
  const templateKey = text(log.template_key, 160).toLowerCase();
  const subject = text(log.subject, 200).toLowerCase();

  return templateKey.includes("campaign") || subject.includes("campaign email");
}

function countCampaignQueueStates(logs: EmailCampaignQueueLogSnapshot[]): CampaignQueueCounts {
  const counts = emptyCounts();

  for (const log of logs) {
    const state = parseEmailQueueRuntimeStateSafe(log.status);

    switch (state) {
      case "queued":
        counts.queuedCount += 1;
        break;
      case "processing":
        counts.processingCount += 1;
        break;
      case "paused":
        counts.pausedCount += 1;
        break;
      case "sent":
        counts.sentCount += 1;
        break;
      case "failed":
        counts.failedCount += 1;
        break;
      case "retry_pending":
        counts.retryPendingCount += 1;
        break;
      case "cancelled":
        counts.cancelledCount += 1;
        break;
      default:
        counts.unknownCount += 1;
    }
  }

  return counts;
}

function countStoreOwnerCampaignQueueStates(messages: StoreMarketingMessageSnapshot[]): CampaignQueueCounts {
  const counts = emptyCounts();

  for (const message of messages) {
    const status = text(message.status, 40).toLowerCase();

    if (status === "draft") {
      counts.queuedCount += 1;
      continue;
    }

    if (status === "active") {
      counts.sentCount += 1;
      continue;
    }

    if (status === "disabled") {
      counts.cancelledCount += 1;
      continue;
    }

    counts.unknownCount += 1;
  }

  return counts;
}

function resolveLastActivityLabelSafe(
  logs: EmailCampaignQueueLogSnapshot[],
  messages: StoreMarketingMessageSnapshot[]
) {
  const latestLogTimestamp = logs
    .map((log) => text(log.created_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  const latestMessageTimestamp = messages
    .map((message) => text(message.updated_at, 80) || text(message.created_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  const candidates = [latestLogTimestamp, latestMessageTimestamp].filter(Boolean);
  const latestTimestamp = candidates.sort((left, right) => dateValue(right) - dateValue(left))[0];

  if (!latestTimestamp) {
    return "No campaign queue activity recorded";
  }

  const parsed = new Date(latestTimestamp);
  if (!Number.isFinite(parsed.getTime())) {
    return "Campaign queue activity timestamp unavailable";
  }

  return `Last activity ${parsed.toISOString().slice(0, 10)}`;
}

function resolveScopeLastActivityLabel(
  slug: string,
  logs: EmailCampaignQueueLogSnapshot[],
  messages: StoreMarketingMessageSnapshot[],
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number }
) {
  const totals = resolveCampaignTotals?.(slug);
  if (totals?.lastActivity) {
    const parsed = new Date(totals.lastActivity);
    if (Number.isFinite(parsed.getTime())) {
      return `Last activity ${parsed.toISOString().slice(0, 10)}`;
    }
  }

  if (slug === "store-owner-campaigns") {
    const latestMessageTimestamp = messages
      .map((message) => text(message.updated_at, 80) || text(message.created_at, 80))
      .filter(Boolean)
      .sort((left, right) => dateValue(right) - dateValue(left))[0];

    if (latestMessageTimestamp) {
      const parsed = new Date(latestMessageTimestamp);
      if (Number.isFinite(parsed.getTime())) {
        return `Last activity ${parsed.toISOString().slice(0, 10)}`;
      }
    }
  }

  if (slug === "platform-campaigns") {
    const latestLogTimestamp = logs
      .map((log) => text(log.created_at, 80))
      .filter(Boolean)
      .sort((left, right) => dateValue(right) - dateValue(left))[0];

    if (latestLogTimestamp) {
      const parsed = new Date(latestLogTimestamp);
      if (Number.isFinite(parsed.getTime())) {
        return `Last activity ${parsed.toISOString().slice(0, 10)}`;
      }
    }
  }

  return "No campaign queue activity recorded";
}

export function resolveEmailCampaignQueueAggregateStateSafe(params: {
  cancelledCount: number;
  failedCount: number;
  hasNeedsReviewScope: boolean;
  pausedCount: number;
  processingCount: number;
  providerReady: boolean;
  queuedCount: number;
  retryPendingCount: number;
  scopeNeedsReview: boolean;
  sentCount: number;
  totalCount: number;
}): EmailCampaignQueueReadinessState {
  const {
    cancelledCount,
    failedCount,
    hasNeedsReviewScope,
    pausedCount,
    processingCount,
    providerReady,
    queuedCount,
    retryPendingCount,
    scopeNeedsReview,
    sentCount,
    totalCount
  } = params;

  if (processingCount > 0) {
    return "processing";
  }

  if (retryPendingCount > 0) {
    return "retry_pending";
  }

  if (queuedCount > 0) {
    return "queued";
  }

  if (failedCount > 0) {
    return "failed";
  }

  if (pausedCount > 0) {
    return "paused";
  }

  if (scopeNeedsReview || hasNeedsReviewScope) {
    return "needs_review";
  }

  if (cancelledCount > 0 && totalCount > 0 && cancelledCount === totalCount) {
    return "cancelled";
  }

  if (sentCount > 0) {
    return "sent";
  }

  if (totalCount === 0 && providerReady) {
    return "queue_ready";
  }

  if (totalCount === 0 && !providerReady) {
    return "needs_review";
  }

  if (providerReady) {
    return "queue_ready";
  }

  return "unknown";
}

function resolveScopeQueueStateSafe(params: {
  counts: CampaignQueueCounts;
  providerReady: boolean;
  registryStatus: string;
}): EmailCampaignQueueReadinessState {
  const totalCount = totalFromCounts(params.counts);
  const scopeNeedsReview = params.registryStatus === "placeholder";

  return resolveEmailCampaignQueueAggregateStateSafe({
    cancelledCount: params.counts.cancelledCount,
    failedCount: params.counts.failedCount,
    hasNeedsReviewScope: scopeNeedsReview,
    pausedCount: params.counts.pausedCount,
    processingCount: params.counts.processingCount,
    providerReady: params.providerReady,
    queuedCount: params.counts.queuedCount,
    retryPendingCount: params.counts.retryPendingCount,
    scopeNeedsReview,
    sentCount: params.counts.sentCount,
    totalCount
  });
}

function buildScopeMetadataSummary(
  registry: EmailCampaignQueueRegistryItem,
  readinessState: EmailCampaignQueueReadinessState,
  totalCount: number
) {
  const note = text(registry.metadata?.note, 500) || text(registry.description, 500);
  const countSummary =
    totalCount > 0
      ? `Read-only campaign queue summary count ${totalCount}.`
      : "Read-only campaign queue summary foundation only.";

  if (note) {
    return `${note} ${countSummary} Campaign queue readiness foundation only.`;
  }

  return `${readinessStateDescriptions[readinessState]} ${countSummary}`;
}

function resolveScopeCounts(
  slug: string,
  campaignLogs: EmailCampaignQueueLogSnapshot[],
  storeMarketingMessages: StoreMarketingMessageSnapshot[]
): CampaignQueueCounts {
  if (slug === "store-owner-campaigns") {
    return countStoreOwnerCampaignQueueStates(storeMarketingMessages);
  }

  if (slug === "platform-campaigns") {
    return countCampaignQueueStates(campaignLogs);
  }

  return emptyCounts();
}

export function buildEmailCampaignQueueScopeRecordsSafe(
  registryItems: EmailCampaignQueueRegistryItem[] | null | undefined,
  logs: EmailCampaignQueueLogSnapshot[] | null | undefined,
  storeMarketingMessages?: StoreMarketingMessageSnapshot[] | null,
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number }
): EmailCampaignQueueScopeRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const campaignScopes = filterEmailRegistryItemsByType(items, "campaign_scope");
    const snapshots = Array.isArray(logs) ? logs : [];
    const campaignLogs = snapshots.filter(isCampaignEmailLogSafe);
    const messages = Array.isArray(storeMarketingMessages) ? storeMarketingMessages : [];
    const providerReady = resolvePlatformProviderReady();

    if (!campaignScopes.length) {
      return [];
    }

    return campaignScopes.map((registry) => {
      const slug = text(registry.slug, 160) || text(registry.registryKey, 160) || "campaign-scope";
      const registryStatus = text(registry.status, 80) || "unknown";
      const counts = resolveScopeCounts(slug, campaignLogs, messages);
      const queueReadinessState = resolveScopeQueueStateSafe({
        counts,
        providerReady,
        registryStatus
      });
      const totalCount = totalFromCounts(counts);

      return {
        campaignScopeLabel: text(registry.name, 200) || "Campaign scope",
        campaignScopeSlug: slug,
        cancelledCount: counts.cancelledCount,
        failedCount: counts.failedCount,
        lastActivityLabel: resolveScopeLastActivityLabel(slug, campaignLogs, messages, resolveCampaignTotals),
        metadataSummary: buildScopeMetadataSummary(registry, queueReadinessState, totalCount),
        pausedCount: counts.pausedCount,
        processingCount: counts.processingCount,
        queuedCount: counts.queuedCount,
        queueReadinessState,
        queueReadinessStateLabel: getEmailCampaignQueueReadinessStateLabel(queueReadinessState),
        retryPendingCount: counts.retryPendingCount,
        sentCount: counts.sentCount
      };
    });
  } catch (error) {
    console.error("[email-campaign-queue-runtime] campaign queue scope records build failed", error);
    return [];
  }
}

export function buildEmailCampaignQueueRuntimeSummarySafe(
  logs: EmailCampaignQueueLogSnapshot[] | null | undefined,
  registryItems?: EmailCampaignQueueRegistryItem[] | null,
  storeMarketingMessages?: StoreMarketingMessageSnapshot[] | null,
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number }
): EmailCampaignQueueRuntimeSummary {
  try {
    const scopeRecords = buildEmailCampaignQueueScopeRecordsSafe(
      registryItems,
      logs,
      storeMarketingMessages,
      resolveCampaignTotals
    );
    const queueSection = filterEmailRegistryItemsByType(registryItems ?? [], "queue_summary").find(
      (item) =>
        text(item.slug, 80) === "queue-summary-foundation" ||
        text(item.registryKey, 80).startsWith("queue-summary:")
    );
    const registryNote =
      text(queueSection?.metadata?.note, 500) ||
      text(queueSection?.description, 500) ||
      null;
    const providerReady = resolvePlatformProviderReady();

    const aggregateCounts = scopeRecords.reduce<CampaignQueueCounts>(
      (accumulator, record) =>
        sumCounts(accumulator, {
          cancelledCount: record.cancelledCount,
          failedCount: record.failedCount,
          pausedCount: record.pausedCount,
          processingCount: record.processingCount,
          queuedCount: record.queuedCount,
          retryPendingCount: record.retryPendingCount,
          sentCount: record.sentCount,
          unknownCount: 0
        }),
      emptyCounts()
    );

    const snapshots = Array.isArray(logs) ? logs : [];
    const campaignLogs = snapshots.filter(isCampaignEmailLogSafe);
    const messages = Array.isArray(storeMarketingMessages) ? storeMarketingMessages : [];
    const hasNeedsReviewScope = scopeRecords.some((record) => record.queueReadinessState === "needs_review");
    const totalCount = totalFromCounts(aggregateCounts);
    const queueReadinessState = resolveEmailCampaignQueueAggregateStateSafe({
      cancelledCount: aggregateCounts.cancelledCount,
      failedCount: aggregateCounts.failedCount,
      hasNeedsReviewScope,
      pausedCount: aggregateCounts.pausedCount,
      processingCount: aggregateCounts.processingCount,
      providerReady,
      queuedCount: aggregateCounts.queuedCount,
      retryPendingCount: aggregateCounts.retryPendingCount,
      scopeNeedsReview: false,
      sentCount: aggregateCounts.sentCount,
      totalCount
    });

    const metadataSummary = registryNote
      ? `${registryNote} Campaign queue readiness foundation only.`
      : readinessStateDescriptions[queueReadinessState];

    return {
      campaignCancelledCount: aggregateCounts.cancelledCount,
      campaignFailedCount: aggregateCounts.failedCount,
      campaignQueuedCount: aggregateCounts.queuedCount,
      campaignRetryPendingCount: aggregateCounts.retryPendingCount,
      campaignSentCount: aggregateCounts.sentCount,
      lastActivityLabel: resolveLastActivityLabelSafe(campaignLogs, messages),
      metadataSummary,
      pausedCount: aggregateCounts.pausedCount,
      processingCount: aggregateCounts.processingCount,
      queueReadinessState,
      queueReadinessStateLabel: getEmailCampaignQueueReadinessStateLabel(queueReadinessState),
      totalCount,
      unknownCount: aggregateCounts.unknownCount
    };
  } catch (error) {
    console.error("[email-campaign-queue-runtime] campaign queue runtime summary build failed", error);

    return {
      campaignCancelledCount: 0,
      campaignFailedCount: 0,
      campaignQueuedCount: 0,
      campaignRetryPendingCount: 0,
      campaignSentCount: 0,
      lastActivityLabel: "Campaign queue activity unavailable",
      metadataSummary: "Campaign queue readiness foundation could not be resolved safely.",
      pausedCount: 0,
      processingCount: 0,
      queueReadinessState: "unknown",
      queueReadinessStateLabel: getEmailCampaignQueueReadinessStateLabel("unknown"),
      totalCount: 0,
      unknownCount: 0
    };
  }
}

export function buildEmailCampaignQueueRuntimeStatsSafe(
  logs: EmailCampaignQueueLogSnapshot[] | null | undefined,
  registryItems?: EmailCampaignQueueRegistryItem[] | null,
  storeMarketingMessages?: StoreMarketingMessageSnapshot[] | null,
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number }
): EmailCampaignQueueRuntimeStats {
  try {
    const scopeRecords = buildEmailCampaignQueueScopeRecordsSafe(
      registryItems,
      logs,
      storeMarketingMessages,
      resolveCampaignTotals
    );
    const summary = buildEmailCampaignQueueRuntimeSummarySafe(
      logs,
      registryItems,
      storeMarketingMessages,
      resolveCampaignTotals
    );

    return {
      cancelledCampaignQueueItems: summary.campaignCancelledCount,
      failedCampaignQueueItems: summary.campaignFailedCount,
      needsReviewCampaignQueueItems: scopeRecords.filter((record) => record.queueReadinessState === "needs_review")
        .length,
      pausedCampaignQueueItems: summary.pausedCount,
      processingCampaignQueueItems: summary.processingCount,
      queueReadyCampaignQueueItems: scopeRecords.filter((record) => record.queueReadinessState === "queue_ready")
        .length,
      queuedCampaignQueueItems: summary.campaignQueuedCount,
      retryPendingCampaignQueueItems: summary.campaignRetryPendingCount,
      sentCampaignQueueItems: summary.campaignSentCount,
      totalCampaignQueueItems: summary.totalCount,
      unknownCampaignQueueItems: scopeRecords.filter((record) => record.queueReadinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-campaign-queue-runtime] campaign queue runtime stats build failed", error);

    return {
      cancelledCampaignQueueItems: 0,
      failedCampaignQueueItems: 0,
      needsReviewCampaignQueueItems: 0,
      pausedCampaignQueueItems: 0,
      processingCampaignQueueItems: 0,
      queueReadyCampaignQueueItems: 0,
      queuedCampaignQueueItems: 0,
      retryPendingCampaignQueueItems: 0,
      sentCampaignQueueItems: 0,
      totalCampaignQueueItems: 0,
      unknownCampaignQueueItems: 0
    };
  }
}

export function listEmailCampaignQueueReadinessCatalog() {
  return EMAIL_CAMPAIGN_QUEUE_READINESS_STATES.map((readinessState) => ({
    description: getEmailCampaignQueueReadinessStateDescription(readinessState),
    label: getEmailCampaignQueueReadinessStateLabel(readinessState),
    readinessState
  }));
}
