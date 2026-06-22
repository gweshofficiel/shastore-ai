import "server-only";

import {
  maskNotificationAuditIpReference,
  sanitizeNotificationAuditMetadata,
  sanitizeNotificationAuditUserAgent
} from "@/src/lib/notifications/notification-audit-runtime";
import type { NotificationChannel } from "@/src/lib/notifications/notification-channel-runtime";
import {
  maskNotificationDeliveryRecipient,
  sanitizeNotificationDeliveryErrorSummary
} from "@/src/lib/notifications/notification-delivery-runtime";
import { sanitizeNotificationFailureReason } from "@/src/lib/notifications/notification-failure-runtime";
import { sanitizeNotificationHealthMetadata } from "@/src/lib/notifications/notification-health-runtime";
import { sanitizeNotificationMonitoringMetadata } from "@/src/lib/notifications/notification-monitoring-runtime";
import { sanitizeNotificationRetryFailureReason } from "@/src/lib/notifications/notification-retry-runtime";
import { sanitizeNotificationTemplatePreviewContent } from "@/src/lib/notifications/notification-template-runtime";

export type NotificationSecurityProtectionState = "needs_review" | "protected" | "unknown";

export type NotificationSecuritySurface =
  | "analytics"
  | "audit"
  | "category"
  | "channel"
  | "delivery"
  | "failure"
  | "health"
  | "metrics"
  | "monitoring"
  | "provider"
  | "queue"
  | "registry"
  | "retry"
  | "status"
  | "template"
  | "type";

export type NotificationSecurityReviewItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type NotificationSecurityRecord = {
  metadataSummary: string;
  protectionState: NotificationSecurityProtectionState;
  protectionStateLabel: string;
  safeSummary: string;
  securityId: string;
  surface: NotificationSecuritySurface;
  surfaceLabel: string;
};

export type NotificationSecurityCertificationSummary = {
  certificationDescription: string;
  certifiedAt: string;
  failedChecks: number;
  passedChecks: number;
  securityReview: NotificationSecurityReviewItem[];
  securityReviewPassed: boolean;
  totalChecks: number;
};

export type NotificationSecurityRuntimeStats = {
  needsReviewSurfaces: number;
  protectedSurfaces: number;
  securityChecksFailed: number;
  securityChecksPassed: number;
  securityChecksTotal: number;
  securityReviewPassed: number;
  totalSurfaces: number;
  unknownSurfaces: number;
};

export type NotificationSecurityCertificationInput = {
  errorSummaries: unknown[];
  foundationsPresent: boolean;
  ipReferences: unknown[];
  metadataSummaries: unknown[];
  providerSecretStatuses: unknown[];
  recipientDisplays: unknown[];
  runtimeWarning?: string | null;
  userAgentSummaries: unknown[];
};

export const NOTIFICATION_SECURITY_SECRET_PATTERN =
  /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|provider[_-]?config|smtp[_-]?(?:host|user|password|pass)|webhook[_-]?secret|otp|reset[_-]?token|\bsk-[A-Za-z0-9_-]{8,}\b|\bAKIA[0-9A-Z]{16}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}-\d{2}-\d{4}\b|\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b)/i;

export const NOTIFICATION_SECURITY_CERTIFICATION_FALLBACK_SUMMARY: NotificationSecurityCertificationSummary = {
  certificationDescription: "Notification security certification fallback. Review could not be completed safely.",
  certifiedAt: new Date(0).toISOString(),
  failedChecks: 0,
  passedChecks: 0,
  securityReview: [],
  securityReviewPassed: false,
  totalChecks: 0
};

const ALLOWED_PROVIDER_SECRET_STATUSES = new Set([
  "masked_configured",
  "masked_partial",
  "missing",
  "no_secret_required"
]);

