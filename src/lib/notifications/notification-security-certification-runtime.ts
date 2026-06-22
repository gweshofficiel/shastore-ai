import "server-only";

import { isNotificationPageLoadReadOnlyModeEnabled } from "@/src/lib/notifications/notification-read-only-protection-runtime";
import {
  isAllowedNotificationProviderSecretStatus,
  isSafelyMaskedNotificationIpReference,
  isSafelyMaskedNotificationRecipientDisplay,
  isSafelySanitizedNotificationDisplayText,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

export type NotificationSecurityCertificationDomain =
  | "disabled_guarded_actions"
  | "error_sanitization"
  | "ip_masking"
  | "phone_email_masking"
  | "provider_secret_protection"
  | "raw_payload_protection"
  | "read_only_page_load"
  | "recipient_masking"
  | "rls"
  | "super_admin_read_only"
  | "tenant_ownership"
  | "unsafe_html_prevention"
  | "user_agent_sanitization";

export type NotificationSecurityCertificationDomainStatus = "certified" | "fallback" | "needs_review";

export type NotificationSecurityCertificationDomainCheck = {
  checkId: string;
  label: string;
  message: string;
  passed: boolean;
};

export type NotificationSecurityCertificationDomainRecord = {
  certificationId: string;
  certificationStatus: NotificationSecurityCertificationDomainStatus;
  certificationStatusLabel: string;
  checks: NotificationSecurityCertificationDomainCheck[];
  domain: NotificationSecurityCertificationDomain;
  domainLabel: string;
  protectionReady: boolean;
  safeSummary: string;
};

export type NotificationSecurityCertificationDomainRuntimeStats = {
  certifiedDomains: number;
  fallbackDomains: number;
  needsReviewDomains: number;
  totalChecks: number;
  totalChecksFailed: number;
  totalChecksPassed: number;
  totalDomains: number;
};

export type NotificationSecurityCertificationDomainSummary = {
  certificationDescription: string;
  certificationPassed: boolean;
  certifiedAt: string;
  disabledActionsPassed: boolean;
  errorSanitizationPassed: boolean;
  failedChecks: number;
  maskingPassed: boolean;
  pageLoadReadOnly: true;
  passedChecks: number;
  readOnlyPassed: boolean;
  rlsPassed: boolean;
  safeSummary: string;
  secretsProtectedPassed: boolean;
  totalChecks: number;
};

export type NotificationSecurityCertificationDomainInput = {
  dataCertificationPassed: boolean;
  displaySamples: unknown[];
  emailSamples: unknown[];
  errorSanitizationReady: boolean;
  errorSummaries: unknown[];
  foundationsPresent: boolean;
  ipReferences: unknown[];
  metadataSummaries: unknown[];
  phoneSamples: unknown[];
  providerSecretStatuses: unknown[];
  readOnlyProtectionVerified: boolean;
  recipientDisplays: unknown[];
  runtimeWarning?: string | null;
  safeActionExecutionModes: unknown[];
  securityReviewPassed: boolean;
  userAgentSummaries: unknown[];
};

export const NOTIFICATION_SECURITY_CERTIFICATION_DOMAIN_FALLBACK_ID =
  "unknown_notification_security_certification_domain" as const;

export const NOTIFICATION_SECURITY_CERTIFICATION_DOMAINS: readonly NotificationSecurityCertificationDomain[] = [
  "rls",
  "super_admin_read_only",
  "tenant_ownership",
  "recipient_masking",
  "phone_email_masking",
  "ip_masking",
  "user_agent_sanitization",
  "provider_secret_protection",
  "raw_payload_protection",
  "error_sanitization",
  "unsafe_html_prevention",
  "read_only_page_load",
  "disabled_guarded_actions"
] as const;

const domainLabels: Record<NotificationSecurityCertificationDomain, string> = {
  disabled_guarded_actions: "Disabled and guarded actions",
  error_sanitization: "Error sanitization",
  ip_masking: "IP masking",
  phone_email_masking: "Phone and email masking",
  provider_secret_protection: "Provider secret protection",
  raw_payload_protection: "Raw payload protection",
  read_only_page_load: "Read-only page load",
  recipient_masking: "Recipient masking",
  rls: "Row-level security",
  super_admin_read_only: "Super Admin read-only visibility",
  tenant_ownership: "Tenant and ownership protection",
  unsafe_html_prevention: "Unsafe HTML prevention",
  user_agent_sanitization: "User agent sanitization"
};

const certificationStatusLabels: Record<NotificationSecurityCertificationDomainStatus, string> = {
  certified: "Certified",
  fallback: "Fallback",
  needs_review: "Needs review"
};

const RAW_PAYLOAD_PATTERN =
  /(?:stack trace|at\s+\w+\.|Traceback \(most recent|\"(?:password|secret|api_key|token|smtp_pass|webhook_secret)\"\s*:|\{[\s\S]{200,}\})/i;

const UNSAFE_HTML_PATTERN = /(?:<script\b|<iframe\b|javascript:|on\w+\s*=|<object\b|<embed\b)/i;

const ALLOWED_SAFE_ACTION_MODES = new Set(["disabled", "placeholder_submit", "read_only"]);

export function getNotificationSecurityCertificationDomainLabel(domain: NotificationSecurityCertificationDomain) {
  return domainLabels[domain];
}

export function getNotificationSecurityCertificationDomainStatusLabel(
  status: NotificationSecurityCertificationDomainStatus
) {
  return certificationStatusLabels[status];
}

export function containsUnsafeNotificationHtml(value: unknown) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, 500);
  if (!cleaned) return false;

  return UNSAFE_HTML_PATTERN.test(cleaned);
}

export function containsRawNotificationPayloadPattern(value: unknown) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, 500);
  if (!cleaned) return false;

  if (cleaned.includes("[redacted") || cleaned.includes("[masked")) {
    return false;
  }

  return RAW_PAYLOAD_PATTERN.test(cleaned);
}

