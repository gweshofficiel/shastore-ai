import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import {
  buildEmailQueueStatusSummaryFromLogsSafe,
  type EmailQueueStatusSummary
} from "@/src/lib/email/email-status-runtime";

type EmailQueueRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
};

export type EmailQueueRuntimeState =
  | "cancelled"
  | "failed"
  | "paused"
  | "processing"
  | "queued"
  | "retry_pending"
  | "sent"
  | "unknown";

export type EmailQueueLogSnapshot = {
  created_at?: string | null;
  status?: string | null;
};

export type EmailQueueRuntimeSummary = {
  cancelledCount: number;
  failedCount: number;
  lastActivityLabel: string;
  metadataSummary: string;
  pausedCount: number;
  processingCount: number;
  queuedCount: number;
  retryPendingCount: number;
  sentCount: number;
  totalCount: number;
  unknownCount: number;
};

export type EmailQueueRuntimeStats = {
  cancelledQueueItems: number;
  failedQueueItems: number;
  pausedQueueItems: number;
  processingQueueItems: number;
  queuedQueueItems: number;
  retryPendingQueueItems: number;
  sentQueueItems: number;
  totalQueueItems: number;
  unknownQueueItems: number;
};

export const EMAIL_QUEUE_RUNTIME_STATES: readonly EmailQueueRuntimeState[] = [
  "queued",
  "sent",
  "failed",
  "retry_pending",
  "cancelled",
  "processing",
  "paused",
  "unknown"
] as const;

const queueStateLabels: Record<EmailQueueRuntimeState, string> = {
  cancelled: "Cancelled queue entries",
  failed: "Failed queue entries",
  paused: "Paused queue entries",
  processing: "Processing queue entries",
  queued: "Queued entries",
  retry_pending: "Retry pending entries",
  sent: "Sent entries",
  unknown: "Unknown queue entries"
};

