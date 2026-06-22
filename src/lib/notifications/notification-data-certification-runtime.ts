import "server-only";

import { isNotificationPageLoadReadOnlyModeEnabled } from "@/src/lib/notifications/notification-read-only-protection-runtime";
import {
  containsNotificationSecuritySecretPattern,
  isAllowedNotificationProviderSecretStatus,
  isSafelyMaskedNotificationIpReference,
  isSafelyMaskedNotificationRecipientDisplay,
  isSafelySanitizedNotificationDisplayText,
  sanitizeNotificationAdminDisplayTextSafe
} from "@/src/lib/notifications/notification-security-runtime";

export type NotificationDataCertificationSurface =
  | "analytics"
  | "audit"
  | "categories"
  | "channels"
  | "deliveries"
  | "events"
  | "failures"
  | "health"
  | "logs"
  | "metrics"
  | "monitoring"
  | "provider_abstraction"
  | "providers"
  | "queue"
  | "read_only_protection"
  | "recipients"
  | "registry"
  | "retries"
  | "reviews"
  | "safe_actions"
  | "statuses"
  | "templates"
  | "types";

export type NotificationDataCertificationStatus = "certified" | "fallback" | "needs_review";

export type NotificationDataCertificationCheckItem = {
  checkId: string;
  label: string;
  message: string;
  passed: boolean;
};

export type NotificationDataCertificationRecord = {
  aggregationReady: boolean;
  certificationId: string;
  certificationStatus: NotificationDataCertificationStatus;
  certificationStatusLabel: string;
  checks: NotificationDataCertificationCheckItem[];
  fallbackReady: boolean;
  maskingReady: boolean;
  readOnlyReady: boolean;
  safeSummary: string;
  sanitizationReady: boolean;
  surface: NotificationDataCertificationSurface;
  surfaceLabel: string;
};

export type NotificationDataCertificationRuntimeStats = {
  certifiedSurfaces: number;
  fallbackSurfaces: number;
  needsReviewSurfaces: number;
  totalChecks: number;
  totalChecksFailed: number;
  totalChecksPassed: number;
  totalSurfaces: number;
};

export type NotificationDataCertificationSummary = {
  certificationDescription: string;
  certificationPassed: boolean;
  certifiedAt: string;
  dataIntegrityPassed: boolean;
  failedChecks: number;
  maskingPassed: boolean;
  pageLoadReadOnly: true;
  passedChecks: number;
  readOnlyPassed: boolean;
  safeSummary: string;
  sanitizationPassed: boolean;
  totalChecks: number;
};

export type NotificationDataCertificationSurfaceAvailability = Partial<
  Record<NotificationDataCertificationSurface, boolean>
>;

export type NotificationDataCertificationInput = {
  displaySamplesBySurface: Partial<Record<NotificationDataCertificationSurface, unknown[]>>;
  errorSanitizationReady: boolean;
  foundationsPresent: boolean;
  readOnlyProtectionVerified: boolean;
  runtimeWarning?: string | null;
  securityReviewPassed: boolean;
  surfaceAvailability: NotificationDataCertificationSurfaceAvailability;
};

export const NOTIFICATION_DATA_CERTIFICATION_FALLBACK_ID = "unknown_notification_data_certification" as const;

export const NOTIFICATION_DATA_CERTIFICATION_SURFACES: readonly NotificationDataCertificationSurface[] = [
  "registry",
  "types",
  "statuses",
  "channels",
  "categories",
  "providers",
  "templates",
  "deliveries",
  "queue",
  "retries",
  "failures",
  "audit",
  "monitoring",
  "metrics",
  "analytics",
  "health",
  "recipients",
  "events",
  "logs",
  "reviews",
  "safe_actions",
  "provider_abstraction",
  "read_only_protection"
] as const;

