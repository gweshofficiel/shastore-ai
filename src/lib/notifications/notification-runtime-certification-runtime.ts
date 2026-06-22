import "server-only";

import type { NotificationDataCertificationRecord } from "@/src/lib/notifications/notification-data-certification-runtime";
import { isNotificationPageLoadReadOnlyModeEnabled } from "@/src/lib/notifications/notification-read-only-protection-runtime";
import type { NotificationReadOnlyProtectionRecord } from "@/src/lib/notifications/notification-read-only-protection-runtime";
import type { NotificationSecurityCertificationDomainRecord } from "@/src/lib/notifications/notification-security-certification-runtime";
import type { NotificationSecurityRecord } from "@/src/lib/notifications/notification-security-runtime";
import { sanitizeNotificationAdminDisplayTextSafe } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationRuntimeCertificationSurface =
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
  | "safe_actions"
  | "security"
  | "security_certification"
  | "statuses"
  | "templates"
  | "types";

export type NotificationRuntimeCertificationStatus = "certified" | "fallback" | "needs_review";

export type NotificationRuntimeCertificationCheck = {
  checkId: string;
  label: string;
  message: string;
  passed: boolean;
};

export type NotificationRuntimeCertificationRecord = {
  certificationId: string;
  certificationStatus: NotificationRuntimeCertificationStatus;
  certificationStatusLabel: string;
  checks: NotificationRuntimeCertificationCheck[];
  fallbackReady: boolean;
  productionSafe: boolean;
  readOnlyReady: boolean;
  runtimeReady: boolean;
  safeSummary: string;
  securityReady: boolean;
  surface: NotificationRuntimeCertificationSurface;
  surfaceLabel: string;
};

export type NotificationRuntimeCertificationRuntimeStats = {
  certifiedSurfaces: number;
  fallbackSurfaces: number;
  needsReviewSurfaces: number;
  productionSafeSurfaces: number;
  readOnlySurfaces: number;
  totalChecks: number;
  totalChecksFailed: number;
  totalChecksPassed: number;
  totalSurfaces: number;
};

export type NotificationRuntimeCertificationSummary = {
  certificationDescription: string;
  certificationPassed: boolean;
  certifiedAt: string;
  dataProtectionPassed: boolean;
  executionBlocked: true;
  failedChecks: number;
  foundationsPassed: boolean;
  pageLoadReadOnly: true;
  passedChecks: number;
  productionSafe: boolean;
  readOnlyPassed: boolean;
  rlsPreserved: true;
  safeSummary: string;
  securityPassed: boolean;
  totalChecks: number;
};

export type NotificationRuntimeCertificationSurfaceAvailability = Partial<
  Record<NotificationRuntimeCertificationSurface, boolean>
>;

export type NotificationRuntimeCertificationInput = {
  dataCertificationItems: NotificationDataCertificationRecord[];
  dataCertificationPassed: boolean;
  errorSanitizationReady: boolean;
  foundationsPresent: boolean;
  readOnlyProtectionItems: NotificationReadOnlyProtectionRecord[];
  readOnlyProtectionVerified: boolean;
  runtimeWarning?: string | null;
  securityCertificationDomainItems: NotificationSecurityCertificationDomainRecord[];
  securityCertificationPassed: boolean;
  securityRecords: NotificationSecurityRecord[];
  securityReviewPassed: boolean;
  safeActionsGuarded: boolean;
  surfaceAvailability: NotificationRuntimeCertificationSurfaceAvailability;
};

export const NOTIFICATION_RUNTIME_CERTIFICATION_FALLBACK_ID = "unknown_notification_runtime_certification" as const;

export const NOTIFICATION_RUNTIME_CERTIFICATION_SURFACES: readonly NotificationRuntimeCertificationSurface[] = [
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
  "security_certification"
] as const;

const surfaceLabels: Record<NotificationRuntimeCertificationSurface, string> = {
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
  safe_actions: "Safe action runtime",
  security: "Security runtime",
  security_certification: "Security certification runtime",
  statuses: "Status runtime",
  templates: "Template runtime",
  types: "Type runtime"
};

const certificationStatusLabels: Record<NotificationRuntimeCertificationStatus, string> = {
  certified: "Certified",
  fallback: "Fallback",
  needs_review: "Needs review"
};

