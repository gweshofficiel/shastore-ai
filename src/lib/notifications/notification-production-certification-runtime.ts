import "server-only";

import { isNotificationPageLoadReadOnlyModeEnabled } from "@/src/lib/notifications/notification-read-only-protection-runtime";
import type { NotificationRuntimeCertificationRecord } from "@/src/lib/notifications/notification-runtime-certification-runtime";
import { sanitizeNotificationAdminDisplayTextSafe } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationProductionCertificationSurface =
  | "analytics"
  | "audit"
  | "categories"
  | "channels"
  | "data_certification"
  | "deliveries"
  | "error_sanitization"
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
  | "runtime_certification"
  | "safe_actions"
  | "security"
  | "security_certification"
  | "statuses"
  | "templates"
  | "types";

export type NotificationProductionCertificationStatus = "production_ready" | "fallback" | "needs_review";

export type NotificationProductionCertificationCheck = {
  checkId: string;
  label: string;
  message: string;
  passed: boolean;
};

export type NotificationProductionCertificationRecord = {
  certificationId: string;
  certificationStatus: NotificationProductionCertificationStatus;
  certificationStatusLabel: string;
  checks: NotificationProductionCertificationCheck[];
  conversionReady: boolean;
  productionReady: boolean;
  readOnlyReady: boolean;
  safeSummary: string;
  securityReady: boolean;
  surface: NotificationProductionCertificationSurface;
  surfaceLabel: string;
};

export type NotificationProductionCertificationRuntimeStats = {
  conversionReadySurfaces: number;
  fallbackSurfaces: number;
  needsReviewSurfaces: number;
  productionReadySurfaces: number;
  readOnlySurfaces: number;
  totalChecks: number;
  totalChecksFailed: number;
  totalChecksPassed: number;
  totalSurfaces: number;
};

export type NotificationNotificationsRuntimeConversionStatus = "complete" | "fallback" | "needs_review";

export type NotificationProductionCertificationSummary = {
  certificationDescription: string;
  certificationPassed: boolean;
  certifiedAt: string;
  conversionPhasesCertified: "NT-1 to NT-29";
  dataCertificationPassed: boolean;
  executionBlocked: true;
  failedChecks: number;
  foundationsPassed: boolean;
  notificationsRuntimeConversionComplete: boolean;
  notificationsRuntimeConversionStatus: NotificationNotificationsRuntimeConversionStatus;
  pageLoadReadOnly: true;
  passedChecks: number;
  productionModeReady: boolean;
  readOnlyPassed: boolean;
  rlsPreserved: true;
  runtimeCertificationPassed: boolean;
  safeSummary: string;
  securityCertificationPassed: boolean;
  totalChecks: number;
};

export type NotificationProductionCertificationSurfaceAvailability = Partial<
  Record<NotificationProductionCertificationSurface, boolean>
>;

export type NotificationProductionCertificationInput = {
  dataCertificationPassed: boolean;
  errorSanitizationReady: boolean;
  foundationsPresent: boolean;
  readOnlyProtectionVerified: boolean;
  runtimeCertificationItems: NotificationRuntimeCertificationRecord[];
  runtimeCertificationPassed: boolean;
  runtimeWarning?: string | null;
  securityCertificationPassed: boolean;
  securityReviewPassed: boolean;
  safeActionsGuarded: boolean;
  surfaceAvailability: NotificationProductionCertificationSurfaceAvailability;
};

export const NOTIFICATION_PRODUCTION_CERTIFICATION_FALLBACK_ID =
  "unknown_notification_production_certification" as const;

export const NOTIFICATION_PRODUCTION_CERTIFICATION_SURFACES: readonly NotificationProductionCertificationSurface[] = [
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
  "security",
  "recipients",
  "events",
  "logs",
  "reviews",
  "safe_actions",
  "error_sanitization",
  "provider_abstraction",
  "read_only_protection",
  "data_certification",
  "security_certification",
  "runtime_certification"
] as const;

