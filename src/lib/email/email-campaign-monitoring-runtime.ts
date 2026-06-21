import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import { resolveEmailProviderStatusSafe } from "@/src/lib/email/email-provider-runtime";
import type { EmailCampaignReadinessState } from "@/src/lib/email/email-campaign-runtime";
import type { EmailCampaignQueueReadinessState } from "@/src/lib/email/email-campaign-queue-runtime";

type EmailCampaignMonitoringRegistryItem = {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  name?: string | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
  status?: string | null;
};

export type EmailCampaignMonitoringState =
  | "degraded"
  | "failed"
  | "healthy"
  | "monitoring"
  | "needs_review"
  | "paused"
  | "unknown"
  | "warning";

export type EmailCampaignMonitoringScopeRecord = {
  campaignHealthState: EmailCampaignMonitoringState;
  campaignHealthStateLabel: string;
  campaignScopeLabel: string;
  campaignScopeSlug: string;
  deliverySummaryState: string;
  deliverySummaryStateLabel: string;
  failureSummaryState: string;
  failureSummaryStateLabel: string;
  lastActivityLabel: string;
  metadataSummary: string;
  monitoringReadinessState: EmailCampaignMonitoringState;
  monitoringReadinessStateLabel: string;
  queueHealthState: EmailCampaignMonitoringState;
  queueHealthStateLabel: string;
};

export type EmailCampaignMonitoringRuntimeSummary = {
  campaignAnalyticsHookReserved: boolean;
  campaignHealthState: EmailCampaignMonitoringState;
  campaignHealthStateLabel: string;
  deliverySummaryState: string;
  deliverySummaryStateLabel: string;
  exportEmailLogsHookReserved: boolean;
  failureSummaryState: string;
  failureSummaryStateLabel: string;
  lastActivityLabel: string;
  metadataSummary: string;
  monitoringReadinessState: EmailCampaignMonitoringState;
  monitoringReadinessStateLabel: string;
  queueHealthState: EmailCampaignMonitoringState;
  queueHealthStateLabel: string;
};

export type EmailCampaignMonitoringRuntimeStats = {
  degradedMonitoringItems: number;
  failedMonitoringItems: number;
  healthyMonitoringItems: number;
  monitoringMonitoringItems: number;
  needsReviewMonitoringItems: number;
  pausedMonitoringItems: number;
  totalMonitoringItems: number;
  unknownMonitoringItems: number;
  warningMonitoringItems: number;
};

export type EmailCampaignMonitoringFoundationSnapshot = {
  campaignEmails: Array<{
    campaignScopeLabel: string;
    readinessState: EmailCampaignReadinessState;
    templateKey: string;
  }>;
  campaignMonitoring: Array<{
    lastActivity: string | null;
    name: string;
    note: string;
    status: "monitoring" | "placeholder";
    total: number;
  }>;
  campaignQueueScopeRecords: Array<{
    campaignScopeLabel: string;
    campaignScopeSlug: string;
    failedCount: number;
    lastActivityLabel: string;
    queueReadinessState: EmailCampaignQueueReadinessState;
    retryPendingCount: number;
  }>;
  campaignQueueSummary: {
    campaignFailedCount: number;
    campaignRetryPendingCount: number;
    lastActivityLabel: string;
    queueReadinessState: EmailCampaignQueueReadinessState;
  };
  deliverySummary: {
    deliveryState: string;
    deliveryStateLabel: string;
    failedCount: number;
    lastDeliveryLabel: string;
    retryPendingCount: number;
  };
  failureSummary: {
    failedCount: number;
    failureState: string;
    failureStateLabel: string;
    lastFailureLabel: string;
  };
  futureHooks: string[];
  queueSummary: {
    cancelledCount: number;
    failedCount: number;
    lastActivityLabel: string;
    queuedCount: number;
    retryPendingCount: number;
    sentCount: number;
  };
};

export const EMAIL_CAMPAIGN_MONITORING_STATES: readonly EmailCampaignMonitoringState[] = [
  "healthy",
  "monitoring",
  "warning",
  "degraded",
  "needs_review",
  "paused",
  "failed",
  "unknown"
] as const;