const STATIC_SECURITY_REVIEW: NotificationSecurityReviewItem[] = [
  {
    category: "Access control",
    message: "/admin/notifications is rendered inside the admin layout with super-admin read-only visibility.",
    passed: true
  },
  {
    category: "Page load",
    message: "Notification Center page load uses read-only registry, log, monitoring, and runtime queries only.",
    passed: true
  },
  {
    category: "Database",
    message: "Notification runtime uses service-role read paths with strict RLS preserved on foundation tables.",
    passed: true
  },
  {
    category: "Execution",
    message:
      "No notification sending, queue processing, retry execution, provider tests, export generation, cron jobs, or background workers run during page load.",
    passed: true
  },
  {
    category: "Provider secrets",
    message: "Provider rows expose masked secret status labels only. No API keys, SMTP credentials, or webhook secrets are rendered.",
    passed: true
  },
  {
    category: "Actions",
    message: "Notification Center placeholder actions run only on explicit admin submit, not on page load.",
    passed: true
  },
  {
    category: "Foundations",
    message: "Notification Center foundations NT-1 to NT-16 remain display and readiness only with no execution paths connected.",
    passed: true
  }
];

const surfaceLabels: Record<NotificationSecuritySurface, string> = {
  analytics: "Analytics runtime",
  audit: "Audit runtime",
  category: "Category runtime",
  channel: "Channel runtime",
  delivery: "Delivery runtime",
  failure: "Failure runtime",
  health: "Health runtime",
  metrics: "Metrics runtime",
  monitoring: "Monitoring runtime",
  provider: "Provider runtime",
  queue: "Queue runtime",
  registry: "Registry runtime",
  retry: "Retry runtime",
  status: "Status runtime",
  template: "Template runtime",
  type: "Type runtime"
};

const protectionStateLabels: Record<NotificationSecurityProtectionState, string> = {
  needs_review: "Needs review",
  protected: "Protected",
  unknown: "Unknown"
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

function safeCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function sanitizeNotificationSecurityText(value: unknown, maxLength = 240) {
  return text(value, maxLength);
}

export function containsNotificationSecuritySecretPattern(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 500);
  if (!cleaned) return false;

  if (cleaned.includes("[redacted") || cleaned.includes("[masked")) {
    return false;
  }

  return NOTIFICATION_SECURITY_SECRET_PATTERN.test(cleaned);
}

export function sanitizeNotificationAdminDisplayTextSafe(value: unknown, maxLength = 240) {
  const errorSanitized = sanitizeNotificationDeliveryErrorSummary(value);
  if (errorSanitized) {
    return errorSanitized.slice(0, maxLength);
  }

  const cleaned = sanitizeNotificationSecurityText(value, maxLength);
  if (!cleaned) {
    return "";
  }

  if (containsNotificationSecuritySecretPattern(cleaned)) {
    return "[redacted]";
  }

  return cleaned;
}

export function maskNotificationSecurityRecipientSafe(params: {
  channel?: NotificationChannel;
  recipient?: unknown;
  userId?: unknown;
  workspaceId?: unknown;
}) {
  return maskNotificationDeliveryRecipient({
    channel: params.channel ?? "email",
    recipient: params.recipient,
    userId: params.userId,
    workspaceId: params.workspaceId
  });
}

export function maskNotificationSecurityEmailSafe(value: unknown) {
  return maskNotificationSecurityRecipientSafe({ channel: "email", recipient: value });
}

export function maskNotificationSecurityPhoneSafe(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 40);
  if (!cleaned) {
    return "Unknown phone";
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 4) {
    return "[masked-phone]";
  }

  return `***-***-${digits.slice(-4)}`;
}

export function maskNotificationSecurityIpReferenceSafe(value: unknown) {
  return maskNotificationAuditIpReference(value);
}

export function maskNotificationSecurityUserAgentSafe(value: unknown) {
  return sanitizeNotificationAuditUserAgent(value);
}