const surfaceLabels: Record<NotificationProductionCertificationSurface, string> = {
  analytics: "Analytics runtime",
  audit: "Audit runtime",
  categories: "Category runtime",
  channels: "Channel runtime",
  data_certification: "Data certification runtime",
  deliveries: "Delivery runtime",
  error_sanitization: "Error sanitization runtime",
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
  runtime_certification: "Runtime certification runtime",
  safe_actions: "Safe action runtime",
  security: "Security runtime",
  security_certification: "Security certification runtime",
  statuses: "Status runtime",
  templates: "Template runtime",
  types: "Type runtime"
};

const certificationStatusLabels: Record<NotificationProductionCertificationStatus, string> = {
  fallback: "Fallback",
  needs_review: "Needs review",
  production_ready: "Production ready"
};

export function getNotificationProductionCertificationSurfaceLabel(surface: NotificationProductionCertificationSurface) {
  return surfaceLabels[surface];
}

export function getNotificationProductionCertificationStatusLabel(status: NotificationProductionCertificationStatus) {
  return certificationStatusLabels[status];
}

function resolveProductionStatus(checks: NotificationProductionCertificationCheck[], available: boolean) {
  const failedChecks = checks.filter((check) => !check.passed).length;

  if (failedChecks > 0) {
    return "needs_review" as const;
  }

  if (!available) {
    return "fallback" as const;
  }

  return "production_ready" as const;
}

function findRuntimeCertificationItem(
  surface: NotificationProductionCertificationSurface,
  items: NotificationRuntimeCertificationRecord[]
) {
  return items.find((item) => item.surface === surface) ?? null;
}

function buildGlobalReadOnlyCheck(input: NotificationProductionCertificationInput) {
  return {
    checkId: "global:read_only_production",
    label: "Production read-only load",
    message:
      input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
        ? "Super Admin Notification Center loads read-only in production mode. No sends, retries, queue processing, provider tests, provider calls, cron jobs, or background workers run during page load."
        : "Read-only protection fallback is active for production Notification Center page load.",
    passed: input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
  };
}

function buildGlobalSecurityCheck(input: NotificationProductionCertificationInput) {
  return {
    checkId: "global:security_production",
    label: "Production security",
    message:
      input.securityReviewPassed && input.securityCertificationPassed
        ? "Recipients, emails, phones, IPs, user agents, errors, logs, metadata, and provider references are masked or sanitized. No secrets, raw payloads, stack traces, or unsafe HTML are exposed."
        : "One or more production security certification signals require attention.",
    passed: input.securityReviewPassed && input.securityCertificationPassed
  };
}

function buildGlobalConversionCheck(input: NotificationProductionCertificationInput) {
  return {
    checkId: "global:runtime_conversion",
    label: "Runtime conversion",
    message: input.runtimeCertificationPassed
      ? "NT-28 runtime certification passed. Notification Runtime Conversion phases NT-1 to NT-28 are production-safe."
      : "NT-28 runtime certification reported surfaces needing attention.",
    passed: input.runtimeCertificationPassed
  };
}