const monitoringStateLabels: Record<EmailCampaignMonitoringState, string> = {
  degraded: "Campaign monitoring degraded",
  failed: "Campaign monitoring failed",
  healthy: "Campaign monitoring healthy",
  monitoring: "Campaign monitoring active",
  needs_review: "Campaign monitoring needs review",
  paused: "Campaign monitoring paused",
  unknown: "Unknown campaign monitoring state",
  warning: "Campaign monitoring warning"
};

const monitoringStateDescriptions: Record<EmailCampaignMonitoringState, string> = {
  degraded:
    "Campaign monitoring foundation shows partial issues in read-only summaries. No monitoring execution connected.",
  failed:
    "Campaign monitoring foundation shows failed queue or delivery signals in read-only data. No monitoring daemon connected.",
  healthy:
    "Campaign monitoring readiness foundation looks healthy. No monitoring execution, campaign sending, or queue processing connected.",
  monitoring:
    "Campaign monitoring foundation is observing read-only campaign scope activity. No monitoring daemon connected.",
  needs_review:
    "Campaign monitoring foundation requires admin review. No monitoring execution or campaign sending connected.",
  paused:
    "Campaign monitoring foundation shows paused campaign scope or queue signals. No monitoring execution connected.",
  unknown: "Campaign monitoring readiness could not be resolved safely.",
  warning:
    "Campaign monitoring foundation shows warning signals such as retry pending or provider readiness gaps. No monitoring execution connected."
};