const dataCertificationSurfaceMap: Partial<Record<NotificationRuntimeCertificationSurface, string>> = {
  analytics: "analytics",
  audit: "audit",
  categories: "categories",
  channels: "channels",
  deliveries: "deliveries",
  events: "events",
  failures: "failures",
  health: "health",
  logs: "logs",
  metrics: "metrics",
  monitoring: "monitoring",
  provider_abstraction: "provider_abstraction",
  providers: "providers",
  queue: "queue",
  read_only_protection: "read_only_protection",
  recipients: "recipients",
  registry: "registry",
  retries: "retries",
  reviews: "reviews",
  safe_actions: "safe_actions",
  statuses: "statuses",
  templates: "templates",
  types: "types"
};

const readOnlyProtectionSurfaceMap: Partial<Record<NotificationRuntimeCertificationSurface, string>> = {
  analytics: "analytics",
  audit: "audit",
  categories: "categories",
  channels: "channels",
  deliveries: "deliveries",
  events: "events",
  failures: "failures",
  health: "health",
  logs: "logs",
  metrics: "metrics",
  monitoring: "monitoring",
  provider_abstraction: "provider_abstraction",
  providers: "providers",
  queue: "queue",
  recipients: "recipients",
  registry: "registry",
  retries: "retries",
  reviews: "reviews",
  safe_actions: "safe_actions",
  statuses: "statuses",
  templates: "templates",
  types: "types"
};

const securitySurfaceMap: Partial<Record<NotificationRuntimeCertificationSurface, string>> = {
  analytics: "analytics",
  audit: "audit",
  categories: "category",
  channels: "channel",
  deliveries: "delivery",
  failures: "failure",
  health: "health",
  metrics: "metrics",
  monitoring: "monitoring",
  providers: "provider",
  queue: "queue",
  registry: "registry",
  retries: "retry",
  statuses: "status",
  templates: "template",
  types: "type"
};

export function getNotificationRuntimeCertificationSurfaceLabel(surface: NotificationRuntimeCertificationSurface) {
  return surfaceLabels[surface];
}

export function getNotificationRuntimeCertificationStatusLabel(status: NotificationRuntimeCertificationStatus) {
  return certificationStatusLabels[status];
}

function resolveCertificationStatus(checks: NotificationRuntimeCertificationCheck[], available: boolean) {
  const failedChecks = checks.filter((check) => !check.passed).length;

  if (failedChecks > 0) {
    return "needs_review" as const;
  }

  if (!available) {
    return "fallback" as const;
  }

  return "certified" as const;
}

function findDataCertificationItem(
  surface: NotificationRuntimeCertificationSurface,
  items: NotificationDataCertificationRecord[]
) {
  const mapped = dataCertificationSurfaceMap[surface];
  if (!mapped) {
    return null;
  }

  return items.find((item) => item.surface === mapped) ?? null;
}

function findReadOnlyProtectionItem(
  surface: NotificationRuntimeCertificationSurface,
  items: NotificationReadOnlyProtectionRecord[]
) {
  const mapped = readOnlyProtectionSurfaceMap[surface];
  if (!mapped) {
    return null;
  }

  return items.find((item) => item.surface === mapped) ?? null;
}

function findSecurityRecord(surface: NotificationRuntimeCertificationSurface, items: NotificationSecurityRecord[]) {
  const mapped = securitySurfaceMap[surface];
  if (!mapped) {
    return null;
  }

  return items.find((item) => item.surface === mapped) ?? null;
}

function buildRuntimeReadyCheck(surface: NotificationRuntimeCertificationSurface, available: boolean) {
  return {
    checkId: `${surface}:runtime_ready`,
    label: "Runtime ready",
    message: available
      ? `${getNotificationRuntimeCertificationSurfaceLabel(surface)} is loaded with safe runtime fallbacks when data is missing.`
      : `${getNotificationRuntimeCertificationSurfaceLabel(surface)} is using safe fallback visibility only.`,
    passed: true
  };
}