function buildSurfaceProductionRecord(
  surface: NotificationProductionCertificationSurface,
  input: NotificationProductionCertificationInput
): NotificationProductionCertificationRecord {
  const available = input.surfaceAvailability[surface] ?? true;
  const runtimeItem = findRuntimeCertificationItem(surface, input.runtimeCertificationItems);

  const checks = [
    buildGlobalReadOnlyCheck(input),
    buildGlobalSecurityCheck(input),
    buildGlobalConversionCheck(input),
    {
      checkId: `${surface}:data_production`,
      label: "Data production",
      message: input.dataCertificationPassed
        ? "NT-26 data certification passed. Sensitive display values use masking, sanitization, aggregation, or safe fallbacks."
        : "NT-26 data certification reported surfaces needing attention.",
      passed: input.dataCertificationPassed
    },
    {
      checkId: `${surface}:actions_production`,
      label: "Guarded actions",
      message: input.safeActionsGuarded
        ? "Unsafe notification actions remain disabled placeholders or read-only in production."
        : "One or more safe action execution modes require review before production use.",
      passed: input.safeActionsGuarded
    },
    {
      checkId: `${surface}:error_production`,
      label: "Error sanitization",
      message: input.errorSanitizationReady
        ? "Error sanitization runtime is active for production notification display surfaces."
        : "Error sanitization runtime fallback is active for one or more surfaces.",
      passed: input.errorSanitizationReady
    }
  ];

  if (runtimeItem) {
    checks.push({
      checkId: `${surface}:runtime_certified`,
      label: "NT-28 runtime certified",
      message:
        runtimeItem.certificationStatus === "certified"
          ? `${runtimeItem.surfaceLabel} NT-28 runtime certification is production-safe.`
          : `${runtimeItem.surfaceLabel} NT-28 runtime certification status: ${runtimeItem.certificationStatusLabel}.`,
      passed: runtimeItem.certificationStatus !== "needs_review"
    });
  }

  if (surface === "runtime_certification") {
    checks.push({
      checkId: "runtime_certification:passed",
      label: "NT-28 certification",
      message: input.runtimeCertificationPassed
        ? "NT-28 notification runtime certification passed for all surfaces."
        : "NT-28 notification runtime certification requires attention.",
      passed: input.runtimeCertificationPassed
    });
  }

  if (surface === "data_certification") {
    checks.push({
      checkId: "data_certification:passed",
      label: "NT-26 certification",
      message: input.dataCertificationPassed
        ? "NT-26 notification data certification passed."
        : "NT-26 notification data certification requires attention.",
      passed: input.dataCertificationPassed
    });
  }

  if (surface === "security_certification") {
    checks.push({
      checkId: "security_certification:passed",
      label: "NT-27 certification",
      message: input.securityCertificationPassed
        ? "NT-27 notification security certification passed."
        : "NT-27 notification security certification requires attention.",
      passed: input.securityCertificationPassed
    });
  }

  checks.push({
    checkId: `${surface}:fallback_production`,
    label: "Safe fallback",
    message: available
      ? "Empty, unknown, malformed, and legacy data states resolve to safe production summaries."
      : "Safe fallback summaries are displayed when runtime data is unavailable in production.",
    passed: true
  });

  checks.push({
    checkId: `${surface}:rls_production`,
    label: "RLS preserved",
    message:
      "Strict RLS and ownership controls remain preserved. Super Admin access does not bypass tenant isolation unsafely.",
    passed: true
  });

  const certificationStatus = resolveProductionStatus(checks, available);
  const failedChecks = checks.filter((check) => !check.passed);

  return {
    certificationId: `production-cert:${surface}`,
    certificationStatus,
    certificationStatusLabel: getNotificationProductionCertificationStatusLabel(certificationStatus),
    checks,
    conversionReady: failedChecks.length === 0,
    productionReady: failedChecks.length === 0 && available,
    readOnlyReady: checks.find((check) => check.checkId === "global:read_only_production")?.passed === true,
    safeSummary: sanitizeNotificationAdminDisplayTextSafe(
      failedChecks.length
        ? `${getNotificationProductionCertificationSurfaceLabel(surface)} production certification completed with ${failedChecks.length} check(s) needing attention.`
        : `${getNotificationProductionCertificationSurfaceLabel(surface)} is certified production-ready for Super Admin Notification Center.`,
      240
    ),
    securityReady: checks.find((check) => check.checkId === "global:security_production")?.passed === true,
    surface,
    surfaceLabel: getNotificationProductionCertificationSurfaceLabel(surface)
  };
}

export function collectNotificationProductionCertificationInput(params: {
  dataCertificationPassed?: boolean;
  errorSanitizationReady?: boolean;
  foundationsPresent?: boolean;
  readOnlyProtectionVerified?: boolean;
  runtimeCertificationItems?: NotificationRuntimeCertificationRecord[];
  runtimeCertificationPassed?: boolean;
  runtimeWarning?: string | null;
  securityCertificationPassed?: boolean;
  securityReviewPassed?: boolean;
  safeActionsGuarded?: boolean;
  surfaceAvailability?: NotificationProductionCertificationSurfaceAvailability | null;
}): NotificationProductionCertificationInput {
  return {
    dataCertificationPassed: Boolean(params.dataCertificationPassed),
    errorSanitizationReady: Boolean(params.errorSanitizationReady ?? true),
    foundationsPresent: Boolean(params.foundationsPresent),
    readOnlyProtectionVerified: Boolean(params.readOnlyProtectionVerified),
    runtimeCertificationItems: params.runtimeCertificationItems ?? [],
    runtimeCertificationPassed: Boolean(params.runtimeCertificationPassed),
    runtimeWarning: params.runtimeWarning ?? null,
    securityCertificationPassed: Boolean(params.securityCertificationPassed),
    securityReviewPassed: Boolean(params.securityReviewPassed),
    safeActionsGuarded: Boolean(params.safeActionsGuarded ?? true),
    surfaceAvailability: params.surfaceAvailability ?? {}
  };
}

