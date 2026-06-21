import "server-only";

export type EmailAuditState =
  | "audit_ready"
  | "incomplete"
  | "invalid"
  | "missing_required_fields"
  | "needs_review"
  | "risky_metadata"
  | "unknown";

export type EmailAuditRegistryItem = {
  metadata?: Record<string, unknown> | null;
  name?: string | null;
  registryKey?: string | null;
  registryType?: string | null;
  slug?: string | null;
  updatedAt?: string | null;
};

export type EmailAuditFoundationSnapshot = {
  analyticsSummary: {
    needsReviewCount: number;
  };
  campaignEmailStats: {
    invalidCampaignEmails: number;
    missingProviderCampaignEmails: number;
    missingTemplateCampaignEmails: number;
    needsReviewCampaignEmails: number;
  };
  campaignMonitoringStats: {
    needsReviewMonitoringItems: number;
  };
  failureStats: {
    failedFailureItems: number;
    templateErrorFailureItems: number;
  };
  failoverSummary: {
    failoverReadinessState: string;
  };
  lastActivityCandidates: string[];
  providerHealthStats: {
    failedProviders: number;
    missingConfigProviders: number;
    unknownProviders: number;
  };
  providerStats: {
    configuredProviders: number;
    missingProviders: number;
    totalProviders: number;
  };
  templateValidationStats: {
    invalidTemplates: number;
    missingBodyTemplates: number;
    missingSubjectTemplates: number;
    missingVariablesTemplates: number;
    needsReviewTemplates: number;
    unsafeContentTemplates: number;
    unknownTemplates: number;
  };
  typeStats: {
    totalItems: number;
  };
};

export type EmailAuditRuntimeSummary = {
  auditState: EmailAuditState;
  auditStateLabel: string;
  invalidItemCount: number;
  lastUpdatedLabel: string;
  metadataSummary: string;
  missingRequiredRuntimeFieldsCount: number;
  needsReviewCount: number;
  riskyMetadataCount: number;
};

export type EmailAuditRuntimeStats = {
  auditReadyAuditItems: number;
  incompleteAuditItems: number;
  invalidAuditItems: number;
  missingRequiredFieldsAuditItems: number;
  needsReviewAuditItems: number;
  riskyMetadataAuditItems: number;
  totalAuditItems: number;
  unknownAuditItems: number;
};

export const EMAIL_AUDIT_STATES: readonly EmailAuditState[] = [
  "audit_ready",
  "needs_review",
  "incomplete",
  "missing_required_fields",
  "risky_metadata",
  "invalid",
  "unknown"
] as const;

const auditStateLabels: Record<EmailAuditState, string> = {
  audit_ready: "Audit readiness complete",
  incomplete: "Audit foundation incomplete",
  invalid: "Invalid audit foundation items",
  missing_required_fields: "Missing required runtime fields",
  needs_review: "Audit needs review",
  risky_metadata: "Risky metadata patterns detected",
  unknown: "Unknown audit readiness"
};

const auditStateDescriptions: Record<EmailAuditState, string> = {
  audit_ready:
    "Email audit readiness foundation looks complete from read-only summaries. No automatic audit logging or backfill connected.",
  incomplete:
    "Email audit foundation is incomplete in read-only registry summaries. No audit backfill or mutation connected.",
  invalid:
    "Invalid items detected in read-only email runtime summaries. No destructive audit correction connected.",
  missing_required_fields:
    "Missing required runtime fields detected in read-only audit summaries. No registry mutation connected.",
  needs_review:
    "Email audit readiness requires admin review from read-only foundations. No audit log creation connected.",
  risky_metadata:
    "Risky metadata patterns detected in safe read-only summaries. No secrets or private metadata exposed.",
  unknown: "Email audit readiness could not be resolved safely."
};

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,})/i;

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

function safeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  return 0;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function getEmailAuditStateLabel(state: EmailAuditState) {
  return auditStateLabels[state];
}

export function getEmailAuditStateDescription(state: EmailAuditState) {
  return auditStateDescriptions[state];
}

export function countRegistryMissingRequiredFieldsSafe(
  registryItems: EmailAuditRegistryItem[] | null | undefined
) {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];

    return items.filter((item) => {
      const name = text(item.name, 200);
      const slug = text(item.slug, 160);
      const registryKey = text(item.registryKey, 160);
      const registryType = text(item.registryType, 80);

      return !name || !slug || !registryKey || !registryType;
    }).length;
  } catch (error) {
    console.error("[email-audit-runtime] missing required fields count failed", error);
    return 0;
  }
}