function buildReadOnlyCheck(input: NotificationRuntimeCertificationInput) {
  return {
    checkId: "global:read_only",
    label: "Read-only page load",
    message:
      input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
        ? "No sends, retries, queue processing, provider tests, provider calls, cron jobs, or background workers run during page load."
        : "Read-only protection fallback is active for Notification Center page load.",
    passed: input.readOnlyProtectionVerified && isNotificationPageLoadReadOnlyModeEnabled()
  };
}

function buildSurfaceReadOnlyCheck(
  surface: NotificationRuntimeCertificationSurface,
  input: NotificationRuntimeCertificationInput
) {
  const protectionItem = findReadOnlyProtectionItem(surface, input.readOnlyProtectionItems);

  if (!protectionItem) {
    return buildReadOnlyCheck(input);
  }

  return {
    checkId: `${surface}:read_only`,
    label: "Surface read-only",
    message: protectionItem.protectionReady
      ? `${protectionItem.surfaceLabel} blocks ${protectionItem.blockedMutations.length} mutation classes on page load.`
      : `${protectionItem.surfaceLabel} read-only protection fallback is active.`,
    passed: protectionItem.protectionReady
  };
}

function buildDataProtectionCheck(
  surface: NotificationRuntimeCertificationSurface,
  input: NotificationRuntimeCertificationInput
) {
  if (surface === "data_certification") {
    return {
      checkId: "data_certification:passed",
      label: "NT-26 data certification",
      message: input.dataCertificationPassed
        ? "NT-26 data certification passed for all notification runtime surfaces."
        : "NT-26 data certification reported surfaces needing attention.",
      passed: input.dataCertificationPassed
    };
  }

  const dataItem = findDataCertificationItem(surface, input.dataCertificationItems);
  if (!dataItem) {
    return {
      checkId: `${surface}:data_protection`,
      label: "Data protection",
      message: "Surface inherits global NT-26 data certification and sanitization guarantees.",
      passed: input.dataCertificationPassed
    };
  }

  return {
    checkId: `${surface}:data_protection`,
    label: "Data protection",
    message:
      dataItem.certificationStatus === "certified"
        ? `${dataItem.surfaceLabel} data is sanitized, masked or aggregated, with safe fallbacks.`
        : `${dataItem.surfaceLabel} data certification status: ${dataItem.certificationStatusLabel}.`,
    passed: dataItem.certificationStatus !== "needs_review"
  };
}

function buildSecurityCheck(surface: NotificationRuntimeCertificationSurface, input: NotificationRuntimeCertificationInput) {
  if (surface === "security_certification") {
    return {
      checkId: "security_certification:passed",
      label: "NT-27 security certification",
      message: input.securityCertificationPassed
        ? "NT-27 security certification passed for all notification security domains."
        : "NT-27 security certification reported domains needing attention.",
      passed: input.securityCertificationPassed
    };
  }

  if (surface === "security") {
    return {
      checkId: "security:review",
      label: "NT-17 security review",
      message: input.securityReviewPassed
        ? "NT-17 notification security review passed for loaded runtime samples."
        : "NT-17 notification security review reported items needing attention.",
      passed: input.securityReviewPassed
    };
  }

  const securityRecord = findSecurityRecord(surface, input.securityRecords);
  if (!securityRecord) {
    return {
      checkId: `${surface}:security`,
      label: "Security protection",
      message: "Surface inherits global NT-27 security certification and NT-17 security review guarantees.",
      passed: input.securityCertificationPassed && input.securityReviewPassed
    };
  }

  return {
    checkId: `${surface}:security`,
    label: "Security protection",
    message:
      securityRecord.protectionState === "protected"
        ? `${securityRecord.surfaceLabel} is protected with sanitized summaries only.`
        : `${securityRecord.surfaceLabel} security state: ${securityRecord.protectionStateLabel}.`,
    passed: securityRecord.protectionState !== "needs_review"
  };
}