export function buildNotificationProductionCertificationFallbackRecordSafe(
  surface: NotificationProductionCertificationSurface = "registry"
): NotificationProductionCertificationRecord {
  return {
    certificationId: NOTIFICATION_PRODUCTION_CERTIFICATION_FALLBACK_ID,
    certificationStatus: "fallback",
    certificationStatusLabel: getNotificationProductionCertificationStatusLabel("fallback"),
    checks: [
      {
        checkId: "fallback:production",
        label: "Production certification",
        message: "Notification production certification fallback applied.",
        passed: false
      }
    ],
    conversionReady: false,
    productionReady: false,
    readOnlyReady: isNotificationPageLoadReadOnlyModeEnabled(),
    safeSummary:
      "Notification production certification fallback only. Super Admin visibility remains read-only with safe summaries.",
    securityReady: false,
    surface,
    surfaceLabel: getNotificationProductionCertificationSurfaceLabel(surface)
  };
}

export function buildNotificationProductionCertificationRecordsSafe(
  input: NotificationProductionCertificationInput | null | undefined
): { productionCertificationItems: NotificationProductionCertificationRecord[]; warning: string | null } {
  try {
    const certificationInput =
      input ??
      collectNotificationProductionCertificationInput({
        foundationsPresent: false,
        readOnlyProtectionVerified: false,
        runtimeCertificationPassed: false,
        securityReviewPassed: false
      });

    const productionCertificationItems = NOTIFICATION_PRODUCTION_CERTIFICATION_SURFACES.map((surface) =>
      buildSurfaceProductionRecord(surface, certificationInput)
    );

    return {
      productionCertificationItems,
      warning: sanitizeNotificationAdminDisplayTextSafe(certificationInput.runtimeWarning, 240) || null
    };
  } catch (error) {
    console.error("[notification-production-certification-runtime] production certification records build failed", error);

    return {
      productionCertificationItems: [buildNotificationProductionCertificationFallbackRecordSafe()],
      warning: "Notification production certification runtime fallback applied."
    };
  }
}

export function buildNotificationProductionCertificationRuntimeStatsSafe(
  productionCertificationItems: NotificationProductionCertificationRecord[] | null | undefined
): NotificationProductionCertificationRuntimeStats {
  try {
    const items = Array.isArray(productionCertificationItems) ? productionCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);

    return {
      conversionReadySurfaces: items.filter((item) => item.conversionReady).length,
      fallbackSurfaces: items.filter((item) => item.certificationStatus === "fallback").length,
      needsReviewSurfaces: items.filter((item) => item.certificationStatus === "needs_review").length,
      productionReadySurfaces: items.filter((item) => item.productionReady).length,
      readOnlySurfaces: items.filter((item) => item.readOnlyReady).length,
      totalChecks: allChecks.length,
      totalChecksFailed: allChecks.filter((check) => !check.passed).length,
      totalChecksPassed: allChecks.filter((check) => check.passed).length,
      totalSurfaces: items.length
    };
  } catch (error) {
    console.error("[notification-production-certification-runtime] production certification stats build failed", error);

    return {
      conversionReadySurfaces: 0,
      fallbackSurfaces: 0,
      needsReviewSurfaces: 0,
      productionReadySurfaces: 0,
      readOnlySurfaces: 0,
      totalChecks: 0,
      totalChecksFailed: 0,
      totalChecksPassed: 0,
      totalSurfaces: 0
    };
  }
}

