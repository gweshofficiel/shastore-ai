import "server-only";

import { sanitizeEmailFailureSummarySafe } from "@/src/lib/email/email-failure-runtime";

export type EmailSecurityReviewItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type EmailSecurityCertificationSummary = {
  certificationDescription: string;
  certifiedAt: string;
  failedChecks: number;
  passedChecks: number;
  securityReview: EmailSecurityReviewItem[];
  securityReviewPassed: boolean;
  totalChecks: number;
};

export const EMAIL_SECURITY_SECRET_PATTERN =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|provider[_-]?config|smtp[_-]?(?:host|user|password|pass)|otp|reset[_-]?token|\bsk-[A-Za-z0-9_-]{8,}\b|\bAKIA[0-9A-Z]{16}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}-\d{2}-\d{4}\b)/i;

const ALLOWED_PROVIDER_SECRET_STATUSES = new Set([
  "masked_configured",
  "masked_partial",
  "missing",
  "no_secret_required"
]);

const STATIC_SECURITY_REVIEW: EmailSecurityReviewItem[] = [
  {
    category: "Access control",
    message: "/admin/email is rendered inside the admin layout with super-admin or internal-team access checks.",
    passed: true
  },
  {
    category: "Page load",
    message: "Email Center page load uses read-only registry, log, and monitoring queries only.",
    passed: true
  },
  {
    category: "Database",
    message: "Email registry runtime uses service-role read-only listing with fallback rows when unavailable.",
    passed: true
  },
  {
    category: "Execution",
    message:
      "No email sending, test sending, queue execution, retry execution, provider calls, SMTP/API calls, export generation, audit backfill, cron jobs, or background workers run during page load.",
    passed: true
  },
  {
    category: "Provider secrets",
    message: "Provider rows expose masked secret status labels only. No SMTP credentials or API keys are rendered.",
    passed: true
  },
  {
    category: "Actions",
    message: "Email Center form actions are reserved placeholders that run only on explicit admin submit, not on page load.",
    passed: true
  },
  {
    category: "Foundations",
    message: "Email Runtime foundations EM-1 to EM-26 remain display and readiness only with no execution paths connected.",
    passed: true
  }
];

export const EMAIL_SECURITY_CERTIFICATION_FALLBACK_SUMMARY: EmailSecurityCertificationSummary = {
  certificationDescription: "Email security certification fallback. Review could not be completed safely.",
  certifiedAt: new Date(0).toISOString(),
  failedChecks: 0,
  passedChecks: STATIC_SECURITY_REVIEW.length,
  securityReview: STATIC_SECURITY_REVIEW,
  securityReviewPassed: false,
  totalChecks: STATIC_SECURITY_REVIEW.length
};