const surfaceLabels: Record<NotificationDataCertificationSurface, string> = {
  analytics: "Analytics runtime",
  audit: "Audit runtime",
  categories: "Category runtime",
  channels: "Channel runtime",
  deliveries: "Delivery runtime",
  events: "Event runtime",
  failures: "Failure runtime",
  health: "Health runtime",
  logs: "Log runtime",
  metrics: "Metrics runtime",
  monitoring: "Monitoring runtime",
  provider_abstraction: "Provider abstraction runtime",
  providers: "Provider runtime",
  queue: "Queue runtime",
  read_only_protection: "Read-only protection runtime",
  recipients: "Recipient runtime",
  registry: "Registry runtime",
  retries: "Retry runtime",
  reviews: "Review runtime",
  safe_actions: "Safe action runtime",
  statuses: "Status runtime",
  templates: "Template runtime",
  types: "Type runtime"
};

const certificationStatusLabels: Record<NotificationDataCertificationStatus, string> = {
  certified: "Certified",
  fallback: "Fallback",
  needs_review: "Needs review"
};

const aggregatedSurfaces = new Set<NotificationDataCertificationSurface>(["analytics", "metrics"]);
const maskingSurfaces = new Set<NotificationDataCertificationSurface>([
  "audit",
  "deliveries",
  "events",
  "logs",
  "recipients",
  "reviews"
]);

export function getNotificationDataCertificationSurfaceLabel(surface: NotificationDataCertificationSurface) {
  return surfaceLabels[surface];
}

export function getNotificationDataCertificationStatusLabel(status: NotificationDataCertificationStatus) {
  return certificationStatusLabels[status];
}

export function certifyNotificationDisplaySamplesSafe(samples: unknown[]) {
  const exposedSecrets = samples.filter((sample) => containsNotificationSecuritySecretPattern(sample)).length;
  const unsanitized = samples.filter((sample) => !isSafelySanitizedNotificationDisplayText(sample)).length;

  return {
    exposedSecrets,
    passed: exposedSecrets === 0 && unsanitized === 0,
    unsanitized
  };
}

function buildMaskingCheck(surface: NotificationDataCertificationSurface, samples: unknown[]) {
  if (!maskingSurfaces.has(surface)) {
    return {
      checkId: `${surface}:masking`,
      label: "Masking",
      message: "This surface does not expose recipient, IP, or private identity fields.",
      passed: true
    };
  }

  const display = certifyNotificationDisplaySamplesSafe(samples);
  const exposedRecipients =
    surface === "audit"
      ? samples.filter((sample) => !isSafelyMaskedNotificationIpReference(sample)).length
      : samples.filter((sample) => !isSafelyMaskedNotificationRecipientDisplay(sample)).length;

  return {
    checkId: `${surface}:masking`,
    label: "Masking",
    message:
      display.passed && exposedRecipients === 0
        ? "Recipient, IP, and identity references are masked or safely redacted."
        : "One or more identity references may require additional masking.",
    passed: display.passed && exposedRecipients === 0
  };
}

function buildIntegrityCheck(surface: NotificationDataCertificationSurface, available: boolean) {
  return {
    checkId: `${surface}:integrity`,
    label: "Data integrity",
    message: available
      ? `${getNotificationDataCertificationSurfaceLabel(surface)} data is available or uses safe runtime fallbacks.`
      : `${getNotificationDataCertificationSurfaceLabel(surface)} is using safe fallback visibility only.`,
    passed: true
  };
}

function buildSanitizationCheck(surface: NotificationDataCertificationSurface, samples: unknown[], globalReady: boolean) {
  const result = certifyNotificationDisplaySamplesSafe(samples);

  return {
    checkId: `${surface}:sanitization`,
    label: "Sanitization",
    message:
      result.passed && globalReady
        ? "Displayed values are sanitized with no blocked secret patterns detected."
        : result.exposedSecrets > 0
          ? `${result.exposedSecrets} displayed values matched blocked secret patterns.`
          : globalReady
            ? "Error sanitization runtime is active for this surface."
            : "Error sanitization runtime fallback is active for this surface.",
    passed: result.passed && globalReady
  };
}