export function maskNotificationSecurityIdentifierSafe(value: unknown, prefix = "ref") {
  const raw = sanitizeNotificationSecurityText(value, 80);
  if (!raw) {
    return `${prefix}:unknown`;
  }

  if (containsNotificationSecuritySecretPattern(raw)) {
    return `[masked-${prefix}]`;
  }

  if (raw.length <= 8) {
    return `${prefix}:${raw.slice(0, 2)}***`;
  }

  return `${prefix}:${raw.slice(0, 8)}...`;
}

export function maskNotificationSecurityProviderReferenceSafe(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 120);
  if (!cleaned) {
    return "unknown_provider";
  }

  if (containsNotificationSecuritySecretPattern(cleaned)) {
    return "[masked-provider-ref]";
  }

  return cleaned;
}

export function isAllowedNotificationProviderSecretStatus(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 80);
  return Boolean(cleaned && ALLOWED_PROVIDER_SECRET_STATUSES.has(cleaned));
}

export function isSafelyMaskedNotificationRecipientDisplay(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 120);
  if (!cleaned) return true;
  if (cleaned === "Unknown recipient") return true;
  if (cleaned === "platform admins") return true;
  if (cleaned === "platform recipient") return true;
  if (cleaned.includes("[masked-recipient]")) return true;
  if (cleaned.includes("*")) return true;
  if (cleaned.startsWith("user:") || cleaned.startsWith("workspace:") || cleaned.startsWith("store:")) {
    return true;
  }

  return !containsNotificationSecuritySecretPattern(cleaned) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

export function isSafelySanitizedNotificationDisplayText(value: unknown) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, 240);
  if (!cleaned) return true;
  return !containsNotificationSecuritySecretPattern(cleaned);
}

export function isSafelyMaskedNotificationIpReference(value: unknown) {
  const cleaned = sanitizeNotificationSecurityText(value, 80);
  if (!cleaned) return true;
  return cleaned.includes("[masked-ip]") || cleaned.startsWith("ip:") || !/\d{1,3}(?:\.\d{1,3}){3}/.test(cleaned);
}

export function getNotificationSecuritySurfaceLabel(surface: NotificationSecuritySurface) {
  return surfaceLabels[surface];
}

export function getNotificationSecurityProtectionStateLabel(state: NotificationSecurityProtectionState) {
  return protectionStateLabels[state];
}

export function verifyNotificationSecurityFoundationsPresent(params: {
  analyticsReady?: boolean;
  channelsPresent?: boolean;
  healthReady?: boolean;
  metricsReady?: boolean;
  monitoringPresent?: boolean;
  providerStatusPresent?: boolean;
  registryPresent?: boolean;
  templatesPresent?: boolean;
  typesPresent?: boolean;
}) {
  return (
    Boolean(params.registryPresent) &&
    Boolean(params.typesPresent) &&
    Boolean(params.channelsPresent) &&
    Boolean(params.providerStatusPresent) &&
    Boolean(params.templatesPresent) &&
    Boolean(params.monitoringPresent) &&
    Boolean(params.metricsReady) &&
    Boolean(params.analyticsReady) &&
    Boolean(params.healthReady)
  );
}