export function countRegistryRiskyMetadataSafe(registryItems: EmailAuditRegistryItem[] | null | undefined) {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    let count = 0;

    for (const item of items) {
      const metadata = safeRecord(item.metadata);
      let risky = false;

      for (const [key, value] of Object.entries(metadata)) {
        const cleanedKey = text(key, 80);
        if (cleanedKey && secretPattern.test(cleanedKey)) {
          risky = true;
          break;
        }

        if (typeof value === "string" && secretPattern.test(text(value, 240))) {
          risky = true;
          break;
        }
      }

      if (risky) {
        count += 1;
      }
    }

    return count;
  } catch (error) {
    console.error("[email-audit-runtime] risky metadata count failed", error);
    return 0;
  }
}

function resolveLastUpdatedLabelSafe(candidates: string[]) {
  const latestTimestamp = candidates
    .map((value) => text(value, 80))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];

  if (!latestTimestamp) {
    return "No audit activity timestamp available";
  }

  const parsed = new Date(latestTimestamp);
  if (!Number.isFinite(parsed.getTime())) {
    return "Audit timestamp unavailable";
  }

  return `Last updated ${parsed.toISOString().slice(0, 10)}`;
}

export function resolveEmailAuditStateSafe(params: {
  incompleteItemCount: number;
  invalidItemCount: number;
  missingRequiredRuntimeFieldsCount: number;
  needsReviewCount: number;
  riskyMetadataCount: number;
}): EmailAuditState {
  const {
    incompleteItemCount,
    invalidItemCount,
    missingRequiredRuntimeFieldsCount,
    needsReviewCount,
    riskyMetadataCount
  } = params;

  if (invalidItemCount > 0) {
    return "invalid";
  }

  if (riskyMetadataCount > 0) {
    return "risky_metadata";
  }

  if (missingRequiredRuntimeFieldsCount > 0) {
    return "missing_required_fields";
  }

  if (needsReviewCount > 0) {
    return "needs_review";
  }

  if (incompleteItemCount > 0) {
    return "incomplete";
  }

  if (
    invalidItemCount === 0 &&
    riskyMetadataCount === 0 &&
    missingRequiredRuntimeFieldsCount === 0 &&
    needsReviewCount === 0 &&
    incompleteItemCount === 0
  ) {
    return "audit_ready";
  }

  return "unknown";
}

function buildAuditCounts(
  snapshot: EmailAuditFoundationSnapshot,
  registryItems?: EmailAuditRegistryItem[] | null
) {
  const registryMissingRequired = countRegistryMissingRequiredFieldsSafe(registryItems);
  const registryRiskyMetadata = countRegistryRiskyMetadataSafe(registryItems);

  const missingRequiredRuntimeFieldsCount =
    registryMissingRequired +
    safeCount(snapshot.templateValidationStats.missingSubjectTemplates) +
    safeCount(snapshot.templateValidationStats.missingBodyTemplates) +
    safeCount(snapshot.templateValidationStats.missingVariablesTemplates) +
    safeCount(snapshot.campaignEmailStats.missingProviderCampaignEmails) +
    safeCount(snapshot.campaignEmailStats.missingTemplateCampaignEmails) +
    safeCount(snapshot.providerHealthStats.missingConfigProviders);

  const invalidItemCount =
    safeCount(snapshot.templateValidationStats.invalidTemplates) +
    safeCount(snapshot.campaignEmailStats.invalidCampaignEmails) +
    safeCount(snapshot.providerHealthStats.failedProviders) +
    safeCount(snapshot.failureStats.failedFailureItems) +
    safeCount(snapshot.failureStats.templateErrorFailureItems);

  const riskyMetadataCount =
    registryRiskyMetadata + safeCount(snapshot.templateValidationStats.unsafeContentTemplates);

  const needsReviewCount =
    safeCount(snapshot.analyticsSummary.needsReviewCount) +
    safeCount(snapshot.campaignEmailStats.needsReviewCampaignEmails) +
    safeCount(snapshot.campaignMonitoringStats.needsReviewMonitoringItems) +
    safeCount(snapshot.templateValidationStats.needsReviewTemplates) +
    (snapshot.failoverSummary.failoverReadinessState === "needs_review" ? 1 : 0);

  const incompleteItemCount =
    snapshot.typeStats.totalItems === 0
      ? 1
      : snapshot.providerStats.totalProviders === 0
        ? 1
        : snapshot.providerStats.configuredProviders === 0 &&
            snapshot.providerStats.missingProviders === snapshot.providerStats.totalProviders
          ? 1
          : safeCount(snapshot.templateValidationStats.unknownTemplates) +
              safeCount(snapshot.providerHealthStats.unknownProviders);

  return {
    incompleteItemCount,
    invalidItemCount,
    missingRequiredRuntimeFieldsCount,
    needsReviewCount,
    riskyMetadataCount
  };
}