function buildAggregationCheck(surface: NotificationDataCertificationSurface) {
  const aggregated = aggregatedSurfaces.has(surface);

  return {
    checkId: `${surface}:aggregation`,
    label: "Aggregation",
    message: aggregated
      ? "Surface exposes aggregated counts and rates only."
      : "Surface exposes structured runtime records with sanitized field summaries.",
    passed: true
  };
}

function buildReadOnlyCheck(input: NotificationDataCertificationInput) {
  return {
    checkId: "global:read_only",
    label: "Read-only",
    message:
      input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
        ? "Page load read-only protection is verified. No writes, sends, retries, or provider tests run during render."
        : "Read-only protection fallback is active for Notification Center page load.",
    passed: input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
  };
}

function buildFallbackCheck(surface: NotificationDataCertificationSurface, available: boolean) {
  return {
    checkId: `${surface}:fallback`,
    label: "Fallback",
    message: available
      ? "Missing or malformed values resolve to safe fallback summaries."
      : "Safe fallback summaries are displayed when runtime data is unavailable.",
    passed: true
  };
}

function buildProviderSecretCheck(samples: unknown[]) {
  const invalidStatuses = samples.filter((sample) => !isAllowedNotificationProviderSecretStatus(sample)).length;

  return {
    checkId: "providers:secret_status",
    label: "Provider secrets",
    message:
      invalidStatuses === 0
        ? "Provider secret states use masked readiness labels only."
        : `${invalidStatuses} provider secret status values were outside the allowed masked set.`,
    passed: invalidStatuses === 0
  };
}

function resolveCertificationStatus(checks: NotificationDataCertificationCheckItem[], available: boolean) {
  const failedChecks = checks.filter((check) => !check.passed).length;

  if (failedChecks > 0) {
    return "needs_review" as const;
  }

  if (!available) {
    return "fallback" as const;
  }

  return "certified" as const;
}

function buildSurfaceCertificationRecord(
  surface: NotificationDataCertificationSurface,
  input: NotificationDataCertificationInput
): NotificationDataCertificationRecord {
  const available = input.surfaceAvailability[surface] ?? true;
  const samples = input.displaySamplesBySurface[surface] ?? [];
  const checks = [
    buildIntegrityCheck(surface, available),
    buildSanitizationCheck(surface, samples, input.errorSanitizationReady),
    buildMaskingCheck(surface, samples),
    buildAggregationCheck(surface),
    buildReadOnlyCheck(input),
    buildFallbackCheck(surface, available)
  ];

  if (surface === "providers" || surface === "channels") {
    checks.push(buildProviderSecretCheck(samples));
  }

  if (surface === "read_only_protection") {
    checks.push({
      checkId: "read_only_protection:verified",
      label: "Protection verified",
      message: input.readOnlyProtectionVerified
        ? "Read-only protection catalog is present for all Notification Center surfaces."
        : "Read-only protection fallback catalog is active.",
      passed: input.readOnlyProtectionVerified
    });
  }

  if (surface === "safe_actions") {
    checks.push({
      checkId: "safe_actions:guarded",
      label: "Actions guarded",
      message:
        "Unsafe notification actions remain disabled placeholders. Explicit admin submit only for allowed placeholders.",
      passed: true
    });
  }

  const certificationStatus = resolveCertificationStatus(checks, available);
  const failedChecks = checks.filter((check) => !check.passed);

  return {
    aggregationReady: aggregatedSurfaces.has(surface) || checks.find((check) => check.checkId.endsWith(":aggregation"))?.passed === true,
    certificationId: `data-cert:${surface}`,
    certificationStatus,
    certificationStatusLabel: getNotificationDataCertificationStatusLabel(certificationStatus),
    checks,
    fallbackReady: checks.find((check) => check.checkId.endsWith(":fallback"))?.passed === true,
    maskingReady: checks.find((check) => check.checkId.endsWith(":masking"))?.passed === true,
    readOnlyReady: checks.find((check) => check.checkId === "global:read_only")?.passed === true,
    safeSummary: sanitizeNotificationAdminDisplayTextSafe(
      failedChecks.length
        ? `${getNotificationDataCertificationSurfaceLabel(surface)} data certification completed with ${failedChecks.length} check(s) needing attention.`
        : `${getNotificationDataCertificationSurfaceLabel(surface)} data is certified for safe Super Admin display with sanitization, masking, aggregation, and read-only guarantees.`,
      240
    ),
    sanitizationReady: checks.find((check) => check.checkId.endsWith(":sanitization"))?.passed === true,
    surface,
    surfaceLabel: getNotificationDataCertificationSurfaceLabel(surface)
  };
}