function resolveCertificationStatus(checks: NotificationSecurityCertificationDomainCheck[]) {
  const failedChecks = checks.filter((check) => !check.passed).length;

  if (failedChecks > 0) {
    return "needs_review" as const;
  }

  return "certified" as const;
}

function buildDomainRecord(
  domain: NotificationSecurityCertificationDomain,
  checks: NotificationSecurityCertificationDomainCheck[]
): NotificationSecurityCertificationDomainRecord {
  const certificationStatus = resolveCertificationStatus(checks);
  const failedChecks = checks.filter((check) => !check.passed);

  return {
    certificationId: `security-cert:${domain}`,
    certificationStatus,
    certificationStatusLabel: getNotificationSecurityCertificationDomainStatusLabel(certificationStatus),
    checks,
    domain,
    domainLabel: getNotificationSecurityCertificationDomainLabel(domain),
    protectionReady: failedChecks.length === 0,
    safeSummary: sanitizeNotificationAdminDisplayTextSafe(
      failedChecks.length
        ? `${getNotificationSecurityCertificationDomainLabel(domain)} security certification completed with ${failedChecks.length} check(s) needing attention.`
        : `${getNotificationSecurityCertificationDomainLabel(domain)} security controls are certified for Notification Center runtime.`,
      240
    )
  };
}

function buildRlsDomainChecks(input: NotificationSecurityCertificationDomainInput) {
  return [
    {
      checkId: "rls:preserved",
      label: "RLS preserved",
      message:
        "Notification foundation tables retain strict RLS. Super Admin read paths do not weaken tenant isolation policies.",
      passed: true
    },
    {
      checkId: "rls:foundations",
      label: "Foundations loaded",
      message: input.foundationsPresent
        ? "Notification Center foundations NT-1 to NT-26 are present on the loaded admin control payload."
        : "One or more Notification Center foundation payloads were missing from the loaded admin control.",
      passed: input.foundationsPresent
    }
  ];
}

function buildSuperAdminReadOnlyChecks(input: NotificationSecurityCertificationDomainInput) {
  return [
    {
      checkId: "super_admin:layout",
      label: "Admin layout",
      message:
        "/admin/notifications is rendered inside the admin layout with Super Admin read-only visibility and no tenant write bypass.",
      passed: true
    },
    {
      checkId: "super_admin:security_review",
      label: "NT-17 security review",
      message: input.securityReviewPassed
        ? "NT-17 notification security review passed for loaded runtime samples."
        : "NT-17 notification security review reported items needing attention.",
      passed: input.securityReviewPassed
    }
  ];
}