export function collectNotificationSecurityCertificationInput(params: {
  auditItems?: Array<{ ipReference?: unknown; metadataSummary?: unknown; safeSummary?: unknown; userAgentSummary?: unknown }>;
  channels?: Array<{ secretStatus?: unknown }>;
  deliveries?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  failureItems?: Array<{ failureReason?: unknown; metadataSummary?: unknown }>;
  foundationsPresent?: boolean;
  healthItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  logs?: Array<{ errorSummary?: unknown; recipientMasked?: unknown }>;
  monitoringItems?: Array<{ metadataSummary?: unknown; safeSummary?: unknown }>;
  providerStatus?: Array<{ metadataSummary?: unknown; secretStatus?: unknown }>;
  queueItems?: Array<{ errorSummary?: unknown }>;
  retryItems?: Array<{ failureReason?: unknown }>;
  runtimeWarning?: string | null;
  templates?: Array<{ bodyPreview?: unknown; metadataSummary?: unknown; subjectPreview?: unknown }>;
}): NotificationSecurityCertificationInput {
  const auditItems = params.auditItems ?? [];
  const channels = params.channels ?? [];
  const deliveries = params.deliveries ?? [];
  const failureItems = params.failureItems ?? [];
  const healthItems = params.healthItems ?? [];
  const logs = params.logs ?? [];
  const monitoringItems = params.monitoringItems ?? [];
  const providerStatus = params.providerStatus ?? [];
  const queueItems = params.queueItems ?? [];
  const retryItems = params.retryItems ?? [];
  const templates = params.templates ?? [];

  return {
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
    providerSecretStatuses: [
      ...providerStatus.map((item) => item.secretStatus),
      ...channels.map((item) => item.secretStatus)
    ],
    recipientDisplays: [
      ...logs.map((log) => log.recipientMasked),
      ...deliveries.map((delivery) => delivery.recipientMasked)
    ],
    runtimeWarning: params.runtimeWarning ?? null,
    userAgentSummaries: auditItems.map((item) => item.userAgentSummary)
  };
}

function buildDynamicSecurityReview(input: NotificationSecurityCertificationInput): NotificationSecurityReviewItem[] {
  const metadataSummaries = Array.isArray(input.metadataSummaries) ? input.metadataSummaries : [];
  const errorSummaries = Array.isArray(input.errorSummaries) ? input.errorSummaries : [];
  const providerSecretStatuses = Array.isArray(input.providerSecretStatuses) ? input.providerSecretStatuses : [];
  const recipientDisplays = Array.isArray(input.recipientDisplays) ? input.recipientDisplays : [];
  const ipReferences = Array.isArray(input.ipReferences) ? input.ipReferences : [];
  const userAgentSummaries = Array.isArray(input.userAgentSummaries) ? input.userAgentSummaries : [];

  const exposedMetadataSummaries = metadataSummaries.filter((summary) =>
    containsNotificationSecuritySecretPattern(summary)
  ).length;
  const exposedErrorSummaries = errorSummaries.filter((summary) => !isSafelySanitizedNotificationDisplayText(summary))
    .length;
  const invalidProviderSecretStatuses = providerSecretStatuses.filter(
    (status) => !isAllowedNotificationProviderSecretStatus(status)
  ).length;
  const exposedRecipientDisplays = recipientDisplays.filter((value) => !isSafelyMaskedNotificationRecipientDisplay(value))
    .length;
  const exposedIpReferences = ipReferences.filter((value) => !isSafelyMaskedNotificationIpReference(value)).length;
  const exposedUserAgents = userAgentSummaries.filter((value) => !isSafelySanitizedNotificationDisplayText(value))
    .length;

  return [
    {
      category: "Foundations",
      message: input.foundationsPresent
        ? "Notification Center foundations NT-1 to NT-16 are present on the loaded admin control payload."
        : "One or more Notification Center foundation payloads were missing from the loaded admin control.",
      passed: input.foundationsPresent
    },
    {
      category: "Metadata",
      message:
        exposedMetadataSummaries === 0
          ? "Loaded notification metadata summaries did not match blocked secret or private-data patterns."
          : `${exposedMetadataSummaries} loaded metadata summaries matched blocked secret patterns.`,
      passed: exposedMetadataSummaries === 0
    },
    {
      category: "Errors",
      message:
        exposedErrorSummaries === 0
          ? "Notification error and failure summaries are sanitized for admin display."
          : `${exposedErrorSummaries} error summaries require additional sanitization.`,
      passed: exposedErrorSummaries === 0
    },
    {
      category: "Recipients",
      message:
        exposedRecipientDisplays === 0
          ? "Notification recipient displays are masked or safely redacted."
          : `${exposedRecipientDisplays} recipient displays may expose private recipient data.`,
      passed: exposedRecipientDisplays === 0
    },
    {
      category: "Network identity",
      message:
        exposedIpReferences === 0
          ? "Audit IP references are masked before display."
          : `${exposedIpReferences} audit IP references may expose full network identity.`,
      passed: exposedIpReferences === 0
    },
    {
      category: "User agents",
      message:
        exposedUserAgents === 0
          ? "Audit user agent summaries are sanitized before display."
          : `${exposedUserAgents} user agent summaries require additional sanitization.`,
      passed: exposedUserAgents === 0
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
      message: sanitizeNotificationAdminDisplayTextSafe(input.runtimeWarning, 240)
        ? "Runtime warnings are present. Notification Center is using safe fallback or recovery paths."
        : "No runtime warnings were reported for the loaded Notification Center admin view.",
      passed: !sanitizeNotificationAdminDisplayTextSafe(input.runtimeWarning, 240)
    }
  ];
}