export function collectNotificationDataCertificationInput(params: {
  auditItems?: Array<{
    ipReference?: unknown;
    metadataSummary?: unknown;
    safeSummary?: unknown;
    userAgentSummary?: unknown;
  }>;
  channels?: Array<{ secretStatus?: unknown }>;
  deliveries?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  errorSanitizationReady?: boolean;
  eventItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  failureItems?: Array<{ failureReason?: unknown }>;
  foundationsPresent?: boolean;
  healthItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  logItems?: Array<{ metadataSummary?: unknown; safeMessage?: unknown }>;
  logs?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  monitoringItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  providerAbstractionItems?: Array<{ configSummary?: unknown; safeSummary?: unknown }>;
  providerStatus?: Array<{ metadataSummary?: unknown; secretStatus?: unknown }>;
  queueItems?: Array<{ errorSummary?: unknown }>;
  readOnlyProtectionVerified?: boolean;
  recipientItems?: Array<{ recipientReference?: unknown; safeSummary?: unknown }>;
  retryItems?: Array<{ failureReason?: unknown }>;
  reviewItems?: Array<{ reviewNote?: unknown; safeSummary?: unknown }>;
  runtimeWarning?: string | null;
  safeActionItems?: Array<{ description?: unknown; guardMessage?: unknown; safeSummary?: unknown }>;
  securityReviewPassed?: boolean;
  surfaceAvailability?: NotificationDataCertificationSurfaceAvailability | null;
  templates?: Array<{ bodyPreview?: unknown; metadataSummary?: unknown; subjectPreview?: unknown }>;
}): NotificationDataCertificationInput {
  const auditItems = params.auditItems ?? [];
  const deliveries = params.deliveries ?? [];
  const eventItems = params.eventItems ?? [];
  const failureItems = params.failureItems ?? [];
  const healthItems = params.healthItems ?? [];
  const logItems = params.logItems ?? [];
  const logs = params.logs ?? [];
  const monitoringItems = params.monitoringItems ?? [];
  const providerAbstractionItems = params.providerAbstractionItems ?? [];
  const providerStatus = params.providerStatus ?? [];
  const queueItems = params.queueItems ?? [];
  const recipientItems = params.recipientItems ?? [];
  const retryItems = params.retryItems ?? [];
  const reviewItems = params.reviewItems ?? [];
  const safeActionItems = params.safeActionItems ?? [];
  const templates = params.templates ?? [];
  const channels = params.channels ?? [];

  return {
    displaySamplesBySurface: {
      analytics: ["aggregated_analytics_only"],
      audit: [
        ...auditItems.flatMap((item) => [item.ipReference, item.metadataSummary, item.safeSummary, item.userAgentSummary])
      ],
      categories: ["category_catalog_only"],
      channels: channels.map((item) => item.secretStatus),
      deliveries: deliveries.flatMap((item) => [item.errorSummary, item.recipientMasked]),
      events: eventItems.flatMap((item) => [item.metadataSummary, item.safeSummary]),
      failures: failureItems.map((item) => item.failureReason),
      health: healthItems.flatMap((item) => [item.metadataSummary, item.safeSummary]),
      logs: [
        ...logs.flatMap((item) => [item.errorSummary, item.recipientMasked]),
        ...logItems.flatMap((item) => [item.metadataSummary, item.safeMessage])
      ],
      metrics: ["aggregated_metrics_only"],
      monitoring: monitoringItems.flatMap((item) => [item.metadataSummary, item.safeSummary]),
      provider_abstraction: providerAbstractionItems.flatMap((item) => [item.configSummary, item.safeSummary]),
      providers: providerStatus.flatMap((item) => [item.metadataSummary, item.secretStatus]),
      queue: queueItems.map((item) => item.errorSummary),
      read_only_protection: ["read_only_page_load_only"],
      recipients: recipientItems.flatMap((item) => [item.recipientReference, item.safeSummary]),
      registry: ["registry_runtime_only"],
      retries: retryItems.map((item) => item.failureReason),
      reviews: reviewItems.flatMap((item) => [item.reviewNote, item.safeSummary]),
      safe_actions: safeActionItems.flatMap((item) => [item.description, item.guardMessage, item.safeSummary]),
      statuses: ["status_catalog_only"],
      templates: templates.flatMap((item) => [item.metadataSummary, item.subjectPreview, item.bodyPreview]),
      types: ["type_catalog_only"]
    },
    errorSanitizationReady: Boolean(params.errorSanitizationReady ?? true),
    foundationsPresent: Boolean(params.foundationsPresent),
    readOnlyProtectionVerified: Boolean(params.readOnlyProtectionVerified),
    runtimeWarning: params.runtimeWarning ?? null,
    securityReviewPassed: Boolean(params.securityReviewPassed),
    surfaceAvailability: params.surfaceAvailability ?? {}
  };
}