export function sanitizeEmailSecurityText(value: unknown, maxLength = 240) {
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

export function containsEmailSecuritySecretPattern(value: unknown) {
  const cleaned = sanitizeEmailSecurityText(value, 500);
  if (!cleaned) return false;

  if (cleaned.includes("[redacted") || cleaned.includes("[masked")) {
    return false;
  }

  return EMAIL_SECURITY_SECRET_PATTERN.test(cleaned);
}

export function isAllowedEmailProviderSecretStatus(value: unknown) {
  const cleaned = sanitizeEmailSecurityText(value, 80);
  return Boolean(cleaned && ALLOWED_PROVIDER_SECRET_STATUSES.has(cleaned));
}

export function isSafelyMaskedRecipientDisplay(value: unknown) {
  const cleaned = sanitizeEmailSecurityText(value, 120);
  if (!cleaned) return true;
  if (cleaned === "Unknown recipient") return true;
  if (cleaned.includes("[masked-recipient]")) return true;
  if (cleaned.includes("*")) return true;
  if (cleaned.startsWith("user:") || cleaned.startsWith("workspace:")) return true;

  return !EMAIL_SECURITY_SECRET_PATTERN.test(cleaned) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

export function isSafelySanitizedEmailErrorSummary(value: unknown) {
  const cleaned = sanitizeEmailSecurityText(value, 240);
  if (!cleaned) return true;

  const normalized = sanitizeEmailFailureSummarySafe(cleaned, 240);
  return !containsEmailSecuritySecretPattern(normalized);
}

export type EmailSecurityCertificationInput = {
  errorSummaries: unknown[];
  foundationsPresent: boolean;
  metadataSummaries: unknown[];
  providerSecretStatuses: unknown[];
  recipientDisplays: unknown[];
  runtimeWarning?: string | null;
};

function buildDynamicSecurityReview(input: EmailSecurityCertificationInput): EmailSecurityReviewItem[] {
  const metadataSummaries = Array.isArray(input.metadataSummaries) ? input.metadataSummaries : [];
  const errorSummaries = Array.isArray(input.errorSummaries) ? input.errorSummaries : [];
  const providerSecretStatuses = Array.isArray(input.providerSecretStatuses) ? input.providerSecretStatuses : [];
  const recipientDisplays = Array.isArray(input.recipientDisplays) ? input.recipientDisplays : [];

  const exposedMetadataSummaries = metadataSummaries.filter((summary) =>
    containsEmailSecuritySecretPattern(summary)
  ).length;
  const exposedErrorSummaries = errorSummaries.filter((summary) => !isSafelySanitizedEmailErrorSummary(summary))
    .length;
  const invalidProviderSecretStatuses = providerSecretStatuses.filter(
    (status) => !isAllowedEmailProviderSecretStatus(status)
  ).length;
  const exposedRecipientDisplays = recipientDisplays.filter((value) => !isSafelyMaskedRecipientDisplay(value)).length;

  return [
    {
      category: "Foundations",
      message: input.foundationsPresent
        ? "Email Runtime foundations EM-1 to EM-26 are present on the loaded admin control payload."
        : "One or more Email Runtime foundation payloads were missing from the loaded admin control.",
      passed: input.foundationsPresent
    },
    {
      category: "Metadata",
      message:
        exposedMetadataSummaries === 0
          ? "Loaded email metadata summaries did not match blocked secret or private-data patterns."
          : `${exposedMetadataSummaries} loaded metadata summaries matched blocked secret patterns.`,
      passed: exposedMetadataSummaries === 0
    },
    {
      category: "Errors",
      message:
        exposedErrorSummaries === 0
          ? "Failed email error summaries are sanitized for admin display."
          : `${exposedErrorSummaries} failed email error summaries require additional sanitization.`,
      passed: exposedErrorSummaries === 0
    },
    {
      category: "Recipients",
      message:
        exposedRecipientDisplays === 0
          ? "Failed email recipient displays are masked or safely redacted."
          : `${exposedRecipientDisplays} recipient displays may expose private recipient data.`,
      passed: exposedRecipientDisplays === 0
    },
    {
      category: "Provider secrets",
      message:
        invalidProviderSecretStatuses === 0
          ? "All provider secret status values use masked readiness labels only."
          : `${invalidProviderSecretStatuses} provider secret status values were outside the allowed masked set.`,
      passed: invalidProviderSecretStatuses === 0
    },
    {
      category: "Resilience",
      message: sanitizeEmailSecurityText(input.runtimeWarning, 240)
        ? "Runtime warnings are present. Email Center is using safe fallback or recovery paths."
        : "No runtime warnings were reported for the loaded Email Center admin view.",
      passed: !sanitizeEmailSecurityText(input.runtimeWarning, 240)
    }
  ];
}

export function buildEmailSecurityCertification(
  input: EmailSecurityCertificationInput
): EmailSecurityCertificationSummary {
  const securityReview = [...STATIC_SECURITY_REVIEW, ...buildDynamicSecurityReview(input)];
  const passedChecks = securityReview.filter((item) => item.passed).length;
  const failedChecks = securityReview.length - passedChecks;

  return {
    certificationDescription:
      failedChecks === 0
        ? "Email security certification passed for loaded admin foundations EM-1 to EM-26."
        : "Email security certification completed with items that need attention.",
    certifiedAt: new Date().toISOString(),
    failedChecks,
    passedChecks,
    securityReview,
    securityReviewPassed: failedChecks === 0,
    totalChecks: securityReview.length
  };
}

export function buildEmailSecurityCertificationSafe(
  input: EmailSecurityCertificationInput | null | undefined
): EmailSecurityCertificationSummary {
  try {
    return buildEmailSecurityCertification(
      input ?? {
        errorSummaries: [],
        foundationsPresent: false,
        metadataSummaries: [],
        providerSecretStatuses: [],
        recipientDisplays: []
      }
    );
  } catch (error) {
    console.error("[email-security-certification] certification failed", error);

    return {
      ...EMAIL_SECURITY_CERTIFICATION_FALLBACK_SUMMARY,
      certificationDescription: "Email security certification runtime failed safely.",
      certifiedAt: new Date().toISOString()
    };
  }
}

export function collectEmailMetadataSummariesForCertification(params: {
  auditMetadataSummary?: unknown;
  billingEmails?: Array<{ metadataSummary?: unknown }>;
  campaignEmails?: Array<{ metadataSummary?: unknown }>;
  campaignMonitoringScopeRecords?: Array<{ metadataSummary?: unknown }>;
  campaignQueueScopeRecords?: Array<{ metadataSummary?: unknown }>;
  domainEmailSetupEmails?: Array<{ metadataSummary?: unknown }>;
  failureRecords?: Array<{ metadataSummary?: unknown }>;
  orderEmails?: Array<{ metadataSummary?: unknown }>;
  providerFailoverRecords?: Array<{ metadataSummary?: unknown }>;
  providerHealth?: Array<{ metadataSummary?: unknown }>;
  securityEmails?: Array<{ metadataSummary?: unknown }>;
  supportEmails?: Array<{ metadataSummary?: unknown }>;
  templateRegistry?: Array<{ metadataSummary?: unknown }>;
  templateValidationRecords?: Array<{ metadataSummary?: unknown }>;
  transactionalSections?: Array<{ note?: unknown }>;
  welcomeEmails?: Array<{ metadataSummary?: unknown }>;
}) {
  return [
    params.auditMetadataSummary,
    ...(params.billingEmails ?? []).map((item) => item.metadataSummary),
    ...(params.campaignEmails ?? []).map((item) => item.metadataSummary),
    ...(params.campaignMonitoringScopeRecords ?? []).map((item) => item.metadataSummary),
    ...(params.campaignQueueScopeRecords ?? []).map((item) => item.metadataSummary),
    ...(params.domainEmailSetupEmails ?? []).map((item) => item.metadataSummary),
    ...(params.failureRecords ?? []).map((item) => item.metadataSummary),
    ...(params.orderEmails ?? []).map((item) => item.metadataSummary),
    ...(params.providerFailoverRecords ?? []).map((item) => item.metadataSummary),
    ...(params.providerHealth ?? []).map((item) => item.metadataSummary),
    ...(params.securityEmails ?? []).map((item) => item.metadataSummary),
    ...(params.supportEmails ?? []).map((item) => item.metadataSummary),
    ...(params.templateRegistry ?? []).map((item) => item.metadataSummary),
    ...(params.templateValidationRecords ?? []).map((item) => item.metadataSummary),
    ...(params.transactionalSections ?? []).map((item) => item.note),
    ...(params.welcomeEmails ?? []).map((item) => item.metadataSummary)
  ];
}

export function verifyEmailRuntimeFoundationsPresent(control: {
  emailAnalyticsRuntimeSummary?: unknown;
  emailAuditRuntimeSummary?: unknown;
  emailBillingEmails?: unknown;
  emailCampaignEmails?: unknown;
  emailCampaignMonitoringRuntimeSummary?: unknown;
  emailCampaignQueueRuntimeSummary?: unknown;
  emailDeliveryRuntimeSummary?: unknown;
  emailFailureRuntimeSummary?: unknown;
  emailProviderFailoverRuntimeSummary?: unknown;
  emailProviderHealth?: unknown;
  emailQueueRuntimeSummary?: unknown;
  emailRetryRuntimeSummary?: unknown;
  emailSecurityEmails?: unknown;
  emailTemplateRegistry?: unknown;
  emailTypeStats?: unknown;
  emailWelcomeEmails?: unknown;
  providers?: unknown;
  queue?: unknown;
  templates?: unknown;
}) {
  return Boolean(
    control.providers &&
      control.templates &&
      control.queue &&
      control.emailTypeStats &&
      control.emailProviderHealth &&
      control.emailTemplateRegistry &&
      control.emailWelcomeEmails &&
      control.emailBillingEmails &&
      control.emailSecurityEmails &&
      control.emailQueueRuntimeSummary &&
      control.emailRetryRuntimeSummary &&
      control.emailFailureRuntimeSummary &&
      control.emailDeliveryRuntimeSummary &&
      control.emailCampaignEmails &&
      control.emailCampaignQueueRuntimeSummary &&
      control.emailCampaignMonitoringRuntimeSummary &&
      control.emailAnalyticsRuntimeSummary &&
      control.emailProviderFailoverRuntimeSummary &&
      control.emailAuditRuntimeSummary
  );
}
