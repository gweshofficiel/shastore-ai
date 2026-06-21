import "server-only";

import {
  buildEmailQueueRuntimeSummarySafe,
  parseEmailQueueRuntimeStateSafe,
  type EmailQueueLogSnapshot
} from "@/src/lib/email/email-queue-runtime";

type EmailDeliveryRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
};

export type EmailDeliveryLogSnapshot = EmailQueueLogSnapshot & {
  sent_at?: string | null;
};

export type EmailDeliveryRuntimeState =
  | "cancelled"
  | "delivered"
  | "failed"
  | "queued"
  | "retry_pending"
  | "sent"
  | "unknown";

export type EmailDeliveryRuntimeSummary = {
  cancelledCount: number;
  deliveredCount: number;
  deliveryState: EmailDeliveryRuntimeState;
  deliveryStateLabel: string;
  failedCount: number;
  lastDeliveryLabel: string;
  metadataSummary: string;
  queuedCount: number;
  retryPendingCount: number;
  sentCount: number;
};

export type EmailDeliveryRuntimeStats = {
  cancelledDeliveryItems: number;
  deliveredDeliveryItems: number;
  failedDeliveryItems: number;
  queuedDeliveryItems: number;
  retryPendingDeliveryItems: number;
  sentDeliveryItems: number;
  unknownDeliveryItems: number;
};

export const EMAIL_DELIVERY_RUNTIME_STATES: readonly EmailDeliveryRuntimeState[] = [
  "delivered",
  "sent",
  "queued",
  "failed",
  "retry_pending",
  "cancelled",
  "unknown"
] as const;

const deliveryStateLabels: Record<EmailDeliveryRuntimeState, string> = {
  cancelled: "Cancelled delivery foundation",
  delivered: "Delivered delivery foundation",
  failed: "Failed delivery foundation",
  queued: "Queued delivery foundation",
  retry_pending: "Retry pending delivery foundation",
  sent: "Sent delivery foundation",
  unknown: "Unknown delivery foundation"
};