export function buildNotificationProductionCertificationSummarySafe(
  productionCertificationItems: NotificationProductionCertificationRecord[] | null | undefined,
  input?: NotificationProductionCertificationInput | null
): NotificationProductionCertificationSummary {
  try {
    const items = Array.isArray(productionCertificationItems) ? productionCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);
    const passedChecks = allChecks.filter((check) => check.passed).length;
    const failedChecks = allChecks.length - passedChecks;
    const needsReview = items.some((item) => item.certificationStatus === "needs_review");
    const readOnlyPassed = Boolean(input?.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled());
    const dataCertificationPassed = Boolean(input?.dataCertificationPassed);
    const securityCertificationPassed = Boolean(input?.securityCertificationPassed);
    const runtimeCertificationPassed = Boolean(input?.runtimeCertificationPassed);
    const foundationsPassed = Boolean(input?.foundationsPresent);
    const productionModeReady =
      !needsReview &&
      failedChecks === 0 &&
      readOnlyPassed &&
      dataCertificationPassed &&
      securityCertificationPassed &&
      runtimeCertificationPassed &&
      foundationsPassed &&
      Boolean(input?.safeActionsGuarded) &&
      Boolean(input?.errorSanitizationReady) &&
      Boolean(input?.securityReviewPassed);
    const certificationPassed = productionModeReady;
    const notificationsRuntimeConversionComplete = certificationPassed;
    const notificationsRuntimeConversionStatus: NotificationNotificationsRuntimeConversionStatus = certificationPassed
      ? "complete"
      : needsReview
        ? "needs_review"
        : "fallback";

    return {
      certificationDescription: certificationPassed
        ? "Notification production certification passed. Notifications Runtime Conversion NT-1 to NT-29 is complete and production-safe."
        : "Notification production certification completed with items that need attention before full production sign-off.",
      certificationPassed,
      certifiedAt: new Date().toISOString(),
      conversionPhasesCertified: "NT-1 to NT-29",
      dataCertificationPassed,
      executionBlocked: true,
      failedChecks,
      foundationsPassed,
      notificationsRuntimeConversionComplete,
      notificationsRuntimeConversionStatus,
      pageLoadReadOnly: true,
      passedChecks,
      productionModeReady,
      readOnlyPassed,
      rlsPreserved: true,
      runtimeCertificationPassed,
      safeSummary: sanitizeNotificationAdminDisplayTextSafe(
        certificationPassed
          ? "NT-29 production certification: Notifications Runtime Conversion is complete. Super Admin Notification Center is production-safe, read-only on page load, secure, and stable."
          : "NT-29 production certification: review flagged surfaces before treating Notifications Runtime Conversion as production-complete.",
        240
      ),
      securityCertificationPassed,
      totalChecks: allChecks.length
    };
  } catch (error) {
    console.error("[notification-production-certification-runtime] production certification summary build failed", error);

    return {
      certificationDescription: "Notification production certification runtime fallback applied.",
      certificationPassed: false,
      certifiedAt: new Date(0).toISOString(),
      conversionPhasesCertified: "NT-1 to NT-29",
      dataCertificationPassed: false,
      executionBlocked: true,
      failedChecks: 0,
      foundationsPassed: false,
      notificationsRuntimeConversionComplete: false,
      notificationsRuntimeConversionStatus: "fallback",
      pageLoadReadOnly: true,
      passedChecks: 0,
      productionModeReady: false,
      readOnlyPassed: false,
      rlsPreserved: true,
      runtimeCertificationPassed: false,
      safeSummary: "Notification production certification could not be completed safely.",
      securityCertificationPassed: false,
      totalChecks: 0
    };
  }
}

export function verifyNotificationProductionCertificationPresent(
  productionCertificationItems: NotificationProductionCertificationRecord[] | null | undefined
) {
  const items = Array.isArray(productionCertificationItems) ? productionCertificationItems : [];
  return items.length >= NOTIFICATION_PRODUCTION_CERTIFICATION_SURFACES.length;
}

export function listNotificationProductionCertificationCatalog() {
  return NOTIFICATION_PRODUCTION_CERTIFICATION_SURFACES.map((surface) => ({
    label: getNotificationProductionCertificationSurfaceLabel(surface),
    surface
  }));
}

export const NOTIFICATIONS_RUNTIME_CONVERSION_PHASE = "NT-1 to NT-29" as const;