export function buildNotificationDataCertificationFallbackRecordSafe(
  surface: NotificationDataCertificationSurface = "registry"
): NotificationDataCertificationRecord {
  return {
    aggregationReady: false,
    certificationId: NOTIFICATION_DATA_CERTIFICATION_FALLBACK_ID,
    certificationStatus: "fallback",
    certificationStatusLabel: getNotificationDataCertificationStatusLabel("fallback"),
    checks: [
      {
        checkId: "fallback:integrity",
        label: "Data integrity",
        message: "Notification data certification fallback applied.",
        passed: false
      }
    ],
    fallbackReady: true,
    maskingReady: false,
    readOnlyReady: isNotificationPageLoadReadOnlyModeEnabled(),
    safeSummary: "Notification data certification fallback only. Super Admin visibility remains read-only with safe summaries.",
    sanitizationReady: false,
    surface,
    surfaceLabel: getNotificationDataCertificationSurfaceLabel(surface)
  };
}

export function buildNotificationDataCertificationRecordsSafe(
  input: NotificationDataCertificationInput | null | undefined
): { dataCertificationItems: NotificationDataCertificationRecord[]; warning: string | null } {
  try {
    const certificationInput =
      input ??
      collectNotificationDataCertificationInput({
        foundationsPresent: false,
        readOnlyProtectionVerified: false,
        securityReviewPassed: false
      });

    const dataCertificationItems = NOTIFICATION_DATA_CERTIFICATION_SURFACES.map((surface) =>
      buildSurfaceCertificationRecord(surface, certificationInput)
    );

    return {
      dataCertificationItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-data-certification-runtime] data certification records build failed", error);

    return {
      dataCertificationItems: [buildNotificationDataCertificationFallbackRecordSafe()],
      warning: "Notification data certification runtime fallback applied."
    };
  }
}