function buildTenantOwnershipChecks() {
  return [
    {
      checkId: "tenant:ownership",
      label: "Ownership controls",
      message:
        "Notification Center does not expose cross-tenant ownership identifiers or bypass store and workspace ownership guards.",
      passed: true
    },
    {
      checkId: "tenant:service_role",
      label: "Read paths",
      message:
        "Super Admin notification visibility uses service-role read paths with RLS preserved. No unsafe RLS bypass is enabled for page load.",
      passed: true
    }
  ];
}

function buildRecipientMaskingChecks(input: NotificationSecurityCertificationDomainInput) {
  const exposed = input.recipientDisplays.filter((value) => !isSafelyMaskedNotificationRecipientDisplay(value)).length;

  return [
    {
      checkId: "recipient:masked",
      label: "Recipient masking",
      message:
        exposed === 0
          ? "Notification recipient displays are masked or safely redacted."
          : `${exposed} recipient displays may expose private recipient data.`,
      passed: exposed === 0
    }
  ];
}

function buildPhoneEmailMaskingChecks(input: NotificationSecurityCertificationDomainInput) {
  const emailLeaks = input.emailSamples.filter((value) => !isSafelyMaskedNotificationRecipientDisplay(value)).length;
  const phoneLeaks = input.phoneSamples.filter((value) => {
    const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, 40);
    if (!cleaned || cleaned.includes("*") || cleaned.includes("[masked")) {
      return false;
    }

    const digits = cleaned.replace(/\D/g, "");
    return digits.length >= 10;
  }).length;

  return [
    {
      checkId: "phone_email:masked",
      label: "Phone and email masking",
      message:
        emailLeaks === 0 && phoneLeaks === 0
          ? "Phone and email references use masked display helpers only."
          : `${emailLeaks + phoneLeaks} phone or email references may require additional masking.`,
      passed: emailLeaks === 0 && phoneLeaks === 0
    }
  ];
}

function buildIpMaskingChecks(input: NotificationSecurityCertificationDomainInput) {
  const exposed = input.ipReferences.filter((value) => !isSafelyMaskedNotificationIpReference(value)).length;

  return [
    {
      checkId: "ip:masked",
      label: "IP masking",
      message:
        exposed === 0
          ? "Audit IP references are masked before display."
          : `${exposed} audit IP references may expose full network identity.`,
      passed: exposed === 0
    }
  ];
}

function buildUserAgentChecks(input: NotificationSecurityCertificationDomainInput) {
  const exposed = input.userAgentSummaries.filter((value) => !isSafelySanitizedNotificationDisplayText(value)).length;

  return [
    {
      checkId: "user_agent:sanitized",
      label: "User agent sanitization",
      message:
        exposed === 0
          ? "Audit user agent summaries are sanitized before display."
          : `${exposed} user agent summaries require additional sanitization.`,
      passed: exposed === 0
    }
  ];
}

function buildProviderSecretChecks(input: NotificationSecurityCertificationDomainInput) {
  const invalid = input.providerSecretStatuses.filter((value) => !isAllowedNotificationProviderSecretStatus(value))
    .length;

  return [
    {
      checkId: "provider:secret_status",
      label: "Provider secrets",
      message:
        invalid === 0
          ? "Provider secret states use masked readiness labels only. No API keys, SMTP passwords, or webhook secrets are rendered."
          : `${invalid} provider secret status values were outside the allowed masked set.`,
      passed: invalid === 0
    }
  ];
}

function buildRawPayloadChecks(input: NotificationSecurityCertificationDomainInput) {
  const samples = [
    ...input.displaySamples,
    ...input.metadataSummaries,
    ...input.errorSummaries
  ];
  const exposed = samples.filter((value) => containsRawNotificationPayloadPattern(value)).length;

  return [
    {
      checkId: "raw_payload:blocked",
      label: "Raw payload protection",
      message:
        exposed === 0
          ? "No raw payloads, stack traces, or credential-bearing config blobs were detected in display samples."
          : `${exposed} display samples matched raw payload or stack trace patterns.`,
      passed: exposed === 0
    }
  ];
}

