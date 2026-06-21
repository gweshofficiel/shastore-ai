import "server-only";

export type EmailAnalyticsFoundationSnapshot = {
  campaignEmailStats: {
    campaignReadyCampaignEmails: number;
    needsReviewCampaignEmails: number;
  };
  campaignMonitoringStats: {
    needsReviewMonitoringItems: number;
  };
  campaignMonitoringSummary: {
    monitoringReadinessState: string;
    monitoringReadinessStateLabel: string;
  };
  providerStats: {
    configuredProviders: number;
  };
  queueSummary: {
    cancelledCount: number;
    failedCount: number;
    queuedCount: number;
    retryPendingCount: number;
    sentCount: number;
  };
  templateRegistryStats: {
    activeTemplates: number;
    totalTemplates: number;
  };
  templateValidationStats: {
    needsReviewTemplates: number;
  };
};

export type EmailAnalyticsRuntimeSummary = {
  activeTemplatesCount: number;
  campaignReadinessCount: number;
  cancelledCount: number;
  failedCount: number;
  metadataSummary: string;
  monitoringHealthSummary: string;
  needsReviewCount: number;
  providersConfiguredCount: number;
  queuedCount: number;
  retryPendingCount: number;
  sentCount: number;
  templatesCount: number;
};

export type EmailAnalyticsRuntimeStats = {
  activeTemplatesAnalyticsItems: number;
  campaignReadyAnalyticsItems: number;
  cancelledAnalyticsItems: number;
  failedAnalyticsItems: number;
  needsReviewAnalyticsItems: number;
  providersConfiguredAnalyticsItems: number;
  queuedAnalyticsItems: number;
  retryPendingAnalyticsItems: number;
  sentAnalyticsItems: number;
  templatesAnalyticsItems: number;
  totalQueueAnalyticsItems: number;
};

function safeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  return 0;
}

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

function buildAnalyticsMetadataSummary(params: {
  monitoringHealthSummary: string;
  needsReviewCount: number;
  providersConfiguredCount: number;
  templatesCount: number;
  totalQueueItems: number;
}) {
  return [
    `Read-only email analytics foundation from ${params.templatesCount} templates and ${params.providersConfiguredCount} configured providers.`,
    `Queue summary total ${params.totalQueueItems} entries from safe read-only logs.`,
    params.needsReviewCount > 0
      ? `${params.needsReviewCount} items flagged for admin review in analytics summaries.`
      : "No needs-review analytics flags in current summaries.",
    `${params.monitoringHealthSummary} No analytics backfill, cron jobs, or external integrations connected.`
  ].join(" ");
}

export function buildEmailAnalyticsRuntimeSummarySafe(
  snapshot: EmailAnalyticsFoundationSnapshot | null | undefined
): EmailAnalyticsRuntimeSummary {
  try {
    const source = snapshot ?? {
      campaignEmailStats: { campaignReadyCampaignEmails: 0, needsReviewCampaignEmails: 0 },
      campaignMonitoringStats: { needsReviewMonitoringItems: 0 },
      campaignMonitoringSummary: {
        monitoringReadinessState: "unknown",
        monitoringReadinessStateLabel: "Unknown campaign monitoring state"
      },
      providerStats: { configuredProviders: 0 },
      queueSummary: {
        cancelledCount: 0,
        failedCount: 0,
        queuedCount: 0,
        retryPendingCount: 0,
        sentCount: 0
      },
      templateRegistryStats: { activeTemplates: 0, totalTemplates: 0 },
      templateValidationStats: { needsReviewTemplates: 0 }
    };

    const providersConfiguredCount = safeCount(source.providerStats.configuredProviders);
    const templatesCount = safeCount(source.templateRegistryStats.totalTemplates);
    const activeTemplatesCount = safeCount(source.templateRegistryStats.activeTemplates);
    const queuedCount = safeCount(source.queueSummary.queuedCount);
    const sentCount = safeCount(source.queueSummary.sentCount);
    const failedCount = safeCount(source.queueSummary.failedCount);
    const retryPendingCount = safeCount(source.queueSummary.retryPendingCount);
    const cancelledCount = safeCount(source.queueSummary.cancelledCount);
    const campaignReadinessCount = safeCount(source.campaignEmailStats.campaignReadyCampaignEmails);
    const needsReviewCount =
      safeCount(source.campaignEmailStats.needsReviewCampaignEmails) +
      safeCount(source.campaignMonitoringStats.needsReviewMonitoringItems) +
      safeCount(source.templateValidationStats.needsReviewTemplates);
    const monitoringHealthSummary =
      text(source.campaignMonitoringSummary.monitoringReadinessStateLabel, 200) ||
      "Campaign monitoring summary unavailable.";
    const totalQueueItems = queuedCount + sentCount + failedCount + retryPendingCount + cancelledCount;

    return {
      activeTemplatesCount,
      campaignReadinessCount,
      cancelledCount,
      failedCount,
      metadataSummary: buildAnalyticsMetadataSummary({
        monitoringHealthSummary,
        needsReviewCount,
        providersConfiguredCount,
        templatesCount,
        totalQueueItems
      }),
      monitoringHealthSummary,
      needsReviewCount,
      providersConfiguredCount,
      queuedCount,
      retryPendingCount,
      sentCount,
      templatesCount
    };
  } catch (error) {
    console.error("[email-analytics-runtime] analytics runtime summary build failed", error);

    return {
      activeTemplatesCount: 0,
      campaignReadinessCount: 0,
      cancelledCount: 0,
      failedCount: 0,
      metadataSummary: "Email analytics readiness foundation could not be resolved safely.",
      monitoringHealthSummary: "Campaign monitoring summary unavailable",
      needsReviewCount: 0,
      providersConfiguredCount: 0,
      queuedCount: 0,
      retryPendingCount: 0,
      sentCount: 0,
      templatesCount: 0
    };
  }
}