const queueStateDescriptions: Record<EmailQueueRuntimeState, string> = {
  cancelled: "Cancelled queue entries shown from read-only email event logs. No queue execution connected.",
  failed: "Failed queue entries shown from read-only email event logs. No retry execution connected.",
  paused: "Paused queue entries shown from read-only email event logs. No queue processing connected.",
  processing:
    "Processing queue entries shown from read-only email event logs. No queue worker or processor connected.",
  queued: "Queued entries shown from read-only email event logs. No queue execution connected.",
  retry_pending: "Retry pending entries shown from read-only email event logs. No retry execution connected.",
  sent: "Sent entries shown from read-only email event logs. No email sending connected from Email Center page load.",
  unknown: "Queue entries with unknown status shown safely from read-only email event logs."
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

export function getEmailQueueRuntimeStateLabel(state: EmailQueueRuntimeState) {
  return queueStateLabels[state];
}

export function getEmailQueueRuntimeStateDescription(state: EmailQueueRuntimeState) {
  return queueStateDescriptions[state];
}

export function parseEmailQueueRuntimeStateSafe(value: unknown): EmailQueueRuntimeState {
  const cleaned = text(value, 80).toLowerCase();

  if (!cleaned) {
    return "unknown";
  }

  if (cleaned === "pending" || cleaned === "queued") {
    return "queued";
  }

  if (["processing", "running", "in_progress", "in-progress", "delivering"].includes(cleaned)) {
    return "processing";
  }

  if (["paused", "on_hold", "on-hold", "hold"].includes(cleaned)) {
    return "paused";
  }

  if (cleaned === "retry_pending" || cleaned === "retry-pending" || cleaned === "retry") {
    return "retry_pending";
  }

  if (
    cleaned === "sent" ||
    cleaned === "delivered" ||
    cleaned === "completed" ||
    cleaned === "success"
  ) {
    return "sent";
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    return "failed";
  }

  if (cleaned === "cancelled" || cleaned === "canceled") {
    return "cancelled";
  }

  if (EMAIL_QUEUE_RUNTIME_STATES.includes(cleaned as EmailQueueRuntimeState)) {
    return cleaned as EmailQueueRuntimeState;
  }

  return "unknown";
}

function resolveLastActivityLabelSafe(logs: EmailQueueLogSnapshot[]) {
  const latestTimestamp = logs
    .map((log) => text(log.created_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  if (!latestTimestamp) {
    return "No queue activity recorded";
  }

  const parsed = new Date(latestTimestamp);

  if (!Number.isFinite(parsed.getTime())) {
    return "Queue activity timestamp unavailable";
  }

  return `Last activity ${parsed.toISOString().slice(0, 10)}`;
}

function resolveQueueMetadataSummary(
  registryNote: string | null,
  registryDescription: string | null,
  baseSummary: EmailQueueStatusSummary
) {
  if (registryNote) {
    return `${registryNote} Email queue readiness foundation only.`;
  }

  if (registryDescription) {
    return registryDescription;
  }

  const total =
    baseSummary.queued +
    baseSummary.sent +
    baseSummary.failed +
    baseSummary.retryPending +
    baseSummary.cancelled;

  if (!total) {
    return "Read-only queue summary foundation. Counts are computed from email event logs. No queue execution connected.";
  }

  return "Read-only queue summary from email event logs. No queue execution, retry, or sending connected.";
}

function countQueueStates(logs: EmailQueueLogSnapshot[]) {
  const counts: Record<EmailQueueRuntimeState, number> = {
    cancelled: 0,
    failed: 0,
    paused: 0,
    processing: 0,
    queued: 0,
    retry_pending: 0,
    sent: 0,
    unknown: 0
  };

  for (const log of logs) {
    const state = parseEmailQueueRuntimeStateSafe(log.status);
    counts[state] += 1;
  }

  return counts;
}

export function buildEmailQueueRuntimeSummarySafe(
  logs: EmailQueueLogSnapshot[] | null | undefined,
  registryItems?: EmailQueueRegistryItem[] | null
): EmailQueueRuntimeSummary {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const baseSummary = buildEmailQueueStatusSummaryFromLogsSafe(snapshots);
    const stateCounts = countQueueStates(snapshots);
    const queueSection = filterEmailRegistryItemsByType(registryItems ?? [], "queue_summary").find(
      (item) => text(item.slug, 80) === "queue-summary-foundation" || text(item.registryKey, 80).startsWith("queue-summary:")
    );
    const registryNote =
      text(queueSection?.metadata?.note, 500) ||
      text(queueSection?.description, 500) ||
      null;
    const registryDescription = text(queueSection?.description, 500) || null;

    const queuedCount = stateCounts.queued || baseSummary.queued;
    const sentCount = stateCounts.sent || baseSummary.sent;
    const failedCount = stateCounts.failed || baseSummary.failed;
    const retryPendingCount = stateCounts.retry_pending || baseSummary.retryPending;
    const cancelledCount = stateCounts.cancelled || baseSummary.cancelled;
    const processingCount = stateCounts.processing;
    const pausedCount = stateCounts.paused;
    const unknownCount = stateCounts.unknown;
    const totalCount =
      queuedCount +
      sentCount +
      failedCount +
      retryPendingCount +
      cancelledCount +
      processingCount +
      pausedCount +
      unknownCount;

    return {
      cancelledCount,
      failedCount,
      lastActivityLabel: resolveLastActivityLabelSafe(snapshots),
      metadataSummary: resolveQueueMetadataSummary(registryNote, registryDescription, baseSummary),
      pausedCount,
      processingCount,
      queuedCount,
      retryPendingCount,
      sentCount,
      totalCount,
      unknownCount
    };
  } catch (error) {
    console.error("[email-queue-runtime] queue runtime summary build failed", error);

    return {
      cancelledCount: 0,
      failedCount: 0,
      lastActivityLabel: "Queue activity unavailable",
      metadataSummary: "Email queue readiness foundation could not be resolved safely.",
      pausedCount: 0,
      processingCount: 0,
      queuedCount: 0,
      retryPendingCount: 0,
      sentCount: 0,
      totalCount: 0,
      unknownCount: 0
    };
  }
}

export function buildEmailQueueRuntimeStatsSafe(
  logs: EmailQueueLogSnapshot[] | null | undefined,
  registryItems?: EmailQueueRegistryItem[] | null
): EmailQueueRuntimeStats {
  try {
    const summary = buildEmailQueueRuntimeSummarySafe(logs, registryItems);

    return {
      cancelledQueueItems: summary.cancelledCount,
      failedQueueItems: summary.failedCount,
      pausedQueueItems: summary.pausedCount,
      processingQueueItems: summary.processingCount,
      queuedQueueItems: summary.queuedCount,
      retryPendingQueueItems: summary.retryPendingCount,
      sentQueueItems: summary.sentCount,
      totalQueueItems: summary.totalCount,
      unknownQueueItems: summary.unknownCount
    };
  } catch (error) {
    console.error("[email-queue-runtime] queue runtime stats build failed", error);

    return {
      cancelledQueueItems: 0,
      failedQueueItems: 0,
      pausedQueueItems: 0,
      processingQueueItems: 0,
      queuedQueueItems: 0,
      retryPendingQueueItems: 0,
      sentQueueItems: 0,
      totalQueueItems: 0,
      unknownQueueItems: 0
    };
  }
}

export function listEmailQueueRuntimeCatalog() {
  return EMAIL_QUEUE_RUNTIME_STATES.map((queueState) => ({
    description: getEmailQueueRuntimeStateDescription(queueState),
    label: getEmailQueueRuntimeStateLabel(queueState),
    queueState
  }));
}