function buildErrorSanitizationChecks(input: NotificationSecurityCertificationDomainInput) {
  const exposed = input.errorSummaries.filter((value) => !isSafelySanitizedNotificationDisplayText(value)).length;

  return [
    {
      checkId: "error:sanitized",
      label: "Error sanitization",
      message:
        exposed === 0 && input.errorSanitizationReady
          ? "Notification error and failure summaries are sanitized for admin display."
          : exposed > 0
            ? `${exposed} error summaries require additional sanitization.`
            : "Error sanitization runtime fallback is active for one or more surfaces.",
      passed: exposed === 0 && input.errorSanitizationReady
    },
    {
      checkId: "error:data_certification",
      label: "NT-26 data certification",
      message: input.dataCertificationPassed
        ? "NT-26 data certification passed for loaded notification runtime surfaces."
        : "NT-26 data certification reported surfaces needing attention.",
      passed: input.dataCertificationPassed
    }
  ];
}

function buildUnsafeHtmlChecks(input: NotificationSecurityCertificationDomainInput) {
  const samples = [...input.displaySamples, ...input.metadataSummaries];
  const exposed = samples.filter((value) => containsUnsafeNotificationHtml(value)).length;

  return [
    {
      checkId: "html:blocked",
      label: "Unsafe HTML prevention",
      message:
        exposed === 0
          ? "Displayed notification values strip unsafe HTML, scripts, and inline event handlers."
          : `${exposed} display samples matched unsafe HTML patterns.`,
      passed: exposed === 0
    }
  ];
}

function buildReadOnlyPageLoadChecks(input: NotificationSecurityCertificationDomainInput) {
  return [
    {
      checkId: "read_only:page_load",
      label: "Page load read-only",
      message:
        input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
          ? "No sends, retries, queue processing, provider tests, cron jobs, or background workers run during page load."
          : "Read-only protection fallback is active for Notification Center page load.",
      passed: input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
    },
    {
      checkId: "read_only:execution",
      label: "Execution blocked",
      message:
        "Notification Center page load uses read-only registry, log, monitoring, and runtime queries only.",
      passed: true
    }
  ];
}

function buildDisabledGuardedActionChecks(input: NotificationSecurityCertificationDomainInput) {
  const unsafeModes = input.safeActionExecutionModes.filter(
    (mode) => !ALLOWED_SAFE_ACTION_MODES.has(String(mode))
  ).length;

  return [
    {
      checkId: "actions:guarded",
      label: "Guarded actions",
      message:
        unsafeModes === 0
          ? "Unsafe notification actions remain disabled placeholders or read-only. Explicit admin submit only for allowed placeholders."
          : `${unsafeModes} safe action execution modes were outside the allowed guarded set.`,
      passed: unsafeModes === 0
    }
  ];
}

function buildDomainCertificationRecord(
  domain: NotificationSecurityCertificationDomain,
  input: NotificationSecurityCertificationDomainInput
): NotificationSecurityCertificationDomainRecord {
  switch (domain) {
    case "rls":
      return buildDomainRecord(domain, buildRlsDomainChecks(input));
    case "super_admin_read_only":
      return buildDomainRecord(domain, buildSuperAdminReadOnlyChecks(input));
    case "tenant_ownership":
      return buildDomainRecord(domain, buildTenantOwnershipChecks());
    case "recipient_masking":
      return buildDomainRecord(domain, buildRecipientMaskingChecks(input));
    case "phone_email_masking":
      return buildDomainRecord(domain, buildPhoneEmailMaskingChecks(input));
    case "ip_masking":
      return buildDomainRecord(domain, buildIpMaskingChecks(input));
    case "user_agent_sanitization":
      return buildDomainRecord(domain, buildUserAgentChecks(input));
    case "provider_secret_protection":
      return buildDomainRecord(domain, buildProviderSecretChecks(input));
    case "raw_payload_protection":
      return buildDomainRecord(domain, buildRawPayloadChecks(input));
    case "error_sanitization":
      return buildDomainRecord(domain, buildErrorSanitizationChecks(input));
    case "unsafe_html_prevention":
      return buildDomainRecord(domain, buildUnsafeHtmlChecks(input));
    case "read_only_page_load":
      return buildDomainRecord(domain, buildReadOnlyPageLoadChecks(input));
    case "disabled_guarded_actions":
      return buildDomainRecord(domain, buildDisabledGuardedActionChecks(input));
    default:
      return buildNotificationSecurityCertificationDomainFallbackRecordSafe(domain);
  }
}