export function buildNotificationSecurityCertification(
  input: NotificationSecurityCertificationInput
): NotificationSecurityCertificationSummary {
  const securityReview = [...STATIC_SECURITY_REVIEW, ...buildDynamicSecurityReview(input)];
  const passedChecks = securityReview.filter((item) => item.passed).length;
  const failedChecks = securityReview.length - passedChecks;

  return {
    certificationDescription:
      failedChecks === 0
        ? "Notification security certification passed for loaded admin foundations NT-1 to NT-16."
        : "Notification security certification completed with items that need attention.",
    certifiedAt: new Date().toISOString(),
    failedChecks,
    passedChecks,
    securityReview,
    securityReviewPassed: failedChecks === 0,
    totalChecks: securityReview.length
  };
}

export function buildNotificationSecurityCertificationSafe(
  input: NotificationSecurityCertificationInput | null | undefined
): NotificationSecurityCertificationSummary {
  try {
    return buildNotificationSecurityCertification(
      input ?? {
        errorSummaries: [],
        foundationsPresent: false,
        ipReferences: [],
        metadataSummaries: [],
        providerSecretStatuses: [],
        recipientDisplays: [],
        userAgentSummaries: []
      }
    );
  } catch (error) {
    console.error("[notification-security-runtime] security certification failed", error);

    return {
      ...NOTIFICATION_SECURITY_CERTIFICATION_FALLBACK_SUMMARY,
      certificationDescription: "Notification security certification runtime failed safely.",
      certifiedAt: new Date().toISOString(),
      securityReview: STATIC_SECURITY_REVIEW
    };
  }
}

function resolveSurfaceProtectionState(params: {
  exposedCount: number;
  foundationsPresent: boolean;
}): NotificationSecurityProtectionState {
  if (!params.foundationsPresent) {
    return "unknown";
  }

  if (params.exposedCount > 0) {
    return "needs_review";
  }

  return "protected";
}

function buildSurfaceRecord(params: {
  exposedCount: number;
  foundationsPresent: boolean;
  metadataSummary: string;
  safeSummary: string;
  surface: NotificationSecuritySurface;
}): NotificationSecurityRecord {
  const protectionState = resolveSurfaceProtectionState({
    exposedCount: params.exposedCount,
    foundationsPresent: params.foundationsPresent
  });

  return {
    metadataSummary: sanitizeNotificationAdminDisplayTextSafe(params.metadataSummary, 240) || "No safe metadata recorded.",
    protectionState,
    protectionStateLabel: getNotificationSecurityProtectionStateLabel(protectionState),
    safeSummary: sanitizeNotificationAdminDisplayTextSafe(params.safeSummary, 240) || "No safe summary recorded.",
    securityId: `security:${params.surface}`,
    surface: params.surface,
    surfaceLabel: getNotificationSecuritySurfaceLabel(params.surface)
  };
}