const deliveryStateDescriptions: Record<EmailDeliveryRuntimeState, string> = {
  cancelled:
    "Cancelled delivery entries shown from read-only email event logs. No delivery execution connected.",
  delivered:
    "Delivered entries shown from read-only email event logs. No delivery webhook processing or provider tracking connected.",
  failed: "Failed delivery entries shown from read-only email event logs. No delivery recovery connected.",
  queued: "Queued delivery entries shown from read-only email event logs. No queue processing connected.",
  retry_pending:
    "Retry pending delivery entries shown from read-only email event logs. No retry execution connected.",
  sent: "Sent delivery entries shown from read-only email event logs. No email delivery or provider calls connected.",
  unknown: "Delivery state could not be resolved safely from read-only foundation data."
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

function formatSafeDateLabel(value: unknown, fallback: string) {
  const raw = text(value, 80);
  if (!raw) return fallback;

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().slice(0, 10);
}

export function getEmailDeliveryRuntimeStateLabel(state: EmailDeliveryRuntimeState) {
  return deliveryStateLabels[state];
}

export function getEmailDeliveryRuntimeStateDescription(state: EmailDeliveryRuntimeState) {
  return deliveryStateDescriptions[state];
}

export function parseEmailDeliveryRuntimeStateSafe(value: unknown): EmailDeliveryRuntimeState {
  const cleaned = text(value, 80).toLowerCase();

  if (!cleaned) {
    return "unknown";
  }

  if (["delivered", "delivery_confirmed", "completed", "complete"].includes(cleaned)) {
    return "delivered";
  }

  if (cleaned === "pending" || cleaned === "queued") {
    return "queued";
  }

  if (cleaned === "retry_pending" || cleaned === "retry-pending" || cleaned === "retry") {
    return "retry_pending";
  }

  if (cleaned === "sent" || cleaned === "success" || cleaned === "succeeded") {
    return "sent";
  }

  if (cleaned === "failed" || cleaned === "error" || cleaned === "bounced") {
    return "failed";
  }

  if (cleaned === "cancelled" || cleaned === "canceled") {
    return "cancelled";
  }

  const queueState = parseEmailQueueRuntimeStateSafe(value);
  if (queueState === "queued") return "queued";
  if (queueState === "retry_pending") return "retry_pending";
  if (queueState === "sent") return "sent";
  if (queueState === "failed") return "failed";
  if (queueState === "cancelled") return "cancelled";

  return "unknown";
}

export function resolveEmailDeliveryRuntimeStateForLogSafe(log: EmailDeliveryLogSnapshot): EmailDeliveryRuntimeState {
  const parsed = parseEmailDeliveryRuntimeStateSafe(log.status);

  if (parsed === "sent" && text(log.sent_at, 80)) {
    return "delivered";
  }

  return parsed;
}

export function resolveEmailDeliveryAggregateStateSafe(params: {
  cancelledCount: number;
  deliveredCount: number;
  failedCount: number;
  queuedCount: number;
  retryPendingCount: number;
  sentCount: number;
}): EmailDeliveryRuntimeState {
  const { cancelledCount, deliveredCount, failedCount, queuedCount, retryPendingCount, sentCount } = params;
  const entries: Array<[EmailDeliveryRuntimeState, number]> = [
    ["delivered", deliveredCount],
    ["sent", sentCount],
    ["failed", failedCount],
    ["retry_pending", retryPendingCount],
    ["queued", queuedCount],
    ["cancelled", cancelledCount]
  ];

  const dominant = entries.sort((left, right) => right[1] - left[1])[0];

  if (!dominant || dominant[1] <= 0) {
    return "unknown";
  }

  return dominant[0];
}

function resolveLastDeliveryLabelSafe(logs: EmailDeliveryLogSnapshot[]) {
  const latestTimestamp = logs
    .filter((log) => {
      const state = resolveEmailDeliveryRuntimeStateForLogSafe(log);
      return state === "delivered" || state === "sent";
    })
    .map((log) => text(log.sent_at, 80) || text(log.created_at, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  if (!latestTimestamp) {
    return "No delivery activity recorded";
  }

  return `Last delivery ${formatSafeDateLabel(latestTimestamp, "Delivery timestamp unavailable")}`;
}

function buildDeliveryMetadataSummary(
  registryDescription: string | null,
  deliveryState: EmailDeliveryRuntimeState
) {
  if (registryDescription) {
    return `${registryDescription} Delivery readiness foundation only.`;
  }

  return deliveryStateDescriptions[deliveryState];
}

function countDeliveryStates(logs: EmailDeliveryLogSnapshot[]) {
  const counts: Record<EmailDeliveryRuntimeState, number> = {
    cancelled: 0,
    delivered: 0,
    failed: 0,
    queued: 0,
    retry_pending: 0,
    sent: 0,
    unknown: 0
  };

  for (const log of logs) {
    const state = resolveEmailDeliveryRuntimeStateForLogSafe(log);
    counts[state] += 1;
  }

  return counts;
}

export function buildEmailDeliveryRuntimeSummarySafe(
  logs: EmailDeliveryLogSnapshot[] | null | undefined,
  registryItems?: EmailDeliveryRegistryItem[] | null
): EmailDeliveryRuntimeSummary {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const queueSummary = buildEmailQueueRuntimeSummarySafe(snapshots, registryItems);
    const stateCounts = countDeliveryStates(snapshots);
    const queueSection = (registryItems ?? []).find(
      (item) =>
        item.registryType === "queue_summary" &&
        (text(item.slug, 80) === "queue-summary-foundation" ||
          text(item.registryKey, 80).startsWith("queue-summary:"))
    );
    const registryDescription =
      text(queueSection?.metadata?.note, 500) ||
      text(queueSection?.description, 500) ||
      null;

    const deliveredCount = stateCounts.delivered;
    const sentCount =
      stateCounts.sent > 0 || deliveredCount > 0 ? stateCounts.sent : queueSummary.sentCount;
    const failedCount = stateCounts.failed || queueSummary.failedCount;
    const retryPendingCount = stateCounts.retry_pending || queueSummary.retryPendingCount;
    const queuedCount = stateCounts.queued || queueSummary.queuedCount;
    const cancelledCount = stateCounts.cancelled || queueSummary.cancelledCount;
    const deliveryState = resolveEmailDeliveryAggregateStateSafe({
      cancelledCount,
      deliveredCount,
      failedCount,
      queuedCount,
      retryPendingCount,
      sentCount
    });

    return {
      cancelledCount,
      deliveredCount,
      deliveryState,
      deliveryStateLabel: getEmailDeliveryRuntimeStateLabel(deliveryState),
      failedCount,
      lastDeliveryLabel: resolveLastDeliveryLabelSafe(snapshots),
      metadataSummary: buildDeliveryMetadataSummary(registryDescription, deliveryState),
      queuedCount,
      retryPendingCount,
      sentCount
    };
  } catch (error) {
    console.error("[email-delivery-runtime] delivery runtime summary build failed", error);

    return {
      cancelledCount: 0,
      deliveredCount: 0,
      deliveryState: "unknown",
      deliveryStateLabel: getEmailDeliveryRuntimeStateLabel("unknown"),
      failedCount: 0,
      lastDeliveryLabel: "Delivery activity unavailable",
      metadataSummary: "Delivery readiness foundation could not be resolved safely.",
      queuedCount: 0,
      retryPendingCount: 0,
      sentCount: 0
    };
  }
}

export function buildEmailDeliveryRuntimeStatsSafe(
  logs: EmailDeliveryLogSnapshot[] | null | undefined,
  registryItems?: EmailDeliveryRegistryItem[] | null
): EmailDeliveryRuntimeStats {
  try {
    const snapshots = Array.isArray(logs) ? logs : [];
    const stateCounts = countDeliveryStates(snapshots);
    const summary = buildEmailDeliveryRuntimeSummarySafe(snapshots, registryItems);

    return {
      cancelledDeliveryItems: stateCounts.cancelled || summary.cancelledCount,
      deliveredDeliveryItems: stateCounts.delivered || summary.deliveredCount,
      failedDeliveryItems: stateCounts.failed || summary.failedCount,
      queuedDeliveryItems: stateCounts.queued || summary.queuedCount,
      retryPendingDeliveryItems: stateCounts.retry_pending || summary.retryPendingCount,
      sentDeliveryItems: stateCounts.sent,
      unknownDeliveryItems: stateCounts.unknown
    };
  } catch (error) {
    console.error("[email-delivery-runtime] delivery runtime stats build failed", error);

    return {
      cancelledDeliveryItems: 0,
      deliveredDeliveryItems: 0,
      failedDeliveryItems: 0,
      queuedDeliveryItems: 0,
      retryPendingDeliveryItems: 0,
      sentDeliveryItems: 0,
      unknownDeliveryItems: 0
    };
  }
}

export function listEmailDeliveryRuntimeCatalog() {
  return EMAIL_DELIVERY_RUNTIME_STATES.map((deliveryState) => ({
    deliveryState,
    description: getEmailDeliveryRuntimeStateDescription(deliveryState),
    label: getEmailDeliveryRuntimeStateLabel(deliveryState)
  }));
}