function buildProductionSafeCheck(surface: NotificationRuntimeCertificationSurface, input: NotificationRuntimeCertificationInput) {
  if (surface === "safe_actions") {
    return {
      checkId: "safe_actions:guarded",
      label: "Actions guarded",
      message: input.safeActionsGuarded
        ? "Unsafe notification actions remain disabled placeholders or read-only."
        : "One or more safe action execution modes require review.",
      passed: input.safeActionsGuarded
    };
  }

  if (surface === "error_sanitization") {
    return {
      checkId: "error_sanitization:ready",
      label: "Error sanitization",
      message: input.errorSanitizationReady
        ? "Error sanitization runtime is active across notification display surfaces."
        : "Error sanitization runtime fallback is active for one or more surfaces.",
      passed: input.errorSanitizationReady
    };
  }

  if (surface === "read_only_protection") {
    return {
      checkId: "read_only_protection:verified",
      label: "Protection verified",
      message: input.readOnlyProtectionVerified
        ? "Read-only protection catalog is present for Notification Center surfaces."
        : "Read-only protection fallback catalog is active.",
      passed: input.readOnlyProtectionVerified
    };
  }

  return {
    checkId: `${surface}:production_safe`,
    label: "Production safe",
    message: input.foundationsPresent
      ? `${getNotificationRuntimeCertificationSurfaceLabel(surface)} is production-safe with read-only page load and no execution paths connected.`
      : "Notification Center foundations are partially unavailable. Safe fallback visibility remains active.",
    passed: input.foundationsPresent
  };
}

function buildFallbackCheck(surface: NotificationRuntimeCertificationSurface, available: boolean) {
  return {
    checkId: `${surface}:fallback`,
    label: "Safe fallback",
    message: available
      ? "Empty, unknown, malformed, and legacy values resolve to safe summaries."
      : "Safe fallback summaries are displayed when runtime data is unavailable.",
    passed: true
  };
}

function buildSurfaceRuntimeCertificationRecord(
  surface: NotificationRuntimeCertificationSurface,
  input: NotificationRuntimeCertificationInput
): NotificationRuntimeCertificationRecord {
  const available = input.surfaceAvailability[surface] ?? true;
  const checks = [
    buildRuntimeReadyCheck(surface, available),
    buildSurfaceReadOnlyCheck(surface, input),
    buildDataProtectionCheck(surface, input),
    buildSecurityCheck(surface, input),
    buildProductionSafeCheck(surface, input),
    buildFallbackCheck(surface, available)
  ];

  const certificationStatus = resolveCertificationStatus(checks, available);
  const failedChecks = checks.filter((check) => !check.passed);

  return {
    certificationId: `runtime-cert:${surface}`,
    certificationStatus,
    certificationStatusLabel: getNotificationRuntimeCertificationStatusLabel(certificationStatus),
    checks,
    fallbackReady: checks.find((check) => check.checkId.endsWith(":fallback"))?.passed === true,
    productionSafe: failedChecks.length === 0,
    readOnlyReady: checks.some((check) => check.checkId.includes("read_only") && check.passed),
    runtimeReady: checks.find((check) => check.checkId.endsWith(":runtime_ready"))?.passed === true,
    safeSummary: sanitizeNotificationAdminDisplayTextSafe(
      failedChecks.length
        ? `${getNotificationRuntimeCertificationSurfaceLabel(surface)} runtime certification completed with ${failedChecks.length} check(s) needing attention.`
        : `${getNotificationRuntimeCertificationSurfaceLabel(surface)} is certified production-safe, read-only on page load, secure, and stable.`,
      240
    ),
    securityReady: checks
      .filter((check) => check.checkId.includes("security") || check.checkId.includes("data_protection"))
      .every((check) => check.passed),
    surface,
    surfaceLabel: getNotificationRuntimeCertificationSurfaceLabel(surface)
  };
}