export function buildNotificationSecurityRecordsSafe(params: {
  certification: NotificationSecurityCertificationInput;
  certificationSummary: NotificationSecurityCertificationSummary;
}): NotificationSecurityRecord[] {
  try {
    const input = params.certification;
    const metadataSummaries = Array.isArray(input.metadataSummaries) ? input.metadataSummaries : [];
    const errorSummaries = Array.isArray(input.errorSummaries) ? input.errorSummaries : [];
    const recipientDisplays = Array.isArray(input.recipientDisplays) ? input.recipientDisplays : [];
    const ipReferences = Array.isArray(input.ipReferences) ? input.ipReferences : [];
    const userAgentSummaries = Array.isArray(input.userAgentSummaries) ? input.userAgentSummaries : [];
    const providerSecretStatuses = Array.isArray(input.providerSecretStatuses) ? input.providerSecretStatuses : [];

    const exposedMetadata = metadataSummaries.filter((value) => containsNotificationSecuritySecretPattern(value)).length;
    const exposedErrors = errorSummaries.filter((value) => !isSafelySanitizedNotificationDisplayText(value)).length;
    const exposedRecipients = recipientDisplays.filter((value) => !isSafelyMaskedNotificationRecipientDisplay(value))
      .length;
    const exposedIps = ipReferences.filter((value) => !isSafelyMaskedNotificationIpReference(value)).length;
    const exposedUserAgents = userAgentSummaries.filter((value) => !isSafelySanitizedNotificationDisplayText(value))
      .length;
    const invalidSecretStatuses = providerSecretStatuses.filter((value) => !isAllowedNotificationProviderSecretStatus(value))
      .length;

    return [
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationHealthMetadata({ source: "notification_registry_runtime" }),
        safeSummary: "Registry rows expose sanitized metadata and masked secret states only.",
        surface: "registry"
      }),
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: "type=sanitized_catalog",
        safeSummary: "Notification type catalog exposes labels and counts only.",
        surface: "type"
      }),
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: "status=sanitized_catalog",
        safeSummary: "Delivery status catalog exposes labels and counts only.",
        surface: "status"
      }),
      buildSurfaceRecord({
        exposedCount: invalidSecretStatuses,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationMonitoringMetadata({ channel: "in_app", source: "notification_channel_runtime" }),
        safeSummary: "Channel runtime exposes masked configuration and health labels only.",
        surface: "channel"
      }),
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: "category=sanitized_catalog",
        safeSummary: "Category runtime exposes labels and counts only.",
        surface: "category"
      }),
      buildSurfaceRecord({
        exposedCount: invalidSecretStatuses,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationMonitoringMetadata({ source: "notification_provider_runtime" }),
        safeSummary: "Provider runtime exposes provider reference keys and masked secret status only.",
        surface: "provider"
      }),
      buildSurfaceRecord({
        exposedCount: exposedMetadata,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationTemplatePreviewContent("template_preview=sanitized"),
        safeSummary: "Template previews are sanitized and truncated before display.",
        surface: "template"
      }),
      buildSurfaceRecord({
        exposedCount: exposedRecipients + exposedErrors,
        foundationsPresent: input.foundationsPresent,
        metadataSummary:
          sanitizeNotificationDeliveryErrorSummary("delivery_runtime=sanitized") ?? "delivery_runtime=sanitized",
        safeSummary: "Delivery runtime masks recipients and sanitizes error summaries.",
        surface: "delivery"
      }),
      buildSurfaceRecord({
        exposedCount: exposedErrors,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationMonitoringMetadata({ source: "notification_queue_runtime" }),
        safeSummary: "Queue runtime exposes counts and sanitized error summaries only.",
        surface: "queue"
      }),
      buildSurfaceRecord({
        exposedCount: exposedErrors,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationRetryFailureReason("retry_runtime=sanitized") ?? "retry_runtime=sanitized",
        safeSummary: "Retry runtime exposes sanitized failure reasons without raw payloads.",
        surface: "retry"
      }),
      buildSurfaceRecord({
        exposedCount: exposedErrors,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationFailureReason("failure_runtime=sanitized") ?? "failure_runtime=sanitized",
        safeSummary: "Failure runtime exposes sanitized failure codes and reasons only.",
        surface: "failure"
      }),
      buildSurfaceRecord({
        exposedCount: exposedMetadata + exposedIps + exposedUserAgents,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationAuditMetadata({ source: "notification_audit_runtime" }),
        safeSummary: "Audit runtime masks actors, IP references, and user agent summaries.",
        surface: "audit"
      }),
      buildSurfaceRecord({
        exposedCount: exposedMetadata,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationMonitoringMetadata({ source: "notification_monitoring_runtime" }),
        safeSummary: "Monitoring runtime exposes sanitized channel health summaries only.",
        surface: "monitoring"
      }),
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: "metrics=aggregated_counts_only",
        safeSummary: "Metrics runtime exposes numeric counters only.",
        surface: "metrics"
      }),
      buildSurfaceRecord({
        exposedCount: 0,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: "analytics=aggregated_counts_only",
        safeSummary: "Analytics runtime exposes aggregated counts and rates only.",
        surface: "analytics"
      }),
      buildSurfaceRecord({
        exposedCount: exposedMetadata,
        foundationsPresent: input.foundationsPresent,
        metadataSummary: sanitizeNotificationHealthMetadata({ source: "notification_health_runtime" }),
        safeSummary: "Health runtime exposes sanitized health summaries and timestamps only.",
        surface: "health"
      })
    ];
  } catch (error) {
    console.error("[notification-security-runtime] security records build failed", error);

    return [
      buildSurfaceRecord({
        exposedCount: 1,
        foundationsPresent: false,
        metadataSummary: "security_runtime=fallback",
        safeSummary: "Notification security visibility could not be resolved safely.",
        surface: "registry"
      })
    ];
  }
}