export function buildEmailAnalyticsRuntimeStatsSafe(
  snapshot: EmailAnalyticsFoundationSnapshot | null | undefined
): EmailAnalyticsRuntimeStats {
  try {
    const summary = buildEmailAnalyticsRuntimeSummarySafe(snapshot);
    const totalQueueAnalyticsItems =
      summary.queuedCount +
      summary.sentCount +
      summary.failedCount +
      summary.retryPendingCount +
      summary.cancelledCount;

    return {
      activeTemplatesAnalyticsItems: summary.activeTemplatesCount,
      campaignReadyAnalyticsItems: summary.campaignReadinessCount,
      cancelledAnalyticsItems: summary.cancelledCount,
      failedAnalyticsItems: summary.failedCount,
      needsReviewAnalyticsItems: summary.needsReviewCount,
      providersConfiguredAnalyticsItems: summary.providersConfiguredCount,
      queuedAnalyticsItems: summary.queuedCount,
      retryPendingAnalyticsItems: summary.retryPendingCount,
      sentAnalyticsItems: summary.sentCount,
      templatesAnalyticsItems: summary.templatesCount,
      totalQueueAnalyticsItems
    };
  } catch (error) {
    console.error("[email-analytics-runtime] analytics runtime stats build failed", error);

    return {
      activeTemplatesAnalyticsItems: 0,
      campaignReadyAnalyticsItems: 0,
      cancelledAnalyticsItems: 0,
      failedAnalyticsItems: 0,
      needsReviewAnalyticsItems: 0,
      providersConfiguredAnalyticsItems: 0,
      queuedAnalyticsItems: 0,
      retryPendingAnalyticsItems: 0,
      sentAnalyticsItems: 0,
      templatesAnalyticsItems: 0,
      totalQueueAnalyticsItems: 0
    };
  }
}

export function listEmailAnalyticsRuntimeCatalog() {
  return [
    {
      description: "Configured email providers counted from read-only registry foundation.",
      key: "providersConfiguredCount",
      label: "Providers configured"
    },
    {
      description: "Registered email templates counted from read-only registry foundation.",
      key: "templatesCount",
      label: "Templates count"
    },
    {
      description: "Active email templates counted from read-only registry foundation.",
      key: "activeTemplatesCount",
      label: "Active templates count"
    },
    {
      description: "Queued email entries counted from read-only queue summary.",
      key: "queuedCount",
      label: "Queued count"
    },
    {
      description: "Sent email entries counted from read-only queue summary.",
      key: "sentCount",
      label: "Sent count"
    },
    {
      description: "Failed email entries counted from read-only queue summary.",
      key: "failedCount",
      label: "Failed count"
    },
    {
      description: "Retry pending email entries counted from read-only queue summary.",
      key: "retryPendingCount",
      label: "Retry pending count"
    },
    {
      description: "Cancelled email entries counted from read-only queue summary.",
      key: "cancelledCount",
      label: "Cancelled count"
    },
    {
      description: "Campaign-ready scopes counted from read-only campaign email foundation.",
      key: "campaignReadinessCount",
      label: "Campaign readiness count"
    },
    {
      description: "Campaign monitoring readiness label from read-only monitoring foundation.",
      key: "monitoringHealthSummary",
      label: "Monitoring health summary"
    },
    {
      description: "Needs-review items aggregated from safe campaign and template summaries.",
      key: "needsReviewCount",
      label: "Needs review count"
    }
  ] as const;
}