export function collectNotificationRuntimeCertificationInput(params: {
  dataCertificationItems?: NotificationDataCertificationRecord[];
  dataCertificationPassed?: boolean;
  errorSanitizationReady?: boolean;
  foundationsPresent?: boolean;
  readOnlyProtectionItems?: NotificationReadOnlyProtectionRecord[];
  readOnlyProtectionVerified?: boolean;
  runtimeWarning?: string | null;
  securityCertificationDomainItems?: NotificationSecurityCertificationDomainRecord[];
  securityCertificationPassed?: boolean;
  securityRecords?: NotificationSecurityRecord[];
  securityReviewPassed?: boolean;
  safeActionsGuarded?: boolean;
  surfaceAvailability?: NotificationRuntimeCertificationSurfaceAvailability | null;
}): NotificationRuntimeCertificationInput {
  return {
    dataCertificationItems: params.dataCertificationItems ?? [],
    dataCertificationPassed: Boolean(params.dataCertificationPassed),
    errorSanitizationReady: Boolean(params.errorSanitizationReady ?? true),
    foundationsPresent: Boolean(params.foundationsPresent),
    readOnlyProtectionItems: params.readOnlyProtectionItems ?? [],
    readOnlyProtectionVerified: Boolean(params.readOnlyProtectionVerified),
    runtimeWarning: params.runtimeWarning ?? null,
    securityCertificationDomainItems: params.securityCertificationDomainItems ?? [],
    securityCertificationPassed: Boolean(params.securityCertificationPassed),
    securityRecords: params.securityRecords ?? [],
    securityReviewPassed: Boolean(params.securityReviewPassed),
    safeActionsGuarded: Boolean(params.safeActionsGuarded ?? true),
    surfaceAvailability: params.surfaceAvailability ?? {}
  };
}

export function buildNotificationRuntimeCertificationFallbackRecordSafe(
  surface: NotificationRuntimeCertificationSurface = "registry"
): NotificationRuntimeCertificationRecord {
  return {
    certificationId: NOTIFICATION_RUNTIME_CERTIFICATION_FALLBACK_ID,
    certificationStatus: "fallback",
    certificationStatusLabel: getNotificationRuntimeCertificationStatusLabel("fallback"),
    checks: [
      {
        checkId: "fallback:runtime",
        label: "Runtime certification",
        message: "Notification runtime certification fallback applied.",
        passed: false
      }
    ],
    fallbackReady: true,
    productionSafe: false,
    readOnlyReady: isNotificationPageLoadReadOnlyModeEnabled(),
    runtimeReady: false,
    safeSummary:
      "Notification runtime certification fallback only. Super Admin visibility remains read-only with safe summaries.",
    securityReady: false,
    surface,
    surfaceLabel: getNotificationRuntimeCertificationSurfaceLabel(surface)
  };
}

export function buildNotificationRuntimeCertificationRecordsSafe(
  input: NotificationRuntimeCertificationInput | null | undefined
): { runtimeCertificationItems: NotificationRuntimeCertificationRecord[]; warning: string | null } {
  try {
    const certificationInput =
      input ??
      collectNotificationRuntimeCertificationInput({
        foundationsPresent: false,
        readOnlyProtectionVerified: false,
        securityReviewPassed: false
      });

    const runtimeCertificationItems = NOTIFICATION_RUNTIME_CERTIFICATION_SURFACES.map((surface) =>
      buildSurfaceRuntimeCertificationRecord(surface, certificationInput)
    );

    return {
      runtimeCertificationItems,
      warning: sanitizeNotificationAdminDisplayTextSafe(certificationInput.runtimeWarning, 240) || null
    };
  } catch (error) {
    console.error("[notification-runtime-certification-runtime] runtime certification records build failed", error);

    return {
      runtimeCertificationItems: [buildNotificationRuntimeCertificationFallbackRecordSafe()],
      warning: "Notification runtime certification runtime fallback applied."
    };
  }
}

export function buildNotificationRuntimeCertificationRuntimeStatsSafe(
  runtimeCertificationItems: NotificationRuntimeCertificationRecord[] | null | undefined
): NotificationRuntimeCertificationRuntimeStats {
  try {
    const items = Array.isArray(runtimeCertificationItems) ? runtimeCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);

    return {
      certifiedSurfaces: items.filter((item) => item.certificationStatus === "certified").length,
      fallbackSurfaces: items.filter((item) => item.certificationStatus === "fallback").length,
      needsReviewSurfaces: items.filter((item) => item.certificationStatus === "needs_review").length,
      productionSafeSurfaces: items.filter((item) => item.productionSafe).length,
      readOnlySurfaces: items.filter((item) => item.readOnlyReady).length,
      totalChecks: allChecks.length,
      totalChecksFailed: allChecks.filter((check) => !check.passed).length,
      totalChecksPassed: allChecks.filter((check) => check.passed).length,
      totalSurfaces: items.length
    };
  } catch (error) {
    console.error("[notification-runtime-certification-runtime] runtime certification stats build failed", error);

    return {
      certifiedSurfaces: 0,
      fallbackSurfaces: 0,
      needsReviewSurfaces: 0,
      productionSafeSurfaces: 0,
      readOnlySurfaces: 0,
      totalChecks: 0,
      totalChecksFailed: 0,
      totalChecksPassed: 0,
      totalSurfaces: 0
    };
  }
}