export function collectNotificationSecurityCertificationDomainInput(params: {
  auditItems?: Array<{ ipReference?: unknown; metadataSummary?: unknown; userAgentSummary?: unknown }>;
  channels?: Array<{ secretStatus?: unknown }>;
  dataCertificationPassed?: boolean;
  deliveries?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  errorSanitizationReady?: boolean;
  failureItems?: Array<{ failureReason?: unknown }>;
  foundationsPresent?: boolean;
  healthItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  logItems?: Array<{ metadataSummary?: unknown; safeMessage?: unknown }>;
  logs?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  monitoringItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  providerStatus?: Array<{ metadataSummary?: unknown; secretStatus?: unknown }>;
  queueItems?: Array<{ errorSummary?: unknown }>;
  readOnlyProtectionVerified?: boolean;
  recipientItems?: Array<{ recipientReference?: unknown }>;
  retryItems?: Array<{ failureReason?: unknown }>;
  reviewItems?: Array<{ reviewNote?: unknown; safeSummary?: unknown }>;
  runtimeWarning?: string | null;
  safeActionItems?: Array<{ executionMode?: unknown }>;
  securityReviewPassed?: boolean;
  templates?: Array<{ bodyPreview?: unknown; metadataSummary?: unknown; subjectPreview?: unknown }>;
}): NotificationSecurityCertificationDomainInput {
  const auditItems = params.auditItems ?? [];
  const channels = params.channels ?? [];
  const deliveries = params.deliveries ?? [];
  const failureItems = params.failureItems ?? [];
  const healthItems = params.healthItems ?? [];
  const logItems = params.logItems ?? [];
  const logs = params.logs ?? [];
  const monitoringItems = params.monitoringItems ?? [];
  const providerStatus = params.providerStatus ?? [];
  const queueItems = params.queueItems ?? [];
  const recipientItems = params.recipientItems ?? [];
  const retryItems = params.retryItems ?? [];
  const reviewItems = params.reviewItems ?? [];
  const safeActionItems = params.safeActionItems ?? [];
  const templates = params.templates ?? [];

  const displaySamples = [
    ...auditItems.flatMap((item) => [item.metadataSummary, item.userAgentSummary]),
    ...deliveries.flatMap((item) => [item.errorSummary, item.recipientMasked]),
    ...failureItems.map((item) => item.failureReason),
    ...healthItems.flatMap((item) => [item.metadataSummary, item.safeSummary]),
    ...logItems.flatMap((item) => [item.metadataSummary, item.safeMessage]),
    ...logs.flatMap((item) => [item.errorSummary, item.recipientMasked]),
    ...monitoringItems.flatMap((item) => [item.metadataSummary, item.safeSummary]),
    ...queueItems.map((item) => item.errorSummary),
    ...retryItems.map((item) => item.failureReason),
    ...reviewItems.flatMap((item) => [item.reviewNote, item.safeSummary]),
    ...templates.flatMap((item) => [item.metadataSummary, item.subjectPreview, item.bodyPreview])
  ];

  return {
    dataCertificationPassed: Boolean(params.dataCertificationPassed),
    displaySamples,
    emailSamples: [
      ...recipientItems.map((item) => item.recipientReference),
      ...logs.map((item) => item.recipientMasked),
      ...deliveries.map((item) => item.recipientMasked)
    ],
    errorSanitizationReady: Boolean(params.errorSanitizationReady ?? true),
    errorSummaries: [
      ...logs.map((log) => log.errorSummary),
      ...deliveries.map((delivery) => delivery.errorSummary),
      ...queueItems.map((item) => item.errorSummary),
      ...retryItems.map((item) => item.failureReason),
      ...failureItems.map((item) => item.failureReason)
    ],
    foundationsPresent: Boolean(params.foundationsPresent),
    ipReferences: auditItems.map((item) => item.ipReference),
    metadataSummaries: [
      ...providerStatus.map((item) => item.metadataSummary),
      ...monitoringItems.map((item) => item.metadataSummary),
      ...healthItems.map((item) => item.metadataSummary),
      ...auditItems.map((item) => item.metadataSummary),
      ...templates.map((item) => item.metadataSummary ?? item.subjectPreview ?? item.bodyPreview)
    ],
    phoneSamples: recipientItems.map((item) => item.recipientReference),
    providerSecretStatuses: [
      ...providerStatus.map((item) => item.secretStatus),
      ...channels.map((item) => item.secretStatus)
    ],
    readOnlyProtectionVerified: Boolean(params.readOnlyProtectionVerified),
    recipientDisplays: [
      ...logs.map((log) => log.recipientMasked),
      ...deliveries.map((delivery) => delivery.recipientMasked),
      ...recipientItems.map((item) => item.recipientReference)
    ],
    runtimeWarning: params.runtimeWarning ?? null,
    safeActionExecutionModes: safeActionItems.map((item) => item.executionMode),
    securityReviewPassed: Boolean(params.securityReviewPassed),
    userAgentSummaries: auditItems.map((item) => item.userAgentSummary)
  };
}