export function buildEmailAuditRuntimeSummarySafe(
  snapshot: EmailAuditFoundationSnapshot | null | undefined,
  registryItems?: EmailAuditRegistryItem[] | null
): EmailAuditRuntimeSummary {
  try {
    const source: EmailAuditFoundationSnapshot = snapshot ?? {
      analyticsSummary: { needsReviewCount: 0 },
      campaignEmailStats: {
        invalidCampaignEmails: 0,
        missingProviderCampaignEmails: 0,
        missingTemplateCampaignEmails: 0,
        needsReviewCampaignEmails: 0
      },
      campaignMonitoringStats: { needsReviewMonitoringItems: 0 },
      failureStats: { failedFailureItems: 0, templateErrorFailureItems: 0 },
      failoverSummary: { failoverReadinessState: "unknown" },
      lastActivityCandidates: [],
      providerHealthStats: { failedProviders: 0, missingConfigProviders: 0, unknownProviders: 0 },
      providerStats: { configuredProviders: 0, missingProviders: 0, totalProviders: 0 },
      templateValidationStats: {
        invalidTemplates: 0,
        missingBodyTemplates: 0,
        missingSubjectTemplates: 0,
        missingVariablesTemplates: 0,
        needsReviewTemplates: 0,
        unsafeContentTemplates: 0,
        unknownTemplates: 0
      },
      typeStats: { totalItems: 0 }
    };

    const counts = buildAuditCounts(source, registryItems);
    const auditState = resolveEmailAuditStateSafe(counts);
    const registryUpdatedCandidates = (Array.isArray(registryItems) ? registryItems : [])
      .map((item) => text(item.updatedAt, 80))
      .filter(Boolean);

    return {
      auditState,
      auditStateLabel: getEmailAuditStateLabel(auditState),
      invalidItemCount: counts.invalidItemCount,
      lastUpdatedLabel: resolveLastUpdatedLabelSafe([
        ...source.lastActivityCandidates,
        ...registryUpdatedCandidates
      ]),
      metadataSummary: auditStateDescriptions[auditState],
      missingRequiredRuntimeFieldsCount: counts.missingRequiredRuntimeFieldsCount,
      needsReviewCount: counts.needsReviewCount,
      riskyMetadataCount: counts.riskyMetadataCount
    };
  } catch (error) {
    console.error("[email-audit-runtime] audit runtime summary build failed", error);

    return {
      auditState: "unknown",
      auditStateLabel: getEmailAuditStateLabel("unknown"),
      invalidItemCount: 0,
      lastUpdatedLabel: "Audit activity unavailable",
      metadataSummary: "Email audit readiness foundation could not be resolved safely.",
      missingRequiredRuntimeFieldsCount: 0,
      needsReviewCount: 0,
      riskyMetadataCount: 0
    };
  }
}

export function buildEmailAuditRuntimeStatsSafe(
  snapshot: EmailAuditFoundationSnapshot | null | undefined,
  registryItems?: EmailAuditRegistryItem[] | null
): EmailAuditRuntimeStats {
  try {
    const summary = buildEmailAuditRuntimeSummarySafe(snapshot, registryItems);

    return {
      auditReadyAuditItems: summary.auditState === "audit_ready" ? 1 : 0,
      incompleteAuditItems: summary.auditState === "incomplete" ? 1 : 0,
      invalidAuditItems: summary.invalidItemCount,
      missingRequiredFieldsAuditItems: summary.missingRequiredRuntimeFieldsCount,
      needsReviewAuditItems: summary.needsReviewCount,
      riskyMetadataAuditItems: summary.riskyMetadataCount,
      totalAuditItems:
        summary.invalidItemCount +
        summary.missingRequiredRuntimeFieldsCount +
        summary.needsReviewCount +
        summary.riskyMetadataCount,
      unknownAuditItems: summary.auditState === "unknown" ? 1 : 0
    };
  } catch (error) {
    console.error("[email-audit-runtime] audit runtime stats build failed", error);

    return {
      auditReadyAuditItems: 0,
      incompleteAuditItems: 0,
      invalidAuditItems: 0,
      missingRequiredFieldsAuditItems: 0,
      needsReviewAuditItems: 0,
      riskyMetadataAuditItems: 0,
      totalAuditItems: 0,
      unknownAuditItems: 0
    };
  }
}

export function listEmailAuditRuntimeCatalog() {
  return EMAIL_AUDIT_STATES.map((auditState) => ({
    auditState,
    description: getEmailAuditStateDescription(auditState),
    label: getEmailAuditStateLabel(auditState)
  }));
}
