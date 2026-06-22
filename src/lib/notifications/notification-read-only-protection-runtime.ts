import "server-only";

import { sanitizeNotificationAdminDisplayTextSafe } from "@/src/lib/notifications/notification-security-runtime";

export type NotificationReadOnlyProtectionSurface =
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
  | "recipients"
  | "registry"
  | "retries"
  | "reviews"
  | "safe_actions"
  | "statuses"
  | "templates"
  | "types";

export type NotificationReadOnlyProtectionRecord = {
  blockedMutations: string[];
  fallbackMessage: string;
  protectionId: string;
  protectionReady: boolean;
  readOnlyGuarantee: string;
  safeSummary: string;
  surface: NotificationReadOnlyProtectionSurface;
  surfaceLabel: string;
};

export type NotificationReadOnlyProtectionRuntimeStats = {
  protectedSurfaces: number;
  readOnlySurfaces: number;
  totalSurfaces: number;
  unavailableSurfaces: number;
};

export type NotificationReadOnlyProtectionSummary = {
  auditMutationsBlocked: true;
  externalProvidersCalled: false;
  foundationOnly: true;
  pageLoadReadOnly: true;
  policyDescription: string;
  queuesProcessed: false;
  retriesExecuted: false;
  safeSummary: string;
  sendsBlocked: true;
};

export type NotificationReadOnlySurfaceAvailability = Partial<Record<NotificationReadOnlyProtectionSurface, boolean>>;

export const NOTIFICATION_READ_ONLY_PROTECTION_FALLBACK_ID = "unknown_notification_read_only_protection" as const;

export const NOTIFICATION_PAGE_LOAD_READ_ONLY_MODE = true as const;

export const NOTIFICATION_READ_ONLY_PROTECTION_SURFACES: readonly NotificationReadOnlyProtectionSurface[] = [
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
  "provider_abstraction"
] as const;

export const NOTIFICATION_READ_ONLY_BLOCKED_MUTATIONS = [
  "audit_mutations",
  "delete",
  "event_creation",
  "insert",
  "log_creation",
  "provider_tests",
  "queue_locks",
  "queue_processing",
  "retries",
  "review_mutations",
  "send",
  "update"
] as const;

const surfaceLabels: Record<NotificationReadOnlyProtectionSurface, string> = {
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
  recipients: "Recipient runtime",
  registry: "Registry runtime",
  retries: "Retry runtime",
  reviews: "Review runtime",
  safe_actions: "Safe action runtime",
  statuses: "Status runtime",
  templates: "Template runtime",
  types: "Type runtime"
};

const blockedMutationsBySurface: Record<NotificationReadOnlyProtectionSurface, string[]> = {
  analytics: ["insert", "update", "delete", "send"],
  audit: ["insert", "update", "delete", "audit_mutations"],
  categories: ["insert", "update", "delete"],
  channels: ["insert", "update", "delete", "provider_tests"],
  deliveries: ["insert", "update", "delete", "send", "retries"],
  events: ["insert", "update", "delete", "event_creation", "send"],
  failures: ["insert", "update", "delete", "retries", "review_mutations"],
  health: ["insert", "update", "delete", "provider_tests"],
  logs: ["insert", "update", "delete", "log_creation", "send"],
  metrics: ["insert", "update", "delete"],
  monitoring: ["insert", "update", "delete", "provider_tests"],
  provider_abstraction: ["insert", "update", "delete", "provider_tests", "send"],
  providers: ["insert", "update", "delete", "provider_tests", "send"],
  queue: ["insert", "update", "delete", "queue_processing", "queue_locks", "retries", "send"],
  recipients: ["insert", "update", "delete", "send"],
  registry: ["insert", "update", "delete"],
  retries: ["insert", "update", "delete", "retries", "send", "queue_processing"],
  reviews: ["insert", "update", "delete", "review_mutations"],
  safe_actions: ["send", "retries", "queue_processing", "provider_tests", "audit_mutations"],
  statuses: ["insert", "update", "delete"],
  templates: ["insert", "update", "delete", "send"],
  types: ["insert", "update", "delete"]
};