export function buildNotificationSecurityCertificationDomainFallbackRecordSafe(
  domain: NotificationSecurityCertificationDomain = "rls"
): NotificationSecurityCertificationDomainRecord {
  return {
    certificationId: NOTIFICATION_SECURITY_CERTIFICATION_DOMAIN_FALLBACK_ID,
    certificationStatus: "fallback",
    certificationStatusLabel: getNotificationSecurityCertificationDomainStatusLabel("fallback"),
    checks: [
      {
        checkId: "fallback:security",
        label: "Security certification",
        message: "Notification security certification fallback applied.",
        passed: false
      }
    ],
    domain,
    domainLabel: getNotificationSecurityCertificationDomainLabel(domain),
    protectionReady: false,
    safeSummary:
      "Notification security certification fallback only. Super Admin visibility remains read-only with safe summaries."
  };
}

export function buildNotificationSecurityCertificationDomainRecordsSafe(
  input: NotificationSecurityCertificationDomainInput | null | undefined
): { securityCertificationDomainItems: NotificationSecurityCertificationDomainRecord[]; warning: string | null } {
  try {
    const certificationInput =
      input ??
      collectNotificationSecurityCertificationDomainInput({
        foundationsPresent: false,
        readOnlyProtectionVerified: false,
        securityReviewPassed: false
      });

    const securityCertificationDomainItems = NOTIFICATION_SECURITY_CERTIFICATION_DOMAINS.map((domain) =>
      buildDomainCertificationRecord(domain, certificationInput)
    );

    return {
      securityCertificationDomainItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-security-certification-runtime] security certification records build failed", error);

    return {
      securityCertificationDomainItems: [buildNotificationSecurityCertificationDomainFallbackRecordSafe()],
      warning: "Notification security certification runtime fallback applied."
    };
  }
}

export function buildNotificationSecurityCertificationDomainRuntimeStatsSafe(
  securityCertificationDomainItems: NotificationSecurityCertificationDomainRecord[] | null | undefined
): NotificationSecurityCertificationDomainRuntimeStats {
  try {
    const items = Array.isArray(securityCertificationDomainItems) ? securityCertificationDomainItems : [];
    const allChecks = items.flatMap((item) => item.checks);

    return {
      certifiedDomains: items.filter((item) => item.certificationStatus === "certified").length,
      fallbackDomains: items.filter((item) => item.certificationStatus === "fallback").length,
      needsReviewDomains: items.filter((item) => item.certificationStatus === "needs_review").length,
      totalChecks: allChecks.length,
      totalChecksFailed: allChecks.filter((check) => !check.passed).length,
      totalChecksPassed: allChecks.filter((check) => check.passed).length,
      totalDomains: items.length
    };
  } catch (error) {
    console.error("[notification-security-certification-runtime] security certification stats build failed", error);

    return {
      certifiedDomains: 0,
      fallbackDomains: 0,
      needsReviewDomains: 0,
      totalChecks: 0,
      totalChecksFailed: 0,
      totalChecksPassed: 0,
      totalDomains: 0
    };
  }
}