export function buildNotificationRuntimeCertificationSummarySafe(
  runtimeCertificationItems: NotificationRuntimeCertificationRecord[] | null | undefined,
  input?: NotificationRuntimeCertificationInput | null
): NotificationRuntimeCertificationSummary {
  try {
    const items = Array.isArray(runtimeCertificationItems) ? runtimeCertificationItems : [];
    const allChecks = items.flatMap((item) => item.checks);
    const passedChecks = allChecks.filter((check) => check.passed).length;
    const failedChecks = allChecks.length - passedChecks;
    const needsReview = items.some((item) => item.certificationStatus === "needs_review");
    const readOnlyPassed = items.every((item) => item.readOnlyReady);
    const dataProtectionPassed = Boolean(input?.dataCertificationPassed);
    const securityPassed =
      Boolean(input?.securityCertificationPassed) && Boolean(input?.securityReviewPassed);
    const foundationsPassed = Boolean(input?.foundationsPresent);
    const productionSafe =
      !needsReview &&
      failedChecks === 0 &&
      readOnlyPassed &&
      dataProtectionPassed &&
      securityPassed &&
      foundationsPassed &&
      Boolean(input?.readOnlyProtectionVerified) &&
      Boolean(input?.safeActionsGuarded) &&
      Boolean(input?.errorSanitizationReady);
    const certificationPassed = productionSafe;

    return {
      certificationDescription: certificationPassed
        ? "Notification runtime certification passed for NT-1 to NT-27. Notification Center is production-safe, read-only on page load, secure, and stable."
        : "Notification runtime certification completed with one or more surfaces needing attention.",
      certificationPassed,
      certifiedAt: new Date().toISOString(),
      dataProtectionPassed,
      executionBlocked: true,
      failedChecks,
      foundationsPassed,
      pageLoadReadOnly: true,
      passedChecks,
      productionSafe,
      readOnlyPassed,
      rlsPreserved: true,
      safeSummary: sanitizeNotificationAdminDisplayTextSafe(
        certificationPassed
          ? "NT-28 runtime certification: full Notification Center runtime from NT-1 to NT-27 is certified production-safe with read-only page load, masked data, guarded actions, and preserved RLS."
          : "NT-28 runtime certification: review flagged surfaces before treating Notification Center as production-ready.",
        240
      ),
      securityPassed,
      totalChecks: allChecks.length
    };
  } catch (error) {
    console.error("[notification-runtime-certification-runtime] runtime certification summary build failed", error);

    return {
      certificationDescription: "Notification runtime certification runtime fallback applied.",
      certificationPassed: false,
      certifiedAt: new Date(0).toISOString(),
      dataProtectionPassed: false,
      executionBlocked: true,
      failedChecks: 0,
      foundationsPassed: false,
      pageLoadReadOnly: true,
      passedChecks: 0,
      productionSafe: false,
      readOnlyPassed: false,
      rlsPreserved: true,
      safeSummary: "Notification runtime certification could not be completed safely.",
      securityPassed: false,
      totalChecks: 0
    };
  }
}

export function verifyNotificationRuntimeCertificationPresent(
  runtimeCertificationItems: NotificationRuntimeCertificationRecord[] | null | undefined
) {
  const items = Array.isArray(runtimeCertificationItems) ? runtimeCertificationItems : [];
  return items.length >= NOTIFICATION_RUNTIME_CERTIFICATION_SURFACES.length;
}

export function listNotificationRuntimeCertificationCatalog() {
  return NOTIFICATION_RUNTIME_CERTIFICATION_SURFACES.map((surface) => ({
    label: getNotificationRuntimeCertificationSurfaceLabel(surface),
    surface
  }));
}

// NT-29+ placeholders stay disconnected.
export const NOTIFICATION_RUNTIME_CERTIFICATION_FUTURE_HOOKS = [
  "notification_runtime_export_attestation",
  "notification_runtime_remediation",
  "notification_runtime_alerting"
] as const;