const fallbackMessages: Record<NotificationReadOnlyProtectionSurface, string> = {
  analytics: "Analytics runtime fallback. Read-only visibility only.",
  audit: "Audit runtime fallback. No audit mutations during page load.",
  categories: "Category runtime fallback. Read-only visibility only.",
  channels: "Channel runtime fallback. Read-only visibility only.",
  deliveries: "Delivery runtime fallback. No send or retry during page load.",
  events: "Event runtime fallback. No event creation during page load.",
  failures: "Failure runtime fallback. No review or retry during page load.",
  health: "Health runtime fallback. No live provider tests during page load.",
  logs: "Log runtime fallback. No log creation during page load.",
  metrics: "Metrics runtime fallback. Read-only visibility only.",
  monitoring: "Monitoring runtime fallback. Read-only visibility only.",
  provider_abstraction: "Provider abstraction fallback. No external provider execution.",
  providers: "Provider runtime fallback. No provider tests during page load.",
  queue: "Queue runtime fallback. No queue processing during page load.",
  recipients: "Recipient runtime fallback. Read-only masked visibility only.",
  registry: "Registry runtime fallback. Read-only registry visibility only.",
  retries: "Retry runtime fallback. No retry execution during page load.",
  reviews: "Review runtime fallback. No automatic review during page load.",
  safe_actions: "Safe action runtime fallback. Actions remain guarded placeholders.",
  statuses: "Status runtime fallback. Read-only visibility only.",
  templates: "Template runtime fallback. No template mutation during page load.",
  types: "Type runtime fallback. Read-only visibility only."
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

export function getNotificationReadOnlyProtectionSurfaceLabel(surface: NotificationReadOnlyProtectionSurface) {
  return surfaceLabels[surface];
}

export function getNotificationReadOnlyProtectionFallback(surface: NotificationReadOnlyProtectionSurface) {
  return fallbackMessages[surface];
}

export function listNotificationReadOnlyBlockedMutationsForSurface(surface: NotificationReadOnlyProtectionSurface) {
  return [...blockedMutationsBySurface[surface]];
}

export function isNotificationPageLoadReadOnlyModeEnabled() {
  return NOTIFICATION_PAGE_LOAD_READ_ONLY_MODE;
}

export function assertNotificationRuntimeMutationBlocked(action: string) {
  throw new Error(
    sanitizeNotificationReadOnlyProtectionMessage(
      `Notification runtime mutation blocked during read-only page load: ${text(action, 120) || "unknown action"}.`
    )
  );
}

export function sanitizeNotificationReadOnlyProtectionMessage(value: unknown, maxLength = 240) {
  const cleaned = sanitizeNotificationAdminDisplayTextSafe(value, maxLength);
  return cleaned || "Notification read-only protection is active.";
}

function buildReadOnlyGuarantee(surface: NotificationReadOnlyProtectionSurface) {
  return sanitizeNotificationReadOnlyProtectionMessage(
    `${getNotificationReadOnlyProtectionSurfaceLabel(surface)} uses read-only Super Admin queries during page load. Blocked: ${listNotificationReadOnlyBlockedMutationsForSurface(surface).join(", ")}.`
  );
}

function buildProtectionSafeSummary(params: {
  protectionReady: boolean;
  surface: NotificationReadOnlyProtectionSurface;
}) {
  if (!params.protectionReady) {
    return sanitizeNotificationReadOnlyProtectionMessage(
      `${getNotificationReadOnlyProtectionSurfaceLabel(params.surface)} read-only protection fallback applied. Unsafe mutation paths remain disconnected.`
    );
  }

  return sanitizeNotificationReadOnlyProtectionMessage(
    `${getNotificationReadOnlyProtectionSurfaceLabel(params.surface)} is protected for read-only page load. No inserts, updates, deletes, sends, retries, provider tests, queue locks, or audit mutations execute while rendering /admin/notifications.`
  );
}

function buildProtectionRecord(
  surface: NotificationReadOnlyProtectionSurface,
  protectionReady: boolean
): NotificationReadOnlyProtectionRecord {
  return {
    blockedMutations: listNotificationReadOnlyBlockedMutationsForSurface(surface),
    fallbackMessage: getNotificationReadOnlyProtectionFallback(surface),
    protectionId: `read-only:${surface}`,
    protectionReady,
    readOnlyGuarantee: buildReadOnlyGuarantee(surface),
    safeSummary: buildProtectionSafeSummary({ protectionReady, surface }),
    surface,
    surfaceLabel: getNotificationReadOnlyProtectionSurfaceLabel(surface)
  };
}

export function buildNotificationReadOnlyProtectionFallbackRecordSafe(
  surface: NotificationReadOnlyProtectionSurface = "registry"
): NotificationReadOnlyProtectionRecord {
  return {
    ...buildProtectionRecord(surface, false),
    protectionId: NOTIFICATION_READ_ONLY_PROTECTION_FALLBACK_ID,
    safeSummary:
      "Notification read-only protection fallback applied. Super Admin page load remains read-only with guarded placeholders only."
  };
}

export function buildNotificationReadOnlyProtectionRecordsSafe(params?: {
  surfaceAvailability?: NotificationReadOnlySurfaceAvailability | null;
}): { readOnlyProtectionItems: NotificationReadOnlyProtectionRecord[]; warning: string | null } {
  try {
    const availability = params?.surfaceAvailability ?? {};

    const readOnlyProtectionItems = NOTIFICATION_READ_ONLY_PROTECTION_SURFACES.map((surface) =>
      buildProtectionRecord(surface, availability[surface] ?? true)
    );

    return {
      readOnlyProtectionItems,
      warning: null
    };
  } catch (error) {
    console.error("[notification-read-only-protection-runtime] read-only protection records build failed", error);

    return {
      readOnlyProtectionItems: [buildNotificationReadOnlyProtectionFallbackRecordSafe()],
      warning: "Notification read-only protection runtime fallback applied."
    };
  }
}

export function buildNotificationReadOnlyProtectionRuntimeStatsSafe(
  readOnlyProtectionItems: NotificationReadOnlyProtectionRecord[] | null | undefined
): NotificationReadOnlyProtectionRuntimeStats {
  try {
    const items = Array.isArray(readOnlyProtectionItems) ? readOnlyProtectionItems : [];

    return {
      protectedSurfaces: items.filter((item) => item.protectionReady).length,
      readOnlySurfaces: items.length,
      totalSurfaces: items.length,
      unavailableSurfaces: items.filter((item) => !item.protectionReady).length
    };
  } catch (error) {
    console.error("[notification-read-only-protection-runtime] read-only protection stats build failed", error);

    return {
      protectedSurfaces: 0,
      readOnlySurfaces: 0,
      totalSurfaces: 0,
      unavailableSurfaces: 0
    };
  }
}

export function verifyNotificationReadOnlyProtectionPresent(
  readOnlyProtectionItems: NotificationReadOnlyProtectionRecord[] | null | undefined
) {
  const items = Array.isArray(readOnlyProtectionItems) ? readOnlyProtectionItems : [];
  return items.length > 0 && items.every((item) => item.blockedMutations.length > 0);
}

export function buildNotificationReadOnlyProtectionSummarySafe(): NotificationReadOnlyProtectionSummary {
  return {
    auditMutationsBlocked: true,
    externalProvidersCalled: false,
    foundationOnly: true,
    pageLoadReadOnly: true,
    policyDescription:
      "Notification Center page load is strictly read-only across registry, types, statuses, channels, categories, providers, templates, deliveries, queue, retries, failures, audit, monitoring, metrics, analytics, health, recipients, events, logs, reviews, safe actions, and provider abstraction surfaces. Only safe SELECT-style reads run. No inserts, updates, deletes, sends, retries, provider tests, queue locks, audit mutations, cron jobs, background workers, or external provider calls execute during render.",
    queuesProcessed: false,
    retriesExecuted: false,
    safeSummary:
      "NT-25 read-only protection runtime: Super Admin visibility with guarded inactive actions and safe fallback summaries only.",
    sendsBlocked: true
  };
}

export function listNotificationReadOnlyProtectionCatalog() {
  return NOTIFICATION_READ_ONLY_PROTECTION_SURFACES.map((surface) => ({
    blockedMutations: listNotificationReadOnlyBlockedMutationsForSurface(surface),
    fallbackMessage: getNotificationReadOnlyProtectionFallback(surface),
    surface,
    surfaceLabel: getNotificationReadOnlyProtectionSurfaceLabel(surface)
  }));
}

export function sanitizeNotificationReadOnlyProtectionMetadataSafe(params: {
  protectionReady: boolean;
  surface: NotificationReadOnlyProtectionSurface;
}) {
  return sanitizeNotificationAdminDisplayTextSafe(
    [
      `surface=${params.surface}`,
      `read_only=${NOTIFICATION_PAGE_LOAD_READ_ONLY_MODE}`,
      `ready=${params.protectionReady}`,
      `source=notification_read_only_protection_runtime`
    ].join(" "),
    240
  );
}

// NT-26+ placeholders: write orchestration, mutation approval, and automation stay disconnected.
export const NOTIFICATION_READ_ONLY_PROTECTION_FUTURE_HOOKS = [
  "notification_write_orchestration",
  "notification_mutation_approval",
  "notification_write_automation"
] as const;