const monitoringStatePriority: Record<EmailCampaignMonitoringState, number> = {
  failed: 8,
  needs_review: 7,
  warning: 6,
  degraded: 5,
  paused: 4,
  monitoring: 3,
  healthy: 2,
  unknown: 1
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

function resolvePlatformProviderReady() {
  const resendStatus = resolveEmailProviderStatusSafe("resend");
  return resendStatus.configurationStatus === "configured" && resendStatus.healthStatus === "healthy";
}

export function getEmailCampaignMonitoringStateLabel(state: EmailCampaignMonitoringState) {
  return monitoringStateLabels[state];
}

export function getEmailCampaignMonitoringStateDescription(state: EmailCampaignMonitoringState) {
  return monitoringStateDescriptions[state];
}

export function mapCampaignReadinessToMonitoringStateSafe(
  readinessState: EmailCampaignReadinessState
): EmailCampaignMonitoringState {
  switch (readinessState) {
    case "campaign_ready":
      return "healthy";
    case "needs_review":
    case "missing_template":
    case "draft":
      return "needs_review";
    case "missing_provider":
      return "warning";
    case "invalid":
      return "failed";
    case "disabled":
      return "paused";
    default:
      return "unknown";
  }
}

export function mapCampaignQueueReadinessToMonitoringStateSafe(
  queueReadinessState: EmailCampaignQueueReadinessState
): EmailCampaignMonitoringState {
  switch (queueReadinessState) {
    case "queue_ready":
    case "sent":
      return "healthy";
    case "failed":
      return "failed";
    case "retry_pending":
      return "warning";
    case "queued":
    case "processing":
      return "monitoring";
    case "paused":
      return "paused";
    case "cancelled":
      return "degraded";
    case "needs_review":
      return "needs_review";
    default:
      return "unknown";
  }
}

export function mapDeliveryStateToMonitoringStateSafe(deliveryState: string): EmailCampaignMonitoringState {
  switch (text(deliveryState, 80)) {
    case "failed":
      return "failed";
    case "retry_pending":
      return "warning";
    case "queued":
      return "monitoring";
    case "cancelled":
      return "degraded";
    case "sent":
    case "delivered":
      return "healthy";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

export function mapFailureStateToMonitoringStateSafe(failureState: string): EmailCampaignMonitoringState {
  switch (text(failureState, 80)) {
    case "no_failures":
      return "healthy";
    case "failed":
    case "provider_error":
    case "template_error":
    case "recipient_error":
    case "retry_exhausted":
      return "failed";
    case "retry_pending":
      return "warning";
    default:
      return "unknown";
  }
}

export function resolveEmailCampaignMonitoringAggregateStateSafe(
  states: EmailCampaignMonitoringState[]
): EmailCampaignMonitoringState {
  if (!states.length) {
    return "unknown";
  }

  return states.reduce((worst, current) =>
    monitoringStatePriority[current] > monitoringStatePriority[worst] ? current : worst
  );
}

function resolveFutureHookReserved(
  futureHooks: string[],
  registryItems: EmailCampaignMonitoringRegistryItem[] | null | undefined,
  slug: string,
  label: string
) {
  const normalizedLabel = label.toLowerCase();

  if (futureHooks.some((hook) => text(hook, 200).toLowerCase() === normalizedLabel)) {
    return true;
  }

  return filterEmailRegistryItemsByType(registryItems ?? [], "future_hook").some((item) => {
    const itemSlug = text(item.slug, 160).toLowerCase();
    const itemName = text(item.name, 200).toLowerCase();
    return itemSlug === slug || itemSlug.includes(slug) || itemName === normalizedLabel;
  });
}

function resolveCampaignAnalyticsHookReserved(
  futureHooks: string[],
  registryItems: EmailCampaignMonitoringRegistryItem[] | null | undefined
) {
  if (resolveFutureHookReserved(futureHooks, registryItems, "campaign-analytics", "Campaign analytics")) {
    return true;
  }

  return filterEmailRegistryItemsByType(registryItems ?? [], "future_hook").some((item) => {
    const slug = text(item.slug, 160).toLowerCase();
    const name = text(item.name, 200).toLowerCase();
    return slug.includes("campaign-analytics") || name.includes("campaign analytics");
  });
}

function resolveLastActivityLabelSafe(snapshot: EmailCampaignMonitoringFoundationSnapshot) {
  const candidates = [
    snapshot.campaignQueueSummary.lastActivityLabel,
    snapshot.deliverySummary.lastDeliveryLabel,
    snapshot.failureSummary.lastFailureLabel,
    snapshot.queueSummary.lastActivityLabel,
    ...snapshot.campaignMonitoring
      .map((entry) => text(entry.lastActivity, 80))
      .filter(Boolean)
      .map((value) => `Last activity ${value.slice(0, 10)}`),
    ...snapshot.campaignQueueScopeRecords.map((record) => record.lastActivityLabel)
  ].filter(Boolean);

  const dated = candidates.find((label) => label.toLowerCase().includes("last activity") || label.toLowerCase().includes("last delivery") || label.toLowerCase().includes("last failure") || label.toLowerCase().includes("last retry"));

  return dated || "No campaign monitoring activity recorded";
}

function buildMonitoringMetadataSummary(params: {
  campaignAnalyticsHookReserved: boolean;
  exportEmailLogsHookReserved: boolean;
  monitoringReadinessState: EmailCampaignMonitoringState;
  registryItems?: EmailCampaignMonitoringRegistryItem[] | null;
}) {
  const campaignScopes = filterEmailRegistryItemsByType(params.registryItems ?? [], "campaign_scope");
  const scopeNote = campaignScopes
    .map((item) => text(item.metadata?.note, 500) || text(item.description, 500))
    .filter(Boolean)[0];
  const hookNotes = [
    params.exportEmailLogsHookReserved ? "Export email logs remains a reserved future hook." : null,
    params.campaignAnalyticsHookReserved ? "Campaign analytics remains a reserved monitoring placeholder." : null
  ]
    .filter(Boolean)
    .join(" ");

  const base = monitoringStateDescriptions[params.monitoringReadinessState];

  if (scopeNote && hookNotes) {
    return `${scopeNote} ${hookNotes} ${base}`;
  }

  if (scopeNote) {
    return `${scopeNote} ${base}`;
  }

  if (hookNotes) {
    return `${hookNotes} ${base}`;
  }

  return base;
}

function findCampaignEmailForScope(
  snapshot: EmailCampaignMonitoringFoundationSnapshot,
  slug: string,
  label: string
) {
  return (
    snapshot.campaignEmails.find((record) => text(record.templateKey, 160) === slug) ??
    snapshot.campaignEmails.find((record) => text(record.campaignScopeLabel, 200) === label) ??
    null
  );
}

function findQueueScopeRecord(
  snapshot: EmailCampaignMonitoringFoundationSnapshot,
  slug: string,
  label: string
) {
  return (
    snapshot.campaignQueueScopeRecords.find((record) => record.campaignScopeSlug === slug) ??
    snapshot.campaignQueueScopeRecords.find((record) => record.campaignScopeLabel === label) ??
    null
  );
}

export function buildEmailCampaignMonitoringScopeRecordsSafe(
  snapshot: EmailCampaignMonitoringFoundationSnapshot,
  registryItems?: EmailCampaignMonitoringRegistryItem[] | null
): EmailCampaignMonitoringScopeRecord[] {
  try {
    const campaignScopes = filterEmailRegistryItemsByType(registryItems ?? [], "campaign_scope");

    if (!campaignScopes.length) {
      return snapshot.campaignMonitoring.map((entry) => {
        const slug =
          entry.name.toLowerCase().includes("platform") ? "platform-campaigns" : "store-owner-campaigns";
        const campaignEmail = findCampaignEmailForScope(snapshot, slug, entry.name);
        const queueScope = findQueueScopeRecord(snapshot, slug, entry.name);
        const campaignHealthState = campaignEmail
          ? mapCampaignReadinessToMonitoringStateSafe(campaignEmail.readinessState)
          : entry.status === "placeholder"
            ? "needs_review"
            : "monitoring";
        const queueHealthState = queueScope
          ? mapCampaignQueueReadinessToMonitoringStateSafe(queueScope.queueReadinessState)
          : "unknown";
        const deliverySummaryState = text(snapshot.deliverySummary.deliveryState, 80) || "unknown";
        const failureSummaryState = text(snapshot.failureSummary.failureState, 80) || "unknown";
        const monitoringReadinessState = resolveEmailCampaignMonitoringAggregateStateSafe([
          campaignHealthState,
          queueHealthState,
          mapDeliveryStateToMonitoringStateSafe(deliverySummaryState),
          mapFailureStateToMonitoringStateSafe(failureSummaryState),
          entry.status === "placeholder" ? "needs_review" : "monitoring"
        ]);

        return {
          campaignHealthState,
          campaignHealthStateLabel: getEmailCampaignMonitoringStateLabel(campaignHealthState),
          campaignScopeLabel: entry.name,
          campaignScopeSlug: slug,
          deliverySummaryState,
          deliverySummaryStateLabel: snapshot.deliverySummary.deliveryStateLabel,
          failureSummaryState,
          failureSummaryStateLabel: snapshot.failureSummary.failureStateLabel,
          lastActivityLabel:
            queueScope?.lastActivityLabel ||
            (entry.lastActivity ? `Last activity ${entry.lastActivity.slice(0, 10)}` : "No campaign monitoring activity recorded"),
          metadataSummary: text(entry.note, 500) || monitoringStateDescriptions[monitoringReadinessState],
          monitoringReadinessState,
          monitoringReadinessStateLabel: getEmailCampaignMonitoringStateLabel(monitoringReadinessState),
          queueHealthState,
          queueHealthStateLabel: getEmailCampaignMonitoringStateLabel(queueHealthState)
        };
      });
    }

    return campaignScopes.map((registry) => {
      const slug = text(registry.slug, 160) || text(registry.registryKey, 160) || "campaign-scope";
      const label = text(registry.name, 200) || "Campaign scope";
      const monitoringEntry = snapshot.campaignMonitoring.find((entry) => entry.name === label);
      const campaignEmail = findCampaignEmailForScope(snapshot, slug, label);
      const queueScope = findQueueScopeRecord(snapshot, slug, label);
      const registryStatus = text(registry.status, 80);
      const campaignHealthState = campaignEmail
        ? mapCampaignReadinessToMonitoringStateSafe(campaignEmail.readinessState)
        : registryStatus === "placeholder"
          ? "needs_review"
          : registryStatus === "disabled"
            ? "paused"
            : "monitoring";
      const queueHealthState = queueScope
        ? mapCampaignQueueReadinessToMonitoringStateSafe(queueScope.queueReadinessState)
        : "unknown";
      const deliverySummaryState = text(snapshot.deliverySummary.deliveryState, 80) || "unknown";
      const failureSummaryState = text(snapshot.failureSummary.failureState, 80) || "unknown";
      const monitoringReadinessState = resolveEmailCampaignMonitoringAggregateStateSafe([
        campaignHealthState,
        queueHealthState,
        mapDeliveryStateToMonitoringStateSafe(deliverySummaryState),
        mapFailureStateToMonitoringStateSafe(failureSummaryState),
        registryStatus === "placeholder" ? "needs_review" : registryStatus === "monitoring" ? "monitoring" : "unknown"
      ]);

      return {
        campaignHealthState,
        campaignHealthStateLabel: getEmailCampaignMonitoringStateLabel(campaignHealthState),
        campaignScopeLabel: label,
        campaignScopeSlug: slug,
        deliverySummaryState,
        deliverySummaryStateLabel: snapshot.deliverySummary.deliveryStateLabel,
        failureSummaryState,
        failureSummaryStateLabel: snapshot.failureSummary.failureStateLabel,
        lastActivityLabel:
          queueScope?.lastActivityLabel ||
          (monitoringEntry?.lastActivity
            ? `Last activity ${monitoringEntry.lastActivity.slice(0, 10)}`
            : "No campaign monitoring activity recorded"),
        metadataSummary:
          text(registry.metadata?.note, 500) ||
          text(registry.description, 500) ||
          monitoringStateDescriptions[monitoringReadinessState],
        monitoringReadinessState,
        monitoringReadinessStateLabel: getEmailCampaignMonitoringStateLabel(monitoringReadinessState),
        queueHealthState,
        queueHealthStateLabel: getEmailCampaignMonitoringStateLabel(queueHealthState)
      };
    });
  } catch (error) {
    console.error("[email-campaign-monitoring-runtime] campaign monitoring scope records build failed", error);
    return [];
  }
}

export function buildEmailCampaignMonitoringRuntimeSummarySafe(
  snapshot: EmailCampaignMonitoringFoundationSnapshot,
  registryItems?: EmailCampaignMonitoringRegistryItem[] | null
): EmailCampaignMonitoringRuntimeSummary {
  try {
    const scopeRecords = buildEmailCampaignMonitoringScopeRecordsSafe(snapshot, registryItems);
    const exportEmailLogsHookReserved = resolveFutureHookReserved(
      snapshot.futureHooks,
      registryItems,
      "export-email-logs",
      "Export email logs"
    );
    const campaignAnalyticsHookReserved = resolveCampaignAnalyticsHookReserved(snapshot.futureHooks, registryItems);

    const campaignHealthStates = scopeRecords.map((record) => record.campaignHealthState);
    const queueHealthStates = scopeRecords.map((record) => record.queueHealthState);
    const campaignHealthState = resolveEmailCampaignMonitoringAggregateStateSafe(
      campaignHealthStates.length
        ? campaignHealthStates
        : [mapCampaignReadinessToMonitoringStateSafe("unknown")]
    );
    const queueHealthState = resolveEmailCampaignMonitoringAggregateStateSafe(
      queueHealthStates.length
        ? queueHealthStates
        : [mapCampaignQueueReadinessToMonitoringStateSafe(snapshot.campaignQueueSummary.queueReadinessState)]
    );
    const deliverySummaryState = text(snapshot.deliverySummary.deliveryState, 80) || "unknown";
    const failureSummaryState = text(snapshot.failureSummary.failureState, 80) || "unknown";
    const providerReady = resolvePlatformProviderReady();
    const monitoringReadinessState = resolveEmailCampaignMonitoringAggregateStateSafe([
      campaignHealthState,
      queueHealthState,
      mapDeliveryStateToMonitoringStateSafe(deliverySummaryState),
      mapFailureStateToMonitoringStateSafe(failureSummaryState),
      snapshot.campaignQueueSummary.campaignFailedCount > 0 ? "failed" : "healthy",
      snapshot.campaignQueueSummary.campaignRetryPendingCount > 0 ? "warning" : "healthy",
      snapshot.queueSummary.failedCount > 0 ? "warning" : "healthy",
      snapshot.queueSummary.retryPendingCount > 0 ? "warning" : "healthy",
      providerReady ? "healthy" : "warning",
      scopeRecords.some((record) => record.monitoringReadinessState === "needs_review") ? "needs_review" : "healthy"
    ]);

    return {
      campaignAnalyticsHookReserved,
      campaignHealthState,
      campaignHealthStateLabel: getEmailCampaignMonitoringStateLabel(campaignHealthState),
      deliverySummaryState,
      deliverySummaryStateLabel: snapshot.deliverySummary.deliveryStateLabel,
      exportEmailLogsHookReserved,
      failureSummaryState,
      failureSummaryStateLabel: snapshot.failureSummary.failureStateLabel,
      lastActivityLabel: resolveLastActivityLabelSafe(snapshot),
      metadataSummary: buildMonitoringMetadataSummary({
        campaignAnalyticsHookReserved,
        exportEmailLogsHookReserved,
        monitoringReadinessState,
        registryItems
      }),
      monitoringReadinessState,
      monitoringReadinessStateLabel: getEmailCampaignMonitoringStateLabel(monitoringReadinessState),
      queueHealthState,
      queueHealthStateLabel: getEmailCampaignMonitoringStateLabel(queueHealthState)
    };
  } catch (error) {
    console.error("[email-campaign-monitoring-runtime] campaign monitoring runtime summary build failed", error);

    return {
      campaignAnalyticsHookReserved: true,
      campaignHealthState: "unknown",
      campaignHealthStateLabel: getEmailCampaignMonitoringStateLabel("unknown"),
      deliverySummaryState: "unknown",
      deliverySummaryStateLabel: "Unknown delivery summary",
      exportEmailLogsHookReserved: false,
      failureSummaryState: "unknown",
      failureSummaryStateLabel: "Unknown failure summary",
      lastActivityLabel: "Campaign monitoring activity unavailable",
      metadataSummary: "Campaign monitoring readiness foundation could not be resolved safely.",
      monitoringReadinessState: "unknown",
      monitoringReadinessStateLabel: getEmailCampaignMonitoringStateLabel("unknown"),
      queueHealthState: "unknown",
      queueHealthStateLabel: getEmailCampaignMonitoringStateLabel("unknown")
    };
  }
}

export function buildEmailCampaignMonitoringRuntimeStatsSafe(
  snapshot: EmailCampaignMonitoringFoundationSnapshot,
  registryItems?: EmailCampaignMonitoringRegistryItem[] | null
): EmailCampaignMonitoringRuntimeStats {
  try {
    const scopeRecords = buildEmailCampaignMonitoringScopeRecordsSafe(snapshot, registryItems);

    if (!scopeRecords.length) {
      return {
        degradedMonitoringItems: 0,
        failedMonitoringItems: 0,
        healthyMonitoringItems: 0,
        monitoringMonitoringItems: 0,
        needsReviewMonitoringItems: 0,
        pausedMonitoringItems: 0,
        totalMonitoringItems: 0,
        unknownMonitoringItems: 0,
        warningMonitoringItems: 0
      };
    }

    return {
      degradedMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "degraded").length,
      failedMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "failed").length,
      healthyMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "healthy").length,
      monitoringMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "monitoring")
        .length,
      needsReviewMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "needs_review")
        .length,
      pausedMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "paused").length,
      totalMonitoringItems: scopeRecords.length,
      unknownMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "unknown").length,
      warningMonitoringItems: scopeRecords.filter((record) => record.monitoringReadinessState === "warning").length
    };
  } catch (error) {
    console.error("[email-campaign-monitoring-runtime] campaign monitoring runtime stats build failed", error);

    return {
      degradedMonitoringItems: 0,
      failedMonitoringItems: 0,
      healthyMonitoringItems: 0,
      monitoringMonitoringItems: 0,
      needsReviewMonitoringItems: 0,
      pausedMonitoringItems: 0,
      totalMonitoringItems: 0,
      unknownMonitoringItems: 0,
      warningMonitoringItems: 0
    };
  }
}

export function listEmailCampaignMonitoringCatalog() {
  return EMAIL_CAMPAIGN_MONITORING_STATES.map((monitoringState) => ({
    description: getEmailCampaignMonitoringStateDescription(monitoringState),
    label: getEmailCampaignMonitoringStateLabel(monitoringState),
    monitoringState
  }));
}