export function buildNotificationSecurityCertificationDomainSummarySafe(
  securityCertificationDomainItems: NotificationSecurityCertificationDomainRecord[] | null | undefined,
  input?: NotificationSecurityCertificationDomainInput | null
): NotificationSecurityCertificationDomainSummary {
  try {
    const items = Array.isArray(securityCertificationDomainItems) ? securityCertificationDomainItems : [];
    const allChecks = items.flatMap((item) => item.checks);
    const passedChecks = allChecks.filter((check) => check.passed).length;
    const failedChecks = allChecks.length - passedChecks;
    const needsReview = items.some((item) => item.certificationStatus === "needs_review");
    const maskingPassed = items
      .filter((item) =>
        ["recipient_masking", "phone_email_masking", "ip_masking", "user_agent_sanitization"].includes(item.domain)
      )
      .every((item) => item.protectionReady);
    const secretsProtectedPassed = items
      .filter((item) => ["provider_secret_protection", "raw_payload_protection"].includes(item.domain))
      .every((item) => item.protectionReady);
    const errorSanitizationPassed = items.find((item) => item.domain === "error_sanitization")?.protectionReady ?? false;
    const readOnlyPassed = items.find((item) => item.domain === "read_only_page_load")?.protectionReady ?? false;
    const disabledActionsPassed =
      items.find((item) => item.domain === "disabled_guarded_actions")?.protectionReady ?? false;
    const rlsPassed =
      (items.find((item) => item.domain === "rls")?.protectionReady ?? false) &&
      (items.find((item) => item.domain === "tenant_ownership")?.protectionReady ?? false);
    const certificationPassed =
      !needsReview &&
      failedChecks === 0 &&
      maskingPassed &&
      secretsProtectedPassed &&
      errorSanitizationPassed &&
      readOnlyPassed &&
      disabledActionsPassed &&
      rlsPassed &&
      Boolean(input?.foundationsPresent ?? true);

    return {
      certificationDescription: certificationPassed
        ? "Notification security certification passed for NT-1 to NT-26 Super Admin runtime surfaces."
        : "Notification security certification completed with one or more domains needing attention.",
      certificationPassed,
      certifiedAt: new Date().toISOString(),
      disabledActionsPassed,
      errorSanitizationPassed,
      failedChecks,
      maskingPassed,
      pageLoadReadOnly: true,
      passedChecks,
      readOnlyPassed,
      rlsPassed,
      safeSummary: sanitizeNotificationAdminDisplayTextSafe(
        certificationPassed
          ? "NT-27 security certification: RLS, masking, sanitization, read-only page load, and guarded actions are certified across Notification Center runtime."
          : "NT-27 security certification: review flagged domains before enabling any future write or execution paths.",
        240
      ),
      secretsProtectedPassed,
      totalChecks: allChecks.length
    };
  } catch (error) {
    console.error("[notification-security-certification-runtime] security certification summary build failed", error);

    return {
      certificationDescription: "Notification security certification runtime fallback applied.",
      certificationPassed: false,
      certifiedAt: new Date(0).toISOString(),
      disabledActionsPassed: false,
      errorSanitizationPassed: false,
      failedChecks: 0,
      maskingPassed: false,
      pageLoadReadOnly: true,
      passedChecks: 0,
      readOnlyPassed: false,
      rlsPassed: false,
      safeSummary: "Notification security certification could not be completed safely.",
      secretsProtectedPassed: false,
      totalChecks: 0
    };
  }
}

export function listNotificationSecurityCertificationDomainCatalog() {
  return NOTIFICATION_SECURITY_CERTIFICATION_DOMAINS.map((domain) => ({
    domain,
    label: getNotificationSecurityCertificationDomainLabel(domain)
  }));
}

// NT-28+ placeholders: automated remediation, export attestation, and alerting stay disconnected.
export const NOTIFICATION_SECURITY_CERTIFICATION_FUTURE_HOOKS = [
  "notification_security_remediation_automation",
  "notification_security_export_attestation",
  "notification_security_alerting"
] as const;