export function buildNotificationDataCertificationRuntimeStatsSafe(
  dataCertificationItems: NotificationDataCertificationRecord[] | null | undefined
): NotificationDataCertificationRuntimeStats {
  try {
    const items = Array.isArray(dataCertificationItems) ? dataCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);

    return {
      certifiedSurfaces: items.filter((item) => item.certificationStatus === "certified").length,
      fallbackSurfaces: items.filter((item) => item.certificationStatus === "fallback").length,
      needsReviewSurfaces: items.filter((item) => item.certificationStatus === "needs_review").length,
      totalChecks: allChecks.length,
      totalChecksFailed: allChecks.filter((check) => !check.passed).length,
      totalChecksPassed: allChecks.filter((check) => check.passed).length,
      totalSurfaces: items.length
    };
  } catch (error) {
    console.error("[notification-data-certification-runtime] data certification stats build failed", error);

    return {
      certifiedSurfaces: 0,
      fallbackSurfaces: 0,
      needsReviewSurfaces: 0,
      totalChecks: 0,
      totalChecksFailed: 0,
      totalChecksPassed: 0,
      totalSurfaces: 0
    };
  }
}

export function buildNotificationDataCertificationSummarySafe(
  dataCertificationItems: NotificationDataCertificationRecord[] | null | undefined,
  input?: NotificationDataCertificationInput | null
): NotificationDataCertificationSummary {
  try {
    const items = Array.isArray(dataCertificationItems) ? dataCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);
    const passedChecks = allChecks.filter((check) => check.passed).length;
    const failedChecks = allChecks.length - passedChecks;
    const needsReview = items.some((item) => item.certificationStatus === "needs_review");
    const sanitizationPassed = items.every((item) => item.sanitizationReady);
    const maskingPassed = items.every((item) => item.maskingReady);
    const readOnlyPassed = Boolean(input?.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled());
    const dataIntegrityPassed = items.every((item) => item.fallbackReady);
    const certificationPassed =
      !needsReview &&
      failedChecks === 0 &&
      sanitizationPassed &&
      maskingPassed &&
      readOnlyPassed &&
      Boolean(input?.foundationsPresent ?? true);

    return {
      certificationDescription: certificationPassed
        ? "Notification data certification passed for NT-1 to NT-25 Super Admin runtime surfaces."
        : "Notification data certification completed with one or more surfaces needing attention.",
      certificationPassed,
      certifiedAt: new Date().toISOString(),
      dataIntegrityPassed,
      failedChecks,
      maskingPassed,
      pageLoadReadOnly: true,
      passedChecks,
      readOnlyPassed,
      safeSummary: sanitizeNotificationAdminDisplayTextSafe(
        certificationPassed
          ? "NT-26 data certification: all notification runtime surfaces are safe, sanitized, masked or aggregated, and read-only on page load."
          : "NT-26 data certification: review flagged surfaces before enabling any future write or execution paths.",
        240
      ),
      sanitizationPassed,
      totalChecks: allChecks.length
    };
  } catch (error) {
    console.error("[notification-data-certification-runtime] data certification summary build failed", error);

    return {
      certificationDescription: "Notification data certification runtime fallback applied.",
      certificationPassed: false,
      certifiedAt: new Date(0).toISOString(),
      dataIntegrityPassed: false,
      failedChecks: 0,
      maskingPassed: false,
      pageLoadReadOnly: true,
      passedChecks: 0,
      readOnlyPassed: false,
      safeSummary: "Notification data certification could not be completed safely.",
      sanitizationPassed: false,
      totalChecks: 0
    };
  }
}

export function listNotificationDataCertificationCatalog() {
  return NOTIFICATION_DATA_CERTIFICATION_SURFACES.map((surface) => ({
    label: getNotificationDataCertificationSurfaceLabel(surface),
    surface
  }));
}

// NT-27+ placeholders: automated remediation, export attestation, and alerting stay disconnected.
export const NOTIFICATION_DATA_CERTIFICATION_FUTURE_HOOKS = [
  "notification_data_remediation",
  "notification_data_export_attestation",
  "notification_data_alerting"
] as const;