export function buildNotificationSecurityRuntimeStatsSafe(params: {
  certification: NotificationSecurityCertificationSummary;
  securityRecords: NotificationSecurityRecord[] | null | undefined;
}): NotificationSecurityRuntimeStats {
  try {
    const records = Array.isArray(params.securityRecords) ? params.securityRecords : [];

    return {
      needsReviewSurfaces: records.filter((record) => record.protectionState === "needs_review").length,
      protectedSurfaces: records.filter((record) => record.protectionState === "protected").length,
      securityChecksFailed: safeCount(params.certification.failedChecks),
      securityChecksPassed: safeCount(params.certification.passedChecks),
      securityChecksTotal: safeCount(params.certification.totalChecks),
      securityReviewPassed: params.certification.securityReviewPassed ? 1 : 0,
      totalSurfaces: records.length,
      unknownSurfaces: records.filter((record) => record.protectionState === "unknown").length
    };
  } catch (error) {
    console.error("[notification-security-runtime] security runtime stats build failed", error);

    return {
      needsReviewSurfaces: 0,
      protectedSurfaces: 0,
      securityChecksFailed: 0,
      securityChecksPassed: 0,
      securityChecksTotal: 0,
      securityReviewPassed: 0,
      totalSurfaces: 0,
      unknownSurfaces: 0
    };
  }
}

export function listNotificationSecuritySurfaceCatalog() {
  return (Object.keys(surfaceLabels) as NotificationSecuritySurface[]).map((surface) => ({
    description: `Read-only security visibility for ${surfaceLabels[surface].toLowerCase()}.`,
    label: surfaceLabels[surface],
    surface
  }));
}

// NT-18+ placeholders: security remediation, export, and alerting stay disconnected.
export const NOTIFICATION_SECURITY_FUTURE_HOOKS = [
  "notification_security_remediation",
  "notification_security_export",
  "notification_security_alerting"
] as const;
